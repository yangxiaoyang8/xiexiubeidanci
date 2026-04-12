import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { FontAwesome6 } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

interface SplashScreenProps {
  onFinish: () => void;
  duration?: number; // 动画持续时间（毫秒）
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ 
  onFinish, 
  duration = 2000 
}) => {
  // 动画值
  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(20)).current;
  const bgOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Logo缩放和淡入动画
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // 文字延迟淡入
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(textTranslateY, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    }, 400);

    // 结束动画并淡出
    const fadeOutTimer = setTimeout(() => {
      Animated.timing(bgOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        onFinish();
      });
    }, duration);

    return () => clearTimeout(fadeOutTimer);
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: bgOpacity }]}>
      {/* 渐变背景 */}
      <View style={styles.gradientBg}>
        {/* 装饰圆圈 */}
        <View style={styles.decorCircle1} />
        <View style={styles.decorCircle2} />
        <View style={styles.decorCircle3} />
      </View>

      {/* Logo区域 */}
      <Animated.View 
        style={[
          styles.logoContainer, 
          { 
            transform: [{ scale: logoScale }],
            opacity: logoOpacity 
          }
        ]}
      >
        {/* 图标背景 */}
        <View style={styles.iconBg}>
          <FontAwesome6 name="book-open" size={48} color="#FFFFFF" />
        </View>
        
        {/* 应用名称 */}
        <ThemedText style={styles.appName}>
          看小说背单词
        </ThemedText>
      </Animated.View>

      {/* 底部文字 */}
      <Animated.View 
        style={[
          styles.footer,
          {
            opacity: textOpacity,
            transform: [{ translateY: textTranslateY }]
          }
        ]}
      >
        <ThemedText style={styles.slogan}>
          在故事中轻松掌握词汇
        </ThemedText>
        <View style={styles.dots}>
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  gradientBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#6366F1',
    overflow: 'hidden',
  },
  decorCircle1: {
    position: 'absolute',
    width: width * 1.5,
    height: width * 1.5,
    borderRadius: width * 0.75,
    backgroundColor: 'rgba(255,255,255,0.1)',
    top: -width * 0.5,
    right: -width * 0.3,
  },
  decorCircle2: {
    position: 'absolute',
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: width * 0.4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    bottom: height * 0.2,
    left: -width * 0.3,
  },
  decorCircle3: {
    position: 'absolute',
    width: width * 0.4,
    height: width * 0.4,
    borderRadius: width * 0.2,
    backgroundColor: 'rgba(236,72,153,0.3)',
    top: height * 0.15,
    left: width * 0.1,
  },
  logoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBg: {
    width: 100,
    height: 100,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  appName: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  footer: {
    paddingBottom: 60,
    alignItems: 'center',
  },
  slogan: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 20,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dotActive: {
    backgroundColor: '#FFFFFF',
    width: 20,
  },
});
