# 📜 古荒大陆 - 游戏数据库

> 游戏数据百科全书 · 技能 · 词缀 · 装备 · 属性 · 宝石

一个纯前端的游戏数据管理工具，用于管理主动技能、被动技能、词缀库、属性库、暗金装备和辅助宝石数据。支持从本地 Excel/CSV/JSON 文件批量导入数据，并提供搜索、筛选、分类浏览等功能。

---

## 项目结构

```
chronicle-main/
├── index.html              # 主页面入口（含所有页面结构）
├── css/
│   └── style.css           # 全局样式表（tlidb.com 风格，深色主题）
├── js/
│   ├── app.js              # 应用核心逻辑（UI 渲染、导航、交互）
│   ├── data.js             # 内置数据库与数据管理（技能/词缀/属性/装备）
│   ├── auto-import-data.js # 自动生成的导入数据文件（import.js 产出）
│   └── xlsx.min.js         # SheetJS 库（Excel/CSV 解析，仅 tools 使用）
├── tools/
│   ├── import.js           # 数据导入脚本（Node.js，解析 Excel/CSV/JSON）
│   ├── import-config.json  # 导入配置文件（数据源路径，指向数据仓库）
│   ├── copy-data.js        # 数据源增量复制脚本（本地导出 → 数据仓库）
│   ├── dev-server.js       # 本地开发静态服务器（零依赖）
│   ├── 一键同步.bat        # 一键同步（复制表格 → 推送数据仓库/网站）
│   └── 更新数据.bat        # 只读模式：拉取最新数据生成本地网页（无权限团队用户）
├── assets/                 # 页面自有资源（logo、背景图等）
├── .gitignore              # Git 忽略规则
├── README.md               # 项目说明（本文件）
└── CHANGELOG.md            # 更新日志
```

