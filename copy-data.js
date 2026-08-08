#!/usr/bin/env node
/**
 * 数据源复制脚本 (增量同步版)
 * 将本地绝对路径下的数据源文件/文件夹增量复制到 data-sources 中
 * 已存在且未变化的文件自动跳过，仅复制新增/变更的文件
 *
 * 运行: node copy-data.js
 * 或双击: 一键同步.bat
 *
 * 复制后请运行 node import.js 同步数据到网页
 */
const fs = require('fs');
const path = require('path');

const DATA_SOURCES_DIR = path.join(__dirname, 'data-sources');

// 数据源映射: 本地绝对路径 → data-sources 目标文件夹
const MAPPINGS = [
    { source: 'D:\\NewProject\\battleEdit\\Skill',         target: 'Skill' },
    { source: 'D:\\NewProject\\battleEdit\\SkillModule',   target: 'SkillModule' },
    { source: 'D:\\NewProject\\battleEdit\\Stunt',         target: 'Stunt' },
    { source: 'D:\\NewProject\\battleEdit\\StuntModule',   target: 'StuntModule' },
    { source: 'E:\\策划\\1.表格目录\\XLS表格\\属性表.xlsx', target: '属性表' },
    { source: 'E:\\策划\\1.表格目录\\XLS表格\\装备表.xlsx', target: '装备表' },
    { source: 'E:\\策划\\1.表格目录\\XLS表格\\技能养成相关.xlsx', target: '宝石表' },
    { source: 'E:\\策划\\1.表格目录\\XLS表格\\技能养成相关.xlsx', target: '技能表' },
    { source: 'E:\\策划\\1.表格目录\\XLS表格\\战斗技能相关表.xlsx', target: '技能标签' },
];

// 递归收集文件夹下的所有文件
function collectFiles(dir, result) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            collectFiles(full, result);
        } else if (entry.isFile()) {
            result.push(full);
        }
    }
    return result;
}

// 递归删除文件/文件夹 (兼容旧版 Node.js，不使用 fs.rmSync)
function removePath(p) {
    if (!fs.existsSync(p)) return;
    const stat = fs.lstatSync(p);
    if (stat.isDirectory()) {
        fs.readdirSync(p).forEach(child => removePath(path.join(p, child)));
        fs.rmdirSync(p);
    } else {
        fs.unlinkSync(p);
    }
}

// 目标文件是否已是最新 (大小与修改时间一致则无需重拷)
function isUpToDate(srcPath, destPath) {
    try {
        const s = fs.statSync(srcPath);
        const d = fs.statSync(destPath);
        return d.size === s.size && d.mtimeMs >= s.mtimeMs;
    } catch (e) {
        return false;
    }
}

// 增量同步文件夹: 复制新增/变更文件，删除源中已不存在的文件
function syncDir(srcDir, destDir, stats) {
    const srcFiles = collectFiles(srcDir, []).map(f => path.relative(srcDir, f));
    const srcSet = new Set(srcFiles.map(r => r.replace(/\\/g, '/')));

    let copied = 0, skipped = 0;
    for (const rel of srcFiles) {
        const src = path.join(srcDir, rel);
        const dest = path.join(destDir, rel);
        if (isUpToDate(src, dest)) {
            skipped++;
            continue;
        }
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
        copied++;
    }
    stats.copied += copied;
    stats.skipped += skipped;

    // 清理: 删除目标中源已不存在的文件
    if (fs.existsSync(destDir)) {
        const destFiles = collectFiles(destDir, []).map(f => path.relative(destDir, f).replace(/\\/g, '/'));
        destFiles.forEach(rel => {
            if (!srcSet.has(rel)) removePath(path.join(destDir, rel));
        });
    }
    return { copied, skipped };
}

// 增量同步单个文件
function syncFile(src, destDir, stats) {
    const dest = path.join(destDir, path.basename(src));
    if (isUpToDate(src, dest)) {
        stats.skipped++;
        return { copied: 0, skipped: 1 };
    }
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(src, dest);
    stats.copied++;
    return { copied: 1, skipped: 0 };
}

function main() {
    console.log('╔══════════════════════════════════════╗');
    console.log('║     古荒大陆数据源复制工具 (增量)      ║');
    console.log('╚══════════════════════════════════════╝');
    console.log('');

    const stats = { copied: 0, skipped: 0 };

    MAPPINGS.forEach(m => {
        const src = m.source;
        const destDir = path.join(DATA_SOURCES_DIR, m.target);
        console.log('📁 ' + path.basename(src));

        if (!fs.existsSync(src)) {
            console.log('  ⚠️ 源路径不存在，跳过: ' + src);
            console.log('');
            return;
        }

        const stat = fs.statSync(src);
        if (stat.isDirectory()) {
            const r = syncDir(src, destDir, stats);
            console.log(`  ✓ 已同步 → data-sources/${m.target}  (新增 ${r.copied}, 跳过 ${r.skipped} 个未变化文件)`);
        } else if (stat.isFile()) {
            const r = syncFile(src, destDir, stats);
            console.log(`  ✓ 已同步 → data-sources/${m.target}/${path.basename(src)}  (新增 ${r.copied}, 跳过 ${r.skipped})`);
        }
        console.log('');
    });

    console.log('────────────────────────────────────────');
    console.log(`✅ 复制完成: 新增 ${stats.copied} 个, 跳过 ${stats.skipped} 个未变化文件`);
    console.log('');
    console.log('下一步：运行 node import.js 同步数据到网页');
}

main();
