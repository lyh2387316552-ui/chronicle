# 更新日志

所有重要变更均记录在此文件中。格式参考 [Keep a Changelog](https://keepachangelog.com/)。

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
