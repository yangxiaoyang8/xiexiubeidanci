import express from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client.js';

const router = express.Router();

/**
 * GET /api/v1/admin/vip-users
 * 获取VIP用户列表（关联用户名）
 */
router.get('/vip-users', async (req: any, res: any) => {
  try {
    const client = getSupabaseClient();
    
    // 获取VIP列表
    const { data, error } = await client
      .from('vip_whitelist')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    
    // 获取所有用户名
    const { data: users } = await client
      .from('users')
      .select('id, username');
    
    // 构建用户名映射
    const userMap = new Map();
    (users || []).forEach(user => {
      userMap.set(user.id, user.username);
    });
    
    // 关联用户名到VIP列表
    const result = (data || []).map(vip => {
      let displayId = '';
      let username = '';
      
      if (vip.user_id) {
        username = userMap.get(vip.user_id) || '';
        displayId = username || vip.user_id;
      } else if (vip.device_id) {
        displayId = vip.device_id;
      }
      
      return {
        ...vip,
        display_id: displayId,
        username: username
      };
    });
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取VIP用户失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

/**
 * POST /api/v1/admin/vip-users
 * 添加VIP用户
 * Body: { device_id?, user_id?, username?, remark? }
 * 支持通过 device_id、user_id 或 username 添加
 */
router.post('/vip-users', async (req: any, res: any) => {
  try {
    const { device_id, user_id, username, remark } = req.body;
    
    if (!device_id && !user_id && !username) {
      return res.status(400).json({ error: '设备ID、用户ID或用户名为必填参数' });
    }
    
    const client = getSupabaseClient();
    let finalUserId: string | null = user_id || null;
    let finalDeviceId: string | null = device_id || null;
    
    // 如果传入了username，查询对应的user_id
    if (username && !finalUserId) {
      const { data: userData } = await client
        .from('users')
        .select('id')
        .eq('username', username)
        .maybeSingle();
      
      if (userData) {
        finalUserId = userData.id;
      } else {
        return res.status(400).json({ error: `用户 "${username}" 不存在` });
      }
    }
    
    // 如果传入的是非UUID格式的device_id，尝试当作用户名处理
    if (device_id && !finalUserId) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(device_id);
      if (!isUuid) {
        // 当作用户名处理，查询user_id
        const { data: userData } = await client
          .from('users')
          .select('id')
          .eq('username', device_id)
          .maybeSingle();
        
        if (userData) {
          finalUserId = userData.id;
          finalDeviceId = null; // 不再存储device_id
        }
        // 如果找不到用户，则保持device_id不变（兼容旧的device_id）
      }
    }
    
    // 检查是否已存在
    let existing = null;
    if (finalUserId) {
      const { data } = await client
        .from('vip_whitelist')
        .select('id')
        .eq('user_id', finalUserId)
        .maybeSingle();
      existing = data;
    }
    if (!existing && finalDeviceId) {
      const { data } = await client
        .from('vip_whitelist')
        .select('id')
        .eq('device_id', finalDeviceId)
        .maybeSingle();
      existing = data;
    }
    
    if (existing) {
      return res.status(400).json({ error: '该用户已是VIP' });
    }
    
    // 添加VIP用户
    const insertData: any = { remark: remark || null };
    if (finalUserId) insertData.user_id = finalUserId;
    if (finalDeviceId) insertData.device_id = finalDeviceId;
    
    const { error } = await client
      .from('vip_whitelist')
      .insert(insertData);
    
    if (error) {
      console.error('添加VIP失败:', error);
      return res.status(500).json({ error: error.message });
    }
    
    res.json({ success: true, message: 'VIP用户添加成功' });
  } catch (error) {
    console.error('添加VIP用户失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

/**
 * DELETE /api/v1/admin/vip-users/:id
 * 删除VIP用户（支持 user_id 或 device_id）
 */
router.delete('/vip-users/:id', async (req: any, res: any) => {
  try {
    const { id } = req.params;
    
    const client = getSupabaseClient();
    
    // 判断是UUID格式还是普通字符串
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    
    let deleted = false;
    
    if (isUuid) {
      // UUID格式：优先按 user_id 删除
      const result1 = await client
        .from('vip_whitelist')
        .delete()
        .eq('user_id', id);
      
      if (!result1.error && result1.count > 0) {
        deleted = true;
      }
    }
    
    // 如果没删掉，按 device_id 删除
    if (!deleted) {
      const result2 = await client
        .from('vip_whitelist')
        .delete()
        .eq('device_id', id);
      
      if (result2.error) {
        return res.status(500).json({ error: result2.error.message });
      }
      deleted = true;
    }
    
    res.json({ success: true, message: 'VIP用户已移除' });
  } catch (error) {
    console.error('删除VIP用户失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

/**
 * GET /api/v1/admin/unlock-password
 * 获取当前授权密码
 */
router.get('/unlock-password', async (req: any, res: any) => {
  try {
    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('admin_settings')
      .select('value')
      .eq('key', 'auth_password')
      .single();
    
    if (error && error.code !== 'PGRST116') {
      return res.status(500).json({ error: error.message });
    }
    
    res.json({ 
      success: true, 
      data: { password: data?.value || '未设置' } 
    });
  } catch (error) {
    console.error('获取授权密码失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

/**
 * PUT /api/v1/admin/unlock-password
 * 修改授权密码
 * Body: { new_password }
 */
router.put('/unlock-password', async (req: any, res: any) => {
  try {
    const { new_password } = req.body;
    
    if (!new_password || new_password.length < 4) {
      return res.status(400).json({ error: '密码长度至少4位' });
    }
    
    const client = getSupabaseClient();
    
    // 使用 upsert 更新或插入
    const { error } = await client
      .from('admin_settings')
      .upsert(
        { key: 'auth_password', value: new_password },
        { onConflict: 'key' }
      );
    
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    
    res.json({ success: true, message: '授权密码已更新' });
  } catch (error) {
    console.error('修改授权密码失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

/**
 * PUT /api/v1/admin/admin-password
 * 修改管理员密码
 * Body: { new_password }
 */
router.put('/admin-password', async (req: any, res: any) => {
  try {
    const { new_password } = req.body;
    
    if (!new_password || new_password.length < 4) {
      return res.status(400).json({ error: '密码长度至少4位' });
    }
    
    const client = getSupabaseClient();
    
    // 使用 upsert 更新或插入
    const { error } = await client
      .from('admin_settings')
      .upsert(
        { key: 'admin_password', value: new_password },
        { onConflict: 'key' }
      );
    
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    
    res.json({ success: true, message: '管理员密码已更新' });
  } catch (error) {
    console.error('修改管理员密码失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

/**
 * POST /api/v1/admin/verify-admin-password
 * 验证管理员密码
 * Body: { password }
 */
router.post('/verify-admin-password', async (req: any, res: any) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: '密码不能为空' });
    }
    
    const client = getSupabaseClient();
    
    // 获取存储的管理员密码
    const { data, error } = await client
      .from('admin_settings')
      .select('value')
      .eq('key', 'admin_password')
      .single();
    
    if (error && error.code !== 'PGRST116') {
      return res.status(500).json({ error: error.message });
    }
    
    // 如果没有设置管理员密码，使用默认密码
    const storedPassword = data?.value || 'admin2025';
    
    if (password === storedPassword) {
      res.json({ success: true, message: '验证通过' });
    } else {
      res.status(401).json({ error: '密码错误' });
    }
  } catch (error) {
    console.error('验证管理员密码失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

/**
 * GET /api/v1/admin/generate-limits
 * 获取生成次数统计
 */
router.get('/generate-limits', async (req: any, res: any) => {
  try {
    const client = getSupabaseClient();
    
    // 获取本周的生成次数记录
    const { data, error } = await client
      .from('generate_limits')
      .select('device_id, week_start, count')
      .order('count', { ascending: false });
    
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    
    res.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('获取生成次数统计失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

/**
 * GET /api/v1/admin/upload-limits
 * 获取上传次数统计
 */
router.get('/upload-limits', async (req: any, res: any) => {
  try {
    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('upload_limits')
      .select('device_id, week_start, count')
      .order('count', { ascending: false });
    
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    
    res.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('获取上传次数统计失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

/**
 * GET /api/v1/admin/settings
 * 获取所有系统配置
 */
router.get('/settings', async (req: any, res: any) => {
  try {
    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('admin_settings')
      .select('key, value')
      .order('key');
    
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    
    // 转换为对象格式
    const settings: Record<string, string> = {};
    (data || []).forEach((item: any) => {
      settings[item.key] = item.value;
    });
    
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('获取系统配置失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

/**
 * PUT /api/v1/admin/settings
 * 更新系统配置
 * Body: { settings: { [key: string]: string } }
 */
router.put('/settings', async (req: any, res: any) => {
  try {
    const { settings } = req.body;
    
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: '配置数据格式错误' });
    }
    
    const client = getSupabaseClient();
    
    // 批量更新配置
    for (const [key, value] of Object.entries(settings)) {
      await client
        .from('admin_settings')
        .upsert(
          { key, value: String(value) },
          { onConflict: 'key' }
        );
    }
    
    res.json({ success: true, message: '配置已更新' });
  } catch (error) {
    console.error('更新系统配置失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

/**
 * POST /api/v1/admin/reset-upload-limit
 * 重置指定设备的上传次数
 * Body: { device_id }
 */
router.post('/reset-upload-limit', async (req: any, res: any) => {
  try {
    const { device_id } = req.body;
    
    if (!device_id) {
      return res.status(400).json({ error: '设备ID为必填参数' });
    }
    
    const client = getSupabaseClient();
    
    // 删除该设备当前周的上传记录
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    const weekStart = monday.toISOString().split('T')[0];
    
    const { error } = await client
      .from('upload_limits')
      .delete()
      .eq('device_id', device_id)
      .eq('week_start', weekStart);
    
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    
    res.json({ success: true, message: '上传次数已重置' });
  } catch (error) {
    console.error('重置上传次数失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

/**
 * POST /api/v1/admin/reset-generate-limit
 * 重置指定设备的生成次数
 * Body: { device_id }
 */
router.post('/reset-generate-limit', async (req: any, res: any) => {
  try {
    const { device_id } = req.body;
    
    if (!device_id) {
      return res.status(400).json({ error: '设备ID为必填参数' });
    }
    
    const client = getSupabaseClient();
    
    // 删除该设备当前周的生成记录
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    const weekStart = monday.toISOString().split('T')[0];
    
    const { error } = await client
      .from('generate_limits')
      .delete()
      .eq('device_id', device_id)
      .eq('week_start', weekStart);
    
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    
    res.json({ success: true, message: '生成次数已重置' });
  } catch (error) {
    console.error('重置生成次数失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

export default router;
