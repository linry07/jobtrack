import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import handler from './api/extract-job';

function apiMiddlewarePlugin(): Plugin {
  return {
    name: 'api-extract-job-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.startsWith('/api/extract-job')) {
          // Read request body for POST
          if (req.method === 'POST') {
            const chunks: Buffer[] = [];
            req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
            req.on('end', async () => {
              try {
                const bodyStr = Buffer.concat(chunks).toString('utf-8');
                const parsedBody = bodyStr ? JSON.parse(bodyStr) : {};
                (req as any).body = parsedBody;

                // Mock Vercel response helpers if not present
                const vercelRes: any = res;
                vercelRes.status = (statusCode: number) => {
                  res.statusCode = statusCode;
                  return vercelRes;
                };
                vercelRes.json = (data: any) => {
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify(data));
                  return vercelRes;
                };

                await handler(req as any, vercelRes);
              } catch (err: any) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err.message || 'Server error' }));
              }
            });
            return;
          }

          // Options or other
          const vercelRes: any = res;
          vercelRes.status = (statusCode: number) => {
            res.statusCode = statusCode;
            return vercelRes;
          };
          vercelRes.json = (data: any) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
            return vercelRes;
          };
          await handler(req as any, vercelRes);
          return;
        }
        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), apiMiddlewarePlugin()],
});
