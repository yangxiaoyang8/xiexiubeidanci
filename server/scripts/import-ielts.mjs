/**
 * 雅思词库导入脚本
 * 使用 pg 直接连接数据库，避免模块解析问题
 */
import XLSX from 'xlsx';
import pg from 'pg';
const { Pool } = pg;

// 数据库连接配置
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_DB_URL,
});

const IELTS_BOOK_ID = '8b86bc59-13e5-4c56-be91-4a9d106ebf57';
const EXCEL_PATH = '/tmp/ielts_vocab.xls';
const BATCH_SIZE = 100;
const PHONETIC_CACHE = {};

/**
 * 从Free Dictionary API获取单词音标
 */
async function fetchPhonetic(word) {
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
function parseMeaning(text) {
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
async function batchFetchPhonetics(words) {
  const results = new Map();
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
  const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  console.log(`✅ 共读取 ${rawData.length} 行数据\n`);

  // 2. 解析数据
  console.log('📝 解析单词数据...');
  const wordList = rawData.map(row => {
    const word = (row[0] || '').toString().trim();
    const text = (row[1] || '').toString().trim();
    const { partOfSpeech, meaning } = parseMeaning(text);
    return { word, partOfSpeech, meaning };
  }).filter(item => item.word && item.meaning);

  console.log(`✅ 有效单词 ${wordList.length} 个\n`);

  // 3. 获取音标
  console.log('📡 开始获取音标（这可能需要几分钟）...');
  const uniqueWords = [...new Set(wordList.map(w => w.word))];
  const phoneticMap = await batchFetchPhonetics(uniqueWords);
  
  const wordsWithPhonetic = wordList.filter(w => phoneticMap.get(w.word));
  console.log(`✅ 获取到 ${phoneticMap.size}/${uniqueWords.length} 个单词的音标\n`);

  // 4. 清空现有数据
  console.log('🗑️ 清空现有雅思词库数据...');
  const deleteResult = await pool.query('DELETE FROM words WHERE vocab_book_id = $1', [IELTS_BOOK_ID]);
  console.log(`✅ 已删除 ${deleteResult.rowCount} 条旧数据\n`);

  // 5. 批量导入
  console.log('💾 开始导入数据库...');
  let imported = 0;
  
  const client = await pool.connect();
  try {
    for (let i = 0; i < wordsWithPhonetic.length; i += BATCH_SIZE) {
      const batch = wordsWithPhonetic.slice(i, i + BATCH_SIZE);
      
      const values = [];
      const placeholders = [];
      let paramIndex = 1;
      
      batch.forEach(item => {
        const id = crypto.randomUUID();
        values.push(
          id,
          IELTS_BOOK_ID,
          item.word,
          phoneticMap.get(item.word) || '',
          item.partOfSpeech,
          item.meaning
        );
        placeholders.push(`($${paramIndex}, $${paramIndex+1}, $${paramIndex+2}, $${paramIndex+3}, $${paramIndex+4}, $${paramIndex+5})`);
        paramIndex += 6;
      });

      const query = `
        INSERT INTO words (id, vocab_book_id, word, phonetic, part_of_speech, meaning)
        VALUES ${placeholders.join(', ')}
      `;
      
      await client.query(query, values);
      imported += batch.length;
      process.stdout.write(`\r💾 导入进度: ${imported}/${wordsWithPhonetic.length}`);
    }
  } finally {
    client.release();
  }

  console.log(`\n\n✅ 成功导入 ${imported} 个单词\n`);

  // 6. 更新词库统计
  await pool.query(
    'UPDATE vocab_books SET total_words = $1, updated_at = NOW() WHERE id = $2',
    [imported, IELTS_BOOK_ID]
  );

  console.log(`📊 雅思词库总词汇量: ${imported}`);
  console.log('\n🎉 导入完成！');
  
  await pool.end();
  process.exit(0);
}

main().catch(err => {
  console.error('❌ 导入失败:', err);
  process.exit(1);
});
