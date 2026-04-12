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
    header: {
      marginBottom: Spacing.xl,
    },
    headerTitle: {
      marginBottom: Spacing.sm,
    },
    // 上传次数提示
    limitBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: Spacing.md,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.md,
      gap: Spacing.sm,
    },
    vipBanner: {
      backgroundColor: '#FFD700' + '15',
    },
    limitText: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    vipText: {
      color: '#B8860B',
      fontWeight: '600',
    },
    section: {
      marginBottom: Spacing.xl,
    },
    label: {
      marginBottom: Spacing.md,
    },
    required: {
      color: theme.error,
    },
    // 词库选择器
    picker: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.backgroundDefault,
      padding: Spacing.lg,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: theme.border,
    },
    pickerText: {
      flex: 1,
      fontSize: 16,
      color: theme.textPrimary,
    },
    pickerHint: {
      fontSize: 14,
      color: theme.textMuted,
      marginRight: Spacing.md,
    },
    pickerOptions: {
      marginTop: Spacing.sm,
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      overflow: 'hidden',
    },
    pickerOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
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
    },
    pickerOptionTextSelected: {
      color: theme.primary,
      fontWeight: '600',
    },
    pickerOptionHint: {
      fontSize: 14,
      color: theme.textMuted,
    },
    // 文件选择
    filePicker: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.backgroundDefault,
      padding: Spacing['2xl'],
      borderRadius: BorderRadius.xl,
      borderWidth: 2,
      borderColor: theme.border,
      borderStyle: 'dashed',
    },
    fileInfo: {
      marginTop: Spacing.md,
      alignItems: 'center',
    },
    fileName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.textPrimary,
    },
    fileSize: {
      fontSize: 14,
      color: theme.textMuted,
      marginTop: Spacing.xs,
    },
    fileHint: {
      marginTop: Spacing.md,
      fontSize: 14,
      color: theme.textMuted,
    },
    // 分析按钮
    analyzeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.primary,
      paddingVertical: Spacing.lg,
      borderRadius: BorderRadius.lg,
      gap: Spacing.sm,
      marginTop: Spacing.lg,
    },
    analyzeButtonDisabled: {
      opacity: 0.5,
    },
    analyzeButtonText: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.buttonPrimaryText,
    },
    analyzingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    // 提示
    tips: {
      marginTop: Spacing.xl,
      padding: Spacing.lg,
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.lg,
    },
    tipsTitle: {
      marginBottom: Spacing.xs,
    },
    tipsContent: {
      lineHeight: 20,
    },
    // 预览相关
    previewHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.xl,
    },
    backButton: {
      padding: Spacing.sm,
      marginRight: Spacing.md,
    },
    previewTitle: {
      flex: 1,
    },
    infoCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.xl,
      padding: Spacing.lg,
      marginBottom: Spacing.xl,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    infoLabel: {
      fontSize: 14,
      color: theme.textMuted,
    },
    infoValue: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.textPrimary,
    },
    genreTag: {
      backgroundColor: theme.primary + '15',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.full,
    },
    genreText: {
      fontSize: 14,
      color: theme.primary,
      fontWeight: '500',
    },
    // 词汇列表
    vocabularyList: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      overflow: 'hidden',
    },
    vocabItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    vocabWord: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.primary,
      width: 100,
    },
    vocabPos: {
      fontSize: 12,
      color: theme.accent,
      backgroundColor: theme.accent + '15',
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
      borderRadius: 4,
      marginRight: Spacing.sm,
    },
    vocabMeaning: {
      flex: 1,
      fontSize: 14,
      color: theme.textSecondary,
    },
    // 内容预览
    contentPreview: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
    },
    contentText: {
      fontSize: 15,
      lineHeight: 24,
      color: theme.textPrimary,
    },
    // 操作按钮
    actionButtons: {
      flexDirection: 'row',
      gap: Spacing.md,
      marginTop: Spacing.xl,
    },
    editButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.backgroundDefault,
      paddingVertical: Spacing.lg,
      borderRadius: BorderRadius.lg,
      gap: Spacing.sm,
      borderWidth: 1,
      borderColor: theme.primary,
    },
    editButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.primary,
    },
    saveButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.primary,
      paddingVertical: Spacing.lg,
      borderRadius: BorderRadius.lg,
      gap: Spacing.sm,
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.buttonPrimaryText,
    },
    // 保存中
    savingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: Spacing['5xl'],
    },
    savingText: {
      marginTop: Spacing.lg,
    },
  });
};
