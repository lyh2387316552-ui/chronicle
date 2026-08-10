#!/usr/bin/env node
/**
 * 古荒大陆数据导入脚本 v2.0
 * 
 * 使用方法:
 *   1. 编辑 import-config.json 填入文件/文件夹路径
 *   2. 运行: node import.js → 解析数据并生成 auto-import-data.js
 *   3. 打开 index.html 即可自动加载所有数据
 *   4. 以后只需再次运行 node import.js 即可重复导入
 * 
 * 支持的数据源:
 *   - skillFolder:     主动技能文件夹 (含 Basic_Information-*.json)
 *   - skillModuleFolder: 主动技能模块文件夹 (含 module-*.json)
 *   - stuntFolder:     被动技能文件夹 (含 baseStuntInfo-*.json)
 *   - stuntModuleFolder: 被动技能模块文件夹 (含 module-*.json)
 *   - affixPath:       词缀库 Excel/CSV 文件或文件夹
 *   - equipPath:       装备库 Excel 文件 (含 LegendEquip + Modifier 子表)
 *   - gemPath:         辅助技能库 Excel 文件 (含 SkillGem 子表)
 *   - attrPath:        属性 CSV/Excel 文件或文件夹
 */

const fs = require('fs');
const path = require('path');

// ============================================================
// XLSX 库加载
// ============================================================
let XLSX;
try {
    XLSX = require('./xlsx.min.js');
} catch (e) {
    try {
        XLSX = require('xlsx');
    } catch (e2) {
        console.error('❌ 无法加载 XLSX 库，请确保 xlsx.min.js 在同一目录下');
        process.exit(1);
    }
}

const CONFIG_FILE = path.join(__dirname, 'import-config.json');
const OUTPUT_FILE = path.join(__dirname, 'auto-import-data.js');

// ============================================================
// 默认配置 (数据源统一放在 data-sources 文件夹下，相对路径)
// ============================================================
const DEFAULT_CONFIG = {
    "_说明": "数据源统一放在 data-sources 文件夹下，路径为相对路径（相对本项目目录）。将对应文件放入指定文件夹/文件名即可。",
    "skillFolder":     "data-sources/Skill",
    "skillModuleFolder": "data-sources/SkillModule",
    "stuntFolder":     "data-sources/Stunt",
    "stuntModuleFolder": "data-sources/StuntModule",
    "affixPath":       "data-sources/属性表",
    "equipPath":       "data-sources/装备表",
    "gemPath":         "data-sources/宝石表",
    "attrPath":        "data-sources/属性表",
    "skillExcelPath":  "data-sources/技能表",
    "skillTagPath":    "data-sources/技能标签",
    "occupationPath":  "data-sources/技能表",
    "iconPath":        "D:/NewProject/preview-templates/icon",
    "videoPath":       "D:/Users/1250c/Desktop/技能视频",
    "petPath":         "E:/策划/1.表格目录/XLS表格/魔宠表"
};

// ============================================================
// 工具函数
// ============================================================
function cleanNum(v) {
    return String(v).replace(/\.0+$/, '').trim();
}

function findCol(headers, names) {
    for (const n of names) {
        const idx = headers.findIndex(h => h === n || h.toLowerCase() === n.toLowerCase());
        if (idx >= 0) return headers[idx];
    }
    return null;
}

function resolvePath(p) {
    if (!p) return null;
    if (path.isAbsolute(p)) return p;
    return path.resolve(__dirname, p);
}

// 智能解析路径: 如果路径不存在，尝试添加常见扩展名
function smartResolvePath(p) {
    if (!p) return null;
    const resolved = resolvePath(p);
    
    // 路径存在则直接返回
    if (fs.existsSync(resolved)) return resolved;
    
    // 尝试添加扩展名 (.xlsx, .xls, .csv)
    const exts = ['.xlsx', '.xls', '.csv'];
    for (const ext of exts) {
        const withExt = resolved + ext;
        if (fs.existsSync(withExt)) {
            console.log('     自动补全扩展名:', ext);
            return withExt;
        }
    }
    
    // 尝试在路径所在目录中查找匹配的文件名
    const dir = path.dirname(resolved);
    const baseName = path.basename(resolved);
    if (isDirectory(dir)) {
        try {
            const files = fs.readdirSync(dir);
            for (const f of files) {
                const fLower = f.toLowerCase();
                const baseLower = baseName.toLowerCase();
                // 精确匹配(不含扩展名) 或 包含关键词
                if (fLower === baseLower + '.xlsx' || fLower === baseLower + '.xls' || fLower === baseLower + '.csv') {
                    console.log('     目录中找到匹配文件:', f);
                    return path.join(dir, f);
                }
            }
        } catch (e) {}
    }
    
    return resolved; // 返回原始路径，让调用方报错
}

// 检测 Buffer 是否为有效 UTF-8
function isValidUTF8(buf) {
    let i = 0;
    while (i < buf.length) {
        const b = buf[i];
        if (b < 0x80) { i++; continue; }
        if (b >= 0xC2 && b <= 0xDF) {
            if (i + 1 >= buf.length || (buf[i+1] & 0xC0) !== 0x80) return false;
            i += 2; continue;
        }
        if (b >= 0xE0 && b <= 0xEF) {
            if (i + 2 >= buf.length) return false;
            if ((buf[i+1] & 0xC0) !== 0x80 || (buf[i+2] & 0xC0) !== 0x80) return false;
            i += 3; continue;
        }
        if (b >= 0xF0 && b <= 0xF4) {
            if (i + 3 >= buf.length) return false;
            if ((buf[i+1] & 0xC0) !== 0x80 || (buf[i+2] & 0xC0) !== 0x80 || (buf[i+3] & 0xC0) !== 0x80) return false;
            i += 4; continue;
        }
        return false; // 无效的 UTF-8 起始字节
    }
    return true;
}

// 读取文件文本 (自动检测编码: UTF-8 BOM > UTF-8 > GBK)
function readFileText(filePath) {
    const buf = fs.readFileSync(filePath);
    // 检查 UTF-8 BOM
    if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
        return buf.slice(3).toString('utf-8');
    }
    // 检查 UTF-16 LE BOM
    if (buf.length >= 2 && buf[0] === 0xFF && buf[1] === 0xFE) {
        return buf.toString('utf16le');
    }
    // 尝试 UTF-8
    if (isValidUTF8(buf)) {
        return buf.toString('utf-8');
    }
    // 回退: 使用 SheetJS 以 GBK (codepage 936) 解码
    console.log('     ⚠️ 检测到非 UTF-8 编码，尝试 GBK (codepage 936) 解码...');
    try {
        const wb = XLSX.read(buf, { type: 'buffer', codepage: 936 });
        const firstSheet = wb.Sheets[wb.SheetNames[0]];
        const csv = XLSX.utils.sheet_to_csv(firstSheet);
        return csv;
    } catch (e) {
        console.log('     ⚠️ GBK 解码失败，回退到 latin1');
        return buf.toString('latin1');
    }
}

// 工作簿解析缓存 (同一文件 mtime 未变则复用解析结果，避免重复解析 Excel)
const _wbCache = {};

// 读取工作簿 (兼容 .xlsx/.xls/.csv，自动处理编码)
function readWorkbook(filePath) {
    // 缓存命中: 文件未变化时直接复用
    try {
        const mtime = fs.statSync(filePath).mtimeMs;
        const key = filePath + '@' + mtime;
        if (_wbCache[key]) return _wbCache[key];
    } catch (e) {}

    let wb;
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.csv') {
        const buf = fs.readFileSync(filePath);
        // 检查 UTF-8 BOM
        if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
            const text = buf.slice(3).toString('utf-8');
            wb = XLSX.read(text, { type: 'string' });
        } else if (buf.length >= 2 && buf[0] === 0xFF && buf[1] === 0xFE) {
            // 检查 UTF-16 LE BOM
            const text = buf.toString('utf16le');
            wb = XLSX.read(text, { type: 'string' });
        } else if (isValidUTF8(buf)) {
            // 尝试 UTF-8
            wb = XLSX.read(buf.toString('utf-8'), { type: 'string' });
        } else {
            // 回退: GBK codepage 936
            console.log('     ⚠️ CSV 文件非 UTF-8 编码，使用 GBK (codepage 936) 解码...');
            wb = XLSX.read(buf, { type: 'buffer', codepage: 936 });
        }
    } else {
        const buf = fs.readFileSync(filePath);
        if (ext === '.xls') {
            // .xls 文件可能需要 codepage
            wb = XLSX.read(buf, { type: 'buffer', codepage: 936 });
        } else {
            // .xlsx 文件: 先尝试正常读取，如果检测到中文乱码则使用 GBK 重读
            wb = XLSX.read(buf, { type: 'buffer' });
            // 检测是否乱码: 检查第一个工作表的前3个单元格
            let hasGarbled = false;
            for (const sn of wb.SheetNames.slice(0, 1)) {
                const sheet = wb.Sheets[sn];
                const ref = sheet['!ref'];
                if (!ref) continue;
                const range = XLSX.utils.decode_range(ref);
                let checked = 0;
                for (let r = range.s.r; r <= range.e.r && checked < 3; r++) {
                    for (let c = range.s.c; c <= range.e.c && checked < 3; c++) {
                        const cell = sheet[XLSX.utils.encode_cell({ r, c })];
                        if (cell && cell.v && typeof cell.v === 'string') {
                            const v = cell.v;
                            // 检测 GBK 误读为 UTF-8 的典型乱码模式
                            if (/[\u00c0-\u00df][\u0080-\u00bf]/.test(v) || /[\u00e0-\u00ef][\u0080-\u00bf]{2}/.test(v)) {
                                hasGarbled = true;
                            }
                            checked++;
                        }
                    }
                }
            }
            if (hasGarbled) {
                console.log('     ⚠️ 检测到 .xlsx 中文乱码，使用 GBK (codepage 936) 重新解码...');
                wb = XLSX.read(buf, { type: 'buffer', codepage: 936 });
            }
        }
    }

    // 存入缓存
    try {
        const mtime = fs.statSync(filePath).mtimeMs;
        _wbCache[filePath + '@' + mtime] = wb;
    } catch (e) {}
    return wb;
}

