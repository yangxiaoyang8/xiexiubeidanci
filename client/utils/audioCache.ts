/**
 * 音频缓存管理器（按需获取版）
 * 
 * 策略：点击单词时按需获取音频，不预下载整个语音包
 * - 检查本地缓存
 * - 无缓存则从对象存储获取单个单词音频
 * - 缓存到本地供下次使用
 * 
 * 支持 Mobile (FileSystem) 和 Web (IndexedDB)
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { buildApiUrl } from './api';
import { getDeviceId } from './deviceId';

// 使用 any 绕过类型检查（expo-file-system/legacy 类型定义不完整）
const FS = FileSystem as any;

// ============ 常量定义 ============

const AUDIO_CACHE_INDEX_KEY = 'audio_cache_index_v3';
const MAX_TTS_TRIALS = 5;

// ============ 类型定义 ============

// 音频缓存索引：{ bookId: { word: localPath } }
interface AudioCacheIndex {
  [bookId: string]: {
    [word: string]: string;
  };
}

// ============ 平台检测 ============

const isWeb = Platform.OS === 'web';

// ============ 全局音频实例管理（防止叠音播放） ============

let currentAudio: HTMLAudioElement | null = null;
let currentSound: Audio.Sound | null = null;

/**
 * 停止当前正在播放的音频（导出供外部调用）
 */
export async function stopCurrentAudio(): Promise<void> {
  if (isWeb) {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    }
  } else {
    if (currentSound) {
      try {
        await currentSound.stopAsync();
        await currentSound.unloadAsync();
      } catch (e) {
        // 忽略已卸载的错误
      }
      currentSound = null;
    }
  }
}

// ============ Web 端 IndexedDB 封装 ============

const DB_NAME = 'AudioCacheDB';
const STORE_NAME = 'audio';
let dbPromise: Promise<IDBDatabase> | null = null;

async function getDB(): Promise<IDBDatabase> {
  if (!isWeb) throw new Error('IndexedDB only available on web');
  
  if (dbPromise) return dbPromise;
  
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
  
  return dbPromise;
}

// ArrayBuffer 转 Base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Base64 转 Data URL
function base64ToDataUrl(base64: string): string {
  return `data:audio/mpeg;base64,${base64}`;
}

