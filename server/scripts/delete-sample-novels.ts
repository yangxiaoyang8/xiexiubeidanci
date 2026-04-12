/**
 * 删除示例小说
 */
import { getSupabaseClient } from '../src/storage/database/supabase-client.js';

async function main() {
  const client = getSupabaseClient();

  console.log('删除示例小说...');

  // 删除示例小说
  const { error: e1 } = await client.from('novels').delete().like('title', '%《城市之光》');
  if (e1) console.error('删除城市之光失败:', e1);
  else console.log('✓ 已删除《城市之光》');

  const { error: e2 } = await client.from('novels').delete().like('title', '%《时间旅行者》');
  if (e2) console.error('删除时间旅行者失败:', e2);
  else console.log('✓ 已删除《时间旅行者》');

  const { error: e3 } = await client.from('novels').delete().like('title', '%《校园记忆》');
  if (e3) console.error('删除校园记忆失败:', e3);
  else console.log('✓ 已删除《校园记忆》');

  // 查看剩余小说数量
  const { data: novels } = await client.from('novels').select('id, title');
  console.log(`\n当前小说数量: ${novels?.length || 0}`);

  process.exit(0);
}

main();
