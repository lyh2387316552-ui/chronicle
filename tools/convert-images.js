#!/usr/bin/env node
/**
 * Convert image resources to WebP.
 *
 * Usage:
 *   node convert-images.js <directory> [directory ...]
 *   node convert-images.js <directory> --keep-source
 *
 * By default the original raster files are removed only after their WebP
 * replacement has been written successfully. Existing newer WebP files are
 * kept, so running this script on every sync is safe and incremental.
 */
const fs = require('fs');
const path = require('path');

const SOURCE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tif', '.tiff']);
const KEEP_SOURCE = process.argv.includes('--keep-source');
const ROOTS = process.argv.slice(2).filter(arg => !arg.startsWith('--'));

function loadSharp() {
    const candidates = [
        'sharp',
        path.resolve(__dirname, '..', 'node_modules', 'sharp'),
        path.resolve(path.dirname(process.execPath), '..', 'node_modules', 'sharp'),
        path.resolve(process.env.USERPROFILE || '', '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', 'sharp')
    ];
    for (const candidate of candidates) {
        try {
            return require(candidate);
        } catch (_) {
            // Try the next known runtime location.
        }
    }
    throw new Error('找不到 sharp 图片转换库。请使用项目配置的 Node.js 运行时，或先安装 sharp。');
}

function collectFiles(root, result = []) {
    if (!fs.existsSync(root)) return result;
    const stat = fs.statSync(root);
    if (stat.isFile()) {
        result.push(root);
        return result;
    }
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        if (entry.name === '.git' || entry.name === 'node_modules') continue;
        const full = path.join(root, entry.name);
        if (entry.isDirectory()) collectFiles(full, result);
        else if (entry.isFile()) result.push(full);
    }
    return result;
}

function formatBytes(value) {
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

async function convertOne(sharp, source) {
    const ext = path.extname(source).toLowerCase();
    const target = path.join(path.dirname(source), `${path.basename(source, ext)}.webp`);
    const sourceStat = fs.statSync(source);

    if (fs.existsSync(target) && fs.statSync(target).mtimeMs >= sourceStat.mtimeMs) {
        if (!KEEP_SOURCE) fs.unlinkSync(source);
        return { status: 'skipped', source, target };
    }

    const temp = `${target}.tmp-${process.pid}.webp`;
    const options = ext === '.png'
        ? { lossless: true, alphaQuality: 100 }
        : { quality: 90, alphaQuality: 100 };
    try {
        await sharp(source, { animated: true }).webp(options).toFile(temp);
        if (fs.existsSync(target)) fs.unlinkSync(target);
        fs.renameSync(temp, target);
        if (!KEEP_SOURCE) fs.unlinkSync(source);
        return { status: 'converted', source, target };
    } finally {
        if (fs.existsSync(temp)) fs.unlinkSync(temp);
    }
}

async function main() {
    if (ROOTS.length === 0) {
        console.error('用法: node convert-images.js <目录> [目录 ...] [--keep-source]');
        process.exitCode = 1;
        return;
    }

    const sharp = loadSharp();
    const sources = ROOTS.flatMap(root => collectFiles(path.resolve(root)))
        .filter(file => SOURCE_EXTENSIONS.has(path.extname(file).toLowerCase()));
    const outputs = new Map();
    for (const source of sources) {
        const ext = path.extname(source).toLowerCase();
        const target = path.join(path.dirname(source), `${path.basename(source, ext)}.webp`);
        const previous = outputs.get(target);
        if (previous) throw new Error(`图片名称冲突：${previous} 与 ${source} 都会生成 ${target}`);
        outputs.set(target, source);
    }

    let converted = 0;
    let skipped = 0;
    let bytesBefore = 0;
    let bytesAfter = 0;
    for (const source of sources) {
        const sourceSize = fs.statSync(source).size;
        const result = await convertOne(sharp, source);
        const targetSize = fs.statSync(result.target).size;
        bytesBefore += sourceSize;
        bytesAfter += targetSize;
        if (result.status === 'converted') converted++;
        else skipped++;
    }

    console.log(`🖼️ WebP 转换完成: 转换 ${converted}, 已是最新 ${skipped}, 总计 ${sources.length}`);
    if (sources.length > 0) {
        console.log(`   文件大小: ${formatBytes(bytesBefore)} → ${formatBytes(bytesAfter)}`);
    }
    if (KEEP_SOURCE) console.log('   原始图片已保留 (--keep-source)');
}

main().catch(error => {
    console.error(`❌ WebP 转换失败: ${error.message}`);
    process.exitCode = 1;
});
