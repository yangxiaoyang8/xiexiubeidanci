import React, { useState, useMemo, useEffect } from 'react';
import { 
  View, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  Text,
  Alert,
  Platform
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { Screen } from '@/components/Screen';
import { Toast } from '@/components/Toast';
import { useTheme } from '@/hooks/useTheme';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { createStyles } from './styles';
import { buildApiUrl } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesome6 } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { createFormDataFile } from '@/utils';

interface VocabBook {
  id: string;
  name: string;
  level: string;
  total_words: number;
}

interface NovelPreview {
  title: string;
  genre: string;
  protagonist: string;
  wordCount: number;
  summary: string;
  isBilingual: boolean;  // 是否是英汉对照模式
  englishContent: string;  // 英文原文
  originalContent: string;
  processedContent: string;
  vocabularyCount: number;
  vocabulary: Array<{ word: string; meaning: string; phonetic: string; partOfSpeech: string }>;
  fullContent: string;
  allVocabulary: Array<{ word: string; meaning: string; phonetic: string; partOfSpeech: string }>;
  remainingUploads?: number;  // 剩余上传次数
}

interface UploadLimit {
  remaining: number;
  limit: number;
  isVip: boolean;
}

// 文件大小限制（200KB）
const MAX_FILE_SIZE_KB = 200;

