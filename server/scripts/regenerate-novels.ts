/**
 * 补充生成小说脚本
 * 为雅思词库补充生成4篇小说
 */

import { getSupabaseClient } from '../src/storage/database/supabase-client.js';
import { LLMClient, Config } from 'coze-coding-dev-sdk';

const WORDS_PER_NOVEL = 350;

const GENRES = [
  { name: '武侠江湖', protagonist: '萧风', plot: '江湖恩怨与武林传奇' },
  { name: '校园青春', protagonist: '夏雨', plot: '青春校园里的友谊、成长与初恋' },
  { name: '奇幻魔法', protagonist: '陆尘', plot: '一个少年在魔法世界的成长之旅' },
  { name: '悬疑推理', protagonist: '陈默', plot: '一起扑朔迷离的案件背后隐藏的真相' },
];

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
  words: Word[],
  genre: string,
  protagonist: string,
  plot: string,
  llmClient: LLMClient
): Promise<{ title: string; content: string }> {
  const selectedWords = shuffleArray(words).slice(0, WORDS_PER_NOVEL);
  const wordListStr = selectedWords.map(w => `${w.word}(${w.meaning})`).join(', ');

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

  const lines = fullContent.split('\n').filter(l => l.trim());
  let title = lines[0] || `${genre}小说`;
  
  if (title.includes('第') && title.includes('章')) {
    title = `${protagonist}的${genre}之旅`;
  }

  return {
    title: title.replace(/^[《「『"]|[》」』"]$/g, '').substring(0, 30),
    content: fullContent
  };
}

async function main() {
  console.log('📚 开始补充生成小说...\n');
  
  const client = getSupabaseClient();
  
  // 获取雅思词库ID
  const { data: books } = await client
    .from('vocab_books')
    .select('id, name')
    .eq('id', '8b86bc59-13e5-4c56-be91-4a9d106ebf57')
    .single();
  
  if (!books) {
    console.error('❌ 未找到雅思词库');
    return;
  }
  
  console.log(`📖 词库: ${books.name}`);
  
  // 获取词汇
  const { data: words } = await client
    .from('words')
    .select('id, word, meaning')
    .eq('book_id', books.id);
  
  if (!words || words.length < 100) {
    console.error(`❌ 词汇不足: ${words?.length || 0}`);
    return;
  }
  
  console.log(`📊 可用词汇: ${words.length} 个\n`);
  
  // 初始化 LLM
  const config = new Config();
  const llmClient = new LLMClient(config);
  
  // 生成4篇小说
  for (let i = 0; i < 4; i++) {
    const genre = GENRES[i];
    console.log(`📖 生成第 ${i + 1}/4 篇小说...`);
    console.log(`   类型: ${genre.name}`);
    console.log(`   主角: ${genre.protagonist}`);
    
    const startTime = Date.now();
    
    try {
      const result = await generateNovel(
        words,
        genre.name,
        genre.protagonist,
        genre.plot,
        llmClient
      );
      
      const wordCount = result.content.replace(/\s/g, '').length;
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      
      // 统计格式正确的单词数
      const correctFormat = (result.content.match(/\[[a-zA-Z-]+\]\uff08[^\uff09]+\uff09/g) || []).length;
      
      // 保存到数据库
      const { data: novel, error } = await client
        .from('novels')
        .insert({
          book_id: books.id,
          title: `雅思词库-${result.title}`,
          content: result.content,
          summary: `${genre.name}类型小说`,
          word_count: wordCount,
          chapter_count: (result.content.match(/第[一二三四五六七八九十\d]+章/g) || []).length
        })
        .select('id')
        .single();
      
      if (error) {
        console.error(`   ❌ 保存失败:`, error.message);
      } else {
        console.log(`   ✅ 完成: ${result.title}`);
        console.log(`      字数: ${wordCount}, 词汇: ${correctFormat}, 用时: ${duration}秒\n`);
      }
    } catch (error) {
      console.error(`   ❌ 生成失败:`, error);
    }
  }
  
  console.log('🎉 补充生成完成！');
}

main().catch(console.error);
