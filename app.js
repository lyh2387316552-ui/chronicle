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

    // 装备/辅助宝石/技能库 使用纯黑底图（暂不设置背景图），其他页面保留背景图
    document.body.classList.toggle('page-black', ['equipment', 'gems', 'custom-skills'].includes(pageName));

    // 滚动到顶部
    document.querySelector('.main-content').scrollTop = 0;
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
    }
}

// ---- 渲染技能卡片 ----
function renderSkillCard(skill, type) {
    const color = getCategoryColor(skill.category);
    const icon = getCategoryIcon(skill.category);
    const newBadge = skill.isNew ? '<span class="new-tag">新增</span>' : '';
    const parsed = parseSkillId(skill.id);

    return `
        <div class="skill-card" data-skill-id="${skill.id}" onclick="openSkillDetail('${skill.id}', '${type}')" style="border-left-color: ${color}">
            <div class="skill-card-header">
                <span class="skill-icon" style="background:${color}20;color:${color}">${icon}</span>
                <div class="skill-card-info">
                    <h4 class="skill-name">${skill.name}${newBadge}</h4>
                    <span class="skill-id">${skill.id}</span>
                </div>
            </div>
            <div class="skill-card-tags">
                <span class="skill-tag" style="background:${color}20;color:${color}">${skill.category}</span>
                <span class="skill-tag-sub">${skill.subCategory}</span>
            </div>
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
    const newEl = document.getElementById(`${type}NewOnly`);
    if (!catEl || !searchEl) return;

    const categoryFilter = catEl.value;
    const searchInput = searchEl.value.toLowerCase();
    const newOnly = newEl ? newEl.checked : false;

    const filtered = skills.filter(s => {
        if (categoryFilter && s.category !== categoryFilter) return false;
        if (newOnly && !s.isNew) return false;
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
    const newBadge = skill.isNew ? '<span class="new-tag">新增</span>' : '';
    const hasEdits = checkHasEdits(SKILL_EDIT_KEY, id);

    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = `
        <div class="detail-header" style="border-bottom-color:${color}">
            <div class="detail-icon" style="background:${color}20;color:${color};font-size:36px;width:64px;height:64px;display:flex;align-items:center;justify-content:center;border-radius:12px">${icon}</div>
            <div style="flex:1">
                <h2 class="detail-name">
                    <input type="text" class="affix-edit-input affix-edit-name" value="${skill.name.replace(/"/g, '&quot;')}" oninput="onSkillEdit('${skill.id}', 'name', this.value)" placeholder="技能名称">
                    ${newBadge}
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

        ${skill.isNew ? `
        <div class="detail-section">
            <div class="detail-new-banner">
                🆕 此技能为 <strong>2026年7月版本</strong> 新增内容
            </div>
        </div>
        ` : ''}

        <div class="detail-section">
            <div class="new-toggle-row">
                <label class="new-toggle-label">
                    <input type="checkbox" id="newStatusCheckbox" ${skill.isNew ? 'checked' : ''} onchange="toggleNewStatus('${skill.id}', 'skill', '${type}', this.checked)">
                    <span class="new-toggle-text">标记为版本新增</span>
                </label>
                <span class="new-toggle-hint">勾选后，外层列表将显示"新增"标签，并出现在"仅看新增"筛选结果中</span>
            </div>
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
    if (type === 'active') {
        const f = document.getElementById('activeCategoryFilter');
        if (f) renderActiveSkills(activeSkills.filter(s => {
            const cat = f.value;
            const si = document.getElementById('activeSearchInput');
            const no = document.getElementById('activeNewOnly');
            if (cat && s.category !== cat) return false;
            if (no && no.checked && !s.isNew) return false;
            return true;
        }));
    } else {
        const f = document.getElementById('passiveCategoryFilter');
        if (f) renderPassiveSkills(passiveSkills.filter(s => {
            const cat = f.value;
            const no = document.getElementById('passiveNewOnly');
            if (cat && s.category !== cat) return false;
            if (no && no.checked && !s.isNew) return false;
            return true;
        }));
    }
}

// ---- 切换"新增"标记状态 ----
function toggleNewStatus(id, itemType, subType, isChecked) {
    let target = null;
    let targetArr = null;

    if (itemType === 'skill') {
        targetArr = subType === 'active' ? activeSkills : passiveSkills;
        target = targetArr.find(s => s.id === id);
    } else if (itemType === 'affix') {
        targetArr = affixes;
        target = affixes.find(a => a.id === id);
    } else if (itemType === 'equipment') {
        targetArr = equipmentData;
        target = equipmentData.find(e => e.id === id);
    } else if (itemType === 'gem') {
        targetArr = gemData;
        target = gemData.find(g => g.id === id);
    }

    if (!target) return;
    target.isNew = isChecked;

    // 持久化到 localStorage
    try {
        const key = 'chronicle_new_status';
        let saved = {};
        const raw = localStorage.getItem(key);
        if (raw) saved = JSON.parse(raw);
        saved[id] = isChecked;
        localStorage.setItem(key, JSON.stringify(saved));
    } catch (e) {}

    // 更新弹窗中的新增标签显示
    const bannerEl = document.querySelector('.detail-new-banner');
    if (isChecked && !bannerEl) {
        // 如果勾选了但没有banner，重新渲染弹窗
        if (itemType === 'skill') {
            openSkillDetail(id, subType);
        } else if (itemType === 'affix') {
            openAffixDetail(id);
        } else if (itemType === 'equipment') {
            openEquipmentDetail(id);
        } else if (itemType === 'gem') {
            openGemDetail(id);
        }
    } else if (!isChecked && bannerEl) {
        // 如果取消勾选但有banner，重新渲染弹窗
        if (itemType === 'skill') {
            openSkillDetail(id, subType);
        } else if (itemType === 'affix') {
            openAffixDetail(id);
        } else if (itemType === 'equipment') {
            openEquipmentDetail(id);
        } else if (itemType === 'gem') {
            openGemDetail(id);
        }
    }

    // 更新统计数字
    renderStats();
    if (typeof renderHome === 'function') renderHome();

    // 刷新各列表以反映新增标记变化
    if (itemType === 'skill') {
        filterSkills(subType);
    } else if (itemType === 'affix') {
        filterAffixes();
        // 如果有装备引用了该词缀，刷新装备列表
        const usedInEquipment = equipmentData.some(eq =>
            (eq.effects || []).some(e => e.refId === id)
        );
        if (usedInEquipment) filterEquipments();
    } else if (itemType === 'equipment') {
        filterEquipments();
    } else if (itemType === 'gem') {
        filterGems();
    }
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
    if (equipmentChanged) saveEquipmentData();

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
    if (equipmentChanged) saveEquipmentData();

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
        const newTag = affix.isNew ? '<span class="new-tag">新增</span>' : '';
        nameEl.innerHTML = affix.name + newTag;
    }
    if (descEl) descEl.textContent = affix.description;
}

