import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, Text, TextInput, Alert, RefreshControl, Platform } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { Screen } from '@/components/Screen';
import { useTheme } from '@/hooks/useTheme';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { FontAwesome6 } from '@expo/vector-icons';
import { createStyles } from './styles';
import { buildApiUrl } from '@/utils/api';
import Toast from 'react-native-toast-message';

// 兼容 Web 和 Mobile 的提示函数
const showToast = (type: 'success' | 'error', message: string) => {
  if (Platform.OS === 'web') {
    Toast.show({
      type,
      text1: type === 'success' ? '成功' : '错误',
      text2: message,
    });
  } else {
    Alert.alert(type === 'success' ? '成功' : '错误', message);
  }
};

// 兼容 Web 和 Mobile 的确认对话框
const showConfirm = (
  title: string,
  message: string,
  onConfirm: () => void
) => {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
  } else {
    Alert.alert(
      title,
      message,
      [
        { text: '取消', style: 'cancel' },
        { text: '确定', style: 'destructive', onPress: onConfirm },
      ]
    );
  }
};

interface VipUser {
  id: string;
  device_id: string | null;
  user_id: string | null;
  remark: string | null;
  created_at: string;
}

interface GenerateLimit {
  device_id: string;
  week_start: string;
  count: number;
}

interface UploadLimit {
  device_id: string;
  week_start: string;
  count: number;
}

interface Settings {
  auth_password?: string;
  admin_password?: string;
  weekly_upload_limit?: string;
  weekly_generate_limit?: string;
  max_file_size_kb?: string;
  quick_mode_analyze_chars?: string;
}

