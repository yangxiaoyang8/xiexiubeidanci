import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Text, Alert, Platform, Modal, TextInput } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Screen } from '@/components/Screen';
import { SwipeableNovelCard } from '@/components/SwipeableNovelCard';
import { CreateOptionModal } from '@/components/CreateOptionModal';
import { useTheme } from '@/hooks/useTheme';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesome6 } from '@expo/vector-icons';
import { createStyles } from './styles';
import { buildApiUrl } from '@/utils/api';

// 允许生成小说的词库ID（四级和雅思）
const ALLOWED_GENERATE_BOOK_IDS = [
  '487b402f-0a7e-4b6d-a593-ba4d9e2c8bf5', // 四级
  '8b86bc59-13e5-4c56-be91-4a9d106ebf57', // 雅思
];

interface Novel {
  id: string;
  title: string;
  summary: string | null;
  cover_image: string | null;
  chapter_count: number;
  word_count: number;
  is_user_uploaded: boolean;
  created_at: string;
  generate_status?: 'generating' | 'completed' | 'failed';
}

// 解析 summary 字段
const parseSummary = (summary: string | null) => {
  if (!summary) return null;
  const parts = summary.split('|').map(s => s.trim());
  return {
    genre: parts[0] || '',
    protagonist: parts[1] || '',
    wordInfo: parts[2] || '',
    vocabInfo: parts[3] || '',
  };
};

