/**
 * 生成完整预置小说脚本
 * 每个词库生成10篇小说，每篇5000-15000字，包含300-500个词汇
 * 运行: cd server && npx tsx scripts/generate-full-novels.ts &
 */
import { getSupabaseClient } from '../src/storage/database/supabase-client.js';
import { LLMClient, Config } from 'coze-coding-dev-sdk';

const NOVELS_PER_BOOK = 10;
const WORDS_PER_NOVEL = 350;

const GENRES = [
  { name: '都市言情', protagonist: '林晓', plot: '一段跨越阶层与命运的动人爱情故事' },
  { name: '悬疑推理', protagonist: '陈默', plot: '一起扑朔迷离的案件背后隐藏的真相' },
  { name: '科幻未来', protagonist: '周航', plot: '在星际时代探索未知宇宙的冒险' },
  { name: '历史穿越', protagonist: '苏云', plot: '意外穿越到古代开启的传奇人生' },
  { name: '奇幻魔法', protagonist: '陆尘', plot: '一个少年在魔法世界的成长之旅' },
  { name: '校园青春', protagonist: '夏雨', plot: '青春校园里的友谊、成长与初恋' },
  { name: '职场商战', protagonist: '赵明', plot: '职场中从新人到高管的奋斗历程' },
  { name: '武侠江湖', protagonist: '萧风', plot: '江湖恩怨与武林传奇' },
];

interface VocabBook {
  id: string;
  name: string;
  level: string;
  total_words: number;
}

interface Word {
  id: string;
  word: string;
  meaning: string;
}

function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