// 判断路径是文件还是文件夹
function isDirectory(p) {
    try {
        return fs.statSync(p).isDirectory();
    } catch (e) {
        return false;
    }
}

// 在文件夹中查找 Excel/CSV 文件 (支持按名称关键词优先匹配)
function findDataFile(dirPath, extensions, nameKeywords) {
    try {
        const files = fs.readdirSync(dirPath);
        // 如果提供了名称关键词，优先匹配含关键词的文件
        if (nameKeywords && nameKeywords.length > 0) {
            for (const kw of nameKeywords) {
                for (const f of files) {
                    const ext = path.extname(f).toLowerCase();
                    if (extensions.includes(ext) && f.toLowerCase().includes(kw.toLowerCase())) {
                        return path.join(dirPath, f);
                    }
                }
            }
        }
        // 回退：返回第一个匹配扩展名的文件
        for (const f of files) {
            const ext = path.extname(f).toLowerCase();
            if (extensions.includes(ext)) {
                return path.join(dirPath, f);
            }
        }
    } catch (e) {}
    return null;
}

// 解析表头行（3行格式检测）
function parseRows(rawRows, sheetName) {
    const row1 = rawRows[0].map(h => String(h).trim());
    const row2 = rawRows.length > 1 ? rawRows[1].map(h => String(h).trim()) : [];
    const row3 = rawRows.length > 2 ? rawRows[2].map(h => String(h).trim()) : [];

    const typeKeywords = ['number', 'string', 'bool', 'object', 'numberArr', 'number2', 'stringArr'];
    const isRow3TypeHints = row3.length > 0 && row3.some(h => typeKeywords.some(kw => h.toLowerCase().includes(kw)));
    const isRow2English = row2.length > 0 && row2.some(h => /[a-zA-Z]/.test(h)) && !row2.some(h => /[\u4e00-\u9fa5]/.test(h));

    let headers, dataStartIdx;
    if (isRow2English && isRow3TypeHints) { headers = row2; dataStartIdx = 3; }
    else if (isRow2English) { headers = row2; dataStartIdx = 2; }
    else { headers = row1; dataStartIdx = 1; }

    const rows = [];
    for (let i = dataStartIdx; i < rawRows.length; i++) {
        const cols = rawRows[i].map(c => String(c).trim());
        const row = {};
        headers.forEach((h, idx) => { row[h] = cols[idx] !== undefined ? cols[idx] : ''; });
        rows.push(row);
    }
    return { headers, rows, sheetName };
}

// 按名称读取工作表
function readSheetByName(filePath, keywords) {
    const wb = readWorkbook(filePath);
    let targetSheet = null;
    for (const name of wb.SheetNames) {
        for (const kw of keywords) {
            if (name.includes(kw) || name.toLowerCase().includes(kw.toLowerCase())) {
                targetSheet = name; break;
            }
        }
        if (targetSheet) break;
    }
    if (!targetSheet) targetSheet = wb.SheetNames[0];
    const sheet = wb.Sheets[targetSheet];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
    if (rawRows.length === 0) return { headers: [], rows: [], sheetName: targetSheet };
    return parseRows(rawRows, targetSheet);
}

// 按列内容读取工作表
function readSheetByCols(filePath, requiredCols, keywords) {
    const wb = readWorkbook(filePath);
    const parseSheetHeaders = (sheetName) => {
        const sheet = wb.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
        if (rawRows.length === 0) return [];
        const row1 = rawRows[0].map(h => String(h).trim());
        const row2 = rawRows.length > 1 ? rawRows[1].map(h => String(h).trim()) : [];
        const row3 = rawRows.length > 2 ? rawRows[2].map(h => String(h).trim()) : [];
        const typeKeywords = ['number', 'string', 'bool', 'object', 'numberArr', 'number2', 'stringArr'];
        const isRow3TypeHints = row3.length > 0 && row3.some(h => typeKeywords.some(kw => h.toLowerCase().includes(kw)));
        const isRow2English = row2.length > 0 && row2.some(h => /[a-zA-Z]/.test(h)) && !row2.some(h => /[\u4e00-\u9fa5]/.test(h));
        if (isRow2English && isRow3TypeHints) return row2;
        if (isRow2English) return row2;
        return row1;
    };
    const hasAllCols = (headers, cols) => cols.every(col => headers.some(h => h.toLowerCase() === col.toLowerCase()));
    let targetSheet = null;
    if (keywords) {
        for (const name of wb.SheetNames) {
            for (const kw of keywords) {
                if (name.includes(kw) || name.toLowerCase().includes(kw.toLowerCase())) {
                    if (hasAllCols(parseSheetHeaders(name), requiredCols)) { targetSheet = name; break; }
                }
            }
            if (targetSheet) break;
        }
    }
    if (!targetSheet) {
        for (const name of wb.SheetNames) {
            if (hasAllCols(parseSheetHeaders(name), requiredCols)) { targetSheet = name; break; }
        }
    }
    if (!targetSheet && keywords) {
        for (const name of wb.SheetNames) {
            for (const kw of keywords) {
                if (name.includes(kw) || name.toLowerCase().includes(kw.toLowerCase())) { targetSheet = name; break; }
            }
            if (targetSheet) break;
        }
    }
    if (!targetSheet) targetSheet = wb.SheetNames[0];
    const sheet = wb.Sheets[targetSheet];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
    if (rawRows.length === 0) return { headers: [], rows: [], sheetName: targetSheet };
    return parseRows(rawRows, targetSheet);
}

// 解析 CSV 文件 (自动检测编码)
function parseCSVFile(filePath) {
    const text = readFileText(filePath);
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length === 0) return { headers: [], rows: [] };
    const sep = lines[0].includes('\t') ? '\t' : ',';
    const row1 = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, ''));
    const row2 = lines.length > 1 ? lines[1].split(sep).map(h => h.trim().replace(/^"|"$/g, '')) : [];
    const row3 = lines.length > 2 ? lines[2].split(sep).map(h => h.trim().replace(/^"|"$/g, '')) : [];
    const typeKeywords = ['number', 'string', 'bool', 'object', 'numberArr', 'number2', 'stringArr'];
    const isRow3TypeHints = row3.length > 0 && row3.some(h => typeKeywords.some(kw => h.toLowerCase().includes(kw)));
    const isRow2English = row2.length > 0 && row2.some(h => /[a-zA-Z]/.test(h)) && !row2.some(h => /[\u4e00-\u9fa5]/.test(h));
    let headers, dataStartIdx;
    if (isRow2English && isRow3TypeHints) { headers = row2; dataStartIdx = 3; }
    else if (isRow2English) { headers = row2; dataStartIdx = 2; }
    else { headers = row1; dataStartIdx = 1; }
    const rows = [];
    for (let i = dataStartIdx; i < lines.length; i++) {
        const cols = lines[i].split(sep).map(c => c.trim().replace(/^"|"$/g, ''));
        const row = {};
        headers.forEach((h, idx) => { row[h] = cols[idx] !== undefined ? cols[idx] : ''; });
        rows.push(row);
    }
    return { headers, rows };
}

// ============================================================
// 技能/被动 文件夹解析 (JSON文件)
// ============================================================
// 递归查找匹配前缀的文件 (支持无扩展名和子目录)
function findFilesRecursive(dirPath, prefix) {
    const results = [];
    try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                // 递归搜索子目录
                results.push(...findFilesRecursive(fullPath, prefix));
            } else if (entry.isFile() && entry.name.startsWith(prefix)) {
                // 匹配前缀，不限制扩展名 (支持 .json 和无扩展名)
                results.push(fullPath);
            }
        }
    } catch (e) {}
    return results;
}

