/**
 * 获取 API 基础 URL
 * 生产环境使用相对路径（前后端同域）
 * 开发环境使用完整URL
 */
export const getApiBaseUrl = (): string => {
  // 生产环境：前后端同域，使用相对路径
  if (process.env.NODE_ENV === 'production') {
    return '';
  }
  // 开发环境：使用配置的URL或默认值
  return process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://localhost:9091';
};

/**
 * 构建完整的 API URL
 */
export const buildApiUrl = (path: string): string => {
  const baseUrl = getApiBaseUrl();
  // 确保路径以 / 开头
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
};

/**
 * 构建带用户ID的URL参数（用于数据隔离）
 */
export const buildUrlWithUserId = (baseUrl: string, userId: string): string => {
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}user_id=${encodeURIComponent(userId)}`;
};

/**
 * 获取请求体中的用户ID字段
 */
export const getUserIdField = (userId: string): { user_id: string } => {
  return { user_id: userId };
};
