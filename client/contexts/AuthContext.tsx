import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { buildApiUrl } from '@/utils/api';

interface User {
  id: string;
  username: string;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_STORAGE_KEY = 'word_novel_user';

// Web 端 Cookie 操作
function setCookie(name: string, value: string, maxAge: number): void {
  if (Platform.OS === 'web') {
    try {
      document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=${maxAge};SameSite=Lax`;
    } catch (e) {
      console.error('[Auth] Cookie写入失败:', e);
    }
  }
}

function getCookie(name: string): string | null {
  if (Platform.OS !== 'web') return null;
  try {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [key, value] = cookie.trim().split('=');
      if (key === name) {
        return decodeURIComponent(value);
      }
    }
  } catch (e) {
    console.error('[Auth] Cookie读取失败:', e);
  }
  return null;
}

function deleteCookie(name: string): void {
  if (Platform.OS === 'web') {
    document.cookie = `${name}=;path=/;max-age=0`;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // 初始化：从本地存储恢复用户信息
  useEffect(() => {
    const loadUser = async () => {
      try {
        // 先尝试从 AsyncStorage 读取
        let userJson = await AsyncStorage.getItem(USER_STORAGE_KEY);
        
        // Web 端额外尝试从 Cookie 读取
        if (!userJson && Platform.OS === 'web') {
          const cookieUser = getCookie(USER_STORAGE_KEY);
          if (cookieUser) {
            userJson = cookieUser;
            // 同步到 AsyncStorage
            await AsyncStorage.setItem(USER_STORAGE_KEY, cookieUser);
          }
        }
        
        if (userJson) {
          const userData = JSON.parse(userJson);
          setUser(userData);
          console.log('[Auth] 已恢复用户:', userData.username);
        }
      } catch (error) {
        console.error('[Auth] 恢复用户失败:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadUser();
  }, []);

  const register = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(buildApiUrl('/api/v1/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        return { success: false, error: result.error || '注册失败' };
      }
      
      const userData = result.user;
      
      // 保存到本地存储
      const userJson = JSON.stringify(userData);
      await AsyncStorage.setItem(USER_STORAGE_KEY, userJson);
      
      // Web 端同时保存到 Cookie（更持久）
      if (Platform.OS === 'web') {
        setCookie(USER_STORAGE_KEY, userJson, 365 * 24 * 60 * 60); // 1年
      }
      
      setUser(userData);
      console.log('[Auth] 注册成功:', userData.username);
      
      return { success: true };
    } catch (error) {
      console.error('[Auth] 注册失败:', error);
      return { success: false, error: '网络错误，请稍后重试' };
    }
  };

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(buildApiUrl('/api/v1/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        return { success: false, error: result.error || '登录失败' };
      }
      
      const userData = result.user;
      
      // 保存到本地存储
      const userJson = JSON.stringify(userData);
      await AsyncStorage.setItem(USER_STORAGE_KEY, userJson);
      
      // Web 端同时保存到 Cookie（更持久）
      if (Platform.OS === 'web') {
        setCookie(USER_STORAGE_KEY, userJson, 365 * 24 * 60 * 60); // 1年
      }
      
      setUser(userData);
      console.log('[Auth] 登录成功:', userData.username);
      
      return { success: true };
    } catch (error) {
      console.error('[Auth] 登录失败:', error);
      return { success: false, error: '网络错误，请稍后重试' };
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem(USER_STORAGE_KEY);
      if (Platform.OS === 'web') {
        deleteCookie(USER_STORAGE_KEY);
      }
      setUser(null);
      console.log('[Auth] 已退出登录');
    } catch (error) {
      console.error('[Auth] 退出登录失败:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
