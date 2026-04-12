import { useEffect, useState, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LogBox, Platform } from 'react-native';
import Toast from 'react-native-toast-message';
import { AuthProvider } from "@/contexts/AuthContext";
import { ColorSchemeProvider } from '@/hooks/useColorScheme';
import { SplashScreen as CustomSplashScreen } from '@/components/SplashScreen';

LogBox.ignoreLogs([
  "TurboModuleRegistry.getEnforcing(...): 'RNMapsAirModule' could not be found",
]);

const SPLASH_SHOWN_KEY = 'splash_screen_shown';

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(false);
  const hasCheckedSplash = useRef(false);

  useEffect(() => {
    // 只在首次挂载时检查
    if (hasCheckedSplash.current) return;
    hasCheckedSplash.current = true;

    const checkSplashShown = async () => {
      try {
        if (Platform.OS === 'web') {
          // Web端使用localStorage
          const shown = localStorage.getItem(SPLASH_SHOWN_KEY);
          if (!shown) {
            // 首次启动，显示开屏动画
            setShowSplash(true);
            // 标记已显示
            localStorage.setItem(SPLASH_SHOWN_KEY, 'true');
          }
        } else {
          // Mobile端暂时不显示开屏动画（可以根据需要调整）
          // 如果需要显示，可以使用 AsyncStorage
          setShowSplash(false);
        }
      } catch (e) {
        console.error('检查开屏动画状态失败:', e);
        setShowSplash(false);
      }
    };

    checkSplashShown();
  }, []);

  return (
    <AuthProvider>
      <ColorSchemeProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <StatusBar style="light"></StatusBar>
          <Stack screenOptions={{
            animation: 'slide_from_right',
            gestureEnabled: true,
            gestureDirection: 'horizontal',
            headerShown: false
          }}>
            <Stack.Screen name="index" options={{ title: "首页" }} />
            <Stack.Screen name="novels" options={{ title: "小说列表" }} />
            <Stack.Screen name="reader" options={{ title: "阅读" }} />
            <Stack.Screen name="create" options={{ title: "创作" }} />
            <Stack.Screen name="upload" options={{ title: "上传小说" }} />
            <Stack.Screen name="admin" options={{ title: "管理员后台" }} />
          </Stack>
          <Toast />
          
          {/* 开屏动画 - 仅首次启动显示 */}
          {showSplash && (
            <CustomSplashScreen 
              duration={1500} 
              onFinish={() => setShowSplash(false)} 
            />
          )}
        </GestureHandlerRootView>
      </ColorSchemeProvider>
    </AuthProvider>
  );
}
