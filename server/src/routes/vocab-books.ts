import { Router } from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client.js';

const router = Router();

router.get('/', async (req: any, res: any) => {
  try {
    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('vocab_books')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw new Error(`查询词库失败: ${error.message}`);

    res.json({ data });
  } catch (error) {
    console.error('获取词库列表失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

router.get('/:id', async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const client = getSupabaseClient();

    const { data, error } = await client
      .from('vocab_books')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`查询词库失败: ${error.message}`);
    
    if (!data) {
      return res.status(404).json({ error: '词库不存在' });
    }

    res.json({ data });
  } catch (error) {
    console.error('获取词库详情失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

router.post('/', async (req: any, res: any) => {
  try {
    const { name, description, level } = req.body;
    
    if (!name || !level) {
      return res.status(400).json({ error: '词库名称和等级为必填项' });
    }

    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('vocab_books')
      .insert({ name, description, level, total_words: 0 })
      .select()
      .single();

    if (error) throw new Error(`创建词库失败: ${error.message}`);

    res.status(201).json({ data });
  } catch (error) {
    console.error('创建词库失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

router.put('/:id', async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('vocab_books')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`更新词库失败: ${error.message}`);
    
    if (!data) {
      return res.status(404).json({ error: '词库不存在' });
    }

    res.json({ data });
  } catch (error) {
    console.error('更新词库失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

router.delete('/:id', async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const client = getSupabaseClient();

    const { data, error } = await client
      .from('vocab_books')
      .delete()
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`删除词库失败: ${error.message}`);
    
    if (!data) {
      return res.status(404).json({ error: '词库不存在' });
    }

    res.json({ message: '删除成功' });
  } catch (error) {
    console.error('删除词库失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

export default router;
