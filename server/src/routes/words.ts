import { Router } from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client.js';

const router = Router();

/**
 * POST /api/v1/words/batch-import
 * 批量导入词汇
 * Body: { bookId: string, words: Array<{word, phonetic, partOfSpeech, meaning}> }
 */
router.post('/batch-import', async (req: any, res: any) => {
  try {
    const { bookId, words } = req.body;
    
    if (!bookId || !Array.isArray(words) || words.length === 0) {
      return res.status(400).json({ error: '参数错误' });
    }

    const client = getSupabaseClient();
    
    // 准备数据
    const insertData = words.map(w => ({
      id: crypto.randomUUID(),
      book_id: bookId,
      word: w.word,
      phonetic: w.phonetic || '',
      part_of_speech: w.partOfSpeech || '',
      meaning: w.meaning,
    }));

    // 批量插入（每次最多500条）
    const BATCH_SIZE = 500;
    let imported = 0;
    
    for (let i = 0; i < insertData.length; i += BATCH_SIZE) {
      const batch = insertData.slice(i, i + BATCH_SIZE);
      const { error } = await client.from('words').insert(batch);
      if (error) {
        console.error(`批次 ${i} 导入失败:`, error);
      } else {
        imported += batch.length;
      }
    }

    res.json({ 
      success: true, 
      imported,
      total: words.length 
    });
  } catch (error) {
    console.error('批量导入失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

/**
 * DELETE /api/v1/words/clear/:bookId
 * 清空指定词库的所有词汇
 */
router.delete('/clear/:bookId', async (req: any, res: any) => {
  try {
    const { bookId } = req.params;
    const client = getSupabaseClient();

    const { error } = await client
      .from('words')
      .delete()
      .eq('book_id', bookId);

    if (error) throw new Error(`清空词汇失败: ${error.message}`);

    res.json({ success: true });
  } catch (error) {
    console.error('清空词汇失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

/**
 * PUT /api/v1/words/update-count/:bookId
 * 更新词库词汇数量
 */
router.put('/update-count/:bookId', async (req: any, res: any) => {
  try {
    const { bookId } = req.params;
    const { count } = req.body;
    const client = getSupabaseClient();

    const { error } = await client
      .from('vocab_books')
      .update({ total_words: count, updated_at: new Date().toISOString() })
      .eq('id', bookId);

    if (error) throw new Error(`更新词库统计失败: ${error.message}`);

    res.json({ success: true });
  } catch (error) {
    console.error('更新词库统计失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

/**
 * GET /api/v1/words/
 * 获取指定词库的词汇列表
 */
router.get('/', async (req: any, res: any) => {
  try {
    const { book_id, limit = 100, offset = 0 } = req.query;
    
    if (!book_id) {
      return res.status(400).json({ error: '词库ID为必填参数' });
    }

    const client = getSupabaseClient();
    
    const { data, error, count } = await client
      .from('words')
      .select('*', { count: 'exact' })
      .eq('book_id', book_id)
      .order('word', { ascending: true })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (error) throw new Error(`查询词汇失败: ${error.message}`);

    res.json({ data, total: count });
  } catch (error) {
    console.error('获取词汇列表失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

/**
 * GET /api/v1/words/:id
 * 获取单个单词详情
 */
router.get('/:id', async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const client = getSupabaseClient();

    const { data, error } = await client
      .from('words')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`查询单词失败: ${error.message}`);
    
    if (!data) {
      return res.status(404).json({ error: '单词不存在' });
    }

    res.json({ data });
  } catch (error) {
    console.error('获取单词详情失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

export default router;
