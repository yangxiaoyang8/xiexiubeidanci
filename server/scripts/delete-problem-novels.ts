/**
 * 删除有问题的小说并重新生成
 */

import { getSupabaseClient } from '../src/storage/database/supabase-client';

// 问题小说ID列表
const PROBLEM_NOVEL_IDS = [
  '61649e75-bb01-44e8-9a0d-b13d1c314890', // 深渊指纹 - 使用中文方括号
  '0332e5ad-e2a0-4110-8795-473fb89a7eff', // 雅思词库-尘途魔影 - 释义截断错误
  '400530f7-5c25-4c21-9770-5c217800802d', // 雅思词库-夏风漫过旧走廊 - 释义截断错误
  'e93d17eb-721f-438c-ae61-399895893a76', // 雅思词库-剑啸西风录 - 释义截断错误
];

async function deleteProblemNovels() {
  const client = getSupabaseClient();
  
  console.log('🗑️ 开始删除问题小说...\n');
  
  for (const novelId of PROBLEM_NOVEL_IDS) {
    // 先获取小说标题
    const { data: novel, error: fetchError } = await client
      .from('novels')
      .select('title')
      .eq('id', novelId)
      .single();
    
    if (fetchError) {
      console.log(`❌ 获取小说 ${novelId} 失败:`, fetchError.message);
      continue;
    }
    
    // 删除关联的 novel_words
    const { error: wordsError } = await client
      .from('novel_words')
      .delete()
      .eq('novel_id', novelId);
    
    if (wordsError) {
      console.log(`⚠️ 删除 ${novel?.title} 的词汇关联失败:`, wordsError.message);
    }
    
    // 删除小说
    const { error: deleteError } = await client
      .from('novels')
      .delete()
      .eq('id', novelId);
    
    if (deleteError) {
      console.log(`❌ 删除小说 ${novel?.title} 失败:`, deleteError.message);
    } else {
      console.log(`✅ 已删除: ${novel?.title}`);
    }
  }
  
  console.log('\n✨ 删除完成！');
}

deleteProblemNovels().catch(console.error);