function syncSkillCard(id) {
    const skill = [...activeSkills, ...passiveSkills].find(s => s.id === id);
    if (!skill) return;
    const nameEl = document.querySelector(`[data-skill-id="${id}"] .skill-name`);
    if (nameEl) {
        const newTag = skill.isNew ? '<span class="new-tag">新增</span>' : '';
        nameEl.innerHTML = skill.name + newTag;
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

        const newCount = catAffixes.filter(a => a.isNew).length;
        const newBadge = newCount > 0 ? `<span class="cat-new-badge">+${newCount}新增</span>` : '';

        html += `
            <div class="affix-category-section">
                <div class="affix-cat-header" style="border-left-color:${cat.color}">
                    <span class="affix-cat-icon" style="background:${cat.color}20;color:${cat.color}">${cat.icon}</span>
                    <div class="affix-cat-info">
                        <h3 class="affix-cat-title">${cat.key}</h3>
                        <span class="affix-cat-desc">${cat.desc}</span>
                    </div>
                    <span class="affix-cat-count" style="background:${cat.color}20;color:${cat.color}">${catAffixes.length}</span>
                    ${newBadge}
                </div>
                <div class="affix-cat-grid">
                    ${catAffixes.map(a => {
                        const newTag = a.isNew ? '<span class="new-tag">新增</span>' : '';
                        return `
                            <div class="affix-card" data-affix-id="${a.id}" onclick="openAffixDetail('${a.id}')" style="border-left-color:${cat.color}">
                                <div class="affix-header">
                                    <span class="affix-icon" style="background:${cat.color}20;color:${cat.color}">${cat.icon}</span>
                                    <div>
                                        <h4 class="affix-name">${a.name}${newTag}</h4>
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
                        const newTag = a.isNew ? '<span class="new-tag">新增</span>' : '';
                        return `
                            <div class="affix-card" data-affix-id="${a.id}" onclick="openAffixDetail('${a.id}')" style="border-left-color:#7f8c8d">
                                <div class="affix-header">
                                    <span class="affix-icon" style="background:#7f8c8d20;color:#7f8c8d">📋</span>
                                    <div>
                                        <h4 class="affix-name">${a.name}${newTag}</h4>
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
    const newBadge = affix.isNew ? '<span class="new-tag">新增</span>' : '';

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
                    ${newBadge}
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
                <div class="detail-info-item">
                    <span class="detail-info-label">版本状态</span>
                    <span class="detail-info-value">${affix.isNew ? '🆕 新增' : '已有词缀'}</span>
                </div>
            </div>
        </div>

        ${affix.isNew ? `
        <div class="detail-section">
            <div class="detail-new-banner">
                🆕 此词缀为 <strong>2026年7月版本</strong> 新增内容
            </div>
        </div>
        ` : ''}

        <div class="detail-section">
            <div class="new-toggle-row">
                <label class="new-toggle-label">
                    <input type="checkbox" id="newStatusCheckbox" ${affix.isNew ? 'checked' : ''} onchange="toggleNewStatus('${affix.id}', 'affix', '', this.checked)">
                    <span class="new-toggle-text">标记为版本新增</span>
                </label>
                <span class="new-toggle-hint">勾选后，外层列表将显示"新增"标签，并出现在"仅看新增"筛选结果中</span>
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
            equipmentChanged = true;
            saveEquipmentData();
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
            equipmentChanged = true;
            saveEquipmentData();
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
    const newOnly = document.getElementById('affixNewOnly') ? document.getElementById('affixNewOnly').checked : false;

    const filtered = affixes.filter(a => {
        if (categoryFilter && a.category !== categoryFilter) return false;
        if (newOnly && !a.isNew) return false;
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
    _set('statNew',
        activeSkills.filter(s => s.isNew).length + passiveSkills.filter(s => s.isNew).length + affixes.filter(a => a.isNew).length + equipmentData.filter(e => e.isNew).length + gemData.filter(g => g.isNew).length);

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

    // 新增列表
    const newSkills = [...activeSkills, ...passiveSkills].filter(s => s.isNew);
    const newAffixes = affixes.filter(a => a.isNew);
    const newEquipments = equipmentData.filter(e => e.isNew);
    const newGems = gemData.filter(g => g.isNew);
    const newList = document.getElementById('newSkillList');
    if (!newList) return;
    newList.innerHTML = newSkills.map(s => {
        const color = getCategoryColor(s.category);
        const icon = getCategoryIcon(s.category);
        const type = activeSkills.includes(s) ? 'active' : 'passive';
        return `
            <div class="new-skill-item" onclick="openSkillDetail('${s.id}', '${type}')" style="border-left-color:${color}">
                <span class="new-skill-icon">${icon}</span>
                <span class="new-skill-name">${s.name}</span>
                <span class="new-skill-tag" style="background:${color}20;color:${color}">${s.category}</span>
                <span class="new-skill-id">${s.id}</span>
            </div>
        `;
    }).join('') + newAffixes.map(a => {
        const cat = affixCategories.find(c => c.key === a.category);
        const color = cat ? cat.color : '#f39c12';
        return `
            <div class="new-skill-item" onclick="openAffixDetail('${a.id}')" style="border-left-color:${color}">
                <span class="new-skill-icon">${cat ? cat.icon : '✨'}</span>
                <span class="new-skill-name">${a.name}</span>
                <span class="new-skill-tag" style="background:${color}20;color:${color}">${a.category}</span>
                <span class="new-skill-id">${a.id}</span>
            </div>
        `;
    }).join('') + newEquipments.map(e => {
        return `
            <div class="new-skill-item" onclick="openEquipmentDetail('${e.id}')" style="border-left-color:#9b59b6">
                <span class="new-skill-icon">📦</span>
                <span class="new-skill-name">${e.name}</span>
                <span class="new-skill-tag" style="background:#9b59b620;color:#9b59b6">${e.type || '装备'}</span>
                <span class="new-skill-id">${e.id}</span>
            </div>
        `;
    }).join('') + newGems.map(g => {
        return `
            <div class="new-skill-item" onclick="openGemDetail('${g.id}')" style="border-left-color:#9b59b6">
                <span class="new-skill-icon">💎</span>
                <span class="new-skill-name">${g.name}</span>
                <span class="new-skill-tag" style="background:#9b59b620;color:#9b59b6">${g.type || '辅助宝石'}</span>
                <span class="new-skill-id">${g.id}</span>
            </div>
        `;
    }).join('');
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
                <p class="equipment-empty-hint">${equipmentData.length === 0 ? '点击上方"添加装备"按钮创建第一件装备' : '尝试其他搜索关键词'}</p>
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
                    <span class="equipment-card-icon">📦</span>
                    <div>
                        <h4 class="equipment-card-name">${eq.name} ${eq.isNew ? '<span class="new-tag">新增</span>' : ''}</h4>
                        <span class="equipment-card-id">${eq.id}</span>
                    </div>
                </div>
                <span class="equipment-card-type">${eq.type || '未分类'}</span>
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
    const newOnly = document.getElementById('equipmentNewOnly') ? document.getElementById('equipmentNewOnly').checked : false;
    const typeFilter = document.getElementById('equipmentTypeFilter') ? document.getElementById('equipmentTypeFilter').value : '';
    const filtered = equipmentData.filter(eq => {
        if (newOnly && !eq.isNew) return false;
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

function showAddEquipmentForm() {
    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = `
        <div class="detail-header" style="border-bottom-color:#9b59b6">
            <div class="detail-icon" style="background:#9b59b620;color:#9b59b6;font-size:36px;width:64px;height:64px;display:flex;align-items:center;justify-content:center;border-radius:12px">📦</div>
            <div>
                <h2 class="detail-name">添加新装备</h2>
                <div class="detail-type">
                    <span class="type-badge" style="background:#9b59b620;color:#9b59b6">装备系统</span>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <h3 class="detail-section-title">基本信息</h3>
            <div class="equipment-form-group">
                <label class="equipment-form-label">装备名称 <span class="required">*</span></label>
                <input type="text" id="eqName" class="equipment-form-input" placeholder="如：暴风之剑">
            </div>
            <div class="equipment-form-group">
                <label class="equipment-form-label">装备类型</label>
                <input type="text" id="eqType" class="equipment-form-input" placeholder="如：武器/防具/饰品">
            </div>
        </div>

        <div class="detail-section">
            <h3 class="detail-section-title">装备效果（填写技能ID或词缀ID）</h3>
            <p class="equipment-form-hint">每条效果填写一个技能ID或词缀ID，输入文字可自动匹配词缀或属性，也可直接输入ID。无需全部填写，有几个填几个。</p>
            <div class="equipment-form-group">
                <label class="equipment-form-label">效果 1</label>
                <input type="text" id="eqEffect1" class="equipment-form-input" placeholder="如：1110000010 或 10031 或 输入文字搜索" oninput="onEffectInput(this, 'preview1', 'dropdown1')">
                <div class="autocomplete-dropdown" id="dropdown1"></div>
                <div class="effect-preview" id="preview1"></div>
            </div>
            <div class="equipment-form-group">
                <label class="equipment-form-label">效果 2</label>
                <input type="text" id="eqEffect2" class="equipment-form-input" placeholder="技能ID或词缀ID 或 输入文字搜索" oninput="onEffectInput(this, 'preview2', 'dropdown2')">
                <div class="autocomplete-dropdown" id="dropdown2"></div>
                <div class="effect-preview" id="preview2"></div>
            </div>
            <div class="equipment-form-group">
                <label class="equipment-form-label">效果 3</label>
                <input type="text" id="eqEffect3" class="equipment-form-input" placeholder="技能ID或词缀ID 或 输入文字搜索" oninput="onEffectInput(this, 'preview3', 'dropdown3')">
                <div class="autocomplete-dropdown" id="dropdown3"></div>
                <div class="effect-preview" id="preview3"></div>
            </div>
            <div class="equipment-form-group">
                <label class="equipment-form-label">效果 4</label>
                <input type="text" id="eqEffect4" class="equipment-form-input" placeholder="技能ID或词缀ID 或 输入文字搜索" oninput="onEffectInput(this, 'preview4', 'dropdown4')">
                <div class="autocomplete-dropdown" id="dropdown4"></div>
                <div class="effect-preview" id="preview4"></div>
            </div>
            <div class="equipment-form-group">
                <label class="equipment-form-label">效果 5</label>
                <input type="text" id="eqEffect5" class="equipment-form-input" placeholder="技能ID或词缀ID 或 输入文字搜索" oninput="onEffectInput(this, 'preview5', 'dropdown5')">
                <div class="autocomplete-dropdown" id="dropdown5"></div>
                <div class="effect-preview" id="preview5"></div>
            </div>
            <div class="equipment-form-group">
                <label class="equipment-form-label">效果 6</label>
                <input type="text" id="eqEffect6" class="equipment-form-input" placeholder="技能ID或词缀ID 或 输入文字搜索" oninput="onEffectInput(this, 'preview6', 'dropdown6')">
                <div class="autocomplete-dropdown" id="dropdown6"></div>
                <div class="effect-preview" id="preview6"></div>
            </div>
        </div>

        <div class="equipment-form-actions">
            <button class="equipment-btn equipment-btn-cancel" onclick="closeModal()">取消</button>
            <button class="equipment-btn equipment-btn-save" onclick="submitAddEquipment()">保存装备</button>
        </div>
    `;
    document.getElementById('skillModal').classList.add('active');
}

function onEffectInput(inputEl, previewId, dropdownId) {
    const val = inputEl.value.trim();
    const dropdownEl = document.getElementById(dropdownId);

    // 先显示ID预览
    previewEffect(inputEl, previewId);

    // 如果输入为空，关闭下拉
    if (!val) {
        if (dropdownEl) dropdownEl.innerHTML = '';
        return;
    }

    // 如果输入是纯数字且已找到匹配，不显示下拉
    const refData = findRefData(val);
    if (refData && /^\d+$/.test(val)) {
        if (dropdownEl) dropdownEl.innerHTML = '';
        return;
    }

    // 搜索匹配的词缀和属性
    const search = val.toLowerCase();
    let matches = [];

    // 搜索词缀
    affixes.forEach(a => {
        if (a.name.toLowerCase().includes(search) || a.id.includes(search) || a.description.toLowerCase().includes(search)) {
            matches.push({ id: a.id, name: a.name, desc: a.description, type: 'affix', typeLabel: '词缀', typeColor: '#f39c12' });
        }
    });

    // 搜索属性
    attributes.forEach(a => {
        if (a.name.toLowerCase().includes(search) || a.id.includes(search) || a.description.toLowerCase().includes(search)) {
            matches.push({ id: a.id, name: a.name, desc: a.description, type: 'attribute', typeLabel: '属性', typeColor: '#27ae60' });
        }
    });

    // 搜索主动技能
    activeSkills.forEach(s => {
        if (s.name.toLowerCase().includes(search) || s.id.includes(search)) {
            matches.push({ id: s.id, name: s.name, desc: s.description, type: 'active-skill', typeLabel: '主动', typeColor: '#e74c3c' });
        }
    });

    // 搜索被动技能
    passiveSkills.forEach(s => {
        if (s.name.toLowerCase().includes(search) || s.id.includes(search)) {
            matches.push({ id: s.id, name: s.name, desc: s.description, type: 'passive-skill', typeLabel: '被动', typeColor: '#3498db' });
        }
    });

    // 限制最多20条
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

function selectEffectItem(inputId, previewId, dropdownId, selectedId) {
    const inputEl = document.getElementById(inputId);
    const dropdownEl = document.getElementById(dropdownId);
    if (inputEl) {
        inputEl.value = selectedId;
        previewEffect(inputEl, previewId);
    }
    if (dropdownEl) dropdownEl.innerHTML = '';
}

function previewEffect(inputEl, previewId) {
    const refId = inputEl.value.trim();
    const previewEl = document.getElementById(previewId);
    if (!refId) {
        previewEl.innerHTML = '';
        return;
    }
    const refData = findRefData(refId);
    if (refData) {
        const typeLabel = refData.type === 'active-skill' ? '主动技能' :
                          refData.type === 'passive-skill' ? '被动技能' :
                          refData.type === 'attribute' ? '属性' : '词缀';
        const typeColor = refData.type === 'active-skill' ? '#e74c3c' :
                          refData.type === 'passive-skill' ? '#3498db' :
                          refData.type === 'attribute' ? '#27ae60' : '#f39c12';
        previewEl.innerHTML = `
            <div class="effect-preview-card" style="border-left-color:${typeColor}">
                <div class="effect-preview-header">
                    <span class="effect-preview-type" style="background:${typeColor}20;color:${typeColor}">${typeLabel}</span>
                    <span class="effect-preview-name">${refData.name}</span>
                </div>
                <p class="effect-preview-desc">${refData.desc}</p>
            </div>
        `;
    } else {
        previewEl.innerHTML = '<div class="effect-preview-error">⚠ 未找到ID: ' + refId + '</div>';
    }
}

function submitAddEquipment() {
    const name = document.getElementById('eqName').value.trim();
    if (!name) {
        alert('请填写装备名称');
        return;
    }
    const type = document.getElementById('eqType').value.trim();
    const effects = [];
    for (let i = 1; i <= 6; i++) {
        const val = document.getElementById('eqEffect' + i).value.trim();
        if (val) effects.push({ refId: val });
    }
    const newEq = {
        id: generateEquipmentId(),
        name,
        type,
        effects,
        source: 'manual',
        createdAt: new Date().toISOString()
    };
    equipmentData.push(newEq);
    saveEquipmentData();
    closeModal();
    renderEquipment();
    updateNavCounts();
}

function openEquipmentDetail(id) {
    const eq = equipmentData.find(e => e.id === id);
    if (!eq) return;
    if (!eq.effects) eq.effects = [];
    const effects = eq.effects;

    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = `
        <div class="detail-header" style="border-bottom-color:#9b59b6">
            <div class="detail-icon" style="background:#9b59b620;color:#9b59b6;font-size:36px;width:64px;height:64px;display:flex;align-items:center;justify-content:center;border-radius:12px">📦</div>
            <div style="flex:1">
                <h2 class="detail-name">
                    <input type="text" class="affix-edit-input affix-edit-name" value="${eq.name.replace(/"/g, '&quot;')}" oninput="updateEquipmentField('${eq.id}', 'name', this.value)" placeholder="装备名称">
                </h2>
                <div class="detail-type">
                    <span class="type-badge" style="background:#9b59b620;color:#9b59b6">装备系统</span>
                    <span class="type-badge-sub">${eq.id}</span>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <div class="detail-section-title-row">
                <h3 class="detail-section-title">装备类型</h3>
                <span class="save-indicator" id="saveIndicator">编辑后自动保存</span>
            </div>
            <input type="text" class="affix-edit-input" style="font-size:15px;padding:8px 12px;border:1px solid #ddd;border-radius:8px;width:100%;box-sizing:border-box" value="${(eq.type || '').replace(/"/g, '&quot;')}" oninput="updateEquipmentField('${eq.id}', 'type', this.value)" placeholder="如：武器/防具/饰品">
        </div>

        <div class="detail-section">
            <h3 class="detail-section-title">装备效果（<span id="effectCount">${effects.filter(e => e.refId).length}</span> 条）</h3>
            <div id="equipmentEffectList">
            ${effects.length === 0 ? '<p class="empty-hint">暂无效果，点击下方按钮添加</p>' : ''}
            ${effects.map((eff, idx) => {
                const refData = eff.refId ? findRefData(eff.refId) : null;
                const typeColor = refData ? (refData.type === 'active-skill' ? '#e74c3c' : refData.type === 'passive-skill' ? '#3498db' : refData.type === 'attribute' ? '#27ae60' : '#f39c12') : '#bbb';
                const typeLabel = refData ? (refData.type === 'active-skill' ? '主动技能' : refData.type === 'passive-skill' ? '被动技能' : refData.type === 'attribute' ? '属性效果' : '词缀') : '待填写';
                return `
                    <div class="equipment-effect-item" id="effectItem-${idx}" style="border-left-color:${typeColor}">
                        <div class="equipment-effect-header">
                            <span class="effect-type-badge" id="effectBadge-${idx}" style="background:${typeColor}20;color:${typeColor}">${typeLabel}</span>
                            <input type="text" class="equipment-effect-input" value="${eff.refId}" oninput="onEditEffectInput(this, '${eq.id}', ${idx})" placeholder="技能ID或词缀ID 或输入文字搜索">
                            <button class="equipment-effect-delete" onclick="deleteEquipmentEffect('${eq.id}', ${idx})">✕</button>
                        </div>
                        <div class="autocomplete-dropdown" id="editDropdown-${idx}"></div>
                        <div id="effectInfo-${idx}">
                        ${refData ? `
                            <div class="equipment-effect-info">
                                <span class="equipment-effect-name">${refData.name}</span>
                                <span class="equipment-effect-cat">${refData.category} · ${refData.subCategory}</span>
                                <p class="equipment-effect-desc">${refData.desc}</p>
                            </div>
                        ` : (eff.refId ? '<div class="equipment-effect-error">⚠ 未找到ID: ' + eff.refId + '</div>' : '<div class="equipment-effect-hint">请输入技能ID或词缀ID</div>')}
                        </div>
                    </div>
                `;
            }).join('')}
            </div>
            <button class="equipment-add-effect-btn" onclick="addEquipmentEffect('${eq.id}')">+ 添加效果</button>
        </div>

        <div class="detail-section">
            <div class="new-toggle-row">
                <label class="new-toggle-label">
                    <input type="checkbox" id="newStatusCheckbox" ${eq.isNew ? 'checked' : ''} onchange="toggleNewStatus('${eq.id}', 'equipment', '', this.checked)">
                    <span class="new-toggle-text">标记为版本新增</span>
                </label>
                <span class="new-toggle-hint">勾选后，外层列表将显示"新增"标签，并出现在"仅看新增"筛选结果中</span>
            </div>
        </div>

        <div class="detail-section">
            <button class="equipment-btn equipment-btn-delete" onclick="deleteEquipment('${eq.id}')">🗑 删除装备</button>
        </div>
    `;
    document.getElementById('skillModal').classList.add('active');
}

function updateEquipmentField(id, field, value) {
    const eq = equipmentData.find(e => e.id === id);
    if (!eq) return;
    eq[field] = value;
    saveEquipmentData();
    updateSaveIndicator();
    // 实时同步卡片
    const nameEl = document.querySelector(`[data-equipment-id="${id}"] .equipment-card-name`);
    if (nameEl && field === 'name') nameEl.textContent = value;
    const typeEl = document.querySelector(`[data-equipment-id="${id}"] .equipment-card-type`);
    if (typeEl && field === 'type') typeEl.textContent = value || '未分类';
}

function onEditEffectInput(inputEl, eqId, effectIdx) {
    const val = inputEl.value.trim();
    const dropdownEl = document.getElementById('editDropdown-' + effectIdx);

    // 先更新数据
    updateEquipmentEffect(eqId, effectIdx, val);

    // 如果输入为空，关闭下拉
    if (!val) {
        if (dropdownEl) dropdownEl.innerHTML = '';
        return;
    }

    // 如果输入是纯数字且已找到匹配，不显示下拉
    const refData = findRefData(val);
    if (refData && /^\d+$/.test(val)) {
        if (dropdownEl) dropdownEl.innerHTML = '';
        return;
    }

    // 搜索匹配的词缀和属性
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
    activeSkills.forEach(s => {
        if (s.name.toLowerCase().includes(search) || s.id.includes(search)) {
            matches.push({ id: s.id, name: s.name, desc: s.description, typeLabel: '主动', typeColor: '#e74c3c' });
        }
    });
    passiveSkills.forEach(s => {
        if (s.name.toLowerCase().includes(search) || s.id.includes(search)) {
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
        <div class="autocomplete-item" onclick="selectEditEffectItem('${eqId}', ${effectIdx}, '${m.id}')">
            <span class="autocomplete-item-type" style="background:${m.typeColor}20;color:${m.typeColor}">${m.typeLabel}</span>
            <span class="autocomplete-item-id">${m.id}</span>
            <span class="autocomplete-item-name">${m.name}</span>
            <span class="autocomplete-item-desc">${m.desc.substring(0, 30)}</span>
        </div>
    `).join('') + '</div>';
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

