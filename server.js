const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8888;
const ROOT_DIR = __dirname;
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

function serveFile(res, filePath) {
  if (fs.existsSync(filePath)) {
    const mimeType = getMimeType(filePath);
    const content = fs.readFileSync(filePath);
    const contentType = mimeType.startsWith('text/') || mimeType === 'application/javascript' || mimeType === 'application/json'
      ? `${mimeType}; charset=utf-8`
      : mimeType;
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'File not found' }));
  }
}

const server = http.createServer((req, res) => {
  const requestPath = new URL(req.url, `http://localhost:${PORT}`).pathname;
  const relativePath = requestPath === '/' ? 'index.html' : decodeURIComponent(requestPath).replace(/^\/+/, '');
  const normalizedPath = path.normalize(relativePath);
  const fullFilePath = path.resolve(ROOT_DIR, normalizedPath);

  if (!fullFilePath.startsWith(ROOT_DIR + path.sep) && fullFilePath !== path.join(ROOT_DIR, 'index.html')) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Forbidden' }));
    return;
  }

  serveFile(res, fullFilePath);
});

server.listen(PORT, () => {
  console.log(`QIRA Peptide Site running at http://localhost:${PORT}`);
});
