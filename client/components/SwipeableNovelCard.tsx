import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius } from '@/constants/theme';
import { buildApiUrl } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';

interface SwipeableNovelCardProps {
  id: string;
  title: string;
  summary: string | null;
  created_at: string;
  onPress: () => void;
  onDelete: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}

export function SwipeableNovelCard({
  id,
  title,
  onPress,
  onDelete,
  children,
  disabled = false,
}: SwipeableNovelCardProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const swipeableRef = useRef<Swipeable>(null);

  const handleDelete = async () => {
    // 立即关闭滑出按钮
    swipeableRef.current?.close();
    
    // 乐观更新：立即通知父组件刷新列表
    onDelete();
    
    // 后台异步删除
    try {
      const url = user 
        ? `${buildApiUrl(`/api/v1/novels/${id}`)}?user_id=${user.id}`
        : buildApiUrl(`/api/v1/novels/${id}`);
      await fetch(url, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('删除小说失败:', error);
    }
  };

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const opacity = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });

    const scale = dragX.interpolate({
      inputRange: [-100, -40],
      outputRange: [1.05, 0.9],
      extrapolate: 'clamp',
    });

    return (
      <Animated.View style={[styles.deleteAction, { opacity }]}>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDelete}
          activeOpacity={0.8}
        >
          <FontAwesome6 name="trash" size={20} color="#FFFFFF" />
          <Text style={styles.deleteText}>删除</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
      >
        {children}
      </TouchableOpacity>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  deleteAction: {
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    width: 70,
    height: '80%',
    backgroundColor: '#EF4444',
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'center',
  },
  deleteText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