function updateEquipmentEffect(eqId, effectIdx, value) {
    const eq = equipmentData.find(e => e.id === eqId);
    if (!eq || !eq.effects[effectIdx]) return;
    eq.effects[effectIdx].refId = value.trim();
    saveEquipmentData();
    updateSaveIndicator();
    // 只更新该效果的信息区域，不重新渲染整个弹窗
    const refData = findRefData(value.trim());
    const infoEl = document.getElementById('effectInfo-' + effectIdx);
    const badgeEl = document.getElementById('effectBadge-' + effectIdx);
    const itemEl = document.getElementById('effectItem-' + effectIdx);
    if (!infoEl || !badgeEl || !itemEl) return;

    const typeColor = refData ? (refData.type === 'active-skill' ? '#e74c3c' : refData.type === 'passive-skill' ? '#3498db' : refData.type === 'attribute' ? '#27ae60' : '#f39c12') : '#e74c3c';
    const typeLabel = refData ? (refData.type === 'active-skill' ? '主动技能' : refData.type === 'passive-skill' ? '被动技能' : refData.type === 'attribute' ? '属性' : '词缀') : '未知';

    badgeEl.style.background = typeColor + '20';
    badgeEl.style.color = typeColor;
    badgeEl.textContent = typeLabel;
    itemEl.style.borderLeftColor = typeColor;

    if (refData) {
        const badge = document.getElementById('effectBadge-' + idx);
        if (badge) {
            const typeColor = refData.type === 'active-skill' ? '#e74c3c' : refData.type === 'passive-skill' ? '#3498db' : refData.type === 'attribute' ? '#27ae60' : '#f39c12';
            const typeLabel = refData.type === 'active-skill' ? '主动技能' : refData.type === 'passive-skill' ? '被动技能' : refData.type === 'attribute' ? '属性效果' : '词缀';
            badge.style.background = typeColor + '20';
            badge.style.color = typeColor;
            badge.textContent = typeLabel;
        }
        infoEl.innerHTML = `
            <div class="equipment-effect-info">
                <span class="equipment-effect-name">${refData.name}</span>
                <span class="equipment-effect-cat">${refData.category} · ${refData.subCategory}</span>
                <p class="equipment-effect-desc">${refData.desc}</p>
            </div>
        `;
    } else {
        infoEl.innerHTML = value.trim() ? '<div class="equipment-effect-error">⚠ 未找到ID: ' + value.trim() + '</div>' : '<div class="equipment-effect-hint">请输入技能ID或词缀ID</div>';
    }
    // 更新效果计数
    const countEl = document.getElementById('effectCount');
    if (countEl) {
        const eq2 = equipmentData.find(e => e.id === eqId);
        countEl.textContent = (eq2.effects || []).filter(e => e.refId).length;
    }
    // 同步外部卡片效果数量
    syncEquipmentCard(eqId);
}

function addEquipmentEffect(eqId) {
    const eq = equipmentData.find(e => e.id === eqId);
    if (!eq) return;
    if (!eq.effects) eq.effects = [];
    if (eq.effects.length >= 10) {
        alert('最多支持10条效果');
        return;
    }
    eq.effects.push({ refId: '' });
    saveEquipmentData();
    openEquipmentDetail(eqId);
}

function deleteEquipmentEffect(eqId, effectIdx) {
    const eq = equipmentData.find(e => e.id === eqId);
    if (!eq || !eq.effects) return;
    eq.effects.splice(effectIdx, 1);
    saveEquipmentData();
    openEquipmentDetail(eqId);
    syncEquipmentCard(eqId);
}

function deleteEquipment(id) {
    if (!confirm('确定删除此装备吗？此操作不可撤销。')) return;
    equipmentData = equipmentData.filter(e => e.id !== id);
    saveEquipmentData();
    closeModal();
    renderEquipment();
    updateNavCounts();
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
                <p class="equipment-empty-hint">${gemData.length === 0 ? '点击上方"添加辅助宝石"按钮创建第一个' : '尝试其他搜索关键词'}</p>
            </div>
        `;
        document.getElementById('gemTotalCount').textContent = gemData.length;
        return;
    }

    // 按类型分组，向下堆叠（同一行最多 4 个）
    const typeGroups = {};
    data.forEach(gem => {
        const type = gem.type || '辅助宝石';
        if (!typeGroups[type]) typeGroups[type] = [];
        typeGroups[type].push(gem);
    });

    const typeStyles = {
        '辅助宝石': { icon: '💎', color: '#9b59b6' },
        '火焰': { icon: '🔥', color: '#e74c3c' },
        '冰冷': { icon: '❄️', color: '#3498db' },
        '物理': { icon: '⚔️', color: '#95a5a6' },
        '通用': { icon: '✨', color: '#f39c12' },
        '未分类': { icon: '💎', color: '#95a5a6' }
    };

    grid.innerHTML = Object.keys(typeGroups).sort().map(type => {
        const style = typeStyles[type] || typeStyles['辅助宝石'];
        const gems = typeGroups[type];
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
                        <span class="equipment-card-icon">${style.icon}</span>
                        <div>
                            <h4 class="equipment-card-name">${gem.name} ${gem.isNew ? '<span class="new-tag">新增</span>' : ''}</h4>
                            <span class="equipment-card-id">${gem.id}</span>
                        </div>
                    </div>
                    <span class="equipment-card-type">${gem.type || '辅助宝石'}</span>
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

        const safeType = type.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
        return `
            <div class="equipment-type-group expanded" id="gem-type-group-${safeType}">
                <div class="equipment-type-header" style="border-left-color:${style.color}" onclick="toggleGemTypeGroup('${safeType}')">
                    <span class="equipment-type-toggle-icon">▼</span>
                    <span class="equipment-type-icon">${style.icon}</span>
                    <span class="equipment-type-name">${type}</span>
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
    updateGemTypeFilter();
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
    const newOnly = document.getElementById('gemNewOnly') ? document.getElementById('gemNewOnly').checked : false;
    const typeFilter = document.getElementById('gemTypeFilter') ? document.getElementById('gemTypeFilter').value : '';
    const filtered = gemData.filter(gem => {
        if (newOnly && !gem.isNew) return false;
        if (typeFilter && (gem.type || '辅助宝石') !== typeFilter) return false;
        if (!search) return true;
        if (gem.name.toLowerCase().includes(search)) return true;
        if ((gem.id || '').toLowerCase().includes(search)) return true;
        if (gem.type && gem.type.toLowerCase().includes(search)) return true;
        if (gem.desc && gem.desc.toLowerCase().includes(search)) return true;
        const hasEffect = (gem.effects || []).some(e => e.refId && e.refId.includes(search));
        if (hasEffect) return true;
        return false;
    });
    renderGems(filtered);
    updateGemTypeFilter();
}

function updateGemTypeFilter() {
    const select = document.getElementById('gemTypeFilter');
    if (!select) return;
    const currentVal = select.value;
    const types = [...new Set(gemData.map(g => g.type || '辅助宝石'))].sort();
    select.innerHTML = '<option value="">全部类型</option>' + types.map(t => `<option value="${t}">${t}</option>`).join('');
    select.value = currentVal;
}

