/**
 * 补充音标脚本 - 后台运行
 * 运行: cd server && npx tsx scripts/add-phonetics.ts &
 */
import { getSupabaseClient } from '../src/storage/database/supabase-client.js';

const IELTS_BOOK_ID = '8b86bc59-13e5-4c56-be91-4a9d106ebf57';
const BATCH_SIZE = 100;
const CONCURRENCY = 20;

async function fetchPhonetic(word: string): Promise<string> {
  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`);
    if (!response.ok) return '';
    
    const data = await response.json();
    if (Array.isArray(data) && data[0]?.phonetics) {
      for (const phonetic of data[0].phonetics) {
        if (phonetic.text) return phonetic.text;
      }
    }
    return '';
  } catch {
    return '';
  }
}

async function main() {
  console.log('🎼 开始补充音标...\n');
  
  const client = getSupabaseClient();
  
  // 获取所有无音标的单词
  const { data: words, error } = await client
    .from('words')
    .select('id, word')
    .eq('book_id', IELTS_BOOK_ID)
    .or('phonetic.is.null,phonetic.eq.')
    .limit(10000);

  if (error || !words) {
    console.error('获取单词失败:', error);
    process.exit(1);
  }

  console.log(`📝 需要补充音标的单词: ${words.length} 个\n`);

  let updated = 0;
  
  for (let i = 0; i < words.length; i += CONCURRENCY) {
    const batch = words.slice(i, i + CONCURRENCY);
    
    const results = await Promise.all(
      batch.map(async (item) => {
        const phonetic = await fetchPhonetic(item.word);
        if (phonetic) {
          await client
            .from('words')
            .update({ phonetic })
            .eq('id', item.id);
        }
        return { word: item.word, phonetic };
      })
    );

    updated += results.filter(r => r.phonetic).length;
    process.stdout.write(`\r🎼 进度: ${Math.min(i + CONCURRENCY, words.length)}/${words.length} (成功: ${updated})`);
  }

  console.log(`\n\n✅ 音标补充完成: ${updated}/${words.length}`);
  process.exit(0);
}

main().catch(console.error);
