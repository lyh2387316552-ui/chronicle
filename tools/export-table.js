// ============================================================
// 导出本地 Excel/CSV 为 data/tables.json 中的数据表 (技能养成等)
// 用法: node tools/export-table.js <文件路径> <表名> [工作表名]
//   文件:     .xlsx/.xls/.csv, 自动检测 UTF-8/GBK 编码
//   表名:     data/tables.json 中的表名称 (页面"数据表"页展示)
//   工作表名: 可选, 默认使用第一个工作表
// 示例: node tools/export-table.js "E:\策划\技能养成.xlsx" "技能养成"
// 说明: 同名表会被覆盖, 其他表保留; 完成后 git push 即可上线
// ============================================================
const fs = require('fs');
const path = require('path');

let XLSX = null;
try {
    XLSX = require('../js/xlsx.min.js');
} catch (e) {
    try { XLSX = require('xlsx'); } catch (e2) {
        console.error('❌ 无法加载 XLSX 库, 请确保 js/xlsx.min.js 存在或已安装 xlsx 模块');
        process.exit(1);
    }
}

// UTF-8 有效性检测
function isValidUTF8(buf) {
    for (let i = 0; i < buf.length; i++) {
        const b = buf[i];
        if (b < 0x80) continue;
        let n = 0;
        if ((b & 0xE0) === 0xC0) n = 1;
        else if ((b & 0xF0) === 0xE0) n = 2;
        else if ((b & 0xF8) === 0xF0) n = 3;
        else return false;
        if (i + n >= buf.length) return false;
        for (let j = 1; j <= n; j++) {
            if ((buf[i + j] & 0xC0) !== 0x80) return false;
        }
        i += n;
    }
    return true;
}

// 读取工作簿 (兼容 .xlsx/.xls/.csv, 自动处理编码)
function readWorkbook(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const buf = fs.readFileSync(filePath);
    if (ext === '.csv') {
        if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
            return XLSX.read(buf.slice(3).toString('utf-8'), { type: 'string' });
        }
        if (buf.length >= 2 && buf[0] === 0xFF && buf[1] === 0xFE) {
            return XLSX.read(buf.toString('utf16le'), { type: 'string' });
        }
        if (isValidUTF8(buf)) {
            return XLSX.read(buf.toString('utf-8'), { type: 'string' });
        }
        console.log('   ⚠️ CSV 非 UTF-8 编码, 使用 GBK (codepage 936) 解码...');
        return XLSX.read(buf, { type: 'buffer', codepage: 936 });
    }
    if (ext === '.xls') {
        return XLSX.read(buf, { type: 'buffer', codepage: 936 });
    }
    return XLSX.read(buf, { type: 'buffer' });
}

function main() {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.log('用法: node tools/export-table.js <Excel/CSV路径> <表名> [工作表名]');
        console.log('示例: node tools/export-table.js "E:\\策划\\技能养成.xlsx" "技能养成"');
        process.exit(1);
    }
    const filePath = args[0];
    const tableName = args[1];
    const sheetName = args[2];

    if (!fs.existsSync(filePath)) {
        console.error('❌ 文件不存在: ' + filePath);
        process.exit(1);
    }

    console.log('📖 读取文件:', filePath);
    const wb = readWorkbook(filePath);
    let targetSheet = sheetName;
    if (!targetSheet) {
        targetSheet = wb.SheetNames[0];
        console.log('   工作表: 使用第一个 [' + targetSheet + ']');
    } else if (!wb.SheetNames.includes(targetSheet)) {
        console.error('❌ 工作表不存在: ' + targetSheet + ' (可用: ' + wb.SheetNames.join(', ') + ')');
        process.exit(1);
    }

    const rows = XLSX.utils.sheet_to_json(wb.Sheets[targetSheet], { defval: '' });
    if (rows.length === 0) {
        console.error('❌ 工作表为空, 未导出任何数据');
        process.exit(1);
    }

    // 检测无表头列 (多行表头/非标准布局的典型特征)
    const keys = Object.keys(rows[0] || {});
    const emptyCols = keys.filter(k => /^__EMPTY/.test(k)).length;
    if (emptyCols > 0 && emptyCols / keys.length > 0.5) {
        console.warn('   ⚠️ 检测到 ' + emptyCols + ' 个无表头列 (__EMPTY), 该工作表可能是多行表头或非标准布局');
        console.warn('     建议: 在 Excel 中整理为单行表头 (每列顶部一行列名) 后重新导出');
    }

    // 追加到数据仓库的 data/tables.json (保留其他表)
    const tablesPath = path.resolve(__dirname, '..', '..', 'chronicle-data', 'data', 'tables.json');
    if (!fs.existsSync(path.dirname(tablesPath))) {
        console.error('❌ 数据仓库目录不存在: ' + path.dirname(tablesPath));
        console.error('   请先克隆: git clone https://github.com/lyh2387316552-ui/chronicle-data.git (项目同级目录)');
        process.exit(1);
    }
    let tables = {};
    if (fs.existsSync(tablesPath)) {
        try { tables = JSON.parse(fs.readFileSync(tablesPath, 'utf-8')); } catch (e) { tables = {}; }
    }
    tables[tableName] = rows;
    fs.writeFileSync(tablesPath, JSON.stringify(tables, null, 2), 'utf-8');

    console.log('✅ 已写入 chronicle-data/data/tables.json: [' + tableName + '] ' + rows.length + ' 行');
    console.log('   列: ' + Object.keys(rows[0]).join(', '));
    console.log('   推送即可上线: git -C ../chronicle-data add data/tables.json && git -C ../chronicle-data commit -m "update ' + tableName + '" && git -C ../chronicle-data push');
}

main();