function parseSkillFolder(folderPath, type) {
    const result = {};
    if (!folderPath || !isDirectory(folderPath)) {
        console.log('  ⚠️ 文件夹不存在或无法访问:', folderPath);
        return result;
    }

    let prefix;
    if (type === 'skill') prefix = 'Basic_Information-';
    else if (type === 'skillModule') prefix = 'module-';
    else if (type === 'stunt') prefix = 'baseStuntInfo-';
    else if (type === 'stuntModule') prefix = 'module-';
    else return result;

    // 递归查找匹配文件 (支持子目录和无扩展名)
    const filePaths = findFilesRecursive(folderPath, prefix);
    console.log('     找到文件:', filePaths.length, '个');

    filePaths.forEach(filePath => {
        try {
            const fileName = path.basename(filePath);
            const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            let sid = '', name = '', desc = '';
            let mainTag, normalTag, icon = '';

            if (type === 'skill') {
                sid = (fileName.match(/Basic_Information-(\d+)/) || [])[1] || '';
                name = data.name || '';
                desc = data.desc || data.detailedDesc || '';
            } else if (type === 'skillModule') {
                sid = String(data.id || '').padStart(10, '0');
                name = data.name || '';
                desc = data.desc || data.detailedDesc || '';
            } else if (type === 'stunt') {
                sid = (fileName.match(/baseStuntInfo-(\d+)/) || [])[1] || '';
                name = data.name || '';
                desc = data.text || '';
            } else if (type === 'stuntModule') {
                sid = String(data.group || '');
                name = data.name || '';
                desc = data.text || '';
            }

            // 技能图标: JSON 中的 skillIcon 为相对路径(如 jianke/2)，资源存放在 icon/skill/ 下
            if (data && data.skillIcon && String(data.skillIcon).trim()) {
                icon = 'skill/' + String(data.skillIcon).trim();
            }

            // 从战斗数据中提取 mainTag / normalTag (主动技能 Skill、被动技能 Stunt)
            if ((type === 'skill' || type === 'stunt') && data) {
                if (data.mainTag !== undefined && data.mainTag !== null) mainTag = data.mainTag;
                if (data.normalTag !== undefined && data.normalTag !== null) {
                    normalTag = Array.isArray(data.normalTag)
                        ? data.normalTag.map(v => String(v).trim()).filter(v => v !== '')
                        : [String(data.normalTag).trim()].filter(v => v !== '');
                }
            }

            if (sid && sid !== '0') {
                if (!result[sid]) result[sid] = { name: '', desc: '' };
                if (name) result[sid].name = name;
                if (desc) result[sid].desc = desc;
                if (icon) result[sid].icon = icon;
                if (mainTag !== undefined && mainTag !== null && mainTag !== '') result[sid].mainTag = mainTag;
                if (normalTag !== undefined && normalTag !== null && normalTag.length) result[sid].normalTag = normalTag;
            }
        } catch (err) {
            // 忽略解析错误
        }
    });

    return result;
}

function buildSkillObject(sid, name, desc, type, mainTag, normalTag, tagDict, icon) {
    const tags = {
        main: mainTag !== undefined && mainTag !== null ? String(mainTag).trim() : null,
        normal: normalTag || []
    };
    // 文本标签 (通过 SkillMainTag/SkillNormalTag 字典映射)
    let tagsText = null;
    if (tags.main !== null || (tags.normal && tags.normal.length)) {
        tagsText = {
            main: tags.main !== null ? ((tagDict && tagDict.main[tags.main]) || tags.main) : '',
            normal: (tags.normal || []).map(v => (tagDict && tagDict.normal[v]) || v).filter(v => v !== '' && v !== null && v !== undefined)
        };
    }
    if (type === 'active') {
        const b = sid[1], c = sid[2];
        const bc = b + c;
        const catMap = { '11': '战斗技能', '12': '法术技能', '14': '增益技能' };
        const category = catMap[bc] || '其他技能';
        const subMap = { '1': '战斗攻击', '2': '法术释放', '4': '增益辅助' };
        const subCategory = subMap[c] || '其他';
        return { id: sid, name: name || '未命名技能', category, subCategory, isNew: false, description: desc || '', tags: tags, tagsText: tagsText, icon: icon || '' };
    } else {
        const a = sid[0], b = sid[1] || '';
        let category = '其他特技';
        if (sid === '99998' || sid === '99999') {
            category = '天赋特技';
        } else if (a === '3') {
            category = '传奇特技';
        } else {
            const bcMap = { '1': '捷系列', '2': '战斗特技', '3': '传奇特技', '4': '增益特技', '5': '特殊增益' };
            category = bcMap[b] || '其他特技';
        }
        const c = sid[2] || '';
        const subMap = { '1': '攻击', '2': '法术', '4': '增益', '5': '特殊' };
        const subCategory = (sid === '99998' || sid === '99999') ? '天赋' : (subMap[c] || '通用');
        return { id: sid, name: name || '未命名特技', category, subCategory, isNew: false, description: desc || '', tags: tags, tagsText: tagsText, icon: icon || '' };
    }
}

// ============================================================
// 数据解析器
// ============================================================

// 主动技能 + 被动技能
function parseBattleData(config) {
    console.log('  📖 解析技能数据...');

    const skillMap = parseSkillFolder(config.skillFolder, 'skill');
    const skillModuleMap = parseSkillFolder(config.skillModuleFolder, 'skillModule');
    const stuntMap = parseSkillFolder(config.stuntFolder, 'stunt');
    const stuntModuleMap = parseSkillFolder(config.stuntModuleFolder, 'stuntModule');

    // 合并主动技能
    const mergedActive = {};
    Object.assign(mergedActive, skillModuleMap);
    for (const sid in skillMap) {
        if (mergedActive[sid]) {
            if (skillMap[sid].name) mergedActive[sid].name = skillMap[sid].name;
            if (skillMap[sid].desc) mergedActive[sid].desc = skillMap[sid].desc;
            if (skillMap[sid].icon) mergedActive[sid].icon = skillMap[sid].icon;
            if (skillMap[sid].mainTag !== undefined) mergedActive[sid].mainTag = skillMap[sid].mainTag;
            if (skillMap[sid].normalTag !== undefined) mergedActive[sid].normalTag = skillMap[sid].normalTag;
        } else {
            mergedActive[sid] = skillMap[sid];
        }
    }

    // 合并被动技能
    const mergedPassive = {};
    Object.assign(mergedPassive, stuntModuleMap);
    for (const sid in stuntMap) {
        if (mergedPassive[sid]) {
            if (stuntMap[sid].name) mergedPassive[sid].name = stuntMap[sid].name;
            if (stuntMap[sid].desc) mergedPassive[sid].desc = stuntMap[sid].desc;
            if (stuntMap[sid].icon) mergedPassive[sid].icon = stuntMap[sid].icon;
            if (stuntMap[sid].mainTag !== undefined) mergedPassive[sid].mainTag = stuntMap[sid].mainTag;
            if (stuntMap[sid].normalTag !== undefined) mergedPassive[sid].normalTag = stuntMap[sid].normalTag;
        } else {
            mergedPassive[sid] = stuntMap[sid];
        }
    }

    // 过滤主动技能：10位ID且首位为1
    const newActiveSkills = [];
    const tagDict = config.tagDict || null;
    for (const sid in mergedActive) {
        if (sid.length === 10 && sid[0] === '1') {
            newActiveSkills.push(buildSkillObject(sid, mergedActive[sid].name, mergedActive[sid].desc, 'active', mergedActive[sid].mainTag, mergedActive[sid].normalTag, tagDict, mergedActive[sid].icon));
        }
    }

    // 过滤被动技能：10位ID且首位为2或3，以及特殊5位ID
    const newPassiveSkills = [];
    for (const sid in mergedPassive) {
        if (sid.length === 10 && (sid[0] === '2' || sid[0] === '3')) {
            newPassiveSkills.push(buildSkillObject(sid, mergedPassive[sid].name, mergedPassive[sid].desc, 'passive', mergedPassive[sid].mainTag, mergedPassive[sid].normalTag, tagDict, mergedPassive[sid].icon));
        } else if (sid === '99998' || sid === '99999') {
            newPassiveSkills.push(buildSkillObject(sid, mergedPassive[sid].name, mergedPassive[sid].desc, 'passive', mergedPassive[sid].mainTag, mergedPassive[sid].normalTag, tagDict, mergedPassive[sid].icon));
        }
    }

    newActiveSkills.sort((a, b) => a.id.localeCompare(b.id));
    newPassiveSkills.sort((a, b) => a.id.localeCompare(b.id));

    console.log('     ✓ 主动技能:', newActiveSkills.length, '个');
    console.log('     ✓ 被动技能:', newPassiveSkills.length, '个');
    return { active: newActiveSkills, passive: newPassiveSkills };
}

