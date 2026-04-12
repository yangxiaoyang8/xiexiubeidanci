import { StyleSheet } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.backgroundRoot,
    },
    // 头部区域 - 使用渐变效果
    header: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing['3xl'],
      paddingBottom: Spacing['4xl'],
      backgroundColor: theme.primary,
      borderBottomLeftRadius: BorderRadius['3xl'],
      borderBottomRightRadius: BorderRadius['3xl'],
    },
    headerTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    },
    headerText: {
      flex: 1,
    },
    headerTitle: {
      color: '#FFFFFF',
      marginBottom: Spacing.sm,
      fontSize: 28,
      fontWeight: '700',
    },
    headerSubtitle: {
      color: '#FFFFFF',
      opacity: 0.85,
      fontSize: 15,
    },
    uploadButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.2)',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.full,
      gap: Spacing.sm,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.3)',
    },
    uploadButtonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
    },
    // 内容区域
    content: {
      flex: 1,
      padding: Spacing.lg,
      marginTop: -Spacing['2xl'], // 负边距创建层叠效果
    },
    sectionTitle: {
      marginBottom: Spacing.lg,
      fontSize: 18,
      fontWeight: '600',
    },
    grid: {
      gap: Spacing.lg,
    },
    // 卡片样式 - 现代卡片设计
    card: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius['2xl'],
      padding: Spacing.xl,
      shadowColor: '#6366F1',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 24,
      elevation: 6,
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    iconContainer: {
      width: 56,
      height: 56,
      borderRadius: BorderRadius.xl,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.lg,
    },
    cardTitle: {
      flex: 1,
    },
    cardDescription: {
      marginTop: Spacing.sm,
      lineHeight: 22,
    },
    // 统计区域
    cardStats: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: Spacing.lg,
      paddingTop: Spacing.lg,
      borderTopWidth: 1,
      borderTopColor: theme.borderLight,
    },
    statItem: {
      alignItems: 'center',
    },
    statValue: {
      color: theme.primary,
      fontWeight: '700',
    },
    statLabel: {
      marginTop: Spacing.xs,
      color: theme.textMuted,
    },
    // 等级标签
    levelBadge: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.full,
      marginTop: Spacing.xs,
    },
    levelBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 0.5,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    // 用户状态区域
    userArea: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.xl,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    userInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    userInfo: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    username: {
      marginLeft: Spacing.md,
    },
    logoutButton: {
      paddingVertical: Spacing.xs,
      paddingHorizontal: Spacing.md,
      borderRadius: BorderRadius.md,
      backgroundColor: theme.backgroundTertiary,
    },
    loginPrompt: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.md,
    },
    // 隐藏的管理员入口
    secretArea: {
      alignItems: 'center',
      paddingVertical: Spacing['3xl'],
      marginTop: Spacing.lg,
    },
    // 弹窗样式
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: Spacing.lg,
    },
    modalContent: {
      borderRadius: BorderRadius['2xl'],
      padding: Spacing.xl,
      width: '100%',
      maxWidth: 340,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.25,
      shadowRadius: 20,
      elevation: 10,
    },
    modalIconContainer: {
      width: 64,
      height: 64,
      borderRadius: 32,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      marginBottom: Spacing.sm,
    },
    modalMessage: {
      marginBottom: Spacing.lg,
      textAlign: 'center',
    },
    input: {
      width: '100%',
      height: 48,
      borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.lg,
      fontSize: 16,
      marginBottom: Spacing.sm,
    },
    modalHint: {
      marginBottom: Spacing.lg,
    },
    modalButtons: {
      flexDirection: 'row',
      gap: Spacing.md,
      width: '100%',
    },
    modalButton: {
      flex: 1,
      height: 48,
      borderRadius: BorderRadius.lg,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalButtonCancel: {
      backgroundColor: theme.backgroundTertiary,
    },
    modalButtonSecondary: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
    },
    modalButtonConfirm: {
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    modalButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    modalButtonTextLight: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
  });
};
