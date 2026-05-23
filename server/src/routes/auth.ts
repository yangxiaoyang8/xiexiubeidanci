import { Router } from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client.js';
import * as crypto from 'crypto';

const router = Router();

/**
 * 密码加密函数
 * 使用 SHA256 + salt 进行哈希
 */
function hashPassword(password: string, salt: string): string {
  return crypto.createHash('sha256').update(password + salt).digest('hex');
}

/**
 * 生成随机 salt
 */
function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * 注册接口
 * Body: { username: string, password: string }
 */
router.post('/register', async (req: any, res: any) => {
  try {
    const { username, password } = req.body;
    
    // 验证用户名
    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: '请输入用户名' });
    }
    
    const trimmedName = username.trim();
    
    if (trimmedName.length < 2 || trimmedName.length > 20) {
      return res.status(400).json({ error: '用户名需要2-20个字符' });
    }
    
    // 验证密码
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: '请输入密码' });
    }
    
    if (password.length < 6 || password.length > 20) {
      return res.status(400).json({ error: '密码需要6-20个字符' });
    }
    
    // 验证字符：只允许中文、英文、数字、下划线
    const validPattern = /^[\u4e00-\u9fa5a-zA-Z0-9_]+$/;
    if (!validPattern.test(trimmedName)) {
      return res.status(400).json({ error: '用户名只能包含中文、英文、数字、下划线' });
    }
    
    const client = getSupabaseClient();
    
    // 检查用户名是否已存在
    const { data: existingUser } = await client
      .from('users')
      .select('id')
      .eq('username', trimmedName)
      .single();
    
    if (existingUser) {
      return res.status(400).json({ error: '用户名已存在' });
    }
    
    // 生成 salt 和加密密码
    const salt = generateSalt();
    const hashedPassword = hashPassword(password, salt);
    
    // 创建新用户
    const { data: newUser, error: createError } = await client
      .from('users')
      .insert({ 
        username: trimmedName,
        password: hashedPassword + ':' + salt  // 存储格式: hash:salt
      })
      .select('id, username, created_at')
      .single();
    
    if (createError) {
      console.error('创建用户失败:', createError);
      return res.status(500).json({ error: '注册失败，请稍后重试' });
    }
    
    res.json({
      success: true,
      user: {
        id: newUser.id,
        username: newUser.username,
        created_at: newUser.created_at
      }
    });
    
  } catch (error) {
    console.error('注册失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

/**
 * 登录接口
 * Body: { username: string, password: string }
 */
router.post('/login', async (req: any, res: any) => {
  try {
    const { username, password } = req.body;
    
    // 验证输入
    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: '请输入用户名' });
    }
    
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: '请输入密码' });
    }
    
    const trimmedName = username.trim();
    
    const client = getSupabaseClient();
    
    // 查找用户
    const { data: user, error: findError } = await client
      .from('users')
      .select('id, username, password, created_at')
      .eq('username', trimmedName)
      .single();
    
    if (!user) {
      return res.status(400).json({ error: '用户名或密码错误' });
    }
    
    // 验证密码
    if (!user.password) {
      // 旧用户没有密码，需要设置密码
      return res.status(400).json({ error: '该账号需要设置密码，请联系管理员' });
    }
    
    const [storedHash, salt] = user.password.split(':');
    const inputHash = hashPassword(password, salt);
    
    if (inputHash !== storedHash) {
      return res.status(400).json({ error: '用户名或密码错误' });
    }
    
    // 登录成功
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        created_at: user.created_at
      }
    });
    
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

/**
 * 检查用户名是否存在
 * Query: username
 */
router.get('/check', async (req: any, res: any) => {
  try {
    const { username } = req.query;
    
    if (!username) {
      return res.status(400).json({ error: '缺少用户名参数' });
    }
    
    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('users')
      .select('id, username')
      .eq('username', username)
      .single();
    
    res.json({
      exists: !!data
    });
    
  } catch (error) {
    console.error('检查用户失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

/**
 * 获取用户信息
 * Query: user_id
 */
router.get('/me', async (req: any, res: any) => {
  try {
    const { user_id } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ error: '缺少用户ID' });
    }
    
    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('users')
      .select('id, username, created_at')
      .eq('id', user_id)
      .single();
    
    if (!data) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    res.json({ user: data });
    
  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

export default router;
