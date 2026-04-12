/**
 * 批量生成小说脚本
 * 
 * 使用方法：
 * cd server && npx tsx scripts/generate-novels-batch.ts
 */

import { getSupabaseClient } from '../src/storage/database/supabase-client.js';
import { LLMClient, Config } from 'coze-coding-dev-sdk';
import { fileURLToPath } from 'url';
import * as path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============ 配置区域 ============

// 词库配置：词库ID -> 目标小说数量
const BOOK_CONFIG: Record<string, { name: string; targetCount: number }> = {
  '487b402f-0a7e-4b6d-a593-ba4d9e2c8bf5': { name: '四级', targetCount: 20 },
  '8b86bc59-13e5-4c56-be91-4a9d106ebf57': { name: '雅思', targetCount: 20 },
};

// 每批次生成间隔（毫秒），避免API限流
const BATCH_DELAY = 3000;

// ============ 小说类型模板 ============

const NOVEL_GENRES = [
  { name: '都市言情', desc: '现代都市背景的爱情故事' },
  { name: '悬疑推理', desc: '充满悬念和谜团的推理故事' },
  { name: '科幻未来', desc: '未来科技和太空探索的故事' },
  { name: '历史穿越', desc: '穿越到古代的奇幻冒险' },
  { name: '奇幻魔法', desc: '魔法世界的奇幻冒险' },
  { name: '校园青春', desc: '校园生活中的青春故事' },
  { name: '职场商战', desc: '职场竞争和商业博弈' },
  { name: '武侠江湖', desc: '江湖恩怨和武林传奇' },
];

// 常见中文姓氏
const CHINESE_SURNAMES = [
  '李', '王', '张', '刘', '陈', '杨', '黄', '赵', '周', '吴',
  '徐', '孙', '马', '朱', '胡', '郭', '何', '林', '罗', '高',
];

// 常见中文名字
const CHINESE_GIVEN_NAMES = [
  '明', '华', '军', '伟', '强', '磊', '洋', '勇', '杰', '涛',
  '超', '敏', '静', '丽', '芳', '燕', '娟', '英', '玲', '霞',
  '晨', '宇', '浩', '然', '轩', '博', '文', '翔', '鹏', '飞',
  '子涵', '梓萱', '欣怡', '可馨', '诗涵', '梓晨', '雨萱', '梦琪', '思源', '嘉怡',
  '雅婷', '志强', '建华', '文博', '晓东', '海燕', '小龙', '美玲', '俊杰', '晓峰',
];

function generateRandomChineseName(): string {
  const surname = CHINESE_SURNAMES[Math.floor(Math.random() * CHINESE_SURNAMES.length)];
  const givenName = CHINESE_GIVEN_NAMES[Math.floor(Math.random() * CHINESE_GIVEN_NAMES.length)];
  return surname + givenName;
}

function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

