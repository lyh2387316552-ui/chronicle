#!/usr/bin/env node
/**
 * 数据源复制脚本 (增量同步版)
 * 将本地绝对路径下的数据源文件/文件夹增量复制到数据仓库 chronicle-data 的 data-sources 中
 * 已存在且未变化的文件自动跳过，仅复制新增/变更的文件
 *
 * 运行: node copy-data.js
 * 或双击: 一键同步.bat (会先 git pull 数据仓库, 复制后自动 push)
 *
 * 复制后请运行 node import.js 同步数据到网页
 */
const fs = require('fs');
const path = require('path');

// 数据仓库位于项目同级目录 ../chronicle-data
const DATA_REPO_DIR = path.join(__dirname, '..', '..', 'chronicle-data');
const DATA_SOURCES_DIR = path.join(DATA_REPO_DIR, 'data-sources');
const ICON_DIR = path.join(DATA_REPO_DIR, 'icon');

// 数据源映射: 本地绝对路径(游戏引擎/策划导出) → 数据仓库 data-sources
// 文件夹(target 为目录名)同步到 data-sources/xxx/; 表格文件(target 为文件名)直接平铺到 data-sources/
// type === 'icon' 时, target 相对 chronicle-data/icon/ 目录 (图片同步后由 convert-images 转为 webp)
const MAPPINGS = [
    { source: 'D:\\NewProject\\battleEdit\\Skill',         target: 'Skill' },
    { source: 'D:\\NewProject\\battleEdit\\SkillModule',   target: 'SkillModule' },
    { source: 'D:\\NewProject\\battleEdit\\Stunt',         target: 'Stunt' },
    { source: 'D:\\NewProject\\battleEdit\\StuntModule',   target: 'StuntModule' },
    { source: 'E:\\策划\\1.表格目录\\XLS表格\\属性表.xlsx', target: '属性表.xlsx' },
    { source: 'E:\\策划\\1.表格目录\\XLS表格\\装备表.xlsx', target: '装备表.xlsx' },
    { source: 'E:\\策划\\1.表格目录\\XLS表格\\技能养成相关.xlsx', target: '技能养成相关.xlsx' },
    { source: 'E:\\策划\\1.表格目录\\XLS表格\\战斗技能相关表.xlsx', target: '战斗技能相关表.xlsx' },
    { source: 'E:\\策划\\1.表格目录\\XLS表格\\魔宠表.xlsx', target: '魔宠表.xlsx' },
    { source: 'E:\\策划\\1.表格目录\\XLS表格\\战斗技能等级表.xlsx', target: '战斗技能等级表.xlsx' },
    { source: 'D:\\NewProject\\preview-templates\\icon\\skill', target: 'skill', type: 'icon' },
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

// 图标目标 webp 是否已是最新 (源为 png/jpg, 目标为同名 webp, 格式不同只看修改时间)
function isWebpUpToDate(srcPath, destWebpPath) {
    try {
        const s = fs.statSync(srcPath);
        const d = fs.statSync(destWebpPath);
        return d.mtimeMs >= s.mtimeMs;
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

// 增量同步图标目录: 源为 png/jpg 等位图, 目标存放同名 webp (随后由 convert-images 转换)
// 用目标 webp 的修改时间判断是否最新; 清理时按「不带扩展名的文件名」对比, 兼容 png 与 webp 并存
function syncIconDir(srcDir, destDir, stats) {
    const srcFiles = collectFiles(srcDir, []).map(f => path.relative(srcDir, f));
    const srcBaseSet = new Set(srcFiles.map(f => f.replace(/\.[^.]+$/, '').replace(/\\/g, '/')));

    let copied = 0, skipped = 0;
    for (const rel of srcFiles) {
        const src = path.join(srcDir, rel);
        const ext = path.extname(rel);
        const webpRel = rel.slice(0, rel.length - ext.length) + '.webp';
        const destWebp = path.join(destDir, webpRel);
        // 已有较新的 webp 则跳过复制 (避免每次同步重复转换)
        if (isWebpUpToDate(src, destWebp)) {
            skipped++;
            continue;
        }
        fs.mkdirSync(path.dirname(destWebp), { recursive: true });
        fs.copyFileSync(src, path.join(destDir, rel));
        copied++;
    }
    stats.copied += copied;
    stats.skipped += skipped;

    // 清理: 删除目标中源已不存在的文件 (按不带扩展名的文件名对比, 兼容 png/webp)
    if (fs.existsSync(destDir)) {
        const destFiles = collectFiles(destDir, []).map(f => path.relative(destDir, f));
        destFiles.forEach(rel => {
            const base = rel.replace(/\.[^.]+$/, '').replace(/\\/g, '/');
            if (!srcBaseSet.has(base)) removePath(path.join(destDir, rel));
        });
    }
    return { copied, skipped };
}

// 增量同步单个文件 (destFile 为完整目标路径)
function syncFile(src, destFile, stats) {
    if (isUpToDate(src, destFile)) {
        stats.skipped++;
        return { copied: 0, skipped: 1 };
    }
    fs.mkdirSync(path.dirname(destFile), { recursive: true });
    fs.copyFileSync(src, destFile);
    stats.copied++;
    return { copied: 1, skipped: 0 };
}

function main() {
    console.log('╔══════════════════════════════════════╗');
    console.log('║     古荒大陆数据源复制工具 (增量)      ║');
    console.log('╚══════════════════════════════════════╝');
    console.log('');

    // 检查数据仓库是否存在
    if (!fs.existsSync(DATA_REPO_DIR)) {
        console.error('❌ 数据仓库目录不存在: ' + DATA_REPO_DIR);
        console.error('   请先克隆: git clone https://github.com/lyh2387316552-ui/chronicle-data.git');
        process.exit(1);
    }

    const stats = { copied: 0, skipped: 0 };

    MAPPINGS.forEach(m => {
        const src = m.source;
        console.log('📁 ' + path.basename(src));

        if (!fs.existsSync(src)) {
            console.log('  ⚠️ 源路径不存在，跳过: ' + src);
            console.log('');
            return;
        }

        const stat = fs.statSync(src);
        // type === 'icon' 时目标为 chronicle-data/icon/, 其余为 data-sources/
        const isIcon = m.type === 'icon';
        const baseDir = isIcon ? ICON_DIR : DATA_SOURCES_DIR;
        const relPrefix = isIcon ? 'icon/' : 'data-sources/';
        if (stat.isDirectory()) {
            const destDir = path.join(baseDir, m.target);
            const r = isIcon ? syncIconDir(src, destDir, stats) : syncDir(src, destDir, stats);
            console.log(`  ✓ 已同步 → ${relPrefix}${m.target}/  (新增 ${r.copied}, 跳过 ${r.skipped} 个未变化文件)`);
        } else if (stat.isFile()) {
            const destFile = path.join(baseDir, m.target);
            const r = syncFile(src, destFile, stats);
            console.log(`  ✓ 已同步 → ${relPrefix}${m.target}  (新增 ${r.copied}, 跳过 ${r.skipped})`);
        }
        console.log('');
    });

    console.log('────────────────────────────────────────');
    console.log(`✅ 复制完成: 新增 ${stats.copied} 个, 跳过 ${stats.skipped} 个未变化文件`);
    console.log('');
    console.log('下一步：运行 node import.js 同步数据到网页');
}

main();
