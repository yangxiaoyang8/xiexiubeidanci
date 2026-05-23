# 外部访问部署指南

Web 版本已构建完成，产物在 `client/dist/` 目录。

## 快速部署（三选一）

### 方式1: Vercel（推荐）

```bash
# 1. 进入项目目录
cd client

# 2. 登录 Vercel（首次需要）
npx vercel login

# 3. 部署
npx vercel --prod
```

部署后获得链接：`https://你的项目名.vercel.app`

---

### 方式2: Netlify

```bash
# 1. 进入项目目录
cd client

# 2. 登录 Netlify（首次需要）
npx netlify login

# 3. 部署
npx netlify deploy --prod --dir=dist
```

部署后获得链接：`https://随机名称.netlify.app`

---

### 方式3: Surge（最简单）

```bash
# 1. 进入项目目录
cd client

# 2. 部署（会提示创建账号）
npx surge dist

# 3. 输入你想要的域名，如：dancixiaoshuo.surge.sh
```

---

## 一键部署脚本

```bash
# 下载项目后执行
bash deploy.sh
```

---

## 重要提醒

部署后，**后端服务也需要部署**，否则前端无法获取数据。

### 后端部署方式

后端需要部署到一个可以访问数据库的服务器：

```bash
# 构建后端
cd server
pnpm run build

# 启动
PORT=5000 pnpm run start
```

然后将后端地址配置到前端的环境变量 `EXPO_PUBLIC_BACKEND_BASE_URL` 中。

---

## 完整流程

1. **部署后端** → 获得后端 API 地址（如 `https://api.your-app.com`）
2. **修改前端配置** → 设置 `EXPO_PUBLIC_BACKEND_BASE_URL` 环境变量
3. **重新构建前端** → `cd client && npx expo export --platform web`
4. **部署前端** → 使用上述任一平台部署 `dist` 目录
