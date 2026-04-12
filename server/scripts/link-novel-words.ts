/**
 * 为新生成的小说创建词汇关联
 */

import { getSupabaseClient } from '../src/storage/database/supabase-client.js';

async function linkNovelWords() {
  const client = getSupabaseClient();
  
  // 获取需要处理的小说
  const { data: novels, error: novelsError } = await client
    .from('novels')
    .select('id, title, content, book_id')
    .like('title', '雅思词库-%');
  
  if (novelsError) {
    console.error('获取小说失败:', novelsError);
    return;
  }
  
  console.log(`📚 找到 ${novels.length} 篇雅思词库小说\n`);
  
  for (const novel of novels) {
    // 检查是否已有词汇关联
    const { data: existingWords } = await client
      .from('novel_words')
      .select('id')
      .eq('novel_id', novel.id);
    
    if (existingWords && existingWords.length > 0) {
      console.log(`✓ ${novel.title} - 已有 ${existingWords.length} 个词汇关联`);
      continue;
    }
    
    // 从小说内容中提取单词
    const regex = /\[([a-zA-Z-]+)\]/g;
    const words: string[] = [];
    let match;
    
    while ((match = regex.exec(novel.content)) !== null) {
      const word = match[1].toLowerCase();
      if (!words.includes(word)) {
        words.push(word);
      }
    }
    
    if (words.length === 0) {
      console.log(`⚠️ ${novel.title} - 未找到单词`);
      continue;
    }
    
    console.log(`📝 ${novel.title} - 找到 ${words.length} 个单词`);
    
    // 获取词汇ID
    const { data: wordRecords, error: wordsError } = await client
      .from('words')
      .select('id, word')
      .eq('book_id', novel.book_id)
      .in('word', words);
    
    if (wordsError || !wordRecords) {
      console.log(`   ❌ 查询词汇失败`);
      continue;
    }
    
    // 创建词汇映射
    const wordMap = new Map(wordRecords.map(w => [w.word.toLowerCase(), w.id]));
    
    // 准备插入数据
    const novelWordsData = words
      .filter(w => wordMap.has(w))
      .map((word, index) => ({
        novel_id: novel.id,
        word_id: wordMap.get(word)!,
        position: index
      }));
    
    if (novelWordsData.length === 0) {
      console.log(`   ⚠️ 没有匹配的词汇`);
      continue;
    }
    
    // 插入关联数据
    const { error: insertError } = await client
      .from('novel_words')
      .insert(novelWordsData);
    
    if (insertError) {
      console.log(`   ❌ 插入失败:`, insertError.message);
    } else {
      console.log(`   ✅ 已创建 ${novelWordsData.length} 个词汇关联`);
    }
  }
  
  console.log('\n🎉 完成！');
}

linkNovelWords().catch(console.error);
