/**
 * 从Excel导入词汇到词库
 * 
 * 使用方法：
 * 1. 将Excel文件放到 server/scripts/vocab.xlsx
 * 2. 修改下方的配置（词库ID、列名映射）
 * 3. 运行: cd server && npx tsx scripts/import-vocab-from-excel.ts
 */

import { getSupabaseClient } from '../src/storage/database/supabase-client.js';
import XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ESM 模块兼容
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============ 配置区域 ============

// 目标词库ID（从下面列表选择一个，或填入自定义ID）
// 四级: 487b402f-0a7e-4b6d-a593-ba4d9e2c8bf5
// 六级: 9f821148-69f0-4079-903c-2017c03ec02f
// 托福: 3b8e3f86-5244-4c25-89c3-949faa1207c7
// 雅思: 8b86bc59-13e5-4c56-be91-4a9d106ebf57
const TARGET_BOOK_ID = '487b402f-0a7e-4b6d-a593-ba4d9e2c8bf5'; // 默认导入到四级词库

// Excel文件路径（相对于此脚本）
const EXCEL_FILE_PATH = './vocab.xls';

// Excel列名映射（根据您的Excel修改这里的列名）
// 左边是Excel中的列名，右边是系统字段名
const COLUMN_MAPPING: Record<string, string> = {
  // 格式: 'Excel列名': '系统字段名'
  '单词': 'word',           // 单词
  'word': 'word',
  '注音': 'phonetic',       // 音标
  'phonetic': 'phonetic',
  '音标': 'phonetic',
  '释义': 'meaning',        // 释义（包含词性）
  'meaning': 'meaning',
  '中文': 'meaning',
};

// 是否在导入前清空现有词汇（谨慎使用！）
const CLEAR_EXISTING = true; // 清空四级词库现有的20个测试词汇

// ============ 代码区域 ============

interface WordRow {
  word: string;
  phonetic: string;
  meaning: string;
}

async function importVocabFromExcel() {
  console.log('📚 开始导入词汇...\n');

  // 检查文件是否存在
  const filePath = path.resolve(__dirname, EXCEL_FILE_PATH);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ 文件不存在: ${filePath}`);
    console.log('\n请将Excel文件放到以下位置:');
    console.log(`   ${filePath}`);
    console.log('\n或修改脚本中的 EXCEL_FILE_PATH 配置');
    process.exit(1);
  }

  // 读取Excel
  console.log(`📖 读取文件: ${filePath}`);
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(sheet);

  console.log(`📊 共读取 ${rawData.length} 行数据\n`);

  if (rawData.length === 0) {
    console.error('❌ Excel文件为空');
    process.exit(1);
  }

  // 显示Excel列名供参考
  const columns = Object.keys(rawData[0] as object);
  console.log('📋 检测到的Excel列名:', columns.join(', '));
  console.log('📋 配置的列名映射:', JSON.stringify(COLUMN_MAPPING, null, 2), '\n');

  // 转换数据
  const words: WordRow[] = [];
  let skipped = 0;

  for (const row of rawData) {
    const rowData = row as Record<string, any>;
    
    // 根据映射提取数据
    const word: WordRow = {
      word: '',
      phonetic: '',
      meaning: '',
    };

    for (const [excelCol, systemField] of Object.entries(COLUMN_MAPPING)) {
      if (rowData[excelCol] !== undefined) {
        word[systemField as keyof WordRow] = String(rowData[excelCol]).trim();
      }
    }

    // 检查必填字段
    if (!word.word || !word.meaning) {
      skipped++;
      continue;
    }

    words.push(word);
  }

  console.log(`✅ 有效数据: ${words.length} 条`);
  if (skipped > 0) {
    console.log(`⚠️  跳过无效数据: ${skipped} 条（缺少单词或释义）\n`);
  }

  // 显示前5条数据预览
  console.log('📝 数据预览（前5条）:');
  words.slice(0, 5).forEach((w, i) => {
    console.log(`   ${i + 1}. ${w.word} [${w.phonetic || '-'}] - ${w.meaning}`);
  });
  console.log('');

  // 连接数据库
  const client = getSupabaseClient();

  // 获取词库信息
  const { data: book, error: bookError } = await client
    .from('vocab_books')
    .select('*')
    .eq('id', TARGET_BOOK_ID)
    .single();

  if (bookError || !book) {
    console.error('❌ 词库不存在:', TARGET_BOOK_ID);
    process.exit(1);
  }

  console.log(`📚 目标词库: ${book.name}`);
  console.log(`📊 当前词汇数: ${book.total_words}\n`);

  // 是否清空现有词汇
  if (CLEAR_EXISTING) {
    console.log('🗑️  清空现有词汇...');
    const { error: deleteError } = await client
      .from('words')
      .delete()
      .eq('book_id', TARGET_BOOK_ID);
    
    if (deleteError) {
      console.error('❌ 清空失败:', deleteError);
      process.exit(1);
    }
    console.log('✅ 已清空\n');
  }

  // 批量导入
  console.log('💾 开始导入...');
  const BATCH_SIZE = 500;
  let imported = 0;
  let failed = 0;

  for (let i = 0; i < words.length; i += BATCH_SIZE) {
    const batch = words.slice(i, i + BATCH_SIZE);
    const insertData = batch.map(w => ({
      id: crypto.randomUUID(),
      book_id: TARGET_BOOK_ID,
      word: w.word,
      phonetic: w.phonetic || '',
      meaning: w.meaning,
    }));

    const { error } = await client.from('words').insert(insertData);

    if (error) {
      console.error(`❌ 批次 ${Math.floor(i / BATCH_SIZE) + 1} 导入失败:`, error.message);
      failed += batch.length;
    } else {
      imported += batch.length;
      process.stdout.write(`\r   进度: ${imported}/${words.length} (${Math.round(imported / words.length * 100)}%)`);
    }
  }

  console.log('\n');

  // 更新词库统计
  const { count: totalCount } = await client
    .from('words')
    .select('*', { count: 'exact', head: true })
    .eq('book_id', TARGET_BOOK_ID);

  await client
    .from('vocab_books')
    .update({ total_words: totalCount || 0, updated_at: new Date().toISOString() })
    .eq('id', TARGET_BOOK_ID);

  // 总结
  console.log('========== 导入完成 ==========');
  console.log(`✅ 成功导入: ${imported} 条`);
  if (failed > 0) {
    console.log(`❌ 失败: ${failed} 条`);
  }
  console.log(`📊 词库总词汇数: ${totalCount || 0}`);
  console.log('===============================\n');
}

// 执行导入
importVocabFromExcel().catch(console.error);
