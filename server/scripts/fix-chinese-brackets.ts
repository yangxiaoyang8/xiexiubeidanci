/**
 * 修复小说中的中文方括号格式
 */

import { getSupabaseClient } from '../src/storage/database/supabase-client';

async function fixChineseBrackets() {
  const client = getSupabaseClient();
  
  // 获取所有小说
  const { data: novels, error } = await client
    .from('novels')
    .select('id, title, content');
  
  if (error) {
    console.error('获取小说失败:', error);
    return;
  }
  
  console.log(`📚 共有 ${novels.length} 篇小说\n`);
  
  let updatedCount = 0;
  
  for (const novel of novels) {
    if (!novel.content) continue;
    
    const originalContent = novel.content;
    
    // 替换中文方括号为英文方括号
    const newContent = originalContent
      .replace(/【/g, '[')
      .replace(/】/g, ']');
    
    if (newContent !== originalContent) {
      const changeCount = (originalContent.match(/【[a-zA-Z-]+】/g) || []).length;
      
      console.log(`📝 ${novel.title}`);
      console.log(`   修复了 ${changeCount} 处中文方括号`);
      
      const { error: updateError } = await client
        .from('novels')
        .update({ content: newContent })
        .eq('id', novel.id);
      
      if (updateError) {
        console.error(`   ❌ 更新失败:`, updateError);
      } else {
        console.log(`   ✅ 更新成功`);
        updatedCount++;
      }
    }
  }
  
  console.log(`\n🎉 完成！共更新了 ${updatedCount} 篇小说`);
}

fixChineseBrackets().catch(console.error);
