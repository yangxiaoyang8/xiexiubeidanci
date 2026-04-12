import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import vocabBooksRouter from './routes/vocab-books';
import wordsRouter from './routes/words';
import novelsRouter from './routes/novels';
import userNovelsRouter from './routes/user-novels';
import ttsRouter from './routes/tts';
import novelUploadRouter from './routes/novel-upload';
import audioPackRouter from './routes/audio-pack';
import adminRouter from './routes/admin';
import authRouter from './routes/auth';

// ES模块中获取__dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 9091;

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
app.use('/api/v1/vocab-books', vocabBooksRouter);
app.use('/api/v1/words', wordsRouter);
app.use('/api/v1/novels', novelsRouter);
app.use('/api/v1/user-novels', userNovelsRouter);
app.use('/api/v1/tts', ttsRouter);
app.use('/api/v1/novel-upload', novelUploadRouter);
app.use('/api/v1/audio-pack', audioPackRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/auth', authRouter);

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

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}/`);
});
