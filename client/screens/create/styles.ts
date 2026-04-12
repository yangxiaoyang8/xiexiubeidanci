import { StyleSheet } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.backgroundRoot,
    },
    scrollContent: {
      padding: Spacing.lg,
      paddingBottom: Spacing['5xl'],
    },
    // 头部
    header: {
      marginBottom: Spacing['2xl'],
    },
    headerTitle: {
      marginBottom: Spacing.sm,
    },
    // 区块
    section: {
      marginBottom: Spacing.xl,
    },
    label: {
      marginBottom: Spacing.sm,
      fontWeight: '500',
    },
    required: {
      color: theme.error,
    },
    hint: {
      marginTop: Spacing.xs,
    },
    // 输入框
    input: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      fontSize: 16,
      color: theme.textPrimary,
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    textArea: {
      minHeight: 120,
      textAlignVertical: 'top',
    },
    // 选择器
    picker: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    pickerText: {
      flex: 1,
      fontSize: 16,
      color: theme.textPrimary,
    },
    pickerHint: {
      fontSize: 13,
      color: theme.textMuted,
      marginRight: Spacing.md,
    },
    pickerOptions: {
      marginTop: Spacing.sm,
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: theme.borderLight,
      overflow: 'hidden',
    },
    pickerOption: {
      padding: Spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    pickerOptionSelected: {
      backgroundColor: theme.primary + '10',
    },
    pickerOptionText: {
      fontSize: 16,
      color: theme.textPrimary,
      fontWeight: '500',
    },
    pickerOptionTextSelected: {
      color: theme.primary,
    },
    pickerOptionHint: {
      fontSize: 13,
      color: theme.textMuted,
      marginTop: Spacing.xs,
    },
    // 生成按钮
    generateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.primary,
      paddingVertical: Spacing.xl,
      borderRadius: BorderRadius.lg,
      marginTop: Spacing.lg,
      gap: Spacing.md,
    },
    generateButtonDisabled: {
      opacity: 0.6,
    },
    generateButtonText: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.buttonPrimaryText,
    },
    generatingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    // 预览容器
    previewContainer: {
      marginTop: Spacing['2xl'],
      padding: Spacing.lg,
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.xl,
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    previewHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    previewTitle: {
      marginBottom: 0,
    },
    wordCount: {
      fontSize: 13,
      color: theme.textMuted,
    },
    previewContent: {
      fontSize: 14,
      lineHeight: 24,
      color: theme.textSecondary,
    },
    // 提示
    tips: {
      marginTop: Spacing['2xl'],
      padding: Spacing.lg,
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.lg,
    },
  });
};