// 词缀库 (支持文件夹或文件)
function parseAffixes(inputPath) {
    console.log('  📖 解析词缀库...');
    let filePath = inputPath;

    // 如果是文件夹，查找其中的 Excel/CSV 文件 (优先找含"词缀/Affix"的文件)
    if (isDirectory(inputPath)) {
        filePath = findDataFile(inputPath, ['.xlsx', '.xls', '.csv'], ['affix', '词缀']);
        if (!filePath) {
            console.log('  ⚠️ 文件夹中未找到 Excel/CSV 文件:', inputPath);
            return null;
        }
    }

    const ext = path.extname(filePath).toLowerCase();
    let headers, rows;

    if (ext === '.csv') {
        const parsed = parseCSVFile(filePath);
        headers = parsed.headers;
        rows = parsed.rows;
    } else {
        // 词缀子表可能命名为 Modifier/Affix/词缀 等
        const data = readSheetByName(filePath, ['Affix', 'Modifier', '词缀']);
        headers = data.headers;
        rows = data.rows;
        console.log('     子表:', data.sheetName);
    }
    console.log('     行数:', rows.length);

    const idCol = findCol(headers, ['id', 'ID', 'Id', 'id.p', '技能', '词缀ID', '词缀id']);
    const nameCol = findCol(headers, ['name', 'Name', 'NAME', '名称']);
    const descCol = findCol(headers, ['desc', 'Desc', 'DESC', '描述']);
    const catCol = findCol(headers, ['category', 'Category', '类型', '分类', 'desc999']);
    const subCatCol = findCol(headers, ['subCategory', 'subCat', '子类型', '子分类']);

    console.log('     列映射: id=', idCol, ' name=', nameCol, ' desc=', descCol);

    const affixes = [];
    rows.forEach(row => {
        const id = idCol ? cleanNum(row[idCol]) : '';
        if (!id) return;
        affixes.push({
            id: id,
            name: nameCol ? (row[nameCol] || '').trim() : '',
            description: descCol ? (row[descCol] || '').trim() : '',
            category: catCol ? (row[catCol] || '').trim() : '通用词缀',
            subCategory: subCatCol ? (row[subCatCol] || '').trim() : '通用',
            isNew: false
        });
    });
    console.log('     ✓ 解析词缀:', affixes.length, '条');
    return affixes;
}

// 属性 (支持文件夹或文件)
function parseAttributes(inputPath) {
    console.log('  📖 解析属性数据...');
    let filePath = inputPath;

    if (isDirectory(inputPath)) {
        filePath = findDataFile(inputPath, ['.csv', '.xlsx', '.xls'], ['attr', '属性', 'attribute']);
        if (!filePath) {
            console.log('  ⚠️ 文件夹中未找到 CSV/Excel 文件:', inputPath);
            return null;
        }
    }

    console.log('     文件:', filePath);
    const ext = path.extname(filePath).toLowerCase();
    let headers, rows;

    if (ext === '.csv') {
        const parsed = parseCSVFile(filePath);
        headers = parsed.headers;
        rows = parsed.rows;
    } else {
        // 优先使用列匹配找到正确的子表 (避免误匹配 |新旧属性ID对照 等)
        const data = readSheetByCols(filePath, ['attrID', 'name', 'desc'], ['AttributeName', 'Attr', '属性', 'Attribute']);
        headers = data.headers;
        rows = data.rows;
        console.log('     子表:', data.sheetName);
    }
    console.log('     行数:', rows.length);
    console.log('     表头:', JSON.stringify(headers));

    const idCol = findCol(headers, ['id', 'ID', 'Id', 'id.p', 'attrID', 'attrId', 'attribute.p', 'attributeId', 'attribute_id']);
    const nameCol = findCol(headers, ['name', 'Name', 'NAME', '名称', '属性显示名']);
    const desc999Col = findCol(headers, ['desc999']);
    const descCol = findCol(headers, ['desc', 'Desc', 'DESC', '描述', '属性描述']);
    const catCol = findCol(headers, ['category', 'Category', '类型', 'attrType']);

    console.log('     列映射: id=', idCol, ' name=', nameCol, ' desc999=', desc999Col, ' desc=', descCol);

    // 打印前2条数据用于诊断
    if (rows.length > 0) {
        console.log('     样本数据[0]:', JSON.stringify(rows[0]));
        if (rows.length > 1) console.log('     样本数据[1]:', JSON.stringify(rows[1]));
    }

    // 检测 desc999 列数据是否包含乱码 (控制字符/二进制数据)
    // 如果有乱码，回退到 desc 列
    let useDescCol = descCol;
    if (desc999Col) {
        let garbledCount = 0;
        let validCount = 0;
        rows.slice(0, 10).forEach(row => {
            const val = (row[desc999Col] || '').toString();
            if (val) {
                // 检测控制字符 (\0, \t, \r, \n 等) 和替换字符
                if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(val) || /\uFFFD/.test(val)) {
                    garbledCount++;
                } else if (/[\u4e00-\u9fa5a-zA-Z]/.test(val)) {
                    validCount++;
                }
            }
        });
        if (garbledCount > validCount) {
            console.log('     ⚠️ desc999 列检测到乱码数据 (' + garbledCount + '/10 条含控制字符)，回退到 desc 列');
            useDescCol = descCol;
        } else {
            console.log('     ✓ desc999 列数据正常 (' + validCount + ' 条有效)');
            useDescCol = desc999Col;
        }
    }

    const attrs = [];
    rows.forEach(row => {
        const id = idCol ? cleanNum(row[idCol]) : '';
        if (!id) return;
        // 清理数据中的控制字符
        const cleanName = nameCol ? (row[nameCol] || '').toString().replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '').trim() : '';
        const cleanDesc = useDescCol ? (row[useDescCol] || '').toString().replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '').trim() : '';
        attrs.push({
            id: id,
            name: cleanName,
            description: cleanDesc,
            category: catCol ? (row[catCol] || '').toString().trim() : '属性',
            isNew: false
        });
    });
    console.log('     ✓ 解析属性:', attrs.length, '条');
    if (attrs.length > 0) {
        console.log('     首条属性:', JSON.stringify(attrs[0]));
    }
    return attrs;
}

// 装备库
function parseEquipment(inputPath) {
    console.log('  📖 解析装备库...');
    let filePath = inputPath;

    if (isDirectory(inputPath)) {
        filePath = findDataFile(inputPath, ['.xlsx', '.xls', '.csv'], ['equip', '装备', 'legend']);
        if (!filePath) {
            console.log('  ⚠️ 文件夹中未找到 Excel/CSV 文件:', inputPath);
            return null;
        }
    }

    const legendData = readSheetByName(filePath, ['LegendEquip', '装备']);
    const modData = readSheetByCols(filePath, ['stunt', 'affix', 'attr'], ['Modifier', '词条', 'modifier']);

    console.log('     LegendEquip子表:', legendData.sheetName, '  行数:', legendData.rows.length);
    console.log('     Modifier子表:', modData.sheetName, '  行数:', modData.rows.length);

    const modHeaders = modData.headers;
    const modRows = modData.rows;

    const modIdCol = findCol(modHeaders, ['id', 'ID', 'Id', 'id.p', 'modifierId']);
    const modStuntCol = findCol(modHeaders, ['stunt', 'Stunt', 'STUNT', '特技']);
    const modAffixCol = findCol(modHeaders, ['affix', 'Affix', 'AFFIX', 'skillAffix', '效果']);
    const modAttrCol = findCol(modHeaders, ['attr', 'Attr', 'ATTR', 'attribute', '提供属性']);

    const modifierMap = {};
    modRows.forEach(row => {
        const modId = modIdCol ? cleanNum(row[modIdCol]) : '';
        if (!modId || modifierMap[modId]) return;
        const effects = [];
        if (modStuntCol && row[modStuntCol] && cleanNum(row[modStuntCol])) {
            cleanNum(row[modStuntCol]).split(/[;|]/).forEach(id => { const tid = cleanNum(id); if (tid) effects.push({ refId: tid }); });
        }
        if (modAffixCol && row[modAffixCol] && cleanNum(row[modAffixCol])) {
            cleanNum(row[modAffixCol]).split(/[;|]/).forEach(id => { const tid = cleanNum(id); if (tid) effects.push({ refId: tid }); });
        }
        if (modAttrCol && row[modAttrCol] && cleanNum(row[modAttrCol])) {
            const attrVal = cleanNum(row[modAttrCol]);
            if (attrVal && attrVal !== '0' && attrVal !== '{}') {
                attrVal.split(/[;|]/).forEach(id => { const tid = cleanNum(id); if (tid && tid !== '0') effects.push({ refId: tid }); });
            }
        }
        modifierMap[modId] = { effects };
    });
    console.log('     词条映射:', Object.keys(modifierMap).length, '条');

    const legendHeaders = legendData.headers;
    const legendRows = legendData.rows;
    const nameCol = findCol(legendHeaders, ['name', 'Name', '前称号']);
    const desc998Col = findCol(legendHeaders, ['desc998', 'Desc998']);
    const desc999Col = findCol(legendHeaders, ['desc999', 'Desc999']);
    const mod1Col = findCol(legendHeaders, ['modifier1', 'Modifier1', '前缀词条']);
    const mod2Col = findCol(legendHeaders, ['modifier2', 'Modifier2', '后缀词条']);
    const idCol = findCol(legendHeaders, ['id.p', 'id', 'ID']);
    const iconCol = findCol(legendHeaders, ['icon', 'Icon', 'ICON', '图标']);
    const spIconCol = findCol(legendHeaders, ['spIcon', 'SpIcon', 'SPICON', '特殊图标']);

    const equips = [];
    let eqCounter = 0;
    legendRows.forEach(row => {
        const name = nameCol ? (row[nameCol] || '').trim() : '';
        if (!name) return;
        const desc999 = desc999Col ? (row[desc999Col] || '').trim() : '';
        const equipName = name + (desc999 ? ' - ' + desc999 : '');
        const equipSourceId = idCol ? cleanNum(row[idCol]) : '';

        let equipType = '暗金装备';
        if (desc998Col && row[desc998Col] && row[desc998Col].trim()) {
            equipType = row[desc998Col].trim();
        } else if (equipSourceId) {
            const prefix = equipSourceId.substring(0, 3);
            const idTypeMap = { '110': '武器', '120': '头盔', '130': '护甲', '140': '护盾', '150': '鞋子', '160': '手套', '190': '饰品' };
            if (idTypeMap[prefix]) equipType = idTypeMap[prefix];
        }

        const mod1Ids = mod1Col ? String(row[mod1Col] || '').split('|').map(s => cleanNum(s)).filter(s => s) : [];
        const mod2Ids = mod2Col ? String(row[mod2Col] || '').split('|').map(s => cleanNum(s)).filter(s => s) : [];
        const effects = [];
        [...mod1Ids, ...mod2Ids].forEach(modId => {
            const cleanModId = cleanNum(modId);
            if (modifierMap[cleanModId]) {
                modifierMap[cleanModId].effects.forEach(eff => effects.push({ refId: eff.refId }));
            }
        });

        eqCounter++;
        equips.push({
            id: 'EQ' + String(eqCounter).padStart(4, '0'),
            name: equipName, type: equipType, effects: effects,
            sourceId: equipSourceId, isNew: true, source: 'sync',
            icon: iconCol ? String(row[iconCol] || '').trim() : '',
            spIcon: spIconCol ? String(row[spIconCol] || '').trim() : ''
        });
    });
    console.log('     ✓ 解析装备:', equips.length, '件, 效果总数:', equips.reduce((s, e) => s + e.effects.length, 0));
    return equips;
}

