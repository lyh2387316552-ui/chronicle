// ============================================================
// 古荒大陆 - 应用逻辑
// ============================================================

// ---- 导航 ----
const navLinks = document.querySelectorAll('.nav-link');
const pages = document.querySelectorAll('.page');

navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const pageName = link.dataset.page;
        navigateTo(pageName);
    });
});

// ---- 已渲染页面记录 (懒渲染: 首次进入才渲染内容，加速启动) ----
const renderedPages = new Set();

function ensurePageRendered(pageName) {
    if (renderedPages.has(pageName)) return;
    renderedPages.add(pageName);
    if (pageName === 'battle-data') {
        switchBattleTab('active');
    } else if (pageName === 'equipment') {
        renderEquipment();
    } else if (pageName === 'gems') {
        renderGems();
    }
}

function navigateTo(pageName) {
    pages.forEach(p => p.classList.remove('active'));
    navLinks.forEach(l => l.classList.remove('active'));

    const targetPage = document.getElementById(`page-${pageName}`);
    const targetLink = document.querySelector(`[data-page="${pageName}"]`);

    if (targetPage) targetPage.classList.add('active');
    if (targetLink) targetLink.classList.add('active');

    // 记录当前页面: 首页使用首页底图, 非首页使用通用底图
    document.body.dataset.page = pageName;

    // 懒渲染: 首次进入才渲染页面内容
    ensurePageRendered(pageName);

    // 每次进入刷新数据 (编辑/导入后保持最新)
    if (pageName === 'custom-skills') {
        filterCustomSkills();
    } else if (pageName === 'occupations') {
        renderOccupations();
    } else if (pageName === 'pets') {
        initPetPage();
    } else if (pageName === 'others') {
        renderCategoryTables();
        renderStats();
    }

    // 滚动到顶部
    document.querySelector('.main-content').scrollTop = 0;
}

// ---- 其他页面内小导航切换 ----
function switchOthersTab(name) {
    document.querySelectorAll('.others-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.others-panel').forEach(p => p.classList.remove('active'));
    const tab = document.getElementById('others-tab-' + name);
    const panel = document.getElementById('others-panel-' + name);
    if (tab) tab.classList.add('active');
    if (panel) panel.classList.add('active');
    if (name === 'stats') renderStats();
}

// ---- 战斗数据 Tab 切换 ----
function switchBattleTab(tab) {
    document.querySelectorAll('.battle-tab').forEach(t => t.classList.remove('active'));
    const tabBtn = document.getElementById('tab-' + tab);
    if (tabBtn) tabBtn.classList.add('active');
    ['active', 'passive', 'affix', 'attr'].forEach(t => {
        const el = document.getElementById('battle-tab-' + t);
        if (el) el.style.display = t === tab ? '' : 'none';
    });
    // 切换时渲染对应Tab的数据
    if (tab === 'affix') {
        filterAffixes();
    } else if (tab === 'attr') {
        filterAttributes();
    } else if (tab === 'active' || tab === 'passive') {
        renderTagFilterBar(tab);
        filterSkills(tab);
    }
}

// ---- 标签筛选状态 (主动/被动/技能库，数组 = 多选) ----
const tagFilterState = { active: [], passive: [], custom: [] };

