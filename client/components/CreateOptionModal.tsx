import React from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { FontAwesome6 } from '@expo/vector-icons';
import { Spacing, BorderRadius } from '@/constants/theme';

interface CreateOptionModalProps {
  visible: boolean;
  onClose: () => void;
  onQuickCreate: () => void;
  onCustomCreate: () => void;
}

export const CreateOptionModal: React.FC<CreateOptionModalProps> = ({
  visible,
  onClose,
  onQuickCreate,
  onCustomCreate,
}) => {
  const { theme } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity 
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg }}
        activeOpacity={1}
        onPress={onClose}
      >
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
          <ThemedText variant="body" color={theme.textSecondary} style={{ marginBottom: Spacing.xl }}>
            选择创作方式，开启你的故事之旅
          </ThemedText>

          {/* 两个创作按钮 */}
          <View style={{ gap: Spacing.md }}>
            {/* 快速创作按钮 */}
            <TouchableOpacity
              onPress={() => {
                onClose();
                onQuickCreate();
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: Spacing.sm,
                padding: Spacing.lg,
                borderRadius: BorderRadius.lg,
                backgroundColor: theme.backgroundTertiary,
              }}
            >
              <FontAwesome6 name="bolt" size={16} color={theme.primary} />
              <ThemedText variant="bodyMedium" color={theme.primary}>快速创作</ThemedText>
            </TouchableOpacity>
            
            {/* 定制创作按钮 */}
            <TouchableOpacity
              onPress={() => {
                onClose();
                onCustomCreate();
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: Spacing.sm,
                padding: Spacing.lg,
                borderRadius: BorderRadius.lg,
                backgroundColor: theme.primary,
              }}
            >
              <FontAwesome6 name="sliders" size={16} color="#FFFFFF" />
              <ThemedText variant="bodyMedium" color="#FFFFFF">定制创作</ThemedText>
            </TouchableOpacity>
          </View>

          {/* 提示 */}
          <ThemedText variant="caption" color={theme.textMuted} style={{ marginTop: Spacing.lg, textAlign: 'center' }}>
            快速创作：AI自动生成 | 定制创作：自定义设定
          </ThemedText>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};
