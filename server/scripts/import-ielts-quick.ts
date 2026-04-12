/**
 * 雅思词库导入脚本 - 快速版（先导入单词，后补充音标）
 */
import XLSX from 'xlsx';
import { getSupabaseClient } from '../src/storage/database/supabase-client.js';

const IELTS_BOOK_ID = '8b86bc59-13e5-4c56-be91-4a9d106ebf57';
const EXCEL_PATH = '/tmp/ielts_vocab.xls';
const BATCH_SIZE = 500;

interface WordItem {
  word: string;
  phonetic: string;
  partOfSpeech: string;
  meaning: string;
}

function parseMeaning(text: string): { partOfSpeech: string; meaning: string } {
  const match = text.match(/^([a-z]+\.)\s*/i);
  if (match) {
    return {
      partOfSpeech: match[1],
      meaning: text.substring(match[0].length).trim()
    };
  }
  return { partOfSpeech: '', meaning: text.trim() };
}

async function main() {
  console.log('🚀 开始导入雅思词库...\n');

  // 1. 读取Excel
  console.log('📖 读取Excel文件...');
  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawData: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  console.log(`✅ 共读取 ${rawData.length} 行数据\n`);

  // 2. 解析数据
  console.log('📝 解析单词数据...');
  const wordList: WordItem[] = rawData.map(row => {
    const word = (row[0] || '').toString().trim();
    const text = (row[1] || '').toString().trim();
    const { partOfSpeech, meaning } = parseMeaning(text);
    return { word, phonetic: '', partOfSpeech, meaning };
  }).filter(item => item.word && item.meaning);
  console.log(`✅ 有效单词 ${wordList.length} 个\n`);

  // 3. 连接数据库
  console.log('🔌 连接数据库...');
  const client = getSupabaseClient();
  console.log('✅ 数据库连接成功\n');

  // 4. 清空现有数据
  console.log('🗑️ 清空现有雅思词库数据...');
  await client.from('words').delete().eq('book_id', IELTS_BOOK_ID);
  console.log('✅ 已清空旧数据\n');

  // 5. 批量导入（暂无音标，后续补充）
  console.log('💾 开始导入数据库...');
  let imported = 0;
  
  for (let i = 0; i < wordList.length; i += BATCH_SIZE) {
    const batch = wordList.slice(i, i + BATCH_SIZE);
    
    const insertData = batch.map(item => ({
      id: crypto.randomUUID(),
      book_id: IELTS_BOOK_ID,
      word: item.word,
      phonetic: '', // 先留空，后续补充
      meaning: item.partOfSpeech ? `${item.partOfSpeech} ${item.meaning}` : item.meaning,
    }));

    const { error } = await client.from('words').insert(insertData);
    
    if (error) {
      console.error(`\n❌ 批次导入失败:`, error.message);
    } else {
      imported += batch.length;
      process.stdout.write(`\r💾 导入进度: ${imported}/${wordList.length}`);
    }
  }

  console.log(`\n\n✅ 成功导入 ${imported} 个单词\n`);

  // 6. 更新词库统计
  await client
    .from('vocab_books')
    .update({ total_words: imported, updated_at: new Date().toISOString() })
    .eq('id', IELTS_BOOK_ID);

  console.log(`📊 雅思词库总词汇量: ${imported}`);
  console.log('⚠️ 音标暂未导入，请运行补充脚本');
  console.log('\n🎉 导入完成！');
  
  process.exit(0);
}

main().catch(err => {
  console.error('❌ 导入失败:', err);
  process.exit(1);
});