async function generateNovel(
  book: VocabBook,
  words: Word[],
  genre: string,
  protagonist: string,
  plot: string,
  novelIndex: number,
  llmClient: LLMClient
): Promise<{ title: string; content: string }> {
  const selectedWords = shuffleArray(words).slice(0, WORDS_PER_NOVEL);
  const wordListStr = selectedWords.map(w => w.word).join(', ');

  const prompt = `你是一位畅销书作家。请创作一部${genre}类型的中文长篇小说。

【基本信息】
- 主角姓名：${protagonist}
- 故事设定：${plot}
- 小说类型：${genre}

【词汇要求】
必须自然融入以下${selectedWords.length}个英语词汇（每个词汇至少出现一次）：
${wordListStr}

⚠️ 词汇使用规则（非常重要）：
1. 英语词汇必须使用方括号标记，后面紧跟中文圆括号写释义
2. 格式：[英文单词]（中文释义）
3. 中文释义必须是该单词的准确翻译（1-4个字），不能是句子片段
4. 示例：
   ✅ 正确：她非常 [beautiful]（美丽），让人过目难忘
   ✅ 正确：他骑着 [bicycle]（自行车）穿过街道
   ❌ 错误：她非常 [beautiful]，让人过目难忘（缺少释义）
   ❌ 错误：他骑着 [bicycle]（骑行的自行车）（释义太长）
   ❌ 错误：[bicycle]（斜靠在）（释义错误，应该是"自行车"）
   ❌ 错误：【bicycle】（使用了中文方括号）
5. 英文单词要自然融入中文句子中，保持句子流畅

【篇幅要求】
- 总字数：8000-15000字
- 章节数：8-12章
- 每章开头用【第X章 章节名】格式

【质量要求】
1. 情节紧凑，有悬念、高潮和转折
2. 人物性格鲜明，对话生动自然
3. 融入当下流行元素
4. 有完整的起承转合，结局要合理

【输出格式】
第一行输出小说标题（不超过12字，不要书名号）
然后直接输出小说正文

现在开始创作第${novelIndex}篇小说：`;

  const messages = [{ role: 'user' as const, content: prompt }];
  let fullContent = '';

  try {
    const stream = llmClient.stream(messages, {
      temperature: 0.85,
      model: 'doubao-seed-1-8-251228'
    });

    for await (const chunk of stream) {
      if (chunk.content) {
        fullContent += chunk.content.toString();
      }
    }
  } catch (error) {
    console.error('LLM 调用失败:', error);
    throw error;
  }

  const lines = fullContent.split('\n').filter(l => l.trim());
  let title = lines[0] || `${genre}小说`;
  
  if (title.includes('第') && title.includes('章')) {
    title = `${protagonist}的${genre}之旅`;
  }

  return {
    title: title.replace(/[#*《》]/g, '').trim(),
    content: fullContent
  };
}

async function main() {
  console.log('📚 开始生成完整预置小说...\n');
  console.log(`每个词库将生成 ${NOVELS_PER_BOOK} 篇小说`);
  console.log(`每篇小说约 8000-15000 字，包含 ${WORDS_PER_NOVEL} 个词汇\n`);

  const client = getSupabaseClient();
  const config = new Config();
  const llmClient = new LLMClient(config);

  const { data: books, error: booksError } = await client
    .from('vocab_books')
    .select('*');

  if (booksError || !books) {
    console.error('获取词库失败:', booksError);
    process.exit(1);
  }

  console.log(`📖 共有 ${books.length} 个词库\n`);

  let totalGenerated = 0;

  for (const book of books) {
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`📚 处理词库: ${book.name} (${book.total_words} 词汇)`);
    console.log('═'.repeat(50));

    // 获取词汇
    const { data: words, error: wordsError } = await client
      .from('words')
      .select('id, word, meaning')
      .eq('book_id', book.id);

    if (wordsError || !words || words.length < 100) {
      console.log(`⚠️ 词库词汇不足100个，跳过`);
      continue;
    }

    // 检查现有小说数量
    const { data: existingNovels } = await client
      .from('novels')
      .select('id')
      .eq('book_id', book.id);

    const currentCount = existingNovels?.length || 0;
    const toGenerate = Math.max(0, NOVELS_PER_BOOK - currentCount);

    console.log(`📊 当前小说数: ${currentCount}`);
    console.log(`🎯 需要生成: ${toGenerate} 篇\n`);

    if (toGenerate === 0) {
      console.log('✅ 已有足够小说，跳过');
      continue;
    }

    const shuffledGenres = shuffleArray(GENRES);

    for (let i = 0; i < toGenerate; i++) {
      const genreConfig = shuffledGenres[i % shuffledGenres.length];

      console.log(`\n📖 生成第 ${i + 1}/${toGenerate} 篇小说...`);
      console.log(`   类型: ${genreConfig.name}`);
      console.log(`   主角: ${genreConfig.protagonist}`);

      try {
        const startTime = Date.now();
        const { title, content } = await generateNovel(
          book,
          words,
          genreConfig.name,
          genreConfig.protagonist,
          genreConfig.plot,
          i + 1,
          llmClient
        );

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const chapterCount = (content.match(/第[一二三四五六七八九十\d]+章/g) || []).length || 1;
        const wordCount = content.length;

        // 保存小说
        const { data: novel, error: novelError } = await client
          .from('novels')
          .insert({
            book_id: book.id,
            title: `${book.name}-${title}`,
            content,
            summary: `${genreConfig.name} | ${genreConfig.protagonist} | ${wordCount}字 | ${WORDS_PER_NOVEL}词汇`,
            chapter_count: chapterCount,
            word_count: wordCount
          })
          .select()
          .single();

        if (novelError) {
          console.error(`   ❌ 保存失败:`, novelError.message);
          continue;
        }

        // 关联词汇
        const selectedWords = shuffleArray(words).slice(0, WORDS_PER_NOVEL);
        const novelWordsData = selectedWords.map((w, index) => ({
          novel_id: novel.id,
          word_id: w.id,
          position: index
        }));

        for (let j = 0; j < novelWordsData.length; j += 500) {
          await client.from('novel_words').insert(novelWordsData.slice(j, j + 500));
        }

        console.log(`   ✅ 完成: ${title}`);
        console.log(`      字数: ${wordCount}, 章节: ${chapterCount}, 用时: ${elapsed}秒`);
        totalGenerated++;

        // 避免API限流
        await new Promise(resolve => setTimeout(resolve, 3000));

      } catch (error) {
        console.error(`   ❌ 生成失败:`, error);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  console.log(`\n\n${'═'.repeat(50)}`);
  console.log(`🎉 生成完成！共生成 ${totalGenerated} 篇小说`);
  console.log('═'.repeat(50));
  
  process.exit(0);
}

main().catch(console.error);
