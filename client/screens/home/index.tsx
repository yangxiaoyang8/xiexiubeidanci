import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Modal, TextInput, Alert, Platform } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Screen } from '@/components/Screen';
import { useTheme } from '@/hooks/useTheme';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesome6 } from '@expo/vector-icons';
import { createStyles } from './styles';
import { buildApiUrl } from '@/utils/api';
import { LevelColors } from '@/constants/theme';

// 连续点击阈值
const CLICK_THRESHOLD = 5;
const CLICK_TIMEOUT = 2000; // 2秒内点击有效

interface VocabBook {
  id: string;
  name: string;
  description: string | null;
  level: string;
  total_words: number;
  created_at: string;
}

export default function HomeScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const { user, loading: authLoading, login, register, logout } = useAuth();
  
  const [books, setBooks] = useState<VocabBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // 登录弹窗状态
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  
  // 管理员入口相关状态
  const clickCountRef = useRef(0);
  const lastClickTimeRef = useRef(0);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminLoggingIn, setAdminLoggingIn] = useState(false);

  const fetchBooks = async () => {
    try {
      const response = await fetch(buildApiUrl('/api/v1/vocab-books'));
      const result = await response.json();
      
      if (result.data) {
        const sortedBooks = [...result.data].sort((a, b) => {
          if (a.total_words > 0 && b.total_words === 0) return -1;
          if (a.total_words === 0 && b.total_words > 0) return 1;
          return b.total_words - a.total_words;
        });
        setBooks(sortedBooks);
      }
    } catch (error) {
      console.error('获取词库失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBooks();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchBooks();
  };

  const handleBookPress = (bookId: string) => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    router.push('/novels', { book_id: bookId, user_id: user.id });
  };

  const handleUploadPress = () => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    router.push('/upload');
  };

  // 登录
  const handleLogin = async () => {
    if (!usernameInput.trim()) {
      Alert.alert('提示', '请输入用户名');
      return;
    }
    if (!passwordInput.trim()) {
      Alert.alert('提示', '请输入密码');
      return;
    }
    
    setLoggingIn(true);
    
    try {
      const result = await login(usernameInput.trim(), passwordInput.trim());
      
      if (result.success) {
        setShowLoginModal(false);
        setUsernameInput('');
        setPasswordInput('');
        Alert.alert('欢迎回来', '登录成功！');
      } else {
        Alert.alert('错误', result.error || '登录失败');
      }
    } catch (error) {
      console.error('登录失败:', error);
      Alert.alert('错误', '网络错误，请稍后重试');
    } finally {
      setLoggingIn(false);
    }
  };

  // 注册
  const handleRegister = async () => {
    if (!usernameInput.trim()) {
      Alert.alert('提示', '请输入用户名');
      return;
    }
    if (!passwordInput.trim()) {
      Alert.alert('提示', '请输入密码');
      return;
    }
    if (passwordInput.trim().length < 6) {
      Alert.alert('提示', '密码至少6个字符');
      return;
    }
    
    setLoggingIn(true);
    
    try {
      const result = await register(usernameInput.trim(), passwordInput.trim());
      
      if (result.success) {
        setShowLoginModal(false);
        setUsernameInput('');
        setPasswordInput('');
        Alert.alert('注册成功', `账号 "${usernameInput.trim()}" 创建成功！`);
      } else {
        Alert.alert('错误', result.error || '注册失败');
      }
    } catch (error) {
      console.error('注册失败:', error);
      Alert.alert('错误', '网络错误，请稍后重试');
    } finally {
      setLoggingIn(false);
    }
  };

  // 退出登录
  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('确定要退出登录吗？')) {
        logout();
      }
    } else {
      Alert.alert('退出登录', '确定要退出登录吗？', [
        { text: '取消', style: 'cancel' },
        { text: '确定', style: 'destructive', onPress: () => logout() }
      ]);
    }
  };

  // 隐藏的管理员入口：连续点击5次触发
  const handleSecretTap = () => {
    const now = Date.now();
    
    // 如果超过2秒，重置计数
    if (now - lastClickTimeRef.current > CLICK_TIMEOUT) {
      clickCountRef.current = 0;
    }
    
    clickCountRef.current += 1;
    lastClickTimeRef.current = now;
    
    // 达到5次，显示管理员登录弹窗
    if (clickCountRef.current >= CLICK_THRESHOLD) {
      clickCountRef.current = 0;
      setShowAdminModal(true);
    }
  };

  // 管理员登录
  const handleAdminLogin = async () => {
    if (!adminPasswordInput.trim()) {
      Alert.alert('提示', '请输入管理员密码');
      return;
    }
    
    setAdminLoggingIn(true);
    
    try {
      const response = await fetch(buildApiUrl('/api/v1/admin/verify-admin-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPasswordInput }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setShowAdminModal(false);
        setAdminPasswordInput('');
        router.push('/admin');
      } else {
        Alert.alert('错误', result.error || '管理员密码错误');
      }
    } catch (error) {
      console.error('验证管理员密码失败:', error);
      Alert.alert('错误', '网络错误，请稍后重试');
    } finally {
      setAdminLoggingIn(false);
    }
  };

  const getBookIcon = (level: string): string => {
    switch (level.toLowerCase()) {
      case 'cet-4':
      case '四级':
        return 'book-open';
      case 'cet-6':
      case '六级':
        return 'graduation-cap';
      case 'ielts':
      case '雅思':
        return 'globe';
      case 'toefl':
      case '托福':
        return 'plane';
      default:
        return 'bookmark';
    }
  };

  const getLevelColor = (level: string) => {
    const levelMap: Record<string, keyof typeof LevelColors> = {
      '四级': '四级',
      '六级': '六级',
      '雅思': '雅思',
      '托福': '托福',
      'cet-4': '四级',
      'cet-6': '六级',
      'ielts': '雅思',
      'toefl': '托福',
    };
    return LevelColors[levelMap[level.toLowerCase()]] || LevelColors.default;
  };

  if (loading || authLoading) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle="light">
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText variant="body" color={theme.textMuted} style={{ marginTop: 16 }}>
            加载中...
          </ThemedText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle="light">
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
        }
      >
        {/* 头部区域 */}
        <ThemedView level="root" style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerText}>
              <ThemedText variant="h2" style={styles.headerTitle}>
                看小说背单词
              </ThemedText>
              <ThemedText variant="body" style={styles.headerSubtitle}>
                在故事中轻松掌握词汇
              </ThemedText>
            </View>
            <TouchableOpacity style={styles.uploadButton} onPress={handleUploadPress} activeOpacity={0.8}>
              <FontAwesome6 name="cloud-arrow-up" size={16} color="#FFFFFF" />
              <ThemedText variant="smallMedium" style={styles.uploadButtonText}>上传</ThemedText>
            </TouchableOpacity>
          </View>
        </ThemedView>

        {/* 内容区域 */}
        <View style={styles.content}>
          {/* 用户状态区域 */}
          <View style={styles.userArea}>
            {user ? (
              <View style={styles.userInfoRow}>
                <View style={styles.userInfo}>
                  <FontAwesome6 name="user-circle" size={20} color={theme.primary} />
                  <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.username}>
                    {user.username}
                  </ThemedText>
                </View>
                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                  <ThemedText variant="small" color={theme.textMuted}>退出</ThemedText>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.loginPrompt} onPress={() => setShowLoginModal(true)}>
                <FontAwesome6 name="right-to-bracket" size={16} color={theme.primary} />
                <ThemedText variant="body" style={{ color: theme.primary, marginLeft: 8 }}>
                  登录 / 注册
                </ThemedText>
              </TouchableOpacity>
            )}
          </View>
          
          <View style={styles.grid}>
            {books.map((book) => {
              const levelColor = getLevelColor(book.level);
              return (
                <TouchableOpacity
                  key={book.id}
                  style={styles.card}
                  onPress={() => handleBookPress(book.id)}
                  activeOpacity={0.85}
                >
                  <View style={styles.cardHeader}>
                    <View style={[styles.iconContainer, { backgroundColor: levelColor.light }]}>
                      <FontAwesome6
                        name={getBookIcon(book.level)}
                        size={24}
                        color={levelColor.bg}
                      />
                    </View>
                    <View style={styles.cardTitle}>
                      <ThemedText variant="h3" color={theme.textPrimary}>
                        {book.name}
                      </ThemedText>
                      <View style={[styles.levelBadge, { backgroundColor: levelColor.light }]}>
                        <ThemedText variant="caption" style={[styles.levelBadgeText, { color: levelColor.dark }]}>
                          {book.level}
                        </ThemedText>
                      </View>
                    </View>
                  </View>
                  
                  {book.description && (
                    <ThemedText variant="small" color={theme.textSecondary} style={styles.cardDescription}>
                      {book.description}
                    </ThemedText>
                  )}

                  <View style={styles.cardStats}>
                    <View style={styles.statItem}>
                      <ThemedText variant="stat" style={styles.statValue}>
                        {book.total_words.toLocaleString()}
                      </ThemedText>
                      <ThemedText variant="caption" color={theme.textMuted} style={styles.statLabel}>
                        词汇
                      </ThemedText>
                    </View>
                    <View style={styles.statItem}>
                      <ThemedText variant="stat" style={styles.statValue}>
                        20+
                      </ThemedText>
                      <ThemedText variant="caption" color={theme.textMuted} style={styles.statLabel}>
                        小说
                      </ThemedText>
                    </View>
                    <View style={[styles.iconContainer, { backgroundColor: theme.backgroundTertiary, width: 44, height: 44, marginRight: 0 }]}>
                      <FontAwesome6 name="arrow-right" size={18} color={theme.primary} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          
          {/* 隐藏的管理员入口 - 连续点击5次触发 */}
          <TouchableOpacity 
            style={styles.secretArea} 
            onPress={handleSecretTap}
            activeOpacity={1}
          >
            <ThemedText variant="caption" color={theme.textMuted}>
              v1.0.0
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ScrollView>
      
      {/* 登录/注册弹窗 */}
      <Modal
        visible={showLoginModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLoginModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowLoginModal(false)}
        >
          <TouchableOpacity 
            style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]} 
            activeOpacity={1}
            onPress={() => {}}
          >
            <View style={[styles.modalIconContainer, { backgroundColor: theme.primary + '15' }]}>
              <FontAwesome6 name={isRegisterMode ? "user-plus" : "right-to-bracket"} size={32} color={theme.primary} />
            </View>
            
            <ThemedText style={styles.modalTitle}>{isRegisterMode ? '注册账号' : '登录账号'}</ThemedText>
            
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundTertiary, color: theme.textPrimary }]}
              placeholder="用户名（2-20字符）"
              placeholderTextColor={theme.textMuted}
              value={usernameInput}
              onChangeText={setUsernameInput}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
            />
            
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundTertiary, color: theme.textPrimary }]}
              placeholder="密码（6-20字符）"
              placeholderTextColor={theme.textMuted}
              value={passwordInput}
              onChangeText={setPasswordInput}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
            />
            
            <ThemedText variant="caption" color={theme.textMuted} style={styles.modalHint}>
              用户名支持中文、英文、数字、下划线
            </ThemedText>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonCancel]} 
                onPress={() => {
                  setShowLoginModal(false);
                  setUsernameInput('');
                  setPasswordInput('');
                  setIsRegisterMode(false);
                }}
              >
                <ThemedText variant="body" color={theme.textSecondary}>取消</ThemedText>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonSecondary, { borderColor: theme.primary }]} 
                onPress={() => setIsRegisterMode(!isRegisterMode)}
              >
                <ThemedText variant="body" color={theme.primary}>{isRegisterMode ? '去登录' : '去注册'}</ThemedText>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonConfirm, { backgroundColor: theme.primary }]} 
                onPress={isRegisterMode ? handleRegister : handleLogin}
                disabled={loggingIn || !usernameInput.trim() || !passwordInput.trim()}
              >
                {loggingIn ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <ThemedText variant="bodyMedium" style={styles.modalButtonTextLight}>{isRegisterMode ? '注册' : '登录'}</ThemedText>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
      
      {/* 管理员登录弹窗 */}
      <Modal
        visible={showAdminModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAdminModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowAdminModal(false)}
        >
          <TouchableOpacity 
            style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]} 
            activeOpacity={1}
            onPress={() => {}}
          >
            <View style={[styles.modalIconContainer, { backgroundColor: theme.primary + '15' }]}>
              <FontAwesome6 name="shield-halved" size={32} color={theme.primary} />
            </View>
            
            <ThemedText style={styles.modalTitle}>管理员登录</ThemedText>
            
            <ThemedText variant="caption" color={theme.textSecondary} style={styles.modalMessage}>
              请输入管理员密码
            </ThemedText>
            
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundTertiary, color: theme.textPrimary }]}
              placeholder="请输入管理员密码"
              placeholderTextColor={theme.textMuted}
              value={adminPasswordInput}
              onChangeText={setAdminPasswordInput}
              secureTextEntry
              autoCapitalize="none"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonCancel]} 
                onPress={() => {
                  setShowAdminModal(false);
                  setAdminPasswordInput('');
                }}
              >
                <ThemedText variant="body" color={theme.textSecondary}>取消</ThemedText>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonConfirm, { backgroundColor: theme.primary }]} 
                onPress={handleAdminLogin}
                disabled={adminLoggingIn || !adminPasswordInput.trim()}
              >
                {adminLoggingIn ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <ThemedText variant="bodyMedium" style={styles.modalButtonTextLight}>登录</ThemedText>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </Screen>
  );
}
