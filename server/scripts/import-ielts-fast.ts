/**
 * 雅思词库导入脚本 - 使用LLM批量生成音标
 * 运行: cd server && npx tsx scripts/import-ielts-llm.ts
 */
import XLSX from 'xlsx';
import { getSupabaseClient } from '../src/storage/database/supabase-client.js';

const IELTS_BOOK_ID = '8b86bc59-13e5-4c56-be91-4a9d106ebf57';
const EXCEL_PATH = '/tmp/ielts_vocab.xls';
const BATCH_SIZE = 500;
const LLM_BATCH_SIZE = 50; // 每次LLM处理50个单词

interface WordItem {
  word: string;
  phonetic: string;
  partOfSpeech: string;
  meaning: string;
}

/**
 * 使用LLM批量生成音标
 */
async function generatePhoneticsWithLLM(words: string[]): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  
  // 从环境变量获取API配置
  const apiKey = process.env.COZE_API_KEY;
  const botId = process.env.COZE_BOT_ID;
  
  if (!apiKey) {
    console.log('⚠️ 未找到COZE_API_KEY，跳过音标生成');
    return results;
  }

  const prompt = `请为以下英语单词生成国际音标。直接返回JSON格式，不要有其他内容。

示例输出格式:
{"abandon": "/əˈbændən/", "ability": "/əˈbɪləti/"}

单词列表:
${words.join(', ')}`;

  try {
    const response = await fetch('https://api.coze.cn/v3/chat', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bot_id: botId || 'default',
        user_id: 'import-script',
        stream: false,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      console.error('LLM API调用失败:', response.status);
      return results;
    }

    const data = await response.json();
    const content = data.data?.[0]?.content || data.choices?.[0]?.message?.content || '';
    
    // 解析JSON
    try {
      // 提取JSON部分
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        for (const [word, phonetic] of Object.entries(parsed)) {
          results.set(word.toLowerCase(), phonetic as string);
        }
      }
    } catch (e) {
      console.error('解析LLM响应失败:', content.substring(0, 100));
    }
  } catch (error) {
    console.error('LLM调用异常:', error);
  }

  return results;
}

/**
 * 从Free Dictionary API获取音标（备用方案）
 */
async function fetchPhoneticFromDict(word: string): Promise<string> {
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
  return { partOfSpeech: '', meaning: text.trim() };
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

  // 3. 获取音标（先尝试LLM，失败则用词典API）
  console.log('📡 开始获取音标...');
  const uniqueWords = [...new Set(wordList.map(w => w.word))];
  
  // 分批处理，每批用词典API并发获取
  const phoneticMap = new Map<string, string>();
  const concurrency = 20;
  
  for (let i = 0; i < uniqueWords.length; i += concurrency) {
    const batch = uniqueWords.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(async (word) => {
        const phonetic = await fetchPhoneticFromDict(word);
        return { word, phonetic };
      })
    );
    
    results.forEach(({ word, phonetic }) => {
      if (phonetic) phoneticMap.set(word, phonetic);
    });
    
    // 显示进度
    const progress = Math.min(i + concurrency, uniqueWords.length);
    process.stdout.write(`\r📡 获取音标进度: ${progress}/${uniqueWords.length} (${phoneticMap.size} 成功)`);
  }
  console.log('\n');

  // 更新音标到单词列表
  wordList.forEach(item => {
    item.phonetic = phoneticMap.get(item.word) || '';
  });

  const withPhonetic = wordList.filter(w => w.phonetic);
  const withoutPhonetic = wordList.filter(w => !w.phonetic);
  console.log(`✅ 音标获取完成: ${withPhonetic.length} 有音标, ${withoutPhonetic.length} 无音标\n`);

  // 4. 连接数据库
  console.log('🔌 连接数据库...');
  const client = getSupabaseClient();
  console.log('✅ 数据库连接成功\n');

  // 5. 清空现有数据
  console.log('🗑️ 清空现有雅思词库数据...');
  await client.from('words').delete().eq('book_id', IELTS_BOOK_ID);
  console.log('✅ 已清空旧数据\n');

  // 6. 批量导入（包含无音标的单词）
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
      console.error(`\n❌ 批次导入失败:`, error.message);
    } else {
      imported += batch.length;
      process.stdout.write(`\r💾 导入进度: ${imported}/${wordList.length}`);
    }
  }

  console.log(`\n\n✅ 成功导入 ${imported} 个单词\n`);

  // 7. 更新词库统计
  await client
    .from('vocab_books')
    .update({ total_words: imported, updated_at: new Date().toISOString() })
    .eq('id', IELTS_BOOK_ID);

  console.log(`📊 雅思词库总词汇量: ${imported}`);
  console.log(`📊 其中 ${withPhonetic.length} 个单词有音标`);
  console.log('\n🎉 导入完成！');
  
  process.exit(0);
}

main().catch(err => {
  console.error('❌ 导入失败:', err);
  process.exit(1);
});
