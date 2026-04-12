/**
 * 重新生成大明新商路
 */

import { getSupabaseClient } from '../src/storage/database/supabase-client.js';
import { LLMClient, Config } from 'coze-coding-dev-sdk';

const NOVEL_ID = '73fec61c-6c79-4ad4-90c8-c9d01555817d';
const BOOK_ID = '8b86bc59-13e5-4c56-be91-4a9d106ebf57';
const WORDS_PER_NOVEL = 350;

async function regenerateDaming() {
  const client = getSupabaseClient();
  
  console.log('🗑️ 删除旧的大明新商路...');
  
  // 删除关联的 novel_words
  await client.from('novel_words').delete().eq('novel_id', NOVEL_ID);
  
  // 删除小说
  const { error: deleteError } = await client
    .from('novels')
    .delete()
    .eq('id', NOVEL_ID);
  
  if (deleteError) {
    console.error('删除失败:', deleteError);
    return;
  }
  
  console.log('✅ 删除成功\n');
  
  // 获取词汇
  const { data: words } = await client
    .from('words')
    .select('id, word, meaning')
    .eq('book_id', BOOK_ID);
  
  if (!words || words.length < 100) {
    console.error('词汇不足');
    return;
  }
  
  console.log(`📊 可用词汇: ${words.length} 个\n`);
  
  // 打乱词汇
  const shuffled = [...words].sort(() => Math.random() - 0.5);
  const selectedWords = shuffled.slice(0, WORDS_PER_NOVEL);
  const wordListStr = selectedWords.map(w => `${w.word}(${w.meaning})`).join(', ');
  
  const prompt = `你是一位畅销书作家。请创作一部历史穿越类型的中文长篇小说。

【基本信息】
- 主角姓名：李明
- 故事设定：现代研究员穿越到明朝万历年间的商业传奇
- 小说类型：历史穿越

【词汇要求】
必须自然融入以下${selectedWords.length}个英语词汇（每个词汇至少出现一次）：
${wordListStr}

⚠️ 词汇使用规则（非常重要）：
1. 英语词汇必须使用方括号标记，后面紧跟中文圆括号写释义
2. 格式：[英文单词]（中文释义）
3. 中文释义必须是该单词的准确翻译（1-4个字），不能是句子片段
4. 示例：
   ✅ 正确：他骑着 [bicycle]（自行车）穿过街道
   ✅ 正确：这是一笔巨大的 [capital]（资本）
   ❌ 错误：原子（[atomic]，与原子相关的）（格式完全错误）
   ❌ 错误：他骑着 [bicycle]，让人过目难忘（缺少释义）
   ❌ 错误：[bicycle]（斜靠在）（释义错误）
   ❌ 错误：【bicycle】（使用了中文方括号）
5. 英文单词要自然融入中文句子中，保持句子流畅

【篇幅要求】
- 总字数：8000-15000字
- 章节数：8-12章
- 每章开头用【第X章 章节名】格式

【质量要求】
1. 情节紧凑，有悬念、高潮和转折
2. 人物性格鲜明，对话生动自然
3. 融入明朝历史背景，体现商业智慧
4. 有完整的起承转合，结局要合理

【输出格式】
第一行输出小说标题（不超过12字，不要书名号）
然后直接输出小说正文

现在开始创作：`;

  console.log('📖 开始生成新的大明新商路...\n');
  
  const config = new Config();
  const llmClient = new LLMClient(config);
  
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
    return;
  }

  const lines = fullContent.split('\n').filter(l => l.trim());
  let title = lines[0] || '大明新商路';
  
  if (title.includes('第') && title.includes('章')) {
    title = '大明新商路';
  }
  
  title = title.replace(/^[《「『"]|[》」』"]$/g, '').substring(0, 30);
  
  const wordCount = fullContent.replace(/\s/g, '').length;
  const correctFormat = (fullContent.match(/\[[a-zA-Z-]+\]\uff08[^\uff09]+\uff09/g) || []).length;
  
  console.log(`✅ 生成完成: ${title}`);
  console.log(`   字数: ${wordCount}, 正确格式词汇: ${correctFormat}\n`);
  
  // 保存到数据库
  const { error } = await client
    .from('novels')
    .insert({
      book_id: BOOK_ID,
      title: `雅思词库-${title}`,
      content: fullContent,
      summary: '历史穿越类型小说',
      word_count: wordCount,
      chapter_count: (fullContent.match(/第[一二三四五六七八九十\d]+章/g) || []).length
    });
  
  if (error) {
    console.error('保存失败:', error);
  } else {
    console.log('🎉 大明新商路重新生成完成！');
  }
}

regenerateDaming().catch(console.error);
