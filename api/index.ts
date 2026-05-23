import type { IncomingMessage, ServerResponse } from 'http';

type VercelRequest = IncomingMessage & {
  url?: string;
};

let appPromise: Promise<typeof import('../server/src/index.js').default> | null = null;

function getApp() {
  appPromise ??= import('../server/src/index.js').then((module) => module.default);
  return appPromise;
}

function json(res: ServerResponse, statusCode: number, body: unknown) {
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function html(res: ServerResponse, statusCode: number, body: string) {
  res.statusCode = statusCode;
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.end(body);
}

export default async function handler(req: VercelRequest, res: ServerResponse) {
  if (req.url?.startsWith('/api/v1/health')) {
    json(res, 200, { status: 'ok' });
    return;
  }

  if (req.url === '/' || req.url === '') {
    html(res, 200, '<!doctype html><html><body><h1>vercle-app is running</h1><p>API health: /api/v1/health</p></body></html>');
    return;
  }

  const app = await getApp();
  app(req, res);
}
