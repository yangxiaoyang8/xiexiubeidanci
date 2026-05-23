import { Router } from 'express';
import multer from 'multer';
import { getSupabaseClient } from '../storage/database/supabase-client.js';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import * as iconv from 'iconv-lite';

const router = Router();

// 配置 multer 处理文件上传
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 } // 限制 200KB
});

/**
 * 获取周起始日期（周一）
 */
function getWeekStart(): string {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split('T')[0];
}

/**
 * 获取管理员配置
 */
async function getAdminSetting(key: string): Promise<string> {
  const client = getSupabaseClient();
  const { data } = await client
    .from('admin_settings')
    .select('value')
    .eq('key', key)
    .single();
  return data?.value || '';
}

/**
 * 检查是否VIP用户
 * 检查 user_id、device_id、username（通过用户表关联）
 */
async function checkIsVip(userId: string): Promise<boolean> {
  const client = getSupabaseClient();
  
  // 1. 先检查 user_id
  const { data: byUserId } = await client
    .from('vip_whitelist')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  
  if (byUserId) return true;
  
  // 2. 再检查 device_id（兼容旧的 device_id 字段）
  const { data: byDeviceId } = await client
    .from('vip_whitelist')
    .select('id')
    .eq('device_id', userId)
    .maybeSingle();
  
  if (byDeviceId) return true;
  
  // 3. 通过用户名检查（device_id 可能存储的是用户名）
  // 先根据 userId 获取用户信息
  const { data: userData } = await client
    .from('users')
    .select('username')
    .eq('id', userId)
    .maybeSingle();
  
  if (userData?.username) {
    // 检查 device_id 是否等于用户名
    const { data: byUsername } = await client
      .from('vip_whitelist')
      .select('id')
      .eq('device_id', userData.username)
      .maybeSingle();
    
    if (byUsername) return true;
  }
  
  return false;
}

/**
 * 检查并更新上传次数
 */