// 辅助技能宝石库
function parseGems(inputPath) {
    console.log('  📖 解析辅助技能宝石库...');
    let filePath = inputPath;
    if (isDirectory(inputPath)) {
        filePath = findDataFile(inputPath, ['.xlsx', '.xls', '.csv'], ['gem', '宝石', 'skillgem']);
        if (!filePath) { console.log('  ⚠️ 文件夹中未找到文件:', inputPath); return null; }
    }

    const { headers, rows, sheetName } = readSheetByName(filePath, ['SkillGem', '宝石']);
    console.log('     子表:', sheetName, '  行数:', rows.length);

    const nameCol = findCol(headers, ['name', 'Name', '名称']);
    const descCol = findCol(headers, ['desc', 'Desc', '描述']);
    const affixCol = findCol(headers, ['skillAffix', 'SkillAffix', 'affix', 'Affix', '词缀id']);
    const stuntCol = findCol(headers, ['stunt', 'Stunt', '被动表id']);
    const attrCol = findCol(headers, ['attr', 'Attr', '提供属性']);
    const gemIdCol = findCol(headers, ['id.p', 'id', 'ID']);
    const rankCol = findCol(headers, ['rank', 'Rank', 'stageLevel', '所属阶级', '阶级', '品阶', '稀有度']);
    const iconCol = findCol(headers, ['icon', 'Icon', 'ICON', '图标']);

    const gems = [];
    let gemCounter = 0;
    rows.forEach(row => {
        const name = nameCol ? (row[nameCol] || '').trim() : '';
        // 过滤空行与元数据行(如 stageLevel/string 类型说明行)
        if (!name || name === 'stageLevel' || name === 'string') return;
        const gemSourceId = gemIdCol ? cleanNum(row[gemIdCol]) : '';
        const desc = descCol ? (row[descCol] || '').trim() : '';
        const effects = [];
        if (affixCol && row[affixCol] && String(row[affixCol]).trim()) {
            String(row[affixCol]).split(/[;|]/).forEach(id => { const tid = id.trim(); if (tid) effects.push({ refId: tid }); });
        }
        if (stuntCol && row[stuntCol] && String(row[stuntCol]).trim()) {
            String(row[stuntCol]).split(/[;|]/).forEach(id => { const tid = id.trim(); if (tid) effects.push({ refId: tid }); });
        }
        if (attrCol && row[attrCol] && String(row[attrCol]).trim()) {
            const attrVal = String(row[attrCol]).trim();
            if (attrVal && attrVal !== '0' && attrVal !== '{}') {
                attrVal.split(/[;|]/).forEach(id => { const tid = id.trim(); if (tid && tid !== '0') effects.push({ refId: tid }); });
            }
        }
        gemCounter++;
        const gemIconRaw = iconCol ? String(row[iconCol] || '').trim() : ''; // 原始引用: 如 skill/sect/101101
        let gemIcon = gemIconRaw ? 'baoshi/' + gemIconRaw.split('/').pop() : ''; // 目标路径: baoshi/101101
        gems.push({
            id: 'GEM' + String(gemCounter).padStart(4, '0'),
            name: name, type: '辅助宝石', desc: desc, effects: effects,
            rank: rankCol ? String(row[rankCol] || '').trim() : '',
            sourceId: gemSourceId, isNew: true, source: 'sync',
            icon: gemIcon,
            iconSrc: gemIconRaw
        });
    });
    console.log('     ✓ 解析宝石:', gems.length, '个');
    return gems;
}

// 技能库 (SkillActive 子表: skill/stunt → 映射战斗数据中的技能ID，读取效果描述)
// 技能标签字典 (战斗技能相关表.xlsx: SkillMainTag / SkillNormalTag → 数字→文本)
function parseSkillTagDict(inputPath) {
    console.log('  📖 解析技能标签字典(SkillMainTag/SkillNormalTag)...');
    let filePath = inputPath;
    if (isDirectory(inputPath)) {
        filePath = findDataFile(inputPath, ['.xlsx', '.xls', '.csv'], ['skill', '技能', '标签']);
        if (!filePath) { console.log('  ⚠️ 文件夹中未找到 Excel/CSV 文件:', inputPath); return null; }
    }
    const dict = { main: {}, normal: {} };

    const mt = readSheetByName(filePath, ['SkillMainTag', 'MainTag', '主标签']);
    const mtIdCol = findCol(mt.headers, ['mainTag.p', 'id', 'ID', 'Id']);
    const mtTextCol = findCol(mt.headers, ['mainTagText', 'text', 'Text', '名称', 'name']);
    mt.rows.forEach(row => {
        const id = mtIdCol ? String(row[mtIdCol] || '').trim() : '';
        const text = mtTextCol ? String(row[mtTextCol] || '').trim() : '';
        if (id !== '' && text) dict.main[id] = text;
    });
    console.log('     主标签:', Object.keys(dict.main).length, '个');

    const nt = readSheetByName(filePath, ['SkillNormalTag', 'NormalTag', '常规标签']);
    const ntIdCol = findCol(nt.headers, ['normalTag.p', 'id', 'ID', 'Id']);
    const ntTextCol = findCol(nt.headers, ['normalTagText', 'text', 'Text', '名称', 'name']);
    nt.rows.forEach(row => {
        const id = ntIdCol ? String(row[ntIdCol] || '').trim() : '';
        const text = ntTextCol ? String(row[ntTextCol] || '').trim() : '';
        if (id !== '' && text) dict.normal[id] = text;
    });
    console.log('     常规标签:', Object.keys(dict.normal).length, '个');
    return dict;
}

function parseSkills(inputPath, skillMap, tagDict) {
    console.log('  📖 解析技能库(SkillActive)...');
    let filePath = inputPath;
    if (isDirectory(inputPath)) {
        filePath = findDataFile(inputPath, ['.xlsx', '.xls', '.csv'], ['skillactive', '技能']);
        if (!filePath) { console.log('  ⚠️ 文件夹中未找到 Excel/CSV 文件:', inputPath); return null; }
    }

    const { headers, rows, sheetName } = readSheetByName(filePath, ['SkillActive', '技能']);
    console.log('     子表:', sheetName, '  行数:', rows.length);

    const skillCol = findCol(headers, ['skill', 'Skill', 'SKILL']);
    const stuntCol = findCol(headers, ['stunt', 'Stunt', 'STUNT']);
    const desc999Col = findCol(headers, ['desc999', 'Desc999', 'DESC999']);

    const skills = [];
    rows.forEach(row => {
        const skillId = skillCol ? String(row[skillCol] || '').trim() : '';
        const stuntId = stuntCol ? String(row[stuntCol] || '').trim() : '';
        const refId = cleanNum(skillId) || cleanNum(stuntId);
        if (!refId) return;

        // 名称：优先取 desc999，否则从战斗数据映射中查找
        let name = desc999Col ? String(row[desc999Col] || '').trim() : '';
        let desc = '';
        let type = '未分类';

        const refData = skillMap[refId];
        if (refData) {
            if (!name) name = refData.name || '';
            desc = refData.desc || '';
            type = (refId[0] === '1') ? '主动技能' : '被动技能';
        }
        if (!name) name = '未命名技能_' + refId;

        // 标签: 从战斗数据(activeSkills/passiveSkills)提取 mainTag/normalTag，再通过字典映射为文本
        let tags = null;
        if (refData && refData.tags) {
            const mainRaw = refData.tags.main;
            const normalRaw = refData.tags.normal || [];
            const mainText = (mainRaw !== null && mainRaw !== '')
                ? ((tagDict && tagDict.main[mainRaw]) || mainRaw) : '';
            const normalTexts = normalRaw
                .map(v => (tagDict && tagDict.normal[v]) || v)
                .filter(v => v !== '' && v !== null && v !== undefined);
            if (mainText !== '' || normalTexts.length) {
                tags = { main: mainText, normal: normalTexts };
            }
        }

        skills.push({
            id: '',
            name: name, type: type, desc: desc,
            sourceId: refId,
            tags: tags,
            icon: refData && refData.icon ? refData.icon : '',
            effects: [{ refId: refId }],
            isNew: true, source: 'sync'
        });
    });
    console.log('     ✓ 解析技能库:', skills.length, '个');
    return skills;
}

