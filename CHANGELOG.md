# 更新日志

所有重要变更均记录在此文件中。格式参考 [Keep a Changelog](https://keepachangelog.com/)。

---

## [2.5.0] - 2026-08-17

### 移除
- 自定义数据表功能：`data/tables.json`（数据仓库）、网页「数据表」页/标签、`tools/export-table.js` 转换脚本及相关样式，全部移除

---

## [2.4.0] - 2026-08-17

### 新增
- **GitHub Actions 自动数据同步**（`.github/workflows/sync-data.yml`）：每 10 分钟自动拉取数据仓库 → 生成网页数据 → 有变化才提交推送 → 线上自动更新；维护者只需 push 数据仓库，无需任何手动操作
- **只读同步脚本** `tools/更新数据.bat`：团队/任意用户拉取最新数据并生成本地网页数据，不推送、不改远程
- `tools/export-table.js` 输出改为数据仓库 `chronicle-data/data/tables.json`

### 变更
- **数据与资源迁入独立数据仓库 [chronicle-data](https://github.com/lyh2387316552-ui/chronicle-data)**：数据源表格、游戏图标、技能视频全部迁移，网页运行时从数据仓库 Pages 拉取；import-config 数据源路径指向数据仓库
- 数据源表格**扁平化**：去掉分类文件夹，表格直接平铺在数据仓库 `data-sources/` 根目录（`属性表.xlsx`、`装备表.xlsx`、`技能养成相关.xlsx`、`战斗技能相关表.xlsx`、`魔宠表.xlsx`）
- `一键同步.bat` 推送失败（无写权限）时降级为提示，不再卡死退出
- 移除网页「数据同步」页/导出导入功能（数据由维护者通过 git 管理，普通访问者纯浏览，无同步 UI）

### 修复
- 图标校验改为按数据仓库实际存放路径检查（宝石图标 `baoshi/` 不再误报缺失）

---

## [2.3.0] - 2026-08-17

### 新增
- **编辑数据仓库同步**（`data/user-data.json`）：自建技能/词缀、名称/描述编辑记录可导出为文件并推送到仓库，所有设备刷新即共享；加载时自动合并（仓库基线 + 本机 localStorage 增量）
- **自定义数据表**（`data/tables.json`）：任意表数据（如技能养成表）上传即展示，「其他 → 数据表」页自动渲染为表格
- `tools/export-table.js`：Excel/CSV 一键转换为 data/tables.json（自动检测 UTF-8/GBK 编码，检测多行表头）
- 「其他」页新增「数据表」「数据同步」两个标签页：数据同步页含状态统计、导出/导入按钮与操作步骤说明

### 变更
- 页面加载时异步拉取 `data/user-data.json` + `data/tables.json`（在线模式；file:// 下自动跳过，仅 localStorage 生效）

---

## [2.2.0] - 2026-08-13

### 性能优化
- **懒渲染**：启动时仅渲染首页统计，装备/宝石/战斗数据/其他等页面首次进入才渲染，明显加快打开速度
- **移除浏览器端 xlsx.min.js 加载**（约 880KB）：该库仅 `tools/import.js`（Node 端）需要，文件保留不动
- **findRefData 索引化**：refId 查找由多次线性扫描改为 Map 索引（`rebuildRefIndex()`），增删改 ID 后自动重建
- **isIdExists 集合化**：ID 去重检查改用 Set，不再每次线性扫描
- **搜索防抖**：全局搜索与各页面搜索输入 150ms 防抖，停止输入才触发渲染
- **技能库标签计数单遍统计**：标签栏数量统计由「每标签一次全量过滤」改为单遍遍历
- 编辑技能时不再每次按键拼接 `[...activeSkills, ...passiveSkills]` 数组

### 功能增强
- **全局搜索跨库检索**：可搜主动/被动技能、词缀、属性、装备、辅助宝石、技能库、魔宠，自动跳转对应页面并填入搜索词；无匹配时侧边栏提示「未找到匹配内容」
- **装备/宝石搜索支持按关联效果名称匹配**（如搜「月光斩」可找到带该效果的装备）
- 新增本地开发服务器 `tools/dev-server.js`（零依赖，`node tools/dev-server.js`）

### 清理
- 移除已废弃的浏览器内「同步战斗数据」功能及其余僵尸函数（`showSyncBattleDataModal`、`parseExcelForAffixes`、`parseCSVFile`、`parseSkillFiles`、`buildSkillObject`、`syncEquipmentCard`、`updateNavCounts`、`onGemEffectInput` 等），共约 790 行

### 修复
- 5 位 ID（如天赋特技 99998/99999）卡片段位拆解显示 `undefined` 的问题（非标准 ID 不再展示段位行）
- `autoDetectSkillCategory` 子分类错误地返回分类描述（新建技能子分类现与内置数据约定一致，且与页面分类筛选对齐）
- `DEFAULT_VIDEO_FILES` 兜底清单与 `videos/` 文件夹不同步（补全为 15 个视频）

---

## [2.1.0] - 2026-08-07

### 新增
- 创建 Git 仓库，编写 `README.md` 项目文档与 `.gitignore`
- 建立更新日志 `CHANGELOG.md`
- 梳理项目结构与文件职责说明

### 变更
- `style.css` 重构为 tlidb.com 深色主题风格
  - 顶部导航栏替代侧边栏布局
  - 不对称圆角卡片设计（`0px 20px`）
  - 半透明黑色背景 + 毛玻璃模糊效果
  - 固定全屏背景图（压暗 20% 亮度）
- `index.html` 导航结构从侧边栏改为顶部横向导航

---

## [2.0.0] - 2026-08-06

### 新增
- **自动导入数据系统**：`import.js` 脚本 + `auto-import-data.js` 自动加载
- `import-config.json` 配置文件，支持保存数据源路径重复导入
- `导入数据.bat` Windows 一键导入批处理脚本
- 编码自动检测（UTF-8 / GBK），解决中文乱码问题
- `desc999` 列乱码检测与自动回退到 `desc` 列
- 控制字符清理（`\x00-\x1f`），防止属性数据损坏
- `smartResolvePath` 智能路径解析，自动补全文件扩展名
- 递归文件搜索（`findFilesRecursive`），支持文件夹数据源
- localStorage 垫片，兼容 `file://` 协议

### 变更
- `data.js` 新增 `loadAutoImportData()` IIFE，页面加载时自动读取导入数据
- `app.js` `init()` 增加自动导入数据检测，跳过缓存清除
- `app.js` `loadEquipmentData()` 检测自动导入数据，跳过版本检查
- `app.js` 新增 `updateCustomSkillNavCount()` 调用，修复技能库计数为 0
- `index.html` 所有 JS/CSS 引用添加 `?v=4` 版本号，防止浏览器缓存
- `index.html` 添加 Cache-Control / Pragma / Expires meta 标签

### 修复
- 装备数据导入后被 localStorage 旧数据覆盖的问题
- 技能库导航计数不更新的问题
- 多次来源同步时重复数据多次展示的问题
- 属性数据全部显示乱码的问题
- 辅助技能宝石数据缺失的问题
- 装备详情中被动技能效果部分残留引用
- 装备同步效果为空（modifier 映射未找到）的问题

---

## [1.1.0] - 2026-08-05

### 新增
- 装备详情弹窗（`openEquipmentDetail`）
- 词缀库分类筛选（通用词缀 / 特殊词缀）
- 属性库分类筛选（基础属性 / 特殊属性）
- 战斗数据 Tab 切换（主动 / 被动 / 词缀 / 属性）
- 全局搜索功能
- 新增内容标记与列表

### 变更
- 装备效果展示支持 modifier 映射
- 词缀 `name` 与 `desc999` 之间用 `-` 分隔显示

### 修复
- 辅助技能"猛毒2"点击后面板弹窗显示不正确
- 装备详情中"被动技能效果"部分移除

---

## [1.0.0] - 2026-07-03

### 新增
- 项目初始创建
- 内置主动技能数据 20 个（`data.js`）
- 内置被动技能数据
- 内置词缀库数据
- 内置属性库数据
- 基础页面布局与导航
- 技能 ID 规则解析与展示（`parseSkillId`）
- 技能分类颜色与图标系统
- 数据统计页面
