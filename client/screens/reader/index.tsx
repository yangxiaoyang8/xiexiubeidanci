import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, ScrollView, ActivityIndicator, TouchableOpacity, Text, Modal } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { Screen } from '@/components/Screen';
import { useTheme } from '@/hooks/useTheme';
import { useSafeSearchParams } from '@/hooks/useSafeRouter';
import { createStyles } from './styles';
import { WordPopup } from '@/components/WordPopup';
import { buildApiUrl } from '@/utils/api';

interface NovelData {
  id: string;
  title: string;
  content: string;
  book_id?: string;  // 词库ID
  english_content?: string;  // 英文原文（英汉对照模式）
  summary: string;
  word_count: number;
  novel_words: Array<{
    id: string;
    position: number;
    words: {
      id: string;
      word: string;
      phonetic: string;
      meaning: string;
    };
  }>;
}

interface VocabularyItem {
  word: string;
  meaning: string;
  phonetic: string;
  partOfSpeech: string;
}

export default function ReaderScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const params = useSafeSearchParams<{ novel_id: string }>();
  const novelId = params.novel_id;

  const [novel, setNovel] = useState<NovelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [vocabulary, setVocabulary] = useState<VocabularyItem[]>([]);
  
  // 英文面板状态
  const [showEnglish, setShowEnglish] = useState(false);
  const [currentParagraphIndex, setCurrentParagraphIndex] = useState(0);
  
  const scrollViewRef = useRef<ScrollView>(null);
  const englishScrollViewRef = useRef<ScrollView>(null);
  
  const [popupVisible, setPopupVisible] = useState(false);
  const [selectedWord, setSelectedWord] = useState('');
  const [selectedMeaning, setSelectedMeaning] = useState('');
  const [selectedPhonetic, setSelectedPhonetic] = useState('');
  const [selectedPartOfSpeech, setSelectedPartOfSpeech] = useState('');

  useEffect(() => {
    const fetchNovel = async () => {
      if (!novelId) return;
      
      try {
        const response = await fetch(buildApiUrl(`/api/v1/novels/${novelId}`));
        const result = await response.json();
        
        if (result.data) {
          setNovel(result.data);
          
          const vocabList = result.data.novel_words?.map((nw: any) => {
            let meaning = nw.words.meaning || '';
            const partMatch = meaning.match(/^\/?([a-z]+\.)\s*/i);
            const partOfSpeech = partMatch ? partMatch[1] : '';
            let cleanMeaning = partMatch ? meaning.substring(partMatch[0].length) : meaning;
            cleanMeaning = cleanMeaning.replace(/^\/([a-z]+\.)\s*/gi, '$1 ');
            
            return {
              word: nw.words.word,
              meaning: cleanMeaning,
              phonetic: nw.words.phonetic,
              partOfSpeech: partOfSpeech,
            };
          }) || [];
          setVocabulary(vocabList);
        }
      } catch (error) {
        console.error('获取小说失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNovel();
  }, [novelId]);

  // 解析内容：提取英文和中文部分
  const { englishContent, chineseContent, hasBilingual } = useMemo(() => {
    if (!novel) return { englishContent: '', chineseContent: '', hasBilingual: false };
    
    // 优先使用 english_content 字段（英汉对照模式上传时保存）
    if (novel.english_content) {
      return {
        englishContent: novel.english_content,
        chineseContent: novel.content || '',
        hasBilingual: true,
      };
    }
    
    // 兼容旧数据：从 content 中解析 ===EN=== 标记
    if (!novel.content) return { englishContent: '', chineseContent: '', hasBilingual: false };
    
    const content = novel.content;
    
    // 检查是否包含英汉对照标记
    const enMatch = content.match(/===EN===([\s\S]*?)(?====CN===|$)/);
    const cnMatch = content.match(/===CN===([\s\S]*?)$/);
    
    if (enMatch || cnMatch) {
      return {
        englishContent: enMatch ? enMatch[1].trim() : '',
        chineseContent: cnMatch ? cnMatch[1].trim() : content,
        hasBilingual: !!(enMatch && cnMatch),
      };
    }
    
    // 没有英汉对照标记，返回全部内容
    return { englishContent: '', chineseContent: content, hasBilingual: false };
  }, [novel]);

  // 解析英文为段落
  const englishParagraphs = useMemo(() => {
    if (!englishContent) return [];
    return englishContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#') && !line.startsWith('==='));
  }, [englishContent]);

  // 解析中文为段落
  const chineseParagraphs = useMemo(() => {
    if (!chineseContent) return [];
    return chineseContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#') && !line.startsWith('==='));
  }, [chineseContent]);

  const handleWordPress = (word: string, meaning: string, phonetic: string, partOfSpeech: string) => {
    setSelectedWord(word);
    setSelectedMeaning(meaning);
    setSelectedPhonetic(phonetic);
    setSelectedPartOfSpeech(partOfSpeech);
    setPopupVisible(true);
  };

  // 处理滚动，追踪当前段落
  const handleScroll = (event: any) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    const estimatedIndex = Math.floor(scrollY / 80);
    const safeIndex = Math.max(0, Math.min(estimatedIndex, chineseParagraphs.length - 1));
    if (safeIndex !== currentParagraphIndex) {
      setCurrentParagraphIndex(safeIndex);
    }
  };

  // 切换英文显示
  const toggleEnglish = () => {
    setShowEnglish(!showEnglish);
  };
  
  // 英文面板打开后自动滚动到当前段落
  useEffect(() => {
    if (showEnglish && englishScrollViewRef.current && englishParagraphs.length > 0) {
      // 等待 Modal 动画完成
      const timer = setTimeout(() => {
        // 估算每个段落高度约 60px
        const scrollY = currentParagraphIndex * 60;
        englishScrollViewRef.current?.scrollTo({ 
          y: Math.max(0, scrollY - 80), 
          animated: true 
        });
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [showEnglish, currentParagraphIndex, englishParagraphs.length]);

  /**
   * 渲染段落内容
   * 匹配词汇格式：[word] 或 [word]（释义）或 【word（释义）】
   * 只高亮英文单词，不显示括号和释义
   */
  const renderParagraph = (text: string, index: number) => {
    // 匹配格式：[word]、[word]（释义）、【word（释义）】
    const regex = /\[([a-zA-Z-]+)\](?:（[^）]+）)?|【([a-zA-Z-]+)（[^）]+）】/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    let keyIndex = 0;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      // 提取单词（兼容两种格式）
      const word = match[1] || match[2];
      const vocabItem = vocabulary.find(v => v.word.toLowerCase() === word.toLowerCase());
      const meaning = vocabItem?.meaning || '暂无释义';
      const phonetic = vocabItem?.phonetic || '';
      const partOfSpeech = vocabItem?.partOfSpeech || '';

      parts.push(
        <Text
          key={`word-${index}-${keyIndex++}`}
          style={styles.wordHighlight}
          onPress={() => handleWordPress(word, meaning, phonetic, partOfSpeech)}
        >
          {word}
        </Text>
      );

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    if (parts.length === 0) {
      return text;
    }

    return parts;
  };

  /**
   * 渲染内容
   */
  const renderContent = (content: string) => {
    const lines = content.split('\n');
    const result: React.ReactNode[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!line) continue;
      if (line.startsWith('#')) continue;
      if (line.startsWith('===')) continue;
      if (/^[-*_]{3,}$/.test(line)) continue;
      
      // 英文标题
      if (/^[A-Z][a-z]+(\s+[A-Z]?[a-z]+)*:\s+/.test(line) && line.length < 50) {
        result.push(
          <Text key={`subtitle-${i}`} style={[styles.subtitle, { color: theme.textPrimary }]}>
            {line}
          </Text>
        );
        continue;
      }

      // 中文章节
      const chapterMatch = line.match(/^[【\[]?第([一二三四五六七八九十\d]+)章[\】\]]?\s*(.*)/);
      if (chapterMatch) {
        const title = chapterMatch[2] ? `第${chapterMatch[1]}章 ${chapterMatch[2]}` : `第${chapterMatch[1]}章`;
        result.push(
          <View key={`chapter-${i}`} style={styles.chapterContainer}>
            <Text style={[styles.chapterTitle, { color: theme.textPrimary }]}>{title}</Text>
            <View style={[styles.chapterDivider, { backgroundColor: theme.primary }]} />
          </View>
        );
        continue;
      }
      
      // 中文小标题
      if (line.length < 20 && !line.includes('，') && !line.includes('。') && !line.includes('[')) {
        result.push(
          <Text key={`subtitle-${i}`} style={[styles.subtitle, { color: theme.textPrimary }]}>
            {line}
          </Text>
        );
        continue;
      }
      
      // 普通段落
      result.push(
        <Text key={`para-${i}`} style={styles.paragraph}>
          {'\u3000\u3000'}
          {renderParagraph(line, i)}
        </Text>
      );
    }

    return result;
  };

  if (loading) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText variant="body" color={theme.textMuted} style={{ marginTop: 16 }}>
            加载中...
          </ThemedText>
        </View>
      </Screen>
    );
  }

  if (!novel) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <ThemedText variant="h3" color={theme.textMuted}>小说不存在</ThemedText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
      <ScrollView 
        ref={scrollViewRef}
        style={styles.container} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={100}
      >
        {/* 小说标题 */}
        <View style={styles.titleContainer}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>
            {novel.title}
          </Text>
          <Text style={[styles.meta, { color: theme.textMuted }]}>
            {novel.summary} | {novel.word_count?.toLocaleString() || 0}字
          </Text>
        </View>

        {/* 小说正文 - 只显示中文部分 */}
        <View style={styles.contentContainer}>
          {chineseContent && renderContent(chineseContent)}
        </View>

        {/* 词汇总结 */}
        {vocabulary.length > 0 && (
          <View style={[styles.vocabularySection, { borderTopColor: theme.border }]}>
            <View style={styles.vocabularyHeader}>
              <Text style={[styles.vocabularyTitle, { color: theme.textPrimary }]}>
                本篇词汇总结
              </Text>
              <Text style={[styles.vocabularyCount, { color: theme.textMuted }]}>
                共 {vocabulary.length} 个单词
              </Text>
            </View>
            <View style={styles.vocabularyList}>
              {vocabulary.slice(0, 50).map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.vocabularyItem, { backgroundColor: theme.backgroundDefault, borderColor: theme.borderLight }]}
                  onPress={() => handleWordPress(item.word, item.meaning, item.phonetic, item.partOfSpeech)}
                  activeOpacity={0.7}
                >
                  <View style={styles.vocabularyWord}>
                    <Text style={[styles.wordText, { color: theme.primary }]}>{item.word}</Text>
                    {item.phonetic && (
                      <Text style={[styles.phoneticText, { color: theme.textMuted }]}>{item.phonetic}</Text>
                    )}
                  </View>
                  <Text style={[styles.meaningText, { color: theme.textSecondary }]} numberOfLines={2}>
                    {item.meaning}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
        
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* 浮动英文按钮 - 有英文内容时显示 */}
      {hasBilingual && (
        <TouchableOpacity
          style={[styles.floatingButton, { backgroundColor: theme.primary }]}
          onPress={toggleEnglish}
          activeOpacity={0.8}
        >
          <Text style={[styles.floatingButtonText, { color: theme.buttonPrimaryText }]}>EN</Text>
        </TouchableOpacity>
      )}

      {/* 英文原文面板 */}
      <Modal
        visible={showEnglish}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEnglish(false)}
      >
        <View style={styles.overlay}>
          {/* 点击背景区域关闭 */}
          <TouchableOpacity 
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setShowEnglish(false)}
          />
          
          {/* 面板内容 - 独立区域，不响应外部触摸 */}
          <View style={[styles.englishPanel, { backgroundColor: theme.backgroundRoot }]}>
            {/* 面板头部 */}
            <View style={[styles.panelHeader, { borderBottomColor: theme.borderLight }]}>
              <Text style={[styles.panelTitle, { color: theme.textPrimary }]}>
                English Original
              </Text>
              <TouchableOpacity 
                style={styles.panelCloseButton}
                onPress={() => setShowEnglish(false)}
              >
                <Text style={styles.panelCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            {/* 当前段落指示 */}
            <View style={[styles.currentParagraphIndicator, { backgroundColor: theme.primary + '20' }]}>
              <Text style={[styles.currentParagraphText, { color: theme.primary }]}>
                当前阅读: 第 {currentParagraphIndex + 1} 段
              </Text>
            </View>
            
            {/* 英文内容 */}
            <ScrollView 
              ref={englishScrollViewRef}
              style={{ flex: 1 }}
              contentContainerStyle={styles.panelContent}
              showsVerticalScrollIndicator
            >
              {englishParagraphs.map((paragraph, index) => (
                <Text
                  key={index}
                  style={[
                    styles.englishParagraph,
                    { color: theme.textPrimary },
                    index === currentParagraphIndex && [
                      styles.currentParagraphHighlight,
                      { backgroundColor: theme.primary + '15', borderLeftColor: theme.primary }
                    ]
                  ]}
                >
                  {paragraph}
                </Text>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <WordPopup
        visible={popupVisible}
        word={selectedWord}
        meaning={selectedMeaning}
        phonetic={selectedPhonetic}
        partOfSpeech={selectedPartOfSpeech}
        bookId={novel?.book_id}
        onClose={() => setPopupVisible(false)}
      />
    </Screen>
  );
}
