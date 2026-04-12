/**
 * 预置小说生成脚本
 * 为每个词库生成 10-15 篇小说
 * 运行: cd server && npx tsx scripts/preset-novels.ts
 */
import { getSupabaseClient } from '../src/storage/database/supabase-client.js';
import { LLMClient, Config } from 'coze-coding-dev-sdk';

// 小说类型
const GENRES = [
  { name: '都市言情', desc: '现代都市背景的爱情故事' },
  { name: '悬疑推理', desc: '充满悬念和谜团的推理故事' },
  { name: '科幻未来', desc: '未来科技和太空探索的故事' },
  { name: '历史穿越', desc: '穿越到古代的奇幻冒险' },
  { name: '奇幻魔法', desc: '魔法世界的奇幻冒险' },
  { name: '校园青春', desc: '校园生活中的青春故事' },
  { name: '职场商战', desc: '职场竞争和商业博弈' },
  { name: '武侠江湖', desc: '江湖恩怨和武林传奇' },
];

// 主角名字列表
const PROTAGONISTS = [
  '李明', '张伟', '王芳', '刘洋', '陈晨',
  '杨帆', '赵雪', '周杰', '吴昊', '徐静',
  '林峰', '何雨', '高远', '罗云', '谢瑶'
];

// 情节设定
const PLOTS = [
  '一个普通人通过努力实现梦想的故事',
  '在困境中寻找希望的励志故事',
  '一段跨越重重阻碍的爱情故事',
  '在职场中不断成长的故事',
  '一场惊心动魄的冒险旅程',
  '在逆境中奋起反击的故事',
  '一个关于友情与背叛的故事',
  '在命运的转折点做出选择的故事',
  '一段寻找真相的旅程',
  '在失败中重新站起来的故事',
];

const NOVELS_PER_BOOK = 12; // 每个词库生成12篇小说
const WORDS_PER_NOVEL = 300; // 每篇小说使用300个词汇

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
  llmClient: LLMClient
): Promise<{ title: string; content: string }> {
  const selectedWords = shuffleArray(words).slice(0, WORDS_PER_NOVEL);
  const wordListStr = selectedWords.map(w => w.word).join(', ');

  const prompt = `你是一位专业的小说作家。请创作一部${genre}类型的中文长篇小说。

【基本信息】
- 主角姓名：${protagonist}
- 故事设定：${plot}
- 小说类型：${genre}

【词汇要求】
小说需要自然融入以下${selectedWords.length}个英语词汇（每个词汇至少出现一次）：
${wordListStr}

词汇使用规则：
1. 英语词汇用方括号标记，如 [beautiful]
2. 词汇要自然融入中文语境
3. 每个词汇后可以用括号简短注明中文含义（首次出现时）

【篇幅要求】
- 总字数：8000-15000字（分多个章节）
- 章节数：5-8章
- 每章开头用【第X章 章节名】格式

【质量要求】
1. 情节紧凑，有悬念和高潮
2. 人物性格鲜明，对话生动
3. 融入当下流行元素
4. 有完整的起承转合

【输出格式】
第一行输出小说标题（不超过15字）
然后直接输出小说正文

现在开始创作：`;

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

  // 提取标题
  const lines = fullContent.split('\n').filter(l => l.trim());
  let title = lines[0] || `${genre}小说`;
  
  if (title.includes('第') && title.includes('章')) {
    title = `${protagonist}的${genre}之旅`;
  }

  return {
    title: title.replace(/[#*]/g, '').trim(),
    content: fullContent
  };
}

async function main() {
  console.log('📚 开始预置小说生成...\n');

  const client = getSupabaseClient();
  const config = new Config();
  const llmClient = new LLMClient(config);

  // 获取所有词库
  const { data: books, error: booksError } = await client
    .from('vocab_books')
    .select('*');

  if (booksError || !books) {
    console.error('获取词库失败:', booksError);
    process.exit(1);
  }

  console.log(`📖 共有 ${books.length} 个词库\n`);

  for (const book of books) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`📚 处理词库: ${book.name} (${book.total_words} 词汇)`);
    console.log('='.repeat(50));

    // 检查是否已有足够的小说
    const { data: existingNovels } = await client
      .from('novels')
      .select('id')
      .eq('book_id', book.id);

    if (existingNovels && existingNovels.length >= NOVELS_PER_BOOK) {
      console.log(`✅ 已有 ${existingNovels.length} 篇小说，跳过`);
      continue;
    }

    // 获取词汇
    const { data: words, error: wordsError } = await client
      .from('words')
      .select('id, word, meaning')
      .eq('book_id', book.id);

    if (wordsError || !words || words.length === 0) {
      console.log(`⚠️ 词库无词汇，跳过`);
      continue;
    }

    console.log(`📝 词汇数量: ${words.length}`);
    console.log(`🎯 目标生成: ${NOVELS_PER_BOOK} 篇小说\n`);

    const novelsToGenerate = NOVELS_PER_BOOK - (existingNovels?.length || 0);
    const shuffledGenres = shuffleArray(GENRES);
    const shuffledProtagonists = shuffleArray(PROTAGONISTS);
    const shuffledPlots = shuffleArray(PLOTS);

    for (let i = 0; i < novelsToGenerate; i++) {
      const genre = shuffledGenres[i % shuffledGenres.length].name;
      const protagonist = shuffledProtagonists[i % shuffledProtagonists.length];
      const plot = shuffledPlots[i % shuffledPlots.length];

      console.log(`\n📖 生成第 ${i + 1}/${novelsToGenerate} 篇小说...`);
      console.log(`   类型: ${genre}`);
      console.log(`   主角: ${protagonist}`);
      console.log(`   情节: ${plot}`);

      try {
        const { title, content } = await generateNovel(
          book,
          words,
          genre,
          protagonist,
          plot,
          llmClient
        );

        const chapterCount = (content.match(/第[一二三四五六七八九十\d]+章/g) || []).length || 1;
        const wordCount = content.length;

        // 保存小说
        const { data: novel, error: novelError } = await client
          .from('novels')
          .insert({
            book_id: book.id,
            title,
            content,
            summary: `${genre} | ${protagonist} | ${wordCount}字`,
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

        console.log(`   ✅ 完成: ${title} (${wordCount}字, ${chapterCount}章)`);

        // 避免API限流
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`   ❌ 生成失败:`, error);
      }
    }
  }

  console.log('\n\n🎉 预置小说生成完成！');
  process.exit(0);
}

main().catch(console.error);
