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

// XLSX 库加载 (用于道具表过滤导出; 缺失时道具表/图标降级为全量复制)
let XLSX = null;
try {
    XLSX = require('../js/xlsx.min.js');
} catch (e) {
    try { XLSX = require('xlsx'); } catch (e2) { XLSX = null; }
}

// 数据仓库位于项目同级目录 ../chronicle-data
const DATA_REPO_DIR = path.join(__dirname, '..', '..', 'chronicle-data');
const DATA_SOURCES_DIR = path.join(DATA_REPO_DIR, 'data-sources');
const ICON_DIR = path.join(DATA_REPO_DIR, 'icon');
const VIDEO_DIR = path.join(DATA_REPO_DIR, 'videos');

// ============================================================
// 道具表过滤规则 (与 import.js 保持一致)
//   1) 剔除 uesless = 1 的废弃/无用道具
//   2) 仅保留类型 itemType 为 1/2/3 的普通道具
// 过滤后的表格导出到 data-sources/道具表.xlsx, 物品图标也仅保留被引用者
// ============================================================
const ITEM_TYPE_WHITELIST = new Set(['1', '2', '3']);

// 数据源映射: 本地绝对路径(游戏引擎/策划导出) → 数据仓库 data-sources
// 文件夹(target 为目录名)同步到 data-sources/xxx/; 表格文件(target 为文件名)直接平铺到 data-sources/
// type === 'icon'  时, target 相对 chronicle-data/icon/  目录 (图片同步后由 convert-images 转为 webp)
// type === 'video' 时, target 相对 chronicle-data/videos/ 目录 (target 留空表示直接放 videos/ 根目录)
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
    { source: 'E:\\策划\\1.表格目录\\XLS表格\\道具表.xlsx', target: '道具表.xlsx', filter: 'itemTable' },
    { source: 'D:\\NewProject\\preview-templates\\icon\\skill', target: 'skill', type: 'icon' },
    { source: 'D:\\NewProject\\preview-templates\\icon\\talent', target: 'talent', type: 'icon' },
    { source: 'D:\\NewProject\\preview-templates\\icon\\item', target: 'item', type: 'icon', onlyIcons: true },
    { source: 'D:\\Users\\1250c\\Desktop\\技能视频', target: '', type: 'video' },
];

// ============================================================
// 道具表解析工具 (与 import.js 的表头识别/字段规则保持一致)
// ============================================================
function cleanNum(v) {
    return String(v).replace(/\.0+$/, '').trim();
}

// 按候选名查找列下标 (headers 为数组)
function findColIdx(headers, names) {
    for (const n of names) {
        const idx = headers.findIndex(h => h === n || String(h).toLowerCase() === n.toLowerCase());
        if (idx >= 0) return idx;
    }
    return -1;
}

// 解析 icon 字段 (支持 "item/caizuan" / ["item/caizuan"] / "a|b" 取首个非空)
function parseIconName(raw) {
    let s = String(raw === undefined || raw === null ? '' : raw).trim();
    if (!s) return '';
    s = s.replace(/^\[|\]$/g, '').replace(/["']/g, '');
    return s.split(/[|,;，；\s]+/).map(x => x.trim()).filter(Boolean)[0] || '';
}

// 取图标路径的最后一段作为文件名 (如 "item/caizuan" → "caizuan")
function iconBasename(iconPath) {
    if (!iconPath) return '';
    return String(iconPath).replace(/\\/g, '/').split('/').filter(Boolean).pop() || '';
}

// 读取工作簿 (与 import.js 一致: .xls 使用 GBK 解码)
function readWorkbook(filePath) {
    const buf = fs.readFileSync(filePath);
    if (path.extname(filePath).toLowerCase() === '.xls') {
        return XLSX.read(buf, { type: 'buffer', codepage: 936 });
    }
    return XLSX.read(buf, { type: 'buffer' });
}

// 读取道具表 Item 子表的原始二维数组
function readItemRawRows(filePath) {
    const wb = readWorkbook(filePath);
    let sheetName = wb.SheetNames.find(n => n === 'Item' || n.toLowerCase() === 'item');
    if (!sheetName) sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('item'));
    if (!sheetName) return null;
    const rawRows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '', raw: true });
    if (!rawRows.length) return null;
    return { wb, sheetName, rawRows };
}

// 三段式表头识别: row1 中文 / row2 英文键 / row3 类型提示
function detectHeader(rawRows) {
    const row1 = rawRows[0].map(h => String(h).trim());
    const row2 = rawRows.length > 1 ? rawRows[1].map(h => String(h).trim()) : [];
    const row3 = rawRows.length > 2 ? rawRows[2].map(h => String(h).trim()) : [];
    const typeKeywords = ['number', 'string', 'bool', 'object', 'numberArr', 'number2', 'stringArr'];
    const isRow3TypeHints = row3.length > 0 && row3.some(h => typeKeywords.some(kw => h.toLowerCase().includes(kw)));
    const isRow2English = row2.length > 0 && row2.some(h => /[a-zA-Z]/.test(h)) && !row2.some(h => /[\u4e00-\u9fa5]/.test(h));
    if (isRow2English && isRow3TypeHints) return { headers: row2, dataStartIdx: 3 };
    if (isRow2English) return { headers: row2, dataStartIdx: 2 };
    return { headers: row1, dataStartIdx: 1 };
}

