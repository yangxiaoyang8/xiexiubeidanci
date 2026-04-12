/**
 * 设备ID管理工具
 * 用于数据隔离，每个设备有唯一的ID
 * 
 * Web端使用多重备份策略：IndexedDB + localStorage + Cookie
 * 确保在PWA重置时至少有一个备份可以恢复
 * Mobile端使用AsyncStorage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

const DEVICE_ID_KEY = 'word_novel_device_id';
const DB_NAME = 'DeviceIdDB';
const STORE_NAME = 'deviceId';
const COOKIE_NAME = 'device_id_backup';
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1年

let cachedDeviceId: string | null = null;

// ============ Web 端 Cookie 封装（最可靠的备份） ============

function setCookie(name: string, value: string, maxAge: number): void {
  try {
    document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=${maxAge};SameSite=Lax`;
  } catch (e) {
    console.error('[DeviceID] Cookie写入失败:', e);
  }
}

function getCookie(name: string): string | null {
  try {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [key, value] = cookie.trim().split('=');
      if (key === name) {
        return decodeURIComponent(value);
      }
    }
  } catch (e) {
    console.error('[DeviceID] Cookie读取失败:', e);
  }
  return null;
}

// ============ Web 端 IndexedDB 封装 ============

let dbPromise: Promise<IDBDatabase> | null = null;

async function getWebDB(): Promise<IDBDatabase> {
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

async function getWebDeviceIdFromIndexedDB(): Promise<string | null> {
  try {
    const db = await getWebDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(DEVICE_ID_KEY);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error('[DeviceID] IndexedDB读取失败:', e);
    return null;
  }
}

async function setWebDeviceIdToIndexedDB(id: string): Promise<void> {
  try {
    const db = await getWebDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(id, DEVICE_ID_KEY);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error('[DeviceID] IndexedDB写入失败:', e);
  }
}

// ============ localStorage 封装 ============

function getWebDeviceIdFromLocalStorage(): string | null {
  try {
    return localStorage.getItem(DEVICE_ID_KEY);
  } catch (e) {
    console.error('[DeviceID] localStorage读取失败:', e);
    return null;
  }
}

function setWebDeviceIdToLocalStorage(id: string): void {
  try {
    localStorage.setItem(DEVICE_ID_KEY, id);
  } catch (e) {
    console.error('[DeviceID] localStorage写入失败:', e);
  }
}

// ============ 多重备份读取 ============

async function getWebDeviceId(): Promise<string | null> {
  // 1. 先尝试从 IndexedDB 读取（主要存储）
  let deviceId = await getWebDeviceIdFromIndexedDB();
  if (deviceId) {
    console.log('[DeviceID] 从IndexedDB恢复:', deviceId);
    // 同步到其他备份
    setWebDeviceIdToLocalStorage(deviceId);
    setCookie(COOKIE_NAME, deviceId, COOKIE_MAX_AGE);
    return deviceId;
  }
  
  // 2. 尝试从 localStorage 读取（备份1）
  deviceId = getWebDeviceIdFromLocalStorage();
  if (deviceId) {
    console.log('[DeviceID] 从localStorage恢复:', deviceId);
    // 同步到其他备份
    await setWebDeviceIdToIndexedDB(deviceId);
    setCookie(COOKIE_NAME, deviceId, COOKIE_MAX_AGE);
    return deviceId;
  }
  
  // 3. 尝试从 Cookie 读取（备份2，最可靠）
  deviceId = getCookie(COOKIE_NAME);
  if (deviceId) {
    console.log('[DeviceID] 从Cookie恢复:', deviceId);
    // 同步到其他备份
    await setWebDeviceIdToIndexedDB(deviceId);
    setWebDeviceIdToLocalStorage(deviceId);
    return deviceId;
  }
  
  return null;
}

// ============ 多重备份写入 ============

async function setWebDeviceId(id: string): Promise<void> {
  // 同时写入所有存储位置
  await Promise.all([
    setWebDeviceIdToIndexedDB(id),
    Promise.resolve(setWebDeviceIdToLocalStorage(id)),
    Promise.resolve(setCookie(COOKIE_NAME, id, COOKIE_MAX_AGE)),
  ]);
  console.log('[DeviceID] 已写入多重备份:', id);
}

async function requestPersistentStorage(): Promise<boolean> {
  if (Platform.OS === 'web' && navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persist();
      console.log('[DeviceID] 持久化存储请求结果:', isPersisted);
      return isPersisted;
    } catch (e) {
      console.error('[DeviceID] 请求持久化存储失败:', e);
    }
  }
  return false;
}

/**
 * 从存储中获取设备ID
 */
