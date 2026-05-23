import { Router } from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client.js';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

const router = Router();

// 常见中文姓氏
const CHINESE_SURNAMES = [
  '李', '王', '张', '刘', '陈', '杨', '黄', '赵', '周', '吴',
  '徐', '孙', '马', '朱', '胡', '郭', '何', '林', '罗', '高',
  '郑', '梁', '谢', '宋', '唐', '许', '邓', '冯', '韩', '曹',
  '曾', '彭', '萧', '蔡', '潘', '田', '董', '袁', '于', '余',
  '叶', '蒋', '杜', '苏', '魏', '程', '吕', '丁', '沈', '任'
];

// 常见中文名字（单字）
const CHINESE_GIVEN_NAMES_SINGLE = [
  '明', '华', '军', '伟', '强', '磊', '洋', '勇', '杰', '涛',
  '超', '敏', '静', '丽', '芳', '燕', '娟', '英', '玲', '霞',
  '晨', '宇', '浩', '然', '轩', '博', '文', '翔', '鹏', '飞',
  '雨', '雪', '梅', '竹', '兰', '菊', '松', '柏', '峰', '岩'
];

// 常见中文名字（双字）
const CHINESE_GIVEN_NAMES_DOUBLE = [
  '子涵', '梓萱', '欣怡', '可馨', '诗涵', '梓晨', '雨萱', '梦琪', '思源', '嘉怡',
  '雅婷', '志强', '建华', '文博', '晓东', '海燕', '小龙', '美玲', '俊杰', '晓峰',
  '思远', '浩然', '宇轩', '子轩', '梓豪', '一诺', '若曦', '雨桐', '诗瑶', '梦婷',
  '天宇', '晨曦', '逸风', '云飞', '青山', '明月', '星辰', '冰雪', '玉兰', '秋水'
];

/**
 * 生成随机中文姓名
 */
function generateRandomChineseName(): string {
  const surname = CHINESE_SURNAMES[Math.floor(Math.random() * CHINESE_SURNAMES.length)];
  // 50% 概率使用单字名，50% 概率使用双字名
  if (Math.random() > 0.5) {
    const givenName = CHINESE_GIVEN_NAMES_SINGLE[Math.floor(Math.random() * CHINESE_GIVEN_NAMES_SINGLE.length)];
    return surname + givenName;
  } else {
    const givenName = CHINESE_GIVEN_NAMES_DOUBLE[Math.floor(Math.random() * CHINESE_GIVEN_NAMES_DOUBLE.length)];
    return surname + givenName;
  }
}

// 小说类型模板
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

