/**
 * 续写修复不完整的小说
 * 
 * 使用方法：
 * cd server && npx tsx scripts/fix-incomplete-novels.ts
 */

import { getSupabaseClient } from '../src/storage/database/supabase-client.js';
import { LLMClient, Config } from 'coze-coding-dev-sdk';
import { fileURLToPath } from 'url';
import * as path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============ 配置区域 ============

// 词库ID
const BOOK_IDS = {
  cet4: '487b402f-0a7e-4b6d-a593-ba4d9e2c8bf5',
  ielts: '8b86bc59-13e5-4c56-be91-4a9d106ebf57',
};

// ============ 代码区域 ============

/**
 * 检查小说是否完整
 */
function isNovelComplete(content: string): boolean {
  // 完整的标志：有"全文完"或以句号/感叹号/问号结尾
  if (content.includes('全文完')) return true;
  
  const lastChar = content.trim().slice(-1);
  if (['。', '！', '？', '"', '”'].includes(lastChar)) {
    // 还要检查最后一段是否像完整结局
    const lastParagraph = content.split('\n').filter(l => l.trim()).slice(-1)[0] || '';
    // 如果最后一段包含"就是"、"说"等截断标志，仍然不完整
    if (lastParagraph.includes('就是') && !lastParagraph.includes('全文完')) return false;
    if (lastParagraph.endsWith('说：')) return false;
    if (lastParagraph.endsWith('说,"')) return false;
    return true;
  }
  
  return false;
}

/**
 * 获取小说的最后部分作为续写提示
 */
function getLastPart(content: string, maxLength: number = 500): string {
  const paragraphs = content.split('\n').filter(l => l.trim());
  let result = '';
  for (let i = paragraphs.length - 1; i >= 0 && result.length < maxLength; i--) {
    result = paragraphs[i] + '\n' + result;
  }
  return result.trim();
}

/**
 * 续写小说
 */
async function continueNovel(
  novel: { id: string; title: string; content: string; book_id: string },
  llmClient: LLMClient
): Promise<{ success: boolean; newContent?: string; error?: string }> {
  try {
    const lastPart = getLastPart(novel.content, 600);
    
    const prompt = `你是一位专业的小说作家。请续写以下小说的结尾部分。

【小说标题】${novel.title}

【小说最后部分】
${lastPart}

【续写要求】
1. 承接上面的情节，自然过渡到结局
2. 用200-500字完成故事
3. 给故事一个完整的结局，让读者满意
4. 结尾用"全文完"标记

【词汇格式】
- 继续使用 [word] 格式嵌入英语词汇
- 如果有未嵌入的词汇，可以在这部分自然融入

请直接输出续写内容（不要重复上面的内容）：`;

    const messages = [{ role: 'user' as const, content: prompt }];
    let newContent = '';
    
    const stream = llmClient.stream(messages, {
      temperature: 0.7,
      model: 'doubao-seed-1-8-251228'
    });

    for await (const chunk of stream) {
      if (chunk.content) {
        newContent += chunk.content.toString();
      }
    }

    return { success: true, newContent };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '未知错误' };
  }
}

async function main() {
  console.log('📚 检查并修复不完整的小说\n');
  console.log('========================================\n');

  const client = getSupabaseClient();
  const config = new Config();
  const llmClient = new LLMClient(config);

  // 获取所有小说
  const { data: novels, error } = await client
    .from('novels')
    .select('id, title, content, book_id, word_count')
    .in('book_id', [BOOK_IDS.cet4, BOOK_IDS.ielts])
    .order('created_at', { ascending: true });

  if (error) {
    console.error('查询小说失败:', error);
    return;
  }

  console.log(`共检查 ${novels?.length || 0} 篇小说\n`);

  let fixedCount = 0;
  let failedCount = 0;

  for (const novel of novels || []) {
    const isComplete = isNovelComplete(novel.content);
    
    if (isComplete) {
      console.log(`✅ ${novel.title} - 已完整`);
      continue;
    }

    console.log(`\n❌ ${novel.title} - 不完整，正在修复...`);
    console.log(`   字数: ${novel.word_count}`);
    
    const result = await continueNovel(novel, llmClient);
    
    if (result.success && result.newContent) {
      // 合并原文和续写内容
      const fullContent = novel.content.trim() + '\n\n' + result.newContent.trim();
      const newWordCount = fullContent.length;
      
      // 更新数据库
      const { error: updateError } = await client
        .from('novels')
        .update({ 
          content: fullContent,
          word_count: newWordCount,
          summary: novel.summary?.replace(/\|.*/, ` | ${newWordCount}字`)
        })
        .eq('id', novel.id);
      
      if (updateError) {
        console.log(`   ❌ 更新失败: ${updateError.message}`);
        failedCount++;
      } else {
        console.log(`   ✅ 已修复，新增 ${result.newContent.length} 字`);
        fixedCount++;
      }
    } else {
      console.log(`   ❌ 续写失败: ${result.error}`);
      failedCount++;
    }

    // 避免API限流
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n========================================');
  console.log(`✅ 修复完成: ${fixedCount} 篇`);
  console.log(`❌ 失败: ${failedCount} 篇`);
  console.log('========================================\n');

  // 最终统计
  const { count: cet4Count } = await client
    .from('novels')
    .select('*', { count: 'exact', head: true })
    .eq('book_id', BOOK_IDS.cet4);
  
  const { count: ieltsCount } = await client
    .from('novels')
    .select('*', { count: 'exact', head: true })
    .eq('book_id', BOOK_IDS.ielts);

  console.log('📊 最终统计:');
  console.log(`   四级词库: ${cet4Count} 篇小说`);
  console.log(`   雅思词库: ${ieltsCount} 篇小说`);
}

main().catch(console.error);