async function checkAndUpdateUploadLimit(userId: string): Promise<{ allowed: boolean; remaining: number; error?: string }> {
  // 先检查是否VIP
  const isVip = await checkIsVip(userId);
  if (isVip) {
    return { allowed: true, remaining: 999 };
  }
  
  const client = getSupabaseClient();
  const weekStart = getWeekStart();
  
  // 获取配置的上传次数限制
  const limitStr = await getAdminSetting('weekly_upload_limit');
  const WEEKLY_UPLOAD_LIMIT = parseInt(limitStr) || 2;
  
  // 查询当前周的记录
  const { data: existing, error: queryError } = await client
    .from('upload_limits')
    .select('*')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .single();
  
  if (queryError && queryError.code !== 'PGRST116') {
    return { allowed: false, remaining: 0, error: '查询次数失败' };
  }
  
  if (existing) {
    if (existing.count >= WEEKLY_UPLOAD_LIMIT) {
      return { allowed: false, remaining: 0, error: '本周上传次数已用完，下周重置' };
    }
    // 增加次数
    const { error: updateError } = await client
      .from('upload_limits')
      .update({ count: existing.count + 1, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
    
    if (updateError) {
      console.error('更新上传次数失败:', updateError);
      return { allowed: false, remaining: 0, error: '更新次数失败' };
    }
    
    console.log(`[Upload Limit] 用户 ${userId} 上传次数 +1，当前: ${existing.count + 1}`);
    return { allowed: true, remaining: WEEKLY_UPLOAD_LIMIT - existing.count - 1 };
  } else {
    // 创建新记录
    const { error: insertError } = await client
      .from('upload_limits')
      .insert({ user_id: userId, week_start: weekStart, count: 1 });
    
    if (insertError) {
      console.error('创建上传次数记录失败:', insertError);
      return { allowed: false, remaining: 0, error: '创建次数记录失败' };
    }
    
    console.log(`[Upload Limit] 用户 ${userId} 首次上传，创建记录`);
    return { allowed: true, remaining: WEEKLY_UPLOAD_LIMIT - 1 };
  }
}

/**
 * 获取剩余上传次数
 */
async function getRemainingUploads(userId: string): Promise<{ remaining: number; limit: number; isVip: boolean }> {
  const isVip = await checkIsVip(userId);
  if (isVip) {
    return { remaining: 999, limit: 999, isVip: true };
  }
  
  const client = getSupabaseClient();
  const weekStart = getWeekStart();
  
  // 获取配置的上传次数限制
  const limitStr = await getAdminSetting('weekly_upload_limit');
  const WEEKLY_UPLOAD_LIMIT = parseInt(limitStr) || 2;
  
  const { data: existing } = await client
    .from('upload_limits')
    .select('count')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .single();
  
  if (!existing) return { remaining: WEEKLY_UPLOAD_LIMIT, limit: WEEKLY_UPLOAD_LIMIT, isVip: false };
  return { 
    remaining: Math.max(0, WEEKLY_UPLOAD_LIMIT - existing.count), 
    limit: WEEKLY_UPLOAD_LIMIT, 
    isVip: false 
  };
}

/**
 * 检测并解码文件内容
 * 支持 UTF-8 和 GBK 编码
 */
function decodeBuffer(buffer: Buffer): string {
  // 先尝试 UTF-8
  let content = buffer.toString('utf-8');
  
  // 检测是否有乱码（大量替换字符）
  const replacementCount = (content.match(/\uFFFD/g) || []).length;
  const totalChars = content.length;
  
  // 如果乱码比例超过5%，尝试GBK解码
  if (replacementCount / totalChars > 0.05) {
    console.log('检测到可能的GBK编码，尝试转换...');
    content = iconv.decode(buffer, 'gbk');
    
    // 再次检测乱码
    const gbkReplacementCount = (content.match(/\uFFFD/g) || []).length;
    if (gbkReplacementCount < replacementCount) {
      console.log('GBK解码成功');
      return content;
    }
  }
  
  return content;
}

/**
 * 解析英汉对照文本
 * 格式：
 * ===EN===
 * 英文内容
 * ===CN===
 * 中文内容
 * 
 * 或者简单格式（自动检测段落对应）：
 * 英文段落
 * ---
 * 中文段落
 * 
 * 返回：{ english: string, chinese: string, isBilingual: boolean }
 */
function parseBilingualContent(content: string): { english: string; chinese: string; isBilingual: boolean } {
  // 预处理：移除开头和结尾的空白字符
  const trimmedContent = content.trim();
  
  // 方式1：检测 ===EN=== 和 ===CN=== 标记（允许前后有其他内容）
  // 修改正则：不要求 ===EN=== 在开头，只要找到这两个标记即可
  const enMatch = trimmedContent.match(/===EN===\r?\n([\s\S]*?)(?=\r?\n===CN===|$)/);
  const cnMatch = trimmedContent.match(/===CN===\r?\n([\s\S]*?)$/);
  
  if (enMatch && cnMatch) {
    console.log('[PARSE] 检测到 ===EN=== / ===CN=== 格式');
    return {
      english: enMatch[1].trim(),
      chinese: cnMatch[1].trim(),
      isBilingual: true
    };
  }
  
  // 方式2：检测 --- 分隔符（整篇分隔）
  const separatorIndex = trimmedContent.indexOf('\n---\n');
  if (separatorIndex > 0) {
    const parts = trimmedContent.split('\n---\n');
    if (parts.length === 2) {
      // 判断哪个是英文，哪个是中文
      const first = parts[0].trim();
      const second = parts[1].trim();
      
      const englishRatio = (first.match(/[a-zA-Z]/g) || []).length / first.length;
      const chineseRatio = (second.match(/[\u4e00-\u9fa5]/g) || []).length / second.length;
      
      if (englishRatio > 0.3 && chineseRatio > 0.3) {
        console.log('[PARSE] 检测到 --- 分隔符格式');
        return {
          english: first,
          chinese: second,
          isBilingual: true
        };
      }
    }
  }
  
  // 纯中文模式
  console.log('[PARSE] 未检测到英汉对照格式，使用纯中文模式');
  return {
    english: '',
    chinese: content,
    isBilingual: false
  };
}

/**
 * 从英文文本中提取所有单词（去重、小写）
 */
function extractEnglishWords(text: string): Set<string> {
  // 匹配所有英文单词
  const words = text.match(/[a-zA-Z]+/g) || [];
  
  // 转小写去重
  const uniqueWords = new Set<string>();
  words.forEach(word => {
    uniqueWords.add(word.toLowerCase());
  });
  
  return uniqueWords;
}

/**
 * 词形还原（简单处理常见变形）
 */
function lemmatize(word: string): string[] {
  const forms = [word];
  
  // 复数 -> 单数
  if (word.endsWith('es')) {
    forms.push(word.slice(0, -2)); // watches -> watch
    forms.push(word.slice(0, -1)); // watches -> watche (可能是)
  } else if (word.endsWith('s') && !word.endsWith('ss')) {
    forms.push(word.slice(0, -1)); // dogs -> dog
  }
  
  // 过去式 -> 原形
  if (word.endsWith('ed')) {
    forms.push(word.slice(0, -2)); // worked -> work
    forms.push(word.slice(0, -1)); // loved -> love (去d)
  }
  
  // 现在分词 -> 原形
  if (word.endsWith('ing')) {
    forms.push(word.slice(0, -3)); // working -> work
    forms.push(word.slice(0, -3) + 'e'); // making -> make
  }
  
  // 副词 -> 形容词
  if (word.endsWith('ly')) {
    forms.push(word.slice(0, -2)); // quickly -> quick
  }
  
  return forms;
}

/**
 * 英汉对照模式：严格按英文原文单词匹配
 * 核心原则：尊重用户上传的英文原文，不擅自用词库中的其他单词替换
 * 
 * 匹配规则：
 * 1. 从英文原文中提取单词
 * 2. 只有当该单词在词库中存在时，才在中文中查找对应位置
 * 3. 英文原文中有但词库没有的单词，保留原样不处理
 * 4. 绝不用词库中的其他单词"猜测"替换
 */
function matchBilingualContent(
  englishText: string,
  chineseText: string,
  words: Array<{ id: string; word: string; meaning: string; phonetic: string }>
): { 
  processedContent: string; 
  usedWords: Array<{ word: string; meaning: string; phonetic: string; matchedChinese: string }>;
  totalWords: number;
  matchedCount: number;
} {
  // 构建词库映射（小写单词 -> 词汇信息）
  const wordMap = new Map<string, { word: string; meaning: string; phonetic: string }>();
  words.forEach(w => {
    wordMap.set(w.word.toLowerCase(), {
      word: w.word,
      meaning: w.meaning,
      phonetic: w.phonetic
    });
  });
  
  // ========== 核心改动：先提取英文原文中存在的词库单词 ==========
  // 只使用英文原文中实际出现的单词，绝不"猜测"
  const englishWordsPresent = new Set<string>();
  const englishTokens = englishText.match(/[a-zA-Z]+/g) || [];
  
  englishTokens.forEach(token => {
    const lowerToken = token.toLowerCase();
    // 检查原形
    if (wordMap.has(lowerToken)) {
      englishWordsPresent.add(lowerToken);
    } else {
      // 检查变形
      const forms = lemmatize(lowerToken);
      for (const form of forms) {
        if (wordMap.has(form)) {
          englishWordsPresent.add(form);
          break;
        }
      }
    }
  });
  
  console.log(`英文原文中出现的词库单词: ${englishWordsPresent.size} 个`);
  console.log(`单词列表: ${Array.from(englishWordsPresent).slice(0, 20).join(', ')}${englishWordsPresent.size > 20 ? '...' : ''}`);
  
  // 构建只包含英文原文中出现单词的映射
  const allowedWordMap = new Map<string, { word: string; meaning: string; phonetic: string }>();
  englishWordsPresent.forEach(word => {
    const info = wordMap.get(word);
    if (info) {
      allowedWordMap.set(word, info);
    }
  });
  
  // 严格验证：打印 allowedWordMap 中的单词
  console.log(`允许匹配的单词（allowedWordMap）: ${Array.from(allowedWordMap.keys()).slice(0, 30).join(', ')}`);
  
  // ========== 过滤通用词 ==========
  // 过滤掉过于通用的单词，这些词在句子中太常见，替换会破坏句子结构
  const commonWordsToSkip = new Set([
    // 冠词、介词、代词等高频词
    'the', 'a', 'an', 'of', 'to', 'in', 'on', 'at', 'for', 'with', 'by', 'from',
    'and', 'or', 'but', 'so', 'yet', 'nor',
    'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'must',
    'this', 'that', 'these', 'those', 'it', 'its',
    'he', 'him', 'his', 'she', 'her', 'they', 'them', 'their',
    'i', 'me', 'my', 'we', 'us', 'our', 'you', 'your',
    'who', 'whom', 'whose', 'which', 'what', 'where', 'when', 'why', 'how',
    'not', 'no', 'yes', 'all', 'each', 'every', 'any', 'some', 'such',
    'as', 'if', 'than', 'then', 'there', 'here', 'out', 'up', 'down',
  ]);
  
  // 过滤 allowedWordMap，移除通用词
  const filteredWordMap = new Map<string, { word: string; meaning: string; phonetic: string }>();
  allowedWordMap.forEach((value, key) => {
    if (!commonWordsToSkip.has(key)) {
      filteredWordMap.set(key, value);
    }
  });
  console.log(`过滤通用词后剩余: ${filteredWordMap.size} 个单词`);
  
  // 如果过滤后没有单词，直接返回原始中文
  if (filteredWordMap.size === 0) {
    console.log('警告：英文原文中没有有意义的词库单词，不进行任何替换');
    return {
      processedContent: chineseText,
      usedWords: [],
      totalWords: words.length,
      matchedCount: 0
    };
  }
  
  // ========== 改用全文搜索模式，不依赖句子对齐 ==========
  // 记录所有匹配结果
  const allMatches: Array<{
    vocabWord: string;
    meaning: string;
    phonetic: string;
    chineseKeyword: string;
    position: number;  // 在中文全文中的位置
  }> = [];
  
  const usedVocabWords = new Set<string>();
  
  // 遍历每个词库单词，在中文全文中搜索
  filteredWordMap.forEach((vocabInfo, word) => {
    // 提取中文关键词
    const keywords = extractChineseKeywords(vocabInfo.meaning);
    if (keywords.length === 0) return;
    
    // 在中文全文中搜索每个关键词
    for (const keyword of keywords) {
      const pos = chineseText.indexOf(keyword);
      if (pos === -1) continue;
      
      // 边界检查：只对单字关键词严格检查
      // 多字关键词（2字及以上）只要完整匹配就允许替换
      if (keyword.length < 2) {
        const afterPos = pos + keyword.length;
        const afterChar = chineseText[afterPos] || '';
        
        // 单字关键词：需要后面是标点或句末
        const isPunctuationOrEnd = /^[\s，。！？、；：""''（）【】《》…—]$|^$/.test(afterChar);
        if (!isPunctuationOrEnd) {
          continue; // 跳过，不拆开词组
        }
      }
      
      allMatches.push({
        vocabWord: vocabInfo.word,
        meaning: vocabInfo.meaning,
        phonetic: vocabInfo.phonetic,
        chineseKeyword: keyword,
        position: pos
      });
      usedVocabWords.add(vocabInfo.word.toLowerCase());
      break; // 每个单词只取第一个匹配
    }
  });
  
  console.log(`全文搜索匹配到 ${allMatches.length} 个单词`);
  
  // 构建处理后的中文内容 - 使用标记替换法
  // 用特殊标记记录每个位置要替换的内容，最后一次性处理
  const replacements: Array<{ start: number; end: number; replacement: string; word: string }> = [];
  const usedWordsSet = new Set<string>();
  
  for (const match of allMatches) {
    // 去重：每个单词只替换一次
    if (usedWordsSet.has(match.vocabWord.toLowerCase())) continue;
    
    // 检查是否与已有替换重叠
    const hasOverlap = replacements.some(r => 
      (match.position >= r.start && match.position < r.end) ||
      (match.position + match.chineseKeyword.length > r.start && match.position + match.chineseKeyword.length <= r.end)
    );
    if (hasOverlap) continue;
    
    // 检查关键词前后是否有中文字符（保护词组）
    const charBefore = chineseText[match.position - 1] || '';
    const charAfter = chineseText[match.position + match.chineseKeyword.length] || '';
    
    // 对于多字关键词（2字及以上）：只检查后面是否紧贴另一个中文字符
    // 如果后面紧贴中文字符，可能是词组的一部分，需要用户确认
    // 但对于常用翻译（如"退休的"中的"退休"），应该允许替换
    // 所以我们放宽条件：只跳过前后都是中文字符且关键词是单字的情况
    
    if (match.chineseKeyword.length < 2) {
      // 单字关键词：需要严格检查
      const isChineseBefore = /[\u4e00-\u9fa5]/.test(charBefore);
      const isChineseAfter = /[\u4e00-\u9fa5]/.test(charAfter);
      
      if (isChineseBefore || isChineseAfter) {
        continue; // 单字前后有中文，可能是词组的一部分
      }
    }
    // 多字关键词：不做前后检查，直接允许替换
    // 原因：像"从不相信"中的"从不"、"退休的"中的"退休"都是有效的翻译
    
    // 提取干净释义：只取第一个中文词组
    let cleanMeaning = match.meaning
      .replace(/^[a-z]+\.(\s*\/\s*[a-z]+\.)?\s*/i, '')  // 移除开头的词性标记（如 "n. "、"v. "）
      .replace(/\([^)]*\)/g, '')  // 移除所有括号及其内容（如 "(of, about)"）
      .replace(/（[^）]*）/g, '')  // 移除中文括号及其内容
      .split(/[；;]/)[0]  // 只取第一个分号前的内容
      .split(/[，,]/)[0]  // 只取第一个逗号前的内容（主要释义）
      .replace(/[a-zA-Z]/g, '')  // 移除剩余的英文字母
      .replace(/[.\/]/g, '')  // 移除点和斜杠
      .trim();
    
    // 如果有多个相同的词（如"四十 四十"），只取第一个
    const parts = cleanMeaning.split(/\s+/);
    if (parts.length > 1 && parts[0] === parts[1]) {
      cleanMeaning = parts[0];
    }
    
    // 如果释义为空或无效，跳过
    if (!cleanMeaning || cleanMeaning.length < 1) {
      continue;
    }
    
    // 限制长度
    if (cleanMeaning.length > 10) {
      cleanMeaning = cleanMeaning.slice(0, 10);
    }
    
    replacements.push({
      start: match.position,
      end: match.position + match.chineseKeyword.length,
      replacement: `[${match.vocabWord}]（${cleanMeaning}）`,
      word: match.vocabWord
    });
    usedWordsSet.add(match.vocabWord.toLowerCase());
  }
  
  // 按位置从后往前排序
  replacements.sort((a, b) => b.start - a.start);
  
  // 执行替换
  let processedContent = chineseText;
  for (const r of replacements) {
    processedContent = processedContent.slice(0, r.start) + r.replacement + processedContent.slice(r.end);
  }
  
  // 在连续的词汇标记之间添加空格（提升阅读体验）
  // 例如: "）[" -> "） ["
  processedContent = processedContent.replace(/）\[/g, '） [');
  
  // 构建 usedWords
  const usedWords: Array<{ word: string; meaning: string; phonetic: string; matchedChinese: string }> = [];
  for (const match of allMatches) {
    if (usedWordsSet.has(match.vocabWord.toLowerCase())) {
      usedWords.push({
        word: match.vocabWord,
        meaning: match.meaning,
        phonetic: match.phonetic,
        matchedChinese: match.chineseKeyword
      });
      usedWordsSet.delete(match.vocabWord.toLowerCase()); // 去重
    }
  }
  
  console.log(`成功替换 ${usedWords.length} 个词汇`);
  console.log(`英汉对照模式匹配结果: 总匹配词数=${usedWords.length}, 成功替换=${usedWords.length}`);
  
  return {
    processedContent,
    usedWords,
    totalWords: filteredWordMap.size,
    matchedCount: usedWords.length
  };
}

/**
 * 从meaning中提取中文关键词（只提取核心/主要释义，避免歧义）
 * 核心规则：只取第一个释义，因为第一个通常是最核心、最常用的含义
 * 例如: "n. 鸟，雀；女人；嘘声" -> ["鸟", "雀"]  (只取第一个分号前的内容)
 *       "vt. 相信，认为" -> ["相信", "认为"]  (第一个分号前有多个含义时都取)
 */
function extractChineseKeywords(meaning: string): string[] {
  const keywords: string[] = [];
  
  // 过滤掉过于模糊的释义关键词
  const excludeKeywords = [
    '时间', '地点', '人物', '东西', '事情', '地方', '样子', '方面',
    '有做某事', '某事', '某物', '某人', '某种', '某些',
    '生物', '物体', '物质', '事物', '存在', '状态',
    '行为', '动作', '过程', '结果', '原因', '目的',
    // 过滤掉过于通用的单字/双字词（这些在句子中几乎无处不在）
    '是', '有', '在', '来', '去', '做', '说', '看', '想', '要',
    '能', '会', '可', '到', '得', '了', '着', '过', '就', '都',
    '很', '也', '还', '又', '再', '不', '没', '只', '就', '才',
    '来', '起', '开', '出', '进', '回', '上', '下', '里', '外',
    // 也过滤掉"来到"这个特定的词（因为它太常见了）
    '来到', '出去', '进来', '回来', '上去', '下来',
    // 过滤掉过于通用的名词（这些词在句子中出现频率太高，容易导致错误匹配）
    '人', '人们', '人类', '人物', '人事',
    '男人', '女人', '成人', '老人', '好人', '坏人',
    '孩子', '小孩', '大人', '家人', '客人', '主人',
    '朋友', '敌人', '对手', '伙伴', '同伴',
    '身体', '生命', '生活', '工作', '学习',
    '东西', '事物', '事情', '事件', '问题',
    '地方', '位置', '方向', '方面', '部分',
    '时间', '时候', '时期', '时代', '年代',
    '样子', '情况', '状态', '条件', '环境',
    '方法', '方式', '手段', '办法', '途径',
    '结果', '后果', '效果', '影响', '作用',
    '原因', '理由', '根据', '基础', '依据',
    '目的', '目标', '意义', '价值', '作用',
    '过程', '进程', '步骤', '阶段', '环节',
    '行为', '行动', '活动', '运动', '操作',
    '物质', '材料', '原料', '资源', '能源',
    '生物', '动物', '植物', '微生物',
    '存在', '现实', '实际', '事实', '真相',
  ];
  
  // 移除词性标记
  let cleaned = meaning
    .replace(/^[a-z]+\.(\s*\/\s*[a-z]+\.)?\s*/i, '')
    .trim();
  
  // 【修复】取前三个分号前的内容作为关键词（覆盖更多同义词）
  // 例如 "重量；负荷，重担；重要性，分量；砝码，秤砣" -> "重量；负荷，重担；重要性，分量"
  // 这样 "重量"、"负荷"、"重担"、"重要性"、"分量" 都能匹配
  const semicolons = [];
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === '；' || cleaned[i] === ';') {
      semicolons.push(i);
      if (semicolons.length >= 3) break; // 取前三个分号
    }
  }
  if (semicolons.length >= 3) {
    cleaned = cleaned.substring(0, semicolons[2]);
  }
  
  // 分割所有含义（按逗号分割，获取同义词）
  const parts = cleaned.split(/[，,、；;]/);
  
  for (const part of parts) {
    // 移除括号及其内容
    let word = part.replace(/[（(][^)）]*[)）]/g, '').trim();
    
    // 移除"等"、"之类"等模糊词
    word = word.replace(/等.*$/, '').replace(/之类.*$/, '').trim();
    
    // 过滤掉排除列表中的词
    if (excludeKeywords.includes(word)) continue;
    
    // 只保留纯中文或中文为主的词（1-6个字，允许单字）
    if (/^[\u4e00-\u9fa5]{1,6}$/.test(word)) {
      keywords.push(word);
    } else {
      // 尝试提取中文部分
      const chineseMatch = word.match(/[\u4e00-\u9fa5]+/);
      if (chineseMatch && chineseMatch[0].length >= 1 && chineseMatch[0].length <= 6) {
        // 再次检查是否在排除列表中
        if (!excludeKeywords.includes(chineseMatch[0])) {
          keywords.push(chineseMatch[0]);
        }
      }
    }
  }
  
  return keywords;
}

