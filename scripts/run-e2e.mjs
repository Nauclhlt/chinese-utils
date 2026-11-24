import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const distDir = path.resolve(process.cwd(), 'dist');
const prefix = '/chinese-utils/';
const port = 4173;

const mimeMap = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  const urlPath = (req.url || '/').split('?')[0];
  let rel = urlPath.startsWith(prefix) ? urlPath.slice(prefix.length) : urlPath.replace(/^\//, '');
  if (!rel || rel === '/') rel = 'index.html';
  const filePath = path.join(distDir, rel);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': mimeMap[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
console.log(`Serving ${distDir} at http://127.0.0.1:${port}${prefix}`);

try {
  const exitCode = await new Promise((resolve) => {
    const child = spawn('npx', ['playwright', 'test'], {
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        E2E_BASE_URL: `http://127.0.0.1:${port}${prefix}index.html`,
      },
    });
    child.on('exit', (code) => resolve(code ?? 1));
    child.on('error', () => resolve(1));
  });
  process.exitCode = exitCode;
} finally {
  server.close();
}
