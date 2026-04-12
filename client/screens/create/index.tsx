import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  ScrollView, 
  TextInput, 
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
import { useAuth } from '@/contexts/AuthContext';
import { createStyles } from './styles';
import { buildApiUrl } from '@/utils/api';
import { FontAwesome6 } from '@expo/vector-icons';

interface VocabBook {
  id: string;
  name: string;
  level: string;
  total_words: number;
}

interface Genre {
  name: string;
  desc: string;
}

export default function CreateScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const params = useSafeSearchParams<{ book_id?: string }>();
  const { user } = useAuth();

  const [books, setBooks] = useState<VocabBook[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedBookId, setSelectedBookId] = useState('');
  const [protagonist, setProtagonist] = useState('');
  const [plot, setPlot] = useState('');
  const [keywords, setKeywords] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const [showBookPicker, setShowBookPicker] = useState(false);
  const [showGenrePicker, setShowGenrePicker] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // 获取词库列表
  useEffect(() => {
    const fetchBooks = async () => {
      try {
        const response = await fetch(buildApiUrl('/api/v1/vocab-books'));
        const result = await response.json();
        if (result.data) {
          setBooks(result.data);
          // 优先使用传入的 book_id，否则默认选中第一个
          if (params.book_id && result.data.find((b: VocabBook) => b.id === params.book_id)) {
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
  }, [params.book_id]);

  // 获取小说类型列表
  useEffect(() => {
    const fetchGenres = async () => {
      try {
        const response = await fetch(buildApiUrl('/api/v1/novels/genres/list'));
        const result = await response.json();
        if (result.data) {
          setGenres(result.data);
        }
      } catch (error) {
        console.error('获取类型失败:', error);
        setGenres([
          { name: '都市言情', desc: '现代都市背景的爱情故事' },
          { name: '悬疑推理', desc: '充满悬念和谜团的推理故事' },
          { name: '科幻未来', desc: '未来科技和太空探索的故事' },
          { name: '历史穿越', desc: '穿越到古代的奇幻冒险' },
          { name: '奇幻魔法', desc: '魔法世界的奇幻冒险' },
          { name: '校园青春', desc: '校园生活中的青春故事' },
        ]);
      }
    };

    fetchGenres();
  }, []);

  const selectedBook = books.find(b => b.id === selectedBookId);
  const selectedGenreInfo = genres.find(g => g.name === selectedGenre);

  const handleGenerate = async () => {
    if (!selectedBookId) {
      Alert.alert('提示', '请选择词库');
      return;
    }

    if (!user) {
      Alert.alert('提示', '请先登录');
      return;
    }

    const bookId = selectedBookId;
    const currentUser = user;
    const currentProtagonist = protagonist;
    const currentPlot = plot;
    const currentKeywords = keywords;
    const currentGenre = selectedGenre;

    // 显示成功提示
    setToastMessage('创作请求已提交');
    setToastVisible(true);

    // 延迟跳转，让用户看到提示
    setTimeout(() => {
      router.navigate('/novels', { book_id: bookId });
    }, 500);

    // 后台异步提交
    fetch(buildApiUrl('/api/v1/novels/generate'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        book_id: bookId,
        user_id: currentUser.id,
        protagonist: currentProtagonist || undefined,
        plot: currentPlot || '一个充满挑战和成长的故事',
        keywords: currentKeywords || undefined,
        genre: currentGenre || undefined,
      }),
    }).catch(error => {
      console.error('提交失败:', error);
    });
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
            创作小说
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary}>
            填写以下信息，AI将为您生成专属小说
          </ThemedText>
        </View>

        {/* 词库选择 */}
        <View style={styles.section}>
          <ThemedText variant="bodyMedium" style={styles.label}>
            选择词库 <Text style={styles.required}>*</Text>
          </ThemedText>
          <TouchableOpacity 
            style={styles.picker}
            onPress={() => !generating && setShowBookPicker(!showBookPicker)}
            disabled={generating}
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
          
          {showBookPicker && !generating && (
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

        {/* 主角名字 */}
        <View style={styles.section}>
          <ThemedText variant="bodyMedium" style={styles.label}>
            主角名字
          </ThemedText>
          <TextInput
            style={styles.input}
            placeholder="例如：李明、小雨..."
            placeholderTextColor={theme.textMuted}
            value={protagonist}
            onChangeText={setProtagonist}
            maxLength={20}
            editable={!generating}
          />
          <ThemedText variant="small" color={theme.textMuted} style={styles.hint}>
            留空将使用默认名字
          </ThemedText>
        </View>

        {/* 情节设定 */}
        <View style={styles.section}>
          <ThemedText variant="bodyMedium" style={styles.label}>
            情节设定
          </ThemedText>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="描述你想要的故事情节、背景设定、特殊元素等..."
            placeholderTextColor={theme.textMuted}
            value={plot}
            onChangeText={setPlot}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            editable={!generating}
          />
          <ThemedText variant="small" color={theme.textMuted} style={styles.hint}>
            例如：一个职场新人通过努力最终成为CEO的故事
          </ThemedText>
        </View>

        {/* 关键词 */}
        <View style={styles.section}>
          <ThemedText variant="bodyMedium" style={styles.label}>
            关键词
          </ThemedText>
          <TextInput
            style={styles.input}
            placeholder="输入关键词，用逗号分隔..."
            placeholderTextColor={theme.textMuted}
            value={keywords}
            onChangeText={setKeywords}
            maxLength={50}
            editable={!generating}
          />
          <ThemedText variant="small" color={theme.textMuted} style={styles.hint}>
            例如：穿越、复仇、逆袭（最多50字）
          </ThemedText>
        </View>

        {/* 小说类型 */}
        <View style={styles.section}>
          <ThemedText variant="bodyMedium" style={styles.label}>
            小说类型
          </ThemedText>
          <TouchableOpacity 
            style={styles.picker}
            onPress={() => !generating && setShowGenrePicker(!showGenrePicker)}
            disabled={generating}
          >
            <Text style={styles.pickerText}>
              {selectedGenre || '随机选择'}
            </Text>
            <Text style={styles.pickerHint}>
              {selectedGenreInfo?.desc || 'AI将随机选择类型'}
            </Text>
            <FontAwesome6 
              name={showGenrePicker ? "chevron-up" : "chevron-down"} 
              size={16} 
              color={theme.textMuted} 
            />
          </TouchableOpacity>
          
          {showGenrePicker && !generating && (
            <View style={styles.pickerOptions}>
              <TouchableOpacity
                style={[
                  styles.pickerOption,
                  !selectedGenre && styles.pickerOptionSelected
                ]}
                onPress={() => {
                  setSelectedGenre('');
                  setShowGenrePicker(false);
                }}
              >
                <Text style={[
                  styles.pickerOptionText,
                  !selectedGenre && styles.pickerOptionTextSelected
                ]}>
                  随机选择
                </Text>
                <Text style={styles.pickerOptionHint}>
                  AI将随机选择类型
                </Text>
              </TouchableOpacity>
              {genres.map((genre) => (
                <TouchableOpacity
                  key={genre.name}
                  style={[
                    styles.pickerOption,
                    genre.name === selectedGenre && styles.pickerOptionSelected
                  ]}
                  onPress={() => {
                    setSelectedGenre(genre.name);
                    setShowGenrePicker(false);
                  }}
                >
                  <Text style={[
                    styles.pickerOptionText,
                    genre.name === selectedGenre && styles.pickerOptionTextSelected
                  ]}>
                    {genre.name}
                  </Text>
                  <Text style={styles.pickerOptionHint}>
                    {genre.desc}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* 生成按钮 */}
        <TouchableOpacity
          style={[styles.generateButton, (!selectedBookId || generating) && styles.generateButtonDisabled]}
          onPress={handleGenerate}
          disabled={!selectedBookId || generating}
        >
          {generating ? (
            <View style={styles.generatingContainer}>
              <ActivityIndicator size="small" color={theme.buttonPrimaryText} />
              <Text style={styles.generateButtonText}>{progress || '提交中...'}</Text>
            </View>
          ) : (
            <>
              <FontAwesome6 name="wand-magic-sparkles" size={20} color={theme.buttonPrimaryText} />
              <Text style={styles.generateButtonText}>开始创作</Text>
            </>
          )}
        </TouchableOpacity>

        {/* 提示信息 */}
        <View style={styles.tips}>
          <ThemedText variant="small" color={theme.textMuted}>
            💡 提示：小说将在后台生成，提交后可返回列表页查看进度
          </ThemedText>
        </View>
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