/**
 * 在文本中匹配并替换词汇
 * 返回处理后的内容和匹配到的词汇列表
 */
function matchAndReplaceVocabulary(
  content: string, 
  words: Array<{ id: string; word: string; meaning: string; phonetic: string }>,
  density: 'sparse' | 'medium' | 'dense' = 'medium'
): { processedContent: string; usedWords: Array<{ word: string; meaning: string; phonetic: string; partOfSpeech: string; matchedChinese: string }> } {
  
  // 根据密度设置替换比例
  const replaceRatio = density === 'sparse' ? 0.4 : density === 'dense' ? 0.9 : 0.6;
  
  // 根据密度设置每个词最多出现次数（提高覆盖率）
  const maxOccurrencesPerWord = density === 'sparse' ? 1 : density === 'dense' ? 5 : 3;
  
  const usedWords: Array<{ word: string; meaning: string; phonetic: string; partOfSpeech: string; matchedChinese: string }> = [];
  const wordOccurrences = new Map<string, number>(); // 记录每个英文单词出现的次数
  
  // 构建中文关键词到英文单词的映射
  const chineseToEnglish = new Map<string, { word: string; meaning: string; phonetic: string; partOfSpeech: string }>();
  
  words.forEach(w => {
    const keywords = extractChineseKeywords(w.meaning);
    keywords.forEach(keyword => {
      // 检查是否是"来到"关键词
      if (keyword === '来到') {
        console.log(`发现"来到"关键词来自: ${w.word} - ${w.meaning}`);
      }
      
      if (!chineseToEnglish.has(keyword) && keyword.length >= 2) {
        // 提取词性
        const posMatch = w.meaning.match(/^([a-z]+\.(\s*\/\s*[a-z]+\.)?)\s*/i);
        const partOfSpeech = posMatch ? posMatch[1].trim() : '';
        
        chineseToEnglish.set(keyword, {
          word: w.word,
          meaning: w.meaning,
          phonetic: w.phonetic,
          partOfSpeech
        });
      }
    });
  });
  
  console.log(`构建了 ${chineseToEnglish.size} 个中文关键词映射`);
  
  // 统计关键词长度分布
  const lengthStats: Record<number, number> = {};
  chineseToEnglish.forEach((_, key) => {
    const len = key.length;
    lengthStats[len] = (lengthStats[len] || 0) + 1;
  });
  console.log('关键词长度分布:', lengthStats);
  
  // 按关键词长度降序排列（优先匹配长词）
  const sortedKeywords = Array.from(chineseToEnglish.keys()).sort((a, b) => b.length - a.length);
  
  // 调试：检查是否包含"来"或"是"关键词
  if (chineseToEnglish.has('来')) {
    const info = chineseToEnglish.get('来');
    console.log(`警告：关键词映射中包含"来" -> ${info?.word}: ${info?.meaning}`);
  }
  if (chineseToEnglish.has('是')) {
    const info = chineseToEnglish.get('是');
    console.log(`警告：关键词映射中包含"是" -> ${info?.word}: ${info?.meaning}`);
  }
  
  // 调试：打印前20个关键词
  console.log('前20个关键词:', sortedKeywords.slice(0, 20));
  
  // 替换内容
  let processedContent = content;
  let replaceCount = 0;
  const replacedPositions = new Set<number>(); // 记录已替换的位置
  
  for (const chinese of sortedKeywords) {
    const info = chineseToEnglish.get(chinese)!;
    
    // 检查这个词已经出现多少次
    const currentOccurrences = wordOccurrences.get(info.word.toLowerCase()) || 0;
    if (currentOccurrences >= maxOccurrencesPerWord) continue;
    
    // 查找词汇位置（可能找到多个）
    let searchStart = 0;
    let occurrencesThisRound = 0;
    
    while (occurrencesThisRound < maxOccurrencesPerWord - currentOccurrences) {
      const index = processedContent.indexOf(chinese, searchStart);
      if (index === -1) break;
      
      // 检查是否已经被替换过（避免替换已替换内容中的词）
      let isOverlapping = false;
      for (let i = index; i < index + chinese.length; i++) {
        if (replacedPositions.has(i)) {
          isOverlapping = true;
          break;
        }
      }
      
      // 检查当前位置是否已经在替换标记内（如 [word]（meaning））
      if (!isOverlapping) {
        // 向前查找最近的 [ 或 （
        const beforeText = processedContent.slice(0, index);
        const lastBracket = beforeText.lastIndexOf('[');
        const lastParen = beforeText.lastIndexOf('（');
        const lastCheck = Math.max(lastBracket, lastParen);
        
        if (lastCheck > -1) {
          // 检查在最近的括号后是否有闭合
          const afterLastCheck = beforeText.slice(lastCheck);
          if (!afterLastCheck.includes(']') && !afterLastCheck.includes('）')) {
            // 在未闭合的括号内，跳过
            isOverlapping = true;
          }
        }
      }
      
      // 词边界检查：对于2字关键词，只检查是否在已替换区域内
      // 放宽限制，允许在句子中匹配独立词
      let isValidWord = true;
      if (!isOverlapping && chinese.length === 2) {
        // 对于2字词，检查是否紧跟在"张"、"王"等姓氏后面（避免误匹配"张总"中的"总"）
        if (index > 0) {
          const prevChar = processedContent[index - 1];
          const commonSurnames = '张王李赵刘陈杨黄周吴徐朱马胡郭林何高梁郑罗宋谢唐韩曹许邓萧冯曾程蔡彭潘袁于董余苏叶吕魏蒋田杜丁沈姜范江傅钟卢汪戴崔任陆廖姚方金邱夏谭韦贾邹石熊孟秦阎薛侯雷白龙段郝孔邵史毛常万顾赖武康贺严尹钱施牛洪龚';
          if (commonSurnames.includes(prevChar)) {
            isValidWord = false;
          }
        }
      }
      
      if (!isOverlapping && isValidWord) {
        // 调试：记录匹配详情
        if (chinese === '来' || chinese === '是' || chinese === '来到') {
          console.log(`匹配到关键词 "${chinese}" -> ${info.word}, 位置: ${index}`);
        }
        
        // 提取干净的释义（只取第一个核心含义）
        let cleanMeaning = info.meaning
          .replace(/^[a-z]+\.(\s*\/\s*[a-z]+\.)?\s*/i, '')
          .split(/[；;，,]/)[0]  // 只取第一个含义
          .replace(/[（(][^)）]*[)）]/g, '')  // 移除括号内容
          .replace(/[a-z]+\./gi, '')  // 移除词性标记
          .trim();
        
        // 限制释义长度（最多10个字）
        if (cleanMeaning.length > 10) {
          cleanMeaning = cleanMeaning.slice(0, 10);
        }
        
        const replacement = `[${info.word}]（${cleanMeaning}）`;
        processedContent = processedContent.slice(0, index) + replacement + processedContent.slice(index + chinese.length);
        
        // 记录替换位置（注意replacement长度不同）
        for (let i = index; i < index + replacement.length; i++) {
          replacedPositions.add(i);
        }
        
        // 更新词频统计
        wordOccurrences.set(info.word.toLowerCase(), (wordOccurrences.get(info.word.toLowerCase()) || 0) + 1);
        occurrencesThisRound++;
        
        usedWords.push({
          word: info.word,
          meaning: info.meaning,
          phonetic: info.phonetic,
          partOfSpeech: info.partOfSpeech,
          matchedChinese: chinese
        });
        
        replaceCount++;
        
        // 继续查找下一个匹配位置（移到替换后的内容后面）
        searchStart = index + replacement.length;
      } else {
        searchStart = index + 1;
      }
    }
  }
  
  console.log(`替换了 ${replaceCount} 个词汇`);
  
  return { processedContent, usedWords };
}

