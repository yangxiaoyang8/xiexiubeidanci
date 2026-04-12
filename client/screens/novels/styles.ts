import { StyleSheet } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.backgroundRoot,
    },
    // 头部区域
    header: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing['3xl'],
      paddingBottom: Spacing['4xl'],
      backgroundColor: theme.primary,
      borderBottomLeftRadius: BorderRadius['3xl'],
      borderBottomRightRadius: BorderRadius['3xl'],
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.lg,
    },
    headerText: {
      flex: 1,
    },
    headerTitle: {
      color: '#FFFFFF',
      fontSize: 24,
      fontWeight: '700',
    },
    headerSubtitle: {
      color: '#FFFFFF',
      opacity: 0.8,
      fontSize: 14,
      marginTop: Spacing.xs,
    },
    // 内容区域
    content: {
      flex: 1,
      padding: Spacing.lg,
    },
    // 小说卡片
    card: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius['2xl'],
      marginBottom: Spacing.lg,
      overflow: 'hidden',
      shadowColor: '#6366F1',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.1,
      shadowRadius: 20,
      elevation: 5,
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    cardContent: {
      padding: Spacing.xl,
    },
    // 卡片标题
    cardTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.md,
    },
    cardTitle: {
      flex: 1,
      lineHeight: 28,
      fontSize: 20,
      fontWeight: '600',
    },
    uploadBadge: {
      fontSize: 11,
      marginLeft: Spacing.sm,
    },
    // 标签行
    tagRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    tag: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.full,
      gap: Spacing.xs,
    },
    tagText: {
      fontSize: 12,
      fontWeight: '600',
    },
    // 统计行
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xl,
      paddingTop: Spacing.lg,
      borderTopWidth: 1,
      borderTopColor: theme.borderLight,
    },
    statItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    statIcon: {
      width: 32,
      height: 32,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    statValue: {
      fontSize: 15,
      fontWeight: '600',
    },
    statLabel: {
      fontSize: 12,
      color: theme.textMuted,
    },
    // FAB按钮
    fab: {
      position: 'absolute',
      right: Spacing.lg,
      bottom: Spacing['3xl'],
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
      elevation: 12,
    },
    fabBadge: {
      position: 'absolute',
      right: Spacing.lg,
      bottom: Spacing['3xl'] + 68,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
      borderRadius: 12,
      minWidth: 36,
    },
    fabBadgeText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '600',
      textAlign: 'center',
    },
    // 空状态
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: Spacing['5xl'],
    },
    emptyIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.backgroundTertiary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    emptyText: {
      marginTop: Spacing.lg,
      textAlign: 'center',
    },
    // 加载状态
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    // Modal 样式
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      width: '85%',
      maxWidth: 340,
      borderRadius: 24,
      padding: Spacing.xl,
      alignItems: 'center',
    },
    modalIconContainer: {
      width: 72,
      height: 72,
      borderRadius: 36,
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
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: Spacing.md,
    },
    input: {
      width: '100%',
      height: 48,
      borderRadius: 12,
      paddingHorizontal: Spacing.md,
      fontSize: 16,
      marginBottom: Spacing.lg,
    },
    warningTip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: 8,
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
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalButtonCancel: {
      backgroundColor: theme.backgroundTertiary,
    },
    modalButtonConfirm: {
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4,
    },
    modalButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    modalButtonTextLight: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
  });
};