export default function UploadScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const params = useSafeSearchParams<{ book_id?: string }>();
  const { user } = useAuth();

  const [books, setBooks] = useState<VocabBook[]>([]);
  const [selectedBookId, setSelectedBookId] = useState(params.book_id || '');
  const [showBookPicker, setShowBookPicker] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ name: string; uri: string; size: number } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [preview, setPreview] = useState<NovelPreview | null>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'saving'>('upload');
  const [uploadLimit, setUploadLimit] = useState<UploadLimit | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // 获取剩余上传次数
  const fetchUploadLimit = async () => {
    if (!user) return;
    try {
      const response = await fetch(buildApiUrl(`/api/v1/novel-upload/limit?user_id=${user.id}`));
      const result = await response.json();
      if (result.data) {
        setUploadLimit(result.data);
      }
    } catch (error) {
      console.error('获取上传次数失败:', error);
    }
  };

  // 页面加载时获取次数
  useEffect(() => {
    if (user) {
      fetchUploadLimit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // 获取词库列表
  useEffect(() => {
    const fetchBooks = async () => {
      try {
        const response = await fetch(buildApiUrl('/api/v1/vocab-books'));
        const result = await response.json();
        if (result.data) {
          setBooks(result.data);
          // 如果URL中有book_id参数，使用它；否则默认选择第一个
          if (params.book_id) {
            setSelectedBookId(params.book_id);
          } else if (result.data.length > 0) {
            setSelectedBookId(result.data[0].id);
          }
        }
      } catch (error) {
        console.error('获取词库失败:', error);
      }
    };

    fetchBooks();
  }, []);

  const selectedBook = books.find(b => b.id === selectedBookId);

  // 选择文件
  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'text/plain',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      setSelectedFile({
        name: file.name || '未命名.txt',
        uri: file.uri,
        size: file.size || 0,
      });
    } catch (error) {
      console.error('选择文件失败:', error);
      Alert.alert('错误', '选择文件失败，请重试');
    }
  };

  // 分析小说
  const handleAnalyze = async () => {
    if (!selectedFile) {
      Alert.alert('提示', '请先选择小说文件');
      return;
    }
    if (!selectedBookId) {
      Alert.alert('提示', '请选择词库');
      return;
    }
    
    // 检查文件大小（200KB限制）
    const fileSizeKB = selectedFile.size / 1024;
    if (fileSizeKB > MAX_FILE_SIZE_KB) {
      Alert.alert('文件过大', `文件大小限制为 ${MAX_FILE_SIZE_KB}KB，当前文件 ${(fileSizeKB).toFixed(1)}KB`);
      return;
    }
    
    // 检查上传次数
    if (uploadLimit && !uploadLimit.isVip && uploadLimit.remaining <= 0) {
      Alert.alert('上传次数已用完', '本周上传次数已用完，下周重置');
      return;
    }

    setAnalyzing(true);
    setStep('upload');

    try {
      // 创建 FormData
      const formData = new FormData();
      const file = await createFormDataFile(selectedFile.uri, selectedFile.name, 'text/plain');
      formData.append('file', file as any);
      formData.append('book_id', selectedBookId);
      formData.append('user_id', user!.id);

      /**
       * 服务端文件：server/src/routes/novel-upload.ts
       * 接口：POST /api/v1/novel-upload/analyze
       * Body 参数：file (FormData), book_id: string, user_id: string
       */
      const response = await fetch(buildApiUrl('/api/v1/novel-upload/analyze'), {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '分析失败');
      }

      setPreview(result.data);
      // 更新剩余上传次数
      if (result.data.remainingUploads !== undefined) {
        setUploadLimit(prev => prev ? { ...prev, remaining: result.data.remainingUploads } : null);
      }
      setStep('preview');
    } catch (error) {
      console.error('分析小说失败:', error);
      Alert.alert('错误', error instanceof Error ? error.message : '分析失败，请重试');
    } finally {
      setAnalyzing(false);
    }
  };

  // 保存小说
  const handleSave = async () => {
    if (!preview || !user) return;

    const bookId = selectedBookId;
    const title = preview.title;
    const savePreview = preview;
    const currentUser = user;

    // 显示成功提示
    setToastMessage('保存成功');
    setToastVisible(true);

    // 延迟跳转，让用户看到提示
    setTimeout(() => {
      router.navigate('/novels', { book_id: bookId });
    }, 500);

    // 后台异步保存
    fetch(buildApiUrl('/api/v1/novel-upload/save'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        book_id: bookId,
        title: title,
        genre: savePreview.genre,
        protagonist: savePreview.protagonist,
        content: savePreview.fullContent,
        vocabulary: savePreview.allVocabulary,
        english_content: savePreview.englishContent || null,
        user_id: currentUser.id,
      }),
    }).catch(error => {
      console.error('保存小说失败:', error);
    });
  };

  // 返回上传步骤
  const handleBack = () => {
    setPreview(null);
    setStep('upload');
  };

  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* 页面标题 */}
        <View style={styles.header}>
          <ThemedText variant="h2" style={styles.headerTitle}>
            上传小说
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary}>
            上传txt小说文件，AI将自动识别词汇并转换为学习格式
          </ThemedText>
          
          {/* 上传次数提示 */}
          {uploadLimit && (
            <View style={[styles.limitBanner, uploadLimit.isVip && styles.vipBanner]}>
              <FontAwesome6 
                name={uploadLimit.isVip ? "crown" : "paper-plane"} 
                size={14} 
                color={uploadLimit.isVip ? "#FFD700" : theme.textSecondary} 
              />
              <Text style={[styles.limitText, uploadLimit.isVip && styles.vipText]}>
                {uploadLimit.isVip 
                  ? 'VIP用户 · 无限上传' 
                  : `本周剩余上传次数：${uploadLimit.remaining}/${uploadLimit.limit}`
                }
              </Text>
            </View>
          )}
        </View>

        {step === 'upload' && (
          <>
            {/* 词库选择 */}
            <View style={styles.section}>
              <ThemedText variant="bodyMedium" style={styles.label}>
                选择词库 <Text style={styles.required}>*</Text>
              </ThemedText>
              <TouchableOpacity 
                style={styles.picker}
                onPress={() => !analyzing && setShowBookPicker(!showBookPicker)}
                disabled={analyzing}
              >
                <Text style={styles.pickerText}>
                  {selectedBook?.name || '请选择词库'}
                </Text>
                <Text style={styles.pickerHint}>
                  {selectedBook ? `${selectedBook.total_words} 个词汇` : ''}
                </Text>
                <FontAwesome6 
                  name={showBookPicker ? "chevron-up" : "chevron-down"} 
                  size={16} 
                  color={theme.textMuted} 
                />
              </TouchableOpacity>
              
              {showBookPicker && !analyzing && (
                <View style={styles.pickerOptions}>
                  {books.map((book) => (
                    <TouchableOpacity
                      key={book.id}
                      style={[
                        styles.pickerOption,
                        book.id === selectedBookId && styles.pickerOptionSelected
                      ]}
                      onPress={() => {
                        setSelectedBookId(book.id);
                        setShowBookPicker(false);
                      }}
                    >
                      <Text style={[
                        styles.pickerOptionText,
                        book.id === selectedBookId && styles.pickerOptionTextSelected
                      ]}>
                        {book.name}
                      </Text>
                      <Text style={styles.pickerOptionHint}>
                        {book.total_words} 词汇
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* 文件选择 */}
            <View style={styles.section}>
              <ThemedText variant="bodyMedium" style={styles.label}>
                选择小说文件
              </ThemedText>
              <TouchableOpacity style={styles.filePicker} onPress={handlePickFile}>
                <FontAwesome6 name="file-lines" size={32} color={theme.textMuted} />
                {selectedFile ? (
                  <View style={styles.fileInfo}>
                    <Text style={styles.fileName}>{selectedFile.name}</Text>
                    <Text style={styles.fileSize}>
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.fileHint}>点击选择 .txt 文件</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* 分析按钮 */}
            <TouchableOpacity
              style={[
                styles.analyzeButton, 
                (!selectedFile || !selectedBookId || analyzing) && styles.analyzeButtonDisabled
              ]}
              onPress={handleAnalyze}
              disabled={!selectedFile || !selectedBookId || analyzing}
            >
              {analyzing ? (
                <View style={styles.analyzingContainer}>
                  <ActivityIndicator size="small" color={theme.buttonPrimaryText} />
                  <Text style={styles.analyzeButtonText}>AI正在分析小说...</Text>
                </View>
              ) : (
                <>
                  <FontAwesome6 name="wand-magic-sparkles" size={20} color={theme.buttonPrimaryText} />
                  <Text style={styles.analyzeButtonText}>开始分析</Text>
                </>
              )}
            </TouchableOpacity>

            {/* 说明 */}
            <View style={styles.tips}>
              <ThemedText variant="smallMedium" color={theme.textSecondary} style={styles.tipsTitle}>
                📄 支持格式说明
              </ThemedText>
              <ThemedText variant="small" color={theme.textMuted} style={styles.tipsContent}>
                {'\n'}• 纯中文格式：直接上传中文小说，AI将智能匹配词库词汇{'\n'}{'\n'}
                • 英汉对照格式（推荐）：{'\n'}
                {'  '}===EN==={'\n'}
                {'  '}英文原文{'\n'}
                {'  '}===CN==={'\n'}
                {'  '}中文翻译{'\n'}{'\n'}
                {'  '}此格式可精确匹配词库词汇，覆盖率更高
              </ThemedText>
            </View>
          </>
        )}

        {step === 'preview' && preview && (
          <>
            {/* 预览标题 */}
            <View style={styles.previewHeader}>
              <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                <FontAwesome6 name="arrow-left" size={20} color={theme.textPrimary} />
              </TouchableOpacity>
              <ThemedText variant="h3" style={styles.previewTitle}>
                预览与编辑
              </ThemedText>
            </View>

            {/* 小说信息卡片 */}
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>小说标题</Text>
                <Text style={styles.infoValue}>{preview.title}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>类型</Text>
                <View style={styles.genreTag}>
                  <Text style={styles.genreText}>{preview.genre}</Text>
                </View>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>主角</Text>
                <Text style={styles.infoValue}>{preview.protagonist}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>字数</Text>
                <Text style={styles.infoValue}>{preview.wordCount.toLocaleString()} 字</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>词汇数</Text>
                <Text style={styles.infoValue}>{preview.vocabularyCount} 个</Text>
              </View>
            </View>

            {/* 词汇预览 */}
            <View style={styles.section}>
              <ThemedText variant="bodyMedium" style={styles.label}>
                词汇预览（前10个）
              </ThemedText>
              <View style={styles.vocabularyList}>
                {preview.vocabulary.slice(0, 10).map((v, i) => (
                  <View key={i} style={styles.vocabItem}>
                    <Text style={styles.vocabWord}>{v.word}</Text>
                    {v.partOfSpeech && (
                      <Text style={styles.vocabPos}>{v.partOfSpeech}</Text>
                    )}
                    <Text style={styles.vocabMeaning} numberOfLines={1}>
                      {v.meaning}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* 内容预览 */}
            <View style={styles.section}>
              <ThemedText variant="bodyMedium" style={styles.label}>
                内容预览
              </ThemedText>
              <View style={styles.contentPreview}>
                <Text style={styles.contentText} numberOfLines={8}>
                  {preview.processedContent}
                </Text>
              </View>
            </View>

            {/* 操作按钮 */}
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.editButton} onPress={handleBack}>
                <FontAwesome6 name="pen" size={18} color={theme.primary} />
                <Text style={styles.editButtonText}>重新分析</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <FontAwesome6 name="check" size={18} color={theme.buttonPrimaryText} />
                <Text style={styles.saveButtonText}>确认保存</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {step === 'saving' && (
          <View style={styles.savingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <ThemedText variant="body" color={theme.textSecondary} style={styles.savingText}>
              正在保存小说...
            </ThemedText>
          </View>
        )}
      </ScrollView>
      <Toast
        visible={toastVisible}
        message={toastMessage}
        type="success"
        duration={1500}
        onHide={() => setToastVisible(false)}
      />
    </Screen>
  );
}