router.get('/', async (req: any, res: any) => {
  try {
    const { book_id, user_id } = req.query;
    
    if (!book_id) {
      return res.status(400).json({ error: '词库ID为必填参数' });
    }

    const client = getSupabaseClient();
    
    // 构建查询，按user_id隔离
    // 如果有user_id，返回该用户的小说 + 无user_id的旧小说（兼容历史数据）
    let query = client
      .from('novels')
      .select('id, title, summary, cover_image, chapter_count, word_count, is_user_uploaded, created_at, generate_status')
      .eq('book_id', book_id);
    
    // 如果有user_id，使用OR条件：user_id匹配 或 user_id为NULL
    if (user_id) {
      query = query.or(`user_id.eq.${user_id},user_id.is.null`);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw new Error(`查询小说失败: ${error.message}`);

    res.json({ data });
  } catch (error) {
    console.error('获取小说列表失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

/**
 * GET /api/v1/novels/generate-limit
 * 获取剩余生成次数
 * Query: user_id
 */
router.get('/generate-limit', async (req: any, res: any) => {
  try {
    const { user_id } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ error: '用户ID为必填参数' });
    }
    
    // 检查是否VIP用户
    const isVip = await checkIsVip(user_id as string);
    
    if (isVip) {
      res.json({ 
        data: {
          remaining: 999, // VIP显示无限制
          limit: 999,
          isVip: true,
          resetAt: null
        } 
      });
    } else {
      const { remaining, limit } = await getRemainingGenerations(user_id as string);
      res.json({ 
        data: {
          remaining,
          limit,
          isVip: false,
          resetAt: getWeekStart()
        } 
      });
    }
  } catch (error) {
    console.error('获取生成次数失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

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
  const { data: userData } = await client
    .from('users')
    .select('username')
    .eq('id', userId)
    .maybeSingle();
  
  if (userData?.username) {
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
 * POST /api/v1/novels/unlock
 * 使用授权密码解锁生成次数
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
    
    // 重置该用户的生成次数（删除当前周记录）
    const weekStart = getWeekStart();
    await client
      .from('generate_limits')
      .delete()
      .eq('user_id', user_id)
      .eq('week_start', weekStart);
    
    // 获取当前配置的生成次数限制
    const limitStr = await getAdminSetting('weekly_generate_limit');
    const WEEKLY_GENERATE_LIMIT = parseInt(limitStr) || 3;
    
    res.json({ 
      success: true, 
      message: '解锁成功，生成次数已重置',
      data: { remaining: WEEKLY_GENERATE_LIMIT }
    });
  } catch (error) {
    console.error('解锁失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

/**
 * POST /api/v1/novels/admin/password
 * 管理员修改授权密码
 * Body: { admin_key, new_password }
 */
router.post('/admin/password', async (req: any, res: any) => {
  try {
    const { admin_key, new_password } = req.body;
    
    // 管理员密钥（硬编码，更安全）
    const ADMIN_SECRET_KEY = 'novel-app-admin-2024';
    
    if (admin_key !== ADMIN_SECRET_KEY) {
      return res.status(403).json({ error: '无权限' });
    }
    
    if (!new_password || new_password.length < 4) {
      return res.status(400).json({ error: '新密码长度至少4位' });
    }
    
    const client = getSupabaseClient();
    
    // 更新授权密码
    const { error: updateError } = await client
      .from('admin_settings')
      .update({ value: new_password, updated_at: new Date().toISOString() })
      .eq('key', 'auth_password');
    
    if (updateError) {
      return res.status(500).json({ error: '更新失败' });
    }
    
    res.json({ success: true, message: '授权密码已更新' });
  } catch (error) {
    console.error('修改密码失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

/**
 * POST /api/v1/novels/admin/vip/add
 * 添加VIP用户
 * Body: { admin_key, user_id, remark? }
 */
router.post('/admin/vip/add', async (req: any, res: any) => {
  try {
    const { admin_key, user_id, remark } = req.body;
    
    const ADMIN_SECRET_KEY = 'novel-app-admin-2024';
    
    if (admin_key !== ADMIN_SECRET_KEY) {
      return res.status(403).json({ error: '无权限' });
    }
    
    if (!user_id) {
      return res.status(400).json({ error: '用户ID为必填参数' });
    }
    
    const client = getSupabaseClient();
    
    // 添加VIP
    const { error: insertError } = await client
      .from('vip_whitelist')
      .insert({ user_id, remark: remark || '' });
    
    if (insertError) {
      if (insertError.code === '23505') {
        return res.status(400).json({ error: '该用户已在VIP名单中' });
      }
      return res.status(500).json({ error: '添加失败' });
    }
    
    res.json({ success: true, message: 'VIP用户添加成功' });
  } catch (error) {
    console.error('添加VIP失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

/**
 * POST /api/v1/novels/admin/vip/remove
 * 移除VIP用户
 * Body: { admin_key, user_id }
 */
router.post('/admin/vip/remove', async (req: any, res: any) => {
  try {
    const { admin_key, user_id } = req.body;
    
    const ADMIN_SECRET_KEY = 'novel-app-admin-2024';
    
    if (admin_key !== ADMIN_SECRET_KEY) {
      return res.status(403).json({ error: '无权限' });
    }
    
    if (!user_id) {
      return res.status(400).json({ error: '用户ID为必填参数' });
    }
    
    const client = getSupabaseClient();
    
    const { error: deleteError } = await client
      .from('vip_whitelist')
      .delete()
      .eq('user_id', user_id);
    
    if (deleteError) {
      return res.status(500).json({ error: '移除失败' });
    }
    
    res.json({ success: true, message: 'VIP用户已移除' });
  } catch (error) {
    console.error('移除VIP失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

/**
 * GET /api/v1/novels/admin/vip/list
 * 获取VIP列表
 * Query: admin_key
 */
router.get('/admin/vip/list', async (req: any, res: any) => {
  try {
    const { admin_key } = req.query;
    
    const ADMIN_SECRET_KEY = 'novel-app-admin-2024';
    
    if (admin_key !== ADMIN_SECRET_KEY) {
      return res.status(403).json({ error: '无权限' });
    }
    
    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('vip_whitelist')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      return res.status(500).json({ error: '查询失败' });
    }
    
    res.json({ success: true, data });
  } catch (error) {
    console.error('查询VIP列表失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

router.get('/:id', async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const client = getSupabaseClient();

    const { data, error } = await client
      .from('novels')
      .select(`
        *,
        novel_words (
          id,
          position,
          words (*)
        )
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`查询小说失败: ${error.message}`);
    
    if (!data) {
      return res.status(404).json({ error: '小说不存在' });
    }

    res.json({ data });
  } catch (error) {
    console.error('获取小说详情失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

/**
 * 获取当前周的起始日期（周一）
 */
function getWeekStart(): string {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split('T')[0];
}

/**
 * 获取管理员配置值
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
 * 检查并更新生成次数
 */
async function checkAndUpdateGenerateLimit(userId: string): Promise<{ allowed: boolean; remaining: number; error?: string }> {
  const client = getSupabaseClient();
  const weekStart = getWeekStart();
  
  // 从数据库获取配置
  const limitStr = await getAdminSetting('weekly_generate_limit');
  const WEEKLY_GENERATE_LIMIT = parseInt(limitStr) || 3;
  
  // 查询当前周的记录
  const { data: existing, error: queryError } = await client
    .from('generate_limits')
    .select('*')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .single();
  
  if (queryError && queryError.code !== 'PGRST116') {
    return { allowed: false, remaining: 0, error: '查询次数失败' };
  }
  
  if (existing) {
    if (existing.count >= WEEKLY_GENERATE_LIMIT) {
      return { allowed: false, remaining: 0, error: '本周生成次数已用完，下周重置' };
    }
    // 增加次数
    await client
      .from('generate_limits')
      .update({ count: existing.count + 1, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
    return { allowed: true, remaining: WEEKLY_GENERATE_LIMIT - existing.count - 1 };
  } else {
    // 创建新记录
    await client
      .from('generate_limits')
      .insert({ user_id: userId, week_start: weekStart, count: 1 });
    return { allowed: true, remaining: WEEKLY_GENERATE_LIMIT - 1 };
  }
}

/**
 * 获取剩余生成次数
 */
async function getRemainingGenerations(userId: string): Promise<{ remaining: number; limit: number }> {
  const client = getSupabaseClient();
  const weekStart = getWeekStart();
  
  // 从数据库获取配置
  const limitStr = await getAdminSetting('weekly_generate_limit');
  const WEEKLY_GENERATE_LIMIT = parseInt(limitStr) || 3;
  
  const { data: existing } = await client
    .from('generate_limits')
    .select('count')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .single();
  
  if (!existing) return { remaining: WEEKLY_GENERATE_LIMIT, limit: WEEKLY_GENERATE_LIMIT };
  return { remaining: Math.max(0, WEEKLY_GENERATE_LIMIT - existing.count), limit: WEEKLY_GENERATE_LIMIT };
}

/**
 * POST /api/v1/novels/generate
 * 生成小说（后台异步生成）
 * Body: { book_id, user_id, protagonist?, plot?, keywords?, genre? }
 * 返回: { novel_id, status: 'generating' }
 */
router.post('/generate', async (req: any, res: any) => {
  try {
    const { book_id, user_id, protagonist, plot, keywords, genre } = req.body;
    
    if (!book_id) {
      return res.status(400).json({ error: '词库ID为必填参数' });
    }
    
    if (!user_id) {
      return res.status(400).json({ error: '用户ID为必填参数' });
    }
    
    // 检查是否VIP用户
    const isVip = await checkIsVip(user_id);
    
    // VIP用户无限制，普通用户检查次数
    if (!isVip) {
      const limitCheck = await checkAndUpdateGenerateLimit(user_id);
      if (!limitCheck.allowed) {
        return res.status(429).json({ error: limitCheck.error || '生成次数已用完' });
      }
    }

    const client = getSupabaseClient();
    
    // 获取词库词汇
    const { data: words, error: wordsError } = await client
      .from('words')
      .select('id, word, meaning, phonetic')
      .eq('book_id', book_id);

    if (wordsError) throw new Error(`查询词汇失败: ${wordsError.message}`);
    
    if (!words || words.length === 0) {
      return res.status(400).json({ error: '该词库暂无词汇，请先添加词汇' });
    }

    // 减少词汇数量到150-200个
    const targetWordCount = Math.min(Math.max(150, Math.floor(Math.random() * 50) + 150), words.length);
    const selectedWords = shuffleArray(words).slice(0, targetWordCount);

    // 选择小说类型
    const selectedGenre = genre || NOVEL_GENRES[Math.floor(Math.random() * NOVEL_GENRES.length)].name;
    
    // 主角设定
    const protagonistName = protagonist || generateRandomChineseName();
    const plotDesc = plot || '一个充满挑战和成长的故事';
    
    // 关键词设定
    const keywordsDesc = keywords ? keywords.substring(0, 50) : '';

    // 先创建小说记录（状态为生成中）
    const { data: novel, error: novelError } = await client
      .from('novels')
      .insert({
        book_id,
        user_id: user_id || null,
        title: '生成中...', // 临时标题
        content: '', // 临时空内容
        summary: `${selectedGenre} | ${protagonistName} | 生成中`,
        chapter_count: 0,
        word_count: 0,
        generate_status: 'generating'
      })
      .select()
      .single();

    if (novelError) throw new Error(`创建小说记录失败: ${novelError.message}`);

    // 立即返回小说ID
    res.json({ 
      novel_id: novel.id, 
      status: 'generating',
      message: '小说正在后台生成中'
    });

    // 后台异步生成（不阻塞响应）
    Promise.resolve(generateNovelInBackground(novel.id, {
      book_id,
      user_id,
      protagonistName,
      plotDesc,
      keywordsDesc,
      selectedGenre,
      selectedWords
    })).catch((err: Error) => {
      console.error('[Novel Generate] 后台生成失败:', err);
      // 更新状态为失败
      Promise.resolve(
        client
          .from('novels')
          .update({ 
            generate_status: 'failed',
            summary: '生成失败，请重试'
          })
          .eq('id', novel.id)
      ).then(() => console.log(`[Novel Generate] 已标记小说 ${novel.id} 为失败状态`))
        .catch((e: Error) => console.error('[Novel Generate] 更新失败状态出错:', e));
    });

  } catch (error) {
    console.error('生成小说失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

/**
 * 后台生成小说内容
 */
async function generateNovelInBackground(novelId: string, params: {
  book_id: string;
  user_id: string;
  protagonistName: string;
  plotDesc: string;
  keywordsDesc: string;
  selectedGenre: string;
  selectedWords: any[];
}) {
  const { book_id, user_id, protagonistName, plotDesc, keywordsDesc, selectedGenre, selectedWords } = params;
  const client = getSupabaseClient();

  try {
    console.log(`[Novel Generate] 开始后台生成小说 ${novelId}`);

    // 构建词汇列表
    const wordLines: string[] = [];
    for (let i = 0; i < selectedWords.length; i += 10) {
      const line = selectedWords.slice(i, i + 10)
        .map((w: any) => `${w.word}（${w.meaning.split(/[；;，,]/)[0]}）`)
        .join(', ');
      wordLines.push(line);
    }
    const wordListStr = wordLines.join('\n');

    // 构建prompt
    const keywordsSection = keywordsDesc ? `\n- 关键词：${keywordsDesc}` : '';
    
    const prompt = `你是一位擅长知乎盐选风格和短剧风格的小说作家。请创作一部${selectedGenre}类型的中文短篇故事。

【基本信息】
- 主角姓名：${protagonistName}
- 故事设定：${plotDesc}
- 小说类型：${selectedGenre}${keywordsSection}

【词汇要求】
小说需要自然融入以下${selectedWords.length}个英语词汇（每个词汇仅且出现一次，禁止重复出现）：
${wordListStr}

词汇嵌入格式：
- 用英文方括号标记英语单词，格式：[word]
- 例如：她有着[beautiful]眼睛和[warm]微笑
- 注意：只标记单词，不需要添加中文释义
- 重要：每个单词只能出现一次，不能重复！

【盐选风格要求】
1. **开篇即高潮**：第一段就要抛出悬念、冲突或反转，让读者立刻被抓住
2. **节奏紧凑**：每200-300字就有一个信息点或情感推进，拒绝注水
3. **对话驱动**：多用对话推进剧情，少用大段心理描写和环境描写
4. **现代语言**：句子简洁有力，不文绉绉，像在给朋友讲故事
5. **反转密集**：每500字左右一个小转折，让读者欲罢不能
6. **情感直接**：爱恨分明，不拖泥带水，冲突要尖锐
7. **结局有冲击**：要么反转，要么余韵悠长，让读者"意难平"

【篇幅要求】
- 总字数：3000-4000字（严格控制，确保故事完整）
- 结构：开篇抓人(20%) → 冲突升级(50%) → 高潮反转(20%) → 结局收束(10%)
- 不需要分章节标记，一气呵成

【故事结构模板】
- 开头：用一个具体的场景或对话开场，立刻制造悬念或冲突
- 中段：通过对话和行动推进，每段都有信息量
- 高潮：情感最强烈的时刻，要有意外
- 结尾：干净利落，给读者留有余味

${keywordsDesc ? `\n【关键词融合】\n请将以下关键词自然融入故事中：${keywordsDesc}` : ''}

【重要提醒】
1. 故事必须完整，必须有明确的结局
2. 字数控制在3000-4000字内完成
3. 故事结束后，必须在新的一行写"全文完"
4. 不要写传统网文那种"第X章"，直接一气呵成
5. **每个词汇只能出现一次，禁止重复！同一词汇不能连续出现两次**

【输出格式】
第一行：小说标题（中文，不超过10字，要有吸引力）
然后：小说正文（不分章节，一气呵成）
最后：单独一行写"全文完"

【开篇示例】
❌ 差的开头："李明是一个普通的上班族，每天朝九晚五..."
✅ 好的开头："我和初恋重逢的那天，他正挽着我最好的朋友走进婚姻登记处。"

现在开始创作：`;

    // 调用LLM生成
    const customHeaders: Record<string, string> = {};
    const config = new Config();
    const llmClient = new LLMClient(config, customHeaders);

    const messages = [{ role: 'user' as const, content: prompt }];
    let fullContent = '';
    
    // 重试机制
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        const stream = llmClient.stream(messages, {
          temperature: 0.7,
          model: 'doubao-seed-1-8-251228'
        });

        for await (const chunk of stream) {
          if (chunk.content) {
            fullContent += chunk.content.toString();
          }
        }
        break;
      } catch (err: any) {
        const errorMsg = err?.message || err?.toString() || '';
        if (errorMsg.includes('instance_not_found') || errorMsg.includes('instance') && errorMsg.includes('not found')) {
          retryCount++;
          console.log(`[Novel Generate] 实例冷启动，等待重试 (${retryCount}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }
        throw err;
      }
    }

    if (!fullContent) {
      throw new Error('生成内容为空');
    }

    // 检查完整性
    const hasEnding = fullContent.includes('全文完');
    
    if (!hasEnding) {
      const lastSentenceMatch = fullContent.lastIndexOf('。');
      const lastExclamationMatch = fullContent.lastIndexOf('！');
      const lastQuestionMatch = fullContent.lastIndexOf('？');
      const lastEndMark = Math.max(lastSentenceMatch, lastExclamationMatch, lastQuestionMatch);
      
      if (lastEndMark > 0) {
        fullContent = fullContent.substring(0, lastEndMark + 1);
      }
      
      const defaultEnding = `

时光荏苒，岁月如梭。${protagonistName}的故事还在继续，那些曾经的挑战与成长，都化作了人生路上最珍贵的财富。无论未来如何，${protagonistName}都将带着这份勇气与智慧，继续前行。

全文完`;
      
      fullContent += defaultEnding;
    }

    // 提取标题
    const lines = fullContent.split('\n').filter((l: string) => l.trim());
    let novelTitle = lines[0] || `${selectedGenre}小说`;
    
    if (novelTitle.includes('第') && novelTitle.includes('章')) {
      novelTitle = `${protagonistName}的${selectedGenre}之旅`;
    }

    // 计算章节和字数
    const chapterCount = (fullContent.match(/第[一二三四五六七八九十\d]+章/g) || []).length || 1;
    const wordCount = fullContent.length;

    // 更新小说记录
    const { error: updateError } = await client
      .from('novels')
      .update({
        title: novelTitle.replace(/[#*《》]/g, '').trim(),
        content: fullContent,
        summary: `${selectedGenre} | ${protagonistName} | ${wordCount}字 | ${selectedWords.length}个词汇`,
        chapter_count: chapterCount,
        word_count: wordCount,
        generate_status: 'completed'
      })
      .eq('id', novelId);

    if (updateError) throw new Error(`更新小说失败: ${updateError.message}`);

    // 关联词汇
    if (selectedWords.length > 0) {
      const novelWordsData = selectedWords.map((w: any, index: number) => ({
        novel_id: novelId,
        word_id: w.id,
        position: index
      }));

      for (let i = 0; i < novelWordsData.length; i += 500) {
        await client.from('novel_words').insert(novelWordsData.slice(i, i + 500));
      }
    }

    console.log(`[Novel Generate] 小说 ${novelId} 生成完成`);

  } catch (error) {
    console.error(`[Novel Generate] 生成小说 ${novelId} 失败:`, error);
    
    // 更新状态为失败
    await client
      .from('novels')
      .update({ 
        generate_status: 'failed',
        title: '生成失败',
        summary: '生成失败，请删除后重试'
      })
      .eq('id', novelId);
    
    throw error;
  }
}

/**
 * GET /api/v1/novels/genres
 * 获取可选的小说类型
 */
router.get('/genres/list', async (req: any, res: any) => {
  res.json({ data: NOVEL_GENRES });
});

/**
 * DELETE /api/v1/novels/:id
 * 删除小说
 */
router.delete('/:id', async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { user_id } = req.query;
    
    if (!id) {
      return res.status(400).json({ error: '小说ID为必填参数' });
    }

    const client = getSupabaseClient();
    
    // 验证小说是否属于该用户（允许删除无user_id的旧小说）
    if (user_id) {
      const { data: novel, error: checkError } = await client
        .from('novels')
        .select('user_id')
        .eq('id', id)
        .maybeSingle();
      
      if (checkError) {
        console.error('验证小说权限失败:', checkError);
      }
      
      // 如果小说有user_id且不匹配，拒绝删除
      // 如果小说没有user_id（旧数据），允许删除
      if (novel && novel.user_id && novel.user_id !== user_id) {
        return res.status(403).json({ error: '无权删除此小说' });
      }
    }
    
    // 先删除关联的 novel_words 记录
    const { error: wordsDeleteError } = await client
      .from('novel_words')
      .delete()
      .eq('novel_id', id);
    
    if (wordsDeleteError) {
      console.error('删除小说词汇关联失败:', wordsDeleteError);
    }
    
    // 再删除小说本身
    const { error: novelDeleteError } = await client
      .from('novels')
      .delete()
      .eq('id', id);
    
    if (novelDeleteError) {
      throw new Error(`删除小说失败: ${novelDeleteError.message}`);
    }

    res.json({ data: { id, deleted: true } });
  } catch (error) {
    console.error('删除小说失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export default router;