function showAddGemForm() {
    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = `
        <div class="detail-header" style="border-bottom-color:#9b59b6">
            <div class="detail-icon" style="background:#9b59b620;color:#9b59b6;font-size:36px;width:64px;height:64px;display:flex;align-items:center;justify-content:center;border-radius:12px">💎</div>
            <div style="flex:1">
                <h2 class="detail-name">添加辅助技能宝石</h2>
                <div class="detail-type">
                    <span class="type-badge" style="background:#9b59b620;color:#9b59b6">辅助宝石</span>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <h3 class="detail-section-title">基本信息</h3>
            <div class="equipment-form-group">
                <label class="equipment-form-label">宝石名称</label>
                <input type="text" id="gemName" class="equipment-form-input" placeholder="如：辅助·火焰增幅">
            </div>
            <div class="equipment-form-group">
                <label class="equipment-form-label">宝石类型</label>
                <input type="text" id="gemType" class="equipment-form-input" placeholder="如：火焰/冰冷/物理/通用">
            </div>
            <div class="equipment-form-group">
                <label class="equipment-form-label">宝石效果描述</label>
                <textarea id="gemDesc" class="equipment-form-input" rows="3" placeholder="辅助技能宝石的效果描述" style="resize:vertical;font-family:inherit"></textarea>
            </div>
        </div>

        <div class="detail-section">
            <h3 class="detail-section-title">关联效果ID（词缀/属性/被动技能）</h3>
            <p class="equipment-form-hint">每条填写一个词缀ID、属性ID或被动技能ID，输入文字可自动匹配，也可直接输入ID。</p>
            <div class="equipment-form-group">
                <label class="equipment-form-label">效果 1</label>
                <input type="text" id="gemEffect1" class="equipment-form-input" placeholder="词缀/属性/被动技能ID 或输入文字搜索" oninput="onGemEffectInput(this, 'gemPreview1', 'gemDropdown1')">
                <div class="autocomplete-dropdown" id="gemDropdown1"></div>
                <div class="effect-preview" id="gemPreview1"></div>
            </div>
            <div class="equipment-form-group">
                <label class="equipment-form-label">效果 2</label>
                <input type="text" id="gemEffect2" class="equipment-form-input" placeholder="词缀/属性/被动技能ID 或输入文字搜索" oninput="onGemEffectInput(this, 'gemPreview2', 'gemDropdown2')">
                <div class="autocomplete-dropdown" id="gemDropdown2"></div>
                <div class="effect-preview" id="gemPreview2"></div>
            </div>
            <div class="equipment-form-group">
                <label class="equipment-form-label">效果 3</label>
                <input type="text" id="gemEffect3" class="equipment-form-input" placeholder="词缀/属性/被动技能ID 或输入文字搜索" oninput="onGemEffectInput(this, 'gemPreview3', 'gemDropdown3')">
                <div class="autocomplete-dropdown" id="gemDropdown3"></div>
                <div class="effect-preview" id="gemPreview3"></div>
            </div>
            <div class="equipment-form-group">
                <label class="equipment-form-label">效果 4</label>
                <input type="text" id="gemEffect4" class="equipment-form-input" placeholder="词缀/属性/被动技能ID 或输入文字搜索" oninput="onGemEffectInput(this, 'gemPreview4', 'gemDropdown4')">
                <div class="autocomplete-dropdown" id="gemDropdown4"></div>
                <div class="effect-preview" id="gemPreview4"></div>
            </div>
            <div class="equipment-form-group">
                <label class="equipment-form-label">效果 5</label>
                <input type="text" id="gemEffect5" class="equipment-form-input" placeholder="词缀/属性/被动技能ID 或输入文字搜索" oninput="onGemEffectInput(this, 'gemPreview5', 'gemDropdown5')">
                <div class="autocomplete-dropdown" id="gemDropdown5"></div>
                <div class="effect-preview" id="gemPreview5"></div>
            </div>
            <div class="equipment-form-group">
                <label class="equipment-form-label">效果 6</label>
                <input type="text" id="gemEffect6" class="equipment-form-input" placeholder="词缀/属性/被动技能ID 或输入文字搜索" oninput="onGemEffectInput(this, 'gemPreview6', 'gemDropdown6')">
                <div class="autocomplete-dropdown" id="gemDropdown6"></div>
                <div class="effect-preview" id="gemPreview6"></div>
            </div>
        </div>

        <div class="equipment-form-actions">
            <button class="equipment-btn equipment-btn-cancel" onclick="closeModal()">取消</button>
            <button class="equipment-btn equipment-btn-save" onclick="submitAddGem()">保存宝石</button>
        </div>
    `;
    document.getElementById('skillModal').classList.add('active');
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

function submitAddGem() {
    const name = document.getElementById('gemName').value.trim();
    if (!name) {
        alert('请填写宝石名称');
        return;
    }
    const type = document.getElementById('gemType').value.trim();
    const desc = document.getElementById('gemDesc').value.trim();
    const effects = [];
    for (let i = 1; i <= 6; i++) {
        const val = document.getElementById('gemEffect' + i).value.trim();
        if (val) effects.push({ refId: val });
    }
    const newGem = {
        id: generateGemId(),
        name,
        type,
        desc,
        effects,
        source: 'manual',
        createdAt: new Date().toISOString()
    };
    gemData.push(newGem);
    saveGemData();
    closeModal();
    renderGems();
    updateNavCounts();
}

function openGemDetail(id) {
    const gem = gemData.find(g => g.id === id);
    if (!gem) return;
    if (!gem.effects) gem.effects = [];
    const effects = gem.effects;

    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = `
        <div class="detail-header" style="border-bottom-color:#9b59b6">
            <div class="detail-icon" style="background:#9b59b620;color:#9b59b6;font-size:36px;width:64px;height:64px;display:flex;align-items:center;justify-content:center;border-radius:12px">💎</div>
            <div style="flex:1">
                <h2 class="detail-name">
                    <input type="text" class="affix-edit-input affix-edit-name" value="${gem.name.replace(/"/g, '&quot;')}" oninput="updateGemField('${gem.id}', 'name', this.value)" placeholder="宝石名称">
                </h2>
                <div class="detail-type">
                    <span class="type-badge" style="background:#9b59b620;color:#9b59b6">辅助宝石</span>
                    <span class="type-badge-sub">${gem.id}</span>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <div class="detail-section-title-row">
                <h3 class="detail-section-title">宝石类型</h3>
                <span class="save-indicator">编辑后自动保存</span>
            </div>
            <input type="text" class="affix-edit-input" style="font-size:15px;padding:8px 12px;border:1px solid #ddd;border-radius:8px;width:100%;box-sizing:border-box" value="${(gem.type || '').replace(/"/g, '&quot;')}" oninput="updateGemField('${gem.id}', 'type', this.value)" placeholder="如：火焰/冰冷/物理/通用">
        </div>

        <div class="detail-section">
            <div class="detail-section-title-row">
                <h3 class="detail-section-title">宝石效果描述</h3>
            </div>
            <textarea class="affix-edit-input" style="font-size:14px;padding:8px 12px;border:1px solid #ddd;border-radius:8px;width:100%;box-sizing:border-box;resize:vertical;font-family:inherit;min-height:60px" oninput="updateGemField('${gem.id}', 'desc', this.value)" placeholder="辅助技能宝石的效果描述">${(gem.desc || '').replace(/</g, '&lt;')}</textarea>
        </div>

        <div class="detail-section">
            <h3 class="detail-section-title">关联效果（<span id="gemEffectCount">${effects.filter(e => e.refId).length}</span> 条）</h3>
            <div id="gemEffectList">
            ${effects.length === 0 ? '<p class="empty-hint">暂无关联效果，点击下方按钮添加</p>' : ''}
            ${effects.map((eff, idx) => {
                const refData = eff.refId ? findRefData(eff.refId) : null;
                const typeColor = refData ? (refData.type === 'active-skill' ? '#e74c3c' : refData.type === 'passive-skill' ? '#3498db' : refData.type === 'attribute' ? '#27ae60' : '#f39c12') : '#bbb';
                const typeLabel = refData ? (refData.type === 'active-skill' ? '主动技能' : refData.type === 'passive-skill' ? '被动技能' : refData.type === 'attribute' ? '属性效果' : '词缀') : '待填写';
                return `
                    <div class="equipment-effect-item" id="gemEffectItem-${idx}" style="border-left-color:${typeColor}">
                        <div class="equipment-effect-header">
                            <span class="effect-type-badge" id="gemEffectBadge-${idx}" style="background:${typeColor}20;color:${typeColor}">${typeLabel}</span>
                            <input type="text" class="equipment-effect-input" value="${eff.refId}" oninput="onEditGemEffectInput(this, '${gem.id}', ${idx})" placeholder="词缀/属性/被动技能ID 或输入文字搜索">
                            <button class="equipment-effect-delete" onclick="deleteGemEffect('${gem.id}', ${idx})">✕</button>
                        </div>
                        <div class="autocomplete-dropdown" id="editGemDropdown-${idx}"></div>
                        <div id="gemEffectInfo-${idx}">
                        ${refData ? `
                            <div class="equipment-effect-info">
                                <span class="equipment-effect-name">${refData.name}</span>
                                <span class="equipment-effect-cat">${refData.category} · ${refData.subCategory}</span>
                                <p class="equipment-effect-desc">${refData.desc}</p>
                            </div>
                        ` : (eff.refId ? '<div class="equipment-effect-error">⚠ 未找到ID: ' + eff.refId + '</div>' : '<div class="equipment-effect-hint">请输入词缀/属性/被动技能ID</div>')}
                        </div>
                    </div>
                `;
            }).join('')}
            </div>
            <button class="equipment-add-effect-btn" onclick="addGemEffect('${gem.id}')">+ 添加关联效果</button>
        </div>

        <div class="detail-section">
            <div class="new-toggle-row">
                <label class="new-toggle-label">
                    <input type="checkbox" id="newStatusCheckbox" ${gem.isNew ? 'checked' : ''} onchange="toggleNewStatus('${gem.id}', 'gem', '', this.checked)">
                    <span class="new-toggle-text">标记为版本新增</span>
                </label>
                <span class="new-toggle-hint">勾选后，外层列表将显示"新增"标签，并出现在"仅看新增"筛选结果中</span>
            </div>
        </div>

        <div class="detail-section">
            <button class="equipment-btn equipment-btn-delete" style="width:100%" onclick="deleteGem('${gem.id}')">删除此宝石</button>
        </div>
    `;
    document.getElementById('skillModal').classList.add('active');
}

function updateGemField(gemId, field, value) {
    const gem = gemData.find(g => g.id === gemId);
    if (!gem) return;
    gem[field] = value;
    saveGemData();
    syncGemCard(gemId);
}

function onEditGemEffectInput(inputEl, gemId, effectIdx) {
    const val = inputEl.value.trim();
    const dropdownEl = document.getElementById('editGemDropdown-' + effectIdx);

    updateGemEffect(gemId, effectIdx, val);

    if (!val) {
        if (dropdownEl) dropdownEl.innerHTML = '';
        return;
    }

    const refData = findRefData(val);
    if (refData && /^\d+$/.test(val)) {
        if (dropdownEl) dropdownEl.innerHTML = '';
        return;
    }

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
        <div class="autocomplete-item" onclick="selectEditGemEffectItem('${gemId}', ${effectIdx}, '${m.id}')">
            <span class="autocomplete-item-type" style="background:${m.typeColor}20;color:${m.typeColor}">${m.typeLabel}</span>
            <span class="autocomplete-item-id">${m.id}</span>
            <span class="autocomplete-item-name">${m.name}</span>
            <span class="autocomplete-item-desc">${m.desc.substring(0, 30)}</span>
        </div>
    `).join('') + '</div>';
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

function updateGemEffect(gemId, effectIdx, value) {
    const gem = gemData.find(g => g.id === gemId);
    if (!gem) return;
    if (!gem.effects) gem.effects = [];
    if (!gem.effects[effectIdx]) gem.effects[effectIdx] = { refId: '' };
    gem.effects[effectIdx].refId = value;

    const refData = findRefData(value);
    const infoEl = document.getElementById('gemEffectInfo-' + effectIdx);
    const badgeEl = document.getElementById('gemEffectBadge-' + effectIdx);

    if (badgeEl) {
        if (refData) {
            const label = refData.type === 'passive-skill' ? '被动技能' : refData.type === 'attribute' ? '属性效果' : refData.type === 'affix' ? '词缀' : refData.type === 'active-skill' ? '主动技能' : '效果';
            badgeEl.textContent = label;
        } else {
            badgeEl.textContent = '待填写';
        }
    }

    if (infoEl) {
        if (refData) {
            infoEl.innerHTML = `
                <div class="equipment-effect-info">
                    <span class="equipment-effect-name">${refData.name}</span>
                    <span class="equipment-effect-cat">${refData.category} · ${refData.subCategory}</span>
                    <p class="equipment-effect-desc">${refData.desc}</p>
                </div>
            `;
        } else if (value) {
            infoEl.innerHTML = '<div class="equipment-effect-error">⚠ 未找到ID: ' + value + '</div>';
        } else {
            infoEl.innerHTML = '<div class="equipment-effect-hint">请输入词缀/属性/被动技能ID</div>';
        }
    }

    const countEl = document.getElementById('gemEffectCount');
    if (countEl) {
        countEl.textContent = gem.effects.filter(e => e.refId).length;
    }

    saveGemData();
    syncGemCard(gemId);
}

function addGemEffect(gemId) {
    const gem = gemData.find(g => g.id === gemId);
    if (!gem) return;
    if (!gem.effects) gem.effects = [];
    gem.effects.push({ refId: '' });
    saveGemData();
    openGemDetail(gemId);
}

function deleteGemEffect(gemId, effectIdx) {
    const gem = gemData.find(g => g.id === gemId);
    if (!gem || !gem.effects) return;
    gem.effects.splice(effectIdx, 1);
    saveGemData();
    openGemDetail(gemId);
    syncGemCard(gemId);
}

function deleteGem(id) {
    if (!confirm('确定删除此辅助宝石吗？此操作不可撤销。')) return;
    gemData = gemData.filter(g => g.id !== id);
    saveGemData();
    closeModal();
    renderGems();
    updateNavCounts();
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
// 来源同步系统（技能库 / 辅助宝石 / 暗金装备）
// ============================================================

// 通用CSV解析（支持逗号和Tab分隔，自动检测3行表头格式）
function parseCSVText(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length === 0) return { headers: [], rows: [] };
    const sep = lines[0].includes('\t') ? '\t' : ',';

    // 检测是否为3行表头格式（中文 | 英文字段名 | 类型说明）
    const row1 = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, ''));
    const row2 = lines.length > 1 ? lines[1].split(sep).map(h => h.trim().replace(/^"|"$/g, '')) : [];
    const row3 = lines.length > 2 ? lines[2].split(sep).map(h => h.trim().replace(/^"|"$/g, '')) : [];

    // 判断row3是否为类型说明行（包含number/string/numberArr等关键词）
    const typeKeywords = ['number', 'string', 'bool', 'object', 'numberArr', 'number2', 'stringArr'];
    const isRow3TypeHints = row3.length > 0 && row3.some(h => typeKeywords.some(kw => h.toLowerCase().includes(kw)));

    // 判断row2是否为英文字段名行（包含字母和.符号，不含中文）
    const isRow2English = row2.length > 0 && row2.some(h => /[a-zA-Z]/.test(h)) && !row2.some(h => /[\u4e00-\u9fa5]/.test(h));

    let headers, dataStartIdx;
    if (isRow2English && isRow3TypeHints) {
        // 3行表头：使用英文行(row2)作为字段名，跳过row1和row3
        headers = row2;
        dataStartIdx = 3;
    } else if (isRow2English) {
        // 2行表头：英文行(row2)作为字段名
        headers = row2;
        dataStartIdx = 2;
    } else {
        // 标准格式：row1为表头
        headers = row1;
        dataStartIdx = 1;
    }

    const rows = [];
    for (let i = dataStartIdx; i < lines.length; i++) {
        const cols = lines[i].split(sep).map(c => c.trim().replace(/^"|"$/g, ''));
        const row = {};
        headers.forEach((h, idx) => { row[h] = cols[idx] !== undefined ? cols[idx] : ''; });
        rows.push(row);
    }
    return { headers, rows };
}

function readCSVFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => {
            try { resolve(parseCSVText(e.target.result)); }
            catch (err) { reject(err); }
        };
        reader.onerror = () => reject(new Error('文件读取失败'));
        reader.readAsText(file, 'utf-8');
    });
}

// 清理Excel数值格式：90001.0 → 90001
function cleanNum(v) {
    return String(v).replace(/\.0+$/, '').trim();
}

// 从Excel文件中读取指定子表，返回 { headers, rows } 格式
// sheetKeywords: 用于匹配子表名的关键词数组（如 ['SkillActive', '技能']）
function readExcelSheet(file, sheetKeywords) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const data = new Uint8Array(e.target.result);
                const wb = XLSX.read(data, { type: 'array' });

                // 查找匹配的子表
                let targetSheet = null;
                if (sheetKeywords && sheetKeywords.length > 0) {
                    for (const name of wb.SheetNames) {
                        for (const kw of sheetKeywords) {
                            if (name.includes(kw) || name.toLowerCase().includes(kw.toLowerCase())) {
                                targetSheet = name;
                                break;
                            }
                        }
                        if (targetSheet) break;
                    }
                }
                // 未找到匹配子表，使用第一个表
                if (!targetSheet) {
                    targetSheet = wb.SheetNames[0];
                }

                const sheet = wb.Sheets[targetSheet];
                // 转为二维数组（header:1 模式），raw:true 确保读取原始值不被格式化
                const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
                if (rawRows.length === 0) {
                    resolve({ headers: [], rows: [], sheetName: targetSheet });
                    return;
                }

                // 检测3行表头格式（与CSV解析逻辑一致）
                const row1 = rawRows[0].map(h => String(h).trim());
                const row2 = rawRows.length > 1 ? rawRows[1].map(h => String(h).trim()) : [];
                const row3 = rawRows.length > 2 ? rawRows[2].map(h => String(h).trim()) : [];

                const typeKeywords = ['number', 'string', 'bool', 'object', 'numberArr', 'number2', 'stringArr'];
                const isRow3TypeHints = row3.length > 0 && row3.some(h => typeKeywords.some(kw => h.toLowerCase().includes(kw)));
                const isRow2English = row2.length > 0 && row2.some(h => /[a-zA-Z]/.test(h)) && !row2.some(h => /[\u4e00-\u9fa5]/.test(h));

                let headers, dataStartIdx;
                if (isRow2English && isRow3TypeHints) {
                    headers = row2;
                    dataStartIdx = 3;
                } else if (isRow2English) {
                    headers = row2;
                    dataStartIdx = 2;
                } else {
                    headers = row1;
                    dataStartIdx = 1;
                }

                const rows = [];
                for (let i = dataStartIdx; i < rawRows.length; i++) {
                    const cols = rawRows[i].map(c => String(c).trim());
                    const row = {};
                    headers.forEach((h, idx) => { row[h] = cols[idx] !== undefined ? cols[idx] : ''; });
                    rows.push(row);
                }

                resolve({ headers, rows, sheetName: targetSheet });
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error('Excel文件读取失败'));
        reader.readAsArrayBuffer(file);
    });
}

// 从Excel中查找包含指定列的工作表（按列内容匹配，不只按名称）
// requiredCols: 必须包含的列名数组（如 ['stunt', 'affix', 'attr']）
// sheetKeywords: 优先按名称匹配的工作表关键词
function readExcelSheetByCols(file, requiredCols, sheetKeywords) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const data = new Uint8Array(e.target.result);
                const wb = XLSX.read(data, { type: 'array' });

                // 解析单个sheet的表头
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

                // 检查表头是否包含所有必需列（不区分大小写）
                const hasAllCols = (headers, cols) => {
                    return cols.every(col => headers.some(h => h.toLowerCase() === col.toLowerCase()));
                };

                let targetSheet = null;

                // 策略1: 先按名称匹配，再验证列
                if (sheetKeywords) {
                    for (const name of wb.SheetNames) {
                        for (const kw of sheetKeywords) {
                            if (name.includes(kw) || name.toLowerCase().includes(kw.toLowerCase())) {
                                const headers = parseSheetHeaders(name);
                                if (hasAllCols(headers, requiredCols)) {
                                    targetSheet = name;
                                    break;
                                }
                            }
                        }
                        if (targetSheet) break;
                    }
                }

                // 策略2: 遍历所有工作表，找包含所有必需列的
                if (!targetSheet) {
                    for (const name of wb.SheetNames) {
                        const headers = parseSheetHeaders(name);
                        if (hasAllCols(headers, requiredCols)) {
                            targetSheet = name;
                            break;
                        }
                    }
                }

                // 策略3: 回退到按名称匹配（不验证列）
                if (!targetSheet && sheetKeywords) {
                    for (const name of wb.SheetNames) {
                        for (const kw of sheetKeywords) {
                            if (name.includes(kw) || name.toLowerCase().includes(kw.toLowerCase())) {
                                targetSheet = name;
                                break;
                            }
                        }
                        if (targetSheet) break;
                    }
                }

                // 策略4: 使用第一个工作表
                if (!targetSheet) targetSheet = wb.SheetNames[0];

                // 用 readExcelSheet 的逻辑解析目标工作表
                const sheet = wb.Sheets[targetSheet];
                const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
                if (rawRows.length === 0) {
                    resolve({ headers: [], rows: [], sheetName: targetSheet });
                    return;
                }

                const row1 = rawRows[0].map(h => String(h).trim());
                const row2 = rawRows.length > 1 ? rawRows[1].map(h => String(h).trim()) : [];
                const row3 = rawRows.length > 2 ? rawRows[2].map(h => String(h).trim()) : [];

                const typeKeywords = ['number', 'string', 'bool', 'object', 'numberArr', 'number2', 'stringArr'];
                const isRow3TypeHints = row3.length > 0 && row3.some(h => typeKeywords.some(kw => h.toLowerCase().includes(kw)));
                const isRow2English = row2.length > 0 && row2.some(h => /[a-zA-Z]/.test(h)) && !row2.some(h => /[\u4e00-\u9fa5]/.test(h));

                let headers, dataStartIdx;
                if (isRow2English && isRow3TypeHints) {
                    headers = row2;
                    dataStartIdx = 3;
                } else if (isRow2English) {
                    headers = row2;
                    dataStartIdx = 2;
                } else {
                    headers = row1;
                    dataStartIdx = 1;
                }

                const rows = [];
                for (let i = dataStartIdx; i < rawRows.length; i++) {
                    const cols = rawRows[i].map(c => String(c).trim());
                    const row = {};
                    headers.forEach((h, idx) => { row[h] = cols[idx] !== undefined ? cols[idx] : ''; });
                    rows.push(row);
                }

                resolve({ headers, rows, sheetName: targetSheet });
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error('Excel文件读取失败'));
        reader.readAsArrayBuffer(file);
    });
}

// ---- 技能库来源同步 ----
const syncCSFile = { file: null };

function showSyncCustomSkillModal() {
    const lastFile = (() => { try { return localStorage.getItem('sync_cs_file'); } catch(e) { return null; } })();
    const hasCached = !!syncCSFile.file;

    document.getElementById('modalBody').innerHTML = `
        <div class="detail-header" style="border-bottom-color:#e67e22">
            <div class="detail-icon" style="background:#e67e2220;color:#e67e22;font-size:36px;width:64px;height:64px;display:flex;align-items:center;justify-content:center;border-radius:12px">🔄</div>
            <div style="flex:1">
                <h2 class="detail-name">技能库来源同步</h2>
                <div class="detail-type"><span class="type-badge" style="background:#e67e2220;color:#e67e22">Excel同步</span></div>
            </div>
        </div>
        <div class="detail-section">
            <p class="equipment-form-hint" style="margin-bottom:16px">
                选择包含 <strong>SkillActive</strong> 子表的Excel文件。<br>
                系统自动查找名为"SkillActive"或"技能"的工作表<br>
                <strong>skill/stunt</strong> → 映射战斗数据中的技能ID，读取效果描述<br>
                ${lastFile ? '<span style="color:#27ae60">上次: ' + lastFile + '</span>' : ''}
            </p>
        </div>
        ${hasCached ? `
        <div class="detail-section" style="background:#27ae6010;border:1px solid #27ae6030;border-radius:8px;padding:16px">
            <p style="color:#27ae60;font-weight:600;font-size:14px;margin-bottom:12px">✓ 已缓存文件：${syncCSFile.file.name}</p>
            <button class="equipment-btn equipment-btn-save" style="width:100%" onclick="executeSyncCustomSkill()">⚡ 直接同步</button>
        </div>
        ` : ''}
        <div class="detail-section">
            <div class="sync-folder-group">
                <label class="sync-folder-label">选择 Excel 文件（含SkillActive子表）</label>
                <div class="sync-folder-row">
                    <input type="file" id="syncCSFileInput" accept=".xlsx,.xls" style="display:none" onchange="onSyncCSFileSelected(this)">
                    <button class="equipment-btn" onclick="document.getElementById('syncCSFileInput').click()">选择文件</button>
                    <span class="sync-status" id="syncCSStatus">${hasCached ? '已缓存' : '未选择'}</span>
                </div>
            </div>
        </div>
        <div class="detail-section">
            <div class="sync-result" id="syncCSResult"></div>
            <button class="equipment-btn equipment-btn-save" style="width:100%;margin-top:12px" onclick="executeSyncCustomSkill()" id="syncCSExecBtn" ${hasCached ? '' : 'disabled'}>开始同步</button>
        </div>
        <div class="equipment-form-actions">
            <button class="equipment-btn equipment-btn-cancel" onclick="closeModal()">关闭</button>
        </div>
    `;
    document.getElementById('skillModal').classList.add('active');
}

function onSyncCSFileSelected(input) {
    const file = input.files[0];
    const statusEl = document.getElementById('syncCSStatus');
    if (!file) {
        statusEl.textContent = '未选择';
        syncCSFile.file = null;
    } else {
        syncCSFile.file = file;
        statusEl.textContent = '✓ 已选择 ' + file.name;
        statusEl.className = 'sync-status sync-status-ok';
        try { localStorage.setItem('sync_cs_file', file.name); } catch(e) {}
    }
    const btn = document.getElementById('syncCSExecBtn');
    if (btn) btn.disabled = !syncCSFile.file;
}

function executeSyncCustomSkill() {
    if (!syncCSFile.file) return;
    const resultEl = document.getElementById('syncCSResult');
    resultEl.innerHTML = '<p style="color:#999">正在解析...</p>';

    readExcelSheet(syncCSFile.file, ['SkillActive', '技能']).then(({ headers, rows, sheetName }) => {
        const findCol = (names) => {
            for (const n of names) {
                const idx = headers.findIndex(h => h === n || h.toLowerCase() === n.toLowerCase());
                if (idx >= 0) return headers[idx];
            }
            return null;
        };
        // SkillActive.CSV字段：id.p(技能ID), skill(对应战斗技能表id), stunt(对应特技id)
        const idCol = findCol(['id.p', 'id', 'ID']);
        const skillCol = findCol(['skill', 'Skill', 'SKILL']);
        const stuntCol = findCol(['stunt', 'Stunt', 'STUNT']);
        const desc999Col = findCol(['desc999', 'Desc999', 'DESC999']);

        // 同步前：清除旧的 sync 来源技能数据，保留手动添加的数据
        const manualSkills = customSkillData.filter(s => s.source === 'manual');
        customSkillData.length = 0;
        customSkillData.push(...manualSkills);

        // 去重：以 sourceId 作为唯一标识（针对手动添加的数据）
        const existingSkillMap = {};
        customSkillData.forEach(s => { if (s.sourceId) existingSkillMap[s.sourceId] = s; });
        let newSkillCount = 0;
        let skipSkillCount = 0;
        let updateSkillCount = 0;
        rows.forEach(row => {
            const skillId = skillCol ? (row[skillCol] || '').trim() : '';
            const stuntId = stuntCol ? (row[stuntCol] || '').trim() : '';
            const refId = skillId || stuntId;
            if (!refId) return;

            // 技能名：优先从desc999取，否则从战斗数据映射ID查找名称
            let name = desc999Col ? (row[desc999Col] || '').trim() : '';
            let desc = '';
            let type = '未分类';

            const refData = findRefData(refId);
            if (refData) {
                if (!name) name = refData.name || '';
                desc = refData.desc || '';
                if (refId[0] === '1') {
                    type = '主动技能';
                } else {
                    type = '被动技能';
                }
            }
            if (!name) name = '未命名技能_' + refId;

            // 已存在：效果为空则更新，有效果则跳过
            if (existingSkillMap[refId]) {
                const existing = existingSkillMap[refId];
                const hasEffects = existing.effects && existing.effects.some(e => e.refId);
                if (!hasEffects) {
                    existing.effects = [{ refId: refId }];
                    if (desc) existing.desc = desc;
                    if (type) existing.type = type;
                    updateSkillCount++;
                } else {
                    skipSkillCount++;
                }
                return;
            }

            const newSkill = {
                id: '',
                name: name,
                type: type,
                desc: desc,
                sourceId: refId,
                effects: [{ refId: refId }],
                isNew: true,
                source: 'sync',
                createdAt: new Date().toISOString()
            };
            customSkillData.push(newSkill);
            newSkill.id = generateCustomSkillId();
            newSkillCount++;
            existingSkillMap[refId] = { effects: [{ refId: refId }] };
        });

        saveCustomSkillData();
        renderCustomSkills();
        updateCustomSkillNavCount();

        resultEl.innerHTML = `
            <div style="background:#27ae6010;border:1px solid #27ae6030;border-radius:8px;padding:16px">
                <p style="color:#27ae60;font-weight:600;font-size:15px;margin-bottom:8px">✓ 同步完成！</p>
                <p style="color:#666;font-size:13px">新增技能：${newSkillCount} 个</p>
                <p style="color:#666;font-size:13px">更新效果：${updateSkillCount} 个</p>
                <p style="color:#666;font-size:13px">跳过重复：${skipSkillCount} 个</p>
                <p style="color:#666;font-size:13px">当前技能总数：${customSkillData.length} 个</p>
            </div>
        `;
    }).catch(err => {
        resultEl.innerHTML = '<div style="color:#e74c3c;padding:12px">✗ 同步失败：' + err.message + '</div>';
    });
}

// ---- 辅助技能宝石库来源同步 ----
const syncGemFile = { file: null };

function showSyncGemModal() {
    const lastFile = (() => { try { return localStorage.getItem('sync_gem_file'); } catch(e) { return null; } })();
    const hasCached = !!syncGemFile.file;

    document.getElementById('modalBody').innerHTML = `
        <div class="detail-header" style="border-bottom-color:#9b59b6">
            <div class="detail-icon" style="background:#9b59b620;color:#9b59b6;font-size:36px;width:64px;height:64px;display:flex;align-items:center;justify-content:center;border-radius:12px">🔄</div>
            <div style="flex:1">
                <h2 class="detail-name">辅助宝石来源同步</h2>
                <div class="detail-type"><span class="type-badge" style="background:#9b59b620;color:#9b59b6">Excel同步</span></div>
            </div>
        </div>
        <div class="detail-section">
            <p class="equipment-form-hint" style="margin-bottom:16px">
                选择包含 <strong>SkillGem</strong> 子表的Excel文件。<br>
                系统自动查找名为"SkillGem"或"宝石"的工作表<br>
                <strong>name</strong> → 宝石名称<br>
                <strong>desc</strong> → 宝石描述<br>
                <strong>skillAffix / stunt / attr</strong> → 映射战斗数据中的词缀/被动/属性，展示ID和效果<br>
                ${lastFile ? '<span style="color:#27ae60">上次: ' + lastFile + '</span>' : ''}
            </p>
        </div>
        ${hasCached ? `
        <div class="detail-section" style="background:#27ae6010;border:1px solid #27ae6030;border-radius:8px;padding:16px">
            <p style="color:#27ae60;font-weight:600;font-size:14px;margin-bottom:12px">✓ 已缓存文件：${syncGemFile.file.name}</p>
            <button class="equipment-btn equipment-btn-save" style="width:100%" onclick="executeSyncGem()">⚡ 直接同步</button>
        </div>
        ` : ''}
        <div class="detail-section">
            <div class="sync-folder-group">
                <label class="sync-folder-label">选择 Excel 文件（含SkillGem子表）</label>
                <div class="sync-folder-row">
                    <input type="file" id="syncGemFileInput" accept=".xlsx,.xls" style="display:none" onchange="onSyncGemFileSelected(this)">
                    <button class="equipment-btn" onclick="document.getElementById('syncGemFileInput').click()">选择文件</button>
                    <span class="sync-status" id="syncGemStatus">${hasCached ? '已缓存' : '未选择'}</span>
                </div>
            </div>
        </div>
        <div class="detail-section">
            <div class="sync-result" id="syncGemResult"></div>
            <button class="equipment-btn equipment-btn-save" style="width:100%;margin-top:12px" onclick="executeSyncGem()" id="syncGemExecBtn" ${hasCached ? '' : 'disabled'}>开始同步</button>
        </div>
        <div class="equipment-form-actions">
            <button class="equipment-btn equipment-btn-cancel" onclick="closeModal()">关闭</button>
        </div>
    `;
    document.getElementById('skillModal').classList.add('active');
}

function onSyncGemFileSelected(input) {
    const file = input.files[0];
    const statusEl = document.getElementById('syncGemStatus');
    if (!file) {
        statusEl.textContent = '未选择';
        syncGemFile.file = null;
    } else {
        syncGemFile.file = file;
        statusEl.textContent = '✓ 已选择 ' + file.name;
        statusEl.className = 'sync-status sync-status-ok';
        try { localStorage.setItem('sync_gem_file', file.name); } catch(e) {}
    }
    const btn = document.getElementById('syncGemExecBtn');
    if (btn) btn.disabled = !syncGemFile.file;
}

function executeSyncGem() {
    if (!syncGemFile.file) return;
    const resultEl = document.getElementById('syncGemResult');
    resultEl.innerHTML = '<p style="color:#999">正在解析...</p>';

    readExcelSheet(syncGemFile.file, ['SkillGem', '宝石']).then(({ headers, rows }) => {
        const findCol = (names) => {
            for (const n of names) {
                const idx = headers.findIndex(h => h === n || h.toLowerCase() === n.toLowerCase());
                if (idx >= 0) return headers[idx];
            }
            return null;
        };
        const nameCol = findCol(['name', 'Name', 'NAME', '名称']);
        const descCol = findCol(['desc', 'Desc', 'DESC', '描述']);
        const affixCol = findCol(['skillAffix', 'SkillAffix', 'affix', 'Affix', '词缀id']);
        const stuntCol = findCol(['stunt', 'Stunt', 'STUNT', '被动表id']);
        const attrCol = findCol(['attr', 'Attr', 'ATTR', '提供属性-启用加属性', '提供属性']);
        const gemIdCol = findCol(['id.p', 'id', 'ID']);

        if (!nameCol) {
            resultEl.innerHTML = '<div style="color:#e74c3c;padding:12px">✗ 未找到 name 列</div>';
            return;
        }

        // 同步前：清除旧的 sync 来源宝石数据，保留手动添加的数据
        const manualGems = gemData.filter(g => g.source === 'manual');
        gemData.length = 0;
        gemData.push(...manualGems);

        // 去重：以 id.p (sourceId) 作为唯一标识（针对手动添加的数据）
        const existingGemMap = {};
        gemData.forEach(g => { if (g.sourceId) existingGemMap[g.sourceId] = g; });
        let newGemCount = 0;
        let skipGemCount = 0;
        let updateGemCount = 0;
        let gemEffectTotal = 0;
        rows.forEach(row => {
            const name = row[nameCol] || '';
            if (!name.trim()) return;
            const gemSourceId = gemIdCol ? cleanNum(row[gemIdCol]) : '';
            const desc = descCol ? row[descCol] : '';
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

            // 以 sourceId (id.p) 去重：已存在则更新，不存在则新增
            if (gemSourceId && existingGemMap[gemSourceId]) {
                const existing = existingGemMap[gemSourceId];
                existing.name = name.trim();
                existing.desc = desc.trim();
                existing.effects = effects;
                updateGemCount++;
                return;
            }

            const newGem = {
                id: '',
                name: name.trim(),
                type: '辅助宝石',
                desc: desc.trim(),
                effects: effects,
                sourceId: gemSourceId,
                isNew: true,
                source: 'sync',
                createdAt: new Date().toISOString()
            };
            gemData.push(newGem);
            newGem.id = generateGemId();
            newGemCount++;
            gemEffectTotal += effects.length;
            if (gemSourceId) existingGemMap[gemSourceId] = { effects };
        });

        saveGemData();
        renderGems();
        const _gemNav = document.getElementById('gemCount'); if (_gemNav) _gemNav.textContent = gemData.length;

        resultEl.innerHTML = `
            <div style="background:#27ae6010;border:1px solid #27ae6030;border-radius:8px;padding:16px">
                <p style="color:#27ae60;font-weight:600;font-size:15px;margin-bottom:8px">✓ 同步完成！</p>
                <p style="color:#666;font-size:13px">新增宝石：${newGemCount} 个</p>
                <p style="color:#666;font-size:13px">更新效果：${updateGemCount} 个</p>
                <p style="color:#666;font-size:13px">跳过重复：${skipGemCount} 个</p>
                <p style="color:#666;font-size:13px">关联效果总数：${gemEffectTotal} 条</p>
            </div>
        `;
    }).catch(err => {
        resultEl.innerHTML = '<div style="color:#e74c3c;padding:12px">✗ 同步失败：' + err.message + '</div>';
    });
}

// ---- 暗金装备来源同步 ----
const syncEquipFile = { file: null };

function showSyncEquipModal() {
    const lastFile = (() => { try { return localStorage.getItem('sync_equip_file'); } catch(e) { return null; } })();
    const hasCached = !!syncEquipFile.file;

    document.getElementById('modalBody').innerHTML = `
        <div class="detail-header" style="border-bottom-color:#e67e22">
            <div class="detail-icon" style="background:#e67e2220;color:#e67e22;font-size:36px;width:64px;height:64px;display:flex;align-items:center;justify-content:center;border-radius:12px">🔄</div>
            <div style="flex:1">
                <h2 class="detail-name">暗金装备来源同步</h2>
                <div class="detail-type"><span class="type-badge" style="background:#e67e2220;color:#e67e22">Excel同步</span></div>
            </div>
        </div>
        <div class="detail-section">
            <p class="equipment-form-hint" style="margin-bottom:16px">
                选择包含 <strong>LegendEquip</strong> 和 <strong>Modifier</strong> 两个子表的Excel文件。<br>
                系统自动查找名为"LegendEquip"/"装备"和"Modifier"/"词条"的工作表<br>
                <strong>LegendEquip子表</strong>：name + desc999 → 装备名称，modifier1 + modifier2 → 词条ID<br>
                <strong>Modifier子表</strong>：词条ID映射，stunt/affix/attr → 战斗数据中的被动/词缀/属性效果<br>
                ${lastFile ? '<span style="color:#27ae60">上次: ' + lastFile + '</span>' : ''}
            </p>
        </div>
        ${hasCached ? `
        <div class="detail-section" style="background:#27ae6010;border:1px solid #27ae6030;border-radius:8px;padding:16px">
            <p style="color:#27ae60;font-weight:600;font-size:14px;margin-bottom:12px">✓ 已缓存文件：${syncEquipFile.file.name}</p>
            <button class="equipment-btn equipment-btn-save" style="width:100%" onclick="executeSyncEquip()">⚡ 直接同步</button>
        </div>
        ` : ''}
        <div class="detail-section">
            <div class="sync-folder-group">
                <label class="sync-folder-label">选择 Excel 文件（含LegendEquip + Modifier子表）</label>
                <div class="sync-folder-row">
                    <input type="file" id="syncEquipFileInput" accept=".xlsx,.xls" style="display:none" onchange="onSyncEquipFileSelected(this)">
                    <button class="equipment-btn" onclick="document.getElementById('syncEquipFileInput').click()">选择文件</button>
                    <span class="sync-status" id="syncEquipStatus">${hasCached ? '✓ 已缓存' : '未选择'}</span>
                </div>
            </div>
        </div>
        <div class="detail-section">
            <div class="sync-result" id="syncEquipResult"></div>
            <button class="equipment-btn equipment-btn-save" style="width:100%;margin-top:12px" onclick="executeSyncEquip()" id="syncEquipExecBtn" ${hasCached ? '' : 'disabled'}>开始同步</button>
        </div>
        <div class="equipment-form-actions">
            <button class="equipment-btn equipment-btn-cancel" onclick="closeModal()">关闭</button>
        </div>
    `;
    document.getElementById('skillModal').classList.add('active');
}

function onSyncEquipFileSelected(input) {
    const file = input.files[0];
    const statusEl = document.getElementById('syncEquipStatus');
    if (!file) {
        statusEl.textContent = '未选择';
        syncEquipFile.file = null;
    } else {
        syncEquipFile.file = file;
        statusEl.textContent = '✓ 已选择 ' + file.name;
        statusEl.className = 'sync-status sync-status-ok';
        try { localStorage.setItem('sync_equip_file', file.name); } catch(e) {}
    }
    const btn = document.getElementById('syncEquipExecBtn');
    if (btn) btn.disabled = !syncEquipFile.file;
}

function executeSyncEquip() {
    if (!syncEquipFile.file) return;
    const resultEl = document.getElementById('syncEquipResult');
    resultEl.innerHTML = '<p style="color:#999">正在解析...</p>';

    // 从同一个Excel文件中分别读取LegendEquip和Modifier两个子表
    Promise.all([
        readExcelSheet(syncEquipFile.file, ['LegendEquip', '装备']),
        readExcelSheetByCols(syncEquipFile.file, ['stunt', 'affix', 'attr'], ['Modifier', '词条', 'modifier'])
    ]).then(([legendData, modData]) => {
        const { headers: legendHeaders, rows: legendRows } = legendData;
        const { headers: modHeaders, rows: modRows } = modData;

        const findCol = (headers, names) => {
            for (const n of names) {
                const idx = headers.findIndex(h => h === n || h.toLowerCase() === n.toLowerCase());
                if (idx >= 0) return headers[idx];
            }
            return null;
        };

        // 解析 Modifier → 构建词条映射表（每个id取第一条记录）
        const modIdCol = findCol(modHeaders, ['id', 'ID', 'Id', 'id.p', 'modifierId', 'ModifierId']);
        const modStuntCol = findCol(modHeaders, ['stunt', 'Stunt', 'STUNT', '特技']);
        const modAffixCol = findCol(modHeaders, ['affix', 'Affix', 'AFFIX', 'skillAffix', 'SkillAffix', '效果']);
        const modAttrCol = findCol(modHeaders, ['attr', 'Attr', 'ATTR', 'attribute', 'Attribute', '提供属性']);
        const modDescCol = findCol(modHeaders, ['desc', 'Desc', 'DESC', '描述']);

        const modifierMap = {};
        let modDebugCount = 0;
        modRows.forEach(row => {
            const modId = modIdCol ? cleanNum(row[modIdCol]) : '';
            if (!modId) return;
            if (modifierMap[modId]) return;

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
            const modDesc = modDescCol ? (row[modDescCol] || '').trim() : '';
            modifierMap[modId] = { effects, desc: modDesc };
            modDebugCount++;
        });

        // 解析 LegendEquip → 生成装备
        const nameCol = findCol(legendHeaders, ['name', 'Name', 'NAME', '前称号']);
        const desc998Col = findCol(legendHeaders, ['desc998', 'Desc998', 'DESC998']);
        const desc999Col = findCol(legendHeaders, ['desc999', 'Desc999', 'DESC999']);
        const mod1Col = findCol(legendHeaders, ['modifier1', 'Modifier1', 'MODIFIER1', 'mod1', 'Mod1', '前缀词条']);
        const mod2Col = findCol(legendHeaders, ['modifier2', 'Modifier2', 'MODIFIER2', 'mod2', 'Mod2', '后缀词条']);
        const idCol = findCol(legendHeaders, ['id.p', 'id', 'ID', 'ID.p']);

        if (!nameCol) {
            resultEl.innerHTML = '<div style="color:#e74c3c;padding:12px">✗ 未找到 name 列<br><span style="font-size:12px;color:#999">LegendEquip子表列: ' + legendHeaders.join(', ') + '</span></div>';
            return;
        }

        // 同步前：清除旧的 sync 来源装备数据，保留手动添加的数据
        const manualEquips = equipmentData.filter(e => e.source === 'manual');
        equipmentData.length = 0;
        equipmentData.push(...manualEquips);

        // 去重：以 id.p (sourceId) 作为唯一标识（针对手动添加的数据）
        const existingEquipMap = {};
        equipmentData.forEach(e => { if (e.sourceId) existingEquipMap[e.sourceId] = e; });
        let newEquipCount = 0;
        let skipEquipCount = 0;
        let updateEquipCount = 0;
        let equipEffectTotal = 0;
        legendRows.forEach(row => {
            const name = row[nameCol] || '';
            if (!name.trim()) return;

            const desc999 = desc999Col ? (row[desc999Col] || '').trim() : '';
            const equipName = name.trim() + (desc999 ? ' - ' + desc999 : '');
            const equipSourceId = idCol ? cleanNum(row[idCol]) : '';

            // 计算装备类型
            let equipType = '暗金装备';
            if (desc998Col && row[desc998Col] && row[desc998Col].trim()) {
                equipType = row[desc998Col].trim();
            } else if (equipSourceId) {
                const prefix = equipSourceId.substring(0, 3);
                const idTypeMap = {
                    '110': '武器', '120': '头盔', '130': '护甲',
                    '140': '护盾', '150': '鞋子', '160': '手套', '190': '饰品'
                };
                if (idTypeMap[prefix]) equipType = idTypeMap[prefix];
            }

            // 计算效果：modifier1 + modifier2 → Modifier表 → stunt/affix/attr
            const mod1Ids = mod1Col ? String(row[mod1Col] || '').split('|').map(s => cleanNum(s)).filter(s => s) : [];
            const mod2Ids = mod2Col ? String(row[mod2Col] || '').split('|').map(s => cleanNum(s)).filter(s => s) : [];
            const allModIds = [...mod1Ids, ...mod2Ids];

            const effects = [];
            allModIds.forEach(modId => {
                const cleanModId = cleanNum(modId);
                if (modifierMap[cleanModId]) {
                    modifierMap[cleanModId].effects.forEach(eff => effects.push({ refId: eff.refId }));
                }
            });

            // 以 sourceId (id.p) 去重：已存在则更新效果，不存在则新增
            if (equipSourceId && existingEquipMap[equipSourceId]) {
                const existing = existingEquipMap[equipSourceId];
                existing.name = equipName;
                existing.type = equipType;
                existing.effects = effects;
                updateEquipCount++;
                return;
            }

            const newEq = {
                id: '',
                name: equipName,
                type: equipType,
                effects: effects,
                sourceId: equipSourceId,
                isNew: true,
                source: 'sync',
                createdAt: new Date().toISOString()
            };
            equipmentData.push(newEq);
            newEq.id = generateEquipmentId();
            newEquipCount++;
            equipEffectTotal += effects.length;
            if (equipSourceId) existingEquipMap[equipSourceId] = { effects };
        });

        saveEquipmentData();
        renderEquipment();
        const _eqNav = document.getElementById('equipmentCount'); if (_eqNav) _eqNav.textContent = equipmentData.length;

        resultEl.innerHTML = `
            <div style="background:#27ae6010;border:1px solid #27ae6030;border-radius:8px;padding:16px">
                <p style="color:#27ae60;font-weight:600;font-size:15px;margin-bottom:8px">✓ 同步完成！</p>
                <p style="color:#666;font-size:13px">LegendEquip子表：${legendData.sheetName}（${legendRows.length}行）</p>
                <p style="color:#666;font-size:13px">Modifier子表：${modData.sheetName}（${modRows.length}行）</p>
                <p style="color:#666;font-size:13px">LegendEquip列名：${legendHeaders.join(', ')}</p>
                <p style="color:#666;font-size:13px">Modifier列名：${modHeaders.join(', ')}</p>
                <p style="color:#666;font-size:13px">词条映射：${Object.keys(modifierMap).length} 条</p>
                <p style="color:#666;font-size:13px">新增装备：${newEquipCount} 件</p>
                <p style="color:#666;font-size:13px">更新效果：${updateEquipCount} 件</p>
                <p style="color:#666;font-size:13px">跳过重复：${skipEquipCount} 件</p>
                <p style="color:#666;font-size:13px">关联效果总数：${equipEffectTotal} 条</p>
                ${(() => {
                    // 显示第一条装备的详细调试信息
                    if (legendRows.length === 0) return '';
                    const r = legendRows[0];
                    const rName = nameCol ? String(r[nameCol] || '') : '(无name列)';
                    const rId = idCol ? String(r[idCol] || '') : '(无id列)';
                    const rMod1 = mod1Col ? String(r[mod1Col] || '') : '(无mod1列)';
                    const rMod2 = mod2Col ? String(r[mod2Col] || '') : '(无mod2列)';
                    const m1Ids = rMod1.split('|').map(s => cleanNum(s)).filter(s => s);
                    const m2Ids = rMod2.split('|').map(s => cleanNum(s)).filter(s => s);
                    const debugEffects = [];
                    [...m1Ids, ...m2Ids].forEach(mid => {
                        const cmid = cleanNum(mid);
                        const found = modifierMap[cmid];
                        debugEffects.push(`${cmid} → ${found ? '[' + found.effects.map(e => e.refId).join(',') + ']' : '未找到'}`);
                    });
                    return `<div style="margin-top:8px;padding:8px;background:#fff;border-radius:4px;font-size:12px;color:#999">
                        <b>调试-第一条装备:</b><br>
                        name列值: "${rName}"<br>
                        id列值: "${rId}"<br>
                        modifier1列值: "${rMod1}" → [${m1Ids.join(', ')}]<br>
                        modifier2列值: "${rMod2}" → [${m2Ids.join(', ')}]<br>
                        映射结果: ${debugEffects.join(' | ')}
                    </div>`;
                })()}
            </div>
        `;
    }).catch(err => {
        resultEl.innerHTML = '<div style="color:#e74c3c;padding:12px">✗ 同步失败：' + err.message + '</div>';
    });
}

// ============================================================
// 自定义技能系统
// ============================================================
function renderCustomSkills(filteredData) {
    const grid = document.getElementById('customSkillGrid');
    if (!grid) return;
    const data = filteredData || customSkillData;

    if (data.length === 0) {
        grid.innerHTML = `
            <div class="equipment-empty">
                <div class="equipment-empty-icon">🏹</div>
                <p>${customSkillData.length === 0 ? '暂无技能数据' : '未找到匹配的技能'}</p>
                <p class="equipment-empty-hint">${customSkillData.length === 0 ? '点击上方"添加技能"按钮创建第一个技能' : '尝试其他搜索关键词'}</p>
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
                        <span class="equipment-card-icon">${style.icon}</span>
                        <div>
                            <h4 class="equipment-card-name">${s.name} ${s.isNew ? '<span class="new-tag">新增</span>' : ''}</h4>
                            <span class="equipment-card-id">${s.id}</span>
                        </div>
                    </div>
                    <span class="equipment-card-type">${s.type || '未分类'}</span>
                    ${s.desc ? `<p class="equipment-card-effect-desc" style="margin:4px 0;padding:4px 8px;background:#f8f8f8;border-radius:6px;font-size:12px;color:#666">${s.desc}</p>` : ''}
                    <div class="equipment-card-effects">
                        <span class="equipment-effect-count">关联效果 (${effectCount} 条)</span>
                        <div class="equipment-card-effect-list">
                            ${effectItems || '<p class="equipment-card-effect-empty">暂无关联效果</p>'}
                        </div>
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
    const searchEl = document.getElementById('customSkillSearchInput');
    if (!searchEl) return;
    const search = searchEl.value.toLowerCase();
    const newOnly = document.getElementById('customSkillNewOnly') ? document.getElementById('customSkillNewOnly').checked : false;
    const typeFilter = document.getElementById('customSkillTypeFilter') ? document.getElementById('customSkillTypeFilter').value : '';
    const filtered = customSkillData.filter(s => {
        if (newOnly && !s.isNew) return false;
        if (typeFilter && (s.type || '未分类') !== typeFilter) return false;
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
function showAddCustomSkillForm() {
    const modalBody = document.getElementById('modalBody');

    // 构建战斗数据中主动+被动技能的选项列表
    const battleSkills = [...activeSkills, ...passiveSkills];
    const battleOptionsHTML = battleSkills.map(s => {
        const typeLabel = s.id[0] === '1' ? '主动' : '被动';
        const typeColor = s.id[0] === '1' ? '#e74c3c' : '#3498db';
        return `<option value="${s.id}" data-name="${s.name}" data-desc="${(s.description || '').replace(/"/g, '&quot;')}" data-type="${typeLabel}技能">${typeLabel} ${s.id} - ${s.name}</option>`;
    }).join('');

    modalBody.innerHTML = `
        <div class="detail-header" style="border-bottom-color:#e67e22">
            <div class="detail-icon" style="background:#e67e2220;color:#e67e22;font-size:36px;width:64px;height:64px;display:flex;align-items:center;justify-content:center;border-radius:12px">🏹</div>
            <div style="flex:1">
                <h2 class="detail-name">添加技能</h2>
                <div class="detail-type">
                    <span class="type-badge" style="background:#e67e2220;color:#e67e22">技能系统</span>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <h3 class="detail-section-title">从战斗数据导入</h3>
            <p class="equipment-form-hint" style="margin-bottom:12px">选择战斗数据中的主动/被动技能，系统会自动填充技能信息。也可手动填写。</p>
            <div class="equipment-form-group">
                <label class="equipment-form-label">选择战斗数据中的技能</label>
                <select id="csBattleImport" class="equipment-form-input" onchange="onBattleSkillImport(this)" style="height:auto;padding:8px 12px">
                    <option value="">-- 不导入，手动填写 --</option>
                    ${battleOptionsHTML}
                </select>
            </div>
        </div>

        <div class="detail-section">
            <h3 class="detail-section-title">基本信息</h3>
            <div class="equipment-form-group">
                <label class="equipment-form-label">技能名称 <span class="required">*</span></label>
                <input type="text" id="csName" class="equipment-form-input" placeholder="如：烈焰风暴">
            </div>
            <div class="equipment-form-group">
                <label class="equipment-form-label">技能类型</label>
                <input type="text" id="csType" class="equipment-form-input" placeholder="如：主动技能/被动技能/辅助技能">
            </div>
            <div class="equipment-form-group">
                <label class="equipment-form-label">技能效果描述</label>
                <textarea id="csDesc" class="equipment-form-input" rows="3" placeholder="技能的效果描述" style="resize:vertical;font-family:inherit"></textarea>
            </div>
            <div class="equipment-form-group">
                <label class="equipment-form-label">来源技能ID</label>
                <input type="text" id="csSourceId" class="equipment-form-input" placeholder="从战斗数据导入的技能ID（可选）">
            </div>
        </div>

        <div class="detail-section">
            <h3 class="detail-section-title">关联效果ID（词缀/属性/被动技能）</h3>
            <p class="equipment-form-hint">每条填写一个词缀ID、属性ID或被动技能ID，输入文字可自动匹配，也可直接输入ID。</p>
            <div class="equipment-form-group">
                <label class="equipment-form-label">效果 1</label>
                <input type="text" id="csEffect1" class="equipment-form-input" placeholder="词缀/属性/被动技能ID 或输入文字搜索" oninput="onCustomSkillEffectInput(this, 'csPreview1', 'csDropdown1')">
                <div class="autocomplete-dropdown" id="csDropdown1"></div>
                <div class="effect-preview" id="csPreview1"></div>
            </div>
            <div class="equipment-form-group">
                <label class="equipment-form-label">效果 2</label>
                <input type="text" id="csEffect2" class="equipment-form-input" placeholder="词缀/属性/被动技能ID 或输入文字搜索" oninput="onCustomSkillEffectInput(this, 'csPreview2', 'csDropdown2')">
                <div class="autocomplete-dropdown" id="csDropdown2"></div>
                <div class="effect-preview" id="csPreview2"></div>
            </div>
            <div class="equipment-form-group">
                <label class="equipment-form-label">效果 3</label>
                <input type="text" id="csEffect3" class="equipment-form-input" placeholder="词缀/属性/被动技能ID 或输入文字搜索" oninput="onCustomSkillEffectInput(this, 'csPreview3', 'csDropdown3')">
                <div class="autocomplete-dropdown" id="csDropdown3"></div>
                <div class="effect-preview" id="csPreview3"></div>
            </div>
            <div class="equipment-form-group">
                <label class="equipment-form-label">效果 4</label>
                <input type="text" id="csEffect4" class="equipment-form-input" placeholder="词缀/属性/被动技能ID 或输入文字搜索" oninput="onCustomSkillEffectInput(this, 'csPreview4', 'csDropdown4')">
                <div class="autocomplete-dropdown" id="csDropdown4"></div>
                <div class="effect-preview" id="csPreview4"></div>
            </div>
            <div class="equipment-form-group">
                <label class="equipment-form-label">效果 5</label>
                <input type="text" id="csEffect5" class="equipment-form-input" placeholder="词缀/属性/被动技能ID 或输入文字搜索" oninput="onCustomSkillEffectInput(this, 'csPreview5', 'csDropdown5')">
                <div class="autocomplete-dropdown" id="csDropdown5"></div>
                <div class="effect-preview" id="csPreview5"></div>
            </div>
            <div class="equipment-form-group">
                <label class="equipment-form-label">效果 6</label>
                <input type="text" id="csEffect6" class="equipment-form-input" placeholder="词缀/属性/被动技能ID 或输入文字搜索" oninput="onCustomSkillEffectInput(this, 'csPreview6', 'csDropdown6')">
                <div class="autocomplete-dropdown" id="csDropdown6"></div>
                <div class="effect-preview" id="csPreview6"></div>
            </div>
        </div>

        <div class="detail-section">
            <div class="equipment-form-group">
                <label>
                    <input type="checkbox" id="csIsNew" checked>
                    <span style="font-size:14px;font-weight:600;color:#e74c3c">标记为新增技能</span>
                </label>
            </div>
        </div>

        <div class="equipment-form-actions">
            <button class="equipment-btn equipment-btn-cancel" onclick="closeModal()">取消</button>
            <button class="equipment-btn equipment-btn-save" onclick="submitAddCustomSkill()">保存技能</button>
        </div>
    `;
    document.getElementById('skillModal').classList.add('active');
}

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

function submitAddCustomSkill() {
    const name = document.getElementById('csName').value.trim();
    if (!name) { alert('请填写技能名称'); return; }
    const type = document.getElementById('csType').value.trim();
    const desc = document.getElementById('csDesc').value.trim();
    const sourceId = document.getElementById('csSourceId').value.trim();
    const isNew = document.getElementById('csIsNew').checked;
    const effects = [];
    for (let i = 1; i <= 6; i++) {
        const val = document.getElementById('csEffect' + i).value.trim();
        if (val) effects.push({ refId: val });
    }
    const newSkill = {
        id: generateCustomSkillId(),
        name,
        type,
        desc,
        sourceId,
        effects,
        isNew,
        source: 'manual',
        createdAt: new Date().toISOString()
    };
    customSkillData.push(newSkill);
    saveCustomSkillData();
    closeModal();
    renderCustomSkills();
    updateCustomSkillNavCount();
}

function openCustomSkillDetail(id) {
    const skill = customSkillData.find(s => s.id === id);
    if (!skill) return;
    if (!skill.effects) skill.effects = [];
    const effects = skill.effects;

    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = `
        <div class="detail-header" style="border-bottom-color:#e67e22">
            <div class="detail-icon" style="background:#e67e2220;color:#e67e22;font-size:36px;width:64px;height:64px;display:flex;align-items:center;justify-content:center;border-radius:12px">🏹</div>
            <div style="flex:1">
                <h2 class="detail-name">
                    <input type="text" class="affix-edit-input affix-edit-name" value="${skill.name.replace(/"/g, '&quot;')}" oninput="updateCustomSkillField('${skill.id}', 'name', this.value)" placeholder="技能名称">
                </h2>
                <div class="detail-type">
                    <span class="type-badge" style="background:#e67e2220;color:#e67e22">技能系统</span>
                    <span class="type-badge-sub">${skill.id}</span>
                    ${skill.sourceId ? `<span class="type-badge-sub">来源: ${skill.sourceId}</span>` : ''}
                </div>
            </div>
        </div>

        <div class="detail-section">
            <div class="detail-section-title-row">
                <h3 class="detail-section-title">技能类型</h3>
                <span class="save-indicator">编辑后自动保存</span>
            </div>
            <input type="text" class="affix-edit-input" style="font-size:15px;padding:8px 12px;border:1px solid #ddd;border-radius:8px;width:100%;box-sizing:border-box" value="${(skill.type || '').replace(/"/g, '&quot;')}" oninput="updateCustomSkillField('${skill.id}', 'type', this.value)" placeholder="如：主动技能/被动技能/辅助技能">
        </div>

        <div class="detail-section">
            <div class="detail-section-title-row">
                <h3 class="detail-section-title">技能效果描述</h3>
            </div>
            <textarea class="affix-edit-input" style="font-size:14px;padding:8px 12px;border:1px solid #ddd;border-radius:8px;width:100%;box-sizing:border-box;resize:vertical;font-family:inherit;min-height:60px" oninput="updateCustomSkillField('${skill.id}', 'desc', this.value)" placeholder="技能的效果描述">${(skill.desc || '').replace(/</g, '&lt;')}</textarea>
        </div>

        <div class="detail-section">
            <div class="detail-section-title-row">
                <h3 class="detail-section-title">新增标记</h3>
            </div>
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
                <input type="checkbox" ${skill.isNew ? 'checked' : ''} onchange="updateCustomSkillField('${skill.id}', 'isNew', this.checked)" style="width:18px;height:18px">
                <span style="font-size:14px;font-weight:600;color:#e74c3c">标记为新增技能</span>
            </label>
        </div>

        <div class="detail-section">
            <h3 class="detail-section-title">关联效果（<span id="csEffectCount">${effects.filter(e => e.refId).length}</span> 条）</h3>
            <div id="csEffectList">
            ${effects.length === 0 ? '<p class="empty-hint">暂无关联效果，点击下方按钮添加</p>' : ''}
            ${effects.map((eff, idx) => {
                const refData = eff.refId ? findRefData(eff.refId) : null;
                const typeColor = refData ? (refData.type === 'active-skill' ? '#e74c3c' : refData.type === 'passive-skill' ? '#3498db' : refData.type === 'attribute' ? '#27ae60' : '#f39c12') : '#bbb';
                const typeLabel = refData ? (refData.type === 'active-skill' ? '主动技能' : refData.type === 'passive-skill' ? '被动技能' : refData.type === 'attribute' ? '属性效果' : '词缀') : '待填写';
                return `
                    <div class="equipment-effect-item" id="csEffectItem-${idx}" style="border-left-color:${typeColor}">
                        <div class="equipment-effect-header">
                            <span class="effect-type-badge" id="csEffectBadge-${idx}" style="background:${typeColor}20;color:${typeColor}">${typeLabel}</span>
                            <input type="text" class="equipment-effect-input" value="${eff.refId}" oninput="onEditCustomSkillEffectInput(this, '${skill.id}', ${idx})" placeholder="词缀/属性/被动技能ID 或输入文字搜索">
                            <button class="equipment-effect-delete" onclick="deleteCustomSkillEffect('${skill.id}', ${idx})">✕</button>
                        </div>
                        <div class="autocomplete-dropdown" id="editCsDropdown-${idx}"></div>
                        <div class="effect-preview" id="editCsPreview-${idx}"></div>
                    </div>
                `;
            }).join('')}
            </div>
            <button class="equipment-btn" style="margin-top:8px" onclick="addCustomSkillEffect('${skill.id}')">+ 添加效果</button>
        </div>

        <div class="equipment-form-actions">
            <button class="equipment-btn equipment-btn-cancel" onclick="closeModal()">关闭</button>
            <button class="equipment-btn" style="background:#e74c3c;color:white" onclick="deleteCustomSkill('${skill.id}')">删除技能</button>
        </div>
    `;
    document.getElementById('skillModal').classList.add('active');
}

function updateCustomSkillField(id, field, value) {
    const skill = customSkillData.find(s => s.id === id);
    if (!skill) return;
    skill[field] = value;
    saveCustomSkillData();
}

function addCustomSkillEffect(id) {
    const skill = customSkillData.find(s => s.id === id);
    if (!skill) return;
    if (!skill.effects) skill.effects = [];
    skill.effects.push({ refId: '' });
    saveCustomSkillData();
    openCustomSkillDetail(id);
}

function deleteCustomSkillEffect(id, idx) {
    const skill = customSkillData.find(s => s.id === id);
    if (!skill) return;
    skill.effects.splice(idx, 1);
    saveCustomSkillData();
    openCustomSkillDetail(id);
}

function onEditCustomSkillEffectInput(inputEl, skillId, idx) {
    const skill = customSkillData.find(s => s.id === skillId);
    if (!skill || !skill.effects[idx]) return;
    skill.effects[idx].refId = inputEl.value.trim();
    saveCustomSkillData();
    previewEffect(inputEl, 'editCsPreview-' + idx);

    // 更新badge
    const refData = findRefData(skill.effects[idx].refId);
    const badge = document.getElementById('csEffectBadge-' + idx);
    if (badge && refData) {
        const typeColor = refData.type === 'active-skill' ? '#e74c3c' : refData.type === 'passive-skill' ? '#3498db' : refData.type === 'attribute' ? '#27ae60' : '#f39c12';
        const typeLabel = refData.type === 'active-skill' ? '主动技能' : refData.type === 'passive-skill' ? '被动技能' : refData.type === 'attribute' ? '属性效果' : '词缀';
        badge.style.background = typeColor + '20';
        badge.style.color = typeColor;
        badge.textContent = typeLabel;
    }

    // 自动补全
    const val = inputEl.value.trim();
    const dropdownEl = document.getElementById('editCsDropdown-' + idx);
    if (!val || /^\d+$/.test(val)) { if (dropdownEl) dropdownEl.innerHTML = ''; return; }

    const refData2 = findRefData(val);
    if (refData2) { if (dropdownEl) dropdownEl.innerHTML = ''; return; }

    const search = val.toLowerCase();
    let matches = [];
    affixes.forEach(a => { if (a.name.toLowerCase().includes(search) || a.id.includes(search)) matches.push({ id: a.id, name: a.name, desc: a.description, typeLabel: '词缀', typeColor: '#f39c12' }); });
    attributes.forEach(a => { if (a.name.toLowerCase().includes(search) || a.id.includes(search)) matches.push({ id: a.id, name: a.name, desc: a.description, typeLabel: '属性', typeColor: '#27ae60' }); });
    passiveSkills.forEach(s => { if (s.name.toLowerCase().includes(search) || s.id.includes(search)) matches.push({ id: s.id, name: s.name, desc: s.description, typeLabel: '被动', typeColor: '#3498db' }); });
    matches = matches.slice(0, 20);
    if (!dropdownEl) return;
    if (matches.length === 0) { dropdownEl.innerHTML = '<div class="autocomplete-empty">无匹配结果</div>'; return; }
    dropdownEl.innerHTML = '<div class="autocomplete-list">' + matches.map(m => `
        <div class="autocomplete-item" onclick="selectEditCustomSkillEffect('${skillId}', ${idx}, '${m.id}')">
            <span class="autocomplete-item-type" style="background:${m.typeColor}20;color:${m.typeColor}">${m.typeLabel}</span>
            <span class="autocomplete-item-id">${m.id}</span>
            <span class="autocomplete-item-name">${m.name}</span>
        </div>
    `).join('') + '</div>';
}

function selectEditCustomSkillEffect(skillId, idx, refId) {
    const skill = customSkillData.find(s => s.id === skillId);
    if (!skill || !skill.effects[idx]) return;
    skill.effects[idx].refId = refId;
    saveCustomSkillData();
    openCustomSkillDetail(skillId);
}

function deleteCustomSkill(id) {
    if (!confirm('确定删除此技能吗？此操作不可撤销。')) return;
    customSkillData = customSkillData.filter(s => s.id !== id);
    saveCustomSkillData();
    closeModal();
    renderCustomSkills();
    updateCustomSkillNavCount();
}

function syncCustomSkillCard(id) {
    const skill = customSkillData.find(s => s.id === id);
    if (!skill) return;
    const card = document.querySelector(`[data-custom-skill-id="${id}"]`);
    if (!card) return;
    const effects = (skill.effects || []).filter(e => e.refId);
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

// ---- 加载新增标记覆盖 ----
function loadNewStatusOverrides() {
    try {
        const raw = localStorage.getItem('chronicle_new_status');
        if (!raw) return;
        const saved = JSON.parse(raw);
        // 应用到所有数据
        activeSkills.forEach(s => { if (saved[s.id] !== undefined) s.isNew = saved[s.id]; });
        passiveSkills.forEach(s => { if (saved[s.id] !== undefined) s.isNew = saved[s.id]; });
        affixes.forEach(a => { if (saved[a.id] !== undefined) a.isNew = saved[a.id]; });
        equipmentData.forEach(e => { if (saved[e.id] !== undefined) e.isNew = saved[e.id]; });
        gemData.forEach(g => { if (saved[g.id] !== undefined) g.isNew = saved[g.id]; });
    } catch (e) {
        console.warn('加载新增标记失败:', e);
    }
}

function init() {
    console.log('=== 初始化开始 ===');
    console.log('  自动导入数据:', window.__AUTO_IMPORT_DATA__ ? '已加载' : '未加载');

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
            localStorage.removeItem('chronicle_new_status');
        } else {
            console.log('  检测到自动导入数据，跳过缓存清除');
        }
        localStorage.setItem('chronicle_cleared_version', CLEAR_VERSION);
    }

    loadAffixEdits();
    loadSkillEdits();
    loadEquipmentData();
    loadCustomSkills();
    loadCustomAffixes();
    loadNewStatusOverrides();

    console.log('  数据统计: 主动=' + activeSkills.length, '被动=' + passiveSkills.length, '词缀=' + affixes.length, '属性=' + attributes.length, '装备=' + equipmentData.length, '技能库=' + customSkillData.length, '宝石=' + gemData.length);

    const _aC = document.getElementById('affixCount'); if (_aC) _aC.textContent = affixes.length;
    const _eC = document.getElementById('equipmentCount'); if (_eC) _eC.textContent = equipmentData.length;
    const _atC = document.getElementById('attrCount'); if (_atC) _atC.textContent = attributes.length;
    const _gC = document.getElementById('gemCount'); if (_gC) _gC.textContent = gemData.length;
    updateCustomSkillNavCount();
    updateBattleDataCount();

    renderHome();
    filterSkills('active');
    filterSkills('passive');
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

            // 保留用户自定义的新增标记
            newActiveSkills.forEach(s => {
                const old = activeSkills.find(o => o.id === s.id);
                if (old && old.isNew) s.isNew = true;
            });
            newPassiveSkills.forEach(s => {
                const old = passiveSkills.find(o => o.id === s.id);
                if (old && old.isNew) s.isNew = true;
            });

            // 替换数据
            activeSkills.length = 0;
            activeSkills.push(...newActiveSkills);
            passiveSkills.length = 0;
            passiveSkills.push(...newPassiveSkills);

            // 词缀Excel
            let affixCount = 0;
            if (affixExcelData && affixExcelData.length > 0) {
                // 保留新增标记
                affixExcelData.forEach(a => {
                    const old = affixes.find(o => o.id === a.id);
                    if (old && old.isNew) a.isNew = true;
                });
                affixes.length = 0;
                affixes.push(...affixExcelData);
                affixCount = affixExcelData.length;
                try { localStorage.setItem('chronicle_synced_affixes', JSON.stringify(affixes)); } catch(e) {}
            }

            // 属性CSV
            let attrCount = 0;
            if (attrCSVData && attrCSVData.length > 0) {
                attrCSVData.forEach(a => {
                    const old = attributes.find(o => o.id === a.id);
                    if (old && old.isNew) a.isNew = true;
                });
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
// 数据导出/导入
// ============================================================
function clearAllUserData() {
    // 统计手动添加的数据量
    const manualEquip = equipmentData.filter(e => e.source === 'manual');
    const manualGems = gemData.filter(g => g.source === 'manual');
    const manualSkills = customSkillData.filter(s => s.source === 'manual');
    const totalManual = manualEquip.length + manualGems.length + manualSkills.length;

    if (totalManual === 0) {
        alert('当前没有手动添加的数据可清除。');
        return;
    }

    const msg = '确定清除以下手动添加的数据吗？\n\n' +
        '暗金装备：' + manualEquip.length + ' 件\n' +
        '辅助宝石：' + manualGems.length + ' 个\n' +
        '自定义技能：' + manualSkills.length + ' 个\n\n' +
        '文件导入的数据不受影响。\n此操作不可撤销！';

    // 使用 window.confirm 并严格检查返回值
    const confirmed = window.confirm(msg);
    if (confirmed !== true) return;

    // 仅移除手动添加的数据，保留文件同步的数据
    const newEquip = equipmentData.filter(e => e.source !== 'manual');
    const newGems = gemData.filter(g => g.source !== 'manual');
    const newSkills = customSkillData.filter(s => s.source !== 'manual');

    equipmentData.length = 0;
    equipmentData.push(...newEquip);
    saveEquipmentData();

    gemData.length = 0;
    gemData.push(...newGems);
    saveGemData();

    customSkillData.length = 0;
    customSkillData.push(...newSkills);
    saveCustomSkillData();

    // 重新渲染
    renderEquipment();
    renderGems();
    renderCustomSkills();
    renderHome();
    renderStats();
    updateNavCounts();

    alert('✓ 已清除 ' + totalManual + ' 条手动添加的数据，文件导入的数据保留不变。');
}

function exportUserData() {
    const data = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        equipment: [],
        gems: [],
        newStatusOverrides: {}
    };

    try {
        const eq = localStorage.getItem('chronicle_equipment');
        if (eq) data.equipment = JSON.parse(eq);
    } catch (e) { console.warn('读取装备数据失败', e); }

    try {
        const gems = localStorage.getItem('chronicle_gems');
        if (gems) data.gems = JSON.parse(gems);
    } catch (e) { console.warn('读取宝石数据失败', e); }

    try {
        const ns = localStorage.getItem('chronicle_newStatus');
        if (ns) data.newStatusOverrides = JSON.parse(ns);
    } catch (e) { console.warn('读取新增状态失败', e); }

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    a.download = `chronicle-data-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importUserData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const resultEl = document.getElementById('importResult');

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);

            if (data.equipment && Array.isArray(data.equipment)) {
                localStorage.setItem('chronicle_equipment', JSON.stringify(data.equipment));
                equipmentData = data.equipment;
            }

            if (data.gems && Array.isArray(data.gems)) {
                localStorage.setItem('chronicle_gems', JSON.stringify(data.gems));
                gemData = data.gems;
            }

            if (data.newStatusOverrides && typeof data.newStatusOverrides === 'object') {
                localStorage.setItem('chronicle_newStatus', JSON.stringify(data.newStatusOverrides));
            }

            renderEquipment();
            renderGems();
            renderCustomSkills();
            renderStats();
            updateNavCounts();

            const eqCount = data.equipment ? data.equipment.length : 0;
            const gemCount = data.gems ? data.gems.length : 0;
            if (resultEl) {
                resultEl.className = 'data-mgmt-hint success';
                resultEl.textContent = `✓ 导入成功！装备 ${eqCount} 件，辅助宝石 ${gemCount} 个`;
            }
        } catch (err) {
            if (resultEl) {
                resultEl.className = 'data-mgmt-hint error';
                resultEl.textContent = '✗ 导入失败：文件格式错误';
            }
            console.error('导入失败', err);
        }
        event.target.value = '';
    };
    reader.readAsText(file);
}

document.addEventListener('DOMContentLoaded', init);
