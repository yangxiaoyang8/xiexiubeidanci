import { Router } from 'express';
import { TTSClient, Config, HeaderUtils, S3Storage } from 'coze-coding-dev-sdk';
import { getSupabaseClient } from '../storage/database/supabase-client.js';

const router = Router();

// 默认 TTS 试用次数上限
const DEFAULT_MAX_TTS_TRIALS = 5;

/**
 * 获取管理员配置的 TTS 试用次数上限
 */
async function getMaxTtsTrials(): Promise<number> {
  const client = getSupabaseClient();
  const { data } = await client
    .from('admin_settings')
    .select('value')
    .eq('key', 'max_tts_trials')
    .single();
  return data?.value ? parseInt(data.value, 10) : DEFAULT_MAX_TTS_TRIALS;
}

/**
 * GET /api/v1/tts/trial-limit
 * 获取剩余 TTS 试用次数
 * Query: device_id
 */
router.get('/trial-limit', async (req: any, res: any) => {
  try {
    const { device_id } = req.query;
    
    if (!device_id) {
      return res.status(400).json({ error: '设备ID为必填参数' });
    }

    const client = getSupabaseClient();
    const maxTrials = await getMaxTtsTrials();
    
    // 查询已使用次数
    const { data: limitRecord } = await client
      .from('tts_limits')
      .select('count')
      .eq('device_id', device_id)
      .single();
    
    const used = limitRecord?.count || 0;
    const remaining = Math.max(0, maxTrials - used);
    
    res.json({
      success: true,
      data: {
        remaining,
        used,
        limit: maxTrials
      }
    });
  } catch (error) {
    console.error('获取TTS试用次数失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

/**
 * POST /api/v1/tts/use-trial
 * 使用一次 TTS 试用
 * Body: { device_id }
 */
router.post('/use-trial', async (req: any, res: any) => {
  try {
    const { device_id } = req.body;
    
    if (!device_id) {
      return res.status(400).json({ error: '设备ID为必填参数' });
    }

    const client = getSupabaseClient();
    const maxTrials = await getMaxTtsTrials();
    
    // 查询已使用次数
    const { data: limitRecord } = await client
      .from('tts_limits')
      .select('*')
      .eq('device_id', device_id)
      .single();
    
    if (limitRecord) {
      // 检查是否还有剩余次数
      if (limitRecord.count >= maxTrials) {
        return res.status(400).json({ 
          error: '试用次数已用完',
          data: { remaining: 0, used: limitRecord.count, limit: maxTrials }
        });
      }
      
      // 增加使用次数
      await client
        .from('tts_limits')
        .update({ 
          count: limitRecord.count + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', limitRecord.id);
      
      const remaining = maxTrials - limitRecord.count - 1;
      res.json({
        success: true,
        data: { remaining, used: limitRecord.count + 1, limit: maxTrials }
      });
    } else {
      // 创建新记录
      await client
        .from('tts_limits')
        .insert({ device_id, count: 1 });
      
      res.json({
        success: true,
        data: { remaining: maxTrials - 1, used: 1, limit: maxTrials }
      });
    }
  } catch (error) {
    console.error('使用TTS试用失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

// 初始化对象存储
let storage: S3Storage | null = null;

function getStorage(): S3Storage {
  if (!storage) {
    storage = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
      accessKey: "",
      secretKey: "",
      bucketName: process.env.COZE_BUCKET_NAME,
      region: "cn-beijing",
    });
  }

  return storage;
}

/**
 * 带重试机制的 TTS 合成
 * 处理实例冷启动问题
 */
async function synthesizeWithRetry(
  ttsClient: TTSClient,
  params: any,
  maxRetries = 3
): Promise<any> {
  let lastError: Error | null = null;
  
  for (let retry = 0; retry < maxRetries; retry++) {
    try {
      const response = await ttsClient.synthesize(params);
      return response;
    } catch (err: any) {
      lastError = err;
      const errorMsg = err?.message || err?.toString() || '';
      
      // 检查是否是实例未找到错误
      if (errorMsg.includes('instance_not_found') || errorMsg.includes('instance') && errorMsg.includes('not found')) {
        console.log(`[TTS] 实例冷启动，等待重试 (${retry + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }
      
      // 其他错误直接抛出
      throw err;
    }
  }
  
  throw lastError;
}

router.post('/synthesize', async (req: any, res: any) => {
  try {
    const { text, speaker = 'zh_female_xiaohe_uranus_bigtts' } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: '文本内容为必填项' });
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(req.headers as Record<string, string>);
    const config = new Config();
    const ttsClient = new TTSClient(config, customHeaders);

    const response = await synthesizeWithRetry(ttsClient, {
      uid: 'word-learner',
      text,
      speaker,
      audioFormat: 'mp3',
      sampleRate: 24000,
      speechRate: 0,
      loudnessRate: 0
    });

    res.json({
      audioUri: response.audioUri,
      audioSize: response.audioSize
    });
  } catch (error) {
    console.error('TTS 合成失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

router.post('/word-pronunciation', async (req: any, res: any) => {
  try {
    const { word, meaning } = req.body;
    
    if (!word) {
      return res.status(400).json({ error: '单词为必填项' });
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(req.headers as Record<string, string>);
    const config = new Config();
    const ttsClient = new TTSClient(config, customHeaders);

    const text = meaning ? `${word}. ${meaning}` : word;

    const response = await synthesizeWithRetry(ttsClient, {
      uid: 'word-learner',
      text,
      speaker: 'zh_female_vv_uranus_bigtts',
      audioFormat: 'mp3',
      sampleRate: 24000,
      speechRate: -10,
      loudnessRate: 0
    });

    res.json({
      audioUri: response.audioUri,
      audioSize: response.audioSize
    });
  } catch (error) {
    console.error('单词朗读失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

router.get('/voices', (req: any, res: any) => {
  const voices = [
    { id: 'zh_female_xiaohe_uranus_bigtts', name: '小荷（默认）', type: 'general', gender: 'female' },
    { id: 'zh_female_vv_uranus_bigtts', name: 'Vivi（中英混合）', type: 'general', gender: 'female' },
    { id: 'zh_male_m191_uranus_bigtts', name: '云舟', type: 'general', gender: 'male' },
  ];

  res.json({ data: voices });
});

/**
 * POST /api/v1/tts/batch-generate
 * 批量生成词库语音包
 * Body: { book_id: string }
 * 返回: { audioList: [{ word, phonetic, meaning, audioUrl }] }
 */
router.post('/batch-generate', async (req: any, res: any) => {
  try {
    const { book_id } = req.body;
    
    if (!book_id) {
      return res.status(400).json({ error: '词库ID为必填项' });
    }

    const client = getSupabaseClient();
    
    // 获取词库所有单词
    const { data: words, error: wordsError } = await client
      .from('words')
      .select('id, word, phonetic, meaning')
      .eq('book_id', book_id);

    if (wordsError) throw new Error(`查询词汇失败: ${wordsError.message}`);
    
    if (!words || words.length === 0) {
      return res.status(400).json({ error: '该词库暂无词汇' });
    }

    console.log(`[TTS Batch] 开始批量生成 ${words.length} 个单词的语音...`);

    const customHeaders = HeaderUtils.extractForwardHeaders(req.headers as Record<string, string>);
    const config = new Config();
    const ttsClient = new TTSClient(config, customHeaders);

    const audioList: Array<{
      word: string;
      phonetic: string | null;
      meaning: string | null;
      audioUrl: string;
      audioKey: string;
    }> = [];

    // 批量生成语音（每次最多10个并发）
    const batchSize = 5;
    for (let i = 0; i < words.length; i += batchSize) {
      const batch = words.slice(i, i + batchSize);
      
      const results = await Promise.allSettled(
        batch.map(async (wordItem: any) => {
          const text = wordItem.meaning 
            ? `${wordItem.word}. ${wordItem.meaning.split(/[；;，,]/)[0]}`
            : wordItem.word;

          const response = await ttsClient.synthesize({
            uid: 'word-learner',
            text,
            speaker: 'zh_female_vv_uranus_bigtts',
            audioFormat: 'mp3',
            sampleRate: 24000,
            speechRate: -10,
            loudnessRate: 0
          });

          // 下载音频并上传到对象存储
          const audioResponse = await fetch(response.audioUri);
          const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
          
          const audioKey = await getStorage().uploadFile({
            fileContent: audioBuffer,
            fileName: `tts/${book_id}/${wordItem.word}.mp3`,
            contentType: 'audio/mpeg',
          });

          // 生成签名URL（有效期7天）
          const audioUrl = await getStorage().generatePresignedUrl({
            key: audioKey,
            expireTime: 7 * 24 * 60 * 60, // 7天
          });

          return {
            word: wordItem.word,
            phonetic: wordItem.phonetic,
            meaning: wordItem.meaning,
            audioUrl,
            audioKey,
          };
        })
      );

      // 收集成功的结果
      for (const result of results) {
        if (result.status === 'fulfilled') {
          audioList.push(result.value);
        } else {
          console.error('[TTS Batch] 生成失败:', result.reason);
        }
      }

      console.log(`[TTS Batch] 进度: ${Math.min(i + batchSize, words.length)}/${words.length}`);
    }

    console.log(`[TTS Batch] 完成，成功生成 ${audioList.length} 个音频`);

    res.json({
      success: true,
      total: words.length,
      generated: audioList.length,
      audioList,
    });
  } catch (error) {
    console.error('批量生成语音失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

/**
 * GET /api/v1/tts/cache/:book_id
 * 获取已缓存的词库语音列表
 */
router.get('/cache/:book_id', async (req: any, res: any) => {
  try {
    const { book_id } = req.params;
    
    const result = await getStorage().listFiles({
      prefix: `tts/${book_id}/`,
      maxKeys: 1000,
    });

    const audioList = result.keys.map(key => {
      const word = key.split('/').pop()?.replace('.mp3', '') || '';
      return { word, audioKey: key };
    });

    res.json({ data: audioList });
  } catch (error) {
    console.error('获取缓存列表失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

/**
 * GET /api/v1/tts/word-audio/:book_id/:word
 * 按需获取单词音频（优先使用预生成音频，无则实时生成）
 * 
 * 流程：
 * 1. 从数据库查询是否有缓存的音频key
 * 2. 有缓存 → 生成签名URL返回
 * 3. 无缓存 → 尝试从对象存储直接获取（预生成的语音包）
 * 4. 找不到 → 调用TTS实时生成 → 上传到对象存储 → 记录到数据库
 */
router.get('/word-audio/:book_id/:word', async (req: any, res: any) => {
  try {
    const { book_id, word } = req.params;
    const client = getSupabaseClient();
    
    // 1. 先从数据库查询是否有缓存的音频
    const { data: cachedAudio, error: cacheError } = await client
      .from('audio_pack_progress')
      .select('audio_key')
      .eq('book_id', book_id)
      .eq('word', word)
      .maybeSingle();
    
    if (!cacheError && cachedAudio?.audio_key) {
      // 有缓存，直接返回签名URL
      const audioUrl = await getStorage().generatePresignedUrl({
        key: cachedAudio.audio_key,
        expireTime: 24 * 60 * 60,
      });
      
      console.log(`[TTS] 使用数据库缓存: ${word} -> ${cachedAudio.audio_key}`);
      
      return res.json({ 
        data: { 
          audioUrl,
          source: 'cached',
        } 
      });
    }
    
    // 2. 尝试从对象存储直接获取（预生成的语音包文件）
    // 列出可能的文件路径（对象存储会添加随机后缀）
    const listResult = await getStorage().listFiles({
      prefix: `audio-packs/${book_id}/words/${word}`,
      maxKeys: 1,
    });
    
    if (listResult.keys && listResult.keys.length > 0) {
      // 找到预生成的音频文件
      const audioKey = listResult.keys[0];
      const audioUrl = await getStorage().generatePresignedUrl({
        key: audioKey,
        expireTime: 24 * 60 * 60,
      });
      
      // 记录到数据库（下次可以直接从数据库获取）
      await client
        .from('audio_pack_progress')
        .insert({
          id: crypto.randomUUID(),
          book_id,
          word,
          audio_key: audioKey,
          audio_size: 0, // 未知大小
        });
        console.log(`[TTS] 已缓存到数据库: ${book_id}/${word}`);
      
      console.log(`[TTS] 使用对象存储缓存: ${word} -> ${audioKey}`);
      
      return res.json({ 
        data: { 
          audioUrl,
          source: 'cached',
        } 
      });
    }
    
    // 3. 没有预生成音频，实时生成
    console.log(`[TTS] 实时生成音频: ${word}`);
    
    const customHeaders = HeaderUtils.extractForwardHeaders(req.headers as Record<string, string>);
    const config = new Config();
    const ttsClient = new TTSClient(config, customHeaders);
    
    // 获取单词信息
    const { data: wordInfo } = await client
      .from('words')
      .select('word, phonetic, meaning')
      .eq('book_id', book_id)
      .eq('word', word)
      .maybeSingle();
    
    // 生成朗读文本
    const text = wordInfo?.meaning 
      ? `${wordInfo.word}. ${wordInfo.meaning.split(/[；;，,]/)[0]}`
      : wordInfo?.word || word;
    
    // TTS 合成（带重试）
    let response;
    for (let retry = 0; retry < 3; retry++) {
      try {
        response = await ttsClient.synthesize({
          uid: 'word-learner',
          text,
          speaker: 'zh_female_vv_uranus_bigtts',
          audioFormat: 'mp3',
          sampleRate: 24000,
          speechRate: -10,
          loudnessRate: 0
        });
        break;
      } catch (err: any) {
        const errorMsg = err?.message || '';
        if (errorMsg.includes('instance_not_found') || errorMsg.includes('instance') && errorMsg.includes('not found')) {
          console.log(`[TTS] 实例冷启动，等待重试 (${retry + 1}/3)...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
          continue;
        }
        throw err;
      }
    }
    
    if (!response) {
      return res.status(500).json({ error: 'TTS服务暂不可用，请稍后重试' });
    }
    
    // 下载音频数据
    const audioResponse = await fetch(response.audioUri);
    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
    
    // 上传到对象存储
    const audioKey = `audio-packs/${book_id}/words/${word}.mp3`;
    const actualKey = await getStorage().uploadFile({
      fileContent: audioBuffer,
      fileName: audioKey,
      contentType: 'audio/mpeg',
    });
    
    console.log(`[TTS] 音频已上传: ${actualKey}, 大小: ${audioBuffer.length} bytes`);
    
    // 记录到数据库
    const { data: existingRecord } = await client
      .from('audio_pack_progress')
      .select('id')
      .eq('book_id', book_id)
      .eq('word', word)
      .maybeSingle();
    
    if (existingRecord) {
      await client
        .from('audio_pack_progress')
        .update({
          audio_key: actualKey,
          audio_size: audioBuffer.length,
        })
        .eq('id', existingRecord.id);
      console.log(`[TTS] 更新数据库记录: ${book_id}/${word}`);
    } else {
      await client
        .from('audio_pack_progress')
        .insert({
          id: crypto.randomUUID(),
          book_id,
          word,
          audio_key: actualKey,
          audio_size: audioBuffer.length,
        });
      console.log(`[TTS] 新增数据库记录: ${book_id}/${word}`);
    }
    
    // 生成签名URL
    const audioUrl = await getStorage().generatePresignedUrl({
      key: actualKey,
      expireTime: 24 * 60 * 60,
    });
    
    res.json({ 
      data: { 
        audioUrl,
        source: 'generated',
      } 
    });
    
  } catch (error) {
    console.error('获取单词音频失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

export default router;
