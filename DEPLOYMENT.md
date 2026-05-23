# 部署指南

## 一、Web 版本部署（已完成构建）

Web 版本已构建完成，产物在 `client/dist/` 目录。

### 部署方式

#### 方式1: 部署到 Vercel（推荐，免费）

```bash
# 1. 安装 Vercel CLI
npm i -g vercel

# 2. 进入项目目录
cd client

# 3. 部署
vercel --prod
```

部署后会获得一个永久访问链接，如 `https://your-app.vercel.app`

#### 方式2: 部署到 Netlify（免费）

```bash
# 1. 安装 Netlify CLI
npm i -g netlify-cli

# 2. 进入项目目录
cd client

# 3. 部署
netlify deploy --prod --dir=dist
```

#### 方式3: 部署到任意静态服务器

将 `client/dist/` 目录下的所有文件上传到你的服务器即可。

---

## 二、Android APK 构建

### 前置要求
- 需要 Expo 账号（免费注册：https://expo.dev）

### 步骤1: 登录 Expo 账号

```bash
cd client

# 登录 Expo
npx eas login

# 按提示输入用户名和密码
```

### 步骤2: 构建 APK

```bash
# 构建 Android APK（约 5-10 分钟）
npx eas build --platform android --profile preview
```

### 步骤3: 下载 APK

构建完成后：
1. 终端会显示下载链接
2. 或访问 https://expo.dev/accounts/[你的用户名]/projects/[项目名]/builds
3. 下载 `.apk` 文件

### 步骤4: 分发给用户

用户只需：
1. 下载 APK 文件
2. 在 Android 手机上打开
3. 允许"安装未知来源应用"
4. 完成安装

---

## 三、iOS 版本（需要 Apple 开发者账号，$99/年）

```bash
cd client
npx eas build --platform ios
```

---

## 常见问题

### Q: EAS 构建失败？
检查 `eas.json` 配置是否正确，确保 `app.config.ts` 中的 `android.package` 格式正确。

### Q: Web 版本访问后端 API 失败？
确保后端服务已部署，并检查 `EXPO_PUBLIC_BACKEND_BASE_URL` 环境变量。

### Q: APK 安装失败？
确保手机开启了"允许安装未知来源应用"选项。

---

## 当前项目配置

- 应用名称: 单词小说
- Android 包名: 见 `app.config.ts` 中的 `android.package`
- 已配置权限: 相机、相册、位置、麦克风
