# 单词小说App v1.0 构建指南

## 应用信息
- **版本**: 1.0.0
- **名称**: 看小说背单词
- **描述**: 通过AI生成嵌入英语词汇的中文小说，帮助用户在阅读中学习单词

## 功能特性
- 四级、六级、雅思、托福词库支持
- AI生成小说（密码保护：888888）
- 用户上传自定义小说
- 点击英文词汇显示音标、释义和朗读
- 深色/浅色主题切换

## APK构建步骤

### 前置要求
1. 安装 Node.js (推荐 v18+)
2. 安装 EAS CLI: `npm install -g eas-cli`
3. 拥有 Expo 账号 (https://expo.dev)

### 构建命令

```bash
# 1. 进入项目目录
cd client

# 2. 登录 Expo 账号
eas login

# 3. 配置项目（首次构建需要）
eas build:configure

# 4. 构建 APK（生产版本）
eas build --platform android --profile production

# 5. 下载 APK
# 构建完成后，从 Expo 控制台下载 APK 文件
# 或使用命令: eas build:list
```

### 构建配置说明
- **production**: 生产版本 APK（推荐）
- **preview**: 预览版本 APK（用于测试）
- **development**: 开发客户端（用于调试）

## 环境变量
构建时需要设置以下环境变量：
- `EXPO_PUBLIC_BACKEND_BASE_URL`: 后端服务地址

## 注意事项
1. 首次构建可能需要较长时间（10-20分钟）
2. 构建在 Expo 云端进行，需要网络连接
3. APK 文件会自动签名，可直接安装

## 安装测试
1. 下载 APK 文件
2. 在 Android 设备上开启"允许安装未知来源应用"
3. 安装并运行

---
构建日期: 2026-03-29