async function webSaveAudio(bookId: string, word: string, arrayBuffer: ArrayBuffer): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    // 使用 bookId + word 作为 key，避免不同词库的相同单词冲突
    const key = `${bookId}:${word}`;
    // 存储为 Base64 字符串（更可靠）
    const base64 = arrayBufferToBase64(arrayBuffer);
    const request = store.put(base64, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function webGetAudioUrl(bookId: string, word: string): Promise<string | null> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const key = `${bookId}:${word}`;
      const request = store.get(key);
      request.onsuccess = () => {
        const result = request.result;
        if (typeof result === 'string') {
          // Base64 字符串，转换为 Data URL
          const dataUrl = base64ToDataUrl(result);
          resolve(dataUrl);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[AudioCache] webGetAudioUrl error:', error);
    return null;
  }
}

// ============ Mobile 端 FileSystem 封装 ============

const AUDIO_CACHE_DIR = `${FS.documentDirectory}audio_cache/`;

async function mobileEnsureCacheDir(): Promise<void> {
  const dirInfo = await FS.getInfoAsync(AUDIO_CACHE_DIR);
  if (!dirInfo.exists) {
    await FS.makeDirectoryAsync(AUDIO_CACHE_DIR, { intermediates: true });
  }
}

async function mobileSaveAudio(bookId: string, word: string, arrayBuffer: ArrayBuffer): Promise<string> {
  await mobileEnsureCacheDir();
  
  const bookDir = `${AUDIO_CACHE_DIR}${bookId}/`;
  const dirInfo = await FS.getInfoAsync(bookDir);
  if (!dirInfo.exists) {
    await FS.makeDirectoryAsync(bookDir, { intermediates: true });
  }
  
  const localPath = `${bookDir}${word}.mp3`;
  
  // ArrayBuffer转base64
  const uint8Array = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  const base64 = btoa(binary);
  
  await FS.writeAsStringAsync(localPath, base64, { encoding: FS.EncodingType.Base64 });
  
  return localPath;
}

async function mobileGetAudioPath(bookId: string, word: string): Promise<string | null> {
  const localPath = `${AUDIO_CACHE_DIR}${bookId}/${word}.mp3`;
  const fileInfo = await FS.getInfoAsync(localPath);
  return fileInfo.exists ? localPath : null;
}

// ============ 缓存索引管理 ============

async function getCacheIndex(): Promise<AudioCacheIndex> {
  try {
    const indexStr = await AsyncStorage.getItem(AUDIO_CACHE_INDEX_KEY);
    return indexStr ? JSON.parse(indexStr) : {};
  } catch {
    return {};
  }
}

async function saveCacheIndex(index: AudioCacheIndex): Promise<void> {
  await AsyncStorage.setItem(AUDIO_CACHE_INDEX_KEY, JSON.stringify(index));
}

// ============ TTS 试用次数管理（后端管理） ============

/**
 * 获取剩余 TTS 试用次数（从后端获取）
 */
export async function getRemainingTtsTrials(): Promise<number> {
  try {
    const deviceId = await getDeviceId();
    const response = await fetch(buildApiUrl(`/api/v1/tts/trial-limit?device_id=${encodeURIComponent(deviceId)}`));
    const result = await response.json();
    
    if (result.success && result.data) {
      return result.data.remaining;
    }
    return MAX_TTS_TRIALS;
  } catch (e) {
    console.error('[AudioCache] 获取TTS试用次数失败:', e);
    return MAX_TTS_TRIALS;
  }
}

/**
 * 使用一次 TTS 试用（记录到后端）
 */
export async function useTtsTrial(): Promise<boolean> {
  try {
    const deviceId = await getDeviceId();
    const response = await fetch(buildApiUrl('/api/v1/tts/use-trial'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: deviceId }),
    });
    
    const result = await response.json();
    return result.success === true;
  } catch (e) {
    console.error('[AudioCache] 使用TTS试用失败:', e);
    return false;
  }
}

// ============ 按需获取音频（核心功能） ============

/**
 * 获取单词音频URL（按需获取）
 * 
 * 简化方案：直接使用后端返回的签名URL，不进行本地缓存
 * 后端已有缓存机制（数据库记录 + 对象存储）
 */
export async function getWordAudioUrl(
  bookId: string, 
  word: string,
  meaning?: string,
  onNoCache?: () => void
): Promise<string | null> {
  try {
    // 通知调用方（用于统计）
    onNoCache?.();
    
    /**
     * 服务端文件：server/src/routes/tts.ts
     * 接口：GET /api/v1/tts/word-audio/:book_id/:word
     * 返回：{ data: { audioUrl: string, source: 'cached' | 'generated' } }
     */
    const response = await fetch(buildApiUrl(`/api/v1/tts/word-audio/${bookId}/${encodeURIComponent(word)}`));
    
    if (!response.ok) {
      console.error('[AudioCache] API请求失败:', response.status);
      return null;
    }
    
    const result = await response.json();
    if (!result.data?.audioUrl) {
      console.error('[AudioCache] 返回数据无效');
      return null;
    }
    
    console.log('[AudioCache] 音频来源:', result.data.source);
    return result.data.audioUrl;
  } catch (error) {
    console.error('[AudioCache] 获取音频失败:', error);
    return null;
  }
}

/**
 * 播放单词音频（按需获取）
 * 使用全局音频实例，确保同一时间只有一个音频在播放
 */
