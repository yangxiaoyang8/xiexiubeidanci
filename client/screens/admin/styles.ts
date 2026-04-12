import { StyleSheet } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.backgroundRoot,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing['2xl'],
      paddingBottom: Spacing.lg,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      color: '#FFFFFF',
      fontSize: 20,
      fontWeight: '700',
    },
    placeholder: {
      width: 40,
    },
    // Tab栏
    tabBar: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    tabItem: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: Spacing.lg,
      gap: Spacing.xs,
    },
    tabItemActive: {
      borderBottomWidth: 2,
      borderBottomColor: theme.primary,
    },
    // 内容区域
    content: {
      flex: 1,
      padding: Spacing.lg,
    },
    tabContent: {
      gap: Spacing.lg,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    // 表单卡片
    formCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.xl,
      padding: Spacing.xl,
      shadowColor: '#6366F1',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 3,
    },
    formTitle: {
      marginBottom: Spacing.lg,
    },
    input: {
      height: 48,
      borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.lg,
      fontSize: 16,
      marginBottom: Spacing.md,
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: 48,
      borderRadius: BorderRadius.lg,
      gap: Spacing.sm,
      marginTop: Spacing.sm,
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    // 当前密码显示
    currentPasswordRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.lg,
      padding: Spacing.md,
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.lg,
    },
    currentPasswordValue: {
      fontWeight: '700',
      color: theme.primary,
    },
    // 列表卡片
    listCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.xl,
      padding: Spacing.xl,
      shadowColor: '#6366F1',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 3,
    },
    listItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    listItemContent: {
      flex: 1,
    },
    deviceIdText: {
      fontFamily: 'monospace',
    },
    deleteButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: '#FEE2E2',
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyText: {
      textAlign: 'center',
      paddingVertical: Spacing.xl,
    },
    // 统计页面
    statsNote: {
      marginBottom: Spacing.lg,
    },
    statItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    statItemLeft: {
      flex: 1,
    },
    statItemRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    countBadge: {
      backgroundColor: theme.primary + '15',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.full,
    },
    countText: {
      color: theme.primary,
      fontWeight: '600',
    },
    resetButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
    },
    // 搜索相关
    clearSearchButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: BorderRadius.lg,
      gap: Spacing.xs,
      marginTop: Spacing.sm,
    },
    clearSearchText: {
      fontSize: 14,
    },
    // 配置管理
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    settingLabel: {
      flex: 1,
    },
    settingInput: {
      width: 80,
      height: 40,
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.md,
      textAlign: 'center',
      fontSize: 16,
      fontWeight: '600',
    },
  });
};
