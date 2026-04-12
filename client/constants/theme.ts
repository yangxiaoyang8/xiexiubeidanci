export const Colors = {
  light: {
    textPrimary: "#1A1A2E",
    textSecondary: "#4A5568",
    textMuted: "#A0AEC0",
    primary: "#6366F1", // Indigo-500 - 更现代的紫色
    accent: "#EC4899", // Pink-500 - 活力点缀色
    success: "#10B981",
    error: "#F43F5E",
    backgroundRoot: "#F8FAFC", // 更柔和的背景
    backgroundDefault: "#FFFFFF",
    backgroundTertiary: "#F1F5F9", // 浅灰蓝背景
    buttonPrimaryText: "#FFFFFF",
    tabIconSelected: "#6366F1",
    border: "#E2E8F0",
    borderLight: "#F1F5F9",
  },
  dark: {
    textPrimary: "#F1F5F9",
    textSecondary: "#94A3B8",
    textMuted: "#64748B",
    primary: "#818CF8", // Indigo-400
    accent: "#F472B6", // Pink-400
    success: "#34D399",
    error: "#FB7185",
    backgroundRoot: "#0F0F1A", // 深空背景
    backgroundDefault: "#1A1A2E",
    backgroundTertiary: "#252538",
    buttonPrimaryText: "#0F0F1A",
    tabIconSelected: "#818CF8",
    border: "#334155",
    borderLight: "#1E293B",
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  "6xl": 64,
};

export const BorderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 28,
  "4xl": 32,
  full: 9999,
};

export const Typography = {
  display: {
    fontSize: 112,
    lineHeight: 112,
    fontWeight: "200" as const,
    letterSpacing: -4,
  },
  displayLarge: {
    fontSize: 112,
    lineHeight: 112,
    fontWeight: "200" as const,
    letterSpacing: -2,
  },
  displayMedium: {
    fontSize: 48,
    lineHeight: 56,
    fontWeight: "200" as const,
  },
  h1: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: "700" as const,
  },
  h2: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "700" as const,
  },
  h3: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "600" as const,
  },
  h4: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600" as const,
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "600" as const,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
  },
  bodyMedium: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500" as const,
  },
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400" as const,
  },
  smallMedium: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500" as const,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400" as const,
  },
  captionMedium: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500" as const,
  },
  label: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600" as const,
    letterSpacing: 1,
    textTransform: "uppercase" as const,
  },
  labelSmall: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500" as const,
    letterSpacing: 1,
    textTransform: "uppercase" as const,
  },
  labelTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700" as const,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
  },
  link: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
  },
  stat: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700" as const,
  },
  tiny: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "400" as const,
  },
  navLabel: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "500" as const,
  },
};

export type Theme = typeof Colors.light;

// 渐变色配置
export const Gradients = {
  light: {
    header: ['#6366F1', '#8B5CF6'], // Indigo to Violet
    card: ['#FFFFFF', '#FAFAFA'],
    accent: ['#EC4899', '#F43F5E'], // Pink to Rose
  },
  dark: {
    header: ['#4F46E5', '#7C3AED'],
    card: ['#1A1A2E', '#16162A'],
    accent: ['#DB2777', '#E11D48'],
  },
};

// 等级颜色映射
export const LevelColors = {
  '四级': { bg: '#3B82F6', light: '#DBEAFE', dark: '#1D4ED8' },
  '六级': { bg: '#8B5CF6', light: '#EDE9FE', dark: '#6D28D9' },
  '雅思': { bg: '#EF4444', light: '#FEE2E2', dark: '#B91C1C' },
  '托福': { bg: '#F59E0B', light: '#FEF3C7', dark: '#D97706' },
  'default': { bg: '#6366F1', light: '#E0E7FF', dark: '#4338CA' },
};
