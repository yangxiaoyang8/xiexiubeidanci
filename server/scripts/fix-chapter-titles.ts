/**
 * 修复章节标题格式
 */

import { getSupabaseClient } from '../src/storage/database/supabase-client';

async function fixChapterTitles() {
  const client = getSupabaseClient();
  
  // 获取所有小说
  const { data: novels, error } = await client
    .from('novels')
    .select('id, title, content');
  
  if (error) {
    console.error('获取小说失败:', error);
    return;
  }
  
  console.log(`📚 修复章节标题格式\n`);
  
  let updatedCount = 0;
  
  for (const novel of novels) {
    if (!novel.content) continue;
    
    const originalContent = novel.content;
    
    // 将 [第X章 章节名] 格式修复为 【第X章 章节名】
    const newContent = originalContent.replace(
      /\[第([一二三四五六七八九十\d]+)章\s*([^\]]*)\]/g,
      '【第$1章 $2】'
    );
    
    if (newContent !== originalContent) {
      console.log(`📝 ${novel.title}`);
      
      const { error: updateError } = await client
        .from('novels')
        .update({ content: newContent })
        .eq('id', novel.id);
      
      if (updateError) {
        console.error(`   ❌ 更新失败:`, updateError);
      } else {
        console.log(`   ✅ 章节标题已修复`);
        updatedCount++;
      }
    }
  }
  
  console.log(`\n🎉 完成！共更新了 ${updatedCount} 篇小说`);
}

fixChapterTitles().catch(console.error);