// ============================================================
// 职业天赋系统 (SkillPassive 子表)
// occupation >= 1 的行按职业分组，desc999 即为职业名
// ============================================================

function parseOccupations(inputPath, skillMap) {
    console.log('  📖 解析职业天赋系统(SkillPassive)...');
    let filePath = inputPath;
    if (isDirectory(inputPath)) {
        filePath = findDataFile(inputPath, ['.xlsx', '.xls', '.csv'], ['skill', '技能', '养成']);
        if (!filePath) { console.log('  ⚠️ 文件夹中未找到 Excel/CSV 文件:', inputPath); return null; }
    }

    const { headers, rows, sheetName } = readSheetByName(filePath, ['SkillPassive', 'Passive']);
    console.log('     子表:', sheetName, '  行数:', rows.length);

    const idCol       = findCol(headers, ['id.p', 'id', 'ID', 'Id']);
    const desc999Col  = findCol(headers, ['desc999', 'Desc999']);
    const occCol      = findCol(headers, ['occupation', 'Occupation', '职业']);
    const viewPosCol  = findCol(headers, ['viewPos', 'ViewPos', '坐标']);
    const iconCol     = findCol(headers, ['icon', 'Icon', 'ICON', '图标']);
    const nameCol     = findCol(headers, ['name', 'Name', '名称']);
    const descCol     = findCol(headers, ['desc', 'Desc', '描述']);
    const sizeCol     = findCol(headers, ['size', 'Size', '节点大小']);
    const linkCol     = findCol(headers, ['linkPoint', 'LinkPoint', '关联的节点id']);

    const occMap = {};

    rows.forEach(row => {
        const occNum = parseInt(occCol ? String(row[occCol] || '').trim() : '');
        if (isNaN(occNum) || occNum < 1) return;

        const id = idCol ? cleanNum(row[idCol]) : '';
        if (!id) return;

        const desc999 = desc999Col ? String(row[desc999Col] || '').trim() : '';

        let posX = 0, posY = 0;
        const viewPos = viewPosCol ? String(row[viewPosCol] || '').trim() : '';
        if (viewPos) {
            const parts = viewPos.split('|');
            if (parts.length >= 2) { posX = parseFloat(parts[0]) || 0; posY = parseFloat(parts[1]) || 0; }
        }

        const iconRaw = iconCol ? String(row[iconCol] || '').trim() : '';
        let emoji = '⭐';
        if (iconRaw.includes('attribute')) emoji = '🔵';
        else if (iconRaw.includes('attack') || iconRaw.includes('atk')) emoji = '⚔️';
        else if (iconRaw.includes('defense') || iconRaw.includes('def')) emoji = '🛡️';
        else if (iconRaw.includes('skill')) emoji = '✨';
        else if (iconRaw.includes('talent')) emoji = '🔶';

        if (!occMap[occNum]) occMap[occNum] = { name: '', points: [] };
        if (!occMap[occNum].name && desc999) occMap[occNum].name = desc999.includes('旧版') ? '通用' : desc999.split('-')[0].trim();
        occMap[occNum].points.push({
            id: id,
            name: (nameCol ? String(row[nameCol] || '').trim() : '') || ('天赋' + id),
            desc: descCol ? String(row[descCol] || '').trim() : '',
            occupation: occNum,
            viewPos: { x: posX, y: posY },
            size: parseInt(sizeCol ? cleanNum(row[sizeCol]) : '1') || 1,
            icon: emoji,
            iconSrc: iconRaw,
            linkPoint: linkCol ? String(row[linkCol] || '').trim() : ''
        });
    });

    const occupations = Object.keys(occMap).map(occNum => {
        const num = parseInt(occNum);
        const entry = occMap[num];
        return {
            id: 'OCC' + String(num).padStart(2, '0'),
            occupation: num,
            name: entry.name || ('职业' + num),
            talentPoints: entry.points
        };
    }).sort((a, b) => a.occupation - b.occupation);

    // 剑客/通用职业: 删除攻速节点，将相邻非攻速节点直连
    occupations.forEach(occ => {
        if (!occ.name.includes('剑客') && occ.name !== '通用') return;
        const pts = occ.talentPoints;
        const asIds = new Set(pts.filter(p => p.name === '攻击速度').map(p => p.id));
        if (asIds.size === 0) return;

        // 构建邻接表
        const adj = {};
        pts.forEach(p => { adj[p.id] = (p.linkPoint || '').split('|').map(s => s.trim()).filter(s => s); });

        // 将所有攻速节点视为一个整体，收集其所有非攻速邻居（边界节点）
        const boundary = new Set();
        asIds.forEach(asId => {
            (adj[asId] || []).forEach(id => { if (!asIds.has(id)) boundary.add(id); });
        });
        // 边界节点之间互连（处理 AS 链式节点：A→AS1→AS2→B 的情况）
        const boundaryArr = Array.from(boundary);
        for (let i = 0; i < boundaryArr.length; i++) {
            for (let j = i + 1; j < boundaryArr.length; j++) {
                const a = boundaryArr[i], b = boundaryArr[j];
                if (!adj[a].includes(b)) adj[a].push(b);
                if (!adj[b].includes(a)) adj[b].push(a);
            }
        }

        // 过滤攻速节点，更新 linkPoint
        occ.talentPoints = pts
            .filter(p => !asIds.has(p.id))
            .map(p => {
                const links = (adj[p.id] || []).filter(id => !asIds.has(id));
                return { ...p, linkPoint: links.join('|') };
            });
    });

    // 剑客1: 调整布局 — 流风增击/看破上移，重建4行链式连接(从下到上 1-2-3-4)
    const jianke1 = occupations.find(o => o.name === '剑客1');
    if (jianke1) {
        const posAdjust = {
            '1003006': { y: 320 },  // 流风增击 上移
            '1003004': { y: 320 }   // 看破 上移
        };
        // 4行链式连接: 无心则利刃→心眼→快攻→流风增击/看破; 侧支: 暴血→流风增击, 极寒侵体→看破
        const linkMap = {
            '1003014': '1003012',                                           // 无心则利刃 → 心眼
            '1003012': '1003002|1003014',                                   // 心眼 → 快攻, 无心则利刃
            '1003002': '1003004|1003006|1003012',                           // 快攻 → 看破, 流风增击, 心眼
            '1003006': '1003002|1003008',                                   // 流风增击 → 快攻, 暴血
            '1003004': '1003002|1003010',                                   // 看破 → 快攻, 极寒侵体
            '1003008': '1003006',                                           // 暴血 → 流风增击
            '1003010': '1003004'                                            // 极寒侵体 → 看破
        };
        jianke1.talentPoints.forEach(p => {
            if (posAdjust[p.id]) p.viewPos.y = posAdjust[p.id].y;
            if (linkMap[p.id]) p.linkPoint = linkMap[p.id];
        });
    }

    console.log('     ✓ 解析职业:', occupations.length, '个');
    occupations.forEach(occ => {
        console.log('       ' + occ.name + '(occupation=' + occ.occupation + '): ' + occ.talentPoints.length + ' 个天赋点');
    });
    return occupations;
}

