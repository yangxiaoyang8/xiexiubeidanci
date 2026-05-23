# PWA 部署指南（iOS/Android 通用）

## 已完成的 PWA 优化

✅ **manifest.json** - APP 名称、图标、主题色
✅ **iOS meta 标签** - 全屏运行、状态栏样式
✅ **Service Worker** - 离线缓存支持
✅ **Apple Touch Icon** - iOS 桌面图标
✅ **安全区域适配** - iOS 刘海屏适配

---

## 部署步骤

### 1. 上传文件

将 `client/dist` 文件夹上传到任意静态托管平台：

| 平台 | 费用 | 是否需要账号 |
|------|------|--------------|
| **Cloudflare Pages** | 免费 | 不需要 |
| **Netlify** | 免费 | 邮箱即可 |
| **Vercel** | 免费 | GitHub/邮箱 |

### 2. 用户安装方式

#### iOS 用户（iPhone/iPad）
1. 用 **Safari** 打开网页链接
2. 点击底部的 **分享按钮** (方框加向上箭头)
3. 向下滑动，点击 **"添加到主屏幕"**
4. 点击右上角 **"添加"**
5. 完成！桌面会出现 APP 图标

#### Android 用户
1. 用 **Chrome** 打开网页链接
2. 点击右上角 **三个点** 菜单
3. 点击 **"添加到主屏幕"** 或 **"安装应用"**
4. 完成！

---

## PWA 特性

| 特性 | 说明 |
|------|------|
| 全屏运行 | 无浏览器地址栏，体验接近原生 |
| 桌面图标 | 显示"单词小说"名称和图标 |
| 离线支持 | 已缓存页面可离线访问 |
| 启动画面 | iOS 自动生成启动画面 |

---

## 文件清单

```
client/dist/
├── index.html          # 主页面（含 PWA 配置）
├── manifest.json       # PWA 清单
├── sw.js               # Service Worker
├── favicon.ico         # 网站图标
├── assets/
│   └── images/
│       ├── icon-192.png        # Android 图标
│       ├── icon-512.png        # Android 大图标
│       └── apple-touch-icon.png # iOS 图标
└── _expo/              # Expo 打包资源
```

---

## 注意事项

⚠️ **后端服务需要单独部署**

前端部署后，需要确保后端 API 可访问。目前后端运行在沙箱环境，外部无法直接访问。

**解决方案**：
1. 将后端部署到云服务器（如 Railway、Render、Fly.io）
2. 或使用 Supabase Edge Functions

---

## 测试 PWA

部署后可以用以下工具测试：
- Chrome 开发者工具 → Application → Manifest
- https://web.dev/measure/
- iOS Safari 添加到主屏幕测试
