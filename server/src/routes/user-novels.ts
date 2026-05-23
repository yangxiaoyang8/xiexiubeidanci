import { Router } from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client.js';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

const router = Router();

/**
 * 检查设备ID是否有数据（用于恢复数据功能）
 * Query: device_id
 */
router.get('/check-device', async (req: any, res: any) => {
  try {
    const { device_id } = req.query;
    
    if (!device_id) {
      return res.status(400).json({ error: '缺少device_id参数' });
    }
    
    const client = getSupabaseClient();
    
    // 并行查询 novels 表和 user_novels 表
    const [novelsResult, userNovelsResult] = await Promise.all([
      client
        .from('novels')
        .select('id', { count: 'exact', head: true })
        .eq('device_id', device_id),
      client
        .from('user_novels')
        .select('id', { count: 'exact', head: true })
        .eq('device_id', device_id)
    ]);
    
    const novelsCount = novelsResult.count || 0;
    const userNovelsCount = userNovelsResult.count || 0;
    const totalCount = novelsCount + userNovelsCount;
    
    res.json({
      has_data: totalCount > 0,
      novel_count: totalCount,
      details: {
        novels: novelsCount,
        user_novels: userNovelsCount
      }
    });
  } catch (error) {
    console.error('检查设备数据失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

router.get('/', async (req: any, res: any) => {
  try {
    const { device_id } = req.query;
    const client = getSupabaseClient();
    
    // 构建查询
    let query = client
      .from('user_novels')
      .select(`
        id,
        title,
        book_id,
        is_processed,
        created_at,
        vocab_books (name, level)
      `);
    
    // 按device_id隔离（兼容旧数据：同时返回device_id为NULL的记录）
    if (device_id) {
      query = query.or(`device_id.eq.${device_id},device_id.is.null`);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw new Error(`查询用户小说失败: ${error.message}`);

    res.json({ data });
  } catch (error) {
    console.error('获取用户小说列表失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

export default router;