// ---- 渲染标签筛选栏 (mainTag/normalTag 聚合) ----
function renderTagFilterBar(type) {
    const bar = document.getElementById(type + 'TagFilters');
    if (!bar) return;
    const skills = type === 'active' ? activeSkills : passiveSkills;

    // 聚合所有 main + normal 标签 (去重，过滤未映射的数字标签)
    const tagSet = new Set();
    skills.forEach(s => {
        if (!s.tagsText) return;
        if (s.tagsText.main && s.tagsText.main !== '' && !isUnmappedTag(s.tagsText.main)) tagSet.add(s.tagsText.main);
        (s.tagsText.normal || []).forEach(t => { if (t && t !== '' && t !== null && t !== undefined && !isUnmappedTag(t)) tagSet.add(t); });
    });
    const tags = [...tagSet].sort((a, b) => a.localeCompare(b, 'zh'));

    const current = tagFilterState[type] || [];
    const typeColor = type === 'active' ? '#e74c3c' : '#3498db';

    const btn = (tag, label) => {
        const active = tag === '' ? current.length === 0 : current.includes(tag);
        const esc = String(tag).replace(/'/g, "\\'");
        return `<button class="tag-filter-btn${active ? ' active' : ''}" style="${active ? 'background:' + typeColor + ';border-color:' + typeColor + ';color:#fff' : ''}" onclick="setTagFilter('${type}', '${esc}')">${label}</button>`;
    };

    bar.innerHTML = `
        <div class="tag-filter-bar-inner">
            <span class="tag-filter-label">标签(可多选):</span>
            ${btn('', '全部')}
            ${tags.map(t => btn(t, t)).join('')}
        </div>
    `;
}

// ---- 设置标签筛选 (多选：点击切换选中/取消) ----
function setTagFilter(type, tag) {
    const state = tagFilterState[type];
    if (!tag) {
        // 点击"全部"清空所有选择
        state.length = 0;
    } else {
        const idx = state.indexOf(tag);
        if (idx >= 0) state.splice(idx, 1);
        else state.push(tag);
    }
    renderTagFilterBar(type);
    filterSkills(type);
}

// ---- 渲染技能库标签筛选栏 (mainTag/normalTag 聚合，s.tags 为文本格式) ----
function renderCustomSkillTagFilterBar() {
    const bar = document.getElementById('customSkillTagFilters');
    if (!bar) return;

    // 分别收集 mainTag 和 normalTag (去重，过滤未映射的数字标签)
    const mainTagSet = new Set();
    const normalTagSet = new Set();
    customSkillData.forEach(s => {
        if (!s.tags) return;
        if (s.tags.main && s.tags.main !== '' && !isUnmappedTag(s.tags.main)) mainTagSet.add(s.tags.main);
        (s.tags.normal || []).forEach(t => { if (t && t !== '' && t !== null && t !== undefined && !isUnmappedTag(t)) normalTagSet.add(t); });
    });

    // mainTag 排序在前，normalTag 排序在后 (normalTag 排除已在 mainTag 中的)
    const mainTags = [...mainTagSet].sort((a, b) => a.localeCompare(b, 'zh'));
    const normalTags = [...normalTagSet].filter(t => !mainTagSet.has(t)).sort((a, b) => a.localeCompare(b, 'zh'));
    const tags = [...mainTags, ...normalTags];

    const current = tagFilterState.custom || [];

    // 获取当前搜索/类型筛选条件 (计数时排除标签筛选本身)
    const searchEl = document.getElementById('customSkillSearchInput');
    const search = searchEl ? searchEl.value.toLowerCase() : '';
    const typeFilter = document.getElementById('customSkillTypeFilter') ? document.getElementById('customSkillTypeFilter').value : '';

    // 计算每个标签独立匹配的技能数量 (考虑搜索/类型筛选，不考虑标签筛选; 单遍统计)
    const tagCounts = {};
    customSkillData.forEach(s => {
        if (typeFilter && (s.type || '未分类') !== typeFilter) return;
        if (!customSkillMatches(s, search)) return;
        if (!s.tags) return;
        if (s.tags.main && s.tags.main !== '' && !isUnmappedTag(s.tags.main)) {
            tagCounts[s.tags.main] = (tagCounts[s.tags.main] || 0) + 1;
        }
        (s.tags.normal || []).forEach(t => {
            if (t && t !== '' && !isUnmappedTag(t)) tagCounts[t] = (tagCounts[t] || 0) + 1;
        });
    });

    const btn = (tag, label) => {
        const active = tag === '' ? current.length === 0 : current.includes(tag);
        const esc = String(tag).replace(/'/g, "\\'");
        const countBadge = (active && tag !== '') ? `<span class="tag-filter-count">${tagCounts[tag] || 0}</span>` : '';
        return `<button class="tag-filter-btn${active ? ' active' : ''}" style="${active ? 'background:#e67e22;border-color:#e67e22;color:#fff' : ''}" onclick="setCustomSkillTagFilter('${esc}')">${label}${countBadge}</button>`;
    };

    // 分隔符 (mainTag 和 normalTag 之间)
    const separator = mainTags.length > 0 && normalTags.length > 0 ? '<span class="tag-filter-sep">|</span>' : '';

    // 多选激活时: 显示当前选中标签组合 (AND) 匹配的技能数量
    const matchCount = current.length > 0 ? countCustomSkillTagMatch(current, search, typeFilter) : 0;

    bar.innerHTML = `
        <div class="tag-filter-bar-inner">
            <span class="tag-filter-label">标签(可多选):</span>
            ${btn('', '全部')}
            ${mainTags.map(t => btn(t, t)).join('')}
            ${separator}
            ${normalTags.map(t => btn(t, t)).join('')}
            ${current.length > 0 ? `<span class="tag-filter-match">✓ 已选 ${current.length} 个标签 · 匹配 ${matchCount} 个技能</span>` : ''}
        </div>
    `;
}

// 计算指定标签组合 (AND 语义) 命中的技能数量 (考虑搜索/类型筛选)
function countCustomSkillTagMatch(tags, search, typeFilter) {
    if (!tags || tags.length === 0) return customSkillData.length;
    return customSkillData.filter(s => {
        if (typeFilter && (s.type || '未分类') !== typeFilter) return false;
        if (!customSkillMatches(s, search)) return false;
        const t = s.tags;
        if (!t) return false;
        return tags.every(tag => t.main === tag || (t.normal || []).includes(tag));
    }).length;
}

// ---- 设置技能库标签筛选 (多选：点击切换选中/取消) ----
function setCustomSkillTagFilter(tag) {
    const state = tagFilterState.custom;
    if (!tag) {
        // 点击"全部"清空所有选择
        state.length = 0;
    } else {
        const idx = state.indexOf(tag);
        if (idx >= 0) state.splice(idx, 1);
        else state.push(tag);
    }
    renderCustomSkillTagFilterBar();
    filterCustomSkills();
}

// ---- 渲染技能卡片 ----
function renderSkillCard(skill, type) {
    const color = getCategoryColor(skill.category);
    const icon = getCategoryIcon(skill.category);
    const parsed = parseSkillId(skill.id);
    const iconHtml = skill.icon
        ? `<span class="skill-icon" style="background:${color}20;color:${color}"><img class="card-icon" src="${DATA_BASE}icon/${skill.icon}.webp" alt="" onerror="this.style.display='none'">${icon}</span>`
        : `<span class="skill-icon" style="background:${color}20;color:${color}">${icon}</span>`;

    // 非标准ID (如 5位的天赋特技 99998/99999) 不展示段位拆解
    const segHtml = isStandardSkillId(skill.id)
        ? `<div class="skill-card-id-segments">
                <span class="id-seg seg-a">A=${parsed.A}</span>
                <span class="id-seg">B=${parsed.B}</span>
                <span class="id-seg">C=${parsed.C}</span>
                <span class="id-seg">D=${parsed.D}</span>
                <span class="id-seg">E=${parsed.E}</span>
                <span class="id-seg">F=${parsed.seq}</span>
                <span class="id-seg">G=${parsed.G}</span>
            </div>`
        : '';

    return `
        <div class="skill-card" data-skill-id="${skill.id}" onclick="openSkillDetail('${skill.id}', '${type}')" style="border-left-color: ${color}">
            <div class="skill-card-header">
                ${iconHtml}
                <div class="skill-card-info">
                    <h4 class="skill-name">${skill.name}</h4>
                    <span class="skill-id">${skill.id}</span>
                </div>
            </div>
            <div class="item-stats">
                <div class="item-stats-cell"><span class="item-stats-label">类别</span><span class="item-stats-value" style="color:${color}">${skill.category}</span></div>
                <div class="item-stats-cell"><span class="item-stats-label">子类别</span><span class="item-stats-value">${skill.subCategory}</span></div>
                <div class="item-stats-cell"><span class="item-stats-label">类型</span><span class="item-stats-value">${type === 'active' ? '主动技能' : '被动技能'}</span></div>
            </div>
            ${renderSkillTags(skill.tagsText)}
            ${segHtml}
        </div>
    `;
}

// ============================================================
// 统一搜索匹配引擎
// 全站 8 个系统 (技能/词缀/属性/装备/宝石/技能库/魔宠) 共用同一套匹配规则:
//   1. 统一归一化: 转字符串 + 小写 + 去首尾空白, 避免各系统写法不一
//   2. 多关键词: 空格分隔, 全部命中才算匹配 (AND), 支持 "物理 伤害" 这类组合检索
//   3. 字段自动展开: 标量 / 数组 / 嵌套对象 (tags、effects、stars) 一并纳入检索
//   4. 关联效果: refId 自动解析为效果名称与描述, 支持按效果内容反查条目
// ============================================================

function normText(v) {
    return (v === undefined || v === null) ? '' : String(v).toLowerCase();
}

// 把任意值展开成一维文本片段数组
function collectText(val, out) {
    out = out || [];
    if (val === undefined || val === null) return out;
    if (Array.isArray(val)) {
        val.forEach(v => collectText(v, out));
    } else if (typeof val === 'object') {
        Object.keys(val).forEach(k => collectText(val[k], out));
    } else {
        out.push(String(val));
    }
    return out;
}

// 解析搜索词: 归一化 + 按空格拆分为关键词数组
function parseKeywords(query) {
    const s = normText(query).replace(/\s+/g, ' ').trim();
    return s ? s.split(' ') : [];
}

// 核心匹配: 每个关键词都需在 fields 展开后的文本中出现
function matchFields(keywords, fields) {
    if (!keywords || keywords.length === 0) return true;
    const hay = collectText(fields).join('|').toLowerCase();
    return keywords.every(k => hay.includes(k));
}

// 关联效果文本: 把 refId、效果名称、效果描述并入可检索内容
function effectText(effects) {
    const out = [];
    (effects || []).forEach(e => {
        if (!e) return;
        const refId = (typeof e === 'object') ? e.refId : e;
        if (refId === undefined || refId === null || refId === '') return;
        out.push(String(refId));
        const ref = findRefData(refId);
        if (ref) {
            if (ref.name) out.push(ref.name);
            if (ref.desc) out.push(ref.desc);
        }
    });
    return out;
}

// 搜索命中高亮用的转义 (仅用于搜索面板文本输出)
function escapeSearchHtml(s) {
    return String(s === undefined || s === null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ---- 筛选技能 ----
function filterSkills(type) {
    const skills = type === 'active' ? activeSkills : passiveSkills;
    const catEl = document.getElementById(`${type}CategoryFilter`);
    const searchEl = document.getElementById(`${type}SearchInput`);
    if (!catEl || !searchEl) return;

    const categoryFilter = catEl.value;
    const keywords = parseKeywords(searchEl.value);
    const tagFilter = tagFilterState[type] || [];

    const filtered = skills.filter(s => {
        if (categoryFilter && s.category !== categoryFilter) return false;
        if (tagFilter.length > 0) {
            const tt = s.tagsText;
            if (!tt) return false;
            // 必须同时包含所有选中标签 (AND)：每个选中标签命中 main 或 normal 之一
            const matched = tagFilter.every(tag => tt.main === tag || (tt.normal || []).includes(tag));
            if (!matched) return false;
        }
        // 统一搜索: 名称 / ID / 分类 / 子类别 / 描述 / 标签
        return matchFields(keywords, [s.name, s.id, s.category, s.subCategory, s.description, s.tagsText]);
    });

    if (type === 'active') {
        const grid = document.getElementById('activeSkillGrid');
        if (!grid) return;
        renderSkillsBySegment(filtered, 'active', grid);
        const _c = document.getElementById('activeSkillCount'); if (_c) _c.textContent = filtered.length;
    } else {
        const grid = document.getElementById('passiveSkillGrid');
        if (!grid) return;
        renderSkillsBySegment(filtered, 'passive', grid);
        const _c2 = document.getElementById('passiveSkillCount'); if (_c2) _c2.textContent = filtered.length;
    }
}

// ---- 按B/C段位分组渲染技能 ----
function renderSkillsBySegment(skills, type, gridEl) {
    if (skills.length === 0) {
        gridEl.innerHTML = '<div class="empty-state">未找到匹配的技能</div>';
        return;
    }

    const bMap = type === 'active' ? activeBMap : passiveBMap;
    const cMap = type === 'active' ? activeCMap : passiveCMap;
    const typeColor = type === 'active' ? '#e74c3c' : '#3498db';

    // 按 B段位 分组
    const bGroups = {};
    skills.forEach(s => {
        const parsed = parseSkillId(s.id);
        const bKey = parsed.B;
        if (!bGroups[bKey]) bGroups[bKey] = [];
        bGroups[bKey].push(s);
    });

    // 排序B段位
    const sortedBKeys = Object.keys(bGroups).sort();

    let html = '';
    sortedBKeys.forEach(bKey => {
        const bInfo = bMap[bKey] || { name: '未知B段', desc: '' };
        const bSkills = bGroups[bKey];

        html += `
            <div class="segment-group">
                <div class="segment-group-header" style="border-left-color:${typeColor}">
                    <span class="segment-badge" style="background:${typeColor}20;color:${typeColor}">B=${bKey}</span>
                    <span class="segment-group-name">${bInfo.name}</span>
                    <span class="segment-group-desc">${bInfo.desc}</span>
                    <span class="segment-group-count">${bSkills.length} 个</span>
                </div>
                <div class="segment-subgroups">
        `;

        // 在B段位下按C段位分组
        const cGroups = {};
        bSkills.forEach(s => {
            const parsed = parseSkillId(s.id);
            const cKey = parsed.C;
            if (!cGroups[cKey]) cGroups[cKey] = [];
            cGroups[cKey].push(s);
        });

        const sortedCKeys = Object.keys(cGroups).sort();

        sortedCKeys.forEach(cKey => {
            const cInfo = cMap[cKey] || { name: '未知C段', desc: '' };
            const cSkills = cGroups[cKey];
            const cColor = type === 'active' ? 
                (cKey === '1' ? '#e74c3c' : cKey === '2' ? '#9b59b6' : '#f39c12') :
                (cKey === '1' ? '#3498db' : cKey === '2' ? '#9b59b6' : cKey === '4' ? '#27ae60' : '#f39c12');

            html += `
                <div class="segment-subgroup collapsed" id="subgroup-${type}-${bKey}-${cKey}">
                    <div class="segment-subgroup-header" style="border-left-color:${cColor}" onclick="toggleSubgroup('${type}-${bKey}-${cKey}')">
                        <span class="segment-toggle-icon">▼</span>
                        <span class="segment-badge-sm" style="background:${cColor}20;color:${cColor}">C=${cKey}</span>
                        <span class="segment-subgroup-name">${cInfo.name}</span>
                        <span class="segment-subgroup-desc">${cInfo.desc}</span>
                        <span class="segment-subgroup-count">${cSkills.length} 个</span>
                    </div>
                    <div class="segment-subgroup-content">
                        <div class="skill-grid segment-skill-grid">
                            ${cSkills.map(s => renderSkillCard(s, type)).join('')}
                        </div>
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;
    });

    gridEl.innerHTML = html;
}

// ---- 切换C段位子分组折叠/展开 ----
function toggleSubgroup(groupId) {
    const el = document.getElementById('subgroup-' + groupId);
    if (!el) return;
    const isCollapsed = el.classList.contains('collapsed');
    if (isCollapsed) {
        el.classList.remove('collapsed');
        el.classList.add('expanded');
        const icon = el.querySelector('.segment-toggle-icon');
        if (icon) icon.textContent = '▼';
    } else {
        el.classList.remove('expanded');
        el.classList.add('collapsed');
        const icon = el.querySelector('.segment-toggle-icon');
        if (icon) icon.textContent = '▶';
    }
}

// ---- 通用防抖 ----
function debounce(fn, ms) {
    let timer = null;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), ms);
    };
}

// 各页面搜索输入防抖包装 (index.html oninput 调用，150ms 内只触发一次)
const debouncedFilters = {
    active: debounce(() => filterSkills('active'), 150),
    passive: debounce(() => filterSkills('passive'), 150),
    affix: debounce(() => filterAffixes(), 150),
    attr: debounce(() => filterAttributes(), 150),
    equipment: debounce(() => filterEquipments(), 150),
    gem: debounce(() => filterGems(), 150),
    custom: debounce(() => filterCustomSkills(), 150),
    pet: debounce(() => filterPets(), 150)
};

function debouncedFilter(kind) {
    if (debouncedFilters[kind]) debouncedFilters[kind]();
}

// ============================================================
// 全局搜索 (跨库候选面板)
// 输入即实时统计 8 个系统的命中条数, 面板列出每个命中系统的前几条候选;
// 点击候选行跳转到对应页面并自动应用该搜索词, Enter 直接打开首个结果。
// 检索字段与各页面 filter 函数保持一致, 共用 matchFields 引擎。
// ============================================================

// 8 个系统的检索目标
function getGlobalSearchTargets() {
    return [
        {
            label: '主动技能', page: 'battle-data', tab: 'active', inputId: 'activeSearchInput',
            apply: () => filterSkills('active'),
            arr: activeSkills, nameOf: s => s.name, subOf: s => s.category,
            fields: s => [s.name, s.id, s.category, s.subCategory, s.description, s.tagsText]
        },
        {
            label: '被动技能', page: 'battle-data', tab: 'passive', inputId: 'passiveSearchInput',
            apply: () => filterSkills('passive'),
            arr: passiveSkills, nameOf: s => s.name, subOf: s => s.category,
            fields: s => [s.name, s.id, s.category, s.subCategory, s.description, s.tagsText]
        },
        {
            label: '词缀库', page: 'battle-data', tab: 'affix', inputId: 'affixSearchInput',
            apply: () => filterAffixes(),
            arr: affixes, nameOf: a => a.name, subOf: a => a.subCategory,
            fields: a => [a.name, a.id, a.category, a.subCategory, a.description, a.desc]
        },
        {
            label: '属性库', page: 'battle-data', tab: 'attr', inputId: 'attrSearchInput',
            apply: () => filterAttributes(),
            arr: attributes, nameOf: a => a.name, subOf: a => a.category,
            fields: a => [a.name, a.id, a.category, a.description, a.desc]
        },
        {
            label: '装备', page: 'equipment', inputId: 'equipmentSearchInput',
            apply: () => filterEquipments(),
            arr: equipmentData, nameOf: e => e.name, subOf: e => e.type,
            fields: e => [e.name, e.id, e.type, e.source, effectText(e.effects)]
        },
        {
            label: '辅助宝石', page: 'gems', inputId: 'gemSearchInput',
            apply: () => filterGems(),
            arr: gemData, nameOf: g => g.name, subOf: g => g.type,
            fields: g => [g.name, g.id, g.type, g.desc, g.source, effectText(g.effects)]
        },
        {
            label: '技能库', page: 'custom-skills', inputId: 'customSkillSearchInput',
            apply: () => filterCustomSkills(),
            arr: customSkillData, nameOf: s => s.name, subOf: s => s.type,
            fields: s => [s.name, s.id, s.type, s.desc, s.tags, s.sourceId, effectText(s.effects)]
        },
        {
            label: '魔宠', page: 'pets', inputId: 'petSearchInput',
            apply: () => filterPets(),
            arr: petData, nameOf: p => p.name, subOf: p => getPetQuality(p.quality).name,
            fields: p => [p.name, p.id, p.quality, getPetQuality(p.quality).name, petStarEffectText(p)]
        }
    ];
}

const GS_SAMPLES = 3;   // 每个系统最多展示的候选条数
let _gsHits = [];       // 最近一次搜索结果 (供点击跳转使用)
let _gsQuery = '';      // 最近一次搜索词

// 渲染候选面板
function renderGlobalSearchPanel(query) {
    const panel = document.getElementById('globalSearchHint');
    if (!panel) return;
    _gsQuery = query || '';
    const keywords = parseKeywords(_gsQuery);

    if (keywords.length === 0) {
        _gsHits = [];
        panel.innerHTML = '';
        panel.style.display = 'none';
        return;
    }

    const hits = [];
    getGlobalSearchTargets().forEach(t => {
        try {
            const arr = t.arr || [];
            const matched = arr.filter(item => matchFields(keywords, t.fields(item)));
            if (matched.length > 0) {
                hits.push({ target: t, count: matched.length, samples: matched.slice(0, GS_SAMPLES) });
            }
        } catch (err) {
            console.warn('全局搜索: ' + t.label + ' 检索失败', err);
        }
    });
    _gsHits = hits;

    if (hits.length === 0) {
        panel.innerHTML = '<div class="gs-empty">未找到匹配内容</div>';
        panel.style.display = 'block';
        return;
    }

    const total = hits.reduce((n, h) => n + h.count, 0);
    const rows = hits.map((h, i) => {
        const samples = h.samples.map(item => {
            const name = escapeSearchHtml(h.target.nameOf ? h.target.nameOf(item) : '');
            const sub = h.target.subOf ? escapeSearchHtml(h.target.subOf(item) || '') : '';
            return `<span class="gs-sample">${name}${sub ? `<em>${sub}</em>` : ''}</span>`;
        }).join('');
        const more = h.count > h.samples.length ? '<span class="gs-more">…</span>' : '';
        return `
            <div class="gs-row" onclick="globalSearchJump(${i})">
                <div class="gs-row-top">
                    <span class="gs-sys">${escapeSearchHtml(h.target.label)}</span>
                    <span class="gs-count">${h.count} 条</span>
                </div>
                <div class="gs-samples">${samples}${more}</div>
            </div>`;
    }).join('');

    panel.innerHTML = `<div class="gs-head">共 ${total} 条结果 · ${hits.length} 个系统</div>${rows}`;
    panel.style.display = 'block';
}

// 点击候选: 跳转页面 -> 切 Tab -> 回填搜索词 -> 应用筛选
function globalSearchJump(index) {
    const hit = _gsHits[index];
    if (!hit) return;
    const t = hit.target;
    hideGlobalSearchPanel();
    navigateTo(t.page);
    if (t.tab) switchBattleTab(t.tab);
    const input = document.getElementById(t.inputId);
    if (input) {
        input.value = _gsQuery;
        // 同步搜索框清空按钮的显隐
        const btn = input.parentNode ? input.parentNode.querySelector('.filter-clear') : null;
        if (btn) btn.classList.toggle('show', input.value.length > 0);
    }
    t.apply();
}

function hideGlobalSearchPanel() {
    const panel = document.getElementById('globalSearchHint');
    if (panel) panel.style.display = 'none';
}

// input 事件入口 (防抖 150ms)
function runGlobalSearch(e) {
    renderGlobalSearchPanel(((e.target && e.target.value) || '').trim());
}

(function bindGlobalSearch() {
    const input = document.getElementById('globalSearch');
    if (!input) return;
    input.addEventListener('input', debounce(runGlobalSearch, 150));
    input.addEventListener('keydown', ev => {
        if (ev.key === 'Enter') {
            ev.preventDefault();
            if (_gsHits.length > 0) globalSearchJump(0);
        } else if (ev.key === 'Escape') {
            input.value = '';
            hideGlobalSearchPanel();
        }
    });
    // 点击面板以外的区域时收起
    document.addEventListener('click', ev => {
        if (ev.target === input) return;
        const panel = document.getElementById('globalSearchHint');
        if (panel && panel.contains(ev.target)) return;
        hideGlobalSearchPanel();
    });
})();

// ---- 筛选栏搜索框: 统一清空按钮 ----
const FILTER_INPUT_KIND = {
    activeSearchInput: 'active',
    passiveSearchInput: 'passive',
    affixSearchInput: 'affix',
    attrSearchInput: 'attr',
    equipmentSearchInput: 'equipment',
    gemSearchInput: 'gem',
    customSkillSearchInput: 'custom',
    petSearchInput: 'pet'
};

function initFilterClearButtons() {
    Object.keys(FILTER_INPUT_KIND).forEach(id => {
        const input = document.getElementById(id);
        if (!input || input.dataset.clearReady === '1') return;
        input.dataset.clearReady = '1';

        // 包一层容器以承载清空按钮
        const wrap = document.createElement('span');
        wrap.className = 'filter-search';
        input.parentNode.insertBefore(wrap, input);
        wrap.appendChild(input);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'filter-clear';
        btn.title = '清空搜索';
        btn.textContent = '✕';
        const sync = () => btn.classList.toggle('show', input.value.length > 0);
        btn.addEventListener('click', () => {
            input.value = '';
            sync();
            debouncedFilter(FILTER_INPUT_KIND[id]);
            input.focus();
        });
        input.addEventListener('input', sync);
        wrap.appendChild(btn);
        sync();
    });
}

// ---- 技能详情弹窗 ----
function openSkillDetail(id, type) {
    const skills = type === 'active' ? activeSkills : passiveSkills;
    const skill = skills.find(s => s.id === id);
    if (!skill) return;

    const parsed = parseSkillId(id);
    const color = getCategoryColor(skill.category);
    const icon = getCategoryIcon(skill.category);
    const typeName = type === 'active' ? '主动技能' : '被动技能';
    const typeColor = type === 'active' ? '#e74c3c' : '#3498db';
    const hasEdits = checkHasEdits(SKILL_EDIT_KEY, id);

    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = `
        <div class="detail-header" style="border-bottom-color:${color}">
            <div class="detail-icon" style="background:${color}20;color:${color};font-size:36px;width:64px;height:64px;display:flex;align-items:center;justify-content:center;border-radius:12px;position:relative;overflow:hidden">${skill.icon ? `<img class="card-icon" src="${DATA_BASE}icon/${skill.icon}.webp" alt="" onerror="this.style.display='none'">` : ''}${icon}</div>
            <div style="flex:1">
                <h2 class="detail-name">
                    <input type="text" class="affix-edit-input affix-edit-name" value="${skill.name.replace(/"/g, '&quot;')}" oninput="onSkillEdit('${skill.id}', 'name', this.value)" placeholder="技能名称">
                </h2>
                <div class="detail-type">
                    <span class="type-badge" style="background:${typeColor}20;color:${typeColor}">${typeName}</span>
                    <span class="type-badge" style="background:${color}20;color:${color}">${skill.category}</span>
                    <span class="type-badge-sub">${skill.subCategory}</span>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <h3 class="detail-section-title">技能ID</h3>
            <div class="id-edit-row">
                <input type="text" class="affix-edit-input id-edit-input" id="skillIdEdit" value="${skill.id}" placeholder="10位数字" oninput="previewSkillIdChange('${skill.id}', '${type}')">
                <button class="equipment-btn equipment-btn-save id-save-btn" onclick="applySkillIdChange('${skill.id}', '${type}')">应用</button>
            </div>
            <div id="skillIdEditPreview"></div>
        </div>

        <div class="detail-section">
            <h3 class="detail-section-title">ID段位解析</h3>
            <div class="detail-id-breakdown">
                <div class="detail-seg" style="border-color:${typeColor}">
                    <span class="seg-label" style="color:${typeColor}">A</span>
                    <span class="seg-value">${parsed.A}</span>
                    <span class="seg-desc">${typeName}</span>
                </div>
                <div class="detail-seg">
                    <span class="seg-label">B</span>
                    <span class="seg-value">${parsed.B}</span>
                    <span class="seg-desc">技能大类</span>
                </div>
                <div class="detail-seg">
                    <span class="seg-label">C</span>
                    <span class="seg-value">${parsed.C}</span>
                    <span class="seg-desc">技能子类</span>
                </div>
                <div class="detail-seg">
                    <span class="seg-label">D</span>
                    <span class="seg-value">${parsed.D}</span>
                    <span class="seg-desc">效果类型</span>
                </div>
                <div class="detail-seg">
                    <span class="seg-label">E</span>
                    <span class="seg-value">${parsed.E}</span>
                    <span class="seg-desc">元素/属性</span>
                </div>
                <div class="detail-seg">
                    <span class="seg-label">000F</span>
                    <span class="seg-value">${parsed.seq}</span>
                    <span class="seg-desc">序号</span>
                </div>
                <div class="detail-seg">
                    <span class="seg-label">G</span>
                    <span class="seg-value">${parsed.G}</span>
                    <span class="seg-desc">等级标识</span>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <div class="detail-section-title-row">
                <h3 class="detail-section-title">技能描述</h3>
                <span class="save-indicator" id="saveIndicator">${hasEdits ? '✓ 已自定义' : '编辑后自动保存'}</span>
            </div>
            <textarea class="affix-edit-textarea" oninput="onSkillEdit('${skill.id}', 'description', this.value)" placeholder="输入技能描述...">${skill.description}</textarea>
            ${hasEdits ? `<button class="affix-reset-btn" onclick="resetSkillDetail('${skill.id}', '${type}')">↺ 恢复默认</button>` : ''}
        </div>

        <div class="detail-section">
            <button class="equipment-btn equipment-btn-delete" onclick="deleteSkill('${skill.id}', '${type}')">🗑 删除技能</button>
        </div>
    `;

    document.getElementById('skillModal').classList.add('active');
}

// ---- 恢复技能默认描述 ----
function resetSkillDetail(id, type) {
    const originalArr = type === 'active' ? originalActiveSkills : originalPassiveSkills;
    const original = originalArr.find(s => s.id === id);
    if (!original) return;
    resetEditData(SKILL_EDIT_KEY, id);
    const skills = type === 'active' ? activeSkills : passiveSkills;
    const skill = skills.find(s => s.id === id);
    if (skill) {
        skill.name = original.name;
        skill.description = original.description;
    }
    openSkillDetail(id, type);
    filterSkills(type);
}

function closeModal() {
    document.getElementById('skillModal').classList.remove('active');
}

// ---- 技能ID修改预览 ----
function previewSkillIdChange(oldId, type) {
    const newId = document.getElementById('skillIdEdit').value.trim();
    const previewEl = document.getElementById('skillIdEditPreview');
    if (!newId || newId === oldId) { previewEl.innerHTML = ''; return; }

    const validation = validateSkillId(newId);
    if (!validation.valid) {
        previewEl.innerHTML = `<div class="effect-preview-error">⚠ ${validation.error}</div>`;
        return;
    }

    if (isIdExists(newId)) {
        previewEl.innerHTML = `<div class="effect-preview-error">⚠ ID已存在，不能修改为重复的ID</div>`;
        return;
    }

    const parsed = parseSkillId(newId);
    const cat = autoDetectSkillCategory(newId);
    const aSeg = parsed.A;
    const typeColor = aSeg === '1' ? '#e74c3c' : '#3498db';
    const typeName = aSeg === '1' ? '主动技能' : '被动技能';
    const bMap = aSeg === '1' ? activeBMap : passiveBMap;
    const cMap = aSeg === '1' ? activeCMap : passiveCMap;
    const bInfo = bMap[parsed.B] || { name: '新段位', desc: '新B段位分类' };
    const cInfo = cMap[parsed.C] || { name: '新子类', desc: '新C段位子分类' };

    previewEl.innerHTML = `
        <div class="effect-preview-card" style="border-left-color:${typeColor}">
            <div class="effect-preview-header">
                <span class="effect-preview-type" style="background:${typeColor}20;color:${typeColor}">${typeName}</span>
                <span class="effect-preview-name">${oldId} → ${newId}</span>
            </div>
            <div class="id-segment-preview">
                <div class="id-seg-item"><span class="seg-label">A</span><span class="seg-value">${parsed.A}</span><span class="seg-desc">${typeName}</span></div>
                <div class="id-seg-item"><span class="seg-label">B</span><span class="seg-value">${parsed.B}</span><span class="seg-desc">${bInfo.name}</span></div>
                <div class="id-seg-item"><span class="seg-label">C</span><span class="seg-value">${parsed.C}</span><span class="seg-desc">${cInfo.name}</span></div>
            </div>
            <p class="effect-preview-desc">新分类: ${cat.category} · ${cat.subCategory}</p>
            <p class="effect-preview-desc" style="color:#e67e22">⚠ 装备库中引用旧ID的效果将自动更新为新ID</p>
        </div>
    `;
}

// ---- 应用技能ID修改 ----
function applySkillIdChange(oldId, type) {
    const newId = document.getElementById('skillIdEdit').value.trim();
    if (!newId || newId === oldId) { alert('ID未修改'); return; }

    const validation = validateSkillId(newId);
    if (!validation.valid) { alert(validation.error); return; }

    if (isIdExists(newId)) { alert('ID已存在，不能修改为重复的ID'); return; }

    const arr = type === 'active' ? activeSkills : passiveSkills;
    const skill = arr.find(s => s.id === oldId);
    if (!skill) return;

    // 更新技能ID
    skill.id = newId;
    const cat = autoDetectSkillCategory(newId);
    skill.category = cat.category;
    skill.subCategory = cat.subCategory;

    // ID变更后重建索引
    rebuildRefIndex();
    rebuildSkillAffixIdSet();

    // 同步更新装备库中的引用
    let equipmentChanged = false;
    equipmentData.forEach(eq => {
        if (!eq.effects) return;
        eq.effects.forEach(e => {
            if (e.refId === oldId) {
                e.refId = newId;
                equipmentChanged = true;
            }
        });
    });
    if (equipmentChanged) { /* 装备库仅只读展示，无需持久化 */ }

    // 同步编辑记录（迁移 key）
    try {
        const raw = localStorage.getItem(SKILL_EDIT_KEY);
        if (raw) {
            const edits = JSON.parse(raw);
            if (edits[oldId]) {
                edits[newId] = edits[oldId];
                delete edits[oldId];
                localStorage.setItem(SKILL_EDIT_KEY, JSON.stringify(edits));
            }
        }
        const nsRaw = localStorage.getItem('chronicle_new_status');
        if (nsRaw) {
            const ns = JSON.parse(nsRaw);
            if (ns[oldId] !== undefined) {
                ns[newId] = ns[oldId];
                delete ns[oldId];
                localStorage.setItem('chronicle_new_status', JSON.stringify(ns));
            }
        }
    } catch (e) {}

    // 重新渲染弹窗
    openSkillDetail(newId, type);
    filterSkills(type);
    if (equipmentChanged) filterEquipments();
    renderStats();
    renderHome();
}

// ---- 词缀ID修改预览 ----
function previewAffixIdChange(oldId) {
    const newId = document.getElementById('affixIdEdit').value.trim();
    const previewEl = document.getElementById('affixIdEditPreview');
    if (!newId || newId === oldId) { previewEl.innerHTML = ''; return; }

    const validation = validateAffixId(newId);
    if (!validation.valid) {
        previewEl.innerHTML = `<div class="effect-preview-error">⚠ ${validation.error}</div>`;
        return;
    }

    if (isIdExists(newId)) {
        previewEl.innerHTML = `<div class="effect-preview-error">⚠ ID已存在，不能修改为重复的ID</div>`;
        return;
    }

    const parsed = parseAffixId(newId);
    const cat = autoDetectAffixCategory(newId);
    const typeColors = { '1': '#3498db', '2': '#2ecc71', '3': '#9b59b6', '4': '#f39c12' };
    const typeColor = typeColors[parsed.prefix] || '#bbb';

    previewEl.innerHTML = `
        <div class="effect-preview-card" style="border-left-color:${typeColor}">
            <div class="effect-preview-header">
                <span class="effect-preview-type" style="background:${typeColor}20;color:${typeColor}">${parsed.prefixName}</span>
                <span class="effect-preview-name">${oldId} → ${newId}</span>
            </div>
            <div class="id-segment-preview">
                <div class="id-seg-item"><span class="seg-label">前缀</span><span class="seg-value">${parsed.prefix}</span><span class="seg-desc">${parsed.prefixName}</span></div>
                <div class="id-seg-item"><span class="seg-label">序号</span><span class="seg-value">${parsed.seq}</span><span class="seg-desc">词缀序号</span></div>
            </div>
            <p class="effect-preview-desc">新分类: ${cat.category} · ${cat.subCategory}</p>
            <p class="effect-preview-desc" style="color:#e67e22">⚠ 装备库中引用旧ID的效果将自动更新为新ID</p>
        </div>
    `;
}

// ---- 应用词缀ID修改 ----
function applyAffixIdChange(oldId) {
    const newId = document.getElementById('affixIdEdit').value.trim();
    if (!newId || newId === oldId) { alert('ID未修改'); return; }

    const validation = validateAffixId(newId);
    if (!validation.valid) { alert(validation.error); return; }

    if (isIdExists(newId)) { alert('ID已存在，不能修改为重复的ID'); return; }

    const affix = affixes.find(a => a.id === oldId);
    if (!affix) return;

    // 更新词缀ID
    affix.id = newId;
    const cat = autoDetectAffixCategory(newId);
    affix.category = cat.category;
    affix.subCategory = cat.subCategory;

    // ID变更后重建索引
    rebuildRefIndex();
    rebuildSkillAffixIdSet();

    // 同步更新装备库中的引用
    let equipmentChanged = false;
    equipmentData.forEach(eq => {
        if (!eq.effects) return;
        eq.effects.forEach(e => {
            if (e.refId === oldId) {
                e.refId = newId;
                equipmentChanged = true;
            }
        });
    });
    if (equipmentChanged) { /* 装备库仅只读展示，无需持久化 */ }

    // 同步编辑记录（迁移 key）
    try {
        const raw = localStorage.getItem(AFFIX_EDIT_KEY);
        if (raw) {
            const edits = JSON.parse(raw);
            if (edits[oldId]) {
                edits[newId] = edits[oldId];
                delete edits[oldId];
                localStorage.setItem(AFFIX_EDIT_KEY, JSON.stringify(edits));
            }
        }
        const nsRaw = localStorage.getItem('chronicle_new_status');
        if (nsRaw) {
            const ns = JSON.parse(nsRaw);
            if (ns[oldId] !== undefined) {
                ns[newId] = ns[oldId];
                delete ns[oldId];
                localStorage.setItem('chronicle_new_status', JSON.stringify(ns));
            }
        }
    } catch (e) {}

    // 重新渲染弹窗
    openAffixDetail(newId);
    filterAffixes();
    if (equipmentChanged) filterEquipments();
    renderStats();
    renderHome();
}

document.getElementById('skillModal').addEventListener('click', (e) => {
    if (e.target.id === 'skillModal') {
        closeModal();
        // 如果是装备详情弹窗，重新渲染装备列表以同步效果显示
        renderEquipment();
    }
});

// ---- 词缀分类定义 ----
const affixCategories = [
    { key: "通用词缀", icon: "✨", color: "#3498db", desc: "5位ID的基础词缀效果" },
    { key: "特殊词缀", icon: "🔮", color: "#e74c3c", desc: "5位以上ID的特殊词缀效果" }
];

// ---- 词缀描述编辑持久化 (localStorage) ----
const AFFIX_EDIT_KEY = 'chronicle_affix_edits';
const SKILL_EDIT_KEY = 'chronicle_skill_edits';
let _editTimer = null;

function loadAffixEdits() {
    try {
        const saved = localStorage.getItem(AFFIX_EDIT_KEY);
        if (!saved) return;
        const edits = JSON.parse(saved);
        affixes.forEach(a => {
            if (edits[a.id] && edits[a.id].description !== undefined) {
                a.description = edits[a.id].description;
            }
            if (edits[a.id] && edits[a.id].name !== undefined) {
                a.name = edits[a.id].name;
            }
        });
    } catch (e) {
        console.warn('加载词缀编辑失败:', e);
    }
}

function loadSkillEdits() {
    try {
        const saved = localStorage.getItem(SKILL_EDIT_KEY);
        if (!saved) return;
        const edits = JSON.parse(saved);
        activeSkills.forEach(s => {
            if (edits[s.id] && edits[s.id].description !== undefined) s.description = edits[s.id].description;
            if (edits[s.id] && edits[s.id].name !== undefined) s.name = edits[s.id].name;
        });
        passiveSkills.forEach(s => {
            if (edits[s.id] && edits[s.id].description !== undefined) s.description = edits[s.id].description;
            if (edits[s.id] && edits[s.id].name !== undefined) s.name = edits[s.id].name;
        });
    } catch (e) {
        console.warn('加载技能编辑失败:', e);
    }
}

function saveEdit(storageKey, dataArray, id, field, value) {
    try {
        let edits = {};
        const saved = localStorage.getItem(storageKey);
        if (saved) edits = JSON.parse(saved);
        if (!edits[id]) edits[id] = {};
        edits[id][field] = value;
        localStorage.setItem(storageKey, JSON.stringify(edits));
        const item = dataArray.find(a => a.id === id);
        if (item) item[field] = value;
        return true;
    } catch (e) {
        console.warn('保存编辑失败:', e);
        return false;
    }
}

function onAffixEdit(id, field, value) {
    saveEdit(AFFIX_EDIT_KEY, affixes, id, field, value);
    updateSaveIndicator();
    syncAffixCard(id);
    // 如果有装备引用了该词缀，刷新装备列表
    const usedInEquipment = equipmentData.some(eq =>
        (eq.effects || []).some(e => e.refId === id)
    );
    if (usedInEquipment) {
        filterEquipments();
    }
}

// 在主动/被动技能中查找技能 (不拼接数组)
function findSkillById(id) {
    let s = activeSkills.find(s => s.id === id);
    if (s) return s;
    return passiveSkills.find(s => s.id === id) || null;
}

function onSkillEdit(id, field, value) {
    const arr = activeSkills.some(s => s.id === id) ? activeSkills : passiveSkills;
    saveEdit(SKILL_EDIT_KEY, arr, id, field, value);
    updateSaveIndicator();
    syncSkillCard(id);
    // 如果有装备引用了该技能，刷新装备列表
    const usedInEquipment = equipmentData.some(eq =>
        (eq.effects || []).some(e => e.refId === id)
    );
    if (usedInEquipment) {
        filterEquipments();
    }
}

function updateSaveIndicator() {
    const indicator = document.getElementById('saveIndicator');
    if (indicator) {
        indicator.textContent = '✓ 已保存';
        indicator.classList.add('saved');
        clearTimeout(_editTimer);
        _editTimer = setTimeout(() => {
            indicator.classList.remove('saved');
            indicator.textContent = '编辑后自动保存';
        }, 2000);
    }
}

function checkHasEdits(storageKey, id) {
    try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
            const edits = JSON.parse(saved);
            return !!edits[id];
        }
    } catch (e) {}
    return false;
}

function resetEditData(storageKey, id) {
    try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
            const edits = JSON.parse(saved);
            delete edits[id];
            localStorage.setItem(storageKey, JSON.stringify(edits));
        }
    } catch (e) {}
}

// ---- 实时同步卡片显示 ----
function syncAffixCard(id) {
    const affix = affixes.find(a => a.id === id);
    if (!affix) return;
    const nameEl = document.querySelector(`[data-affix-id="${id}"] .affix-name`);
    const descEl = document.querySelector(`[data-affix-id="${id}"] .affix-desc`);
    if (nameEl) {
        nameEl.textContent = affix.name;
    }
    if (descEl) descEl.textContent = affix.description;
}

function syncSkillCard(id) {
    const skill = findSkillById(id);
    if (!skill) return;
    const nameEl = document.querySelector(`[data-skill-id="${id}"] .skill-name`);
    if (nameEl) {
        nameEl.textContent = skill.name;
    }
}

// ---- 渲染词缀列表（按分类分组） ----
function renderAffixes(filteredAffixes = affixes) {
    const grid = document.getElementById('affixGrid');
    if (!grid) return;
    if (filteredAffixes.length === 0) {
        grid.innerHTML = '<div class="empty-state">未找到匹配的词缀</div>';
        const _tc = document.getElementById('affixTotalCount'); if (_tc) _tc.textContent = 0;
        return;
    }

    let html = '';
    affixCategories.forEach(cat => {
        const catAffixes = filteredAffixes.filter(a => a.category === cat.key);
        if (catAffixes.length === 0) return;

        html += `
            <div class="affix-category-section">
                <div class="affix-cat-header" style="border-left-color:${cat.color}">
                    <span class="affix-cat-icon" style="background:${cat.color}20;color:${cat.color}">${cat.icon}</span>
                    <div class="affix-cat-info">
                        <h3 class="affix-cat-title">${cat.key}</h3>
                        <span class="affix-cat-desc">${cat.desc}</span>
                    </div>
                    <span class="affix-cat-count" style="background:${cat.color}20;color:${cat.color}">${catAffixes.length}</span>
                </div>
                <div class="affix-cat-grid">
                    ${catAffixes.map(a => {
                        return `
                            <div class="affix-card" data-affix-id="${a.id}" onclick="openAffixDetail('${a.id}')" style="border-left-color:${cat.color}">
                                <div class="affix-header">
                                    <span class="affix-icon" style="background:${cat.color}20;color:${cat.color}">${cat.icon}</span>
                                    <div>
                                        <h4 class="affix-name">${a.name}</h4>
                                        <span class="affix-id">ID: ${a.id}</span>
                                    </div>
                                </div>
                                <span class="affix-tag" style="background:${cat.color}20;color:${cat.color}">${a.subCategory}</span>
                                <p class="affix-desc">${a.description}</p>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    });

    // 兜底：显示不在预定义分类中的词缀
    const knownCats = affixCategories.map(c => c.key);
    const otherAffixes = filteredAffixes.filter(a => !knownCats.includes(a.category));
    if (otherAffixes.length > 0) {
        html += `
            <div class="affix-category-section">
                <div class="affix-cat-header" style="border-left-color:#7f8c8d">
                    <span class="affix-cat-icon" style="background:#7f8c8d20;color:#7f8c8d">📋</span>
                    <div class="affix-cat-info">
                        <h3 class="affix-cat-title">其他词缀</h3>
                        <span class="affix-cat-desc">未分类的词缀</span>
                    </div>
                    <span class="affix-cat-count" style="background:#7f8c8d20;color:#7f8c8d">${otherAffixes.length}</span>
                </div>
                <div class="affix-cat-grid">
                    ${otherAffixes.map(a => {
                        return `
                            <div class="affix-card" data-affix-id="${a.id}" onclick="openAffixDetail('${a.id}')" style="border-left-color:#7f8c8d">
                                <div class="affix-header">
                                    <span class="affix-icon" style="background:#7f8c8d20;color:#7f8c8d">📋</span>
                                    <div>
                                        <h4 class="affix-name">${a.name}</h4>
                                        <span class="affix-id">ID: ${a.id}</span>
                                    </div>
                                </div>
                                <span class="affix-tag" style="background:#7f8c8d20;color:#7f8c8d">${a.subCategory || a.category}</span>
                                <p class="affix-desc">${a.description}</p>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    grid.innerHTML = html;
    const _tc2 = document.getElementById('affixTotalCount'); if (_tc2) _tc2.textContent = filteredAffixes.length;
}

// ---- 新增技能表单 ----
function showAddSkillForm(type) {
    const typeName = type === 'active' ? '主动技能' : '被动技能';
    const typeColor = type === 'active' ? '#e74c3c' : '#3498db';
    const aSeg = type === 'active' ? '1' : '2';

    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = `
        <div class="detail-header" style="border-bottom-color:${typeColor}">
            <div class="detail-icon" style="background:${typeColor}20;color:${typeColor};font-size:36px;width:64px;height:64px;display:flex;align-items:center;justify-content:center;border-radius:12px">➕</div>
            <div>
                <h2 class="detail-name">新增${typeName}</h2>
                <div class="detail-type">
                    <span class="type-badge" style="background:${typeColor}20;color:${typeColor}">${typeName}</span>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <h3 class="detail-section-title">技能ID <span class="required">*</span></h3>
            <p class="equipment-form-hint">10位数字编码，A段位为${aSeg}（${typeName}）。格式: A B C D E 000F G</p>
            <div class="equipment-form-group">
                <input type="text" id="newSkillId" class="equipment-form-input" placeholder="如: ${aSeg}110000010" oninput="previewNewSkillId('${type}')">
            </div>
            <div id="skillIdPreview"></div>
        </div>

        <div class="detail-section">
            <h3 class="detail-section-title">技能名称 <span class="required">*</span></h3>
            <div class="equipment-form-group">
                <input type="text" id="newSkillName" class="equipment-form-input" placeholder="如: 烈焰风暴">
            </div>
        </div>

        <div class="detail-section">
            <h3 class="detail-section-title">技能描述</h3>
            <div class="equipment-form-group">
                <textarea id="newSkillDesc" class="affix-edit-textarea" placeholder="输入技能描述..." style="min-height:80px"></textarea>
            </div>
        </div>

        <div class="equipment-form-actions">
            <button class="equipment-btn equipment-btn-cancel" onclick="closeModal()">取消</button>
            <button class="equipment-btn equipment-btn-save" onclick="submitAddSkill('${type}')">创建技能</button>
        </div>
    `;
    document.getElementById('skillModal').classList.add('active');
}

function previewNewSkillId(type) {
    const id = document.getElementById('newSkillId').value.trim();
    const previewEl = document.getElementById('skillIdPreview');
    if (!id) { previewEl.innerHTML = ''; return; }

    const validation = validateSkillId(id);
    if (!validation.valid) {
        previewEl.innerHTML = `<div class="effect-preview-error">⚠ ${validation.error}</div>`;
        return;
    }

    if (isIdExists(id)) {
        previewEl.innerHTML = `<div class="effect-preview-error">⚠ ID已存在，不能创建重复ID的技能</div>`;
        return;
    }

    const parsed = parseSkillId(id);
    const cat = autoDetectSkillCategory(id);
    const aSeg = parsed.A;
    const typeColor = aSeg === '1' ? '#e74c3c' : '#3498db';
    const typeName = aSeg === '1' ? '主动技能' : '被动技能';
    const bMap = aSeg === '1' ? activeBMap : passiveBMap;
    const cMap = aSeg === '1' ? activeCMap : passiveCMap;
    const bInfo = bMap[parsed.B] || { name: '新段位', desc: '新B段位分类（自动创建）' };
    const cInfo = cMap[parsed.C] || { name: '新子类', desc: '新C段位分类（自动创建）' };

    previewEl.innerHTML = `
        <div class="effect-preview-card" style="border-left-color:${typeColor}">
            <div class="effect-preview-header">
                <span class="effect-preview-type" style="background:${typeColor}20;color:${typeColor}">${typeName}</span>
                <span class="effect-preview-name">${cat.category}</span>
            </div>
            <div class="id-segment-preview">
                <div class="id-seg-item"><span class="seg-label">A</span><span class="seg-value">${parsed.A}</span><span class="seg-desc">${typeName}</span></div>
                <div class="id-seg-item"><span class="seg-label">B</span><span class="seg-value">${parsed.B}</span><span class="seg-desc">${bInfo.name}</span></div>
                <div class="id-seg-item"><span class="seg-label">C</span><span class="seg-value">${parsed.C}</span><span class="seg-desc">${cInfo.name}</span></div>
                <div class="id-seg-item"><span class="seg-label">D</span><span class="seg-value">${parsed.D}</span><span class="seg-desc">效果类型</span></div>
                <div class="id-seg-item"><span class="seg-label">E</span><span class="seg-value">${parsed.E}</span><span class="seg-desc">元素/属性</span></div>
                <div class="id-seg-item"><span class="seg-label">000F</span><span class="seg-value">${parsed.seq}</span><span class="seg-desc">序号</span></div>
                <div class="id-seg-item"><span class="seg-label">G</span><span class="seg-value">${parsed.G}</span><span class="seg-desc">等级标识</span></div>
            </div>
            <div class="effect-preview-bc">
                <div class="bc-row"><span class="bc-label">B段位:</span> <strong>${bInfo.name}</strong> - ${bInfo.desc}</div>
                <div class="bc-row"><span class="bc-label">C段位:</span> <strong>${cInfo.name}</strong> - ${cInfo.desc}</div>
            </div>
            <p class="effect-preview-desc">自动归属: ${cat.category} · ${cat.subCategory}</p>
        </div>
    `;
}

function submitAddSkill(type) {
    const id = document.getElementById('newSkillId').value.trim();
    const name = document.getElementById('newSkillName').value.trim();
    const desc = document.getElementById('newSkillDesc').value.trim();

    if (!id) { alert('请填写技能ID'); return; }
    if (!name) { alert('请填写技能名称'); return; }

    const validation = validateSkillId(id);
    if (!validation.valid) { alert(validation.error); return; }

    if (isIdExists(id)) { alert('ID已存在，不能创建重复ID的技能'); return; }

    const cat = autoDetectSkillCategory(id);
    const parsed = parseSkillId(id);

    // 如果B段位或C段位在现有映射中不存在，自动添加到映射中
    if (type === 'active') {
        if (!activeBMap[parsed.B]) {
            activeBMap[parsed.B] = { name: 'B段-' + parsed.B, desc: '新B段位分类' };
        }
        if (!activeCMap[parsed.C]) {
            activeCMap[parsed.C] = { name: 'C段-' + parsed.C, desc: '新C段位子分类' };
        }
        // 如果B+C组合不存在，也添加到activeCategoryMap
        const bc = parsed.B + parsed.C;
        if (!activeCategoryMap[bc]) {
            activeCategoryMap[bc] = { name: cat.category, desc: cat.subCategory, count: 0 };
        }
    } else {
        if (!passiveBMap[parsed.B]) {
            passiveBMap[parsed.B] = { name: 'B段-' + parsed.B, desc: '新B段位分类' };
        }
        if (!passiveCMap[parsed.C]) {
            passiveCMap[parsed.C] = { name: 'C段-' + parsed.C, desc: '新C段位子分类' };
        }
        const bc = parsed.B + parsed.C;
        if (!passiveCategoryMap[bc]) {
            passiveCategoryMap[bc] = { name: cat.category, desc: cat.subCategory, count: 0 };
        }
    }

    const newSkill = {
        id: id,
        name: name,
        category: cat.category,
        subCategory: cat.subCategory,
        description: desc || '暂无描述',
        isNew: false
    };

    if (type === 'active') {
        activeSkills.push(newSkill);
    } else {
        passiveSkills.push(newSkill);
    }

    // 数据变更后重建索引
    rebuildRefIndex();
    rebuildSkillAffixIdSet();

    // 持久化到 localStorage
    try {
        const key = 'chronicle_custom_skills';
        let custom = [];
        const saved = localStorage.getItem(key);
        if (saved) custom = JSON.parse(saved);
        custom.push({ type: type, ...newSkill });
        localStorage.setItem(key, JSON.stringify(custom));
    } catch (e) {}

    closeModal();
    updateBattleDataCount();

    if (type === 'active') {
        filterSkills('active');
    } else {
        filterSkills('passive');
    }
    renderStats();
}

// ---- 新增词缀表单 ----
function showAddAffixForm() {
    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = `
        <div class="detail-header" style="border-bottom-color:#f39c12">
            <div class="detail-icon" style="background:#f39c1220;color:#f39c12;font-size:36px;width:64px;height:64px;display:flex;align-items:center;justify-content:center;border-radius:12px">➕</div>
            <div>
                <h2 class="detail-name">新增词缀</h2>
                <div class="detail-type">
                    <span class="type-badge" style="background:#f39c1220;color:#f39c12">词缀系统</span>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <h3 class="detail-section-title">词缀ID <span class="required">*</span></h3>
            <p class="equipment-form-hint">5位数字编码。前缀: 1=技能词缀, 2=装备词缀, 3=传奇装备词缀, 4=天赋词缀</p>
            <div class="equipment-form-group">
                <input type="text" id="newAffixId" class="equipment-form-input" placeholder="如: 10045" oninput="previewNewAffixId()">
            </div>
            <div id="affixIdPreview"></div>
        </div>

        <div class="detail-section">
            <h3 class="detail-section-title">词缀名称 <span class="required">*</span></h3>
            <div class="equipment-form-group">
                <input type="text" id="newAffixName" class="equipment-form-input" placeholder="如: 暴击伤害">
            </div>
        </div>

        <div class="detail-section">
            <h3 class="detail-section-title">词缀描述</h3>
            <div class="equipment-form-group">
                <textarea id="newAffixDesc" class="affix-edit-textarea" placeholder="输入词缀效果描述..." style="min-height:80px"></textarea>
            </div>
        </div>

        <div class="equipment-form-actions">
            <button class="equipment-btn equipment-btn-cancel" onclick="closeModal()">取消</button>
            <button class="equipment-btn equipment-btn-save" onclick="submitAddAffix()">创建词缀</button>
        </div>
    `;
    document.getElementById('skillModal').classList.add('active');
}

function previewNewAffixId() {
    const id = document.getElementById('newAffixId').value.trim();
    const previewEl = document.getElementById('affixIdPreview');
    if (!id) { previewEl.innerHTML = ''; return; }

    const validation = validateAffixId(id);
    if (!validation.valid) {
        previewEl.innerHTML = `<div class="effect-preview-error">⚠ ${validation.error}</div>`;
        return;
    }

    if (isIdExists(id)) {
        previewEl.innerHTML = `<div class="effect-preview-error">⚠ ID已存在，不能创建重复ID的词缀</div>`;
        return;
    }

    const parsed = parseAffixId(id);
    const cat = autoDetectAffixCategory(id);
    const typeColors = { '1': '#f39c12', '2': '#27ae60', '3': '#9b59b6', '4': '#3498db' };
    const typeColor = typeColors[parsed.prefix] || '#bbb';

    previewEl.innerHTML = `
        <div class="effect-preview-card" style="border-left-color:${typeColor}">
            <div class="effect-preview-header">
                <span class="effect-preview-type" style="background:${typeColor}20;color:${typeColor}">${parsed.prefixName}</span>
                <span class="effect-preview-name">${parsed.prefixDesc}</span>
            </div>
            <div class="id-segment-preview">
                <div class="id-seg-item"><span class="seg-label">前缀</span><span class="seg-value">${parsed.prefix}</span><span class="seg-desc">${parsed.prefixName}</span></div>
                <div class="id-seg-item"><span class="seg-label">序号</span><span class="seg-value">${parsed.seq}</span><span class="seg-desc">词缀序号</span></div>
            </div>
            <p class="effect-preview-desc">自动归属: ${cat.category} · ${cat.subCategory}</p>
        </div>
    `;
}

function submitAddAffix() {
    const id = document.getElementById('newAffixId').value.trim();
    const name = document.getElementById('newAffixName').value.trim();
    const desc = document.getElementById('newAffixDesc').value.trim();

    if (!id) { alert('请填写词缀ID'); return; }
    if (!name) { alert('请填写词缀名称'); return; }

    const validation = validateAffixId(id);
    if (!validation.valid) { alert(validation.error); return; }

    if (isIdExists(id)) { alert('ID已存在，不能创建重复ID的词缀'); return; }

    const cat = autoDetectAffixCategory(id);
    const newAffix = {
        id: id,
        name: name,
        category: cat.category,
        subCategory: cat.subCategory,
        description: desc || '暂无描述',
        isNew: false
    };

    affixes.push(newAffix);

    // 数据变更后重建索引
    rebuildRefIndex();
    rebuildSkillAffixIdSet();

    // 持久化到 localStorage
    try {
        const key = 'chronicle_custom_affixes';
        let custom = [];
        const saved = localStorage.getItem(key);
        if (saved) custom = JSON.parse(saved);
        custom.push(newAffix);
        localStorage.setItem(key, JSON.stringify(custom));
    } catch (e) {}

    closeModal();
    const _aC2 = document.getElementById('affixCount'); if (_aC2) _aC2.textContent = affixes.length;
    updateBattleDataCount();
    renderAffixes();
    filterAffixes();
    renderStats();
}


function openAffixDetail(id) {
    const affix = affixes.find(a => a.id === id);
    if (!affix) return;

    const cat = affixCategories.find(c => c.key === affix.category);
    const color = cat ? cat.color : '#7f8c8d';
    const icon = cat ? cat.icon : '📋';

    // 检查是否有自定义编辑
    const hasEdits = checkHasEdits(AFFIX_EDIT_KEY, id);

    // 解析词缀ID前缀
    const prefix = affix.id.charAt(0);
    const prefixMap = { '1': '技能词缀', '2': '装备词缀', '3': '传奇装备词缀', '4': '天赋词缀' };

    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = `
        <div class="detail-header" style="border-bottom-color:${color}">
            <div class="detail-icon" style="background:${color}20;color:${color};font-size:36px;width:64px;height:64px;display:flex;align-items:center;justify-content:center;border-radius:12px">${icon}</div>
            <div style="flex:1">
                <h2 class="detail-name">
                    <input type="text" id="affixNameInput" class="affix-edit-input affix-edit-name" value="${affix.name.replace(/"/g, '&quot;')}" oninput="onAffixEdit('${affix.id}', 'name', this.value)" placeholder="词缀名称">
                </h2>
                <div class="detail-type">
                    <span class="type-badge" style="background:${color}20;color:${color}">${affix.category}</span>
                    <span class="type-badge-sub">${affix.subCategory}</span>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <h3 class="detail-section-title">词缀ID</h3>
            <div class="id-edit-row">
                <input type="text" class="affix-edit-input id-edit-input" id="affixIdEdit" value="${affix.id}" placeholder="5位数字" oninput="previewAffixIdChange('${affix.id}')">
                <button class="equipment-btn equipment-btn-save id-save-btn" onclick="applyAffixIdChange('${affix.id}')">应用</button>
            </div>
            <div id="affixIdEditPreview"></div>
        </div>

        <div class="detail-section">
            <div class="detail-section-title-row">
                <h3 class="detail-section-title">词缀效果</h3>
                <span class="save-indicator" id="saveIndicator">${hasEdits ? '✓ 已自定义' : '编辑后自动保存'}</span>
            </div>
            <textarea id="affixDescInput" class="affix-edit-textarea" oninput="onAffixEdit('${affix.id}', 'description', this.value)" placeholder="输入词缀效果描述...">${affix.description}</textarea>
            ${hasEdits ? `<button class="affix-reset-btn" onclick="resetAffixDetail('${affix.id}')">↺ 恢复默认</button>` : ''}
        </div>

        <div class="detail-section">
            <h3 class="detail-section-title">分类信息</h3>
            <div class="detail-info-grid">
                <div class="detail-info-item">
                    <span class="detail-info-label">词缀分类</span>
                    <span class="detail-info-value" style="color:${color}">${affix.category}</span>
                </div>
                <div class="detail-info-item">
                    <span class="detail-info-label">子分类</span>
                    <span class="detail-info-value">${affix.subCategory}</span>
                </div>
                <div class="detail-info-item">
                    <span class="detail-info-label">ID前缀</span>
                    <span class="detail-info-value">${prefix} (${prefixMap[prefix] || '未知'})</span>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <button class="equipment-btn equipment-btn-delete" onclick="deleteAffix('${affix.id}')">🗑 删除词缀</button>
        </div>
    `;

    document.getElementById('skillModal').classList.add('active');
}

// ---- 恢复词缀默认描述 ----
function resetAffixDetail(id) {
    const originalAffix = originalAffixData.find(a => a.id === id);
    if (!originalAffix) return;
    resetEditData(AFFIX_EDIT_KEY, id);
    const affix = affixes.find(a => a.id === id);
    if (affix) {
        affix.name = originalAffix.name;
        affix.description = originalAffix.description;
    }
    openAffixDetail(id);
    filterAffixes();
}

// ---- 删除技能 ----
function deleteSkill(id, type) {
    if (!confirm('确定删除此技能？删除后不可恢复，引用此技能的装备效果也会被移除。')) return;

    const arr = type === 'active' ? activeSkills : passiveSkills;
    const idx = arr.findIndex(s => s.id === id);
    if (idx === -1) return;
    arr.splice(idx, 1);

    // 数据变更后重建索引
    rebuildRefIndex();
    rebuildSkillAffixIdSet();

    // 清除编辑记录
    resetEditData(SKILL_EDIT_KEY, id);
    try {
        const raw = localStorage.getItem('chronicle_new_status');
        if (raw) {
            const saved = JSON.parse(raw);
            delete saved[id];
            localStorage.setItem('chronicle_new_status', JSON.stringify(saved));
        }
    } catch (e) {}

    // 同步清理装备库中引用了该技能的效果
    let equipmentChanged = false;
    equipmentData.forEach(eq => {
        if (!eq.effects) return;
        const before = eq.effects.length;
        eq.effects = eq.effects.filter(e => e.refId !== id);
        if (eq.effects.length !== before) {
            equipmentChanged = true; // 装备库仅只读展示，无需持久化
        }
    });

    closeModal();

    // 更新计数
    updateBattleDataCount();

    // 刷新列表
    filterSkills(type);
    if (equipmentChanged) {
        filterEquipments();
    }
    renderStats();
    renderHome();
}

// ---- 删除词缀 ----
function deleteAffix(id) {
    if (!confirm('确定删除此词缀？删除后不可恢复，引用此词缀的装备效果也会被移除。')) return;

    const idx = affixes.findIndex(a => a.id === id);
    if (idx === -1) return;
    affixes.splice(idx, 1);

    // 数据变更后重建索引
    rebuildRefIndex();
    rebuildSkillAffixIdSet();

    // 清除编辑记录
    resetEditData(AFFIX_EDIT_KEY, id);
    try {
        const raw = localStorage.getItem('chronicle_new_status');
        if (raw) {
            const saved = JSON.parse(raw);
            delete saved[id];
            localStorage.setItem('chronicle_new_status', JSON.stringify(saved));
        }
    } catch (e) {}

    // 同步清理装备库中引用了该词缀的效果
    let equipmentChanged = false;
    equipmentData.forEach(eq => {
        if (!eq.effects) return;
        const before = eq.effects.length;
        eq.effects = eq.effects.filter(e => e.refId !== id);
        if (eq.effects.length !== before) {
            equipmentChanged = true; // 装备库仅只读展示，无需持久化
        }
    });

    closeModal();

    // 更新计数
    const _aC3 = document.getElementById('affixCount'); if (_aC3) _aC3.textContent = affixes.length;
    updateBattleDataCount();

    // 刷新列表
    filterAffixes();
    if (equipmentChanged) {
        filterEquipments();
    }
    renderStats();
    renderHome();
}

// ---- 筛选词缀 ----
function filterAffixes() {
    const catEl = document.getElementById('affixCategoryFilter');
    const searchEl = document.getElementById('affixSearchInput');
    if (!catEl || !searchEl) return;
    const categoryFilter = catEl.value;
    const keywords = parseKeywords(searchEl.value);

    const filtered = affixes.filter(a => {
        if (categoryFilter && a.category !== categoryFilter) return false;
        // 统一搜索: 名称 / ID / 分类 / 子类别 / 描述
        return matchFields(keywords, [a.name, a.id, a.category, a.subCategory, a.description, a.desc]);
    });
    renderAffixes(filtered);
}

// ---- 渲染ID规则分类表 ----
function renderCategoryTables() {
    // === 主动技能 B段位分类表 ===
    const activeBCats = {};
    activeSkills.forEach(s => {
        const parsed = parseSkillId(s.id);
        if (!activeBCats[parsed.B]) activeBCats[parsed.B] = 0;
        activeBCats[parsed.B]++;
    });
    const activeBTable = document.getElementById('activeBTable');
    if (activeBTable) {
        activeBTable.innerHTML = Object.entries(activeBCats).sort().map(([bKey, count]) => {
            const info = activeBMap[bKey] || { name: '未知', desc: '-' };
            return `<tr><td><strong>B=${bKey}</strong></td><td>${info.name}</td><td>${info.desc}</td><td><span class="count-badge">${count}</span></td></tr>`;
        }).join('');
    }

    // === 主动技能 C段位分类表 ===
    const activeCCats = {};
    activeSkills.forEach(s => {
        const parsed = parseSkillId(s.id);
        if (!activeCCats[parsed.C]) activeCCats[parsed.C] = 0;
        activeCCats[parsed.C]++;
    });
    const activeCTable = document.getElementById('activeCTable');
    if (activeCTable) {
        activeCTable.innerHTML = Object.entries(activeCCats).sort().map(([cKey, count]) => {
            const info = activeCMap[cKey] || { name: '未知', desc: '-' };
            return `<tr><td><strong>C=${cKey}</strong></td><td>${info.name}</td><td>${info.desc}</td><td><span class="count-badge">${count}</span></td></tr>`;
        }).join('');
    }

    // === 主动技能 B+C组合分类表 ===
    const activeCats = {};
    activeSkills.forEach(s => {
        const parsed = parseSkillId(s.id);
        const bc = parsed.B + parsed.C;
        if (!activeCats[bc]) activeCats[bc] = { count: 0, skills: [] };
        activeCats[bc].count++;
        activeCats[bc].skills.push(s.name);
    });
    const activeTableBody = document.getElementById('activeCategoryTable');
    if (activeTableBody) {
        activeTableBody.innerHTML = Object.entries(activeCats).sort().map(([bc, data]) => {
            const catMap = activeCategoryMap[bc] || { name: '未知', desc: '' };
            return `<tr><td><strong>${bc}</strong></td><td>${catMap.name || '未知分类'}</td><td>${catMap.desc || '-'}</td><td><span class="count-badge">${data.count}</span></td></tr>`;
        }).join('');
    }

    // === 被动技能 B段位分类表 ===
    const passiveBCats = {};
    passiveSkills.forEach(s => {
        const parsed = parseSkillId(s.id);
        if (!passiveBCats[parsed.B]) passiveBCats[parsed.B] = 0;
        passiveBCats[parsed.B]++;
    });
    const passiveBTable = document.getElementById('passiveBTable');
    if (passiveBTable) {
        passiveBTable.innerHTML = Object.entries(passiveBCats).sort().map(([bKey, count]) => {
            const info = passiveBMap[bKey] || { name: '未知', desc: '-' };
            return `<tr><td><strong>B=${bKey}</strong></td><td>${info.name}</td><td>${info.desc}</td><td><span class="count-badge">${count}</span></td></tr>`;
        }).join('');
    }

    // === 被动技能 C段位分类表 ===
    const passiveCCats = {};
    passiveSkills.forEach(s => {
        const parsed = parseSkillId(s.id);
        if (!passiveCCats[parsed.C]) passiveCCats[parsed.C] = 0;
        passiveCCats[parsed.C]++;
    });
    const passiveCTable = document.getElementById('passiveCTable');
    if (passiveCTable) {
        passiveCTable.innerHTML = Object.entries(passiveCCats).sort().map(([cKey, count]) => {
            const info = passiveCMap[cKey] || { name: '未知', desc: '-' };
            return `<tr><td><strong>C=${cKey}</strong></td><td>${info.name}</td><td>${info.desc}</td><td><span class="count-badge">${count}</span></td></tr>`;
        }).join('');
    }

    // === 被动技能 B+C组合分类表 ===
    const passiveCats = {};
    passiveSkills.forEach(s => {
        const parsed = parseSkillId(s.id);
        const bc = parsed.B + parsed.C;
        if (!passiveCats[bc]) passiveCats[bc] = { count: 0, skills: [] };
        passiveCats[bc].count++;
        passiveCats[bc].skills.push(s.name);
    });
    const passiveTableBody = document.getElementById('passiveCategoryTable');
    if (passiveTableBody) {
        passiveTableBody.innerHTML = Object.entries(passiveCats).sort().map(([bc, data]) => {
            const catMap = passiveCategoryMap[bc] || { name: '未知', desc: '' };
            return `<tr><td><strong>${bc}</strong></td><td>${catMap.name || '未知分类'}</td><td>${catMap.desc || '-'}</td><td><span class="count-badge">${data.count}</span></td></tr>`;
        }).join('');
    }
}

// ---- 渲染统计图表 ----
function renderStats() {
    // 统计数字
    const _set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    _set('statActive', activeSkills.length);
    _set('statPassive', passiveSkills.length);
    _set('statAffix', affixes.length);
    _set('statEquipment', equipmentData.length);
    _set('statAttr', attributes.length);
    _set('statGem', gemData.length);

    // 主动技能分类图表
    const activeCats = {};
    activeSkills.forEach(s => {
        activeCats[s.category] = (activeCats[s.category] || 0) + 1;
    });
    renderBarChart('activeChart', activeCats);

    // 被动技能分类图表
    const passiveCats = {};
    passiveSkills.forEach(s => {
        passiveCats[s.category] = (passiveCats[s.category] || 0) + 1;
    });
    renderBarChart('passiveChart', passiveCats);

    // 词缀分类统计
    const affixCats = {};
    affixes.forEach(a => {
        affixCats[a.category] = (affixCats[a.category] || 0) + 1;
    });
    renderBarChart('affixChart', affixCats);

    // ID段位分布
    const segCats = {};
    [...activeSkills, ...passiveSkills].forEach(s => {
        const parsed = parseSkillId(s.id);
        const bc = `B${parsed.B}C${parsed.C}`;
        segCats[bc] = (segCats[bc] || 0) + 1;
    });
    renderBarChart('segmentChart', segCats);
}

function renderBarChart(containerId, data) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const vals = Object.values(data);
    if (vals.length === 0) { container.innerHTML = '<p style="color:#999;font-size:13px;padding:8px">暂无数据</p>'; return; }
    const maxVal = Math.max(...vals);
    const colors = ['#e74c3c', '#3498db', '#f39c12', '#2ecc71', '#9b59b6', '#1abc9c', '#e67e22', '#c0392b', '#95a5a6'];

    container.innerHTML = `
        <div class="bar-chart">
            ${Object.entries(data).map(([label, value], i) => {
                const pct = (value / maxVal * 100).toFixed(1);
                const color = colors[i % colors.length];
                return `
                    <div class="bar-row">
                        <div class="bar-label">${label}</div>
                        <div class="bar-track">
                            <div class="bar-fill" style="width:${pct}%;background:${color}"></div>
                        </div>
                        <div class="bar-value">${value}</div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// ---- 渲染首页 ----
function renderHome() {
    const _set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    _set('heroEquipment', equipmentData.length);
    _set('heroGem', gemData.length);
    _set('heroCustomSkill', customSkillData.length);
    _set('heroOccupation', occupationData.length);
    _set('heroPet', petData.length);
    renderEquipmentOverview();
    renderOccupationOverview();
    renderSkillComboOverview();
    renderPetOverview();
}

// ---- 首页装备概述 (参考 Dota2 官方首页英雄介绍区块: 密集图标网格 + CTA) ----
function renderEquipmentOverview() {
    const grid = document.getElementById('equipmentOverviewGrid');
    if (!grid) return;

    const typeStyles = {
        '法杖': { icon: '🔮', color: '#9b59b6' },
        '长剑': { icon: '⚔️', color: '#e74c3c' },
        '头盔': { icon: '⛑️', color: '#3498db' },
        '胸甲': { icon: '🛡️', color: '#27ae60' },
        '鞋子': { icon: '👢', color: '#f39c12' },
        '手套': { icon: '🧤', color: '#e67e22' },
        '项链': { icon: '📿', color: '#1abc9c' },
        '未分类': { icon: '📦', color: '#95a5a6' }
    };

    const list = equipmentData || [];
    if (!list.length) { grid.innerHTML = ''; return; }

    grid.innerHTML = list.map(eq => {
        const style = typeStyles[eq.type] || typeStyles['未分类'];
        const emoji = style.icon;
        const color = style.color;
        const iconHtml = eq.icon
            ? `<img class="overview-item-img" src="${DATA_BASE}icon/${eq.icon}.webp" alt="${eq.name}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span class="overview-item-emoji" style="display:none;color:${color}">${emoji}</span>`
            : `<span class="overview-item-emoji" style="display:flex;color:${color}">${emoji}</span>`;
        return `
            <div class="overview-item" style="--glow:${color}" onclick="navigateTo('equipment')" title="${eq.name}">
                ${iconHtml}
            </div>
        `;
    }).join('');
}

// ---- 首页职业天赋轮播 (参考 Dota2 官方首页介绍区块: 立绘横向滑动) ----
function renderOccupationOverview() {
    const track = document.getElementById('occupationOverviewTrack');
    if (!track) return;
    const list = occupationData || [];
    if (!list.length) { track.innerHTML = ''; return; }

    const itemsHtml = list.map((occ, idx) => {
        const bgImage = occupationBgMap[occ.name] || 'assets/talent-bg-character.webp';
        return `
            <div class="occupation-slide" onclick="navigateToOccupation(${idx})" title="${occ.name}">
                <img class="occupation-slide-img" src="${bgImage}" alt="${occ.name}" loading="lazy">
                <div class="occupation-slide-name">${occ.name}</div>
            </div>
        `;
    }).join('');

    // 渲染两遍内容, 供 rAF 匀速无缝循环
    track.innerHTML = itemsHtml + itemsHtml;
    track.scrollLeft = 0;
    startOccupationOverviewAutoScroll();
}

function navigateToOccupation(idx) {
    currentOccupationIdx = idx;
    navigateTo('occupations');
}

function scrollOccupationOverview(dir) {
    const track = document.getElementById('occupationOverviewTrack');
    if (!track) return;
    const card = track.querySelector('.occupation-slide');
    const step = card ? card.offsetWidth + 16 : 320;
    track.scrollBy({ left: dir * step, behavior: 'smooth' });
}

// ---- 立绘自动匀速循环滚动 (从右向左, 鼠标悬停暂停) ----
let occupationOverviewTimer = null;
let occupationOverviewLastTs = null;
const OCCUPATION_SCROLL_SPEED = 0.04; // px/ms ≈ 40px/s

function startOccupationOverviewAutoScroll() {
    stopOccupationOverviewAutoScroll();
    const track = document.getElementById('occupationOverviewTrack');
    if (!track) return;
    occupationOverviewLastTs = null;

    function step(ts) {
        const trackEl = document.getElementById('occupationOverviewTrack');
        if (!trackEl) return;
        if (occupationOverviewLastTs == null) occupationOverviewLastTs = ts;
        const dt = Math.min(ts - occupationOverviewLastTs, 64); // 切后台回来时限制跳变
        occupationOverviewLastTs = ts;
        if (trackEl.scrollWidth > trackEl.clientWidth) {
            trackEl.scrollLeft += OCCUPATION_SCROLL_SPEED * dt;
            const singleWidth = trackEl.scrollWidth / 2;
            if (singleWidth > 0 && trackEl.scrollLeft >= singleWidth) {
                trackEl.scrollLeft -= singleWidth; // 无缝回到第一组
            }
        }
        occupationOverviewTimer = requestAnimationFrame(step);
    }
    occupationOverviewTimer = requestAnimationFrame(step);
}

function stopOccupationOverviewAutoScroll() {
    if (occupationOverviewTimer != null) {
        cancelAnimationFrame(occupationOverviewTimer);
        occupationOverviewTimer = null;
    }
}

// ---- 首页技能组合 (参考 POE 星型宝石连线: 1 主动技能 + 5 辅助宝石) ----
function renderSkillComboOverview() {
    const stage = document.getElementById('skillComboStage');
    if (!stage) return;

    const SIDE_COUNT = 6;

    // 去重系列名, 取"不同名"的辅助宝石 (去掉 ·一/·二 等进阶后缀)
    const seenSeries = new Set();
    const distinctGems = [];
    for (const g of (gemData || [])) {
        const series = (g.name || '').replace(/·\s*[一二三四五六七八九十百]+$/, '');
        const key = series || g.name;
        if (!seenSeries.has(key)) {
            seenSeries.add(key);
            distinctGems.push(g);
        }
        if (distinctGems.length >= SIDE_COUNT) break;
    }

    // 主动技能按 icon 去重, 取 icon 互不相同的技能
    const seenActiveIcon = new Set();
    const distinctActive = [];
    for (const s of (activeSkills || [])) {
        if (!s.icon) continue;
        if (!seenActiveIcon.has(s.icon)) {
            seenActiveIcon.add(s.icon);
            distinctActive.push(s);
        }
        if (distinctActive.length >= SIDE_COUNT) break;
    }

    const active = distinctActive[0] || (activeSkills || []).find(s => s.icon) || activeSkills[0];
    const supports = distinctGems.slice(0, 5);

    if (!active) { stage.innerHTML = ''; return; }

    // 5 个辅助宝石位: 以中心 (50,50) 为圆心、半径 42 的正五边形顶点 (百分比坐标)
    const positions = [
        { x: 50, y: 8 },
        { x: 90, y: 37 },
        { x: 75, y: 84 },
        { x: 25, y: 84 },
        { x: 10, y: 37 }
    ];

    // 中心辐射线 + 正五边形外框
    const radialLines = positions.map(p => `<line x1="50" y1="50" x2="${p.x}" y2="${p.y}" />`).join('');
    const ringLines = positions.map((p, i) => {
        const q = positions[(i + 1) % positions.length];
        return `<line x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}" />`;
    }).join('');

    // 图标片段 (带 emoji 兜底)
    const iconItem = (iconPath, alt, emoji) => iconPath
        ? `<img src="${DATA_BASE}icon/${iconPath}.webp" alt="${alt}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span class="skill-combo-fallback" style="display:none">${emoji}</span>`
        : `<span class="skill-combo-fallback" style="display:flex">${emoji}</span>`;

    const activeIcon = iconItem(active.iconSrc || active.icon, active.name, '⚔️');

    const nodes = positions.map((p, i) => {
        const gem = supports[i];
        if (!gem) return '';
        return `
            <div class="skill-combo-node" style="left:${p.x}%;top:${p.y}%" onclick="navigateTo('gems')" title="${gem.name}">
                <div class="skill-combo-gem">${iconItem(gem.iconSrc || gem.icon, gem.name, '💎')}</div>
                <span class="skill-combo-node-name">${gem.name}</span>
            </div>
        `;
    }).join('');

    stage.innerHTML = `
        <svg class="skill-combo-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
            ${radialLines}
            ${ringLines}
        </svg>
        <div class="skill-combo-active" style="left:50%;top:50%" onclick="navigateTo('custom-skills')">
            <div class="skill-combo-active-gem">${activeIcon}</div>
            <span class="skill-combo-active-name">${active.name}</span>
            <span class="skill-combo-active-lv">Lv.1</span>
        </div>
        ${nodes}
    `;

    // 左侧: 主动技能图标竖排
    const activeListEl = document.getElementById('skillComboActiveList');
    if (activeListEl) {
        activeListEl.innerHTML = `<div class="skill-combo-side-title">主动技能</div>` + distinctActive.map(s =>
            `<div class="skill-combo-side-item skill-combo-side-active" onclick="navigateTo('custom-skills')" title="${s.name}">${iconItem(s.iconSrc || s.icon, s.name, '⚔️')}</div>`
        ).join('');
    }

    // 右侧: 辅助宝石图标竖排
    const gemListEl = document.getElementById('skillComboGemList');
    if (gemListEl) {
        gemListEl.innerHTML = `<div class="skill-combo-side-title">辅助技能</div>` + distinctGems.slice(0, SIDE_COUNT).map(g =>
            `<div class="skill-combo-side-item" onclick="navigateTo('gems')" title="${g.name}">${iconItem(g.iconSrc || g.icon, g.name, '💎')}</div>`
        ).join('');
    }
}

// ---- 首页魔宠系统 (严格按照完整效果图 1920x911 的立绘坐标拼接) ----
// 各立绘在效果图中的精确位置(百分比, 基于 1920x911 背景图)
// cx: 中心点横坐标%; bottom: 距底部%(=100-距顶部%); w: 宽度%; z: 前后层叠次序; flip: 是否水平镜像
const PET_HERO_POS = {
    '6022': { cx: 69.51, bottom: 16.79, w: 27.14, z: 7,  flip: false }, // 拳斗熊
    '6082': { cx: 87.92, bottom: 43.58, w: 17.29, z: 5,  flip: false }, // 雷电法王
    '7012': { cx: 25.96, bottom: 43.91, w: 26.82, z: 4,  flip: false }, // 珠泪使者
    '7022': { cx: 12.71, bottom: 47.53, w: 21.46, z: 2,  flip: false }, // 蕾朵
    '7032': { cx: 68.07, bottom: 50.60, w: 19.90, z: 1,  flip: false }, // 熔炉魔灵
    '7042': { cx: 14.35, bottom: 14.05, w: 19.43, z: 8,  flip: false }, // 混沌魔猿
    '7052': { cx: 33.05, bottom: 33.59, w: 19.01, z: 6,  flip: false }, // 雷暴元素
    '7062': { cx: 77.79, bottom: 46.54, w: 27.03, z: 3,  flip: false }, // 破冰战甲
    '7072': { cx: 28.15, bottom: 8.34,  w: 31.93, z: 9,  flip: false }, // 利爪冰狼
    '7082': { cx: 59.71, bottom: 7.46,  w: 11.51, z: 10, flip: true  }  // 烈焰机甲
};

// 首页魔宠: 名称不再常驻界面, 改为悬停时在对应宠物身上滑入名称面板
// 其余立绘压暗由 CSS `.pet-hero-layout:has(:hover)` 纯样式驱动
function renderPetOverview() {
    const stage = document.getElementById('petHeroStage');
    if (!stage) return;

    // 效果图中的 10 只立绘 id (固定顺序, 与切图一一对应)
    const heroIds = ['6022', '6082', '7012', '7022', '7032', '7042', '7052', '7062', '7072', '7082'];
    const list = heroIds
        .map(id => (petData || []).find(p => String(p.id) === id))
        .filter(Boolean);
    if (!list.length) { stage.innerHTML = ''; return; }

    // 首页完整效果图背景 + 英雄切图资源 (1920x911)
    const bg = DATA_BASE + 'icon/pet/hero/bg.webp';

    const itemHtml = (p) => {
        const pos = PET_HERO_POS[String(p.id)] || { cx: 50, bottom: 5, w: 20, z: 5, flip: false };
        const q = getPetQuality(p.quality);
        const pic = DATA_BASE + 'icon/pet/hero/' + p.id + '.webp';
        let fullStar = null;
        if (p.stars && p.stars.length) {
            fullStar = p.stars.reduce((m, s) => (s.star > m.star ? s : m), p.stars[0]);
        }
        const fullEff = fullStar ? renderPetStarEffects(fullStar) : '';
        const flipCls = pos.flip ? ' pet-hero-flip' : '';
        return `
            <div class="pet-hero-item${flipCls}" data-pet="${p.id}" style="--cx:${pos.cx}%;--bottom:${pos.bottom}%;--w:${pos.w}%;--z:${pos.z};--pet-color:${q.color}" onclick="navigateTo('pets')" title="${p.name}">
                <div class="pet-hero-avatar"><img src="${pic}" alt="${p.name}" onerror="this.style.display='none'"></div>
                <div class="pet-hero-name-panel" style="--pet-color:${q.color}">${p.name}</div>
                ${fullEff ? `<div class="pet-hero-effects"><div class="pet-hero-effects-title">⭐ 满星效果</div>${fullEff}</div>` : ''}
            </div>
        `;
    };

    stage.innerHTML = `
        <div class="pet-hero-layout" style="background-image:url('${bg}')">
            ${list.map(itemHtml).join('')}
        </div>
    `;
}

// ---- 装备系统 ----
function renderEquipment(filteredData) {
    const grid = document.getElementById('equipmentGrid');
    if (!grid) return;
    const data = filteredData || equipmentData;
    if (data.length === 0) {
        grid.innerHTML = `
            <div class="equipment-empty">
                <div class="equipment-empty-icon">📦</div>
                <p>${equipmentData.length === 0 ? '暂无装备数据' : '未找到匹配的装备'}</p>
                <p class="equipment-empty-hint">${equipmentData.length === 0 ? '装备数据仅由一键导入提供，请先运行一键导入' : '尝试其他搜索关键词'}</p>
            </div>
        `;
        document.getElementById('equipmentTotalCount').textContent = equipmentData.length;
        return;
    }

    // 按装备类型分组
    const typeGroups = {};
    data.forEach(eq => {
        const type = eq.type || '未分类';
        if (!typeGroups[type]) typeGroups[type] = [];
        typeGroups[type].push(eq);
    });

    // 装备类型图标和颜色
    const typeStyles = {
        '法杖': { icon: '🔮', color: '#9b59b6' },
        '长剑': { icon: '⚔️', color: '#e74c3c' },
        '头盔': { icon: '⛑️', color: '#3498db' },
        '胸甲': { icon: '🛡️', color: '#27ae60' },
        '鞋子': { icon: '👢', color: '#f39c12' },
        '手套': { icon: '🧤', color: '#e67e22' },
        '项链': { icon: '📿', color: '#1abc9c' },
        '未分类': { icon: '📦', color: '#95a5a6' }
    };

    grid.innerHTML = Object.keys(typeGroups).sort().map(type => {
        const style = typeStyles[type] || typeStyles['未分类'];
        const equips = typeGroups[type];
        const cards = equips.map(eq => {
        const effects = (eq.effects || []).filter(e => e.refId);
        const effectItems = effects.map(eff => {
            // 传奇装备效果在导入时已预解析 name/desc (refId 为 Modifier ID)
            const preResolved = eff.name || eff.desc;
            const refData = preResolved ? null : findRefData(eff.refId);
            const typeColor = preResolved ? '#f39c12' : (refData ? (refData.type === 'active-skill' ? '#e74c3c' : refData.type === 'passive-skill' ? '#3498db' : refData.type === 'attribute' ? '#27ae60' : '#f39c12') : '#e74c3c');
            const typeLabel = preResolved ? '词缀' : (refData ? (refData.type === 'active-skill' ? '主动' : refData.type === 'passive-skill' ? '被动' : refData.type === 'attribute' ? '属性' : '词缀') : '未知');
            // 只展示描述; 描述为空时退回名称, 避免词条行只剩标签
            const desc = formatEffectDesc(preResolved ? (eff.desc || eff.name || '') : (refData ? (refData.desc || refData.name) : '⚠ 未找到ID: ' + eff.refId));
            const randomTag = eff.random ? '<span class="equipment-card-effect-random">取随机一条</span>' : '';
            return `
                <div class="equipment-card-effect">
                    <span class="equipment-card-effect-type" style="background:${typeColor}20;color:${typeColor}">${typeLabel}</span>
                    ${randomTag}
                    <p class="equipment-card-effect-desc">${desc}</p>
                </div>
            `;
        }).join('');
        const passives = (eq.passiveEffects || []).filter(e => e.refId);
        const passiveItems = passives.map(eff => {
            const refData = findRefData(eff.refId);
            return `
                <div class="equipment-card-effect">
                    <span class="equipment-card-effect-type" style="background:#3498db20;color:#3498db">被动</span>
                    <p class="equipment-card-effect-desc">${formatEffectDesc(refData ? (refData.desc || refData.name) : '⚠ 未找到ID: ' + eff.refId)}</p>
                </div>
            `;
        }).join('');
        // 统计栏仅保留「被动」；无被动时不渲染该栏
        const statsRow = passives.length > 0
            ? `<div class="item-stats">
                    <div class="item-stats-cell"><span class="item-stats-label">被动</span><span class="item-stats-value">${passives.length} 条</span></div>
                </div>`
            : '';
        return `
            <div class="equipment-card" data-equipment-id="${eq.id}" data-quality="${eq.quality || ''}" onclick="openEquipmentDetail('${eq.id}')">
                <div class="equipment-card-header">
                    <span class="equipment-card-icon">${eq.icon ? `<img class="card-icon" src="${DATA_BASE}icon/${eq.icon}.webp" alt="" onerror="this.style.display='none'">` : ''}${style.icon}</span>
                    <div>
                        <h4 class="equipment-card-name">${eq.name}</h4>
                    </div>
                </div>
                <span class="equipment-card-type">${eq.type || '未分类'}</span>
                ${statsRow}
                <div class="equipment-card-effects">
                    <div class="equipment-card-effect-list">
                        ${effectItems || '<p class="equipment-card-effect-empty">暂无效果</p>'}
                        ${passiveItems}
                    </div>
                </div>
            </div>
        `;
        }).join('');

        const safeType = type.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
        return `
            <div class="equipment-type-group expanded" id="equip-type-group-${safeType}">
                <div class="equipment-type-header" style="border-left-color:${style.color}" onclick="toggleEquipTypeGroup('${safeType}')">
                    <span class="equipment-type-toggle-icon">▼</span>
                    <span class="equipment-type-icon">${style.icon}</span>
                    <span class="equipment-type-name">${type}</span>
                    <span class="equipment-type-count">${equips.length} 件</span>
                </div>
                <div class="equipment-type-content">
                    <div class="skill-grid segment-skill-grid">
                        ${cards}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    document.getElementById('equipmentTotalCount').textContent = equipmentData.length;
    updateEquipmentTypeFilter();
}

function filterEquipments() {
    const keywords = parseKeywords(document.getElementById('equipmentSearchInput').value);
    const typeFilter = document.getElementById('equipmentTypeFilter') ? document.getElementById('equipmentTypeFilter').value : '';
    const filtered = equipmentData.filter(eq => {
        if (typeFilter && (eq.type || '未分类') !== typeFilter) return false;
        // 统一搜索: 名称 / ID / 类型 / 所属 / 关联效果 (ID + 效果名称 + 效果描述)
        return matchFields(keywords, [eq.name, eq.id, eq.type, eq.source, eq.effects && eq.effects.map(e => e.refId), effectText(eq.effects)]);
    });
    renderEquipment(filtered);
}

// ---- 更新装备类型筛选选项 ----
function updateEquipmentTypeFilter() {
    const select = document.getElementById('equipmentTypeFilter');
    if (!select) return;
    const currentVal = select.value;
    const types = [...new Set(equipmentData.map(eq => eq.type || '未分类'))].sort();
    select.innerHTML = '<option value="">全部类型</option>' + types.map(t => `<option value="${t}">${t}</option>`).join('');
    if (types.includes(currentVal)) select.value = currentVal;
}

// ---- 切换装备类型分组折叠/展开 ----
function toggleEquipTypeGroup(type) {
    const el = document.getElementById('equip-type-group-' + type);
    if (!el) return;
    const isCollapsed = el.classList.contains('collapsed');
    if (isCollapsed) {
        el.classList.remove('collapsed');
        el.classList.add('expanded');
    } else {
        el.classList.remove('expanded');
        el.classList.add('collapsed');
    }
    const icon = el.querySelector('.equipment-type-toggle-icon');
    if (icon) icon.textContent = isCollapsed ? '▼' : '▶';
}











// ---- 效果描述换行处理 ----
// 数据中多段描述以 " / " 分隔, 且存在 \n 字面量; 统一转成真实换行, 由 CSS white-space: pre-line 呈现
function formatEffectDesc(text) {
    if (!text) return '';
    return String(text)
        .replace(/\\n/g, '\n')
        .replace(/[ \t]+\/[ \t]+/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

// 装备词条按「传奇词缀池」归组: 框选渲染与标题统计共用同一套分组规则
// poolGroups: import 阶段记录的池清单 [{ poolId, ids, total }](total = 池内候选总数)
function groupEquipmentEffects(effects, poolGroups) {
    // 池内候选总数(来自 ModifierPool 池定义), 用于判定该池是否值得框选
    const poolTotal = {};
    (poolGroups || []).forEach(g => { if (g && g.poolId) poolTotal[String(g.poolId)] = g.total || (g.ids || []).length; });

    // 按 poolId 归组(保持出现顺序), 无池信息的词条归入空组
    const order = [];
    const groupMap = {};
    (effects || []).forEach(eff => {
        const pid = eff.poolId ? String(eff.poolId) : '';
        if (!groupMap[pid]) { groupMap[pid] = []; order.push(pid); }
        groupMap[pid].push(eff);
    });

    // 池内仅 1 条候选时不构成"多条同池", 不画框, 避免单行空框
    const needBox = pid => !!pid && (groupMap[pid].length >= 2 || (poolTotal[pid] || 0) >= 2);

    return { order, groupMap, poolTotal, needBox };
}

// 需要框选的池数量(供详情页标题展示)
function countEquipmentEffectPools(effects, poolGroups) {
    const g = groupEquipmentEffects(effects, poolGroups);
    return g.order.filter(g.needBox).length;
}

// 装备词条按「传奇词缀池」分组渲染: 同一池(ModifierPool)展开出的词条框在一起
function renderEquipmentEffectsByPool(effects, poolGroups) {
    const list = effects || [];
    const buildItem = (eff) => {
        const preResolved = eff.name || eff.desc;
        const refData = !preResolved && eff.refId ? findRefData(eff.refId) : null;
        const typeColor = preResolved ? '#f39c12' : (refData ? (refData.type === 'active-skill' ? '#e74c3c' : refData.type === 'passive-skill' ? '#3498db' : refData.type === 'attribute' ? '#27ae60' : '#f39c12') : '#bbb');
        const typeLabel = preResolved ? '词缀' : (refData ? (refData.type === 'active-skill' ? '主动技能' : refData.type === 'passive-skill' ? '被动技能' : refData.type === 'attribute' ? '属性效果' : '词缀') : '待填写');
        const name = preResolved ? eff.name : (refData ? refData.name : eff.refId);
        const desc = preResolved ? eff.desc : (refData ? refData.desc : '');
        return `
            <div class="equipment-effect-item" style="border-left-color:${typeColor}">
                <div class="equipment-effect-header">
                    <span class="effect-type-badge" style="background:${typeColor}20;color:${typeColor}">${typeLabel}</span>
                    <span class="effect-ref-id">${eff.refId || '—'}</span>
                </div>
                <div class="equipment-effect-info">
                    <span class="equipment-effect-name">${name}</span>
                    ${eff.random ? '<span class="equipment-effect-random-tag">取随机一条</span>' : ''}
                    <p class="equipment-effect-desc">${formatEffectDesc(desc || (eff.refId ? '⚠ 未找到ID: ' + eff.refId : ''))}</p>
                </div>
            </div>
        `;
    };

    // 池内候选总数(来自 ModifierPool 池定义), 用于判定该池是否值得框选
    const { order, groupMap, poolTotal, needBox } = groupEquipmentEffects(effects, poolGroups);

    // 无任何池信息(旧数据/手工新增) → 平铺, 不做分组框选
    if (!order.some(pid => pid)) return list.map(buildItem).join('');

    return order.map(pid => {
        const items = groupMap[pid];
        if (!pid || !needBox(pid)) return items.map(buildItem).join('');
        const total = poolTotal[pid] || items.length;
        const dupNote = total > items.length
            ? `<span class="equipment-effect-group-note">池内共 ${total} 条（含跨池重复）</span>`
            : '';
        return `
            <div class="equipment-effect-group">
                <div class="equipment-effect-group-header">
                    <span class="equipment-effect-group-badge">词条池 ${pid}</span>
                    ${dupNote}
                    <span class="equipment-effect-group-count">${items.length} 条</span>
                </div>
                ${items.map(buildItem).join('')}
            </div>
        `;
    }).join('');
}

function openEquipmentDetail(id) {
    const eq = equipmentData.find(e => e.id === id);
    if (!eq) return;
    if (!eq.effects) eq.effects = [];
    const effects = eq.effects;
    // 需要按池框选的组数(与渲染逻辑同源)
    const boxedPoolCount = countEquipmentEffectPools(effects, eq.poolGroups);

    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = `
        <div class="detail-header" style="border-bottom-color:#9b59b6">
            <div class="detail-icon" style="background:#9b59b620;color:#9b59b6;font-size:36px;width:64px;height:64px;display:flex;align-items:center;justify-content:center;border-radius:12px;position:relative;overflow:hidden">${eq.icon ? `<img class="card-icon" src="${DATA_BASE}icon/${eq.icon}.webp" alt="" onerror="this.style.display='none'">` : ''}📦</div>
            <div style="flex:1">
                <h2 class="detail-name">${eq.name}</h2>
                <div class="detail-type">
                    <span class="type-badge" style="background:#9b59b620;color:#9b59b6">装备系统</span>
                    <span class="type-badge-sub">${eq.type || '未分类'}</span>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <h3 class="detail-section-title">装备效果（${effects.filter(e => e.refId).length} 条${boxedPoolCount ? ' · ' + boxedPoolCount + ' 组同池词条' : ''}）</h3>
            <div id="equipmentEffectList">
            ${effects.length === 0 ? '<p class="empty-hint">暂无效果</p>' : ''}
            ${renderEquipmentEffectsByPool(effects, eq.poolGroups)}
            </div>
        </div>
    `;
    document.getElementById('skillModal').classList.add('active');
}

















// ============================================================
// 辅助技能宝石系统
// ============================================================

function renderGems(filteredData) {
    const grid = document.getElementById('gemGrid');
    if (!grid) return;
    const data = filteredData || gemData;

    if (data.length === 0) {
        grid.innerHTML = `
            <div class="equipment-empty">
                <p>${gemData.length === 0 ? '暂无辅助宝石数据' : '未找到匹配的宝石'}</p>
                <p class="equipment-empty-hint">${gemData.length === 0 ? '辅助宝石数据仅由一键导入提供，请先运行一键导入' : '尝试其他搜索关键词'}</p>
            </div>
        `;
        document.getElementById('gemTotalCount').textContent = gemData.length;
        return;
    }

    // 按 rank(所属阶级) 分组，向下堆叠（同一行最多 4 个）
    const rankGroups = {};
    data.forEach(gem => {
        const rank = (gem.rank || '').toString().trim() || '0';
        if (!rankGroups[rank]) rankGroups[rank] = [];
        rankGroups[rank].push(gem);
    });

    const rankStyles = {
        '1': { icon: '💎', color: '#95a5a6' },
        '2': { icon: '💎', color: '#3498db' },
        '3': { icon: '💎', color: '#27ae60' },
        '4': { icon: '💎', color: '#9b59b6' },
        '5': { icon: '💎', color: '#f39c12' },
        '0': { icon: '💎', color: '#7f8c8d' }
    };
    const rankNames = { '1': '1 阶', '2': '2 阶', '3': '3 阶', '4': '4 阶', '5': '5 阶', '0': '未分类' };

    const rankOrder = Object.keys(rankGroups).sort((a, b) => {
        const na = parseInt(a, 10), nb = parseInt(b, 10);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return isNaN(na) ? 1 : -1;
    });

    grid.innerHTML = rankOrder.map(rank => {
        const style = rankStyles[rank] || rankStyles['0'];
        const gems = rankGroups[rank];
        const cards = gems.map(gem => {
            return `
                <div class="equipment-card" data-gem-id="${gem.id}" onclick="openGemDetail('${gem.id}')" style="border-left-color:${style.color}">
                    <div class="equipment-card-header">
                        <span class="equipment-card-icon" style="background:${style.color}18">${gem.iconSrc || gem.icon ? `<img class="card-icon" src="${DATA_BASE}icon/${gem.iconSrc || gem.icon}.webp" alt="" onerror="this.style.display='none'">` : ''}${style.icon}</span>
                        <div>
                            <h4 class="equipment-card-name">${gem.name}</h4>
                        </div>
                    </div>
                    <div class="item-stats">
                        <div class="item-stats-cell"><span class="item-stats-label">类型</span><span class="item-stats-value">${gem.type || '辅助宝石'}</span></div>
                    </div>
                    ${gem.desc ? `<p class="equipment-card-effect-desc" style="margin:4px 0;padding:4px 8px;background:#f8f8f8;border-radius:6px;font-size:12px;color:#666">${gem.desc}</p>` : ''}
                </div>
            `;
        }).join('');

        const safeRank = 'rank-' + rank;
        return `
            <div class="equipment-type-group expanded" id="gem-type-group-${safeRank}">
                <div class="equipment-type-header" style="border-left-color:${style.color}" onclick="toggleGemTypeGroup('${safeRank}')">
                    <span class="equipment-type-toggle-icon">▼</span>
                    <span class="equipment-type-icon">${style.icon}</span>
                    <span class="equipment-type-name">${rankNames[rank] || (rank + ' 阶')}</span>
                    <span class="equipment-type-count">${gems.length} 个</span>
                </div>
                <div class="equipment-type-content">
                    <div class="skill-grid segment-skill-grid">
                        ${cards}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    document.getElementById('gemTotalCount').textContent = gemData.length;
    updateGemRankFilter();
}

// ---- 切换宝石类型分组折叠/展开 ----
function toggleGemTypeGroup(type) {
    const el = document.getElementById('gem-type-group-' + type);
    if (!el) return;
    const isCollapsed = el.classList.contains('collapsed');
    if (isCollapsed) {
        el.classList.remove('collapsed');
        el.classList.add('expanded');
    } else {
        el.classList.remove('expanded');
        el.classList.add('collapsed');
    }
    const icon = el.querySelector('.equipment-type-toggle-icon');
    if (icon) icon.textContent = isCollapsed ? '▼' : '▶';
}

function filterGems() {
    const keywords = parseKeywords(document.getElementById('gemSearchInput').value);
    const rankFilter = document.getElementById('gemRankFilter') ? document.getElementById('gemRankFilter').value : '';
    const filtered = gemData.filter(gem => {
        const rank = (gem.rank || '').toString().trim() || '0';
        if (rankFilter && rank !== rankFilter) return false;
        // 统一搜索: 名称 / ID / 阶级 / 类型 / 描述 / 关联效果
        return matchFields(keywords, [
            gem.name, gem.id, gem.type, gem.desc, gem.source,
            rank !== '0' ? rank + ' 阶' : '',
            effectText(gem.effects)
        ]);
    });
    renderGems(filtered);
    updateGemRankFilter();
}

function updateGemRankFilter() {
    const select = document.getElementById('gemRankFilter');
    if (!select) return;
    const currentVal = select.value;
    const rankNames = { '0': '未分类' };
    const ranks = [...new Set(gemData.map(g => (g.rank || '').toString().trim() || '0'))].sort((a, b) => {
        const na = parseInt(a, 10), nb = parseInt(b, 10);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return isNaN(na) ? 1 : -1;
    });
    select.innerHTML = '<option value="">全部阶级</option>' + ranks.map(r => `<option value="${r}">${rankNames[r] || (r + ' 阶')}</option>`).join('');
    select.value = currentVal;
}






function openGemDetail(id) {
    const gem = gemData.find(g => g.id === id);
    if (!gem) return;

    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = `
        <div class="detail-header" style="border-bottom-color:#9b59b6">
            <div class="detail-icon" style="background:#9b59b620;color:#9b59b6;font-size:36px;width:64px;height:64px;display:flex;align-items:center;justify-content:center;border-radius:12px;position:relative;overflow:hidden">${gem.iconSrc || gem.icon ? `<img class="card-icon" src="${DATA_BASE}icon/${gem.iconSrc || gem.icon}.webp" alt="" onerror="this.style.display='none'">` : ''}💎</div>
            <div style="flex:1">
                <h2 class="detail-name">${gem.name}</h2>
                <div class="detail-type">
                    <span class="type-badge" style="background:#9b59b620;color:#9b59b6">辅助宝石</span>
                    ${gem.rank ? `<span class="type-badge-sub">${gem.rank} 阶</span>` : ''}
                    <span class="type-badge-sub">${gem.id}</span>
                    ${gem.type ? `<span class="type-badge-sub">${gem.type}</span>` : ''}
                </div>
            </div>
        </div>

        ${gem.desc ? `
        <div class="detail-section">
            <h3 class="detail-section-title">宝石效果描述</h3>
            <p class="detail-desc-text">${gem.desc.replace(/</g, '&lt;').replace(/\n/g, '<br>')}</p>
        </div>
        ` : ''}
    `;
    document.getElementById('skillModal').classList.add('active');
}















// ============================================================
// 三库（装备库/辅助技能宝石/技能库）数据仅由一键导入提供，
// 来源同步功能已移除。
// ============================================================
// ============================================================
// 自定义技能系统
// ============================================================
// 技能标签渲染: tags = { main: '攻击', normal: ['近战', '冰霜'] }
// 未映射到字典的纯数字标签(如 15)直接过滤，不显示
function isUnmappedTag(t) {
    return t !== null && t !== undefined && t !== '' && /^\d+$/.test(String(t));
}

function renderSkillTags(tags) {
    if (!tags) return '';
    const mainHtml = (tags.main && tags.main !== '' && !isUnmappedTag(tags.main))
        ? `<span class="skill-tag skill-tag-main">${tags.main}</span>` : '';
    const normalHtml = (tags.normal || [])
        .filter(t => t !== '' && t !== null && t !== undefined && !isUnmappedTag(t))
        .map(t => `<span class="skill-tag skill-tag-normal">${t}</span>`).join('');
    if (!mainHtml && !normalHtml) return '';
    return `<div class="skill-tag-row">${mainHtml}${normalHtml}</div>`;
}

// 技能数值展示等级: 由 tools/import.js 的 SKILL_DATA_LEVEL 写入 (1 = 需求数据, 20 = 满级数值)
function getSkillDisplayLevel() {
    const lv = window.__AUTO_IMPORT_DATA__ ? window.__AUTO_IMPORT_DATA__.skillDisplayLevel : null;
    return (lv === 0 || lv) ? lv : 1;
}

function renderCustomSkills(filteredData) {
    const grid = document.getElementById('customSkillGrid');
    if (!grid) return;
    const data = filteredData || customSkillData;

    if (data.length === 0) {
        grid.innerHTML = `
            <div class="equipment-empty">
                <div class="equipment-empty-icon">🏹</div>
                <p>${customSkillData.length === 0 ? '暂无技能数据' : '未找到匹配的技能'}</p>
                <p class="equipment-empty-hint">${customSkillData.length === 0 ? '技能库数据仅由一键导入提供，请先运行一键导入' : '尝试其他搜索关键词'}</p>
            </div>
        `;
        const _c = document.getElementById('customSkillTotalCount'); if (_c) _c.textContent = customSkillData.length;
        return;
    }

    // 按技能类型分组
    const typeGroups = {};
    data.forEach(s => {
        const type = s.type || '未分类';
        if (!typeGroups[type]) typeGroups[type] = [];
        typeGroups[type].push(s);
    });

    const typeStyles = {
        '主动技能': { icon: '⚔️', color: '#e74c3c' },
        '被动技能': { icon: '🛡️', color: '#3498db' },
        '辅助技能': { icon: '✨', color: '#9b59b6' },
        '特殊技能': { icon: '🔥', color: '#f39c12' },
        '未分类': { icon: '🏹', color: '#95a5a6' }
    };

    grid.innerHTML = Object.keys(typeGroups).sort().map(type => {
        const style = typeStyles[type] || typeStyles['未分类'];
        const skills = typeGroups[type];
        const cards = skills.map(s => {
            // 视频匹配: 按技能名称在 videoData 中查找对应视频
            const video = videoData.find(v => v.name === s.name) || null;
            const videoHtml = video
                ? `<div class="skill-video-hint">▶ 点击查看技能演示</div>`
                : `<div class="skill-video-empty">暂无视频</div>`;
            // 技能消耗 (recourceType: 1=生命, 2=魔力; recourceConsume=值)
            const consumeText = (() => {
                const rc = s.recourceConsume;
                if (rc === null || rc === undefined || rc === '') return '—';
                const rt = s.recourceType;
                const typeName = rt === 1 ? '生命' : (rt === 2 ? '魔力' : '');
                return typeName ? `${rc} ${typeName}` : String(rc);
            })();
            // 技能冷却时间 (skillCd 毫秒 → 秒, 数值展示)
            const cdText = (() => {
                const cd = s.skillCd;
                if (cd === null || cd === undefined || cd === '' || isNaN(Number(cd))) return '—';
                const ms = Number(cd);
                const sec = ms / 1000;
                return `${parseFloat(sec.toFixed(1))}秒`;
            })();
            return `
                <div class="equipment-card" data-custom-skill-id="${s.id}" onclick="openCustomSkillDetail('${s.id}')" style="border-left-color:${style.color}">
                    <div class="equipment-card-header">
                        <span class="equipment-card-icon" style="background:${style.color}18">${s.iconSrc || s.icon ? `<img class="card-icon" src="${DATA_BASE}icon/${s.iconSrc || s.icon}.webp" alt="" onerror="this.style.display='none'">` : ''}${style.icon}</span>
                        <div>
                            <h4 class="equipment-card-name">${s.name} <span class="skill-lv-badge">Lv.${getSkillDisplayLevel()}</span></h4>
                        </div>
                    </div>
                    <div class="item-stats">
                        <div class="item-stats-cell"><span class="item-stats-label">类型</span><span class="item-stats-value">${s.type || '未分类'}</span></div>
                        <div class="item-stats-cell"><span class="item-stats-label">消耗</span><span class="item-stats-value">${consumeText}</span></div>
                        <div class="item-stats-cell"><span class="item-stats-label">冷却</span><span class="item-stats-value">${cdText}</span></div>
                    </div>
                    ${renderSkillTags(s.tags)}
                    <div class="skill-desc-box${s.desc ? '' : ' is-empty'}">${s.desc ? s.desc.replace(/</g, '&lt;').replace(/\n/g, '<br>') : '暂无描述'}</div>
                    <div class="skill-video-section">
                        <div class="skill-video-title">🎬 技能演示</div>
                        ${videoHtml}
                    </div>
                </div>
            `;
        }).join('');

        const safeType = type.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
        return `
            <div class="equipment-type-group expanded" id="custom-skill-type-group-${safeType}">
                <div class="equipment-type-header" style="border-left-color:${style.color}" onclick="toggleCustomSkillTypeGroup('${safeType}')">
                    <span class="equipment-type-toggle-icon">▼</span>
                    <span class="equipment-type-icon">${style.icon}</span>
                    <span class="equipment-type-name">${type}</span>
                    <span class="equipment-type-count">${skills.length} 个</span>
                </div>
                <div class="equipment-type-content">
                    <div class="skill-grid segment-skill-grid">
                        ${cards}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    const _tc = document.getElementById('customSkillTotalCount'); if (_tc) _tc.textContent = customSkillData.length;
    updateCustomSkillTypeFilter();
}

// 技能库条目是否匹配搜索词 (名称/ID/类型/描述/标签/关联效果ID与效果内容)
function customSkillMatches(s, keywords) {
    const kws = Array.isArray(keywords) ? keywords : parseKeywords(keywords);
    if (kws.length === 0) return true;
    return matchFields(kws, [s.name, s.id, s.type, s.desc, s.tags, s.sourceId, effectText(s.effects)]);
}

function filterCustomSkills() {
    renderCustomSkillTagFilterBar();
    const searchEl = document.getElementById('customSkillSearchInput');
    if (!searchEl) return;
    const keywords = parseKeywords(searchEl.value);
    const typeFilter = document.getElementById('customSkillTypeFilter') ? document.getElementById('customSkillTypeFilter').value : '';
    const tagFilter = tagFilterState.custom || [];
    const filtered = customSkillData.filter(s => {
        if (typeFilter && (s.type || '未分类') !== typeFilter) return false;
        if (tagFilter.length > 0) {
            const t = s.tags;
            if (!t) return false;
            // 必须同时包含所有选中标签 (AND)：每个选中标签命中 main 或 normal 之一
            const matched = tagFilter.every(tag => t.main === tag || (t.normal || []).includes(tag));
            if (!matched) return false;
        }
        return customSkillMatches(s, keywords);
    });
    renderCustomSkills(filtered);
}

function updateCustomSkillTypeFilter() {
    const select = document.getElementById('customSkillTypeFilter');
    if (!select) return;
    const currentVal = select.value;
    const types = [...new Set(customSkillData.map(s => s.type || '未分类'))].sort();
    select.innerHTML = '<option value="">全部类型</option>' + types.map(t => `<option value="${t}">${t}</option>`).join('');
    if (types.includes(currentVal)) select.value = currentVal;
}

function toggleCustomSkillTypeGroup(type) {
    const el = document.getElementById('custom-skill-type-group-' + type);
    if (!el) return;
    const isCollapsed = el.classList.contains('collapsed');
    if (isCollapsed) {
        el.classList.remove('collapsed');
        el.classList.add('expanded');
    } else {
        el.classList.remove('expanded');
        el.classList.add('collapsed');
    }
    const icon = el.querySelector('.equipment-type-toggle-icon');
    if (icon) icon.textContent = isCollapsed ? '▼' : '▶';
}

// 新增技能弹窗 - 支持从战斗数据中选择






function openCustomSkillDetail(id) {
    const skill = customSkillData.find(s => s.id === id);
    if (!skill) return;

    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = `
        <div class="detail-header" style="border-bottom-color:#e67e22">
            <div class="detail-icon" style="background:#e67e2220;color:#e67e22;font-size:36px;width:64px;height:64px;display:flex;align-items:center;justify-content:center;border-radius:12px;position:relative;overflow:hidden">${skill.icon ? `<img class="card-icon" src="${DATA_BASE}icon/${skill.icon}.webp" alt="" onerror="this.style.display='none'">` : ''}🏹</div>
            <div style="flex:1">
                <h2 class="detail-name">${skill.name}</h2>
                ${renderSkillTags(skill.tags)}
            </div>
        </div>

        ${skill.desc ? `
        <div class="detail-section">
            <h3 class="detail-section-title">技能效果描述</h3>
            <p class="detail-desc-text">${skill.desc.replace(/</g, '&lt;').replace(/\n/g, '<br>')}</p>
        </div>
        ` : ''}

        ${(() => {
            const v = videoData.find(v => v.name === skill.name) || null;
            return v
                ? `<div class="detail-section">
                    <h3 class="detail-section-title">技能演示</h3>
                    <video src="${DATA_BASE}videos/${encodeURIComponent(v.file)}" controls autoplay playsinline class="skill-video-modal-player"></video>
                </div>`
                : `<div class="detail-section">
                    <h3 class="detail-section-title">技能演示</h3>
                    <p class="detail-desc-text">暂无视频</p>
                </div>`;
        })()}

        <div class="equipment-form-actions">
            <button class="equipment-btn equipment-btn-cancel" onclick="closeModal()">关闭</button>
        </div>
    `;
    document.getElementById('skillModal').classList.add('active');
}













function updateCustomSkillNavCount() {
    const el = document.getElementById('customSkillCount');
    if (el) el.textContent = customSkillData.length;
    const el2 = document.getElementById('customSkillTotalCount');
    if (el2) el2.textContent = customSkillData.length;
}


// ============================================================
// 属性系统渲染
// ============================================================
const attrCategories = [
    { key: "基础属性", icon: "🔧", color: "#27ae60", desc: "角色基础属性" },
    { key: "特殊属性", icon: "⚡", color: "#e74c3c", desc: "特殊属性类型" }
];

function getAttrColor(category) {
    const cat = attrCategories.find(c => c.key === category);
    return cat ? cat.color : "#7f8c8d";
}

function getAttrIcon(category) {
    const cat = attrCategories.find(c => c.key === category);
    return cat ? cat.icon : "📋";
}

function renderAttributes(filteredAttrs = attributes) {
    const grid = document.getElementById('attrGrid');
    if (!grid) return;

    if (filteredAttrs.length === 0) {
        grid.innerHTML = '<div class="empty-state">无匹配属性</div>';
        return;
    }

    // 按分类分组
    const grouped = {};
    filteredAttrs.forEach(a => {
        if (!grouped[a.category]) grouped[a.category] = [];
        grouped[a.category].push(a);
    });

    let html = '';
    attrCategories.forEach(cat => {
        const items = grouped[cat.key];
        if (!items || items.length === 0) return;
        const color = cat.color;
        html += `
            <div class="affix-category-section">
                <div class="affix-cat-header" style="border-left-color:${color}">
                    <div class="affix-cat-icon" style="background:${color}20">${cat.icon}</div>
                    <div class="affix-cat-info">
                        <h3 class="affix-cat-title" style="color:${color}">${cat.key}</h3>
                        <p class="affix-cat-desc">${cat.desc}</p>
                    </div>
                    <span class="affix-cat-count" style="background:${color}20;color:${color}">${items.length}</span>
                </div>
                <div class="affix-cat-grid">
                    ${items.map(a => {
                        const icon = getAttrIcon(a.category);
                        const aColor = getAttrColor(a.category);
                        return `
                            <div class="affix-card" style="border-left-color:${aColor}" onclick="showAttrDetail('${a.id}')">
                                <div class="affix-header">
                                    <div class="affix-icon" style="background:${aColor}20">${icon}</div>
                                    <div>
                                        <div class="affix-name">${a.name}</div>
                                        <div class="affix-id">${a.id}</div>
                                    </div>
                                </div>
                                <span class="affix-tag" style="background:${aColor}15;color:${aColor}">${a.category}</span>
                                <p class="affix-desc">${a.description}</p>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    });

    // 兜底：显示不在预定义分类中的属性
    const knownAttrCats = attrCategories.map(c => c.key);
    const otherAttrs = filteredAttrs.filter(a => !knownAttrCats.includes(a.category));
    if (otherAttrs.length > 0) {
        html += `
            <div class="affix-category-section">
                <div class="affix-cat-header" style="border-left-color:#7f8c8d">
                    <div class="affix-cat-icon" style="background:#7f8c8d20">📋</div>
                    <div class="affix-cat-info">
                        <h3 class="affix-cat-title" style="color:#7f8c8d">其他属性</h3>
                        <p class="affix-cat-desc">未分类的属性</p>
                    </div>
                    <span class="affix-cat-count" style="background:#7f8c8d20;color:#7f8c8d">${otherAttrs.length}</span>
                </div>
                <div class="affix-cat-grid">
                    ${otherAttrs.map(a => {
                        return `
                            <div class="affix-card" style="border-left-color:#7f8c8d" onclick="showAttrDetail('${a.id}')">
                                <div class="affix-header">
                                    <div class="affix-icon" style="background:#7f8c8d20">📋</div>
                                    <div>
                                        <div class="affix-name">${a.name}</div>
                                        <div class="affix-id">${a.id}</div>
                                    </div>
                                </div>
                                <span class="affix-tag" style="background:#7f8c8d15;color:#7f8c8d">${a.category}</span>
                                <p class="affix-desc">${a.description}</p>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    grid.innerHTML = html;
    const countEl = document.getElementById('attrTotalCount');
    if (countEl) countEl.textContent = filteredAttrs.length;
}

function filterAttributes() {
    const catEl = document.getElementById('attrCategoryFilter');
    const searchEl = document.getElementById('attrSearchInput');
    if (!catEl || !searchEl) return;
    const cat = catEl.value;
    const keywords = parseKeywords(searchEl.value);
    let filtered = attributes;
    if (cat) filtered = filtered.filter(a => a.category === cat);
    // 统一搜索: 名称 / ID / 分类 / 描述 (补齐描述字段)
    filtered = filtered.filter(a => matchFields(keywords, [a.name, a.id, a.category, a.description, a.desc]));
    renderAttributes(filtered);
}

function showAttrDetail(id) {
    const attr = attributes.find(a => a.id === id);
    if (!attr) return;
    const color = getAttrColor(attr.category);
    const icon = getAttrIcon(attr.category);
    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = `
        <div class="detail-header">
            <div class="skill-icon" style="background:${color}20">${icon}</div>
            <div>
                <div class="detail-name">${attr.name}</div>
                <div class="detail-type">
                    <span class="type-badge" style="background:${color}20;color:${color}">${attr.category}</span>
                </div>
            </div>
        </div>
        <div class="detail-section">
            <div class="detail-section-title">属性ID</div>
            <div class="detail-id-display">${attr.id}</div>
        </div>
        <div class="detail-section">
            <div class="detail-section-title">属性描述</div>
            <div class="detail-desc">${attr.description}</div>
        </div>
    `;
    document.getElementById('skillModal').classList.add('active');
}


// ---- HTML 转义 (数据内容插入模板前使用) ----
function esc(v) {
    return String(v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ============================================================
// ---- 刷新所有已渲染页面 (数据合并/导入后调用) ----
function refreshAllViews() {
    updateBattleDataCount();
    updateCustomSkillNavCount();
    renderHome();
    if (renderedPages.has('battle-data')) {
        renderTagFilterBar('active');
        renderTagFilterBar('passive');
        filterSkills('active');
        filterSkills('passive');
        filterAffixes();
        filterAttributes();
    }
    if (renderedPages.has('equipment')) filterEquipments();
    if (renderedPages.has('gems')) filterGems();
    if (renderedPages.has('custom-skills')) filterCustomSkills();
    if (renderedPages.has('occupations')) renderOccupations();
    if (renderedPages.has('pets')) initPetPage();
    if (renderedPages.has('others')) { renderCategoryTables(); renderStats(); }
}

// ---- 加载用户自定义技能 ----
function loadCustomSkills() {
    try {
        const saved = localStorage.getItem('chronicle_custom_skills');
        if (!saved) return;
        const custom = JSON.parse(saved);
        custom.forEach(item => {
            const type = item.type;
            delete item.type;
            if (type === 'active' && !activeSkills.find(s => s.id === item.id)) {
                activeSkills.push(item);
            } else if (type === 'passive' && !passiveSkills.find(s => s.id === item.id)) {
                passiveSkills.push(item);
            }
        });
    } catch (e) {
        console.warn('加载自定义技能失败:', e);
    }
}

// ---- 加载用户自定义词缀 ----
function loadCustomAffixes() {
    try {
        const saved = localStorage.getItem('chronicle_custom_affixes');
        if (!saved) return;
        const custom = JSON.parse(saved);
        custom.forEach(item => {
            if (!affixes.find(a => a.id === item.id)) {
                affixes.push(item);
            }
        });
    } catch (e) {
        console.warn('加载自定义词缀失败:', e);
    }
}

function init() {
    console.log('=== 初始化开始 ===');
    console.log('  自动导入数据:', window.__AUTO_IMPORT_DATA__ ? '已加载' : '未加载');

    // 初始页面为首页 (底图按首页逻辑展示)
    document.body.dataset.page = 'home';

    // 数据清空重建：清除所有旧缓存
    // 重要：如果有自动导入数据，不清除 localStorage（IIFE 刚刚保存了导入数据）
    const CLEAR_VERSION = 'v5_autoimport';
    const cleared = localStorage.getItem('chronicle_cleared_version');
    if (cleared !== CLEAR_VERSION) {
        if (!window.__AUTO_IMPORT_DATA__) {
            // 没有自动导入数据时才清除旧缓存
            console.log('  清除旧版本缓存数据...');
            localStorage.removeItem('chronicle_custom_skills');
            localStorage.removeItem('chronicle_custom_affixes');
            localStorage.removeItem('chronicle_affix_edits');
            localStorage.removeItem('chronicle_skill_edits');
        } else {
            console.log('  检测到自动导入数据，跳过缓存清除');
        }
        localStorage.setItem('chronicle_cleared_version', CLEAR_VERSION);
    }

    loadAffixEdits();
    loadSkillEdits();
    loadCustomSkills();
    loadCustomAffixes();

    // 自定义数据加载完成后重建索引 (技能/词缀/属性的查找与ID去重)
    rebuildRefIndex();
    rebuildSkillAffixIdSet();

    console.log('  数据统计: 主动=' + activeSkills.length, '被动=' + passiveSkills.length, '词缀=' + affixes.length, '属性=' + attributes.length, '装备=' + equipmentData.length, '技能库=' + customSkillData.length, '宝石=' + gemData.length, '职业=' + occupationData.length);

    updateCustomSkillNavCount();
    updateBattleDataCount();

    // 筛选栏搜索框统一挂载清空按钮
    initFilterClearButtons();

    // 仅渲染首页统计 (其余页面在首次进入时懒渲染, 见 ensurePageRendered)
    renderHome();

    console.log('=== 初始化完成 ===');
}


function updateBattleDataCount() {
    const el = document.getElementById('battleDataCount');
    if (el) el.textContent = activeSkills.length + passiveSkills.length + affixes.length + attributes.length;
    const el2 = document.getElementById('activeSkillCount');
    if (el2) el2.textContent = activeSkills.length;
    const el3 = document.getElementById('passiveSkillCount');
    if (el3) el3.textContent = passiveSkills.length;
    const el4 = document.getElementById('affixTabCount');
    if (el4) el4.textContent = affixes.length;
    const el5 = document.getElementById('attrTabCount');
    if (el5) el5.textContent = attributes.length;
}


// ============================================================
// 职业天赋系统
// 立绘与天赋点拆开展示: 立绘区在上, 天赋点列表在下
// ============================================================

let currentOccupationIdx = 0;

// 职业立绘配置: 职业名 → 立绘路径 (未配置的职业使用默认 talent-bg-character.webp)
const occupationBgMap = {
    '幻影魔典': 'assets/talent-bg-huanying.webp',
    '巫术魔典': 'assets/talent-bg-wushu.webp',
    '剑客1': 'assets/talent-bg-jianke.webp',
    '冰刃': 'assets/talent-bg-bingren.webp',
    '元素法杖': 'assets/talent-bg-yuansu.webp',
    '塑能法杖': 'assets/talent-bg-suneng.webp'
};

// 职业描述配置: 职业名 → 推荐武器 + 背景故事文案
const occupationDescMap = {
    '剑客1': { weapon: '太刀', text: '刀光一闪，胜负已分。我不求蛮力，只求快——快到敌人来不及眨眼。当你看清我的刀时，刀已归鞘。' },
    '冰刃': { weapon: '太刀', text: '极寒是我最忠实的伙伴。剑锋所过，霜雪蔓延，敌人尚未近身便已冻僵，而暴击，是寒冰送上的最后一击。' },
    '元素法杖': { weapon: '法杖', text: '五色法球环绕周身，那是我掌控的纯粹力量。注能满溢之时，一击出手，足以撼动山河。' },
    '幻影魔典': { weapon: '法杖', text: '你看到的，未必是真正的我。翻动之间，幻影四起，待你辨清真假，真正的杀机早已近在咫尺。' },
    '巫术魔典': { weapon: '魔典', text: '我不求一击致命，只求毒入骨髓。坩埚沸腾，毒雾弥漫，与我为敌者，终将在不知不觉中走到生命的尽头。' },
    '塑能法杖': { weapon: '法杖', text: '火球、旋风、飞弹，皆听我号令。无需近身，漫天弹幕之下，你甚至看不清我的身影，便已倒下。' }
};

function renderOccupations() {
    const tabsEl = document.getElementById('occupationTabs');
    const canvasArea = document.getElementById('occupationCanvasArea');
    const totalEl = document.getElementById('occupationTotalCount');
    if (!tabsEl || !canvasArea) return;

    if (occupationData.length === 0) {
        tabsEl.innerHTML = '';
        canvasArea.innerHTML = `
            <div class="occupation-empty">
                <p>暂无职业天赋数据</p>
                <p class="occupation-empty-hint">职业天赋数据仅由一键导入提供，请先运行一键导入</p>
            </div>
        `;
        if (totalEl) totalEl.textContent = '0';
        return;
    }

    if (totalEl) totalEl.textContent = occupationData.length;

    // 渲染职业 Tab 栏
    tabsEl.innerHTML = occupationData.map((occ, idx) => {
        const active = idx === currentOccupationIdx ? 'active' : '';
        return `<button class="occupation-tab ${active}" onclick="switchOccupation(${idx})">${occ.name}</button>`;
    }).join('');

    renderOccupationCanvas(currentOccupationIdx);
}

function switchOccupation(idx) {
    currentOccupationIdx = idx;
    document.querySelectorAll('.occupation-tab').forEach((tab, i) => {
        tab.classList.toggle('active', i === idx);
    });
    renderOccupationCanvas(idx);
}

function renderOccupationCanvas(idx) {
    const canvasArea = document.getElementById('occupationCanvasArea');
    if (!canvasArea || idx < 0 || idx >= occupationData.length) return;

    const occ = occupationData[idx];
    const allPoints = occ.talentPoints || [];
    // 只显示 size >= 2 的节点，size=1 节点作为中间跳板跳过
    const visiblePoints = allPoints.filter(p => p.size >= 2);

    // 立绘区: 角色立绘 + 职业名 + 推荐武器 + 背景故事（与天赋点拆开展示）
    const bgImage = occupationBgMap[occ.name] || 'assets/talent-bg-character.webp';
    const occDesc = occupationDescMap[occ.name];
    const heroHtml = `
        <div class="occupation-hero">
            <img class="occupation-hero-img" src="${bgImage}" alt="${occ.name}">
            <div class="occupation-hero-info">
                <h3 class="occupation-hero-name">${occ.name}</h3>
                ${occDesc ? `
                    <div class="occupation-hero-weapon"><span class="occupation-desc-label">推荐武器:</span> ${occDesc.weapon}</div>
                    <div class="occupation-hero-text">${occDesc.text}</div>
                ` : ''}
            </div>
        </div>
    `;

    // 天赋点结构图: 以 viewPos 定位节点, 以 linkPoint 建立连线
    const nodeMap = {};
    allPoints.forEach(p => { nodeMap[p.id] = p; });

    let maxX = -Infinity, maxY = -Infinity, minX = Infinity, minY = Infinity;
    visiblePoints.forEach(p => {
        if (p.viewPos) {
            maxX = Math.max(maxX, p.viewPos.x);
            maxY = Math.max(maxY, p.viewPos.y);
            minX = Math.min(minX, p.viewPos.x);
            minY = Math.min(minY, p.viewPos.y);
        }
    });

    const graphW = 375;
    const graphH = 812;
    const gPadTop = 55;
    const gPadBottom = 105;
    const gPadSide = 55;
    const rangeX = (maxX - minX) || 1;
    const rangeY = (maxY - minY) || 1;
    const scaleW = (graphW - gPadSide * 2) / rangeX;
    const scaleH = (graphH - gPadTop - gPadBottom) / rangeY;
    const scale = Math.min(scaleW, scaleH);
    const offsetX = (graphW - rangeX * scale) / 2;
    const offsetY = gPadTop + (graphH - gPadTop - gPadBottom - rangeY * scale) / 2;

    const posMap = {};
    allPoints.forEach(p => {
        posMap[p.id] = {
            x: offsetX + (p.viewPos.x - minX) * scale,
            y: offsetY + (maxY - p.viewPos.y) * scale
        };
    });

    function findVisibleTargets(linkId, visited) {
        if (visited.has(linkId)) return [];
        visited.add(linkId);
        const node = nodeMap[linkId];
        if (!node) return [];
        if (node.size >= 2) return [linkId];
        const results = [];
        (node.linkPoint || '').split('|').forEach(tid => {
            const t = tid.trim();
            if (t) results.push(...findVisibleTargets(t, visited));
        });
        return results;
    }

    const drawn = new Set();
    const lines = [];
    visiblePoints.forEach(p => {
        if (!p.linkPoint) return;
        const src = posMap[p.id];
        if (!src) return;
        p.linkPoint.split('|').forEach(rawId => {
            const tid = rawId.trim();
            if (!tid) return;
            let targets = [];
            if (posMap[tid] && nodeMap[tid] && nodeMap[tid].size >= 2) {
                targets = [tid];
            } else {
                targets = findVisibleTargets(tid, new Set([p.id]));
            }
            targets.forEach(targetId => {
                if (targetId === p.id) return;
                const key = [p.id, targetId].sort().join('\u2192');
                if (drawn.has(key)) return;
                drawn.add(key);
                const tgt = posMap[targetId];
                if (!tgt) return;
                lines.push(`<line x1="${src.x.toFixed(1)}" y1="${src.y.toFixed(1)}" x2="${tgt.x.toFixed(1)}" y2="${tgt.y.toFixed(1)}" class="talent-link-line" />`);
            });
        });
    });
    const linksSvg = lines.length
        ? `<svg class="talent-links-svg" width="${graphW}" height="${graphH}">${lines.join('')}</svg>`
        : '';

    const graphPointsHtml = visiblePoints.map(p => {
        const pos = posMap[p.id];
        const sizeClass = p.size === 2 ? 'talent-point-large' : (p.size === 3 ? 'talent-point-xlarge' : '');
        const iconChar = p.icon || '⭐';
        const iconHtml = p.iconSrc
            ? `<img class="talent-point-img" src="${DATA_BASE}icon/${p.iconSrc}.webp" alt="${p.name}" onerror="this.style.display='none';this.nextSibling.style.display=''"><span class="talent-point-icon" style="display:none">${iconChar}</span>`
            : `<span class="talent-point-icon">${iconChar}</span>`;
        const shortDesc = p.name || '';
        return `
            <div class="talent-point ${sizeClass}" style="left:${pos.x}px;top:${pos.y}px"
                 onclick="showTalentDetail('${p.id}', ${idx})">${iconHtml}</div>
            ${shortDesc ? `<div class="talent-point-label" style="left:${pos.x}px;top:${pos.y}px">${shortDesc}</div>` : ''}
        `;
    }).join('');

    const graphHtml = `
        <div class="occupation-graph">
            <h4 class="occupation-graph-title">天赋结构图</h4>
            <div class="occupation-graph-canvas" style="width:${graphW}px;height:${graphH}px">
                ${linksSvg}
                ${graphPointsHtml}
            </div>
        </div>
    `;

    // 天赋点列表区: 每个节点独立列出 (图标 + 名称 + 描述)
    const nodesHtml = visiblePoints.map(p => {
        const iconChar = p.icon || '⭐';
        const iconHtml = p.iconSrc
            ? `<img class="passive-node-icon-img" src="${DATA_BASE}icon/${p.iconSrc}.webp" alt="${p.name}" onerror="this.style.display='none';this.nextSibling.style.display=''"><span class="passive-node-icon-emoji" style="display:none">${iconChar}</span>`
            : `<span class="passive-node-icon-emoji">${iconChar}</span>`;
        return `
            <div class="passive-node" onclick="showTalentDetail('${p.id}', ${idx})">
                <div class="passive-node-icon">${iconHtml}</div>
                <div class="passive-node-info">
                    <div class="passive-node-name">${p.name}</div>
                    ${p.desc ? `<div class="passive-node-desc">${p.desc}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');

    canvasArea.innerHTML = `
        <div class="occupation-detail">
            ${heroHtml}
            ${graphHtml}
            <div class="occupation-passives">
                ${nodesHtml || '<div class="occupation-empty"><p>暂无天赋点</p></div>'}
            </div>
        </div>
    `;
}

function showTalentDetail(pointId, occIdx) {
    const occ = occupationData[occIdx];
    if (!occ) return;
    const point = (occ.talentPoints || []).find(p => p.id === pointId);
    if (!point) return;

    const modal = document.getElementById('skillModal');
    const body = document.getElementById('modalBody');
    if (!modal || !body) return;

    body.innerHTML = `
        <div class="talent-detail">
            <h2 class="detail-name">${point.name}</h2>
            <div class="talent-detail-meta">
                <span class="type-badge">${occ.name}</span>
                <span class="type-badge-sub">ID: ${point.id}</span>
                <span class="type-badge-sub">坐标: ${point.viewPos.x}, ${point.viewPos.y}</span>
                ${point.size && point.size > 1 ? `<span class="type-badge-sub">节点大小: ${point.size}</span>` : ''}
            </div>
            ${point.desc ? `<p class="detail-desc-text">${point.desc}</p>` : ''}
            ${point.linkPoint ? `<div class="talent-detail-links"><span class="type-badge-sub">关联节点: ${point.linkPoint}</span></div>` : ''}
        </div>
    `;
    modal.classList.add('active');
}

// ============================================================
// 技能演示视频 (videos/ 文件夹: 以技能名称命名的视频文件)
// 清单来源: 一键导入自动扫描 videos/ 生成 (auto-import-data.js videos 字段)
// 无清单时使用 data.js 内置默认清单兜底
// 技能卡片底部展示视频预览，点击后弹窗放大播放
// ============================================================

// 打开技能演示视频弹窗
function openSkillVideo(file, name) {
    const modal = document.getElementById('skillModal');
    const body = document.getElementById('modalBody');
    if (!modal || !body) return;
    body.innerHTML = `
        <div class="skill-video-modal">
            <h2 class="detail-name">🎬 ${name}</h2>
            <video src="${DATA_BASE}videos/${file}" controls autoplay playsinline class="skill-video-modal-player"></video>
        </div>
    `;
    modal.classList.add('active');
}

// ============================================================
// 魔宠系统 (魔宠表 Pet / PetStar 子表)
// 品质: 3-蓝, 4-紫, 6-橙, 8-红; 其余(如5)按金色展示
// 星级效果: skillAffix→词缀库, stunt→被动技能, attr→属性库 (findRefData 匹配)
// ============================================================

// 品质映射表
const petQualityMap = {
    '3': { name: '蓝', color: '#3b82f6' },
    '4': { name: '紫', color: '#a855f7' },
    '5': { name: '金', color: '#d4a056' },
    '6': { name: '橙', color: '#f97316' },
    '8': { name: '红', color: '#ef4444' }
};

function getPetQuality(q) {
    return petQualityMap[String(q)] || { name: '未知', color: '#95a5a6' };
}

// 数值格式化: 小数转百分比, 整数原样
function fmtPetValue(v) {
    if (v === null || v === undefined || v === '') return '';
    const n = Number(v);
    if (isNaN(n)) return String(v);
    if (Number.isInteger(n) && n >= 1) return '+' + n;
    const pct = (n * 100).toFixed(2).replace(/\.?0+$/, '');
    return '+' + pct + '%';
}

// 按 ID 匹配战斗数据效果名称 (findRefData 跨 主动/被动/词缀/属性 查询)
function petEffectName(id) {
    const ref = findRefData(String(id));
    if (!ref) return '';
    return ref.name || ref.desc || '';
}

// 星级全部效果的检索文本 (skillAffix/stunt/attr 的 ID + 对应效果名称)
function petStarEffectText(pet) {
    const out = [];
    (pet.stars || []).forEach(st => {
        (st.skillAffix || []).forEach(a => out.push(a.id, petEffectName(a.id)));
        (st.stunt || []).forEach(id => out.push(id, petEffectName(id)));
        (st.attr || []).forEach(a => out.push(a.id, petEffectName(a.id)));
    });
    return out;
}

// 星级效果渲染: 返回效果标签 HTML
function renderPetStarEffects(star) {
    const parts = [];
    (star.skillAffix || []).forEach(a => {
        const name = petEffectName(a.id);
        if (!name) return;
        parts.push(`<span class="pet-effect pet-effect-affix">${name} ${fmtPetValue(a.value)}</span>`);
    });
    (star.stunt || []).forEach(id => {
        const name = petEffectName(id);
        if (!name) return;
        parts.push(`<span class="pet-effect pet-effect-stunt">${name}</span>`);
    });
    (star.attr || []).forEach(a => {
        const name = petEffectName(a.id);
        if (!name) return;
        parts.push(`<span class="pet-effect pet-effect-attr">${name} ${fmtPetValue(a.value)}</span>`);
    });
    return parts.join('');
}

// 初始化魔宠页 (品质下拉 + 渲染)
function initPetPage() {
    const qFilter = document.getElementById('petQualityFilter');
    if (qFilter) {
        const qs = new Set(petData.map(p => String(p.quality)));
        const opts = ['<option value="">全部品质</option>'];
        [...qs].sort().forEach(q => {
            const info = getPetQuality(q);
            opts.push(`<option value="${q}">${info.name} (${q})</option>`);
        });
        qFilter.innerHTML = opts.join('');
    }
    filterPets();
}

// 筛选并渲染魔宠卡片
function filterPets() {
    const grid = document.getElementById('petGrid');
    if (!grid) return;
    const keywords = parseKeywords(((document.getElementById('petSearchInput') || {}).value || ''));
    const qFilter = ((document.getElementById('petQualityFilter') || {}).value || '').trim();

    let list = petData;
    if (keywords.length > 0) {
        // 统一搜索: 名称 / ID / 品质 / 星级效果 (词缀、特技、属性的 ID 与效果名称)
        list = list.filter(p => matchFields(keywords, [p.name, p.id, p.quality, getPetQuality(p.quality).name, petStarEffectText(p)]));
    }
    if (qFilter) {
        list = list.filter(p => String(p.quality) === qFilter);
    }
    // 默认按品质排序: 品级数值越大越靠前 (红 > 橙 > 紫 > 蓝)
    list = list.slice().sort((a, b) => (Number(b.quality) || 0) - (Number(a.quality) || 0));

    const totalEl = document.getElementById('petTotalCount');
    if (totalEl) totalEl.textContent = petData.length;

    if (list.length === 0) {
        grid.innerHTML = `
            <div class="equipment-empty">
                <div class="equipment-empty-icon">🐾</div>
                <p>${petData.length === 0 ? '暂无魔宠数据' : '未找到匹配的魔宠'}</p>
                <p class="equipment-empty-hint">${petData.length === 0 ? '请运行一键导入收录魔宠表数据' : '尝试其他搜索关键词'}</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = list.map(p => {
        const q = getPetQuality(p.quality);
        const hasPic = p.pic ? DATA_BASE + 'icon/' + p.pic + '.webp' : '';
        const hasBg = p.getBg ? DATA_BASE + 'icon/' + p.getBg + '.webp' : '';
        const hasGetPic = p.getPic ? DATA_BASE + 'icon/' + p.getPic + '.webp' : '';
        const starCount = (p.stars || []).length;
        // 展示区: 仅当配置了立绘+背景时展示 (背景图铺底, 立绘图居中叠加在上, 点击查看原图)
        let showcaseHtml = '';
        if (hasBg || hasGetPic) {
            const showcaseClick = `onclick="openPetShowcase('${hasGetPic}','${hasBg}','${(p.name || '').replace(/'/g, "\\'")}')"`;
            showcaseHtml = `
                <div class="pet-showcase" ${showcaseClick}>
                    ${hasBg ? `<img class="pet-showcase-bg" src="${hasBg}" alt="" onerror="this.style.display='none'">` : ''}
                    ${hasGetPic ? `<img class="pet-showcase-pic" src="${hasGetPic}" alt="${p.name}" onerror="this.style.display='none'">` : ''}
                </div>
            `;
        }
        return `
            <div class="pet-card" style="border-color:${q.color}66">
                <div class="pet-card-top">
                    <div class="pet-avatar${hasPic ? ' pet-avatar-clickable' : ''}" style="background:${q.color}18;border-color:${q.color}88" ${hasPic ? `onclick="openPetAvatar('${hasPic}','${(p.name || '').replace(/'/g, "\\'")}')"` : ''}>
                        ${hasPic ? `<img src="${hasPic}" alt="${p.name}" onerror="this.style.display='none'">` : '<span class="pet-avatar-fallback">🐾</span>'}
                    </div>
                    <div class="pet-info">
                        <h4 class="pet-name">${p.name}</h4>
                        <div class="pet-meta">
                            <span class="pet-quality" style="background:${q.color};color:#fff">${q.name}</span>
                            <span class="pet-id">ID: ${p.id}</span>
                        </div>
                    </div>
                </div>
                <div class="pet-stars">
                    <div class="pet-star-left">
                        ${starCount > 0 ? `
                            <div class="pet-stars-title">⭐ 星级效果 (${starCount} 档)</div>
                            <div class="pet-star-tabs">
                                ${(p.stars || []).map((s, i) => `
                                    <button class="pet-star-tab${i === 0 ? ' active' : ''}" onclick="switchPetStar(this, ${i})">${s.star === 0 ? '初始' : s.star + '星'}</button>
                                `).join('')}
                            </div>
                            <div class="pet-star-panels">
                                ${(p.stars || []).map((s, i) => {
                                    const eff = renderPetStarEffects(s);
                                    return `
                                        <div class="pet-star-panel${i === 0 ? ' active' : ''}">
                                            ${eff || '<span class="pet-star-empty">无效果</span>'}
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        ` : '<div class="pet-stars-empty">暂无星级效果</div>'}
                    </div>
                    ${showcaseHtml}
                </div>
            </div>
        `;
    }).join('');
}

// 切换魔宠星级效果 (点击星级标签时仅显示对应星级的效果)
function switchPetStar(btn, idx) {
    const card = btn.closest('.pet-card');
    if (!card) return;
    card.querySelectorAll('.pet-star-tab').forEach((t, i) => t.classList.toggle('active', i === idx));
    card.querySelectorAll('.pet-star-panel').forEach((p, i) => p.classList.toggle('active', i === idx));
}

// 打开魔宠头像原图弹窗 (单图居中展示)
function openPetAvatar(src, name) {
    const modal = document.getElementById('skillModal');
    const body = document.getElementById('modalBody');
    if (!modal || !body) return;
    body.innerHTML = `
        <div class="pet-pic-modal">
            <h2 class="detail-name">🐾 ${name}</h2>
            <img class="pet-pic-single" src="${src}" alt="${name}" onerror="this.outerHTML='<p class=equipment-empty>图片加载失败</p>'">
        </div>
    `;
    modal.classList.add('active');
}

// 打开魔宠展示区原图弹窗 (背景+立绘叠加展示, 背景在下立绘居中在上)
function openPetShowcase(picSrc, bgSrc, name) {
    const modal = document.getElementById('skillModal');
    const body = document.getElementById('modalBody');
    if (!modal || !body) return;
    body.innerHTML = `
        <div class="pet-pic-modal">
            <h2 class="detail-name">🐾 ${name}</h2>
            <div class="pet-showcase-modal">
                ${bgSrc ? `<img class="pet-showcase-modal-bg" src="${bgSrc}" alt="" onerror="this.style.display='none'">` : ''}
                ${picSrc ? `<img class="pet-showcase-modal-pic" src="${picSrc}" alt="${name}" onerror="this.outerHTML='<p class=equipment-empty>图片加载失败</p>'">` : ''}
            </div>
        </div>
    `;
    modal.classList.add('active');
}

// ============================================================
// 三库（装备库/辅助技能宝石/技能库）数据仅由一键导入提供，只读展示。
// 首页新增功能产生的数据请存放于独立 localStorage key，勿与导入数据冲突。
// ============================================================

document.addEventListener('DOMContentLoaded', init);