// 过滤道具表数据行: 返回保留的原始行 + 引用到的图标 basename 集合
function filterItemRawRows(rawRows, headers, dataStartIdx) {
    const idIdx = findColIdx(headers, ['id.p', 'id', 'ID', 'Id', '道具id']);
    const uselessIdx = findColIdx(headers, ['uesless', '无用道具', '非可用道具']);
    const iconIdx = findColIdx(headers, ['icon', '图标']);
    const typeIdx = findColIdx(headers, ['itemType', '物品类型', '道具类型']);

    const rows = [];
    const icons = new Set();
    for (let i = dataStartIdx; i < rawRows.length; i++) {
        const cols = rawRows[i];
        const id = idIdx >= 0 ? cleanNum(cols[idIdx]) : '';
        if (!id) continue;
        // uesless = 1 的废弃道具剔除; 空值视为 0
        const useless = uselessIdx >= 0 ? String(cols[uselessIdx] === undefined ? '' : cols[uselessIdx]).trim() : '';
        if (useless === '1' || useless === '1.0') continue;
        // 类型限制: 仅保留 itemType 1/2/3 的普通道具
        const itemType = typeIdx >= 0 ? cleanNum(cols[typeIdx]) : '';
        if (!ITEM_TYPE_WHITELIST.has(itemType)) continue;
        rows.push(cols);
        // 仅收集 item/ 目录下的图标 (baoshi/ 等其它目录由各自映射整目录同步)
        if (iconIdx >= 0) {
            const iconPath = parseIconName(cols[iconIdx]);
            if (/^item\//i.test(iconPath)) {
                const icon = iconBasename(iconPath);
                if (icon) icons.add(icon);
            }
        }
    }
    return { rows, icons };
}

// 将过滤后的道具表写入数据仓库 (保留原工作簿其它子表与表头行)
function writeFilteredItemTable(srcPath, destFile, stats) {
    const parsed = readItemRawRows(srcPath);
    if (!parsed) {
        console.log('  ⚠️ 未找到 Item 子表, 跳过');
        return { icons: null };
    }
    const { wb, sheetName, rawRows } = parsed;
    const { headers, dataStartIdx } = detectHeader(rawRows);
    const { rows, icons } = filterItemRawRows(rawRows, headers, dataStartIdx);

    wb.Sheets[sheetName] = XLSX.utils.aoa_to_sheet(rawRows.slice(0, dataStartIdx).concat(rows));
    // 注: 打包版 xlsx.min.js 的 writeFile 无法访问 fs, 这里自行生成 buffer 再落盘
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    // 内容一致则不重写, 避免每次同步产生无意义的 git 变更
    try {
        if (fs.readFileSync(destFile).equals(Buffer.from(buf))) {
            stats.skipped++;
            console.log(`  ✓ 过滤表无变化 → data-sources/${path.basename(destFile)}  (保留 ${rows.length} 行)`);
            return { icons };
        }
    } catch (e) { /* 目标不存在或不可读, 正常写入 */ }
    fs.mkdirSync(path.dirname(destFile), { recursive: true });
    fs.writeFileSync(destFile, buf);
    stats.copied++;
    const removed = rawRows.length - dataStartIdx - rows.length;
    console.log(`  ✓ 过滤导出 → data-sources/${path.basename(destFile)}  (保留 ${rows.length} 行, 剔除 ${removed} 行)`);
    return { icons };
}

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

