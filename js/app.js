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

function navigateTo(pageName) {
    pages.forEach(p => p.classList.remove('active'));
    navLinks.forEach(l => l.classList.remove('active'));

    const targetPage = document.getElementById(`page-${pageName}`);
    const targetLink = document.querySelector(`[data-page="${pageName}"]`);

    if (targetPage) targetPage.classList.add('active');
    if (targetLink) targetLink.classList.add('active');

    // 记录当前页面: 首页使用首页底图, 非首页使用通用底图
    document.body.dataset.page = pageName;

    // 技能库页渲染标签筛选栏 (filterCustomSkills 内部会同步渲染)
    if (pageName === 'custom-skills') {
        filterCustomSkills();
    }

    // 职业天赋页渲染
    if (pageName === 'occupations') {
        renderOccupations();
    }

    // 魔宠页渲染
    if (pageName === 'pets') {
        initPetPage();
    }

    // 其他页: 确保统计面板数据已渲染 (ID规则面板在 init 时已填充)
    if (pageName === 'others') {
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

    // 计算每个标签独立匹配的技能数量 (考虑搜索/类型筛选，不考虑标签筛选)
    const tagCounts = {};
    tags.forEach(tag => {
        tagCounts[tag] = customSkillData.filter(s => {
            if (!s.tags) return false;
            const hasTag = s.tags.main === tag || (s.tags.normal || []).includes(tag);
            if (!hasTag) return false;
            if (typeFilter && (s.type || '未分类') !== typeFilter) return false;
            if (search) {
                const inName = s.name && s.name.toLowerCase().includes(search);
                const inId = (s.id || '').toLowerCase().includes(search);
                const inType = s.type && s.type.toLowerCase().includes(search);
                const inDesc = s.desc && s.desc.toLowerCase().includes(search);
                const inEffect = (s.effects || []).some(e => e.refId && e.refId.includes(search));
                return inName || inId || inType || inDesc || inEffect;
            }
            return true;
        }).length;
    });

    const btn = (tag, label) => {
        const active = tag === '' ? current.length === 0 : current.includes(tag);
        const esc = String(tag).replace(/'/g, "\\'");
        const countBadge = (active && tag !== '') ? `<span class="tag-filter-count">${tagCounts[tag] || 0}</span>` : '';
        return `<button class="tag-filter-btn${active ? ' active' : ''}" style="${active ? 'background:#e67e22;border-color:#e67e22;color:#fff' : ''}" onclick="setCustomSkillTagFilter('${esc}')">${label}${countBadge}</button>`;
    };

    // 分隔符 (mainTag 和 normalTag 之间)
    const separator = mainTags.length > 0 && normalTags.length > 0 ? '<span class="tag-filter-sep">|</span>' : '';

    bar.innerHTML = `
        <div class="tag-filter-bar-inner">
            <span class="tag-filter-label">标签(可多选):</span>
            ${btn('', '全部')}
            ${mainTags.map(t => btn(t, t)).join('')}
            ${separator}
            ${normalTags.map(t => btn(t, t)).join('')}
        </div>
    `;
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
        ? `<span class="skill-icon" style="background:${color}20;color:${color}"><img class="card-icon" src="icon/${skill.icon}.png" alt="" onerror="this.style.display='none'">${icon}</span>`
        : `<span class="skill-icon" style="background:${color}20;color:${color}">${icon}</span>`;

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
            <div class="skill-card-id-segments">
                <span class="id-seg seg-a">A=${parsed.A}</span>
                <span class="id-seg">B=${parsed.B}</span>
                <span class="id-seg">C=${parsed.C}</span>
                <span class="id-seg">D=${parsed.D}</span>
                <span class="id-seg">E=${parsed.E}</span>
                <span class="id-seg">F=${parsed.seq}</span>
                <span class="id-seg">G=${parsed.G}</span>
            </div>
        </div>
    `;
}

// ---- 渲染主动技能列表 ----
function renderActiveSkills(skills = activeSkills) {
    const grid = document.getElementById('activeSkillGrid');
    if (skills.length === 0) {
        grid.innerHTML = '<div class="empty-state">未找到匹配的技能</div>';
        return;
    }
    grid.innerHTML = skills.map(s => renderSkillCard(s, 'active')).join('');
    document.getElementById('activeSkillCount').textContent = skills.length;
}

// ---- 渲染被动技能列表 ----
function renderPassiveSkills(skills = passiveSkills) {
    const grid = document.getElementById('passiveSkillGrid');
    if (skills.length === 0) {
        grid.innerHTML = '<div class="empty-state">未找到匹配的技能</div>';
        return;
    }
    grid.innerHTML = skills.map(s => renderSkillCard(s, 'passive')).join('');
    document.getElementById('passiveSkillCount').textContent = skills.length;
}

// ---- 筛选技能 ----
function filterSkills(type) {
    const skills = type === 'active' ? activeSkills : passiveSkills;
    const catEl = document.getElementById(`${type}CategoryFilter`);
    const searchEl = document.getElementById(`${type}SearchInput`);
    if (!catEl || !searchEl) return;

    const categoryFilter = catEl.value;
    const searchInput = searchEl.value.toLowerCase();
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
        if (searchInput) {
            const matchName = s.name.toLowerCase().includes(searchInput);
            const matchId = s.id.includes(searchInput);
            const matchCat = s.category.toLowerCase().includes(searchInput);
            if (!matchName && !matchId && !matchCat) return false;
        }
        return true;
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

// ---- 全局搜索 ----
document.getElementById('globalSearch').addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    if (!query) return;

    // 搜索主动和被动技能
    const activeResults = activeSkills.filter(s =>
        s.name.toLowerCase().includes(query) || s.id.includes(query)
    );
    const passiveResults = passiveSkills.filter(s =>
        s.name.toLowerCase().includes(query) || s.id.includes(query)
    );

    if (activeResults.length > 0) {
        navigateTo('battle-data');
        switchBattleTab('active');
        document.getElementById('activeSearchInput').value = e.target.value;
        renderActiveSkills(activeResults);
    } else if (passiveResults.length > 0) {
        navigateTo('battle-data');
        switchBattleTab('passive');
        document.getElementById('passiveSearchInput').value = e.target.value;
        renderPassiveSkills(passiveResults);
    }
});

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
            <div class="detail-icon" style="background:${color}20;color:${color};font-size:36px;width:64px;height:64px;display:flex;align-items:center;justify-content:center;border-radius:12px;position:relative;overflow:hidden">${skill.icon ? `<img class="card-icon" src="icon/${skill.icon}.png" alt="" onerror="this.style.display='none'">` : ''}${icon}</div>
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

function onSkillEdit(id, field, value) {
    const allSkills = [...activeSkills, ...passiveSkills];
    saveEdit(SKILL_EDIT_KEY, allSkills, id, field, value);
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
    const skill = [...activeSkills, ...passiveSkills].find(s => s.id === id);
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
    const searchInput = searchEl.value.toLowerCase();

    const filtered = affixes.filter(a => {
        if (categoryFilter && a.category !== categoryFilter) return false;
        if (searchInput) {
            const matchName = a.name.toLowerCase().includes(searchInput);
            const matchId = a.id.includes(searchInput);
            const matchSub = a.subCategory.toLowerCase().includes(searchInput);
            if (!matchName && !matchId && !matchSub) return false;
        }
        return true;
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
        const effectCount = effects.length;
        const effectItems = effects.map(eff => {
            const refData = findRefData(eff.refId);
            const typeColor = refData ? (refData.type === 'active-skill' ? '#e74c3c' : refData.type === 'passive-skill' ? '#3498db' : refData.type === 'attribute' ? '#27ae60' : '#f39c12') : '#e74c3c';
            const typeLabel = refData ? (refData.type === 'active-skill' ? '主动' : refData.type === 'passive-skill' ? '被动' : refData.type === 'attribute' ? '属性' : '词缀') : '未知';
            return `
                <div class="equipment-card-effect" style="border-left-color:${typeColor}">
                    <span class="equipment-card-effect-type" style="background:${typeColor}20;color:${typeColor}">${typeLabel}</span>
                    <span class="equipment-card-effect-name">${refData ? refData.name : eff.refId}</span>
                    <p class="equipment-card-effect-desc">${refData ? refData.desc : '⚠ 未找到ID: ' + eff.refId}</p>
                </div>
            `;
        }).join('');
        const passives = (eq.passiveEffects || []).filter(e => e.refId);
        const passiveItems = passives.map(eff => {
            const refData = findRefData(eff.refId);
            return `
                <div class="equipment-card-effect" style="border-left-color:#3498db">
                    <span class="equipment-card-effect-type" style="background:#3498db20;color:#3498db">被动</span>
                    <span class="equipment-card-effect-name">${refData ? refData.name : eff.refId}</span>
                    <p class="equipment-card-effect-desc">${refData ? refData.desc : '⚠ 未找到ID: ' + eff.refId}</p>
                </div>
            `;
        }).join('');
        return `
            <div class="equipment-card" data-equipment-id="${eq.id}" onclick="openEquipmentDetail('${eq.id}')">
                <div class="equipment-card-header">
                    <span class="equipment-card-icon" style="background:${style.color}18">${eq.icon ? `<img class="card-icon" src="icon/${eq.icon}.png" alt="" onerror="this.style.display='none'">` : ''}${style.icon}</span>
                    <div>
                        <h4 class="equipment-card-name">${eq.name}</h4>
                        <span class="equipment-card-id">${eq.id}</span>
                    </div>
                </div>
                <span class="equipment-card-type">${eq.type || '未分类'}</span>
                <div class="item-stats">
                    <div class="item-stats-cell"><span class="item-stats-label">词缀数</span><span class="item-stats-value">${effectCount} 条</span></div>
                    ${passives.length > 0 ? `<div class="item-stats-cell"><span class="item-stats-label">被动</span><span class="item-stats-value">${passives.length} 条</span></div>` : ''}
                    <div class="item-stats-cell"><span class="item-stats-label">装备ID</span><span class="item-stats-value">${eq.id}</span></div>
                </div>
                <div class="equipment-card-effects">
                    <span class="equipment-effect-count">效果 (${effectCount} 条)${passives.length > 0 ? ' · 被动 (' + passives.length + ' 条)' : ''}</span>
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
    const search = document.getElementById('equipmentSearchInput').value.toLowerCase();
    const typeFilter = document.getElementById('equipmentTypeFilter') ? document.getElementById('equipmentTypeFilter').value : '';
    const filtered = equipmentData.filter(eq => {
        if (typeFilter && (eq.type || '未分类') !== typeFilter) return false;
        if (!search) return true;
        if (eq.name.toLowerCase().includes(search)) return true;
        if (eq.id.toLowerCase().includes(search)) return true;
        if (eq.type && eq.type.toLowerCase().includes(search)) return true;
        const hasEffect = (eq.effects || []).some(e => e.refId && e.refId.includes(search));
        if (hasEffect) return true;
        return false;
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











function openEquipmentDetail(id) {
    const eq = equipmentData.find(e => e.id === id);
    if (!eq) return;
    if (!eq.effects) eq.effects = [];
    const effects = eq.effects;

    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = `
        <div class="detail-header" style="border-bottom-color:#9b59b6">
            <div class="detail-icon" style="background:#9b59b620;color:#9b59b6;font-size:36px;width:64px;height:64px;display:flex;align-items:center;justify-content:center;border-radius:12px;position:relative;overflow:hidden">${eq.icon ? `<img class="card-icon" src="icon/${eq.icon}.png" alt="" onerror="this.style.display='none'">` : ''}📦</div>
            <div style="flex:1">
                <h2 class="detail-name">${eq.name}</h2>
                <div class="detail-type">
                    <span class="type-badge" style="background:#9b59b620;color:#9b59b6">装备系统</span>
                    <span class="type-badge-sub">${eq.id}</span>
                    <span class="type-badge-sub">${eq.type || '未分类'}</span>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <h3 class="detail-section-title">装备效果（${effects.filter(e => e.refId).length} 条）</h3>
            <div id="equipmentEffectList">
            ${effects.length === 0 ? '<p class="empty-hint">暂无效果</p>' : ''}
            ${effects.map((eff, idx) => {
                const refData = eff.refId ? findRefData(eff.refId) : null;
                const typeColor = refData ? (refData.type === 'active-skill' ? '#e74c3c' : refData.type === 'passive-skill' ? '#3498db' : refData.type === 'attribute' ? '#27ae60' : '#f39c12') : '#bbb';
                const typeLabel = refData ? (refData.type === 'active-skill' ? '主动技能' : refData.type === 'passive-skill' ? '被动技能' : refData.type === 'attribute' ? '属性效果' : '词缀') : '待填写';
                return `
                    <div class="equipment-effect-item" style="border-left-color:${typeColor}">
                        <div class="equipment-effect-header">
                            <span class="effect-type-badge" style="background:${typeColor}20;color:${typeColor}">${typeLabel}</span>
                            <span class="effect-ref-id">${eff.refId || '—'}</span>
                        </div>
                        ${refData ? `
                            <div class="equipment-effect-info">
                                <span class="equipment-effect-name">${refData.name}</span>
                                <span class="equipment-effect-cat">${refData.category} · ${refData.subCategory}</span>
                                <p class="equipment-effect-desc">${refData.desc}</p>
                            </div>
                        ` : (eff.refId ? '<div class="equipment-effect-error">⚠ 未找到ID: ' + eff.refId + '</div>' : '')}
                    </div>
                `;
            }).join('')}
            </div>
        </div>
    `;
    document.getElementById('skillModal').classList.add('active');
}





function selectEditEffectItem(eqId, effectIdx, selectedId) {
    const inputEl = document.querySelector('#effectItem-' + effectIdx + ' .equipment-effect-input');
    const dropdownEl = document.getElementById('editDropdown-' + effectIdx);
    if (inputEl) {
        inputEl.value = selectedId;
        updateEquipmentEffect(eqId, effectIdx, selectedId);
    }
    if (dropdownEl) dropdownEl.innerHTML = '';
}









function syncEquipmentCard(id) {
    const eq = equipmentData.find(e => e.id === id);
    if (!eq) return;
    const card = document.querySelector(`[data-equipment-id="${id}"]`);
    if (!card) return;
    const effects = (eq.effects || []).filter(e => e.refId);
    const countEl = card.querySelector('.equipment-effect-count');
    if (countEl) countEl.textContent = '效果 (' + effects.length + ' 条)';
    // 同步更新效果列表
    const listEl = card.querySelector('.equipment-card-effect-list');
    if (listEl) {
        if (effects.length === 0) {
            listEl.innerHTML = '<p class="equipment-card-effect-empty">暂无效果</p>';
        } else {
            listEl.innerHTML = effects.map(eff => {
                const refData = findRefData(eff.refId);
                const typeColor = refData ? (refData.type === 'active-skill' ? '#e74c3c' : refData.type === 'passive-skill' ? '#3498db' : refData.type === 'attribute' ? '#27ae60' : '#f39c12') : '#e74c3c';
                const typeLabel = refData ? (refData.type === 'active-skill' ? '主动' : refData.type === 'passive-skill' ? '被动' : refData.type === 'attribute' ? '属性' : '词缀') : '未知';
                return `
                    <div class="equipment-card-effect" style="border-left-color:${typeColor}">
                        <span class="equipment-card-effect-type" style="background:${typeColor}20;color:${typeColor}">${typeLabel}</span>
                        <span class="equipment-card-effect-name">${refData ? refData.name : eff.refId}</span>
                        <p class="equipment-card-effect-desc">${refData ? refData.desc : '⚠ 未找到ID: ' + eff.refId}</p>
                    </div>
                `;
            }).join('');
        }
    }
}

function updateNavCounts() {
    const eqEl = document.getElementById('equipmentCount');
    if (eqEl) eqEl.textContent = equipmentData.length;
    const gemEl = document.getElementById('gemCount');
    if (gemEl) gemEl.textContent = gemData.length;
    updateCustomSkillNavCount();
    updateBattleDataCount();
    const occEl = document.getElementById('occupationCount');
    if (occEl) occEl.textContent = occupationData.length;
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
            const effects = (gem.effects || []).filter(e => e.refId);
            const effectCount = effects.length;
            const effectItems = effects.map(eff => {
                const refData = findRefData(eff.refId);
                const typeColor = refData ? (refData.type === 'active-skill' ? '#e74c3c' : refData.type === 'passive-skill' ? '#3498db' : refData.type === 'attribute' ? '#27ae60' : '#f39c12') : '#e74c3c';
                const typeLabel = refData ? (refData.type === 'active-skill' ? '主动' : refData.type === 'passive-skill' ? '被动' : refData.type === 'attribute' ? '属性' : '词缀') : '未知';
                return `
                    <div class="equipment-card-effect" style="border-left-color:${typeColor}">
                        <span class="equipment-card-effect-type" style="background:${typeColor}20;color:${typeColor}">${typeLabel}</span>
                        <span class="equipment-card-effect-name">${refData ? refData.name : eff.refId}</span>
                        <p class="equipment-card-effect-desc">${refData ? refData.desc : '⚠ 未找到ID: ' + eff.refId}</p>
                    </div>
                `;
            }).join('');
            return `
                <div class="equipment-card" data-gem-id="${gem.id}" onclick="openGemDetail('${gem.id}')" style="border-left-color:${style.color}">
                    <div class="equipment-card-header">
                        <span class="equipment-card-icon" style="background:${style.color}18">${gem.icon ? `<img class="card-icon" src="icon/${gem.icon}.png" alt="" onerror="this.style.display='none'">` : ''}${style.icon}</span>
                        <div>
                            <h4 class="equipment-card-name">${gem.name}</h4>
                            <span class="equipment-card-id">${gem.id}</span>
                        </div>
                    </div>
                    <span class="equipment-card-type" style="color:${style.color}">${gem.rank ? gem.rank + ' 阶' : '未分类'}</span>
                    <div class="item-stats">
                        <div class="item-stats-cell"><span class="item-stats-label">类型</span><span class="item-stats-value">${gem.type || '辅助宝石'}</span></div>
                        <div class="item-stats-cell"><span class="item-stats-label">效果</span><span class="item-stats-value">${effectCount} 条</span></div>
                        <div class="item-stats-cell"><span class="item-stats-label">宝石ID</span><span class="item-stats-value">${gem.id}</span></div>
                    </div>
                    ${gem.desc ? `<p class="equipment-card-effect-desc" style="margin:4px 0;padding:4px 8px;background:#f8f8f8;border-radius:6px;font-size:12px;color:#666">${gem.desc}</p>` : ''}
                    <div class="equipment-card-effects">
                        <span class="equipment-effect-count">关联效果 (${effectCount} 条)</span>
                        <div class="equipment-card-effect-list">
                            ${effectItems || '<p class="equipment-card-effect-empty">暂无关联效果</p>'}
                        </div>
                    </div>
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
    const search = document.getElementById('gemSearchInput').value.toLowerCase();
    const rankFilter = document.getElementById('gemRankFilter') ? document.getElementById('gemRankFilter').value : '';
    const filtered = gemData.filter(gem => {
        const rank = (gem.rank || '').toString().trim() || '0';
        if (rankFilter && rank !== rankFilter) return false;
        if (!search) return true;
        if (gem.name.toLowerCase().includes(search)) return true;
        if ((gem.id || '').toLowerCase().includes(search)) return true;
        if (rank !== '0' && (rank + ' 阶').includes(search)) return true;
        if (gem.type && gem.type.toLowerCase().includes(search)) return true;
        if (gem.desc && gem.desc.toLowerCase().includes(search)) return true;
        const hasEffect = (gem.effects || []).some(e => e.refId && e.refId.includes(search));
        if (hasEffect) return true;
        return false;
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



function onGemEffectInput(inputEl, previewId, dropdownId) {
    const val = inputEl.value.trim();
    const dropdownEl = document.getElementById(dropdownId);

    previewEffect(inputEl, previewId);

    if (!val) {
        if (dropdownEl) dropdownEl.innerHTML = '';
        return;
    }

    const refData = findRefData(val);
    if (refData && /^\d+$/.test(val)) {
        if (dropdownEl) dropdownEl.innerHTML = '';
        return;
    }

    // 搜索词缀、属性、被动技能
    const search = val.toLowerCase();
    let matches = [];

    affixes.forEach(a => {
        if (a.name.toLowerCase().includes(search) || a.id.includes(search) || a.description.toLowerCase().includes(search)) {
            matches.push({ id: a.id, name: a.name, desc: a.description, typeLabel: '词缀', typeColor: '#f39c12' });
        }
    });
    attributes.forEach(a => {
        if (a.name.toLowerCase().includes(search) || a.id.includes(search) || a.description.toLowerCase().includes(search)) {
            matches.push({ id: a.id, name: a.name, desc: a.description, typeLabel: '属性', typeColor: '#27ae60' });
        }
    });
    passiveSkills.forEach(s => {
        if (s.name.toLowerCase().includes(search) || s.id.includes(search) || s.description.toLowerCase().includes(search)) {
            matches.push({ id: s.id, name: s.name, desc: s.description, typeLabel: '被动', typeColor: '#3498db' });
        }
    });

    matches = matches.slice(0, 20);

    if (matches.length === 0) {
        if (dropdownEl) dropdownEl.innerHTML = '<div class="autocomplete-empty">无匹配结果</div>';
        return;
    }

    if (!dropdownEl) return;
    dropdownEl.innerHTML = '<div class="autocomplete-list">' + matches.map(m => `
        <div class="autocomplete-item" onclick="selectEffectItem('${inputEl.id}', '${previewId}', '${dropdownId}', '${m.id}')">
            <span class="autocomplete-item-type" style="background:${m.typeColor}20;color:${m.typeColor}">${m.typeLabel}</span>
            <span class="autocomplete-item-id">${m.id}</span>
            <span class="autocomplete-item-name">${m.name}</span>
            <span class="autocomplete-item-desc">${m.desc.substring(0, 30)}</span>
        </div>
    `).join('') + '</div>';
}



function openGemDetail(id) {
    const gem = gemData.find(g => g.id === id);
    if (!gem) return;
    if (!gem.effects) gem.effects = [];
    const effects = gem.effects;

    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = `
        <div class="detail-header" style="border-bottom-color:#9b59b6">
            <div class="detail-icon" style="background:#9b59b620;color:#9b59b6;font-size:36px;width:64px;height:64px;display:flex;align-items:center;justify-content:center;border-radius:12px;position:relative;overflow:hidden">${gem.icon ? `<img class="card-icon" src="icon/${gem.icon}.png" alt="" onerror="this.style.display='none'">` : ''}💎</div>
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

        <div class="detail-section">
            <h3 class="detail-section-title">关联效果（${effects.filter(e => e.refId).length} 条）</h3>
            <div id="gemEffectList">
            ${effects.length === 0 ? '<p class="empty-hint">暂无关联效果</p>' : ''}
            ${effects.map((eff, idx) => {
                const refData = eff.refId ? findRefData(eff.refId) : null;
                const typeColor = refData ? (refData.type === 'active-skill' ? '#e74c3c' : refData.type === 'passive-skill' ? '#3498db' : refData.type === 'attribute' ? '#27ae60' : '#f39c12') : '#bbb';
                const typeLabel = refData ? (refData.type === 'active-skill' ? '主动技能' : refData.type === 'passive-skill' ? '被动技能' : refData.type === 'attribute' ? '属性效果' : '词缀') : '待填写';
                return `
                    <div class="equipment-effect-item" style="border-left-color:${typeColor}">
                        <div class="equipment-effect-header">
                            <span class="effect-type-badge" style="background:${typeColor}20;color:${typeColor}">${typeLabel}</span>
                            <span class="effect-ref-id">${eff.refId || '—'}</span>
                        </div>
                        ${refData ? `
                            <div class="equipment-effect-info">
                                <span class="equipment-effect-name">${refData.name}</span>
                                <span class="equipment-effect-cat">${refData.category} · ${refData.subCategory}</span>
                                <p class="equipment-effect-desc">${refData.desc}</p>
                            </div>
                        ` : (eff.refId ? '<div class="equipment-effect-error">⚠ 未找到ID: ' + eff.refId + '</div>' : '')}
                    </div>
                `;
            }).join('')}
            </div>
        </div>
    `;
    document.getElementById('skillModal').classList.add('active');
}





function selectEditGemEffectItem(gemId, effectIdx, selectedId) {
    const inputEl = document.querySelector('#gemEffectItem-' + effectIdx + ' .equipment-effect-input');
    const dropdownEl = document.getElementById('editGemDropdown-' + effectIdx);
    if (inputEl) {
        inputEl.value = selectedId;
        updateGemEffect(gemId, effectIdx, selectedId);
    }
    if (dropdownEl) dropdownEl.innerHTML = '';
}









function syncGemCard(id) {
    const gem = gemData.find(g => g.id === id);
    if (!gem) return;
    const card = document.querySelector(`[data-gem-id="${id}"]`);
    if (!card) return;
    const effects = (gem.effects || []).filter(e => e.refId);
    const countEl = card.querySelector('.equipment-effect-count');
    if (countEl) countEl.textContent = '关联效果 (' + effects.length + ' 条)';
    const listEl = card.querySelector('.equipment-card-effect-list');
    if (listEl) {
        if (effects.length === 0) {
            listEl.innerHTML = '<p class="equipment-card-effect-empty">暂无关联效果</p>';
        } else {
            listEl.innerHTML = effects.map(eff => {
                const refData = findRefData(eff.refId);
                const typeColor = refData ? (refData.type === 'active-skill' ? '#e74c3c' : refData.type === 'passive-skill' ? '#3498db' : refData.type === 'attribute' ? '#27ae60' : '#f39c12') : '#e74c3c';
                const typeLabel = refData ? (refData.type === 'active-skill' ? '主动' : refData.type === 'passive-skill' ? '被动' : refData.type === 'attribute' ? '属性' : '词缀') : '未知';
                return `
                    <div class="equipment-card-effect" style="border-left-color:${typeColor}">
                        <span class="equipment-card-effect-type" style="background:${typeColor}20;color:${typeColor}">${typeLabel}</span>
                        <span class="equipment-card-effect-name">${refData ? refData.name : eff.refId}</span>
                        <p class="equipment-card-effect-desc">${refData ? refData.desc : '⚠ 未找到ID: ' + eff.refId}</p>
                    </div>
                `;
            }).join('');
        }
    }
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
            const effects = (s.effects || []).filter(e => e.refId);
            const effectCount = effects.length;
            // 视频匹配: 按技能名称在 videoData 中查找对应视频
            const video = videoData.find(v => v.name === s.name) || null;
            const videoHtml = video
                ? `
                    <div class="skill-video-preview" onclick="event.stopPropagation();openSkillVideo('${encodeURIComponent(video.file)}','${(s.name || '').replace(/'/g, "\\'")}')">
                        <video src="videos/${encodeURIComponent(video.file)}" preload="metadata" muted playsinline></video>
                        <div class="skill-video-play-overlay"><span class="skill-video-play-icon">▶</span><span class="skill-video-play-text">点击播放</span></div>
                    </div>
                `
                : `
                    <div class="skill-video-empty">暂无视频</div>
                `;
            const effectItems = effects.map(eff => {
                const refData = findRefData(eff.refId);
                const typeColor = refData ? (refData.type === 'active-skill' ? '#e74c3c' : refData.type === 'passive-skill' ? '#3498db' : refData.type === 'attribute' ? '#27ae60' : '#f39c12') : '#e74c3c';
                const typeLabel = refData ? (refData.type === 'active-skill' ? '主动' : refData.type === 'passive-skill' ? '被动' : refData.type === 'attribute' ? '属性' : '词缀') : '未知';
                return `
                    <div class="equipment-card-effect" style="border-left-color:${typeColor}">
                        <span class="equipment-card-effect-type" style="background:${typeColor}20;color:${typeColor}">${typeLabel}</span>
                        <span class="equipment-card-effect-name">${refData ? refData.name : eff.refId}</span>
                        <p class="equipment-card-effect-desc">${refData ? refData.desc : '⚠ 未找到ID: ' + eff.refId}</p>
                    </div>
                `;
            }).join('');
            return `
                <div class="equipment-card" data-custom-skill-id="${s.id}" onclick="openCustomSkillDetail('${s.id}')" style="border-left-color:${style.color}">
                    <div class="equipment-card-header">
                        <span class="equipment-card-icon" style="background:${style.color}18">${s.icon ? `<img class="card-icon" src="icon/${s.icon}.png" alt="" onerror="this.style.display='none'">` : ''}${style.icon}</span>
                        <div>
                            <h4 class="equipment-card-name">${s.name}</h4>
                            <span class="equipment-card-id">${s.id}</span>
                        </div>
                    </div>
                    <span class="equipment-card-type">${s.type || '未分类'}</span>
                    <div class="item-stats">
                        <div class="item-stats-cell"><span class="item-stats-label">类型</span><span class="item-stats-value">${s.type || '未分类'}</span></div>
                        <div class="item-stats-cell"><span class="item-stats-label">效果</span><span class="item-stats-value">${effectCount} 条</span></div>
                        <div class="item-stats-cell"><span class="item-stats-label">技能ID</span><span class="item-stats-value">${s.id}</span></div>
                    </div>
                    ${renderSkillTags(s.tags)}
                    ${s.desc ? `<p class="equipment-card-effect-desc" style="margin:4px 0;padding:4px 8px;background:#f8f8f8;border-radius:6px;font-size:12px;color:#666">${s.desc}</p>` : ''}
                    <div class="equipment-card-effects">
                        <span class="equipment-effect-count">关联效果 (${effectCount} 条)</span>
                        <div class="equipment-card-effect-list">
                            ${effectItems || '<p class="equipment-card-effect-empty">暂无关联效果</p>'}
                        </div>
                    </div>
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

function filterCustomSkills() {
    renderCustomSkillTagFilterBar();
    const searchEl = document.getElementById('customSkillSearchInput');
    if (!searchEl) return;
    const search = searchEl.value.toLowerCase();
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
        if (!search) return true;
        if (s.name.toLowerCase().includes(search)) return true;
        if ((s.id || '').toLowerCase().includes(search)) return true;
        if (s.type && s.type.toLowerCase().includes(search)) return true;
        if (s.desc && s.desc.toLowerCase().includes(search)) return true;
        const hasEffect = (s.effects || []).some(e => e.refId && e.refId.includes(search));
        if (hasEffect) return true;
        return false;
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


function onBattleSkillImport(select) {
    const opt = select.selectedOptions[0];
    if (!opt || !opt.value) return;
    document.getElementById('csName').value = opt.dataset.name || '';
    document.getElementById('csDesc').value = opt.dataset.desc || '';
    document.getElementById('csType').value = opt.dataset.type || '';
    document.getElementById('csSourceId').value = opt.value || '';
}

function onCustomSkillEffectInput(inputEl, previewId, dropdownId) {
    const val = inputEl.value.trim();
    const dropdownEl = document.getElementById(dropdownId);
    previewEffect(inputEl, previewId);
    if (!val) { if (dropdownEl) dropdownEl.innerHTML = ''; return; }
    const refData = findRefData(val);
    if (refData && /^\d+$/.test(val)) { if (dropdownEl) dropdownEl.innerHTML = ''; return; }

    const search = val.toLowerCase();
    let matches = [];
    affixes.forEach(a => {
        if (a.name.toLowerCase().includes(search) || a.id.includes(search) || a.description.toLowerCase().includes(search)) {
            matches.push({ id: a.id, name: a.name, desc: a.description, typeLabel: '词缀', typeColor: '#f39c12' });
        }
    });
    attributes.forEach(a => {
        if (a.name.toLowerCase().includes(search) || a.id.includes(search) || a.description.toLowerCase().includes(search)) {
            matches.push({ id: a.id, name: a.name, desc: a.description, typeLabel: '属性', typeColor: '#27ae60' });
        }
    });
    passiveSkills.forEach(s => {
        if (s.name.toLowerCase().includes(search) || s.id.includes(search) || s.description.toLowerCase().includes(search)) {
            matches.push({ id: s.id, name: s.name, desc: s.description, typeLabel: '被动', typeColor: '#3498db' });
        }
    });
    matches = matches.slice(0, 20);
    if (matches.length === 0) { if (dropdownEl) dropdownEl.innerHTML = '<div class="autocomplete-empty">无匹配结果</div>'; return; }
    if (!dropdownEl) return;
    dropdownEl.innerHTML = '<div class="autocomplete-list">' + matches.map(m => `
        <div class="autocomplete-item" onclick="selectEffectItem('${inputEl.id}', '${previewId}', '${dropdownId}', '${m.id}')">
            <span class="autocomplete-item-type" style="background:${m.typeColor}20;color:${m.typeColor}">${m.typeLabel}</span>
            <span class="autocomplete-item-id">${m.id}</span>
            <span class="autocomplete-item-name">${m.name}</span>
            <span class="autocomplete-item-desc">${m.desc.substring(0, 30)}</span>
        </div>
    `).join('') + '</div>';
}



function openCustomSkillDetail(id) {
    const skill = customSkillData.find(s => s.id === id);
    if (!skill) return;
    if (!skill.effects) skill.effects = [];
    const effects = skill.effects;

    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = `
        <div class="detail-header" style="border-bottom-color:#e67e22">
            <div class="detail-icon" style="background:#e67e2220;color:#e67e22;font-size:36px;width:64px;height:64px;display:flex;align-items:center;justify-content:center;border-radius:12px;position:relative;overflow:hidden">${skill.icon ? `<img class="card-icon" src="icon/${skill.icon}.png" alt="" onerror="this.style.display='none'">` : ''}🏹</div>
            <div style="flex:1">
                <h2 class="detail-name">${skill.name}</h2>
                <div class="detail-type">
                    <span class="type-badge" style="background:#e67e2220;color:#e67e22">技能系统</span>
                    <span class="type-badge-sub">${skill.id}</span>
                    ${skill.sourceId ? `<span class="type-badge-sub">来源: ${skill.sourceId}</span>` : ''}
                    ${skill.type ? `<span class="type-badge-sub">${skill.type}</span>` : ''}
                </div>
            </div>
        </div>

        ${skill.desc ? `
        <div class="detail-section">
            <h3 class="detail-section-title">技能效果描述</h3>
            <p class="detail-desc-text">${skill.desc.replace(/</g, '&lt;').replace(/\n/g, '<br>')}</p>
        </div>
        ` : ''}

        <div class="detail-section">
            <h3 class="detail-section-title">关联效果（${effects.filter(e => e.refId).length} 条）</h3>
            <div id="csEffectList">
            ${effects.length === 0 ? '<p class="empty-hint">暂无关联效果</p>' : ''}
            ${effects.map((eff, idx) => {
                const refData = eff.refId ? findRefData(eff.refId) : null;
                const typeColor = refData ? (refData.type === 'active-skill' ? '#e74c3c' : refData.type === 'passive-skill' ? '#3498db' : refData.type === 'attribute' ? '#27ae60' : '#f39c12') : '#bbb';
                const typeLabel = refData ? (refData.type === 'active-skill' ? '主动技能' : refData.type === 'passive-skill' ? '被动技能' : refData.type === 'attribute' ? '属性效果' : '词缀') : '待填写';
                return `
                    <div class="equipment-effect-item" style="border-left-color:${typeColor}">
                        <div class="equipment-effect-header">
                            <span class="effect-type-badge" style="background:${typeColor}20;color:${typeColor}">${typeLabel}</span>
                            <span class="effect-ref-id">${eff.refId || '—'}</span>
                        </div>
                        ${refData ? `
                            <div class="equipment-effect-info">
                                <span class="equipment-effect-name">${refData.name}</span>
                                <span class="equipment-effect-cat">${refData.category} · ${refData.subCategory}</span>
                                <p class="equipment-effect-desc">${refData.desc}</p>
                            </div>
                        ` : (eff.refId ? '<div class="equipment-effect-error">⚠ 未找到ID: ' + eff.refId + '</div>' : '')}
                    </div>
                `;
            }).join('')}
            </div>
        </div>

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
    const search = searchEl.value.toLowerCase().trim();
    let filtered = attributes;
    if (cat) filtered = filtered.filter(a => a.category === cat);
    if (search) filtered = filtered.filter(a =>
        a.name.toLowerCase().includes(search) || a.id.includes(search)
    );
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

    console.log('  数据统计: 主动=' + activeSkills.length, '被动=' + passiveSkills.length, '词缀=' + affixes.length, '属性=' + attributes.length, '装备=' + equipmentData.length, '技能库=' + customSkillData.length, '宝石=' + gemData.length, '职业=' + occupationData.length);

    const _aC = document.getElementById('affixCount'); if (_aC) _aC.textContent = affixes.length;
    const _eC = document.getElementById('equipmentCount'); if (_eC) _eC.textContent = equipmentData.length;
    const _atC = document.getElementById('attrCount'); if (_atC) _atC.textContent = attributes.length;
    const _gC = document.getElementById('gemCount'); if (_gC) _gC.textContent = gemData.length;
    const _oC = document.getElementById('occupationCount'); if (_oC) _oC.textContent = occupationData.length;
    const _pC = document.getElementById('petCount'); if (_pC) _pC.textContent = petData.length;
    updateCustomSkillNavCount();
    updateBattleDataCount();

    renderHome();
    filterSkills('active');
    filterSkills('passive');
    renderTagFilterBar('active');
    renderTagFilterBar('passive');
    renderCustomSkillTagFilterBar();
    renderAffixes();
    renderAttributes();
    renderEquipment();
    renderGems();
    renderCustomSkills();
    renderCategoryTables();
    renderStats();

    console.log('=== 初始化完成 ===');
}

// ============================================================
// 同步战斗数据（从本地项目文件夹拉取）
// ============================================================
function showSyncBattleDataModal() {
    // 读取上次保存的文件夹名
    let lastFolders = {};
    try {
        ['skill', 'skillModule', 'stunt', 'stuntModule'].forEach(t => {
            const v = localStorage.getItem('sync_folder_' + t);
            if (v) lastFolders[t] = v;
        });
        ['affixExcel', 'attrCSV'].forEach(t => {
            const v = localStorage.getItem('sync_file_' + t);
            if (v) lastFolders[t] = v;
        });
    } catch(e) {}

    const hintHTML = (type) => lastFolders[type] ? `<span style="color:#aaa;font-size:11px;margin-left:8px">上次: ${lastFolders[type]}</span>` : '';

    // 检查是否有缓存的文件对象
    const cachedCount = Object.values(syncFolders).filter(v => v && (Array.isArray(v) ? v.length > 0 : true)).length;
    const hasCached = cachedCount > 0;

    // 缓存状态文本
    const statusHTML = (type) => {
        const v = syncFolders[type];
        if (v && (Array.isArray(v) ? v.length > 0 : true)) {
            if (Array.isArray(v)) {
                const folderName = v[0].webkitRelativePath ? v[0].webkitRelativePath.split('/')[0] : v[0].name;
                return `<span class="sync-status sync-status-ok">✓ 已缓存（${folderName}）</span>`;
            } else {
                return `<span class="sync-status sync-status-ok">✓ 已缓存（${v.name}）</span>`;
            }
        }
        return '<span class="sync-status">未选择</span>';
    };

    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = `
        <div class="detail-header" style="border-bottom-color:#e74c3c">
            <div class="detail-icon" style="background:#e74c3c20;color:#e74c3c;font-size:36px;width:64px;height:64px;display:flex;align-items:center;justify-content:center;border-radius:12px">🔄</div>
            <div style="flex:1">
                <h2 class="detail-name">同步战斗数据</h2>
                <div class="detail-type">
                    <span class="type-badge" style="background:#e74c3c20;color:#e74c3c">数据同步</span>
                </div>
            </div>
        </div>

        ${hasCached ? `
        <div class="detail-section" style="background:#27ae6010;border:1px solid #27ae6030;border-radius:8px;padding:16px">
            <p style="color:#27ae60;font-weight:600;font-size:14px;margin-bottom:8px">✓ 已缓存 ${cachedCount} 个数据源</p>
            <p style="color:#666;font-size:12px;margin-bottom:12px">上次选择的文件仍在内存中，可直接同步无需重新选择</p>
            <button class="equipment-btn equipment-btn-save" style="width:100%" onclick="quickSyncBattleData()">⚡ 直接同步（使用已缓存文件）</button>
        </div>
        <div style="border-top:1px solid #eee;margin:8px 0;padding-top:8px">
            <p style="color:#999;font-size:12px">或重新选择数据源：</p>
        </div>
        ` : ''}

        <div class="detail-section">
            <p class="equipment-form-hint" style="margin-bottom:16px">
                选择对应的文件夹或CSV文件，系统会自动解析数据。<br>
                <strong>Skill</strong> / <strong>SkillModule</strong>：主动技能 JSON 文件夹<br>
                <strong>Stunt</strong> / <strong>StuntModule</strong>：被动技能 JSON 文件夹<br>
                <strong>词缀CSV</strong> / <strong>属性CSV</strong>：对应CSV文件
            </p>
        </div>

        <div class="detail-section">
            <h3 class="detail-section-title">主动技能数据源</h3>
            <div class="sync-folder-group">
                <label class="sync-folder-label">① Skill 文件夹 ${hintHTML('skill')}</label>
                <div class="sync-folder-row">
                    <input type="file" id="syncSkillFolder" webkitdirectory multiple style="display:none" onchange="onSyncFolderSelected('skill', this)">
                    <button class="equipment-btn" onclick="document.getElementById('syncSkillFolder').click()">选择 Skill 文件夹</button>
                    <span class="sync-status" id="syncSkillStatus">${statusHTML('skill')}</span>
                </div>
            </div>
            <div class="sync-folder-group">
                <label class="sync-folder-label">② SkillModule 文件夹 ${hintHTML('skillModule')}</label>
                <div class="sync-folder-row">
                    <input type="file" id="syncSkillModuleFolder" webkitdirectory multiple style="display:none" onchange="onSyncFolderSelected('skillModule', this)">
                    <button class="equipment-btn" onclick="document.getElementById('syncSkillModuleFolder').click()">选择 SkillModule 文件夹</button>
                    <span class="sync-status" id="syncSkillModuleStatus">${statusHTML('skillModule')}</span>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <h3 class="detail-section-title">被动技能数据源</h3>
            <div class="sync-folder-group">
                <label class="sync-folder-label">③ Stunt 文件夹 ${hintHTML('stunt')}</label>
                <div class="sync-folder-row">
                    <input type="file" id="syncStuntFolder" webkitdirectory multiple style="display:none" onchange="onSyncFolderSelected('stunt', this)">
                    <button class="equipment-btn" onclick="document.getElementById('syncStuntFolder').click()">选择 Stunt 文件夹</button>
                    <span class="sync-status" id="syncStuntStatus">${statusHTML('stunt')}</span>
                </div>
            </div>
            <div class="sync-folder-group">
                <label class="sync-folder-label">④ StuntModule 文件夹 ${hintHTML('stuntModule')}</label>
                <div class="sync-folder-row">
                    <input type="file" id="syncStuntModuleFolder" webkitdirectory multiple style="display:none" onchange="onSyncFolderSelected('stuntModule', this)">
                    <button class="equipment-btn" onclick="document.getElementById('syncStuntModuleFolder').click()">选择 StuntModule 文件夹</button>
                    <span class="sync-status" id="syncStuntModuleStatus">${statusHTML('stuntModule')}</span>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <h3 class="detail-section-title">词缀数据源（Excel文件）</h3>
            <div class="sync-folder-group">
                <label class="sync-folder-label">⑤ 词缀Excel文件 ${hintHTML('affixExcel')}</label>
                <div class="sync-folder-row">
                    <input type="file" id="syncAffixExcel" accept=".xlsx,.xls" style="display:none" onchange="onSyncFileSelected('affixExcel', this)">
                    <button class="equipment-btn" onclick="document.getElementById('syncAffixExcel').click()">选择 词缀Excel</button>
                    <span class="sync-status" id="syncAffixExcelStatus">${statusHTML('affixExcel')}</span>
                </div>
                <p style="font-size:11px;color:#aaa;margin-top:4px">系统会自动查找包含"词缀"的工作表</p>
            </div>
        </div>

        <div class="detail-section">
            <h3 class="detail-section-title">属性数据源（CSV文件）</h3>
            <div class="sync-folder-group">
                <label class="sync-folder-label">⑥ 属性CSV文件 ${hintHTML('attrCSV')}</label>
                <div class="sync-folder-row">
                    <input type="file" id="syncAttrCSV" accept=".csv" style="display:none" onchange="onSyncFileSelected('attrCSV', this)">
                    <button class="equipment-btn" onclick="document.getElementById('syncAttrCSV').click()">选择 属性.csv</button>
                    <span class="sync-status" id="syncAttrCSVStatus">${statusHTML('attrCSV')}</span>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <div class="sync-result" id="syncResult"></div>
            <button class="equipment-btn equipment-btn-save" style="width:100%;margin-top:12px" onclick="executeSyncBattleData()" id="syncExecBtn" ${hasCached ? '' : 'disabled'}>开始同步</button>
        </div>

        <div class="equipment-form-actions">
            <button class="equipment-btn equipment-btn-cancel" onclick="closeModal()">关闭</button>
        </div>
    `;
    document.getElementById('skillModal').classList.add('active');
}

const syncFolders = { skill: null, skillModule: null, stunt: null, stuntModule: null, affixExcel: null, attrCSV: null };

function quickSyncBattleData() {
    executeSyncBattleData();
}

function onSyncFolderSelected(type, input) {
    const files = Array.from(input.files);
    const statusEl = document.getElementById('sync' + type.charAt(0).toUpperCase() + type.slice(1) + 'Status');

    if (files.length === 0) {
        statusEl.textContent = '未选择';
        statusEl.className = 'sync-status';
        syncFolders[type] = null;
    } else {
        syncFolders[type] = files;
        const folderName = files[0].webkitRelativePath ? files[0].webkitRelativePath.split('/')[0] : '未知文件夹';
        statusEl.textContent = '已选择 ' + folderName + '（' + files.length + ' 个文件）';
        statusEl.className = 'sync-status sync-status-ok';
        // 保存文件夹名到 localStorage
        try { localStorage.setItem('sync_folder_' + type, folderName); } catch(e) {}
    }

    const hasAny = Object.values(syncFolders).some(v => v && (Array.isArray(v) ? v.length > 0 : true));
    document.getElementById('syncExecBtn').disabled = !hasAny;
}

function onSyncFileSelected(type, input) {
    const file = input.files[0];
    const statusEl = document.getElementById('sync' + type.charAt(0).toUpperCase() + type.slice(1) + 'Status');

    if (!file) {
        statusEl.textContent = '未选择';
        statusEl.className = 'sync-status';
        syncFolders[type] = null;
    } else {
        syncFolders[type] = file;
        statusEl.textContent = '已选择 ' + file.name;
        statusEl.className = 'sync-status sync-status-ok';
        try { localStorage.setItem('sync_file_' + type, file.name); } catch(e) {}
    }

    const hasAny = Object.values(syncFolders).some(v => v && (Array.isArray(v) ? v.length > 0 : true));
    document.getElementById('syncExecBtn').disabled = !hasAny;
}

function executeSyncBattleData() {
    const resultEl = document.getElementById('syncResult');
    resultEl.innerHTML = '<p style="color:#999">正在解析数据...</p>';

    setTimeout(() => {
        // 由于 FileReader 是异步的，使用 Promise 方式处理
        const promises = [
            parseSkillFiles(syncFolders.skill, 'skill'),
            parseSkillFiles(syncFolders.skillModule, 'skillModule'),
            parseSkillFiles(syncFolders.stunt, 'stunt'),
            parseSkillFiles(syncFolders.stuntModule, 'stuntModule')
        ];

        if (syncFolders.affixExcel) {
            promises.push(parseExcelForAffixes(syncFolders.affixExcel));
        } else {
            promises.push(Promise.resolve(null));
        }

        if (syncFolders.attrCSV) {
            promises.push(parseCSVFile(syncFolders.attrCSV, 'attr'));
        } else {
            promises.push(Promise.resolve(null));
        }

        Promise.all(promises).then(results => {
            const [skillMap, skillModuleMap, stuntMap, stuntModuleMap, affixExcelData, attrCSVData] = results;

            // 合并主动技能
            const mergedActive = {};
            Object.assign(mergedActive, skillModuleMap);
            for (const sid in skillMap) {
                if (mergedActive[sid]) {
                    if (skillMap[sid].name) mergedActive[sid].name = skillMap[sid].name;
                    if (skillMap[sid].desc) mergedActive[sid].desc = skillMap[sid].desc;
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
                } else {
                    mergedPassive[sid] = stuntMap[sid];
                }
            }

            // 过滤主动技能：10位ID且首位为1
            const newActiveSkills = [];
            for (const sid in mergedActive) {
                if (sid.length === 10 && sid[0] === '1') {
                    const info = mergedActive[sid];
                    newActiveSkills.push(buildSkillObject(sid, info.name, info.desc, 'active'));
                }
            }

            // 过滤被动技能：10位ID且首位为2或3，以及特殊5位ID
            const newPassiveSkills = [];
            for (const sid in mergedPassive) {
                if (sid.length === 10 && (sid[0] === '2' || sid[0] === '3')) {
                    const info = mergedPassive[sid];
                    newPassiveSkills.push(buildSkillObject(sid, info.name, info.desc, 'passive'));
                } else if (sid === '99998' || sid === '99999') {
                    const info = mergedPassive[sid];
                    newPassiveSkills.push(buildSkillObject(sid, info.name, info.desc, 'passive'));
                }
            }

            // 按ID排序
            newActiveSkills.sort((a, b) => a.id.localeCompare(b.id));
            newPassiveSkills.sort((a, b) => a.id.localeCompare(b.id));

            // 替换数据
            activeSkills.length = 0;
            activeSkills.push(...newActiveSkills);
            passiveSkills.length = 0;
            passiveSkills.push(...newPassiveSkills);

            // 词缀Excel
            let affixCount = 0;
            if (affixExcelData && affixExcelData.length > 0) {
                affixes.length = 0;
                affixes.push(...affixExcelData);
                affixCount = affixExcelData.length;
                try { localStorage.setItem('chronicle_synced_affixes', JSON.stringify(affixes)); } catch(e) {}
            }

            // 属性CSV
            let attrCount = 0;
            if (attrCSVData && attrCSVData.length > 0) {
                attributes.length = 0;
                attributes.push(...attrCSVData);
                attrCount = attrCSVData.length;
                try { localStorage.setItem('chronicle_synced_attrs', JSON.stringify(attributes)); } catch(e) {}
            }

            // 保存到 localStorage
            try {
                localStorage.setItem('chronicle_synced_active', JSON.stringify(activeSkills));
                localStorage.setItem('chronicle_synced_passive', JSON.stringify(passiveSkills));
            } catch (e) {}

            // 刷新页面
            filterSkills('active');
            filterSkills('passive');
            filterAffixes();
            filterAttributes();
            renderStats();
            renderHome();
            updateBattleDataCount();

            const activeCount = newActiveSkills.length;
            const passiveCount = newPassiveSkills.length;

            resultEl.innerHTML = `
                <div style="background:#27ae6010;border:1px solid #27ae6030;border-radius:8px;padding:16px">
                    <p style="color:#27ae60;font-weight:600;font-size:15px;margin-bottom:8px">✓ 同步完成！</p>
                    <p style="color:#666;font-size:13px">主动技能：${activeCount} 个</p>
                    <p style="color:#666;font-size:13px">被动技能：${passiveCount} 个</p>
                    ${affixCount > 0 ? '<p style="color:#666;font-size:13px">词缀：' + affixCount + ' 个</p>' : ''}
                    ${attrCount > 0 ? '<p style="color:#666;font-size:13px">属性：' + attrCount + ' 个</p>' : ''}
                    ${Object.keys(skillMap).length > 0 ? '<p style="color:#999;font-size:12px;margin-top:8px">Skill 文件夹：' + Object.keys(skillMap).length + ' 个文件</p>' : ''}
                    ${Object.keys(skillModuleMap).length > 0 ? '<p style="color:#999;font-size:12px">SkillModule 文件夹：' + Object.keys(skillModuleMap).length + ' 个文件</p>' : ''}
                    ${Object.keys(stuntMap).length > 0 ? '<p style="color:#999;font-size:12px">Stunt 文件夹：' + Object.keys(stuntMap).length + ' 个文件</p>' : ''}
                    ${Object.keys(stuntModuleMap).length > 0 ? '<p style="color:#999;font-size:12px">StuntModule 文件夹：' + Object.keys(stuntModuleMap).length + ' 个文件</p>' : ''}
                </div>
            `;
        }).catch(err => {
            resultEl.innerHTML = '<div style="color:#e74c3c;padding:12px">✗ 同步失败：' + err.message + '</div>';
        });
    }, 100);
}

// 解析Excel文件中的词缀数据
function parseExcelForAffixes(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const wb = XLSX.read(data, { type: 'array' });

                // 查找包含"词缀"的工作表
                let targetSheet = null;
                for (const name of wb.SheetNames) {
                    if (name.includes('词缀')) {
                        targetSheet = name;
                        break;
                    }
                }
                // 如果没找到包含"词缀"的表名，尝试用第一个表
                if (!targetSheet) {
                    targetSheet = wb.SheetNames[0];
                }

                const sheet = wb.Sheets[targetSheet];
                // 转为JSON，header为列名自动推断
                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

                if (rows.length === 0) {
                    resolve([]);
                    return;
                }

                // 第一行为表头
                const headers = rows[0].map(h => String(h).trim());
                const findCol = (names) => {
                    for (const name of names) {
                        const idx = headers.findIndex(h =>
                            h === name || h.toLowerCase() === name.toLowerCase() ||
                            h.includes(name) || name.includes(h)
                        );
                        if (idx >= 0) return idx;
                    }
                    return -1;
                };

                const idCol = findCol(['ID', 'id', 'Id', '编号', '词缀ID']);
                const nameCol = findCol(['名称', '名字', 'Name', 'name', '词缀名称']);
                const descCol = findCol(['描述', '说明', '效果', 'desc', 'Desc', 'description', 'Description', 'text', 'Text']);
                const catCol = findCol(['分类', '类型', 'category', 'Category', 'type', 'Type']);
                const subCol = findCol(['子分类', '子类型', 'subCategory', 'sub_category', '标签', '属性']);

                const result = [];
                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row || row.length === 0) continue;

                    const id = idCol >= 0 ? String(row[idCol]).trim() : String(row[0]).trim();
                    const name = nameCol >= 0 ? String(row[nameCol]).trim() : String(row[1]).trim();
                    const desc = descCol >= 0 ? String(row[descCol]).trim() : '';
                    const category = catCol >= 0 ? String(row[catCol]).trim() : '';
                    const subCategory = subCol >= 0 ? String(row[subCol]).trim() : '';

                    if (!id || id === '0' || id === headers[0]) continue;

                    // 按 ID 长度自动分类：5位=通用词缀，更长=特殊词缀
                    let finalCategory = category;
                    if (!finalCategory || (finalCategory !== '通用词缀' && finalCategory !== '特殊词缀')) {
                        finalCategory = id.length <= 5 ? '通用词缀' : '特殊词缀';
                    }

                    result.push({
                        id: id,
                        name: name || '未命名词缀',
                        category: finalCategory,
                        subCategory: subCategory || '通用',
                        isNew: false,
                        description: desc || name || ''
                    });
                }

                resolve(result);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = function() { reject(new Error('Excel文件读取失败')); };
        reader.readAsArrayBuffer(file);
    });
}

// 解析CSV文件
function parseCSVFile(file, type) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const text = e.target.result;
                const lines = text.split(/\r?\n/).filter(l => l.trim());
                if (lines.length === 0) {
                    resolve([]);
                    return;
                }

                // 检测分隔符
                const firstLine = lines[0];
                const sep = firstLine.includes('\t') ? '\t' : ',';

                // 解析表头
                const headers = firstLine.split(sep).map(h => h.trim().replace(/"/g, ''));

                // 找到关键列的索引
                const findCol = (names) => {
                    for (const name of names) {
                        const idx = headers.findIndex(h => h.toLowerCase() === name.toLowerCase() || h.toLowerCase().includes(name.toLowerCase()));
                        if (idx >= 0) return idx;
                    }
                    return -1;
                };

                const idCol = findCol(['id', 'ID', 'Id']);
                const nameCol = findCol(['name', 'Name', '名称', '名字']);
                const descCol = findCol(['desc', 'Desc', 'description', 'Description', '描述', '说明', 'text', '效果']);
                const catCol = findCol(['category', 'Category', '分类', '类型', 'type', 'Type']);

                const result = [];
                for (let i = 1; i < lines.length; i++) {
                    const cols = lines[i].split(sep).map(c => c.trim().replace(/"/g, ''));
                    if (cols.length < 2) continue;

                    const id = idCol >= 0 ? cols[idCol] : cols[0];
                    const name = nameCol >= 0 ? cols[nameCol] : cols[1];
                    const desc = descCol >= 0 ? cols[descCol] : '';
                    const category = catCol >= 0 ? cols[catCol] : (type === 'affix' ? '通用词缀' : '基础属性');

                    if (!id || id === headers[0]) continue;

                    if (type === 'affix') {
                        let affixCat = category;
                        if (!affixCat || (affixCat !== '通用词缀' && affixCat !== '特殊词缀')) {
                            affixCat = id.length <= 5 ? '通用词缀' : '特殊词缀';
                        }
                        result.push({
                            id: id,
                            name: name || '未命名词缀',
                            category: affixCat,
                            subCategory: '通用',
                            isNew: false,
                            description: desc || ''
                        });
                    } else {
                        let attrCat = category;
                        if (!attrCat || (attrCat !== '基础属性' && attrCat !== '特殊属性')) {
                            attrCat = '基础属性';
                        }
                        result.push({
                            id: id,
                            name: name || '未命名属性',
                            category: attrCat,
                            subCategory: '基础',
                            isNew: false,
                            description: desc || ''
                        });
                    }
                }

                resolve(result);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = function() { reject(new Error('文件读取失败')); };
        reader.readAsText(file, 'utf-8');
    });
}

function parseSkillFiles(files, type) {
    return new Promise((resolve, reject) => {
        const result = {};
        if (!files || files.length === 0) {
            resolve(result);
            return;
        }

        let processed = 0;
        let total = 0;

        // 筛选目标文件
        const targetFiles = files.filter(file => {
            if (type === 'skill') {
                return file.name.startsWith('Basic_Information-');
            } else if (type === 'skillModule') {
                return file.name.startsWith('module-');
            } else if (type === 'stunt') {
                return file.name.startsWith('baseStuntInfo-');
            } else if (type === 'stuntModule') {
                return file.name.startsWith('module-');
            }
            return false;
        });

        total = targetFiles.length;
        if (total === 0) {
            resolve(result);
            return;
        }

        targetFiles.forEach(file => {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const data = JSON.parse(e.target.result);
                    let sid = '';
                    let name = '';
                    let desc = '';

                    if (type === 'skill' || type === 'skillModule') {
                        sid = type === 'skill' ? (file.name.match(/Basic_Information-(\d+)/) || [])[1] || '' : String(data.id || '').padStart(10, '0');
                        name = data.name || '';
                        desc = data.desc || data.detailedDesc || '';
                    } else if (type === 'stunt' || type === 'stuntModule') {
                        sid = type === 'stunt' ? (file.name.match(/baseStuntInfo-(\d+)/) || [])[1] || '' : String(data.group || '');
                        name = data.name || '';
                        desc = data.text || '';
                    }

                    if (sid && sid !== '0') {
                        if (!result[sid]) {
                            result[sid] = { name: '', desc: '' };
                        }
                        if (name) result[sid].name = name;
                        if (desc) result[sid].desc = desc;
                    }
                } catch (err) {
                    // 忽略解析错误的文件
                }
                processed++;
                if (processed === total) {
                    resolve(result);
                }
            };
            reader.onerror = function() {
                processed++;
                if (processed === total) {
                    resolve(result);
                }
            };
            reader.readAsText(file, 'utf-8');
        });
    });
}

function buildSkillObject(sid, name, desc, type) {
    if (type === 'active') {
        const b = sid[1], c = sid[2];
        const bc = b + c;
        const catMap = { '11': '战斗技能', '12': '法术技能', '14': '增益技能' };
        const category = catMap[bc] || '其他技能';
        const subMap = { '1': '战斗攻击', '2': '法术释放', '4': '增益辅助' };
        const subCategory = subMap[c] || '其他';
        return { id: sid, name: name || '未命名技能', category, subCategory, isNew: false, description: desc || '' };
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
        return { id: sid, name: name || '未命名特技', category, subCategory, isNew: false, description: desc || '' };
    }
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
// 每个职业一块 iPhoneX 尺寸白色画布，天赋点按 viewPos 坐标定位
// ============================================================

// iPhoneX 逻辑分辨率: 375 x 812 (pt)，实际画布按此比例缩放
const IPHONE_X_W = 375;
const IPHONE_X_H = 812;

let currentOccupationIdx = 0;

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
    const nodeMap = {};
    allPoints.forEach(p => { nodeMap[p.id] = p; });

    // 坐标范围仅基于可见节点
    let maxX = -Infinity, maxY = -Infinity, minX = Infinity, minY = Infinity;
    visiblePoints.forEach(p => {
        if (p.viewPos) {
            maxX = Math.max(maxX, p.viewPos.x);
            maxY = Math.max(maxY, p.viewPos.y);
            minX = Math.min(minX, p.viewPos.x);
            minY = Math.min(minY, p.viewPos.y);
        }
    });
    // 安全边距: 顶部容纳节点半径(最大48px); 底部容纳节点半径+名称标签(~53px); 左右容纳节点半径
    const padTop = 55;
    const padBottom = 105;
    const padSide = 55;
    const rangeX = (maxX - minX) || 1;
    const rangeY = (maxY - minY) || 1;
    // 一屏模式: 以宽高中较小的缩放比为准，确保所有内容(含节点尺寸/名称标签)容纳在 375x812 内
    const scaleW = (IPHONE_X_W - padSide * 2) / rangeX;
    const scaleH = (IPHONE_X_H - padTop - padBottom) / rangeY;
    const scale = Math.min(scaleW, scaleH);
    const canvasW = IPHONE_X_W;
    const canvasH = IPHONE_X_H;
    // 居中: X 轴水平居中; Y 轴在上下安全边距之间居中
    const offsetX = (canvasW - rangeX * scale) / 2;
    const offsetY = padTop + (canvasH - padTop - padBottom - rangeY * scale) / 2;

    // 计算每个天赋点的画布坐标 (包含所有节点，用于追踪 size=1 中间节点)
    const posMap = {};
    allPoints.forEach(p => {
        posMap[p.id] = {
            x: offsetX + (p.viewPos.x - minX) * scale,
            y: offsetY + (maxY - p.viewPos.y) * scale
        };
    });

    // 递归查找通过 size=1 节点连接到的所有可见节点
    function findVisibleTargets(linkId, visited) {
        if (visited.has(linkId)) return [];
        visited.add(linkId);
        const node = nodeMap[linkId];
        if (!node) return [];
        if (node.size >= 2) return [linkId];
        // size=1 节点: 继续追踪其 linkPoint
        const results = [];
        (node.linkPoint || '').split('|').forEach(tid => {
            const t = tid.trim();
            if (t) results.push(...findVisibleTargets(t, visited));
        });
        return results;
    }

    // 生成连线 SVG (基于 linkPoint，跳过 size=1 中间节点，去重)
    const drawn = new Set();
    const lines = [];
    visiblePoints.forEach(p => {
        if (!p.linkPoint) return;
        const src = posMap[p.id];
        if (!src) return;
        p.linkPoint.split('|').forEach(rawId => {
            const tid = rawId.trim();
            if (!tid) return;
            // 如果目标节点可见，直接连线；否则通过 size=1 节点追踪到可见节点
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
        ? `<svg class="talent-links-svg" width="${canvasW}" height="${canvasH}">${lines.join('')}</svg>`
        : '';

    // 生成天赋点元素 (仅 size >= 2)
    const pointsHtml = visiblePoints.map(p => {
        const pos = posMap[p.id];
        const sizeClass = p.size === 2 ? 'talent-point-large' : (p.size === 3 ? 'talent-point-xlarge' : '');
        const iconChar = p.icon || '⭐';
        const iconHtml = p.iconSrc
            ? `<img class="talent-point-img" src="icon/${p.iconSrc}.png" alt="${p.name}" onerror="this.style.display='none';this.nextSibling.style.display=''"><span class="talent-point-icon" style="display:none">${iconChar}</span>`
            : `<span class="talent-point-icon">${iconChar}</span>`;
        const shortDesc = p.name || '';
        return `
            <div class="talent-point ${sizeClass}" style="left:${pos.x}px;top:${pos.y}px"
                 onclick="showTalentDetail('${p.id}', ${idx})"
                 title="${p.name}">
                ${iconHtml}
            </div>
            ${shortDesc ? `<div class="talent-point-label" style="left:${pos.x}px;top:${pos.y}px">${shortDesc}</div>` : ''}
        `;
    }).join('');

    // 职业底图配置: 职业名 → 底图路径 (未配置的职业使用默认 talent-bg-character.png)
    const occupationBgMap = {
        '幻影魔典': 'assets/talent-bg-huanying.png',
        '巫术魔典': 'assets/talent-bg-wushu.png',
        '剑客1': 'assets/talent-bg-jianke.png',
        '冰刀': 'assets/talent-bg-bingdao.png',
        '元素法杖': 'assets/talent-bg-yuansu.png',
        '塑能法杖': 'assets/talent-bg-suneng.png'
    };
    const bgImage = occupationBgMap[occ.name];
    const bgStyle = bgImage
        ? `background-image:url('${bgImage}');background-size:cover;background-position:center center;background-repeat:no-repeat;`
        : '';

    canvasArea.innerHTML = `
        <div class="occupation-canvas-wrapper">
            <img class="talent-frame-top" src="assets/talent-frame-top.png" alt="">
            <div class="occupation-canvas" style="width:${canvasW}px;height:${canvasH}px">
                <div class="talent-canvas-bg" style="${bgStyle}"></div>
                ${linksSvg}
                ${pointsHtml}
            </div>
            <img class="talent-frame-bottom" src="assets/talent-frame-bottom.png" alt="">
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
            <video src="videos/${file}" controls autoplay playsinline class="skill-video-modal-player"></video>
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

// 星级效果渲染: 返回效果标签 HTML
function renderPetStarEffects(star) {
    const parts = [];
    (star.skillAffix || []).forEach(a => {
        const name = petEffectName(a.id);
        if (!name) return;
        parts.push(`<span class="pet-effect pet-effect-affix" title="词缀ID: ${a.id}">${name} ${fmtPetValue(a.value)}</span>`);
    });
    (star.stunt || []).forEach(id => {
        const name = petEffectName(id);
        if (!name) return;
        parts.push(`<span class="pet-effect pet-effect-stunt" title="被动ID: ${id}">${name}</span>`);
    });
    (star.attr || []).forEach(a => {
        const name = petEffectName(a.id);
        if (!name) return;
        parts.push(`<span class="pet-effect pet-effect-attr" title="属性ID: ${a.id}">${name} ${fmtPetValue(a.value)}</span>`);
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
    const keyword = ((document.getElementById('petSearchInput') || {}).value || '').trim().toLowerCase();
    const qFilter = ((document.getElementById('petQualityFilter') || {}).value || '').trim();

    let list = petData;
    if (keyword) {
        list = list.filter(p => (p.name || '').toLowerCase().includes(keyword) || String(p.id).includes(keyword));
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
        const hasPic = p.pic ? 'icon/' + p.pic + '.png' : '';
        const hasBg = p.getBg ? 'icon/' + p.getBg + '.png' : '';
        const hasGetPic = p.getPic ? 'icon/' + p.getPic + '.png' : '';
        const starCount = (p.stars || []).length;
        // 展示区: 仅当配置了立绘+背景时展示 (背景图铺底, 立绘图居中叠加在上, 点击查看原图)
        let showcaseHtml = '';
        if (hasBg || hasGetPic) {
            const showcaseClick = `onclick="openPetShowcase('${hasGetPic}','${hasBg}','${(p.name || '').replace(/'/g, "\\'")}')"`;
            showcaseHtml = `
                <div class="pet-showcase" ${showcaseClick}>
                    ${hasBg ? `<img class="pet-showcase-bg" src="${hasBg}" alt="" onerror="this.style.display='none'">` : ''}
                    ${hasGetPic ? `<img class="pet-showcase-pic" src="${hasGetPic}" alt="${p.name}" onerror="this.style.display='none'">` : ''}
                    <span class="pet-showcase-zoom">⛶</span>
                </div>
            `;
        }
        return `
            <div class="pet-card" style="border-color:${q.color}66">
                <div class="pet-card-top">
                    <div class="pet-avatar${hasPic ? ' pet-avatar-clickable' : ''}" style="background:${q.color}18;border-color:${q.color}88" ${hasPic ? `onclick="openPetAvatar('${hasPic}','${(p.name || '').replace(/'/g, "\\'")}')" title="点击查看原图"` : ''}>
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
