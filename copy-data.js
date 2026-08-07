#!/usr/bin/env node
/**
 * 数据源复制脚本
 * 将本地绝对路径下的数据源文件/文件夹复制到 data-sources 中
 *
 * 运行: node copy-data.js
 * 或双击: 复制数据.bat
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

// 清空目标目录内容（保留目录本身）
function clearDir(dir) {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach(entry => removePath(path.join(dir, entry)));
}

function main() {
    console.log('╔══════════════════════════════════════╗');
    console.log('║     古荒大陆数据源复制工具             ║');
    console.log('╚══════════════════════════════════════╝');
    console.log('');

    let totalCopied = 0;

    MAPPINGS.forEach(m => {
        const src = m.source;
        const destDir = path.join(DATA_SOURCES_DIR, m.target);
        console.log('📁 ' + path.basename(src));

        if (!fs.existsSync(src)) {
            console.log('  ⚠️ 源路径不存在，跳过: ' + src);
            console.log('');
            return;
        }

        fs.mkdirSync(destDir, { recursive: true });
        clearDir(destDir);

        const stat = fs.statSync(src);
        if (stat.isDirectory()) {
            const files = collectFiles(src, []);
            files.forEach(f => {
                const rel = path.relative(src, f);
                const dest = path.join(destDir, rel);
                fs.mkdirSync(path.dirname(dest), { recursive: true });
                fs.copyFileSync(f, dest);
            });
            totalCopied += files.length;
            console.log('  ✓ 已复制文件夹 → data-sources/' + m.target + '  (' + files.length + ' 个文件)');
        } else if (stat.isFile()) {
            const dest = path.join(destDir, path.basename(src));
            fs.copyFileSync(src, dest);
            totalCopied++;
            console.log('  ✓ 已复制文件 → data-sources/' + m.target + '/' + path.basename(src));
        }
        console.log('');
    });

    console.log('────────────────────────────────────────');
    console.log('✅ 复制完成，共复制 ' + totalCopied + ' 个文件');
    console.log('');
    console.log('下一步：运行 node import.js 同步数据到网页');
}

main();
