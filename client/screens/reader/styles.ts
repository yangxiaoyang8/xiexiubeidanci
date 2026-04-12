import { StyleSheet } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  const isDark = theme.backgroundRoot === '#0F0F1A';
  
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#0A0A12' : '#FEFEFE',
    },
    scrollContent: {
      padding: Spacing.xl,
      paddingBottom: Spacing['6xl'],
    },
    // 标题区域
    titleContainer: {
      marginBottom: Spacing['3xl'],
      paddingBottom: Spacing['2xl'],
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: Spacing.md,
      letterSpacing: 3,
      color: theme.textPrimary,
    },
    meta: {
      fontSize: 13,
      textAlign: 'center',
      color: theme.textMuted,
    },
    // 内容区域
    contentContainer: {
      marginTop: Spacing.lg,
    },
    // 章节标题
    chapterContainer: {
      marginTop: Spacing['3xl'],
      marginBottom: Spacing['2xl'],
    },
    chapterTitle: {
      fontSize: 22,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: Spacing.lg,
      letterSpacing: 5,
      color: theme.textPrimary,
    },
    chapterDivider: {
      height: 3,
      width: 80,
      alignSelf: 'center',
      borderRadius: 2,
      backgroundColor: theme.primary,
    },
    // 小标题
    subtitle: {
      fontSize: 18,
      fontWeight: '600',
      textAlign: 'center',
      marginVertical: Spacing.xl,
      letterSpacing: 2,
      color: theme.textPrimary,
    },
    // 段落样式
    paragraph: {
      fontSize: 18,
      lineHeight: 36,
      textAlign: 'justify',
      marginBottom: Spacing.xl,
      letterSpacing: 0.5,
      color: theme.textPrimary,
    },
    normalText: {
      fontSize: 18,
      lineHeight: 36,
      color: theme.textPrimary,
    },
    // 单词高亮
    wordHighlight: {
      fontSize: 18,
      lineHeight: 36,
      color: theme.primary,
      fontWeight: '600',
    },
    // 词汇总结区域
    vocabularySection: {
      marginTop: Spacing['4xl'],
      paddingTop: Spacing['2xl'],
      borderTopWidth: 1,
      borderTopColor: theme.borderLight,
    },
    vocabularyHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.xl,
    },
    vocabularyTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.textPrimary,
    },
    vocabularyCount: {
      fontSize: 14,
      color: theme.textMuted,
    },
    vocabularyList: {
      gap: Spacing.md,
    },
    vocabularyItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.lg,
      borderRadius: BorderRadius.xl,
      backgroundColor: theme.backgroundTertiary,
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    vocabularyWord: {
      minWidth: 90,
      marginRight: Spacing.lg,
    },
    wordText: {
      fontSize: 17,
      fontWeight: '700',
      color: theme.primary,
    },
    phoneticText: {
      fontSize: 12,
      marginTop: 2,
      color: theme.textMuted,
    },
    meaningText: {
      flex: 1,
      fontSize: 15,
      lineHeight: 22,
      color: theme.textSecondary,
    },
    moreText: {
      textAlign: 'center',
      marginTop: Spacing.lg,
      fontSize: 14,
      color: theme.textMuted,
    },
    // ===== 浮动英文按钮 =====
    floatingButton: {
      position: 'absolute',
      right: Spacing.lg,
      bottom: Spacing['3xl'],
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 8,
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
    },
    floatingButtonText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '700',
    },
    // ===== 底部英文面板 =====
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'flex-end',
    },
    englishPanel: {
      backgroundColor: theme.backgroundRoot,
      borderTopLeftRadius: BorderRadius['3xl'],
      borderTopRightRadius: BorderRadius['3xl'],
      maxHeight: '65%',
      minHeight: '45%',
    },
    panelHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: Spacing.xl,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    panelTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.textPrimary,
    },
    panelCloseButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.backgroundTertiary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    panelCloseText: {
      fontSize: 18,
      color: theme.textMuted,
    },
    panelContent: {
      padding: Spacing.xl,
    },
    englishParagraph: {
      fontSize: 16,
      lineHeight: 28,
      marginBottom: Spacing.xl,
      color: theme.textSecondary,
    },
    currentParagraphHighlight: {
      backgroundColor: theme.primary + '12',
      borderLeftWidth: 4,
      borderLeftColor: theme.primary,
      paddingLeft: Spacing.lg,
      marginLeft: -Spacing.lg,
      borderRadius: 8,
    },
    // 当前段落指示器
    currentParagraphIndicator: {
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.xl,
      alignItems: 'center',
    },
    currentParagraphText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.primary,
    },
  });
};
