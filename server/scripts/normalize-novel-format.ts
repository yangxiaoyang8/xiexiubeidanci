/**
 * 统一小说格式脚本
 * 将所有小说格式统一为: [word]（中文释义）
 * 
 * 支持的输入格式：
 * 1. [word]（中文）- 正确格式，无需修改
 * 2. [word（中文）] - 需要转换为 [word]（中文）
 * 3. [word] - 无释义格式，保持原样
 */

import { getSupabaseClient } from '../src/storage/database/supabase-client';

async function normalizeNovelFormat() {
  const client = getSupabaseClient();
  
  // 获取所有小说
  const { data: novels, error } = await client
    .from('novels')
    .select('id, title, content');
  
  if (error) {
    console.error('获取小说失败:', error);
    return;
  }
  
  console.log(`📚 共有 ${novels.length} 篇小说需要处理\n`);
  
  let updatedCount = 0;
  
  for (const novel of novels) {
    if (!novel.content) continue;
    
    const originalContent = novel.content;
    let newContent = originalContent;
    let changeCount = 0;
    
    // 格式1: [word（中文）] -> [word]（中文）
    // 匹配: [word（中文）] ，支持带连字符的单词
    const format1Regex = /\[([a-zA-Z-]+)\uff08([^\uff09]+)\uff09\]/g;
    newContent = newContent.replace(format1Regex, (match, word, meaning) => {
      changeCount++;
      return `[${word}]\uff08${meaning}\uff09`;
    });
    
    // 格式2: 处理英文圆括号: [word](中文) -> [word]（中文）
    const format2Regex = /\[([a-zA-Z-]+)\]\(([^)]+)\)/g;
    newContent = newContent.replace(format2Regex, (match, word, meaning) => {
      changeCount++;
      return `[${word}]\uff08${meaning}\uff09`;
    });
    
    if (changeCount > 0) {
      console.log(`📝 ${novel.title}`);
      console.log(`   修改了 ${changeCount} 处格式`);
      
      // 更新数据库
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
    } else {
      console.log(`✓ ${novel.title} - 格式已正确`);
    }
  }
  
  console.log(`\n🎉 完成！共更新了 ${updatedCount} 篇小说`);
}

normalizeNovelFormat().catch(console.error);