export default function NovelsScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const params = useSafeSearchParams<{ book_id: string }>();
  const bookId = params.book_id;
  const { user } = useAuth();

  const [novels, setNovels] = useState<Novel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  
  // 生成次数限制
  const [generateLimit, setGenerateLimit] = useState<{ remaining: number; limit: number; isVip?: boolean } | null>(null);
  
  // 解锁弹窗
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlocking, setUnlocking] = useState(false);

  const fetchNovels = useCallback(async () => {
    if (!bookId || !user) return;
    
    try {
      const response = await fetch(buildApiUrl(`/api/v1/novels?book_id=${bookId}&user_id=${user.id}`));
      const result = await response.json();
      
      if (result.data) {
        setNovels(result.data);
      }
    } catch (error) {
      console.error('获取小说列表失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [bookId, user]);

  // 轮询检查生成中的小说状态
  useEffect(() => {
    const hasGenerating = novels.some(n => n.generate_status === 'generating');
    
    if (!hasGenerating) return;
    
    const pollInterval = setInterval(() => {
      fetchNovels();
    }, 3000); // 每3秒检查一次
    
    return () => clearInterval(pollInterval);
  }, [novels, fetchNovels]);

  // 检测生成完成，显示提示
  const prevGeneratingCount = React.useRef(0);
  useEffect(() => {
    const generatingCount = novels.filter(n => n.generate_status === 'generating').length;
    
    // 如果之前有生成中的小说，现在数量变少了，说明有小说完成了
    if (prevGeneratingCount.current > 0 && generatingCount < prevGeneratingCount.current) {
      if (Platform.OS === 'web') {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('小说生成完成', { body: '您的小说已经生成完毕，快来阅读吧！' });
        }
      }
    }
    
    prevGeneratingCount.current = generatingCount;
  }, [novels]);

  // 获取生成次数限制
  const fetchGenerateLimit = useCallback(async () => {
    if (!user) return;
    
    try {
      const response = await fetch(buildApiUrl(`/api/v1/novels/generate-limit?user_id=${user.id}`));
      const result = await response.json();
      
      if (result.data) {
        setGenerateLimit(result.data);
      }
    } catch (error) {
      console.error('获取生成次数失败:', error);
    }
  }, [user]);

  useEffect(() => {
    fetchNovels();
    fetchGenerateLimit();
  }, [fetchNovels, fetchGenerateLimit]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchNovels();
    fetchGenerateLimit();
  };

  const handleNovelPress = (novelId: string) => {
    router.push('/reader', { novel_id: novelId });
  };

  const handleFabPress = () => {
    setShowPasswordModal(true);
  };

  const handleCustomCreate = () => {
    setShowPasswordModal(false);
    router.push('/create', { book_id: bookId });
  };

  const handlePasswordSuccess = async () => {
    setShowPasswordModal(false);
    
    if (!bookId || !user) return;
    
    setGenerating(true);
    try {
      await fetch(buildApiUrl('/api/v1/novels/generate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_id: bookId, theme: '爱情故事', user_id: user.id }),
      });
      setTimeout(() => {
        fetchNovels();
        fetchGenerateLimit();
      }, 1000);
    } catch (error) {
      console.error('生成小说失败:', error);
    } finally {
      setGenerating(false);
    }
  };

  // 解锁生成次数
  const handleUnlock = async () => {
    if (!unlockPassword.trim() || !user) {
      return;
    }
    
    setUnlocking(true);
    try {
      const response = await fetch(buildApiUrl('/api/v1/novels/unlock'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, password: unlockPassword }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setShowUnlockModal(false);
        setUnlockPassword('');
        fetchGenerateLimit();
        Alert.alert('解锁成功', '生成次数已重置', [{ text: '确定' }]);
      } else {
        Alert.alert('解锁失败', result.error || '授权密码错误', [{ text: '确定' }]);
      }
    } catch (error) {
      console.error('解锁失败:', error);
      Alert.alert('解锁失败', '网络错误', [{ text: '确定' }]);
    } finally {
      setUnlocking(false);
    }
  };

  const canGenerate = ALLOWED_GENERATE_BOOK_IDS.includes(bookId || '');

  if (loading) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle="light">
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
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
          <View style={styles.headerContent}>
            <TouchableOpacity style={styles.backButton} onPress={() => {
              router.replace('/');
            }} activeOpacity={0.8}>
              <FontAwesome6 name="arrow-left" size={18} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.headerText}>
              <ThemedText style={styles.headerTitle}>小说列表</ThemedText>
              <ThemedText style={styles.headerSubtitle}>{novels.length} 篇小说</ThemedText>
            </View>
          </View>
        </ThemedView>

        {/* 内容区域 */}
        <View style={styles.content}>
          {novels.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIcon}>
                <FontAwesome6 name="book-open" size={32} color={theme.textMuted} />
              </View>
              <ThemedText variant="body" color={theme.textMuted} style={styles.emptyText}>
                {canGenerate ? '暂无小说\n点击右下角按钮生成' : '暂无小说'}
              </ThemedText>
            </View>
          ) : (
            novels.map((novel) => {
              const info = parseSummary(novel.summary);
              const isGenerating = novel.generate_status === 'generating';
              const isFailed = novel.generate_status === 'failed';
              
              return (
                <SwipeableNovelCard
                  key={novel.id}
                  id={novel.id}
                  title={novel.title}
                  summary={novel.summary}
                  created_at={novel.created_at}
                  onPress={() => !isGenerating && !isFailed && handleNovelPress(novel.id)}
                  onDelete={() => {
                    if (!user) return;
                    const userId = user.id;
                    // 乐观更新：立即从本地列表移除
                    setNovels(prev => prev.filter(n => n.id !== novel.id));
                    // 后台异步删除
                    fetch(`${buildApiUrl(`/api/v1/novels/${novel.id}`)}?user_id=${userId}`, {
                      method: 'DELETE',
                    }).catch(err => {
                      console.error('删除失败:', err);
                      // 删除失败时重新获取
                      fetchNovels();
                    });
                  }}
                  disabled={isGenerating || isFailed}
                >
                  <View style={[styles.card, (isGenerating || isFailed) && { opacity: 0.7 }]}>
                    <View style={styles.cardContent}>
                      <View style={styles.cardTitleRow}>
                        {isGenerating ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <ActivityIndicator size="small" color={theme.primary} />
                            <ThemedText variant="body" color={theme.primary} style={styles.cardTitle}>
                              正在生成中...
                            </ThemedText>
                          </View>
                        ) : isFailed ? (
                          <ThemedText variant="body" color={theme.error} style={styles.cardTitle}>
                            生成失败
                          </ThemedText>
                        ) : (
                          <ThemedText variant="body" color={theme.textSecondary} style={styles.cardTitle}>
                            {novel.title}
                          </ThemedText>
                        )}
                        {novel.is_user_uploaded && !isGenerating && !isFailed && (
                          <ThemedText variant="labelSmall" color={theme.textMuted} style={styles.uploadBadge}>
                            本地上传
                          </ThemedText>
                        )}
                      </View>
                      
                      {isGenerating && (
                        <ThemedText variant="caption" color={theme.textMuted}>
                          AI正在创作中，请稍候...
                        </ThemedText>
                      )}
                      
                      {isFailed && (
                        <ThemedText variant="caption" color={theme.textMuted}>
                          请删除后重试
                        </ThemedText>
                      )}
                      
                      {!isGenerating && !isFailed && info && (
                        <View style={styles.tagRow}>
                          {info.genre && (
                            <View style={[styles.tag, { backgroundColor: theme.primary + '15' }]}>
                              <ThemedText variant="caption" color={theme.primary}>{info.genre}</ThemedText>
                            </View>
                          )}
                          {info.protagonist && (
                            <View style={[styles.tag, { backgroundColor: theme.accent + '15' }]}>
                              <FontAwesome6 name="user" size={10} color={theme.accent} />
                              <ThemedText variant="caption" color={theme.accent} style={styles.tagText}>{info.protagonist}</ThemedText>
                            </View>
                          )}
                        </View>
                      )}
                      
                      {!isGenerating && !isFailed && (
                        <View style={styles.statsRow}>
                          {info?.wordInfo && (
                            <View style={styles.statItem}>
                              <View style={[styles.statIcon, { backgroundColor: theme.primary + '15' }]}>
                                <FontAwesome6 name="file-lines" size={14} color={theme.primary} />
                              </View>
                              <View>
                                <ThemedText style={styles.statValue}>{info.wordInfo}</ThemedText>
                              </View>
                            </View>
                          )}
                          {info?.vocabInfo && (
                            <View style={styles.statItem}>
                              <View style={[styles.statIcon, { backgroundColor: theme.accent + '15' }]}>
                                <FontAwesome6 name="book" size={14} color={theme.accent} />
                              </View>
                              <View>
                                <ThemedText style={styles.statValue}>{info.vocabInfo}</ThemedText>
                              </View>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  </View>
                </SwipeableNovelCard>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* 生成按钮/解锁按钮 */}
      {canGenerate && (
        <>
          <TouchableOpacity 
            style={styles.fab} 
            onPress={generateLimit?.remaining === 0 ? () => setShowUnlockModal(true) : handleFabPress} 
            disabled={generating} 
            activeOpacity={0.85}
          >
            <FontAwesome6 
              name={generateLimit?.remaining === 0 ? 'key' : (generating ? 'spinner' : 'plus')} 
              size={24} 
              color="#FFFFFF" 
            />
          </TouchableOpacity>
          {generateLimit && (
            <TouchableOpacity 
              style={[styles.fabBadge, { 
                backgroundColor: generateLimit.isVip ? '#10B981' : (generateLimit.remaining > 0 ? theme.primary : '#EF4444')
              }]}
              onPress={() => !generateLimit.isVip && generateLimit.remaining === 0 && setShowUnlockModal(true)}
            >
              <Text style={styles.fabBadgeText}>
                {generateLimit.isVip ? 'VIP' : `${generateLimit.remaining}/${generateLimit.limit}`}
              </Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {/* 创作选项弹窗 */}
      <CreateOptionModal
        visible={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        onQuickCreate={handlePasswordSuccess}
        onCustomCreate={handleCustomCreate}
      />
      
      {/* 解锁弹窗 */}
      <Modal
        visible={showUnlockModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUnlockModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowUnlockModal(false)}
        >
          <TouchableOpacity 
            style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]} 
            activeOpacity={1}
            onPress={() => {}}
          >
            <View style={[styles.modalIconContainer, { backgroundColor: '#FEF3C7' }]}>
              <FontAwesome6 name="key" size={32} color="#D97706" />
            </View>
            
            <ThemedText style={styles.modalTitle}>解锁生成次数</ThemedText>
            
            <ThemedText variant="caption" color={theme.textSecondary} style={styles.modalMessage}>
              输入授权密码可重置生成次数
            </ThemedText>
            
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundTertiary, color: theme.textPrimary }]}
              placeholder="请输入授权密码"
              placeholderTextColor={theme.textMuted}
              value={unlockPassword}
              onChangeText={setUnlockPassword}
              secureTextEntry
              autoCapitalize="none"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonCancel]} 
                onPress={() => {
                  setShowUnlockModal(false);
                  setUnlockPassword('');
                }}
              >
                <Text style={[styles.modalButtonText, { color: theme.textSecondary }]}>取消</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonConfirm, { backgroundColor: theme.primary }]} 
                onPress={handleUnlock}
                disabled={unlocking || !unlockPassword.trim()}
              >
                {unlocking ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalButtonTextLight}>确认解锁</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </Screen>
  );
}