export async function playWordAudio(bookId: string, word: string, meaning?: string): Promise<{
  success: boolean;
  fromCache: boolean;
  error?: string;
}> {
  try {
    // 先停止当前播放的音频
    await stopCurrentAudio();
    
    let fromCache = true;
    
    const audioUrl = await getWordAudioUrl(bookId, word, meaning, () => {
      fromCache = false;
    });
    
    if (!audioUrl) {
      return { success: false, fromCache: false, error: '音频获取失败' };
    }
    
    if (isWeb) {
      // Web 端：使用原生 Audio API
      currentAudio = new window.Audio(audioUrl);
      
      // 播放结束后清理
      currentAudio.onended = () => {
        currentAudio = null;
      };
      
      currentAudio.onerror = () => {
        console.error('[AudioCache] 音频播放错误');
        currentAudio = null;
      };
      
      await currentAudio.play();
      
      return { success: true, fromCache };
    } else {
      // Mobile 端：使用 expo-av
      const { sound } = await Audio.Sound.createAsync({ uri: audioUrl });
      currentSound = sound;
      
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
          currentSound = null;
        }
      });
      
      await sound.playAsync();
      
      return { success: true, fromCache };
    }
  } catch (error) {
    console.error('[AudioCache] 播放失败:', error);
    return { 
      success: false, 
      fromCache: false, 
      error: error instanceof Error ? error.message : '播放失败' 
    };
  }
}

// ============ 缓存状态查询 ============

/**
 * 检查是否有本地缓存
 */
export async function hasCachedAudio(bookId: string, word: string): Promise<boolean> {
  try {
    const index = await getCacheIndex();
    return !!(index[bookId]?.[word]);
  } catch {
    return false;
  }
}

/**
 * 获取词库缓存状态
 */
export async function getBookCacheStatus(bookId: string): Promise<{
  cachedCount: number;
  words: string[];
}> {
  try {
    const index = await getCacheIndex();
    const words = index[bookId] ? Object.keys(index[bookId]) : [];
    return { cachedCount: words.length, words };
  } catch {
    return { cachedCount: 0, words: [] };
  }
}

/**
 * 清除词库缓存
 */
export async function clearBookCache(bookId: string): Promise<void> {
  try {
    const index = await getCacheIndex();
    
    if (isWeb) {
      // Web: 清除 IndexedDB 中的音频
      const words = index[bookId] ? Object.keys(index[bookId]) : [];
      const db = await getDB();
      
      for (const word of words) {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        // 使用正确的 key 格式
        store.delete(`${bookId}:${word}`);
      }
    } else {
      // Mobile: 删除目录
      const bookDir = `${AUDIO_CACHE_DIR}${bookId}/`;
      const dirInfo = await FS.getInfoAsync(bookDir);
      if (dirInfo.exists) {
        await FS.deleteAsync(bookDir, { idempotent: true });
      }
    }
    
    // 更新索引
    delete index[bookId];
    await saveCacheIndex(index);
    
    console.log('[AudioCache] 缓存已清除:', bookId);
  } catch (error) {
    console.error('[AudioCache] 清除缓存失败:', error);
  }
}

// ============ 兼容旧接口（语音包状态） ============

/**
 * 语音包状态（简化版，仅返回统计信息）
 */
export interface AudioPackStatus {
  bookId: string;
  bookName: string;
  totalWords: number;
  generatedWords: number;
  hasPack: boolean;
}

/**
 * 获取词库语音包状态（从后端查询）
 */
export async function getAudioPackStatus(bookId: string): Promise<AudioPackStatus | null> {
  try {
    const response = await fetch(buildApiUrl(`/api/v1/audio-pack/status/${bookId}`));
    const result = await response.json();
    
    if (result.data) {
      return {
        bookId: result.data.bookId,
        bookName: result.data.bookName,
        totalWords: result.data.totalWords,
        generatedWords: result.data.generatedWords,
        hasPack: result.data.hasPack,
      };
    }
    return null;
  } catch (error) {
    console.error('[AudioCache] 获取语音包状态失败:', error);
    return null;
  }
}

/**
 * @deprecated 不再需要下载整个语音包
 */
export async function downloadAndExtractAudioPack(): Promise<{ success: boolean; error?: string }> {
  console.log('[AudioCache] downloadAndExtractAudioPack 已废弃，现在使用按需获取');
  return { success: false, error: '已废弃，现在使用按需获取' };
}
