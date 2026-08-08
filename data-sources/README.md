# 📁 data-sources 数据源目录

> 把对应数据文件放入下方指定文件夹/文件名即可，然后运行 `一键同步.bat`（或 `node import.js`）同步。

## 数据源放置说明

| 文件夹/文件 | 内容 | 支持格式 |
|---|---|---|
| `Skill/` | 主动技能（战斗数据） | `Basic_Information-*.json` |
| `SkillModule/` | 主动技能模块（伤害/冷却等） | `module-*.json` |
| `Stunt/` | 被动技能（战斗数据） | `baseStuntInfo-*.json` |
| `StuntModule/` | 被动技能模块 | `module-*.json` |
| `属性表/` | 词缀 + 属性数据 | Excel(`.xlsx`/`.xls`)/CSV |
| `装备表/` | 装备数据（LegendEquip + Modifier 子表） | Excel(`.xlsx`/`.xls`)/CSV |
| `宝石表/` | 辅助宝石数据（SkillGem 子表） | Excel(`.xlsx`/`.xls`)/CSV |
| `技能表/` | 技能库数据（SkillActive 子表） | Excel(`.xlsx`/`.xls`)/CSV |
| `技能标签/` | 技能标签字典（SkillMainTag + SkillNormalTag 子表） | Excel(`.xlsx`/`.xls`)/CSV |

## 使用步骤

1. 将对应文件放入上述文件夹（支持子目录递归扫描）
2. 运行同步：`一键同步.bat`
3. 打开 `index.html` 查看数据

## Excel 子表自动查找规则

系统自动按子表名匹配（不区分大小写，取第一个命中的工作表）：

| 库 | 子表名（任一命中即可） | 字段规则 |
|---|---|---|
| 装备库 | `LegendEquip` / `装备` | name + desc999 → 装备名称；modifier1 + modifier2 → 词条ID |
| 装备库词条 | `Modifier` / `词条` | id → 词条ID；stunt / affix / attr → 战斗数据中的被动/词缀/属性效果 |
| 宝石库 | `SkillGem` / `宝石` | name → 名称；desc → 描述；skillAffix / stunt / attr → 映射词缀/被动/属性 |
| 技能库 | `SkillActive` / `技能` | skill / stunt → 映射战斗数据中的技能ID，读取效果描述与标签（mainTag / normalTag） |
| 技能标签 | `SkillMainTag` / `主标签` + `SkillNormalTag` / `常规标签` | 标签ID → 标签文本（如 1=攻击、2=法术；1=近战、3=火焰） |

## 技能标签说明

- 技能库中每个技能的 `mainTag` / `normalTag` 从战斗数据（`Skill/`、`Stunt/` 文件夹 JSON 中的 `mainTag`、`normalTag` 字段）提取
- 数字标签通过"技能标签"文件夹 Excel 的 `SkillMainTag` / `SkillNormalTag` 子表映射为文本（如 `mainTag=1` → 攻击，`normalTag=[3,4]` → 火焰、冰霜）

## 词缀 / 属性表说明

- 词缀与属性均来自"属性表"文件夹
- 系统会自动查找子表名包含"Modifier / Affix / 词缀"的工作表文件作为词缀数据（如 `ModifierDes`）
- 系统会自动查找含 `attrID / name / desc` 列的工作表文件作为属性数据（如 `AttributeName`）
- 如果只有一个文件，直接放入即可

## 路径约定

- 以上路径均为相对路径，指向本项目 `data-sources` 目录
- 如需改为其他位置，可编辑 `import-config.json`（支持绝对路径）
