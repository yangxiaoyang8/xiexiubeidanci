import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius } from '@/constants/theme';
import { 
  playWordAudio,
  stopCurrentAudio,
} from '@/utils/audioCache';

interface WordPopupProps {
  visible: boolean;
  word: string;
  meaning: string;
  phonetic?: string;
  partOfSpeech?: string;
  bookId?: string;
  onClose: () => void;
}

export const WordPopup: React.FC<WordPopupProps> = ({ 
  visible, 
  word, 
  meaning, 
  phonetic, 
  partOfSpeech, 
  bookId,
  onClose,
}) => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);

  // 关闭弹窗时停止音频播放
  useEffect(() => {
    if (!visible) {
      // 停止全局音频实例
      stopCurrentAudio();
      setPlaying(false);
      setLoading(false);
    }
  }, [visible]);

  const handlePlayAudio = async () => {
    if (playing || loading) return;
    
    try {
      setLoading(true);
      
      // 使用按需获取音频
      const result = await playWordAudio(bookId || '', word, meaning);
      
      if (result.success) {
        setPlaying(true);
        // 播放完成后重置状态（约2秒）
        setTimeout(() => {
          setPlaying(false);
        }, 2000);
      } else {
        Alert.alert('播放失败', result.error || '无法播放音频');
      }
    } catch (error) {
      console.error('播放音频失败:', error);
      Alert.alert('播放失败', '网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity activeOpacity={1} style={[styles.popup, { backgroundColor: theme.backgroundDefault }]}>
          {/* 关闭按钮 */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
            <View style={[styles.closeIcon, { backgroundColor: theme.backgroundTertiary }]}>
              <FontAwesome6 name="xmark" size={14} color={theme.textMuted} />
            </View>
          </TouchableOpacity>

          {/* 单词区域 */}
          <View style={styles.header}>
            <View style={styles.wordRow}>
              <Text style={[styles.word, { color: theme.primary }]}>{word}</Text>
              {partOfSpeech && (
                <View style={[styles.partOfSpeechBadge, { backgroundColor: theme.primary + '15' }]}>
                  <Text style={[styles.partOfSpeech, { color: theme.primary }]}>{partOfSpeech}</Text>
                </View>
              )}
            </View>
            {phonetic && (
              <Text style={[styles.phonetic, { color: theme.textMuted }]}>
                {phonetic.startsWith('/') && phonetic.endsWith('/') 
                  ? phonetic 
                  : phonetic.startsWith('/') 
                    ? phonetic 
                    : `/${phonetic}/`}
              </Text>
            )}
          </View>

          {/* 分割线 */}
          <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />

          {/* 释义区域 */}
          <View style={styles.meaningContainer}>
            <Text style={[styles.meaning, { color: theme.textPrimary }]}>{meaning}</Text>
          </View>

          {/* 发音按钮 */}
          <TouchableOpacity
            style={[styles.audioButton, { backgroundColor: theme.primary }]}
            onPress={handlePlayAudio}
            disabled={loading || playing}
            activeOpacity={0.85}
          >
            {loading || playing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <View style={styles.audioIconWrapper}>
                  <FontAwesome6 name="volume-high" size={18} color="#FFFFFF" />
                </View>
                <Text style={styles.audioText}>点击朗读</Text>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  popup: {
    width: '100%',
    maxWidth: 340,
    borderRadius: BorderRadius['2xl'],
    padding: Spacing['2xl'],
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  closeButton: {
    position: 'absolute',
    top: Spacing.lg,
    right: Spacing.lg,
    zIndex: 1,
  },
  closeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  word: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 1,
  },
  partOfSpeechBadge: {
    marginLeft: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  partOfSpeech: {
    fontSize: 13,
    fontWeight: '600',
  },
  phonetic: {
    fontSize: 17,
    fontStyle: 'italic',
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    marginBottom: Spacing.xl,
  },
  meaningContainer: {
    marginBottom: Spacing['2xl'],
    minHeight: 60,
    justifyContent: 'center',
  },
  meaning: {
    fontSize: 18,
    textAlign: 'center',
    lineHeight: 28,
    letterSpacing: 0.3,
  },
  audioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing['2xl'],
    borderRadius: BorderRadius.xl,
    gap: Spacing.sm,
  },
  audioIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});