> **数据与资源仓库**: 数据源表格、游戏图标、技能视频均存放在独立的 [chronicle-data](https://github.com/lyh2387316552-ui/chronicle-data) 仓库中（网站同级目录 `../chronicle-data`），网页运行时直接从中拉取图标/视频。

### 文件职责详解

| 文件 | 职责 | 关键函数/特性 |
|------|------|--------------|
| `index.html` | 页面骨架，定义所有页面和导航结构 | 首页、战斗数据、装备、宝石、统计、ID规则 |
| `css/style.css` | 视觉样式，参考 tlidb.com 深色设计 | 不对称圆角卡片、半透明背景、模糊毛玻璃 |
| `js/app.js` | 应用交互逻辑，所有渲染与事件处理 | `init()`, `navigateTo()`, `filterSkills()`, `renderEquipment()` |
| `js/data.js` | 数据层，内置默认数据 + 自动导入加载 | localStorage 垫片, `loadAutoImportData()` IIFE |
| `tools/import.js` | Node.js 脚本，解析数据仓库中的表格生成网页数据 | 编码检测(UTF-8/GBK), 递归文件搜索, desc999 乱码回退 |
| `tools/import-config.json` | 配置各数据源路径（指向数据仓库 `../chronicle-data`） | 技能/词缀/装备/属性/宝石路径 |
| `js/auto-import-data.js` | import.js 生成的 JS 数据文件 | `window.__AUTO_IMPORT_DATA__` 全局变量 |
| `js/xlsx.min.js` | SheetJS 库，提供 Excel/CSV 解析能力（仅 `tools/import.js` 使用，浏览器端不加载） | 第三方库，无需修改 |
| `tools/dev-server.js` | 本地开发静态服务器（零依赖） | `node tools/dev-server.js` |

---

## 快速开始

### 方式一：直接打开（使用内置数据）

双击 `index.html` 在浏览器中打开即可。内置数据来自 `data.js`；图标/视频从数据仓库公网拉取。

### 方式二：一键同步（推荐）

双击 `tools\一键同步.bat`，自动完成全流程：

1. 拉取数据仓库（不存在时自动克隆到项目同级 `../chronicle-data`）
2. 将本地游戏引擎/策划导出的表格增量复制到数据仓库
3. 推送数据仓库（图标/视频/表格更新）
4. 解析数据仓库中的表格，生成网页数据
5. 推送网站仓库，GitHub Pages 1~2 分钟后自动更新

> 生成 `js/auto-import-data.js`，页面加载时自动读取。网页中的图标/视频运行时直接访问 [chronicle-data Pages](https://lyh2387316552-ui.github.io/chronicle-data/)。数据更新由 GitHub Actions 自动同步（每 10 分钟拉取数据仓库 → 生成 → 有变化才推送），维护者只需 push 数据仓库。

---

## 数据源位置（数据仓库）

所有数据源位于 **chronicle-data 数据仓库**（网站同级目录 `../chronicle-data`），结构与约定：

| 数据源 | 数据仓库位置 | 支持格式 |
|--------|---------|---------|
| 主动技能 | `data-sources/Skill/` | `Basic_Information-*.json` |
| 主动技能模块 | `data-sources/SkillModule/` | `module-*.json` |
| 被动技能 | `data-sources/Stunt/` | `baseStuntInfo-*.json` |
| 被动技能模块 | `data-sources/StuntModule/` | `module-*.json` |
| 词缀/属性 | `data-sources/属性表.xlsx` | Excel（含词缀/属性子表） |
| 装备 | `data-sources/装备表.xlsx` | Excel（含 LegendEquip + Modifier 子表） |
| 辅助宝石 | `data-sources/技能养成相关.xlsx` | Excel（含 SkillGem 子表） |
| 技能库/职业天赋 | `data-sources/技能养成相关.xlsx` | Excel |
| 技能标签字典 | `data-sources/战斗技能相关表.xlsx` | Excel（含 SkillMainTag + SkillNormalTag 子表） |
| 魔宠表 | `data-sources/魔宠表.xlsx` | Excel |
| 游戏图标 | `icon/` | 网页运行时直接引用 |
| 技能视频 | `videos/` | 网页运行时直接引用 |

> 表格文件直接平铺在 `data-sources/` 根目录（不套文件夹）；`技能养成相关.xlsx` 同时供给辅助宝石和技能库两类数据。

**说明**：
- 词缀与属性共用 `属性表` 文件夹，系统自动查找含"词缀/Affix"关键字的工作表作为词缀数据，含 `attrID/name/desc` 列的作为属性数据
- 一键同步时 `copy-data.js` 从游戏引擎/策划本地目录（`import-config.json` 中的绝对路径）增量复制新表格到数据仓库

### 技能标签

- 主动技能从 `data-sources/Skill/*.json` 的 `mainTag`/`normalTag` 提取数字标签，被动技能从 `data-sources/Stunt/*.json` 提取
- 标签文本由 `技能标签` Excel 的 SkillMainTag / SkillNormalTag 子表映射（1=攻击、2=法术、3=召唤、4=光环；0=投射物、1=近战、2=物理…）
- 技能库卡片与战斗数据的主动/被动技能卡片均显示标签；战斗数据页顶部提供标签筛选栏（参考 tlidb 形态），可点击 `mainTag`（主标签）与 `normalTag`（常规标签）筛选对应类型技能

### 团队协作（多人使用）

- **任何人（只读）**：克隆网站仓库后，双击 `tools\更新数据.bat`（只读模式）即可拉取数据仓库最新数据并生成本地网页数据，不推送、不改远程
- **数据维护者**：双击 `tools\一键同步.bat` 全流程（复制本地表格 → 推送数据仓库 → 生成网页数据 → 推送网站仓库）
- **直接看最新数据**：无需任何操作，访问线上地址 `https://lyh2387316552-ui.github.io/chronicle/`
- **推送权限**：要让队友也能发布更新，在 GitHub 仓库 Settings → Collaborators 中把他们添加为协作者

### 编码处理

导入脚本自动检测文件编码（UTF-8 / GBK），对中文文本进行编码回退处理，避免乱码。

### desc999 乱码回退

属性数据导入时，脚本会检测 `desc999` 列是否包含控制字符（乱码标志）。如果检测到乱码，自动回退到 `desc` 列。

---

## 技能 ID 规则

ID 格式：`A+B+C+D+E+000F+G`（10 位数字）

| 段 | 含义 | 示例 |
|----|------|------|
| A | 技能类型 | 1=主动, 2=被动 |
| B | 技能大类 | 1=战斗, 2=法术, 3=增益 |
| C | 技能子类 | 攻击/释放/增益等 |
| D | 效果类型 | 伤害/控制/治疗等 |
| E | 元素/属性 | 物理/火焰/冰冷等 |
| 000F | 4 位序号 | 0001, 0002... |
| G | 等级标识 | 0=基础, 1-3=变体 |

---

## 页面功能

| 页面 | 功能 |
|------|------|
| 首页 | 数据概览、核心模块入口、数据数量 |
| 战斗数据 | 主动技能 / 被动技能 / 词缀库 / 属性库（Tab 切换） |
| 暗金装备 | 装备列表与详情（效果词条、词缀映射） |
| 辅助宝石 | 宝石效果展示 |
| 技能库 | 自定义技能管理 |
| 统计 | 数据分布统计与可视化 |
| ID规则 | 技能 ID 编码体系说明 |

---

## 技术栈

- **前端**：原生 HTML + CSS + JavaScript（无框架依赖）
- **数据解析**：SheetJS (xlsx.min.js) - Excel/CSV 解析
- **数据存储**：localStorage（浏览器本地持久化）
- **导入脚本**：Node.js（文件系统操作）
- **设计风格**：参考 [tlidb.com](https://tlidb.com/cn) 深色主题

---

## 本地运行服务器

如需通过 HTTP 访问（避免 file:// 协议限制）：

```bash
# 项目内置零依赖服务器 (推荐)
node tools/dev-server.js 8080

# 或 Python
python3 -m http.server 8080

# 然后访问
# http://localhost:8080/index.html
```

---

## 开发说明

### 数据加载流程

```
index.html 加载
  ├── data.js  →  内置默认数据 + localStorage 垫片
  ├── auto-import-data.js  →  window.__AUTO_IMPORT_DATA__（如果有）
  │       └── data.js IIFE  →  自动覆盖默认数据并写入 localStorage
  └── app.js  →  init()  →  读取数据 → 渲染页面
```

### 缓存策略

- HTML 中所有 JS/CSS 引用带 `?v=4` 版本号，防止浏览器缓存
- localStorage 数据带版本标记（`chronicle_cleared_version`），版本变更时自动清理旧缓存

### 修改数据源路径

编辑 `import-config.json`，路径支持：
- Windows 路径：`D:\\文件夹\\文件.xlsx`
- 文件夹路径（递归搜索）：`D:\\项目\\Skill`
- 文件路径：`E:\\表格\\装备表.xlsx`
- 脚本会自动补全文件扩展名（`.xlsx` / `.csv` / `.xls`）

---

## 许可证

本项目为内部工具，暂不开源。