// 仅同步被引用的图标 (baseSet 为引用到的文件名集合), 并清理未引用的图标
function syncItemIconDir(srcDir, destDir, baseSet, stats) {
    const srcFiles = collectFiles(srcDir, []).map(f => path.relative(srcDir, f));
    const wanted = srcFiles.filter(rel => baseSet.has(rel.replace(/\.[^.]+$/, '').replace(/\\/g, '/')));

    let copied = 0, skipped = 0;
    for (const rel of wanted) {
        const src = path.join(srcDir, rel);
        const ext = path.extname(rel);
        const webpRel = rel.slice(0, rel.length - ext.length) + '.webp';
        const destWebp = path.join(destDir, webpRel);
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

    // 清理: 删除目标中未被引用的图标 (按不带扩展名的文件名对比)
    let removed = 0;
    if (fs.existsSync(destDir)) {
        const destFiles = collectFiles(destDir, []).map(f => path.relative(destDir, f));
        destFiles.forEach(rel => {
            const base = rel.replace(/\.[^.]+$/, '').replace(/\\/g, '/');
            if (!baseSet.has(base)) { removePath(path.join(destDir, rel)); removed++; }
        });
    }
    return { copied, skipped, removed };
}

// 增量同步技能视频目录: 目标为 chronicle-data/videos
// 录屏导出偶尔会缺失扩展名, 这里统一按 .mp4 落盘, 保证 import.js 扫描清单时能收录
function syncVideoDir(srcDir, destDir, stats) {
    const VIDEO_EXT_RE = /\.(mp4|webm|ogg|mov|m4v)$/i;
    const srcFiles = collectFiles(srcDir, []).map(f => path.relative(srcDir, f));

    const mapping = srcFiles.map(rel => ({
        src: path.join(srcDir, rel),
        rel: VIDEO_EXT_RE.test(rel) ? rel : rel + '.mp4'
    }));
    const srcSet = new Set(mapping.map(m => m.rel.replace(/\\/g, '/')));

    let copied = 0, skipped = 0;
    for (const m of mapping) {
        const dest = path.join(destDir, m.rel);
        if (isUpToDate(m.src, dest)) {
            skipped++;
            continue;
        }
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(m.src, dest);
        copied++;
    }
    stats.copied += copied;
    stats.skipped += skipped;

    // 清理: 删除目标中源已不存在的视频
    if (fs.existsSync(destDir)) {
        const destFiles = collectFiles(destDir, []).map(f => path.relative(destDir, f).replace(/\\/g, '/'));
        destFiles.forEach(rel => {
            if (!srcSet.has(rel)) removePath(path.join(destDir, rel));
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

    // 预扫描道具表: 计算品质过滤后引用到的图标集合 (供 item 图标裁剪使用)
    // itemIconSet === null 表示无法过滤 (缺少 xlsx 库或源表不存在), 图标退化为全量同步
    let itemIconSet = null;
    const itemTableMap = MAPPINGS.find(m => m.filter === 'itemTable');
    if (itemTableMap) {
        if (!XLSX) {
            console.log('⚠️ 未加载 XLSX 库, 道具表与图标将全量复制 (未过滤)');
            console.log('');
        } else if (fs.existsSync(itemTableMap.source)) {
            try {
                const parsed = readItemRawRows(itemTableMap.source);
                if (parsed) {
                    const { headers, dataStartIdx } = detectHeader(parsed.rawRows);
                    const { icons } = filterItemRawRows(parsed.rawRows, headers, dataStartIdx);
                    itemIconSet = icons;
                    console.log('🔎 道具表预扫描: 过滤后引用图标 ' + itemIconSet.size + ' 个');
                    console.log('');
                }
            } catch (e) {
                console.log('⚠️ 道具表预扫描失败, 图标将全量复制: ' + e.message);
                console.log('');
            }
        }
    }

    MAPPINGS.forEach(m => {
        const src = m.source;
        console.log('📁 ' + path.basename(src));

        if (!fs.existsSync(src)) {
            console.log('  ⚠️ 源路径不存在，跳过: ' + src);
            console.log('');
            return;
        }

        const stat = fs.statSync(src);
        // type === 'icon' 时目标为 chronicle-data/icon/, type === 'video' 时为 chronicle-data/videos/, 其余为 data-sources/
        const isIcon = m.type === 'icon';
        const isVideo = m.type === 'video';
        const baseDir = isIcon ? ICON_DIR : (isVideo ? VIDEO_DIR : DATA_SOURCES_DIR);
        const relPrefix = isIcon ? 'icon/' : (isVideo ? 'videos/' : 'data-sources/');
        if (stat.isDirectory()) {
            const destDir = path.join(baseDir, m.target);
            let r;
            if (isIcon && m.onlyIcons && itemIconSet) {
                // 物品图标: 仅保留被道具表引用的图标, 并清理仓库中未引用项
                r = syncItemIconDir(src, destDir, itemIconSet, stats);
                const dirLabel = m.target ? m.target + '/' : '';
                console.log(`  ✓ 已裁剪同步 → ${relPrefix}${dirLabel}  (新增 ${r.copied}, 跳过 ${r.skipped}, 清理 ${r.removed} 个未引用)`);
            } else {
                r = isIcon ? syncIconDir(src, destDir, stats)
                    : (isVideo ? syncVideoDir(src, destDir, stats) : syncDir(src, destDir, stats));
                const dirLabel = m.target ? m.target + '/' : '';
                console.log(`  ✓ 已同步 → ${relPrefix}${dirLabel}  (新增 ${r.copied}, 跳过 ${r.skipped} 个未变化文件)`);
            }
        } else if (stat.isFile()) {
            const destFile = path.join(baseDir, m.target);
            if (m.filter === 'itemTable' && XLSX) {
                // 道具表: 过滤 uesless=1 与品质非 1/2/3 的行后再写入
                writeFilteredItemTable(src, destFile, stats);
            } else {
                const r = syncFile(src, destFile, stats);
                console.log(`  ✓ 已同步 → ${relPrefix}${m.target}  (新增 ${r.copied}, 跳过 ${r.skipped})`);
            }
        }
        console.log('');
    });

    console.log('────────────────────────────────────────');
    console.log(`✅ 复制完成: 新增 ${stats.copied} 个, 跳过 ${stats.skipped} 个未变化文件`);
    console.log('');
    console.log('下一步：运行 node import.js 同步数据到网页');
}

main();
