import { Router } from 'express';
import { TTSClient, Config, HeaderUtils, S3Storage } from 'coze-coding-dev-sdk';
import { getSupabaseClient } from '../storage/database/supabase-client.js';
import archiver from 'archiver';
import { Readable } from 'stream';
import unzipper from 'unzipper';

const router = Router();

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

// 语音包元数据
interface AudioPackMeta {
  bookId: string;
  bookName: string;
  totalWords: number;
  packUrl: string;
  packKey: string;
  packSize: number;
  generatedAt: string;
  expireAt: string;
}

// 已生成的音频进度
interface AudioProgress {
  word: string;
  audio_key: string;
  audio_size: number;
}

/**
 * 带重试机制的 TTS 合成
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
      
      if (errorMsg.includes('instance_not_found') || errorMsg.includes('instance') && errorMsg.includes('not found')) {
        console.log(`[TTS] 实例冷启动，等待重试 (${retry + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

/**
 * GET /api/v1/audio-pack/status/:book_id
 * 获取词库语音包状态
 */
router.get('/status/:book_id', async (req: any, res: any) => {
  try {
    const { book_id } = req.params;
    const client = getSupabaseClient();
    
    // 获取词库信息
    const { data: book, error: bookError } = await client
      .from('vocab_books')
      .select('id, name, total_words')
      .eq('id', book_id)
      .maybeSingle();
    
    if (bookError) throw bookError;
    if (!book) {
      return res.status(404).json({ error: '词库不存在' });
    }

    // 获取已生成进度
    const { count: generatedCount } = await client
      .from('audio_pack_progress')
      .select('*', { count: 'exact', head: true })
      .eq('book_id', book_id);

    // 获取语音包元数据
    const { data: packMeta, error: metaError } = await client
      .from('audio_packs')
      .select('*')
      .eq('book_id', book_id)
      .maybeSingle();
    
    if (metaError && !metaError.message.includes('does not exist')) {
      throw metaError;
    }

    // 检查签名URL是否即将过期（小于1天）
    let downloadUrl: string | null = null;
    let needRefresh = false;
    
    if (packMeta) {
      const expireAt = new Date(packMeta.expire_at);
      const now = new Date();
      const hoursLeft = (expireAt.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      if (hoursLeft < 24) {
        needRefresh = true;
      } else {
        downloadUrl = packMeta.pack_url;
      }
    }

    res.json({
      data: {
        bookId: book.id,
        bookName: book.name,
        totalWords: book.total_words || 0,
        generatedWords: generatedCount || 0,
        hasPack: !!packMeta,
        packSize: packMeta?.pack_size || 0,
        generatedAt: packMeta?.generated_at || null,
        downloadUrl,
        needRefresh,
      }
    });
  } catch (error) {
    console.error('获取语音包状态失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

/**
 * GET /api/v1/audio-pack/download/:book_id
 * 获取语音包下载链接
 */
router.get('/download/:book_id', async (req: any, res: any) => {
  try {
    const { book_id } = req.params;
    const client = getSupabaseClient();
    
    // 获取语音包元数据
    const { data: packMeta, error: metaError } = await client
      .from('audio_packs')
      .select('*')
      .eq('book_id', book_id)
      .maybeSingle();
    
    if (metaError && !metaError.message.includes('does not exist')) {
      throw metaError;
    }

    if (!packMeta) {
      return res.status(404).json({ error: '语音包未生成，请联系管理员' });
    }

    // 检查是否需要刷新签名URL
    const expireAt = packMeta.expire_at ? new Date(packMeta.expire_at) : null;
    const now = new Date();
    const hoursLeft = expireAt ? (expireAt.getTime() - now.getTime()) / (1000 * 60 * 60) : 0;

    let downloadUrl = packMeta.pack_url;
    
    if (!downloadUrl || hoursLeft < 24) {
      downloadUrl = await getStorage().generatePresignedUrl({
        key: packMeta.pack_key,
        expireTime: 7 * 24 * 60 * 60,
      });
      
      const newExpireAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await client
        .from('audio_packs')
        .update({
          pack_url: downloadUrl,
          expire_at: newExpireAt.toISOString(),
        })
        .eq('book_id', book_id);
    }

    res.json({
      data: {
        downloadUrl,
        packSize: packMeta.pack_size,
        totalWords: packMeta.total_words,
      }
    });
  } catch (error) {
    console.error('获取下载链接失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

/**
 * POST /api/v1/audio-pack/generate/:book_id
 * 生成词库语音包（支持断点续传）
 * 
 * 断点续传机制：
 * 1. 查询已生成的单词（从 audio_pack_progress 表）
 * 2. 跳过已生成的，只生成未生成的单词
 * 3. 每生成一个音频立即上传到对象存储并记录进度
 * 4. 中断后下次调用会从上次进度继续
 */
router.post('/generate/:book_id', async (req: any, res: any) => {
  try {
    const { book_id } = req.params;
    const client = getSupabaseClient();
    
    // 获取词库信息
    const { data: book, error: bookError } = await client
      .from('vocab_books')
      .select('id, name, total_words')
      .eq('id', book_id)
      .maybeSingle();
    
    if (bookError) throw bookError;
    if (!book) {
      return res.status(404).json({ error: '词库不存在' });
    }

    // 获取词库所有单词
    const allWords: Array<{ id: string; word: string; phonetic: string; meaning: string }> = [];
    const pageSize = 1000;
    let offset = 0;
    
    while (true) {
      const { data: pageData, error: pageError } = await client
        .from('words')
        .select('id, word, phonetic, meaning')
        .eq('book_id', book_id)
        .order('word', { ascending: true })
        .range(offset, offset + pageSize - 1);
      
      if (pageError) throw pageError;
      if (!pageData || pageData.length === 0) break;
      
      allWords.push(...pageData);
      
      if (pageData.length < pageSize) break;
      offset += pageSize;
    }
    
    if (!allWords || allWords.length === 0) {
      return res.status(400).json({ error: '该词库暂无词汇' });
    }

    // 查询已生成的单词
    const { data: existingProgress } = await client
      .from('audio_pack_progress')
      .select('word, audio_key, audio_size')
      .eq('book_id', book_id);
    
    const existingWords = new Set((existingProgress || []).map(p => p.word));
    const wordsToGenerate = allWords.filter(w => !existingWords.has(w.word));
    
    console.log(`[AudioPack] 词库: ${book.name}`);
    console.log(`[AudioPack] 总单词数: ${allWords.length}`);
    console.log(`[AudioPack] 已生成: ${existingWords.size}`);
    console.log(`[AudioPack] 待生成: ${wordsToGenerate.length}`);

    if (wordsToGenerate.length === 0) {
      // 所有单词已生成，直接打包
      console.log(`[AudioPack] 所有单词已生成，开始打包...`);
      return await packAndUpload(book_id, book.name, allWords.length, client, res);
    }

    // 初始化TTS客户端
    const customHeaders = HeaderUtils.extractForwardHeaders(req.headers as Record<string, string>);
    const config = new Config();
    const ttsClient = new TTSClient(config, customHeaders);

    let successCount = 0;
    let failCount = 0;

    // 逐个生成音频并上传
    for (let i = 0; i < wordsToGenerate.length; i++) {
      const wordItem = wordsToGenerate[i];
      
      try {
        // 生成朗读文本
        const text = wordItem.meaning 
          ? `${wordItem.word}. ${wordItem.meaning.split(/[；;，,]/)[0]}`
          : wordItem.word;

        const response = await synthesizeWithRetry(ttsClient, {
          uid: 'word-learner',
          text,
          speaker: 'zh_female_vv_uranus_bigtts',
          audioFormat: 'mp3',
          sampleRate: 24000,
          speechRate: -10,
          loudnessRate: 0
        });

        // 下载音频数据
        const audioResponse = await fetch(response.audioUri);
        const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
        
        // 上传到对象存储
        const audioKey = `audio-packs/${book_id}/words/${wordItem.word}.mp3`;
        const actualKey = await getStorage().uploadFile({
          fileContent: audioBuffer,
          fileName: audioKey,
          contentType: 'audio/mpeg',
        });
        
        // 记录进度到数据库
        await client
          .from('audio_pack_progress')
          .insert({
            id: crypto.randomUUID(),
            book_id,
            word: wordItem.word,
            audio_key: actualKey,
            audio_size: audioBuffer.length,
          });
        
        successCount++;
        
        // 每50个单词输出一次进度
        if ((i + 1) % 50 === 0) {
          const totalGenerated = existingWords.size + i + 1;
          console.log(`[AudioPack] 进度: ${totalGenerated}/${allWords.length} (${((totalGenerated / allWords.length) * 100).toFixed(1)}%)`);
        }
        
        // 添加延迟避免限流
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (err) {
        failCount++;
        console.error(`[AudioPack] 生成失败 ${wordItem.word}:`, err);
        
        const errorMsg = (err as any)?.message || '';
        if (errorMsg.includes('quota') || errorMsg.includes('concurrency')) {
          console.log('[AudioPack] 遇到配额限制，等待10秒后继续...');
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
      }
    }

    console.log(`[AudioPack] 生成完成! 成功: ${successCount}, 失败: ${failCount}`);

    // 打包所有音频
    return await packAndUpload(book_id, book.name, allWords.length, client, res);
    
  } catch (error) {
    console.error('生成语音包失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

/**
 * 打包所有音频并上传
 */
async function packAndUpload(
  bookId: string,
  bookName: string,
  totalWords: number,
  client: any,
  res: any
) {
  try {
    // 获取所有已生成的音频（使用分页查询，避免 Supabase 默认 1000 条限制）
    const allProgressData: Array<{ word: string; audio_key: string; audio_size: number }> = [];
    const pageSize = 1000;
    let offset = 0;
    
    while (true) {
      const { data: pageData, error: pageError } = await client
        .from('audio_pack_progress')
        .select('word, audio_key, audio_size')
        .eq('book_id', bookId)
        .order('word', { ascending: true })
        .range(offset, offset + pageSize - 1);
      
      if (pageError) throw pageError;
      if (!pageData || pageData.length === 0) break;
      
      allProgressData.push(...pageData);
      
      if (pageData.length < pageSize) break;
      offset += pageSize;
    }
    
    const progressData = allProgressData;
    
    if (!progressData || progressData.length === 0) {
      return res.status(500).json({ error: '没有已生成的音频文件' });
    }

    console.log(`[AudioPack] 开始打包 ${progressData.length} 个音频文件...`);

    // 下载所有音频文件
    const audioFiles: Array<{ name: string; data: Buffer }> = [];
    
    for (let i = 0; i < progressData.length; i++) {
      const item = progressData[i];
      
      try {
        // 生成临时下载链接
        const audioUrl = await getStorage().generatePresignedUrl({
          key: item.audio_key,
          expireTime: 60 * 60, // 1小时
        });
        
        // 下载音频
        const response = await fetch(audioUrl);
        const audioBuffer = Buffer.from(await response.arrayBuffer());
        
        audioFiles.push({
          name: `${item.word}.mp3`,
          data: audioBuffer,
        });
        
        // 每100个输出进度
        if ((i + 1) % 100 === 0) {
          console.log(`[AudioPack] 下载进度: ${i + 1}/${progressData.length}`);
        }
      } catch (err) {
        console.error(`[AudioPack] 下载失败 ${item.word}:`, err);
      }
    }

    if (audioFiles.length === 0) {
      return res.status(500).json({ error: '没有可用的音频文件' });
    }

    // 创建ZIP文件
    const zipBuffer = await createZipBuffer(audioFiles);
    
    console.log(`[AudioPack] ZIP文件大小: ${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB`);

    // 上传ZIP到对象存储
    const packFileName = `audio-packs/${bookId}/audio_pack.zip`;
    const actualPackKey = await getStorage().uploadFile({
      fileContent: zipBuffer,
      fileName: packFileName,
      contentType: 'application/zip',
    });
    console.log(`[AudioPack] 上传成功，key: ${actualPackKey}`);

    // 生成下载链接
    const packUrl = await getStorage().generatePresignedUrl({
      key: actualPackKey,
      expireTime: 7 * 24 * 60 * 60,
    });

    // 保存元数据到数据库
    const expireAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    
    const { data: existing } = await client
      .from('audio_packs')
      .select('id')
      .eq('book_id', bookId)
      .maybeSingle();

    if (existing) {
      await client
        .from('audio_packs')
        .update({
          pack_url: packUrl,
          pack_key: actualPackKey,
          pack_size: zipBuffer.length,
          total_words: audioFiles.length,
          generated_at: new Date().toISOString(),
          expire_at: expireAt.toISOString(),
        })
        .eq('book_id', bookId);
    } else {
      await client
        .from('audio_packs')
        .insert({
          id: crypto.randomUUID(),
          book_id: bookId,
          pack_url: packUrl,
          pack_key: actualPackKey,
          pack_size: zipBuffer.length,
          total_words: audioFiles.length,
          generated_at: new Date().toISOString(),
          expire_at: expireAt.toISOString(),
        });
    }

    console.log(`[AudioPack] 语音包生成完成!`);

    res.json({
      success: true,
      data: {
        bookId,
        bookName,
        totalWords,
        generatedWords: audioFiles.length,
        packSize: zipBuffer.length,
        packUrl,
      }
    });
  } catch (error) {
    console.error('打包失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
}

/**
 * 创建ZIP文件缓冲区
 */
async function createZipBuffer(files: Array<{ name: string; data: Buffer }>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    archive.on('data', (chunk) => {
      chunks.push(chunk);
    });

    archive.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    archive.on('error', (err) => {
      reject(err);
    });

    for (const file of files) {
      archive.append(file.data, { name: file.name });
    }

    archive.finalize();
  });
}

/**
 * POST /api/v1/audio-pack/pack/:book_id
 * 重新打包语音包（不重新生成，只从已生成的音频打包）
 */
router.post('/pack/:book_id', async (req: any, res: any) => {
  try {
    const { book_id } = req.params;
    const client = getSupabaseClient();
    
    // 获取词库信息
    const { data: book, error: bookError } = await client
      .from('vocab_books')
      .select('id, name, total_words')
      .eq('id', book_id)
      .maybeSingle();
    
    if (bookError) throw bookError;
    if (!book) {
      return res.status(404).json({ error: '词库不存在' });
    }

    // 打包
    return await packAndUpload(book_id, book.name, book.total_words || 0, client, res);
  } catch (error) {
    console.error('打包失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

/**
 * POST /api/v1/audio-pack/clear-progress/:book_id
 * 清除生成进度（重新开始）
 */
router.post('/clear-progress/:book_id', async (req: any, res: any) => {
  try {
    const { book_id } = req.params;
    const client = getSupabaseClient();
    
    // 删除所有进度记录
    const { error } = await client
      .from('audio_pack_progress')
      .delete()
      .eq('book_id', book_id);
    
    if (error) throw error;
    
    res.json({ success: true, message: '进度已清除，可以重新生成' });
  } catch (error) {
    console.error('清除进度失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

/**
 * POST /api/v1/audio-pack/import/:book_id
 * 从语音包ZIP中导入所有音频到对象存储和数据库
 * 只需要执行一次
 */
router.post('/import/:book_id', async (req: any, res: any) => {
  try {
    const { book_id } = req.params;
    const client = getSupabaseClient();
    
    console.log(`[AudioPack] 开始导入语音包: ${book_id}`);
    
    // 1. 获取语音包信息
    const { data: packMeta, error: metaError } = await client
      .from('audio_packs')
      .select('*')
      .eq('book_id', book_id)
      .maybeSingle();
    
    if (metaError) throw metaError;
    if (!packMeta) {
      return res.status(404).json({ error: '语音包不存在，请先生成语音包' });
    }
    
    // 2. 下载ZIP文件
    console.log(`[AudioPack] 下载ZIP: ${packMeta.pack_key}`);
    const zipUrl = await getStorage().generatePresignedUrl({
      key: packMeta.pack_key,
      expireTime: 60 * 60,
    });
    
    const zipResponse = await fetch(zipUrl);
    if (!zipResponse.ok) {
      return res.status(500).json({ error: '下载语音包失败' });
    }
    
    const zipBuffer = Buffer.from(await zipResponse.arrayBuffer());
    console.log(`[AudioPack] ZIP大小: ${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB`);
    
    // 3. 查询已导入的单词
    const { data: existingProgress } = await client
      .from('audio_pack_progress')
      .select('word')
      .eq('book_id', book_id);
    
    const existingWords = new Set((existingProgress || []).map(p => p.word));
    console.log(`[AudioPack] 已导入: ${existingWords.size} 个单词`);
    
    // 4. 使用流式解压
    const zipStream = Readable.from(zipBuffer);
    const mp3Files: Array<{ path: string; buffer: Buffer }> = [];
    
    await new Promise<void>((resolve, reject) => {
      zipStream
        .pipe(unzipper.Parse())
        .on('entry', async (entry: any) => {
          const fileName = entry.path;
          if (fileName.endsWith('.mp3')) {
            const chunks: Buffer[] = [];
            for await (const chunk of entry) {
              chunks.push(chunk);
            }
            mp3Files.push({
              path: fileName,
              buffer: Buffer.concat(chunks),
            });
          } else {
            entry.autodrain();
          }
        })
        .on('close', resolve)
        .on('error', reject);
    });
    
    console.log(`[AudioPack] ZIP中包含 ${mp3Files.length} 个音频文件`);
    
    if (mp3Files.length === 0) {
      return res.status(400).json({ error: 'ZIP中没有音频文件' });
    }
    
    // 5. 过滤已导入的
    const newFiles = mp3Files.filter(f => {
      const word = f.path.replace('.mp3', '');
      return !existingWords.has(word);
    });
    
    console.log(`[AudioPack] 待导入: ${newFiles.length} 个`);
    
    if (newFiles.length === 0) {
      return res.json({ 
        success: true, 
        message: '所有音频已导入',
        total: mp3Files.length,
        imported: 0,
        skipped: existingWords.size
      });
    }
    
    // 6. 批量上传并记录
    let importedCount = 0;
    let failedCount = 0;
    
    for (const file of newFiles) {
      try {
        const word = file.path.replace('.mp3', '');
        
        // 上传到对象存储
        const audioKey = `audio-packs/${book_id}/words/${word}.mp3`;
        const actualKey = await getStorage().uploadFile({
          fileContent: file.buffer,
          fileName: audioKey,
          contentType: 'audio/mpeg',
        });
        
        // 记录到数据库
        await client
          .from('audio_pack_progress')
          .insert({
            id: crypto.randomUUID(),
            book_id,
            word,
            audio_key: actualKey,
            audio_size: file.buffer.length,
          });
        
        importedCount++;
        
        if (importedCount % 100 === 0) {
          console.log(`[AudioPack] 导入进度: ${importedCount}/${newFiles.length}`);
        }
      } catch (err) {
        failedCount++;
      }
    }
    
    console.log(`[AudioPack] 导入完成! 成功: ${importedCount}, 失败: ${failedCount}`);
    
    res.json({
      success: true,
      message: '语音包导入完成',
      total: mp3Files.length,
      imported: importedCount,
      skipped: existingWords.size,
      failed: failedCount,
    });
    
  } catch (error) {
    console.error('[AudioPack] 导入语音包失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

/**
 * GET /api/v1/audio-pack/extract-audio/:book_id/:word
 * 从语音包ZIP中提取单个音频文件（备用）
 */
router.get('/extract-audio/:book_id/:word', async (req: any, res: any) => {
  try {
    const { book_id, word } = req.params;
    const client = getSupabaseClient();
    
    console.log(`[AudioPack] 从ZIP提取音频: ${word}`);
    
    // 1. 获取语音包信息
    const { data: packMeta, error: metaError } = await client
      .from('audio_packs')
      .select('*')
      .eq('book_id', book_id)
      .maybeSingle();
    
    if (metaError) throw metaError;
    if (!packMeta) {
      return res.status(404).json({ error: '语音包不存在' });
    }
    
    // 2. 下载ZIP文件
    console.log(`[AudioPack] 下载ZIP: ${packMeta.pack_key}`);
    const zipUrl = await getStorage().generatePresignedUrl({
      key: packMeta.pack_key,
      expireTime: 60 * 60,
    });
    
    const zipResponse = await fetch(zipUrl);
    if (!zipResponse.ok) {
      return res.status(500).json({ error: '下载语音包失败' });
    }
    
    const zipBuffer = Buffer.from(await zipResponse.arrayBuffer());
    console.log(`[AudioPack] ZIP大小: ${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB`);
    
    // 3. 使用 unzipper 流式解压找到音频文件
    const zipStream = Readable.from(zipBuffer);
    let audioBuffer: Buffer | null = null;
    const targetFile = `${word}.mp3`;
    
    await new Promise<void>((resolve, reject) => {
      zipStream
        .pipe(unzipper.Parse())
        .on('entry', async (entry: any) => {
          if (entry.path === targetFile) {
            const chunks: Buffer[] = [];
            for await (const chunk of entry) {
              chunks.push(chunk);
            }
            audioBuffer = Buffer.concat(chunks);
          } else {
            entry.autodrain();
          }
        })
        .on('close', resolve)
        .on('error', reject);
    });
    
    if (!audioBuffer) {
      console.log(`[AudioPack] ZIP中未找到音频: ${targetFile}`);
      return res.status(404).json({ error: '音频文件不存在于语音包中' });
    }
    
    // 使用非空断言（已经在上面检查过）
    const extractedBuffer = audioBuffer as Buffer;
    console.log(`[AudioPack] 提取音频成功: ${targetFile}, 大小: ${extractedBuffer.length} bytes`);
    
    // 4. 上传到对象存储
    const audioKey = `audio-packs/${book_id}/words/${word}.mp3`;
    const actualKey = await getStorage().uploadFile({
      fileContent: extractedBuffer,
      fileName: audioKey,
      contentType: 'audio/mpeg',
    });
    
    console.log(`[AudioPack] 音频已上传: ${actualKey}`);
    
    // 5. 记录到数据库
    try {
      await client
        .from('audio_pack_progress')
        .insert({
          id: crypto.randomUUID(),
          book_id,
          word,
          audio_key: actualKey,
          audio_size: extractedBuffer.length,
        });
      console.log(`[AudioPack] 已记录到数据库`);
    } catch (e) {
      console.log(`[AudioPack] 数据库记录已存在`);
    }
    
    // 6. 返回签名URL
    const audioUrl = await getStorage().generatePresignedUrl({
      key: actualKey,
      expireTime: 24 * 60 * 60,
    });
    
    res.json({ 
      data: { 
        audioUrl,
        source: 'extracted',
      } 
    });
    
  } catch (error) {
    console.error('[AudioPack] 提取音频失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

/**
 * GET /api/v1/audio-pack/word-audio/:book_id/:word
 * 获取单个单词的音频
 */
router.get('/word-audio/:book_id/:word', async (req: any, res: any) => {
  try {
    const { book_id, word } = req.params;
    const client = getSupabaseClient();
    
    // 查询音频key
    const { data: progress, error } = await client
      .from('audio_pack_progress')
      .select('audio_key')
      .eq('book_id', book_id)
      .eq('word', word)
      .maybeSingle();
    
    if (error) throw error;
    
    if (!progress) {
      return res.status(404).json({ error: '音频不存在' });
    }
    
    const audioUrl = await getStorage().generatePresignedUrl({
      key: progress.audio_key,
      expireTime: 24 * 60 * 60,
    });
    
    res.json({ data: { audioUrl } });
  } catch (error) {
    console.error('获取单词音频失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '服务器错误' });
  }
});

export default router;
