import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import type { RequestHandler, Router } from "express";

// ES模块中获取__dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 9091;

function lazyRouter(loader: () => Promise<{ default: Router }>): RequestHandler {
  let routerPromise: Promise<Router> | null = null;

  return async (req, res, next) => {
    try {
      routerPromise ??= loader().then((module) => module.default);
      const router = await routerPromise;
      (router as any).handle(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health check
app.get('/api/v1/health', (req, res) => {
  console.log('Health check success');
  res.status(200).json({ status: 'ok' });
});

// 注册路由
app.use('/api/v1/vocab-books', lazyRouter(() => import('./routes/vocab-books.js')));
app.use('/api/v1/words', lazyRouter(() => import('./routes/words.js')));
app.use('/api/v1/novels', lazyRouter(() => import('./routes/novels.js')));
app.use('/api/v1/user-novels', lazyRouter(() => import('./routes/user-novels.js')));
app.use('/api/v1/tts', lazyRouter(() => import('./routes/tts.js')));
app.use('/api/v1/novel-upload', lazyRouter(() => import('./routes/novel-upload.js')));
app.use('/api/v1/audio-pack', lazyRouter(() => import('./routes/audio-pack.js')));
app.use('/api/v1/admin', lazyRouter(() => import('./routes/admin.js')));
app.use('/api/v1/auth', lazyRouter(() => import('./routes/auth.js')));

// 托管前端静态文件（生产环境）
// 开发环境：前端文件在 ../../client/dist
// 生产环境：前端文件被复制到 ./client-dist（相对于server/dist/index.js）
const clientDistPath = fs.existsSync(path.join(__dirname, 'client-dist'))
  ? path.join(__dirname, 'client-dist')
  : path.join(__dirname, '../../client/dist');

console.log('[Server] Frontend static files path:', clientDistPath);
console.log('[Server] Frontend files exist:', fs.existsSync(clientDistPath));

app.use(express.static(clientDistPath));

// 所有非API请求返回前端页面（支持SPA路由）
app.get('*', (req, res, next) => {
  // 跳过API路由
  if (req.path.startsWith('/api/')) {
    return next();
  }
  const indexPath = path.join(clientDistPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Frontend files not found. Please rebuild the project.');
  }
});

if (process.env.RUN_SERVER === '1') {
  app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}/`);
  });
}

export default app;