// ============================================================
// 魔宠表 (Pet / PetStar 子表)
// Pet: id.p(魔宠id), name(名字), quality(品质: 3蓝/4紫/6橙/8红), pic(头像), getBg(背景), getPic(立绘)
// PetStar: pet(魔宠id), star(星级), skillAffix(词缀id, |分隔), affixValue(词缀值 JSON), stunt(被动技能id), attr(属性id+值 JSON)
// ============================================================
function parsePets(inputPath) {
    console.log('  📖 解析魔宠表...');
    let filePath = inputPath;

    if (isDirectory(inputPath)) {
        filePath = findDataFile(inputPath, ['.xlsx', '.xls', '.csv'], ['魔宠', 'pet']);
        if (!filePath) {
            console.log('  ⚠️ 文件夹中未找到魔宠表:', inputPath);
            return null;
        }
    } else if (!fs.existsSync(filePath)) {
        // 尝试补全扩展名 (.xlsx/.xls/.csv)
        const exts = ['.xlsx', '.xls', '.csv'];
        for (const ext of exts) {
            if (fs.existsSync(filePath + ext)) { filePath = filePath + ext; break; }
        }
        if (!fs.existsSync(filePath)) {
            console.log('  ⚠️ 魔宠表不存在:', inputPath);
            return null;
        }
    }
    console.log('     文件:', filePath);

    const petData = readSheetByName(filePath, ['Pet']);
    const starData = readSheetByName(filePath, ['PetStar']);
    console.log('     Pet子表:', petData.sheetName, '  行数:', petData.rows.length);
    console.log('     PetStar子表:', starData.sheetName, '  行数:', starData.rows.length);

    const idCol = findCol(petData.headers, ['id', 'ID', 'Id', 'id.p', '宠物id', '魔宠id']);
    const nameCol = findCol(petData.headers, ['name', 'Name', '名称', '魔宠名称']);
    const qualityCol = findCol(petData.headers, ['quality', '品质']);
    const picCol = findCol(petData.headers, ['pic', '头像']);
    const getBgCol = findCol(petData.headers, ['getBg', '背景']);
    const getPicCol = findCol(petData.headers, ['getPic', '立绘']);

    // 解析 attr "[[id,value],...]" → [{id, value}]
    const parseAttrPairs = (raw) => {
        try {
            const arr = JSON.parse(raw || '[]');
            if (!Array.isArray(arr)) return [];
            return arr.map(pair => Array.isArray(pair) && pair.length >= 1 && pair[0]
                ? { id: cleanNum(pair[0]), value: pair.length > 1 ? pair[1] : null }
                : null).filter(Boolean);
        } catch (e) { return []; }
    };
    // 解析 skillAffix "a|b|c" 与 affixValue "[[v1],[v2]]" → [{id, value}]
    const parseAffixPairs = (affixRaw, valueRaw) => {
        const ids = String(affixRaw || '').split('|').map(s => s.trim()).filter(Boolean);
        let values = [];
        try {
            const v = JSON.parse(valueRaw || '[]');
            if (Array.isArray(v)) values = v.map(sub => Array.isArray(sub) && sub.length ? sub[0] : sub);
        } catch (e) {}
        return ids.map((id, i) => ({ id: cleanNum(id), value: i < values.length ? values[i] : null }));
    };
    // 解析 stunt "a|b" → [ids]
    const parseStuntIds = (raw) => String(raw || '').split('|').map(s => s.trim()).filter(Boolean).map(cleanNum);

    // 按魔宠分组解析星级效果
    const starCol = findCol(starData.headers, ['star', 'Star', '星级']);
    const petCol = findCol(starData.headers, ['pet', 'Pet', '魔宠Id', '魔宠id']);
    const skillAffixCol = findCol(starData.headers, ['skillAffix', '词缀id']);
    const affixValueCol = findCol(starData.headers, ['affixValue', '词缀值']);
    const stuntCol = findCol(starData.headers, ['stunt', '被动表id']);
    const attrCol = findCol(starData.headers, ['attr', '提供属性']);

    const starRows = {};
    starData.rows.forEach(row => {
        const petId = petCol ? cleanNum(row[petCol]) : '';
        const star = starCol ? cleanNum(row[starCol]) : '';
        if (!petId || star === '') return;
        if (!starRows[petId]) starRows[petId] = [];
        starRows[petId].push({
            star: parseInt(star, 10) || 0,
            skillAffix: parseAffixPairs(row[skillAffixCol], row[affixValueCol]),
            stunt: parseStuntIds(row[stuntCol]),
            attr: parseAttrPairs(row[attrCol])
        });
    });
    Object.keys(starRows).forEach(k => starRows[k].sort((a, b) => a.star - b.star));

    // 构建魔宠列表
    const pets = [];
    petData.rows.forEach(row => {
        const id = idCol ? cleanNum(row[idCol]) : '';
        if (!id) return;
        pets.push({
            id: id,
            name: nameCol ? (row[nameCol] || '').trim() : '',
            quality: qualityCol ? cleanNum(row[qualityCol]) : '',
            pic: picCol ? (row[picCol] || '').trim() : '',
            getBg: getBgCol ? (row[getBgCol] || '').trim() : '',
            getPic: getPicCol ? (row[getPicCol] || '').trim() : '',
            stars: starRows[id] || []
        });
    });
    console.log('     ✓ 解析魔宠:', pets.length, '个');
    return pets;
}

// ============================================================
// 主流程
// ============================================================

