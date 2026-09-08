// 本地开发静态服务器 (零依赖, 用于浏览器预览/测试)
// 用法: node tools/dev-server.js [端口]   默认 8080
// 同时托管两个根目录:
//   /                 -> 项目根 chronicle (前端页面)
//   /chronicle-data/  -> 同级数据仓库 chronicle-data (图标/视频等资源)
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.argv[2], 10) || 8080;
const ROOT = path.resolve(__dirname, '..');
const DATA_ROOT = path.resolve(__dirname, '..', '..', 'chronicle-data');

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.mp4': 'video/mp4',
    '.svg': 'image/svg+xml'
};

// 解析请求 URL -> { root, rel } (rel 为相对 root 的路径)
function resolveRoute(urlPath) {
    if (urlPath === '/chronicle-data' || urlPath.startsWith('/chronicle-data/')) {
        let rel = urlPath.slice('/chronicle-data'.length);
        if (rel === '' || rel === '/') rel = '/index.html';
        return { root: DATA_ROOT, rel };
    }
    let rel = urlPath;
    if (rel === '/') rel = '/index.html';
    return { root: ROOT, rel };
}

http.createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    const route = resolveRoute(urlPath);
    const filePath = path.normalize(path.join(route.root, route.rel));

    // 防目录穿越
    if (!filePath.startsWith(route.root)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Forbidden');
        return;
    }

    fs.stat(filePath, (err, stat) => {
        if (err || !stat.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404 Not Found: ' + urlPath);
            return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, {
            'Content-Type': MIME[ext] || 'application/octet-stream',
            'Cache-Control': 'no-cache'
        });
        fs.createReadStream(filePath).pipe(res);
    });
}).listen(PORT, () => {
    console.log(`Chronicle dev server: http://localhost:${PORT}`);
    console.log(`  frontend: http://localhost:${PORT}/            (${ROOT})`);
    console.log(`  data    : http://localhost:${PORT}/chronicle-data/ (${DATA_ROOT})`);
});