async function getStoredDeviceId(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return await getWebDeviceId();
  } else {
    // Mobile端使用AsyncStorage
    return await AsyncStorage.getItem(DEVICE_ID_KEY);
  }
}

/**
 * 存储设备ID
 */
async function setStoredDeviceId(id: string): Promise<void> {
  if (Platform.OS === 'web') {
    await setWebDeviceId(id);
  } else {
    // Mobile端使用AsyncStorage
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }
}

/**
 * 获取设备ID
 * 如果不存在则自动生成并存储
 */
export async function getDeviceId(): Promise<string> {
  // 优先返回缓存
  if (cachedDeviceId) {
    return cachedDeviceId;
  }

  try {
    // Web 端请求持久化存储
    if (Platform.OS === 'web') {
      await requestPersistentStorage();
    }
    
    // 尝试从存储中获取
    const storedId = await getStoredDeviceId();
    
    if (storedId) {
      cachedDeviceId = storedId;
      console.log('[DeviceID] 已有设备ID:', storedId);
      return storedId;
    }

    // 生成新的设备ID
    const newDeviceId = await generateDeviceId();
    
    // 存储到本地（多重备份）
    await setStoredDeviceId(newDeviceId);
    cachedDeviceId = newDeviceId;
    
    console.log('[DeviceID] 生成新设备ID:', newDeviceId);
    return newDeviceId;
  } catch (error) {
    console.error('[DeviceID] 获取设备ID失败:', error);
    // 返回临时ID
    const tempId = 'temp_' + Date.now();
    return tempId;
  }
}

/**
 * 生成唯一的设备ID
 * 格式：书架-XXXXXX（6位大写字母数字）
 */
async function generateDeviceId(): Promise<string> {
  // 生成6位随机字符（大写字母+数字）
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 排除容易混淆的 I, O, 0, 1
  const randomBytes = await Crypto.getRandomBytesAsync(6);
  const code = Array.from(randomBytes)
    .map(b => chars[b % chars.length])
    .join('');
  return '书架-' + code;
}

/**
 * 清除设备ID（仅用于测试）
 */
export async function clearDeviceId(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      // 清除 IndexedDB
      const db = await getWebDB();
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.delete(DEVICE_ID_KEY);
      
      // 清除 localStorage
      localStorage.removeItem(DEVICE_ID_KEY);
      
      // 清除 Cookie
      document.cookie = `${COOKIE_NAME}=;path=/;max-age=0`;
    } else {
      await AsyncStorage.removeItem(DEVICE_ID_KEY);
    }
    cachedDeviceId = null;
    console.log('[DeviceID] 设备ID已清除');
  } catch (error) {
    console.error('[DeviceID] 清除设备ID失败:', error);
  }
}

/**
 * 获取设备ID（同步版本，可能返回null）
 */
export function getDeviceIdSync(): string | null {
  return cachedDeviceId;
}

/**
 * 获取设备ID字段（用于API请求）
 */
export async function getDeviceIdField(): Promise<{ device_id: string }> {
  const deviceId = await getDeviceId();
  return { device_id: deviceId };
}

/**
 * 手动设置设备ID（用于恢复数据）
 * 会更新所有存储位置并清除缓存
 */
export async function setDeviceIdManually(id: string): Promise<void> {
  // 更新缓存
  cachedDeviceId = id;
  
  // 更新所有存储位置
  await setStoredDeviceId(id);
  
  console.log('[DeviceID] 手动设置设备ID:', id);
}