export default function AdminScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  
  const [activeTab, setActiveTab] = useState<'vip' | 'password' | 'stats' | 'settings'>('vip');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // VIP管理
  const [vipUsers, setVipUsers] = useState<VipUser[]>([]);
  const [newDeviceId, setNewDeviceId] = useState('');
  const [newRemark, setNewRemark] = useState('');
  
  // 密码管理
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // 管理员密码
  const [currentAdminPassword, setCurrentAdminPassword] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [confirmAdminPassword, setConfirmAdminPassword] = useState('');
  
  // 统计数据
  const [generateLimits, setGenerateLimits] = useState<GenerateLimit[]>([]);
  const [uploadLimits, setUploadLimits] = useState<UploadLimit[]>([]);
  const [searchDeviceId, setSearchDeviceId] = useState('');
  
  // 配置管理
  const [settings, setSettings] = useState<Settings>({});
  const [editingSettings, setEditingSettings] = useState<Settings>({});
  
  // 获取VIP用户列表
  const fetchVipUsers = useCallback(async () => {
    try {
      const response = await fetch(buildApiUrl('/api/v1/admin/vip-users'));
      const result = await response.json();
      
      if (result.data) {
        setVipUsers(result.data);
      }
    } catch (error) {
      console.error('获取VIP用户失败:', error);
    }
  }, []);
  
  // 获取生成次数统计
  const fetchGenerateLimits = useCallback(async () => {
    try {
      const response = await fetch(buildApiUrl('/api/v1/admin/generate-limits'));
      const result = await response.json();
      
      if (result.data) {
        setGenerateLimits(result.data);
      }
    } catch (error) {
      console.error('获取生成次数统计失败:', error);
    }
  }, []);
  
  // 获取上传次数统计
  const fetchUploadLimits = useCallback(async () => {
    try {
      const response = await fetch(buildApiUrl('/api/v1/admin/upload-limits'));
      const result = await response.json();
      
      if (result.data) {
        setUploadLimits(result.data);
      }
    } catch (error) {
      console.error('获取上传次数统计失败:', error);
    }
  }, []);
  
  // 获取当前授权密码
  const fetchCurrentPassword = useCallback(async () => {
    try {
      const response = await fetch(buildApiUrl('/api/v1/admin/unlock-password'));
      const result = await response.json();
      
      if (result.data) {
        setCurrentPassword(result.data.password);
      }
    } catch (error) {
      console.error('获取授权密码失败:', error);
    }
  }, []);
  
  // 获取系统配置
  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch(buildApiUrl('/api/v1/admin/settings'));
      const result = await response.json();
      
      if (result.data) {
        setSettings(result.data);
        setEditingSettings(result.data);
        // 从设置中获取管理员密码
        setCurrentAdminPassword(result.data.admin_password || '未设置');
      }
    } catch (error) {
      console.error('获取系统配置失败:', error);
    }
  }, []);
  
  useEffect(() => {
    setLoading(true);
    Promise.all([fetchVipUsers(), fetchGenerateLimits(), fetchUploadLimits(), fetchCurrentPassword(), fetchSettings()])
      .finally(() => setLoading(false));
  }, []);
  
  const handleRefresh = () => {
    setRefreshing(true);
    Promise.all([fetchVipUsers(), fetchGenerateLimits(), fetchUploadLimits(), fetchCurrentPassword(), fetchSettings()])
      .finally(() => setRefreshing(false));
  };
  
  // 添加VIP用户
  const handleAddVip = async () => {
    if (!newDeviceId.trim()) {
      showToast('error', '请输入用户ID');
      return;
    }
    
    try {
      // 判断输入的是用户名还是设备ID
      // 如果是UUID格式，当作user_id；否则当作device_id
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(newDeviceId.trim());
      const body: any = { remark: newRemark };
      
      if (isUuid) {
        body.user_id = newDeviceId.trim();
      } else {
        body.device_id = newDeviceId.trim();
      }
      
      const response = await fetch(buildApiUrl('/api/v1/admin/vip-users'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setNewDeviceId('');
        setNewRemark('');
        fetchVipUsers();
        showToast('success', 'VIP用户添加成功');
      } else {
        showToast('error', result.error || '添加失败');
      }
    } catch (error) {
      console.error('添加VIP用户失败:', error);
      showToast('error', '网络错误');
    }
  };
  
  // 删除VIP用户
  const handleDeleteVip = async (deviceId: string) => {
    showConfirm(
      '确认删除',
      '确定要移除该VIP用户吗？',
      async () => {
        try {
          const response = await fetch(buildApiUrl(`/api/v1/admin/vip-users/${encodeURIComponent(deviceId)}`), {
            method: 'DELETE',
          });
          
          const result = await response.json();
          
          if (result.success) {
            fetchVipUsers();
            showToast('success', 'VIP用户已移除');
          } else {
            showToast('error', result.error || '删除失败');
          }
        } catch (error) {
          console.error('删除VIP用户失败:', error);
          showToast('error', '网络错误');
        }
      }
    );
  };
  
  // 修改授权密码
  const handleChangePassword = async () => {
    if (!newPassword.trim() || !confirmPassword.trim()) {
      showToast('error', '请输入新密码');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      showToast('error', '两次输入的密码不一致');
      return;
    }
    
    if (newPassword.length < 4) {
      showToast('error', '密码长度至少4位');
      return;
    }
    
    try {
      const response = await fetch(buildApiUrl('/api/v1/admin/unlock-password'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_password: newPassword }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setCurrentPassword(newPassword);
        setNewPassword('');
        setConfirmPassword('');
        showToast('success', '授权密码已更新');
      } else {
        showToast('error', result.error || '修改失败');
      }
    } catch (error) {
      console.error('修改授权密码失败:', error);
      showToast('error', '网络错误');
    }
  };
  
  // 修改管理员密码
  const handleChangeAdminPassword = async () => {
    if (!newAdminPassword.trim() || !confirmAdminPassword.trim()) {
      showToast('error', '请输入新密码');
      return;
    }
    
    if (newAdminPassword !== confirmAdminPassword) {
      showToast('error', '两次输入的密码不一致');
      return;
    }
    
    if (newAdminPassword.length < 4) {
      showToast('error', '密码长度至少4位');
      return;
    }
    
    try {
      const response = await fetch(buildApiUrl('/api/v1/admin/admin-password'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_password: newAdminPassword }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setCurrentAdminPassword(newAdminPassword);
        setNewAdminPassword('');
        setConfirmAdminPassword('');
        showToast('success', '管理员密码已更新');
      } else {
        showToast('error', result.error || '修改失败');
      }
    } catch (error) {
      console.error('修改管理员密码失败:', error);
      showToast('error', '网络错误');
    }
  };
  
  // 保存系统配置
  const handleSaveSettings = async () => {
    try {
      const response = await fetch(buildApiUrl('/api/v1/admin/settings'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: editingSettings }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setSettings(editingSettings);
        showToast('success', '配置已保存');
      } else {
        showToast('error', result.error || '保存失败');
      }
    } catch (error) {
      console.error('保存配置失败:', error);
      showToast('error', '网络错误');
    }
  };
  
  // 重置生成次数
  const handleResetGenerateLimit = async (deviceId: string) => {
    try {
      const response = await fetch(buildApiUrl('/api/v1/admin/reset-generate-limit'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        fetchGenerateLimits();
        showToast('success', '生成次数已重置');
      } else {
        showToast('error', result.error || '重置失败');
      }
    } catch (error) {
      console.error('重置生成次数失败:', error);
      showToast('error', '网络错误');
    }
  };
  
  // 重置上传次数
  const handleResetUploadLimit = async (deviceId: string) => {
    try {
      const response = await fetch(buildApiUrl('/api/v1/admin/reset-upload-limit'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        fetchUploadLimits();
        showToast('success', '上传次数已重置');
      } else {
        showToast('error', result.error || '重置失败');
      }
    } catch (error) {
      console.error('重置上传次数失败:', error);
      showToast('error', '网络错误');
    }
  };
  
  // 渲染VIP管理页面
  const renderVipTab = () => (
    <View style={styles.tabContent}>
      {/* 添加VIP用户表单 */}
      <View style={styles.formCard}>
        <ThemedText variant="h4" style={styles.formTitle}>添加VIP用户</ThemedText>
        
        <TextInput
          style={[styles.input, { backgroundColor: theme.backgroundTertiary, color: theme.textPrimary }]}
          placeholder="用户名、用户ID或设备ID"
          placeholderTextColor={theme.textMuted}
          value={newDeviceId}
          onChangeText={setNewDeviceId}
        />
        
        <TextInput
          style={[styles.input, { backgroundColor: theme.backgroundTertiary, color: theme.textPrimary }]}
          placeholder="备注（可选）"
          placeholderTextColor={theme.textMuted}
          value={newRemark}
          onChangeText={setNewRemark}
        />
        
        <TouchableOpacity style={[styles.button, { backgroundColor: theme.primary }]} onPress={handleAddVip}>
          <FontAwesome6 name="plus" size={16} color="#FFFFFF" />
          <Text style={styles.buttonText}>添加VIP</Text>
        </TouchableOpacity>
      </View>
      
      {/* VIP用户列表 */}
      <View style={styles.listCard}>
        <ThemedText variant="h4" style={styles.formTitle}>VIP用户列表 ({vipUsers.length})</ThemedText>
        
        {vipUsers.length === 0 ? (
          <ThemedText variant="body" color={theme.textMuted} style={styles.emptyText}>
            暂无VIP用户
          </ThemedText>
        ) : (
          vipUsers.map((user) => {
            // 优先使用后端返回的 display_id（用户名），其次使用 user_id 或 device_id
            const displayId = user.display_id || user.user_id || user.device_id || '未知用户';
            const deleteId = user.user_id || user.device_id || '';
            return (
              <View key={user.id} style={styles.listItem}>
                <View style={styles.listItemContent}>
                  <ThemedText variant="bodyMedium" style={styles.deviceIdText}>
                    {displayId.length > 20 ? displayId.substring(0, 20) + '...' : displayId}
                  </ThemedText>
                  {user.remark && (
                    <ThemedText variant="caption" color={theme.textSecondary}>
                      {user.remark}
                    </ThemedText>
                  )}
                </View>
                <TouchableOpacity 
                  style={styles.deleteButton} 
                  onPress={() => handleDeleteVip(deleteId)}
                >
                  <FontAwesome6 name="trash" size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </View>
    </View>
  );
  
  // 渲染密码管理页面
  const renderPasswordTab = () => (
    <View style={styles.tabContent}>
      {/* 授权密码管理 */}
      <View style={styles.formCard}>
        <ThemedText variant="h4" style={styles.formTitle}>授权密码管理</ThemedText>
        <ThemedText variant="caption" color={theme.textSecondary} style={styles.statsNote}>
          用于解锁创作功能的密码
        </ThemedText>
        
        <View style={styles.currentPasswordRow}>
          <ThemedText variant="body" color={theme.textSecondary}>当前密码：</ThemedText>
          <ThemedText variant="bodyMedium" style={styles.currentPasswordValue}>{currentPassword}</ThemedText>
        </View>
        
        <TextInput
          style={[styles.input, { backgroundColor: theme.backgroundTertiary, color: theme.textPrimary }]}
          placeholder="新密码"
          placeholderTextColor={theme.textMuted}
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
        />
        
        <TextInput
          style={[styles.input, { backgroundColor: theme.backgroundTertiary, color: theme.textPrimary }]}
          placeholder="确认新密码"
          placeholderTextColor={theme.textMuted}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />
        
        <TouchableOpacity style={[styles.button, { backgroundColor: theme.primary }]} onPress={handleChangePassword}>
          <FontAwesome6 name="key" size={16} color="#FFFFFF" />
          <Text style={styles.buttonText}>更新授权密码</Text>
        </TouchableOpacity>
      </View>
      
      {/* 管理员密码管理 */}
      <View style={styles.formCard}>
        <ThemedText variant="h4" style={styles.formTitle}>管理员密码管理</ThemedText>
        <ThemedText variant="caption" color={theme.textSecondary} style={styles.statsNote}>
          用于进入管理员后台的密码（连续点击首页标题5次触发）
        </ThemedText>
        
        <View style={styles.currentPasswordRow}>
          <ThemedText variant="body" color={theme.textSecondary}>当前密码：</ThemedText>
          <ThemedText variant="bodyMedium" style={styles.currentPasswordValue}>{currentAdminPassword}</ThemedText>
        </View>
        
        <TextInput
          style={[styles.input, { backgroundColor: theme.backgroundTertiary, color: theme.textPrimary }]}
          placeholder="新管理员密码"
          placeholderTextColor={theme.textMuted}
          value={newAdminPassword}
          onChangeText={setNewAdminPassword}
          secureTextEntry
        />
        
        <TextInput
          style={[styles.input, { backgroundColor: theme.backgroundTertiary, color: theme.textPrimary }]}
          placeholder="确认新管理员密码"
          placeholderTextColor={theme.textMuted}
          value={confirmAdminPassword}
          onChangeText={setConfirmAdminPassword}
          secureTextEntry
        />
        
        <TouchableOpacity style={[styles.button, { backgroundColor: theme.primary }]} onPress={handleChangeAdminPassword}>
          <FontAwesome6 name="shield" size={16} color="#FFFFFF" />
          <Text style={styles.buttonText}>更新管理员密码</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
  
  // 渲染统计页面
  const renderStatsTab = () => {
    // 过滤数据
    const filteredGenerateLimits = searchDeviceId.trim() 
      ? generateLimits.filter(item => item.device_id.includes(searchDeviceId.trim()))
      : generateLimits;
    
    const filteredUploadLimits = searchDeviceId.trim()
      ? uploadLimits.filter(item => item.device_id.includes(searchDeviceId.trim()))
      : uploadLimits;
    
    return (
      <View style={styles.tabContent}>
        {/* 搜索框 */}
        <View style={styles.formCard}>
          <ThemedText variant="h4" style={styles.formTitle}>搜索设备</ThemedText>
          <TextInput
            style={[styles.input, { backgroundColor: theme.backgroundTertiary, color: theme.textPrimary }]}
            placeholder="输入设备ID进行搜索..."
            placeholderTextColor={theme.textMuted}
            value={searchDeviceId}
            onChangeText={setSearchDeviceId}
          />
          {searchDeviceId.trim() && (
            <TouchableOpacity 
              style={[styles.clearSearchButton, { backgroundColor: theme.backgroundTertiary }]} 
              onPress={() => setSearchDeviceId('')}
            >
              <FontAwesome6 name="xmark" size={14} color={theme.textSecondary} />
              <Text style={[styles.clearSearchText, { color: theme.textSecondary }]}>清除搜索</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {/* 生成次数统计 */}
        <View style={styles.formCard}>
          <ThemedText variant="h4" style={styles.formTitle}>生成次数统计 ({filteredGenerateLimits.length})</ThemedText>
          <ThemedText variant="caption" color={theme.textSecondary} style={styles.statsNote}>
            显示本周各设备的生成次数
          </ThemedText>
          
          {filteredGenerateLimits.length === 0 ? (
            <ThemedText variant="body" color={theme.textMuted} style={styles.emptyText}>
              {searchDeviceId.trim() ? '未找到匹配的设备' : '暂无数据'}
            </ThemedText>
          ) : (
            filteredGenerateLimits.map((item, index) => {
              const displayId = item.device_id || '未知用户';
              return (
                <View key={index} style={styles.statItem}>
                  <View style={styles.statItemLeft}>
                    <ThemedText variant="smallMedium" style={styles.deviceIdText}>
                      {displayId.length > 25 ? displayId.substring(0, 25) + '...' : displayId}
                    </ThemedText>
                    <ThemedText variant="caption" color={theme.textMuted}>
                      周期：{item.week_start}
                    </ThemedText>
                  </View>
                  <View style={styles.statItemRight}>
                    <View style={styles.countBadge}>
                      <ThemedText variant="bodyMedium" style={styles.countText}>{item.count}/{settings.weekly_generate_limit || '3'}</ThemedText>
                    </View>
                    <TouchableOpacity 
                      style={styles.resetButton}
                      onPress={() => handleResetGenerateLimit(item.device_id)}
                    >
                      <FontAwesome6 name="rotate" size={14} color={theme.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
        
        {/* 上传次数统计 */}
        <View style={styles.formCard}>
          <ThemedText variant="h4" style={styles.formTitle}>上传次数统计 ({filteredUploadLimits.length})</ThemedText>
          <ThemedText variant="caption" color={theme.textSecondary} style={styles.statsNote}>
            显示本周各设备的上传次数
          </ThemedText>
          
          {filteredUploadLimits.length === 0 ? (
            <ThemedText variant="body" color={theme.textMuted} style={styles.emptyText}>
              {searchDeviceId.trim() ? '未找到匹配的设备' : '暂无数据'}
            </ThemedText>
          ) : (
            filteredUploadLimits.map((item, index) => {
              const displayId = item.device_id || '未知用户';
              return (
                <View key={index} style={styles.statItem}>
                  <View style={styles.statItemLeft}>
                    <ThemedText variant="smallMedium" style={styles.deviceIdText}>
                      {displayId.length > 25 ? displayId.substring(0, 25) + '...' : displayId}
                    </ThemedText>
                    <ThemedText variant="caption" color={theme.textMuted}>
                      周期：{item.week_start}
                    </ThemedText>
                  </View>
                  <View style={styles.statItemRight}>
                    <View style={styles.countBadge}>
                      <ThemedText variant="bodyMedium" style={styles.countText}>{item.count}/{settings.weekly_upload_limit || '2'}</ThemedText>
                    </View>
                    <TouchableOpacity 
                      style={styles.resetButton}
                      onPress={() => handleResetUploadLimit(item.device_id)}
                    >
                      <FontAwesome6 name="rotate" size={14} color={theme.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </View>
    );
  };
  
  // 渲染配置管理页面
  const renderSettingsTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.formCard}>
        <ThemedText variant="h4" style={styles.formTitle}>系统配置</ThemedText>
        <ThemedText variant="caption" color={theme.textSecondary} style={styles.statsNote}>
          修改系统限制参数
        </ThemedText>
        
        {/* 每周生成次数限制 */}
        <View style={styles.settingRow}>
          <ThemedText variant="body" style={styles.settingLabel}>每周生成次数限制</ThemedText>
          <TextInput
            style={[styles.settingInput, { backgroundColor: theme.backgroundTertiary, color: theme.textPrimary }]}
            value={editingSettings.weekly_generate_limit || ''}
            onChangeText={(text) => setEditingSettings(prev => ({ ...prev, weekly_generate_limit: text }))}
            keyboardType="numeric"
            placeholder="3"
            placeholderTextColor={theme.textMuted}
          />
        </View>
        
        {/* 每周上传次数限制 */}
        <View style={styles.settingRow}>
          <ThemedText variant="body" style={styles.settingLabel}>每周上传次数限制</ThemedText>
          <TextInput
            style={[styles.settingInput, { backgroundColor: theme.backgroundTertiary, color: theme.textPrimary }]}
            value={editingSettings.weekly_upload_limit || ''}
            onChangeText={(text) => setEditingSettings(prev => ({ ...prev, weekly_upload_limit: text }))}
            keyboardType="numeric"
            placeholder="2"
            placeholderTextColor={theme.textMuted}
          />
        </View>
        
        {/* 文件大小限制 */}
        <View style={styles.settingRow}>
          <ThemedText variant="body" style={styles.settingLabel}>文件大小限制 (KB)</ThemedText>
          <TextInput
            style={[styles.settingInput, { backgroundColor: theme.backgroundTertiary, color: theme.textPrimary }]}
            value={editingSettings.max_file_size_kb || ''}
            onChangeText={(text) => setEditingSettings(prev => ({ ...prev, max_file_size_kb: text }))}
            keyboardType="numeric"
            placeholder="200"
            placeholderTextColor={theme.textMuted}
          />
        </View>
        
        {/* 快速模式分析字数 */}
        <View style={styles.settingRow}>
          <ThemedText variant="body" style={styles.settingLabel}>快速模式分析字数</ThemedText>
          <TextInput
            style={[styles.settingInput, { backgroundColor: theme.backgroundTertiary, color: theme.textPrimary }]}
            value={editingSettings.quick_mode_analyze_chars || ''}
            onChangeText={(text) => setEditingSettings(prev => ({ ...prev, quick_mode_analyze_chars: text }))}
            keyboardType="numeric"
            placeholder="5000"
            placeholderTextColor={theme.textMuted}
          />
        </View>
        
        <TouchableOpacity style={[styles.button, { backgroundColor: theme.primary, marginTop: 16 }]} onPress={handleSaveSettings}>
          <FontAwesome6 name="save" size={16} color="#FFFFFF" />
          <Text style={styles.buttonText}>保存配置</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
  
  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle="light">
      {/* 头部 */}
      <View style={[styles.header, { backgroundColor: theme.primary }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/');
          }
        }}>
          <FontAwesome6 name="arrow-left" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>管理员后台</ThemedText>
        <View style={styles.placeholder} />
      </View>
      
      {/* Tab栏 */}
      <View style={[styles.tabBar, { backgroundColor: theme.backgroundDefault }]}>
        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'vip' && styles.tabItemActive]} 
          onPress={() => setActiveTab('vip')}
        >
          <FontAwesome6 name="crown" size={18} color={activeTab === 'vip' ? theme.primary : theme.textMuted} />
          <ThemedText variant="smallMedium" color={activeTab === 'vip' ? theme.primary : theme.textMuted}>
            VIP管理
          </ThemedText>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'password' && styles.tabItemActive]} 
          onPress={() => setActiveTab('password')}
        >
          <FontAwesome6 name="key" size={18} color={activeTab === 'password' ? theme.primary : theme.textMuted} />
          <ThemedText variant="smallMedium" color={activeTab === 'password' ? theme.primary : theme.textMuted}>
            密码管理
          </ThemedText>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'stats' && styles.tabItemActive]} 
          onPress={() => setActiveTab('stats')}
        >
          <FontAwesome6 name="chart-simple" size={18} color={activeTab === 'stats' ? theme.primary : theme.textMuted} />
          <ThemedText variant="smallMedium" color={activeTab === 'stats' ? theme.primary : theme.textMuted}>
            数据统计
          </ThemedText>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'settings' && styles.tabItemActive]} 
          onPress={() => setActiveTab('settings')}
        >
          <FontAwesome6 name="gear" size={18} color={activeTab === 'settings' ? theme.primary : theme.textMuted} />
          <ThemedText variant="smallMedium" color={activeTab === 'settings' ? theme.primary : theme.textMuted}>
            配置管理
          </ThemedText>
        </TouchableOpacity>
      </View>
      
      {/* 内容区域 */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <ScrollView 
          style={styles.content} 
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />}
        >
          {activeTab === 'vip' && renderVipTab()}
          {activeTab === 'password' && renderPasswordTab()}
          {activeTab === 'stats' && renderStatsTab()}
          {activeTab === 'settings' && renderSettingsTab()}
        </ScrollView>
      )}
      <Toast />
    </Screen>
  );
}
