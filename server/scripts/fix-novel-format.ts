/**
 * 修复小说格式脚本
 * 将所有格式统一为: [word]（中文释义）
 */

import { getSupabaseClient } from '../src/storage/database/supabase-client';

async function fixNovelFormat() {
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
    
    let newContent = novel.content;
    let changeCount = 0;
    
    // 格式1: [word]中文 -> [word]（中文）
    // 匹配: [word]后面紧跟中文（不在圆括号里），直到遇到下一个[或标点
    // 例如: [bit]墨色[ash] -> [bit]（墨色）[ash]
    // 例如: [bit]墨色， -> [bit]（墨色），
    const format1Regex = /\[([a-zA-Z-]+)\]([^\s\[\]（）\(\)\n]{1,6})(?=[\s\[\]（）\(\)，。！？「」\"\"\'\'、：；]|$)/g;
    newContent = newContent.replace(format1Regex, (match, word, chinese) => {
      // 检查是否全是中文字符
      if (/^[\u4e00-\u9fa5]+$/.test(chinese)) {
        changeCount++;
        return `[${word}]\uff08${chinese}\uff09`;
      }
      return match;
    });
    
    // 格式2: [word（中文）] -> [word]（中文）
    const format2Regex = /\[([a-zA-Z-]+)\uff08([^\uff09]+)\uff09\]/g;
    newContent = newContent.replace(format2Regex, (match, word, meaning) => {
      changeCount++;
      return `[${word}]\uff08${meaning}\uff09`;
    });
    
    // 格式3: [word](中文) -> [word]（中文）
    const format3Regex = /\[([a-zA-Z-]+)\]\(([^)]+)\)/g;
    newContent = newContent.replace(format3Regex, (match, word, meaning) => {
      changeCount++;
      return `[${word}]\uff08${meaning}\uff09`;
    });
    
    if (changeCount > 0) {
      console.log(`📝 ${novel.title}`);
      console.log(`   修改了 ${changeCount} 处格式`);
      
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

fixNovelFormat().catch(console.error);
