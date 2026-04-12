import React, { useState, useEffect } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { FontAwesome6 } from '@expo/vector-icons';
import { Spacing, BorderRadius } from '@/constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 生成小说的密码（可以修改）
const GENERATE_PASSWORD = '888888';

// 验证通过的存储key
const AUTH_STORAGE_KEY = 'novel_generate_auth';

interface PasswordModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void; // 快速创作
  onCustomCreate?: () => void; // 自定义创作
}

export const PasswordModal: React.FC<PasswordModalProps> = ({
  visible,
  onClose,
  onSuccess,
  onCustomCreate,
}) => {
  const { theme } = useTheme();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 重置状态
  useEffect(() => {
    if (!visible) {
      setPassword('');
      setError('');
    }
  }, [visible]);

  const handleQuickCreate = async () => {
    if (!password.trim()) {
      setError('请输入密码');
      return;
    }

    setLoading(true);
    
    // 模拟验证延迟
    await new Promise(resolve => setTimeout(resolve, 300));

    if (password === GENERATE_PASSWORD) {
      // 保存验证状态
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, 'true');
      setLoading(false);
      onSuccess();
    } else {
      setLoading(false);
      setError('密码错误，请重试');
    }
  };

  const handleCustomCreate = async () => {
    if (!password.trim()) {
      setError('请输入密码');
      return;
    }

    setLoading(true);
    
    // 模拟验证延迟
    await new Promise(resolve => setTimeout(resolve, 300));

    if (password === GENERATE_PASSWORD) {
      // 保存验证状态
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, 'true');
      setLoading(false);
      onCustomCreate?.();
    } else {
      setLoading(false);
      setError('密码错误，请重试');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} disabled={Platform.OS === 'web'}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: Spacing.lg,
          }}>
            <View style={{
              backgroundColor: theme.backgroundDefault,
              borderRadius: BorderRadius['2xl'],
              padding: Spacing.xl,
              width: '100%',
              maxWidth: 340,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.25,
              shadowRadius: 20,
              elevation: 10,
            }}>
              {/* 头部 */}
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: Spacing.lg,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                  <View style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: theme.primary + '15',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}>
                    <FontAwesome6 name="wand-magic-sparkles" size={18} color={theme.primary} />
                  </View>
                  <ThemedText variant="h3" color={theme.textPrimary}>创作小说</ThemedText>
                </View>
                <TouchableOpacity onPress={onClose} style={{ padding: Spacing.sm }}>
                  <FontAwesome6 name="xmark" size={20} color={theme.textMuted} />
                </TouchableOpacity>
              </View>

              {/* 说明 */}
              <ThemedText variant="body" color={theme.textSecondary} style={{ marginBottom: Spacing.lg }}>
                请输入授权密码开始创作
              </ThemedText>

              {/* 密码输入框 */}
              <View style={{
                backgroundColor: theme.backgroundTertiary,
                borderRadius: BorderRadius.lg,
                marginBottom: Spacing.md,
              }}>
                <TextInput
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setError('');
                  }}
                  placeholder="请输入密码"
                  placeholderTextColor={theme.textMuted}
                  secureTextEntry
                  keyboardType="numeric"
                  maxLength={6}
                  style={{
                    padding: Spacing.lg,
                    fontSize: 16,
                    color: theme.textPrimary,
                    textAlign: 'center',
                    letterSpacing: 8,
                  }}
                />
              </View>

              {/* 错误提示 */}
              {error ? (
                <ThemedText variant="small" color={theme.error} style={{ marginBottom: Spacing.md, textAlign: 'center' }}>
                  {error}
                </ThemedText>
              ) : null}

              {/* 两个创作按钮 */}
              <View style={{ gap: Spacing.md, marginTop: Spacing.sm }}>
                {/* 快速创作按钮 */}
                <TouchableOpacity
                  onPress={handleQuickCreate}
                  disabled={loading}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: Spacing.sm,
                    padding: Spacing.lg,
                    borderRadius: BorderRadius.lg,
                    backgroundColor: theme.backgroundTertiary,
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  <FontAwesome6 name="bolt" size={16} color={theme.primary} />
                  <ThemedText variant="bodyMedium" color={theme.primary}>快速创作</ThemedText>
                </TouchableOpacity>
                
                {/* 定制创作按钮 */}
                <TouchableOpacity
                  onPress={handleCustomCreate}
                  disabled={loading}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: Spacing.sm,
                    padding: Spacing.lg,
                    borderRadius: BorderRadius.lg,
                    backgroundColor: theme.primary,
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  <FontAwesome6 name="sliders" size={16} color="#FFFFFF" />
                  <ThemedText variant="bodyMedium" color="#FFFFFF">
                    {loading ? '验证中...' : '定制创作'}
                  </ThemedText>
                </TouchableOpacity>
              </View>

              {/* 提示 */}
              <ThemedText variant="caption" color={theme.textMuted} style={{ marginTop: Spacing.lg, textAlign: 'center' }}>
                默认密码: 888888
              </ThemedText>
            </View>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

// 检查是否已通过验证
export const checkGenerateAuth = async (): Promise<boolean> => {
  try {
    const auth = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
    return auth === 'true';
  } catch {
    return false;
  }
};

// 清除验证状态
export const clearGenerateAuth = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // ignore
  }
};
