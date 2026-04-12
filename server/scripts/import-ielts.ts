/**
 * 雅思词库导入脚本
 * 运行: cd server && npx tsx scripts/import-ielts.ts
 */
import XLSX from 'xlsx';
import { getSupabaseClient } from '../src/storage/database/supabase-client.js';

const IELTS_BOOK_ID = '8b86bc59-13e5-4c56-be91-4a9d106ebf57';
const EXCEL_PATH = '/tmp/ielts_vocab.xls';
const BATCH_SIZE = 500;
const PHONETIC_CACHE: Record<string, string> = {};

interface WordItem {
  word: string;
  phonetic: string;
  partOfSpeech: string;
  meaning: string;
}

/**
 * 从Free Dictionary API获取单词音标
 */
async function fetchPhonetic(word: string): Promise<string> {
  if (PHONETIC_CACHE[word]) {
    return PHONETIC_CACHE[word];
  }

  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`);
    if (!response.ok) {
      return '';
    }

    const data = await response.json();
    if (Array.isArray(data) && data[0]?.phonetics) {
      for (const phonetic of data[0].phonetics) {
        if (phonetic.text) {
          const result = phonetic.text;
          PHONETIC_CACHE[word] = result;
          return result;
        }
      }
    }
    return '';
  } catch (error) {
    return '';
  }
}

/**
 * 解析词性和中文释义
 */
function parseMeaning(text: string): { partOfSpeech: string; meaning: string } {
  const match = text.match(/^([a-z]+\.)\s*/i);
  if (match) {
    return {
      partOfSpeech: match[1],
      meaning: text.substring(match[0].length).trim()
    };
  }
  return {
    partOfSpeech: '',
    meaning: text.trim()
  };
}

/**
 * 批量获取音标
 */
async function batchFetchPhonetics(words: string[]): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  const concurrency = 10;
  
  for (let i = 0; i < words.length; i += concurrency) {
    const batch = words.slice(i, i + concurrency);
    const phonetics = await Promise.all(
      batch.map(async (word) => {
        const phonetic = await fetchPhonetic(word);
        await new Promise(resolve => setTimeout(resolve, 100));
        return { word, phonetic };
      })
    );
    
    phonetics.forEach(({ word, phonetic }) => {
      results.set(word, phonetic);
    });
    
    process.stdout.write(`\r📡 获取音标进度: ${Math.min(i + concurrency, words.length)}/${words.length}`);
  }
  
  console.log('\n');
  return results;
}

/**
 * 主函数
 */
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

  // 3. 获取音标
  console.log('📡 开始获取音标（这可能需要几分钟）...');
  const uniqueWords = [...new Set(wordList.map(w => w.word))];
  const phoneticMap = await batchFetchPhonetics(uniqueWords);
  
  // 更新音标
  wordList.forEach(item => {
    item.phonetic = phoneticMap.get(item.word) || '';
  });
  
  const wordsWithPhonetic = wordList.filter(w => w.phonetic);
  console.log(`✅ 获取到 ${phoneticMap.size}/${uniqueWords.length} 个单词的音标\n`);

  // 4. 获取数据库连接
  console.log('🔌 连接数据库...');
  const client = getSupabaseClient();
  console.log('✅ 数据库连接成功\n');

  // 5. 清空现有数据
  console.log('🗑️ 清空现有雅思词库数据...');
  const { error: deleteError } = await client
    .from('words')
    .delete()
    .eq('book_id', IELTS_BOOK_ID);
  
  if (deleteError) {
    console.error('清空数据失败:', deleteError);
  } else {
    console.log('✅ 已清空旧数据\n');
  }

  // 6. 批量导入
  console.log('💾 开始导入数据库...');
  let imported = 0;
  
  for (let i = 0; i < wordList.length; i += BATCH_SIZE) {
    const batch = wordList.slice(i, i + BATCH_SIZE);
    
    const insertData = batch.map(item => ({
      id: crypto.randomUUID(),
      book_id: IELTS_BOOK_ID,
      word: item.word,
      phonetic: item.phonetic,
      part_of_speech: item.partOfSpeech,
      meaning: item.meaning,
    }));

    const { error } = await client.from('words').insert(insertData);
    
    if (error) {
      console.error(`\n❌ 批次 ${Math.floor(i/BATCH_SIZE)} 导入失败:`, error);
    } else {
      imported += batch.length;
      process.stdout.write(`\r💾 导入进度: ${imported}/${wordList.length}`);
    }
  }

  console.log(`\n\n✅ 成功导入 ${imported} 个单词\n`);

  // 7. 更新词库统计
  const { error: updateError } = await client
    .from('vocab_books')
    .update({ 
      total_words: imported, 
      updated_at: new Date().toISOString() 
    })
    .eq('id', IELTS_BOOK_ID);

  if (updateError) {
    console.error('更新词库统计失败:', updateError);
  }

  console.log(`📊 雅思词库总词汇量: ${imported}`);
  console.log('\n🎉 导入完成！');
  
  process.exit(0);
}

main().catch(err => {
  console.error('❌ 导入失败:', err);
  process.exit(1);
});
