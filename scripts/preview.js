/**
 * Static preview of the production build (`npm run build` → public/).
 * Serves files exactly as a static host would, using only Node built-ins.
 *
 *   npm run preview            → http://127.0.0.1:4173
 *   PORT=5000 npm run preview  → custom port
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../public');
const PORT = Number(process.env.PORT) || 4173;
const HOST = process.env.HOST || '127.0.0.1';

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.md': 'text/plain; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.glb': 'model/gltf-binary',
    '.gltf': 'model/gltf+json',
    '.bin': 'application/octet-stream',
    '.wasm': 'application/wasm',
    '.ktx2': 'image/ktx2',
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.pdf': 'application/pdf',
    '.woff2': 'font/woff2',
};

if (!fs.existsSync(ROOT)) {
    console.error('No build found. Run `npm run build` first.');
    process.exit(1);
}

const send = (res, status, body) => {
    res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(body);
};

const server = http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        return send(res, 405, 'Method Not Allowed');
    }

    let pathname;
    try {
        pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    } catch {
        return send(res, 400, 'Bad Request');
    }

    // Resolve inside ROOT only (blocks ../ traversal)
    let filePath = path.join(ROOT, path.normalize(pathname));
    if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
        return send(res, 403, 'Forbidden');
    }

    fs.stat(filePath, (err, stats) => {
        if (!err && stats.isDirectory()) {
            // Static hosts redirect /dir to /dir/ so relative URLs resolve
            if (!pathname.endsWith('/')) {
                res.writeHead(301, { Location: pathname + '/' });
                return res.end();
            }
            filePath = path.join(filePath, 'index.html');
        }

        fs.stat(filePath, (statErr, fileStats) => {
            if (statErr || !fileStats.isFile()) {
                return send(res, 404, 'Not Found');
            }
            const type =
                MIME_TYPES[path.extname(filePath).toLowerCase()] ||
                'application/octet-stream';
            res.writeHead(200, {
                'Content-Type': type,
                'Content-Length': fileStats.size,
            });
            if (req.method === 'HEAD') return res.end();
            fs.createReadStream(filePath).pipe(res);
        });
    });
});

server.listen(PORT, HOST, () => {
    console.log(`Previewing public/ at http://${HOST}:${PORT}`);
});