async function generateNovel(bookId: string, client: any, llmClient: LLMClient): Promise<{ success: boolean; title?: string; error?: string }> {
  try {
    // 获取词库词汇
    const { data: words, error: wordsError } = await client
      .from('words')
      .select('id, word, meaning, phonetic')
      .eq('book_id', bookId);

    if (wordsError) throw new Error(`查询词汇失败: ${wordsError.message}`);
    
    if (!words || words.length === 0) {
      return { success: false, error: '该词库暂无词汇' };
    }

    // 减少词汇数量到150-200个，确保AI能完整嵌入且不被截断
    const targetWordCount = Math.min(Math.max(150, Math.floor(Math.random() * 50) + 150), words.length);
    const selectedWords = shuffleArray(words).slice(0, targetWordCount);

    // 选择小说类型
    const selectedGenre = NOVEL_GENRES[Math.floor(Math.random() * NOVEL_GENRES.length)];
    
    // 构建词汇列表（分组显示，每行10个，方便AI处理）
    const wordGroups: string[] = [];
    for (let i = 0; i < selectedWords.length; i += 10) {
      const group = selectedWords.slice(i, i + 10)
        .map((w: any) => `${w.word}（${w.meaning.split(/[；;，,]/)[0]}）`)
        .join(', ');
      wordGroups.push(group);
    }
    const wordListStr = wordGroups.join('\n');

    // 主角设定
    const protagonistName = generateRandomChineseName();

    // 构建prompt - 降低字数要求，强调完整性
    const prompt = `你是一位专业的小说作家。请创作一部${selectedGenre.name}类型的中文短篇小说。

【基本信息】
- 主角姓名：${protagonistName}
- 故事设定：${selectedGenre.desc}
- 小说类型：${selectedGenre.name}

【词汇要求】
小说需要自然融入以下${selectedWords.length}个英语词汇（每个词汇至少出现一次）：
${wordListStr}

词汇嵌入格式：用英文方括号标记，如 [word]
例如：她有着[beautiful]眼睛和[warm]微笑

【篇幅要求】
- 总字数：4000-6000字（严格控制，不要超过！）
- 章节数：3-4章
- 每章开头用「第X章 章节名」格式

【重要：完整性要求】
1. 必须写完整的故事，有清晰的结局
2. 最后一段必须收束故事，不能戛然而止
3. 结尾用"全文完"标记

【质量要求】
1. 情节紧凑，有完整起承转合
2. 人物性格鲜明
3. 在有限篇幅内讲好一个完整故事

【输出格式】
第一行：小说标题（中文，不超过12字）
然后：小说正文
最后：另起一行写"全文完"

现在开始创作：`;

    console.log(`   📖 类型: ${selectedGenre.name}, 主角: ${protagonistName}, 词汇数: ${selectedWords.length}`);

    const messages = [{ role: 'user' as const, content: prompt }];
    let fullContent = '';
    
    const stream = llmClient.stream(messages, {
      temperature: 0.85,
      model: 'doubao-seed-1-8-251228'
    });

    for await (const chunk of stream) {
      if (chunk.content) {
        fullContent += chunk.content.toString();
      }
    }

    // 提取标题
    const lines = fullContent.split('\n').filter((l: string) => l.trim());
    let novelTitle = lines[0] || `${selectedGenre.name}小说`;
    
    if (novelTitle.includes('第') && novelTitle.includes('章')) {
      novelTitle = `${protagonistName}的${selectedGenre.name}之旅`;
    }

    // 计算章节和字数
    const chapterCount = (fullContent.match(/第[一二三四五六七八九十\d]+章/g) || []).length || 1;
    const wordCount = fullContent.length;

    // 保存小说
    const { data: novel, error: novelError } = await client
      .from('novels')
      .insert({
        book_id: bookId,
        title: novelTitle.replace(/[#*]/g, '').trim(),
        content: fullContent,
        summary: `${selectedGenre.name} | ${protagonistName} | ${wordCount}字 | ${selectedWords.length}个词汇`,
        chapter_count: chapterCount,
        word_count: wordCount
      })
      .select()
      .single();

    if (novelError) throw new Error(`保存小说失败: ${novelError.message}`);

    // 关联词汇
    if (novel && selectedWords.length > 0) {
      const novelWordsData = selectedWords.map((w: any, index: number) => ({
        novel_id: novel.id,
        word_id: w.id,
        position: index
      }));

      for (let i = 0; i < novelWordsData.length; i += 500) {
        await client.from('novel_words').insert(novelWordsData.slice(i, i + 500));
      }
    }

    return { success: true, title: novelTitle };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '未知错误' };
  }
}

async function main() {
  console.log('📚 批量生成小说脚本\n');
  console.log('========================================');

  const client = getSupabaseClient();
  const config = new Config();
  const llmClient = new LLMClient(config);

  // 统计各词库现有小说数量
  for (const [bookId, config] of Object.entries(BOOK_CONFIG)) {
    const { data: novels } = await client
      .from('novels')
      .select('id, title')
      .eq('book_id', bookId);
    
    const currentCount = novels?.length || 0;
    const needCount = config.targetCount - currentCount;
    
    console.log(`\n📊 ${config.name}词库 (${bookId.slice(0, 8)}...)`);
    console.log(`   当前小说: ${currentCount} 篇`);
    console.log(`   目标数量: ${config.targetCount} 篇`);
    console.log(`   需要生成: ${needCount} 篇`);
    
    if (needCount <= 0) {
      console.log(`   ✅ 已达目标，跳过`);
      continue;
    }

    console.log(`\n🚀 开始生成...`);
    
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < needCount; i++) {
      console.log(`\n[${i + 1}/${needCount}] 生成中...`);
      
      const result = await generateNovel(bookId, client, llmClient);
      
      if (result.success) {
        successCount++;
        console.log(`   ✅ 成功: ${result.title}`);
      } else {
        failCount++;
        console.log(`   ❌ 失败: ${result.error}`);
      }
      
      // 延迟避免API限流
      if (i < needCount - 1) {
        console.log(`   ⏳ 等待 ${BATCH_DELAY / 1000} 秒...`);
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      }
    }
    
    console.log(`\n📈 ${config.name}词库生成完成:`);
    console.log(`   成功: ${successCount} 篇`);
    console.log(`   失败: ${failCount} 篇`);
  }

  console.log('\n========================================');
  console.log('✅ 批量生成完成！');
  
  // 最终统计
  console.log('\n📊 最终统计:');
  for (const [bookId, config] of Object.entries(BOOK_CONFIG)) {
    const { count } = await client
      .from('novels')
      .select('*', { count: 'exact', head: true })
      .eq('book_id', bookId);
    
    console.log(`   ${config.name}词库: ${count} 篇小说`);
  }
}

main().catch(console.error);