/**
 * POST /api/v1/novel-upload/analyze
 * 上传小说文件，自动匹配词库词汇并转换为学习格式
 * 
 * 支持两种格式：
 * 1. 纯中文小说：使用中文关键词匹配
 * 2. 英汉对照小说：使用英文原文精确匹配（推荐）
 *    格式：
 *    ===EN===
 *    英文内容
 *    ===CN===
 *    中文内容
 *    
 *    或者：
 *    英文内容
 *    ---
 *    中文内容
 */
router.post('/analyze', upload.single('file'), async (req: any, res: any) => {
  try {
    const { book_id, user_id } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: '请上传小说文件' });
    }
    
    if (!book_id) {
      return res.status(400).json({ error: '请选择词库' });
    }
    
    if (!user_id) {
      return res.status(400).json({ error: '用户ID为必填参数' });
    }

    // 检查上传次数限制
    const limitCheck = await checkAndUpdateUploadLimit(user_id);
    if (!limitCheck.allowed) {
      return res.status(429).json({ error: limitCheck.error || '本周上传次数已用完' });
    }

    // 解码文件内容（支持UTF-8和GBK）
    const content = decodeBuffer(req.file.buffer);
    
    if (content.length < 500) {
      return res.status(400).json({ error: '小说内容太短，至少需要500字' });
    }

    const supabase = getSupabaseClient();
    
    // 获取词库词汇（分页查询，Supabase 默认限制 1000 条）
    const allWords: Array<{ id: string; word: string; meaning: string; phonetic: string }> = [];
    const PAGE_SIZE = 1000;
    let offset = 0;
    let hasMore = true;
    
    while (hasMore) {
      const { data: pageData, error: pageError } = await supabase
        .from('words')
        .select('id, word, meaning, phonetic')
        .eq('book_id', book_id)
        .range(offset, offset + PAGE_SIZE - 1);
      
      if (pageError) throw new Error(`查询词汇失败: ${pageError.message}`);
      
      if (pageData && pageData.length > 0) {
        allWords.push(...pageData);
        offset += PAGE_SIZE;
        hasMore = pageData.length === PAGE_SIZE;
      } else {
        hasMore = false;
      }
    }

    if (allWords.length === 0) {
      return res.status(400).json({ error: '该词库暂无词汇' });
    }

    console.log(`词库词汇数量: ${allWords.length}, 小说字数: ${content.length}`);

    // 解析英汉对照格式
    const { english, chinese, isBilingual } = parseBilingualContent(content);
    
    console.log(`文本格式: ${isBilingual ? '英汉对照' : '纯中文'}`);
    
    let processedContent: string;
    let usedWords: Array<{ word: string; meaning: string; phonetic: string; matchedChinese: string }>;
    let totalWordsInVocab = 0;
    let matchedCount = 0;
    
    if (isBilingual) {
      // 英汉对照模式：使用英文原文精确匹配
      console.log('使用英汉对照匹配模式');
      
      const result = matchBilingualContent(english, chinese, allWords);
      processedContent = result.processedContent;
      usedWords = result.usedWords;
      totalWordsInVocab = result.totalWords;
      matchedCount = result.matchedCount;
      
      console.log(`英汉对照模式匹配结果: 总匹配词数=${totalWordsInVocab}, 成功替换=${matchedCount}`);
    } else {
      // 纯中文模式：使用中文关键词匹配
      console.log('使用纯中文关键词匹配模式');
      
      const result = matchAndReplaceVocabulary(content, allWords, 'medium');
      processedContent = result.processedContent;
      usedWords = result.usedWords;
      totalWordsInVocab = usedWords.length;
      matchedCount = usedWords.length;
    }

    // AI 分析小说元信息
    const customHeaders = HeaderUtils.extractForwardHeaders(req.headers as Record<string, string>);
    const config = new Config();
    const llmClient = new LLMClient(config, customHeaders);

    const analysisContent = (isBilingual ? chinese : content).slice(0, 5000);
    
    const analysisPrompt = `你是一位专业的小说分析师。请分析以下小说片段，提取关键信息。

【小说片段】
${analysisContent}

请严格按照以下JSON格式输出（不要输出其他内容）：
{
  "title": "小说标题（如果片段中没有，根据内容推断一个合适的标题）",
  "genre": "小说类型（如：都市言情、悬疑推理、科幻未来、历史穿越、奇幻魔法、校园青春、职场商战、武侠江湖）",
  "protagonist": "主角姓名（主要人物）",
  "summary": "一句话简介（20字以内）"
}`;

    const analysisMessages = [{ role: 'user' as const, content: analysisPrompt }];
    const analysisResponse = await llmClient.invoke(analysisMessages, {
      temperature: 0.3,
      model: 'doubao-seed-1-6-lite-251015'
    });

    // 解析AI分析结果
    let novelInfo = {
      title: '未命名小说',
      genre: '都市言情',
      protagonist: '主角',
      summary: '精彩故事'
    };

    try {
      const jsonMatch = analysisResponse.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        novelInfo = { ...novelInfo, ...JSON.parse(jsonMatch[0]) };
      }
    } catch (e) {
      console.error('解析AI分析结果失败:', e);
    }

    console.log(`匹配到的词汇数量: ${usedWords.length}`);

    // 返回预览数据
    res.json({
      data: {
        title: novelInfo.title,
        genre: novelInfo.genre,
        protagonist: novelInfo.protagonist,
        wordCount: (isBilingual ? chinese : content).length,
        summary: novelInfo.summary,
        isBilingual,  // 标识是否是英汉对照模式
        totalWordsInVocab,  // 词库中存在的单词总数
        matchedCount,  // 成功替换的数量
        englishContent: isBilingual ? english : '',  // 英文原文（仅英汉对照模式有）
        originalContent: (isBilingual ? chinese : content).slice(0, 1000),
        processedContent: processedContent.slice(0, 3000) + (processedContent.length > 3000 ? '...' : ''),
        vocabularyCount: usedWords.length,
        vocabulary: usedWords.slice(0, 20),
        fullContent: processedContent,
        allVocabulary: usedWords,
        remainingUploads: limitCheck.remaining  // 剩余上传次数
      }
    });
  } catch (error) {
    console.error('分析小说失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

/**
 * POST /api/v1/novel-upload/save
 * 保存用户编辑后的小说
 */
router.post('/save', async (req: any, res: any) => {
  try {
    const { 
      book_id, 
      user_id,  // 用户ID用于数据隔离
      title, 
      genre, 
      protagonist, 
      content, 
      vocabulary,
      english_content  // 英文原文（英汉对照模式）
    } = req.body;
    
    if (!book_id || !title || !content) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const supabase = getSupabaseClient();

    // 计算章节和字数
    const chapterCount = (content.match(/第[一二三四五六七八九十\d]+章/g) || []).length || 1;
    const wordCount = content.length;

    // 保存小说
    const { data: novel, error: novelError } = await supabase
      .from('novels')
      .insert({
        book_id,
        user_id: user_id || null,  // 用户ID用于数据隔离
        title: title.replace(/[#*《》]/g, '').trim(),
        content,
        english_content: english_content || null,  // 保存英文原文
        summary: `${genre} | ${protagonist} | ${wordCount}字 | ${vocabulary?.length || 0}个词汇`,
        chapter_count: chapterCount,
        word_count: wordCount,
        is_user_uploaded: true  // 标记为用户上传
      })
      .select()
      .single();

    if (novelError) throw new Error(`保存小说失败: ${novelError.message}`);

    // 关联词汇 - 只查询需要的单词，避免 Supabase 默认 1000 条限制
    if (novel && vocabulary && vocabulary.length > 0) {
      const wordsToFind = vocabulary.map((v: any) => v.word.toLowerCase());
      
      const { data: allWords, error: wordsError } = await supabase
        .from('words')
        .select('id, word')
        .eq('book_id', book_id)
        .in('word', wordsToFind);
      
      if (wordsError) {
        console.error('[SAVE] 查询词汇表失败:', wordsError);
      }
      
      const wordIdMap = new Map<string, string>();
      allWords?.forEach((w: any) => wordIdMap.set(w.word.toLowerCase(), w.id));

      const novelWordsData: Array<{ novel_id: string; word_id: string; position: number }> = [];
      
      vocabulary.forEach((v: any, index: number) => {
        const wordId = wordIdMap.get(v.word.toLowerCase());
        if (wordId) {
          novelWordsData.push({
            novel_id: novel.id,
            word_id: wordId,
            position: index
          });
        }
      });

      if (novelWordsData.length > 0) {
        const { error: insertError } = await supabase.from('novel_words').insert(novelWordsData);
        if (insertError) {
          console.error('[SAVE] 插入词汇关联失败:', insertError);
        }
      }
    }

    res.json({ 
      data: { 
        id: novel.id, 
        title: novel.title,
        wordCount: novel.word_count,
        vocabularyCount: vocabulary?.length || 0
      } 
    });
  } catch (error) {
    console.error('保存小说失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

/**
 * GET /api/v1/novel-upload/limit
 * 获取剩余上传次数
 * Query: user_id
 */
router.get('/limit', async (req: any, res: any) => {
  try {
    const { user_id } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ error: '用户ID为必填参数' });
    }
    
    const result = await getRemainingUploads(user_id as string);
    res.json({ 
      data: {
        remaining: result.remaining,
        limit: result.limit,
        isVip: result.isVip,
        resetAt: getWeekStart()
      } 
    });
  } catch (error) {
    console.error('获取上传次数失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

/**
 * POST /api/v1/novel-upload/unlock
 * 使用授权密码重置上传次数
 * Body: { user_id, password }
 */
router.post('/unlock', async (req: any, res: any) => {
  try {
    const { user_id, password } = req.body;
    
    if (!user_id || !password) {
      return res.status(400).json({ error: '用户ID和授权密码为必填参数' });
    }
    
    const client = getSupabaseClient();
    
    // 获取正确的授权密码
    const { data: setting, error: settingError } = await client
      .from('admin_settings')
      .select('value')
      .eq('key', 'auth_password')
      .single();
    
    if (settingError || !setting) {
      return res.status(500).json({ error: '系统配置错误' });
    }
    
    // 验证密码
    if (password !== setting.value) {
      return res.status(401).json({ error: '授权密码错误' });
    }
    
    // 重置该用户的上传次数（删除当前周记录）
    const weekStart = getWeekStart();
    await client
      .from('upload_limits')
      .delete()
      .eq('user_id', user_id)
      .eq('week_start', weekStart);
    
    // 获取配置的上传次数限制
    const limitStr = await getAdminSetting('weekly_upload_limit');
    const WEEKLY_UPLOAD_LIMIT = parseInt(limitStr) || 2;
    
    res.json({ 
      success: true, 
      message: '解锁成功，上传次数已重置',
      data: { remaining: WEEKLY_UPLOAD_LIMIT }
    });
  } catch (error) {
    console.error('解锁失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

export default router;
