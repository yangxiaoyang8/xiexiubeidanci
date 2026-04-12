/**
 * 清理短篇小说（小于2000字的）
 */
import { getSupabaseClient } from '../src/storage/database/supabase-client.js';

const IELTS_BOOK_ID = '8b86bc59-13e5-4c56-be91-4a9d106ebf57';

async function main() {
  const client = getSupabaseClient();

  console.log('清理短篇小说...\n');

  // 获取所有小说
  const { data: novels, error } = await client
    .from('novels')
    .select('id, title, word_count, book_id');

  if (error) {
    console.error('查询失败:', error);
    process.exit(1);
  }

  // 删除短篇（小于3000字）的
  const shortNovels = novels?.filter(n => (n.word_count || 0) < 3000) || [];
  
  console.log(`找到 ${shortNovels.length} 篇短篇小说:`);
  shortNovels.forEach(n => {
    console.log(`  - ${n.title} (${n.word_count}字)`);
  });

  if (shortNovels.length > 0) {
    // 先删除关联的novel_words
    for (const novel of shortNovels) {
      await client.from('novel_words').delete().eq('novel_id', novel.id);
    }
    
    // 再删除小说
    const ids = shortNovels.map(n => n.id);
    for (const id of ids) {
      await client.from('novels').delete().eq('id', id);
    }
    console.log(`\n已删除 ${shortNovels.length} 篇短篇小说`);
  }

  // 显示剩余小说
  const { data: remaining } = await client
    .from('novels')
    .select('id, title, word_count')
    .order('word_count', { ascending: false });

  console.log(`\n剩余小说: ${remaining?.length || 0} 篇`);
  remaining?.forEach(n => {
    console.log(`  ${n.title}: ${n.word_count}字`);
  });

  process.exit(0);
}

main();