// 同步图标资源到项目 icon/ 目录 (幂等: 已存在且大小一致则跳过)
// 图标引用来自导入数据: 装备 icon/spIcon、宝石 icon、技能 skillIcon
function syncIcons(importData, config) {
    const iconRoot = config.iconPath && String(config.iconPath).trim()
        ? String(config.iconPath).trim().replace(/[\\/]+$/, '')
        : '';
    if (!iconRoot) {
        console.log('  ⚠️ 未配置 iconPath，跳过图标资源同步');
        return;
    }
    const destRoot = path.join(__dirname, 'icon');

    // 收集图标引用: {src: 源目录相对路径, dst: icon/ 下目标路径}
    // 装备/技能源路径与目标路径一致；宝石源为原始引用(如 skill/sect/101101)，目标为扁平路径(baoshi/101101)
    const refs = new Map();
    const addRef = (src, dst) => { if (src && dst) refs.set(src + '|' + dst, { src, dst }); };
    (importData.equipment || []).forEach(e => { addRef(e.icon, e.icon); addRef(e.spIcon, e.spIcon); });
    (importData.gems || []).forEach(g => addRef(g.iconSrc || g.icon, g.icon));
    [...(importData.activeSkills || []), ...(importData.passiveSkills || []), ...(importData.skills || [])].forEach(s => addRef(s.icon, s.icon));
    // 职业天赋点图标
    (importData.occupations || []).forEach(o => (o.talentPoints || []).forEach(p => addRef(p.iconSrc, p.iconSrc)));
    // 魔宠图标: 头像 pic / 获得背景 getBg / 获得立绘 getPic
    (importData.pets || []).forEach(p => { addRef(p.pic, p.pic); addRef(p.getBg, p.getBg); addRef(p.getPic, p.getPic); });

    if (refs.size === 0) {
        console.log('  📦 图标资源: 无图标引用');
        return;
    }

    let copied = 0, skipped = 0, missing = 0;
    for (const { src, dst } of refs.values()) {
        const srcPath = path.join(iconRoot, src.replace(/\//g, path.sep) + '.png');
        const dstPath = path.join(destRoot, dst.replace(/\//g, path.sep) + '.png');
        if (!fs.existsSync(srcPath)) { missing++; console.log('    ⚠️ 源图标缺失:', src); continue; }
        if (fs.existsSync(dstPath)) {
            try {
                if (fs.statSync(dstPath).size === fs.statSync(srcPath).size) { skipped++; continue; }
            } catch (e) {}
        }
        fs.mkdirSync(path.dirname(dstPath), { recursive: true });
        fs.copyFileSync(srcPath, dstPath);
        copied++;
    }
    console.log(`  📦 图标资源同步: 新增 ${copied} 个, 已存在跳过 ${skipped} 个, 源缺失 ${missing} 个`);
}

function main() {
    console.log('╔══════════════════════════════════════╗');
    console.log('║    古荒大陆数据导入工具 v2.0           ║');
    console.log('╚══════════════════════════════════════╝');
    console.log('');

    // 检查配置文件
    if (!fs.existsSync(CONFIG_FILE)) {
        console.log('📝 首次运行，生成配置文件...');
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
        console.log('✓ 配置文件已生成: import-config.json');
        console.log('   已填入默认路径，直接开始导入...');
        console.log('');
    } else {
        console.log('📋 读取配置: import-config.json');
    }

    // 合并默认配置与文件配置 (文件配置优先，缺省字段回退到默认值)
    const config = { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')) };

    // 规范化数据源路径：相对路径(如 data-sources/Skill)解析到本项目目录，绝对路径保持不变
    const pathKeys = ['skillFolder', 'skillModuleFolder', 'stuntFolder', 'stuntModuleFolder', 'affixPath', 'equipPath', 'gemPath', 'attrPath', 'skillExcelPath', 'skillTagPath', 'occupationPath', 'iconPath', 'videoPath', 'petPath'];
    pathKeys.forEach(k => {
        if (config[k] && String(config[k]).trim()) {
            config[k] = resolvePath(String(config[k]).trim());
        }
    });
    console.log('');

    const importData = {
        activeSkills: null,
        passiveSkills: null,
        affixes: null,
        attributes: null,
        equipment: null,
        gems: null,
        skills: null,
        occupations: null,
        videos: null,
        pets: null,
        importTime: new Date().toISOString()
    };

    let hasAny = false;

    // 0. 技能标签字典 (战斗技能相关表.xlsx: SkillMainTag / SkillNormalTag)
    //    提前解析并写入 config.tagDict，供战斗数据(parseBattleData)与技能库(parseSkills)使用
    let tagDict = null;
    if (config.skillTagPath && config.skillTagPath.trim()) {
        const tagFp = smartResolvePath(config.skillTagPath.trim());
        if (tagFp && fs.existsSync(tagFp)) {
            tagDict = parseSkillTagDict(tagFp);
            config.tagDict = tagDict;
        } else {
            console.log('  ⚠️ 技能标签字典路径不存在:', config.skillTagPath.trim());
        }
        console.log('');
    }

    // 1. 技能数据 (主动 + 被动)
    if ((config.skillFolder && config.skillFolder.trim()) ||
        (config.stuntFolder && config.stuntFolder.trim())) {
        try {
            const battleData = parseBattleData(config);
            importData.activeSkills = battleData.active;
            importData.passiveSkills = battleData.passive;
            hasAny = true;
        } catch (err) {
            console.log('  ❌ 技能数据解析失败:', err.message);
        }
        console.log('');
    }

    // 2. 词缀
    if (config.affixPath && config.affixPath.trim()) {
        const fp = smartResolvePath(config.affixPath.trim());
        if (fp && fs.existsSync(fp)) {
            try {
                importData.affixes = parseAffixes(fp);
                if (importData.affixes) hasAny = true;
            } catch (err) {
                console.log('  ❌ 词缀库解析失败:', err.message);
            }
        } else {
            console.log('  ⚠️ 词缀库路径不存在:', config.affixPath.trim());
        }
        console.log('');
    }

    // 3. 属性
    if (config.attrPath && config.attrPath.trim()) {
        const fp = smartResolvePath(config.attrPath.trim());
        if (fp && fs.existsSync(fp)) {
            try {
                importData.attributes = parseAttributes(fp);
                if (importData.attributes) hasAny = true;
            } catch (err) {
                console.log('  ❌ 属性数据解析失败:', err.message);
            }
        } else {
            console.log('  ⚠️ 属性路径不存在:', config.attrPath.trim());
        }
        console.log('');
    }

    // 4. 装备
    if (config.equipPath && config.equipPath.trim()) {
        const fp = smartResolvePath(config.equipPath.trim());
        if (fp && fs.existsSync(fp)) {
            try {
                importData.equipment = parseEquipment(fp);
                if (importData.equipment) hasAny = true;
            } catch (err) {
                console.log('  ❌ 装备库解析失败:', err.message);
            }
        } else {
            console.log('  ⚠️ 装备库路径不存在:', config.equipPath.trim());
        }
        console.log('');
    }

    // 5. 宝石
    if (config.gemPath && config.gemPath.trim()) {
        const fp = smartResolvePath(config.gemPath.trim());
        if (fp && fs.existsSync(fp)) {
            try {
                importData.gems = parseGems(fp);
                if (importData.gems) hasAny = true;
            } catch (err) {
                console.log('  ❌ 辅助技能库解析失败:', err.message);
            }
        } else {
            console.log('  ⚠️ 辅助技能库路径不存在:', config.gemPath.trim());
        }
        console.log('');
    }

    // 6. 技能库 (SkillActive 子表: skill/stunt → 映射战斗数据技能ID)
    if (config.skillExcelPath && config.skillExcelPath.trim()) {
        const fp = smartResolvePath(config.skillExcelPath.trim());
        if (fp && fs.existsSync(fp)) {
            try {
                // 构建战斗数据技能映射 (id → {name, desc, tags})
                const skillMap = {};
                [...(importData.activeSkills || []), ...(importData.passiveSkills || [])].forEach(s => { if (s.id) skillMap[s.id] = s; });
                // 技能标签字典 (步骤0已解析)
                const tagDict = config.tagDict || null;
                importData.skills = parseSkills(fp, skillMap, tagDict);
                if (importData.skills) hasAny = true;
            } catch (err) {
                console.log('  ❌ 技能库解析失败:', err.message);
            }
        } else {
            console.log('  ⚠️ 技能库路径不存在:', config.skillExcelPath.trim());
        }
        console.log('');
    }

    // 7. 职业天赋系统 (SkillPassive 子表: occupation >= 1 的天赋点)
    if (config.occupationPath && config.occupationPath.trim()) {
        const fp = smartResolvePath(config.occupationPath.trim());
        if (fp && fs.existsSync(fp)) {
            try {
                const skillMap = {};
                [...(importData.activeSkills || []), ...(importData.passiveSkills || [])].forEach(s => { if (s.id) skillMap[s.id] = s; });
                importData.occupations = parseOccupations(fp, skillMap);
                if (importData.occupations) hasAny = true;
            } catch (err) {
                console.log('  ❌ 职业天赋系统解析失败:', err.message);
            }
        } else {
            console.log('  ⚠️ 职业天赋系统路径不存在:', config.occupationPath.trim());
        }
        console.log('');
    }

    // 8. 视频库 (从 videoPath 源目录同步视频到 videos/ 文件夹，视频文件名 = 技能名称，生成清单)
    {
        const videoDir = path.join(__dirname, 'videos');
        // 8.1 源目录同步: 若配置了 videoPath，把其中的视频文件复制到 videos/ 文件夹
        if (config.videoPath && config.videoPath.trim()) {
            const srcDir = resolvePath(config.videoPath.trim());
            if (srcDir && fs.existsSync(srcDir)) {
                try {
                    if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });
                    const srcFiles = fs.readdirSync(srcDir).filter(f => /\.(mp4|webm|ogg|mov|m4v)$/i.test(f));
                    let synced = 0;
                    for (const f of srcFiles) {
                        const src = path.join(srcDir, f);
                        const dst = path.join(videoDir, f);
                        try {
                            if (!fs.existsSync(dst) || fs.statSync(src).mtimeMs > fs.statSync(dst).mtimeMs) {
                                fs.copyFileSync(src, dst);
                                synced++;
                            }
                        } catch (e) {}
                    }
                    if (srcFiles.length > 0) console.log('  ✓ 视频源同步: 源目录 ' + srcFiles.length + ' 个视频 (更新 ' + synced + ' 个)');
                } catch (err) {
                    console.log('  ❌ 视频源目录同步失败:', err.message);
                }
            } else {
                console.log('  ⚠️ 视频源目录不存在:', config.videoPath.trim());
            }
        }
        // 8.2 扫描 videos/ 文件夹生成清单
        if (fs.existsSync(videoDir)) {
            try {
                const files = fs.readdirSync(videoDir)
                    .filter(f => /\.(mp4|webm|ogg|mov|m4v)$/i.test(f))
                    .sort();
                if (files.length > 0) {
                    importData.videos = files.map(f => ({ name: f.replace(/\.[^.]+$/, ''), file: f }));
                    hasAny = true;
                    console.log('  ✓ 视频库: ' + files.length + ' 个视频');
                } else {
                    console.log('  ⚠️ videos/ 文件夹为空或没有视频文件');
                }
            } catch (err) {
                console.log('  ❌ 视频库扫描失败:', err.message);
            }
        } else {
            console.log('  ⚠️ videos/ 文件夹不存在，跳过视频库扫描');
        }
        console.log('');
    }

    // 9. 魔宠表 (Pet / PetStar 子表)
    if (config.petPath && config.petPath.trim()) {
        const fp = smartResolvePath(config.petPath.trim());
        if (fp && fs.existsSync(fp)) {
            try {
                importData.pets = parsePets(fp);
                if (importData.pets) hasAny = true;
            } catch (err) {
                console.log('  ❌ 魔宠表解析失败:', err.message);
            }
        } else {
            console.log('  ⚠️ 魔宠表路径不存在:', config.petPath.trim());
        }
        console.log('');
    }

    if (!hasAny) {
        console.log('❌ 没有成功导入任何数据，请检查 import-config.json 中的路径。');
        return;
    }

    // 生成输出文件
    console.log('📝 生成数据文件: auto-import-data.js');
    const jsContent = '// 此文件由 import.js 自动生成，请勿手动编辑\n' +
        '// 生成时间: ' + importData.importTime + '\n' +
        'window.__AUTO_IMPORT_DATA__ = ' + JSON.stringify(importData, null, 2) + ';\n';

    fs.writeFileSync(OUTPUT_FILE, jsContent, 'utf-8');
    console.log('');
    console.log('✓ 导入完成！数据已写入: auto-import-data.js');
    console.log('');
    console.log('统计:');
    if (importData.activeSkills) console.log('  主动技能: ' + importData.activeSkills.length + ' 个');
    if (importData.passiveSkills) console.log('  被动技能: ' + importData.passiveSkills.length + ' 个');
    if (importData.affixes) console.log('  词缀: ' + importData.affixes.length + ' 条');
    if (importData.attributes) console.log('  属性: ' + importData.attributes.length + ' 条');
    if (importData.equipment) console.log('  装备: ' + importData.equipment.length + ' 件');
    if (importData.gems) console.log('  宝石: ' + importData.gems.length + ' 个');
    if (importData.skills) console.log('  技能库: ' + importData.skills.length + ' 个');
    if (importData.occupations) console.log('  职业天赋: ' + importData.occupations.length + ' 个职业, ' + importData.occupations.reduce((s, o) => s + o.talentPoints.length, 0) + ' 个天赋点');
    if (importData.videos) console.log('  视频库: ' + importData.videos.length + ' 个视频');
    if (importData.pets) console.log('  魔宠表: ' + importData.pets.length + ' 个魔宠, ' + importData.pets.reduce((s, p) => s + p.stars.length, 0) + ' 条星级效果');
    console.log('');

    // 7. 同步图标资源 (已有资源自动跳过)
    syncIcons(importData, config);

    console.log('');
    console.log('现在可以打开 index.html 查看数据。');
}

main();
