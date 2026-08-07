// ============================================================
// localStorage 安全垫片
// 在 file:// 协议下某些浏览器会禁止 localStorage，使用内存替代
// ============================================================
(function() {
    try {
        const testKey = '__test__' + Date.now();
        localStorage.setItem(testKey, '1');
        localStorage.removeItem(testKey);
    } catch (e) {
        console.warn('localStorage 不可用，使用内存存储替代');
        const _store = {};
        const _ls = {
            getItem: function(key) { return _store[key] !== undefined ? _store[key] : null; },
            setItem: function(key, value) { _store[key] = String(value); },
            removeItem: function(key) { delete _store[key]; },
            clear: function() { Object.keys(_store).forEach(k => delete _store[k]); }
        };
        Object.defineProperty(window, 'localStorage', { value: _ls, writable: true, configurable: true });
    }
})();

// ============================================================
// 编年史数据库 - 技能数据
// 数据来源: 战斗编辑器优化文档
// 更新日期: 2026-07-03
// ============================================================

// ID规则: A+B+C+D+E+000F+G (10位数字)
// A=1: 主动技能, A=2: 被动技能
// B: 技能大类, C: 技能子类, D: 效果类型, E: 元素/属性
// 000F: 4位序号, G: 等级标识

// ============================================================
// 主动技能 (A=1) - 共20个
// ============================================================
const activeSkills = [
    // ---- 战斗技能 ----
    { id: "1110000010", name: "月光斩", category: "战斗技能", subCategory: "战斗攻击", isNew: false, description: "对前方小范围的敌人快速造成两次攻击伤害，伤害的60%转化为冰冷伤害。\n攻击冻结敌人时会出现月光残影，对范围内敌人造成伤害" },
    { id: "1110000011", name: "月光残影", category: "战斗技能", subCategory: "战斗攻击", isNew: false, description: "" },
    { id: "1110000012", name: "月光斩1", category: "战斗技能", subCategory: "战斗攻击", isNew: false, description: "无法造成冰冻。\n对前方小范围的敌人快速造成两次攻击伤害。\n攻击冻结敌人时会出现月光残影，对范围内敌人造成伤害。" },
    { id: "1110000020", name: "拔刀斩", category: "战斗技能", subCategory: "战斗攻击", isNew: false, description: "对前方大范围内的敌人造成伤害，将伤害的80%转化为冰冷伤害\n冻结积蓄额外增加160%" },
    { id: "1110000030", name: "混沌刺击", category: "战斗技能", subCategory: "战斗攻击", isNew: false, description: "向前单个敌人刺击造成50%混沌伤害，击中时产生3个穿透幻影冲刺造成20%混沌伤害" },
    { id: "1110000031", name: "混沌刺击-子技能", category: "战斗技能", subCategory: "战斗攻击", isNew: false, description: "向前刺击造成混沌伤害，击中时产生3个幻影冲刺造成小额的混沌伤害" },
    { id: "1110000040", name: "旋风斩", category: "战斗技能", subCategory: "战斗攻击", isNew: false, description: "对自身一定范围内的敌人造成一次高额武器攻击伤害。" },
    { id: "1110000050", name: "专注斩", category: "战斗技能", subCategory: "战斗攻击", isNew: false, description: "向前方目标连续造成3次物理伤害，再造成更高的物理伤害" },
    { id: "1110000051", name: "专注斩1", category: "战斗技能", subCategory: "战斗攻击", isNew: false, description: "向前方目标连续造成3次物理伤害，再造成更高的物理伤害" },
    { id: "1110000052", name: "专注斩2", category: "战斗技能", subCategory: "战斗攻击", isNew: false, description: "向前方目标连续造成3次物理伤害，再造成更高的物理伤害" },
    { id: "1110000053", name: "专注斩3", category: "战斗技能", subCategory: "战斗攻击", isNew: false, description: "向前方目标连续造成3次物理伤害，再造成更高的物理伤害" },
    { id: "1110000060", name: "气刃纵斩", category: "战斗技能", subCategory: "战斗攻击", isNew: false, description: "对前方发出一道巨大的剑波，将伤害的60%转化为冰冷伤害，攻击沿途的所有敌人\n在目标位置生成一片冰冷地面，每秒产生100%的冰冷伤害，持续4秒" },
    { id: "1110000061", name: "冰封之地", category: "战斗技能", subCategory: "战斗攻击", isNew: false, description: "" },
    { id: "1110000070", name: "旋龙", category: "战斗技能", subCategory: "战斗攻击", isNew: false, description: "舞动战矛扇起一阵旋龙，旋龙会不规则移动，致盲并反复击中内部的敌人。" },
    { id: "1110000080", name: "回旋挥斩", category: "战斗技能", subCategory: "战斗攻击", isNew: false, description: "施展环形挥斩，在你周围踢起一阵的旋风，使效果范围内的敌人减速并致盲。" },
    { id: "1110000090", name: "专注射击", category: "战斗技能", subCategory: "战斗攻击", isNew: false, description: "连续造成4段火焰伤害" },
    { id: "1110000091", name: "专注射击2", category: "战斗技能", subCategory: "战斗攻击", isNew: false, description: "" },
    { id: "1110000092", name: "专注射击3", category: "战斗技能", subCategory: "战斗攻击", isNew: false, description: "" },

    // ---- 法术技能 ----
    { id: "1120000010", name: "回响", category: "法术技能", subCategory: "法术释放", isNew: false, description: "可以使下一个投射物技能额外释放一次" },
    { id: "1120000020", name: "法术旋龙", category: "法术技能", subCategory: "法术释放", isNew: false, description: "舞动战矛扇起一阵旋龙，旋龙会不规则移动，致盲并反复击中内部的敌人。" },
    { id: "1120000030", name: "闪现", category: "法术技能", subCategory: "法术释放", isNew: false, description: "" },
    { id: "1120000031", name: "大地之怒子弹", category: "法术技能", subCategory: "法术释放", isNew: false, description: "" },
    { id: "1120000040", name: "冥地喷涌", category: "法术技能", subCategory: "法术释放", isNew: false, description: "" },
    { id: "1120000050", name: "回旋龙卷", category: "法术技能", subCategory: "法术释放", isNew: false, description: "召唤一道缓慢移动的旋风，对卷入的敌人造成伤害" },
    { id: "1120000051", name: "回旋龙卷子技能", category: "法术技能", subCategory: "法术释放", isNew: false, description: "" },
    { id: "1120000080", name: "火球术", category: "法术技能", subCategory: "法术释放", isNew: false, description: "扔出1枚火球，碰到敌人时产生爆炸。\n尽量消耗一层毁灭注能，产生更大的爆炸，在爆炸位置生成并在爆炸时产生8发小型火球" },
    { id: "1120000081", name: "火球术爆炸", category: "法术技能", subCategory: "法术释放", isNew: false, description: "" },
    { id: "1120000083", name: "生成火焰地面", category: "法术技能", subCategory: "法术释放", isNew: false, description: "" },
    { id: "1120000100", name: "我即闪电", category: "法术技能", subCategory: "法术释放", isNew: false, description: "" },

    // ---- 增益技能 ----
    { id: "1140000010", name: "月神赐福", category: "增益技能", subCategory: "增益辅助", isNew: false, description: "获得相当于伤害10%的冰冷伤害。\n每次使用阴义技能攻击敌人时会召唤4发剑影，击中敌人时产生小范围的爆炸，持续8秒\n1发剑影最多攻击5名敌人" },
    { id: "1140000011", name: "月神赐福剑影", category: "增益技能", subCategory: "增益辅助", isNew: false, description: "" },
    { id: "1140000020", name: "极地战吼", category: "增益技能", subCategory: "增益辅助", isNew: false, description: "发出极地战吼，对周围5米范围内的敌人造成伤害，冰冻积蓄值额外增加80%。\n范围内每存在1名敌人则+5%的伤害，最多可以+50%的伤害，持续10秒" },
    { id: "1140000030", name: "元素脉冲", category: "增益技能", subCategory: "增益辅助", isNew: false, description: "每隔3秒会发出一道元素脉冲，降低范围内所有敌人30%的元素抗性，" },

    // ---- 其他技能 ----
    { id: "1210000030", name: "月神赐福剑影", category: "其他技能", subCategory: "战斗攻击", isNew: false, description: "" },
    { id: "1210000031", name: "大地之怒子弹", category: "其他技能", subCategory: "战斗攻击", isNew: false, description: "" },
];

// ============================================================
// 被动技能 (A=2) - 共23个
// ============================================================
const passiveSkills = [
    // ---- 天赋特技 ----
    { id: "99998", name: "天赋-心眼", category: "天赋特技", subCategory: "天赋", isNew: false, description: "连续释放10次攻击技能时获得\"心眼\"状态；心眼：攻击速度额外增加8%；技能范围额外增加8%，上限为3层，持续2秒" },
    { id: "99999", name: "天赋-巅峰", category: "天赋特技", subCategory: "天赋", isNew: false, description: "击中时，向前斩击，造成500%的攻击物理伤害，冷却时间10秒" },

    // ---- 捷系列 ----
    { id: "2110000010", name: "闪电之捷", category: "捷系列", subCategory: "攻击", isNew: false, description: "激活时，非捷技能攻击击中并击败感电敌人会使后续的攻击击中释放出闪电，对周围所有的敌人造成攻击伤害\\n\\n伤害附带0.1倍的闪电伤害" },
    { id: "2110000011", name: "闪电之捷-消耗BUFF", category: "捷系列", subCategory: "攻击", isNew: false, description: "激活时，非捷技能攻击击中并击败感电敌人会使后续的攻击击中释放出闪电，对周围所有的敌人造成攻击伤害" },
    { id: "2110000012", name: "闪电之捷-附加闪电伤害", category: "捷系列", subCategory: "攻击", isNew: false, description: "激活时，非捷技能攻击击中并击败感电敌人会使后续的攻击击中释放出闪电，对周围所有的敌人造成攻击伤害" },
    { id: "2110000020", name: "灰烬之捷", category: "捷系列", subCategory: "攻击", isNew: false, description: "激活时，受到你的非捷技能攻击造成的火焰伤害击杀时有几率的敌人会产生爆炸，并根据敌人生命值上限对周围的敌人造成伤害\\n\\n伤害附带0.1倍的火焰伤害" },
    { id: "2110000021", name: "灰烬之捷-附加火焰伤害", category: "捷系列", subCategory: "攻击", isNew: false, description: "激活时，受到你的非捷技能攻击造成的火焰伤害击杀时有几率的敌人会产生爆炸，并根据敌人生命值上限对周围的敌人造成伤害" },
    { id: "2110000030", name: "冰霜之捷", category: "捷系列", subCategory: "攻击", isNew: false, description: "激活时，非捷技能攻击击中一名冰冻敌人并击杀时会产生冰霜爆炸，对周围的敌人造成攻击伤害。\\n\\n伤害附带0.1倍的冰冷伤害" },
    { id: "2110000031", name: "冰霜之捷-附加冰冷伤害", category: "捷系列", subCategory: "攻击", isNew: false, description: "激活时，非捷技能攻击击中一名冰冻敌人并击杀时会产生冰霜爆炸，对周围的敌人造成攻击伤害。" },
    { id: "2110000040", name: "月光残影", category: "捷系列", subCategory: "攻击", isNew: false, description: "攻击冻结中的敌人时会出现残影重击范围内的敌人" },
    { id: "2114000020", name: "迅捷", category: "捷系列", subCategory: "攻击", isNew: false, description: "激活时，移动速度增加50%" },
    { id: "2120000010", name: "移形换影-闪现（子）", category: "捷系列", subCategory: "法术", isNew: false, description: "向移动方向闪现，并在原地留下一个幻影。幻影不可移动，不可攻击，在持续时间内持续释放技能1，幻影的上限为3" },
    { id: "2120000011", name: "移形换影-幻影", category: "捷系列", subCategory: "法术", isNew: false, description: "移形换影-幻影" },
    { id: "2120000020", name: "魔典幻影", category: "捷系列", subCategory: "法术", isNew: false, description: "使用法术技能造成伤害后，在原地生成“幻影”，持续4秒，冷却10秒，幻影上限为1" },
    { id: "2120000030", name: "大地之怒", category: "捷系列", subCategory: "法术", isNew: false, description: "激活时，造成暴击时会产生获取层数，满40层后会释放大地之怒，产生冰霜爆炸对范围内敌人造成伤害" },
    { id: "2120000040", name: "魔典-中毒爆炸", category: "捷系列", subCategory: "法术", isNew: false, description: "魔典-中毒爆炸" },
    { id: "2120000060", name: "魔典-幻影耗蓝转伤", category: "捷系列", subCategory: "法术", isNew: false, description: "幻影释放技能时会消耗你的魔力，其数值释放技能的魔力消耗，每次消耗技能额外增加5%你和幻影造成的伤害，上限为10层" },
    { id: "2120100030", name: "大地之怒驱散", category: "捷系列", subCategory: "法术", isNew: false, description: "占位技能" },
    { id: "2120200030", name: "大地之怒触发", category: "捷系列", subCategory: "法术", isNew: false, description: "占位技能" },
    { id: "2140000010", name: "月神赐福", category: "捷系列", subCategory: "增益", isNew: false, description: "占位技能" },
    { id: "2140000020", name: "迅捷", category: "捷系列", subCategory: "增益", isNew: false, description: "激活时，移动速度增加50%" },
    { id: "2140000030", name: "辅助宝石-迎寒而上", category: "捷系列", subCategory: "增益", isNew: false, description: "被辅助技能冻结敌人时，获得30%的额外冰冷伤害，持续6秒" },
    { id: "2140000040", name: "精准投射", category: "捷系列", subCategory: "增益", isNew: false, description: "激活时，投射物数量+2，投射物速度增加40%" },
    { id: "2140000050", name: "领域扩张", category: "捷系列", subCategory: "增益", isNew: false, description: "激活时，范围技能范围增加25%，范围技能伤害额外增加25%" },
    { id: "2140000060", name: "狂怒", category: "捷系列", subCategory: "增益", isNew: false, description: "激活时，近战技能获得暴击几率增加70%，额外25%近战伤害增加" },
    { id: "2140000070", name: "生命再生", category: "捷系列", subCategory: "增益", isNew: false, description: "激活时，每秒回复75点生命值" },
    { id: "2140000080", name: "元素脉冲", category: "捷系列", subCategory: "增益", isNew: false, description: "每4秒对周围4米的敌人释放元素脉冲，降低范围内敌人30%的元素抗性，持续4秒" },
    { id: "2140000090", name: "装备-元素曝露", category: "捷系列", subCategory: "增益", isNew: false, description: "占位技能" },
    { id: "2140000100", name: "天赋-火神", category: "捷系列", subCategory: "增益", isNew: false, description: "占位技能" },
    { id: "2150000010", name: "天赋-心眼", category: "捷系列", subCategory: "特殊", isNew: false, description: "10秒内连续释放4次攻击技能时获得[心眼]状态\\n[心眼]：攻击速度额外增加8%；技能范围额外增加8%，上限为3层，持续2秒" },
    { id: "2150000020", name: "天赋-巅峰", category: "捷系列", subCategory: "特殊", isNew: false, description: "心眼到法屋数上限时，获得[巅峰]\\n[巅峰]:向前斩击造成500%的攻击物理伤害，冷却时间5秒" },
    { id: "2150000030", name: "天赋-极寒侵体", category: "捷系列", subCategory: "特殊", isNew: false, description: "占位技能" },
    { id: "2150000070", name: "透支1", category: "捷系列", subCategory: "特殊", isNew: false, description: "每缺少25%的魔力，法术伤害提升20%，魔力恢复率提高20%" },
    { id: "2150100070", name: "透支2", category: "捷系列", subCategory: "特殊", isNew: false, description: "每缺少25%的魔力，法术伤害提升20%，魔力恢复率提高20%" },
    { id: "2150200070", name: "透支3", category: "捷系列", subCategory: "特殊", isNew: false, description: "每缺少25%的魔力，法术伤害提升20%，魔力恢复率提高20%" },

    // ---- 战斗特技 ----
    { id: "2240000010", name: "boss异常状态抵抗", category: "战斗特技", subCategory: "增益", isNew: false, description: "占位技能" },
    { id: "2240100010", name: "boss异常状态抵抗2", category: "战斗特技", subCategory: "增益", isNew: false, description: "占位技能" },

    // ---- 传奇特技 ----
    { id: "2340000010", name: "装备-位移技能回复", category: "传奇特技", subCategory: "增益", isNew: false, description: "装备-位移技能回复" },
    { id: "2340000020", name: "装备-生命转中毒伤害", category: "传奇特技", subCategory: "增益", isNew: false, description: "衣服暗金词缀：当生命大于2000时，中毒伤害提高50%-100%" },
    { id: "2340000030", name: "装备-冷却转中毒时间", category: "传奇特技", subCategory: "增益", isNew: false, description: "衣服暗金词缀：当冷却回复效率高于40%时，中毒持续时间增加50%-100%。" },
    { id: "3140000020", name: "辅助技能-击中时回蓝", category: "传奇特技", subCategory: "增益", isNew: false, description: "击中时,回复2点魔力" },
    { id: "3140000030", name: "辅助技能-击中时回血", category: "传奇特技", subCategory: "增益", isNew: false, description: "击中时,回复5点生命" },
    { id: "3140000040", name: "辅助技能-猛毒", category: "传奇特技", subCategory: "增益", isNew: false, description: "被辅助技能，击中中毒目标时，每层中毒效果伤害总增5%，上限5-8层" },
];

// ============================================================
// 词缀数据 - 来源于腾讯文档·词缀工作表
// 4大分类: 技能词缀(21) + 装备词缀(17) + 传奇装备词缀(17) + 天赋词缀(34) = 89
// ============================================================
const affixes = [
    // ---- 通用词缀 ----
    { id: "10031", name: "攻击速度提高", category: "通用词缀", subCategory: "攻速", isNew: false, description: "攻击速度提高{0}" },
    { id: "10032", name: "范围效果提高", category: "通用词缀", subCategory: "范围", isNew: false, description: "范围效果提高{0}" },
    { id: "10033", name: "冻结效果额外提高", category: "通用词缀", subCategory: "冰霜", isNew: false, description: "冻结效果额外提高{0}" },
    { id: "10034", name: "持续时间提高", category: "通用词缀", subCategory: "持续时间", isNew: false, description: "持续时间提高{0}" },
    { id: "10035", name: "冷却回复率额外提高", category: "通用词缀", subCategory: "冷却", isNew: false, description: "冷却回复率额外提高{0}" },
    { id: "10036", name: "辅助技能-多重释放", category: "通用词缀", subCategory: "技能", isNew: false, description: "辅助技能-多重释放" },
    { id: "10037", name: "辅助技能-范围集中", category: "通用词缀", subCategory: "技能", isNew: false, description: "辅助技能-范围集中" },
    { id: "10038", name: "投射物数量增加", category: "通用词缀", subCategory: "投射物", isNew: false, description: "投射物数量增加{0}" },
    { id: "10039", name: "暴击率提高", category: "通用词缀", subCategory: "暴击", isNew: false, description: "暴击率提高{0}" },
    { id: "10040", name: "辅助技能-无边能量", category: "通用词缀", subCategory: "技能", isNew: false, description: "辅助技能-无边能量" },
    { id: "10041", name: "冻结时间额外提高", category: "通用词缀", subCategory: "冰霜", isNew: false, description: "冻结时间额外提高{0}" },
    { id: "10042", name: "辅助技能-元素增幅", category: "通用词缀", subCategory: "技能", isNew: false, description: "辅助技能-元素增幅" },
    { id: "10043", name: "辅助技能-新星投射物", category: "通用词缀", subCategory: "技能", isNew: false, description: "辅助技能-新星投射物" },
    { id: "10044", name: "辅助技能-闪电偏转", category: "通用词缀", subCategory: "技能", isNew: false, description: "辅助技能-闪电偏转" },
    { id: "10045", name: "辅助技能-火焰偏转", category: "通用词缀", subCategory: "技能", isNew: false, description: "辅助技能-火焰偏转" },
    { id: "10046", name: "辅助技能-冰冷偏转", category: "通用词缀", subCategory: "技能", isNew: false, description: "辅助技能-冰冷偏转" },
    { id: "10047", name: "辅助技能-沉重挥舞", category: "通用词缀", subCategory: "技能", isNew: false, description: "辅助技能-沉重挥舞" },
    { id: "10048", name: "辅助技能-迎寒而上", category: "通用词缀", subCategory: "技能", isNew: false, description: "辅助技能-迎寒而上" },
    { id: "10049", name: "投射物速度提高", category: "通用词缀", subCategory: "投射物", isNew: false, description: "投射物速度提高{0}" },
    { id: "10050", name: "施法速度提高", category: "通用词缀", subCategory: "施法", isNew: false, description: "施法速度提高{0}" },
    { id: "10051", name: "中毒几率", category: "通用词缀", subCategory: "中毒", isNew: false, description: "中毒几率增加{0}" },
    { id: "10052", name: "混沌伤害倍率增加", category: "通用词缀", subCategory: "混沌", isNew: false, description: "混沌伤害倍率增加{0}" },
    { id: "10053", name: "中毒层数上限增加", category: "通用词缀", subCategory: "中毒", isNew: false, description: "中毒层数上限增加{0}" },
    { id: "10054", name: "点燃层数上限增加", category: "通用词缀", subCategory: "点燃", isNew: false, description: "点燃层数上限增加{0}" },
    { id: "10055", name: "传奇装备——冷却转中毒时长", category: "通用词缀", subCategory: "装备", isNew: false, description: "当拥有40%冷却回复率时，则中毒持续时间提高{0}" },
    { id: "10056", name: "物理伤害倍率增加", category: "通用词缀", subCategory: "物理", isNew: false, description: "物理伤害倍率增加{0}" },
    { id: "10057", name: "火焰伤害倍率增加", category: "通用词缀", subCategory: "火焰", isNew: false, description: "火焰伤害倍率增加{0}" },
    { id: "10058", name: "冰冷伤害倍率增加", category: "通用词缀", subCategory: "冰霜", isNew: false, description: "冰冷伤害倍率增加{0}" },
    { id: "10059", name: "闪电伤害倍率增加", category: "通用词缀", subCategory: "闪电", isNew: false, description: "闪电伤害倍率增加{0}" },
    { id: "10060", name: "攻击暴击伤害增加", category: "通用词缀", subCategory: "暴击", isNew: false, description: "攻击暴击伤害增加{0}" },
    { id: "10061", name: "法术暴击伤害增加", category: "通用词缀", subCategory: "暴击", isNew: false, description: "法术暴击伤害增加{0}" },
    { id: "10062", name: "范围伤害提高", category: "通用词缀", subCategory: "范围", isNew: false, description: "范围伤害提高{0}" },
    { id: "10063", name: "近战伤害提高", category: "通用词缀", subCategory: "近战", isNew: false, description: "近战伤害提高{0}" },
    { id: "10064", name: "投射物伤害提高", category: "通用词缀", subCategory: "投射物", isNew: false, description: "投射物伤害提高{0}" },
    { id: "10065", name: "幻影是否耗蓝", category: "通用词缀", subCategory: "天赋", isNew: false, description: "幻影是否耗蓝" },
    { id: "10066", name: "攻击伤害提高", category: "通用词缀", subCategory: "通用", isNew: false, description: "攻击伤害提高{0}" },
    { id: "10067", name: "法术伤害增加", category: "通用词缀", subCategory: "通用", isNew: false, description: "法术伤害增加{0}" },
    { id: "10068", name: "召唤物伤害增加", category: "通用词缀", subCategory: "召唤", isNew: false, description: "召唤物伤害增加{0}" },
    { id: "10069", name: "物理伤害转火焰伤害增加", category: "通用词缀", subCategory: "火焰", isNew: false, description: "物理伤害转火焰伤害增加{0}" },
    { id: "10070", name: "物理伤害转冰冷伤害增加", category: "通用词缀", subCategory: "冰霜", isNew: false, description: "物理伤害转冰冷伤害增加{0}" },
    { id: "10071", name: "物理伤害转闪电伤害增加", category: "通用词缀", subCategory: "闪电", isNew: false, description: "物理伤害转闪电伤害增加{0}" },
    { id: "10072", name: "传奇装备——生命转中毒伤害", category: "通用词缀", subCategory: "装备", isNew: false, description: "当拥有2000点生命值时，则中毒伤害提高{0}" },
    { id: "10073", name: "攻击速度额外提高", category: "通用词缀", subCategory: "攻速", isNew: false, description: "攻击速度额外提高{0}" },
    { id: "10074", name: "暴击率额外提高", category: "通用词缀", subCategory: "暴击", isNew: false, description: "暴击率额外提高{0}" },
    { id: "10075", name: "火焰伤害转冰冷伤害增加", category: "通用词缀", subCategory: "火焰", isNew: false, description: "火焰伤害转冰冷伤害增加{0}" },
    { id: "10076", name: "闪电伤害转冰冷伤害增加", category: "通用词缀", subCategory: "冰霜", isNew: false, description: "闪电伤害转冰冷伤害增加{0}" },
    { id: "10077", name: "幻影数量增加", category: "通用词缀", subCategory: "幻影", isNew: false, description: "幻影数量增加{0}" },
    { id: "10078", name: "旋风斩无cd,伤害减少1.6倍率", category: "通用词缀", subCategory: "装备", isNew: false, description: "旋风斩无cd,伤害减少{0}倍率" },
    { id: "10079", name: "绝对暴击", category: "通用词缀", subCategory: "装备", isNew: false, description: "攻击一定会暴击，暴击伤害降低{0}" },
    { id: "10080", name: "近战技能范围效果增加", category: "通用词缀", subCategory: "装备", isNew: false, description: "近战技能范围效果增加{0}" },
    { id: "10081", name: "每秒生命回复", category: "通用词缀", subCategory: "生命", isNew: false, description: "每秒生命回复增加{0}" },
    { id: "10082", name: "攻击暴击伤害提高", category: "通用词缀", subCategory: "暴击", isNew: false, description: "攻击暴击伤害提高{0}" },
    { id: "10083", name: "法术暴击伤害提高", category: "通用词缀", subCategory: "暴击", isNew: false, description: "法术暴击伤害提高{0}" },
    { id: "10084", name: "全域暴击伤害提高", category: "通用词缀", subCategory: "暴击", isNew: false, description: "全域暴击伤害提高{0}" },
    { id: "10085", name: "天赋--太刀-第一个技能若是攻击技能，获得额外攻击速度", category: "通用词缀", subCategory: "天赋", isNew: false, description: "天赋--太刀-第一个技能若是攻击技能，获得额外攻击速度" },
    { id: "10086", name: "天赋--太刀-第一个技能若是攻击技能，获得额外冰冻累积", category: "通用词缀", subCategory: "天赋", isNew: false, description: "天赋--太刀-第一个技能若是攻击技能，获得额外冰冻累积" },
    { id: "10087", name: "天赋-太刀-暴击率转攻击伤害", category: "通用词缀", subCategory: "天赋", isNew: false, description: "天赋-太刀-暴击率转攻击伤害" },
    { id: "10088", name: "近战伤害额外提高", category: "通用词缀", subCategory: "近战", isNew: false, description: "近战伤害额外提高{0}" },
    { id: "10089", name: "天赋-太刀-移动速度转攻击伤害", category: "通用词缀", subCategory: "天赋", isNew: false, description: "天赋-太刀-移动速度转攻击伤害" },
    { id: "10095", name: "冻结效果提高", category: "通用词缀", subCategory: "冰霜", isNew: false, description: "冻结效果提高{0}" },
    { id: "10097", name: "幻影施法比例额外提高", category: "通用词缀", subCategory: "天赋", isNew: false, description: "幻影施法频率额外提高{0}" },
    { id: "10098", name: "幻影跟随", category: "通用词缀", subCategory: "天赋", isNew: false, description: "魔典-天赋-幻影跟随" },
    { id: "10102", name: "额外中毒效果", category: "通用词缀", subCategory: "天赋", isNew: false, description: "中毒效果额外提高{0}" },
    { id: "10106", name: "冷却回复率增加", category: "通用词缀", subCategory: "冷却", isNew: false, description: "冷却回复率增加{0}" },
    { id: "10109", name: "幻影伤害额外提高（叠加）-天赋", category: "通用词缀", subCategory: "天赋", isNew: false, description: "幻影伤害额外提高{0}（叠加）" },
];

const attributes = [
    // ---- 基础属性 ----
    { id: "10000", name: "基础攻击", description: "基础攻击力", attrType: "2", category: "基础属性" },
    { id: "10001", name: "基础生命", description: "基础生命值", attrType: "2", category: "基础属性" },
    { id: "10002", name: "基础魔力", description: "基础魔力值", attrType: "2", category: "基础属性" },
    { id: "10003", name: "生命每秒恢复", description: "每秒恢复的生命值", attrType: "2", category: "基础属性" },
    { id: "10004", name: "生命恢复率", description: "每秒根据最大生命值比例恢复生命值", attrType: "2", category: "基础属性" },
    { id: "10005", name: "魔力每秒恢复", description: "每秒恢复的魔力值", attrType: "2", category: "基础属性" },
    { id: "10006", name: "魔力恢复率", description: "每秒根据最大魔力值比例恢复魔力值", attrType: "2", category: "基础属性" },
    { id: "10007", name: "移动速度增加", description: "移动速度增加", attrType: "2", category: "基础属性" },
    { id: "10009", name: "命中率", description: "命中百分比概率", attrType: "2", category: "基础属性" },
    { id: "10010", name: "闪避率", description: "闪避百分比概率", attrType: "2", category: "基础属性" },
    { id: "10011", name: "格挡率", description: "格挡百分比概率", attrType: "2", category: "基础属性" },
    { id: "10012", name: "格挡减伤率", description: "格挡百分比减伤", attrType: "2", category: "基础属性" },
    { id: "10013", name: "攻击冷却缩减", description: "攻击冷却缩减", attrType: "2", category: "基础属性" },
    { id: "10014", name: "法术冷却缩减", description: "法术冷却缩减", attrType: "2", category: "基础属性" },
    { id: "10015", name: "攻击击中回血", description: "攻击命中敌人恢复生命", attrType: "2", category: "基础属性" },
    { id: "10016", name: "攻击击中回蓝", description: "攻击命中敌人恢复法力", attrType: "2", category: "基础属性" },
    { id: "10017", name: "法术击中回血", description: "法术命中敌人恢复生命", attrType: "2", category: "基础属性" },
    { id: "10018", name: "法术击中回蓝", description: "法术命中敌人恢复法力", attrType: "2", category: "基础属性" },
    { id: "10019", name: "击杀回血", description: "击杀敌人恢复生命", attrType: "2", category: "基础属性" },
    { id: "10020", name: "击杀回蓝", description: "击杀敌人恢复法力", attrType: "2", category: "基础属性" },
    { id: "10021", name: "能量", description: "能量上限", attrType: "2", category: "基础属性" },
    { id: "10022", name: "怒气", description: "怒气上限", attrType: "2", category: "基础属性" },
    { id: "10029", name: "攻击速度", description: "攻击速度比例", attrType: "2", category: "基础属性" },
    { id: "10030", name: "施法速度", description: "施法速度比例", attrType: "2", category: "基础属性" },
    { id: "10033", name: "投射物速度", description: "投射物速度比例", attrType: "2", category: "基础属性" },
    { id: "10034", name: "攻击速度比例", description: "攻击速度比例", attrType: "2", category: "基础属性" },
    { id: "10035", name: "施法速度比例", description: "施法速度比例", attrType: "2", category: "基础属性" },
    { id: "10100", name: "基础暴击率", description: "基础暴击概率百分比", attrType: "2", category: "基础属性" },
    { id: "10101", name: "全局暴击增加率", description: "全局暴击概率百分比提升", attrType: "2", category: "基础属性" },
    { id: "10102", name: "攻击暴击增加率", description: "攻击暴击概率百分比提升", attrType: "2", category: "基础属性" },
    { id: "10103", name: "法术暴击增加率", description: "法术暴击概率百分比提升", attrType: "2", category: "基础属性" },
    { id: "10200", name: "暴击伤害", description: "暴击伤害百分比", attrType: "2", category: "基础属性" },
    { id: "10300", name: "全局伤害提高", description: "全局增伤百分比", attrType: "2", category: "基础属性" },
    { id: "10301", name: "攻击伤害提高", description: "攻击增伤百分比", attrType: "2", category: "基础属性" },
    { id: "10302", name: "法术伤害提高", description: "法术增伤百分比", attrType: "2", category: "基础属性" },
    { id: "10303", name: "物理伤害提高", description: "物理增伤百分比", attrType: "2", category: "基础属性" },
    { id: "10304", name: "火焰伤害提高", description: "火焰增伤百分比", attrType: "2", category: "基础属性" },
    { id: "10305", name: "冰霜伤害提高", description: "冰霜增伤百分比", attrType: "2", category: "基础属性" },
    { id: "10306", name: "闪电伤害提高", description: "闪电增伤百分比", attrType: "2", category: "基础属性" },
    { id: "10307", name: "混沌伤害提高", description: "混沌增伤百分比", attrType: "2", category: "基础属性" },
    { id: "10308", name: "元素伤害提高", description: "元素增伤百分比", attrType: "2", category: "基础属性" },
    { id: "10309", name: "more伤", description: "more伤百分比", attrType: "2", category: "基础属性" },
    { id: "10310", name: "全局减伤", description: "全局减伤", attrType: "2", category: "基础属性" },
    { id: "10311", name: "物理抗性", description: "物理抗性百分比", attrType: "2", category: "基础属性" },
    { id: "10312", name: "火焰抗性", description: "火焰抗性百分比", attrType: "2", category: "基础属性" },
    { id: "10313", name: "冰霜抗性", description: "冰霜抗性百分比", attrType: "2", category: "基础属性" },
    { id: "10314", name: "闪电抗性", description: "闪电抗性百分比", attrType: "2", category: "基础属性" },
    { id: "10315", name: "混沌抗性", description: "混沌抗性百分比", attrType: "2", category: "基础属性" },
    { id: "10316", name: "元素抗性", description: "元素抗性百分比", attrType: "2", category: "基础属性" },
    { id: "10317", name: "火焰物理抗性", description: "火焰物理抗性百分比", attrType: "2", category: "基础属性" },
    { id: "10318", name: "冰霜物理抗性", description: "冰霜物理抗性百分比", attrType: "2", category: "基础属性" },
    { id: "10319", name: "闪电物理抗性", description: "闪电物理抗性百分比", attrType: "2", category: "基础属性" },
    { id: "10320", name: "火焰混沌抗性", description: "火焰混沌抗性百分比", attrType: "2", category: "基础属性" },
    { id: "10321", name: "冰霜混沌抗性", description: "冰霜混沌抗性百分比", attrType: "2", category: "基础属性" },
    { id: "10322", name: "闪电混沌抗性", description: "闪电混沌抗性百分比", attrType: "2", category: "基础属性" },
    { id: "10323", name: "击退抗性", description: "受击方属性，按百分比影响小击退、击退、击飞中，水平位移这段动作时长。", attrType: "2", category: "基础属性" },
    { id: "10324", name: "减速抗性", description: "受击方属性，按百分比影响自身受到减速效果的概率", attrType: "2", category: "基础属性" },
    { id: "10325", name: "眩晕抗性", description: "受击方属性，按百分比影响自身受到眩晕效果的概率", attrType: "2", category: "基础属性" },
    { id: "10400", name: "投射物技能等级", description: "投射物技能等级提升", attrType: "2", category: "基础属性" },
    { id: "10401", name: "攻击技能等级", description: "攻击技能等级提升", attrType: "2", category: "基础属性" },
    { id: "10402", name: "法术技能等级", description: "法术技能等级提升", attrType: "2", category: "基础属性" },
    { id: "10403", name: "物理技能等级", description: "物理技能等级提升", attrType: "2", category: "基础属性" },
    { id: "10404", name: "火焰技能等级", description: "火焰技能等级提升", attrType: "2", category: "基础属性" },
    { id: "10405", name: "冰霜技能等级", description: "冰冻技能等级提升", attrType: "2", category: "基础属性" },
    { id: "10406", name: "闪电技能等级", description: "闪电技能等级提升", attrType: "2", category: "基础属性" },
    { id: "10407", name: "混沌技能等级", description: "混沌技能等级提升", attrType: "2", category: "基础属性" },
    { id: "10408", name: "全技能等级", description: "全技能等级提升", attrType: "2", category: "基础属性" },
    { id: "10500", name: "额外物理伤害", description: "获得额外物理伤害(不受暴击影响)", attrType: "2", category: "基础属性" },
    { id: "10501", name: "额外火焰伤害", description: "获得额外火焰伤害(不受暴击影响)", attrType: "2", category: "基础属性" },
    { id: "10502", name: "额外冰霜伤害", description: "获得额外冰霜伤害(不受暴击影响)", attrType: "2", category: "基础属性" },
    { id: "10503", name: "额外闪电伤害", description: "获得额外闪电伤害(不受暴击影响)", attrType: "2", category: "基础属性" },
    { id: "10504", name: "额外混沌伤害", description: "获得额外混沌伤害(不受暴击影响)", attrType: "2", category: "基础属性" },
    { id: "10600", name: "攻击百比", description: "攻击百比", attrType: "2", category: "基础属性" },
    { id: "10601", name: "物理攻击百比", description: "物理攻击百比", attrType: "2", category: "基础属性" },
    { id: "10602", name: "火焰攻击百比", description: "火焰攻击百比", attrType: "2", category: "基础属性" },
    { id: "10603", name: "冰霜攻击百比", description: "冰霜攻击百比", attrType: "2", category: "基础属性" },
    { id: "10604", name: "闪电攻击百比", description: "闪电攻击百比", attrType: "2", category: "基础属性" },
    { id: "10605", name: "混沌攻击百比", description: "混沌攻击百比", attrType: "2", category: "基础属性" },
    { id: "10606", name: "元素攻击百比", description: "元素攻击百比", attrType: "2", category: "基础属性" },
    { id: "10700", name: "装备稀有度", description: "掉落装备稀有度百分比提高", attrType: "2", category: "基础属性" },
    { id: "10704", name: "经验掉落数量增加", description: "经验掉落数量增加", attrType: "2", category: "基础属性" },
    { id: "10705", name: "重熔出现概率", description: "重熔出现概率", attrType: "2", category: "基础属性" },
    { id: "10706", name: "基础等级影响掉落", description: "基础等级影响掉落", attrType: "2", category: "基础属性" },
    { id: "10800", name: "点燃强度", description: "造成点燃效果增强百分比", attrType: "2", category: "基础属性" },
    { id: "10801", name: "冰缓强度", description: "造成冰缓效果增强百分比", attrType: "2", category: "基础属性" },
    { id: "10802", name: "感电强度", description: "造成感电效果增强百分比", attrType: "2", category: "基础属性" },
    { id: "10803", name: "流血强度", description: "造成流血效果增强百分比", attrType: "2", category: "基础属性" },
    { id: "10804", name: "中毒强度", description: "造成中毒效果增强百分比", attrType: "2", category: "基础属性" },
    { id: "10805", name: "眩晕延长", description: "造成眩晕时间延长百分比", attrType: "2", category: "基础属性" },
    { id: "10806", name: "冰冻延长", description: "造成冰冻时间延长百分比", attrType: "2", category: "基础属性" },
    { id: "10807", name: "点燃抵抗", description: "受到点燃效果减弱百分比", attrType: "2", category: "基础属性" },
    { id: "10808", name: "冰缓抵抗", description: "受到冰缓效果减弱百分比", attrType: "2", category: "基础属性" },
    { id: "10809", name: "感电抵抗", description: "受到感电效果减弱百分比", attrType: "2", category: "基础属性" },
    { id: "10810", name: "流血抵抗", description: "受到流血效果减弱百分比", attrType: "2", category: "基础属性" },
    { id: "10811", name: "中毒抵抗", description: "受到中毒效果减弱百分比", attrType: "2", category: "基础属性" },
    { id: "10812", name: "眩晕缩减", description: "受到眩晕时间缩短百分比", attrType: "2", category: "基础属性" },
    { id: "10813", name: "冰冻缩减", description: "受到冰冻时间缩短百分比", attrType: "2", category: "基础属性" },

    // ---- 特殊属性 ----
    { id: "10900", name: "降低装备穿戴等级", description: "降低装备穿戴等级", attrType: "1", category: "特殊属性" },

    // ---- 基础属性 ----
    { id: "11001", name: "免疫点燃概率", description: "免疫点燃概率", attrType: "2", category: "基础属性" },
    { id: "11002", name: "免疫冰缓概率", description: "免疫冰缓概率", attrType: "2", category: "基础属性" },
    { id: "11003", name: "免疫冰冻概率", description: "免疫冰冻概率", attrType: "2", category: "基础属性" },
    { id: "11004", name: "免疫感电概率", description: "免疫感电概率", attrType: "2", category: "基础属性" },
    { id: "11005", name: "免疫触电概率", description: "免疫触电概率", attrType: "2", category: "基础属性" },
    { id: "11006", name: "点燃概率提高", description: "点燃概率提高", attrType: "2", category: "基础属性" },
    { id: "11007", name: "点燃效果比例", description: "点燃效果比例", attrType: "2", category: "基础属性" },
    { id: "11008", name: "冰冻效果比例", description: "冰冻效果比例", attrType: "2", category: "基础属性" },
    { id: "11009", name: "感电概率提高", description: "感电概率提高", attrType: "2", category: "基础属性" },
    { id: "11010", name: "感电效果比例", description: "感电效果比例", attrType: "2", category: "基础属性" },
    { id: "11011", name: "触电几率提高", description: "触电几率提高", attrType: "2", category: "基础属性" },
    { id: "11012", name: "受到点燃时间降低", description: "受到点燃时间降低", attrType: "2", category: "基础属性" },
    { id: "11013", name: "受到冰缓时间降低", description: "受到冰缓时间降低", attrType: "2", category: "基础属性" },
    { id: "11014", name: "受到冻结时间降低", description: "受到冻结时间降低", attrType: "2", category: "基础属性" },
    { id: "11015", name: "受到感电时间降低", description: "受到感电时间降低", attrType: "2", category: "基础属性" },
    { id: "11016", name: "受到触电时间降低", description: "受到触电时间降低", attrType: "2", category: "基础属性" },
    { id: "11017", name: "元素异常状态抵抗", description: "元素异常状态抵抗", attrType: "2", category: "基础属性" },
    { id: "11018", name: "元素异常状态阈值", description: "元素异常状态阈值", attrType: "2", category: "基础属性" },
    { id: "11019", name: "点燃层数上限增加", description: "点燃层数上限增加", attrType: "2", category: "基础属性" },
    { id: "11020", name: "物理伤害转化为闪电伤害", description: "物理伤害转化为闪电伤害", attrType: "2", category: "基础属性" },
    { id: "11021", name: "物理伤害转化为冰冷伤害", description: "物理伤害转化为冰冷伤害", attrType: "2", category: "基础属性" },
    { id: "11022", name: "物理伤害转化为火焰伤害", description: "物理伤害转化为火焰伤害", attrType: "2", category: "基础属性" },
    { id: "11023", name: "闪电伤害转化为冰冷伤害", description: "闪电伤害转化为冰冷伤害", attrType: "2", category: "基础属性" },
    { id: "11024", name: "闪电伤害转化为火焰伤害", description: "闪电伤害转化为火焰伤害", attrType: "2", category: "基础属性" },
    { id: "11025", name: "火焰伤害转化为冰冷伤害", description: "火焰伤害转化为冰冷伤害", attrType: "2", category: "基础属性" },
    { id: "11026", name: "火焰伤害转化为闪电伤害", description: "火焰伤害转化为闪电伤害", attrType: "2", category: "基础属性" },
    { id: "11027", name: "冰冷伤害转换为闪电伤害", description: "冰冷伤害转换为闪电伤害", attrType: "2", category: "基础属性" },
    { id: "11028", name: "冰冷伤害转换为火焰伤害", description: "冰冷伤害转换为火焰伤害", attrType: "2", category: "基础属性" },
    { id: "11029", name: "冰冷伤害转换为混沌伤害", description: "冰冷伤害转换为混沌伤害", attrType: "2", category: "基础属性" },
    { id: "11030", name: "闪电伤害转换为混沌伤害", description: "闪电伤害转换为混沌伤害", attrType: "2", category: "基础属性" },
    { id: "11031", name: "火焰伤害转换为混沌伤害", description: "火焰伤害转换为混沌伤害", attrType: "2", category: "基础属性" },
    { id: "11032", name: "造成点燃时间比例", description: "造成点燃时间比例", attrType: "2", category: "基础属性" },
    { id: "11033", name: "造成冰缓时间比例", description: "造成冰缓时间比例", attrType: "2", category: "基础属性" },
    { id: "11034", name: "造成冰冻时间比例", description: "造成冰冻时间比例", attrType: "2", category: "基础属性" },
    { id: "11035", name: "造成感电时间比例", description: "造成感电时间比例", attrType: "2", category: "基础属性" },
    { id: "11036", name: "造成触电时间比例", description: "造成触电时间比例", attrType: "2", category: "基础属性" },
    { id: "11037", name: "冷却回复效率", description: "冷却回复效率", attrType: "2", category: "基础属性" },
    { id: "11038", name: "中毒概率", description: "中毒概率", attrType: "2", category: "基础属性" },
    { id: "11039", name: "中毒效果比例", description: "中毒效果比例", attrType: "2", category: "基础属性" },
    { id: "11040", name: "造成中毒时间比例", description: "造成中毒时间比例", attrType: "2", category: "基础属性" },
    { id: "11041", name: "魔力消耗转生命消耗", description: "魔力消耗转生命消耗", attrType: "2", category: "基础属性" },
    { id: "11042", name: "受伤缓冲", description: "受伤缓冲", attrType: "2", category: "基础属性" },
    { id: "11046", name: "中毒层数上限增加", description: "中毒层数上限增加", attrType: "2", category: "基础属性" },
    { id: "11047", name: "持续伤害比例", description: "持续伤害比例", attrType: "2", category: "基础属性" },
];


// ============================================================
// 词缀原始数据备份（用于恢复默认描述）
// ============================================================
const originalAffixData = affixes.map(a => ({ ...a }));

// ============================================================
// 技能原始数据备份（用于恢复默认描述）
// ============================================================
const originalActiveSkills = activeSkills.map(s => ({ ...s }));
const originalPassiveSkills = passiveSkills.map(s => ({ ...s }));

// ============================================================
// 装备数据 - 用户自定义，存储于 localStorage
// 结构: { id, name, type, effects: [{ refId, refType }] }
// effects 中的 refId 填写技能ID或词缀ID，自动匹配对应描述
// ============================================================
let equipmentData = [];

// ============================================================
// 默认传奇装备数据 (从装备表 LegendEquip 导入)
// ============================================================
const defaultLegendEquipment = [
    // 待填充：默认传奇装备数据
];

function loadEquipmentData() {
    // 如果自动导入数据已加载，不再从 localStorage 重新读取（避免版本检查覆盖）
    if (window.__AUTO_IMPORT_DATA__ && window.__AUTO_IMPORT_DATA__.equipment) {
        console.log('  ℹ️ 装备数据已由自动导入加载，跳过 loadEquipmentData');
        return;
    }
    try {
        // 版本检查：数据清空重建，清除所有旧缓存
        const EQUIP_DATA_VERSION = 'v5_autoimport';
        const savedVersion = localStorage.getItem('chronicle_equipment_version');
        const versionChanged = savedVersion !== EQUIP_DATA_VERSION;

        const saved = localStorage.getItem('chronicle_equipment');
        if (saved && !versionChanged) {
            equipmentData = JSON.parse(saved);
            // 合并：用默认数据更新已有传奇装备（更新effects + 移除isNew标记）
            const defaultMap = {};
            defaultLegendEquipment.forEach(eq => { defaultMap[eq.id] = eq; });
            equipmentData.forEach(eq => {
                if (defaultMap[eq.id]) {
                    // 保留用户自定义的name和type，但更新effects为最新映射
                    const def = defaultMap[eq.id];
                    eq.effects = JSON.parse(JSON.stringify(def.effects));
                    // 移除isNew标记（v3版本：传奇装备不再标记为新增）
                    delete eq.isNew;
                }
            });
            // 合并：添加默认传奇装备中不存在于已保存数据的项
            const existingIds = new Set(equipmentData.map(e => e.id));
            defaultLegendEquipment.forEach(eq => {
                if (!existingIds.has(eq.id)) {
                    equipmentData.push(JSON.parse(JSON.stringify(eq)));
                }
            });
            // 清理：移除空效果条目（refId 为空字符串的）
            equipmentData.forEach(eq => {
                if (eq.effects) {
                    eq.effects = eq.effects.filter(e => e && e.refId && e.refId.trim());
                }
            });
            if (versionChanged) {
                localStorage.setItem('chronicle_equipment_version', EQUIP_DATA_VERSION);
                saveEquipmentData();
                // 清除 chronicle_new_status 中默认传奇装备的isNew记录
                try {
                    const nsRaw = localStorage.getItem('chronicle_new_status');
                    if (nsRaw) {
                        const ns = JSON.parse(nsRaw);
                        defaultLegendEquipment.forEach(eq => { delete ns[eq.id]; });
                        localStorage.setItem('chronicle_new_status', JSON.stringify(ns));
                    }
                } catch (e) {}
            }
        } else {
            // 首次加载或版本变更
            if (saved) {
                // 版本变更但有已保存数据：保留数据，只更新版本号
                equipmentData = JSON.parse(saved);
            } else {
                // 首次加载，使用默认数据（当前为空）
                equipmentData = JSON.parse(JSON.stringify(defaultLegendEquipment));
            }
            if (versionChanged) {
                localStorage.setItem('chronicle_equipment_version', EQUIP_DATA_VERSION);
                saveEquipmentData();
            }
        }
    } catch (e) {
        console.warn('加载装备数据失败:', e);
        equipmentData = JSON.parse(JSON.stringify(defaultLegendEquipment));
    }
}

function saveEquipmentData() {
    try {
        localStorage.setItem('chronicle_equipment', JSON.stringify(equipmentData));
    } catch (e) {
        console.warn('保存装备数据失败:', e);
    }
}

function generateEquipmentId() {
    const maxId = equipmentData.reduce((max, e) => {
        const num = parseInt(e.id.replace('EQ', ''));
        return num > max ? num : max;
    }, 0);
    return 'EQ' + String(maxId + 1).padStart(4, '0');
}

// ============================================================
// 辅助技能宝石数据 (localStorage存储)
// ============================================================
let gemData = [];

(function loadGemData() {
    try {
        const saved = localStorage.getItem('chronicle_gems');
        if (saved) {
            gemData = JSON.parse(saved);
        }
    } catch (e) {
        console.warn('加载宝石数据失败:', e);
        gemData = [];
    }
})();

function saveGemData() {
    try {
        localStorage.setItem('chronicle_gems', JSON.stringify(gemData));
    } catch (e) {
        console.warn('保存宝石数据失败:', e);
    }
}

function generateGemId() {
    const maxId = gemData.reduce((max, g) => {
        const num = parseInt(g.id.replace('GEM', ''));
        return num > max ? num : max;
    }, 0);
    return 'GEM' + String(maxId + 1).padStart(4, '0');
}

// ============================================================
// 自定义技能数据 (localStorage存储)
// ============================================================
let customSkillData = [];

(function loadCustomSkillData() {
    try {
        const saved = localStorage.getItem('chronicle_custom_skills');
        if (saved) {
            customSkillData = JSON.parse(saved);
        }
    } catch (e) {
        console.warn('加载自定义技能数据失败:', e);
        customSkillData = [];
    }
})();

function saveCustomSkillData() {
    try {
        localStorage.setItem('chronicle_custom_skills', JSON.stringify(customSkillData));
    } catch (e) {
        console.warn('保存自定义技能数据失败:', e);
    }
}

function generateCustomSkillId() {
    const maxId = customSkillData.reduce((max, s) => {
        const num = parseInt(s.id.replace('CS', ''));
        return num > max ? num : max;
    }, 0);
    return 'CS' + String(maxId + 1).padStart(4, '0');
}

// ============================================================
// 传奇装备词条映射表 (Modifier ID → 描述+效果ID)
// ============================================================
const legendModifierMap = {
    // 待填充：传奇装备词条映射表
};

// 根据 refId 查找技能或词缀信息
function findRefData(refId) {
    if (!refId) return null;
    // 先查主动技能
    let skill = activeSkills.find(s => s.id === refId);
    if (skill) return { type: 'active-skill', name: skill.name, desc: skill.description, category: skill.category, subCategory: skill.subCategory };
    // 查被动技能
    skill = passiveSkills.find(s => s.id === refId);
    if (skill) return { type: 'passive-skill', name: skill.name, desc: skill.description, category: skill.category, subCategory: skill.subCategory };
    // 查词缀
    const affix = affixes.find(a => a.id === refId);
    if (affix) return { type: 'affix', name: affix.name, desc: affix.description, category: affix.category, subCategory: affix.subCategory };
    // 查属性
    const attr = attributes.find(a => a.id === refId);
    if (attr) return { type: 'attribute', name: attr.name, desc: attr.description, category: attr.category, subCategory: '属性' };
    // 查传奇装备词条映射
    const modInfo = legendModifierMap[refId];
    if (modInfo) {
        return { type: 'attribute', name: modInfo.desc, desc: modInfo.desc, category: '属性效果', subCategory: '无映射' };
    }
    return null;
}

// ============================================================
// 自动导入数据加载 (由 import.js 生成的 auto-import-data.js)
// ============================================================
(function loadAutoImportData() {
    if (!window.__AUTO_IMPORT_DATA__) {
        console.log('⚠️ 未检测到自动导入数据 (auto-import-data.js 未加载或为空)');
        return;
    }
    const data = window.__AUTO_IMPORT_DATA__;
    console.log('📂 检测到自动导入数据，导入时间:', data.importTime);

    // 词缀
    try {
        if (data.affixes && data.affixes.length > 0) {
            affixes.length = 0;
            affixes.push(...data.affixes);
            try { localStorage.setItem('chronicle_synced_affixes', JSON.stringify(affixes)); } catch(e) {}
            console.log('  ✓ 词缀:', affixes.length, '条');
        }
    } catch(e) { console.error('  ❌ 词缀加载失败:', e); }

    // 属性
    try {
        if (data.attributes && data.attributes.length > 0) {
            attributes.length = 0;
            attributes.push(...data.attributes);
            try { localStorage.setItem('chronicle_synced_attrs', JSON.stringify(attributes)); } catch(e) {}
            console.log('  ✓ 属性:', attributes.length, '条');
        }
    } catch(e) { console.error('  ❌ 属性加载失败:', e); }

    // 装备
    try {
        if (data.equipment && data.equipment.length > 0) {
            equipmentData.length = 0;
            equipmentData.push(...data.equipment);
            try { saveEquipmentData(); } catch(e) { console.warn('  ⚠️ saveEquipmentData 失败:', e); }
            console.log('  ✓ 装备:', equipmentData.length, '件');
        }
    } catch(e) { console.error('  ❌ 装备加载失败:', e); }

    // 主动技能 (导入数据替换内置数据，用于 findRefData 查找)
    try {
        if (data.activeSkills && data.activeSkills.length > 0) {
            activeSkills.length = 0;
            activeSkills.push(...data.activeSkills);
            console.log('  ✓ 主动技能(内置):', activeSkills.length, '个');
        }
    } catch(e) { console.error('  ❌ 主动技能加载失败:', e); }

    // 被动技能 (导入数据替换内置数据，用于 findRefData 查找)
    try {
        if (data.passiveSkills && data.passiveSkills.length > 0) {
            passiveSkills.length = 0;
            passiveSkills.push(...data.passiveSkills);
            console.log('  ✓ 被动技能(内置):', passiveSkills.length, '个');
        }
    } catch(e) { console.error('  ❌ 被动技能加载失败:', e); }

    // 技能库 (把导入的技能同步到 customSkillData，用于技能库页面展示)
    try {
        const importedSkills = [
            ...(data.activeSkills || []),
            ...(data.passiveSkills || [])
        ];
        if (importedSkills.length > 0) {
            // 保留手动添加的技能，清除旧的 sync 来源技能
            const manualSkills = customSkillData.filter(s => s.source === 'manual');
            customSkillData.length = 0;
            customSkillData.push(...manualSkills);

            // 去重：已存在的手动技能不再添加
            const existingIds = {};
            customSkillData.forEach(s => { if (s.sourceId) existingIds[s.sourceId] = s; });

            let skillCounter = 0;
            importedSkills.forEach(skill => {
                if (existingIds[skill.id]) return; // 跳过已存在
                skillCounter++;
                customSkillData.push({
                    id: 'CS' + String(skillCounter).padStart(4, '0'),
                    name: skill.name || '未命名技能',
                    type: (skill.id[0] === '1') ? '主动技能' : '被动技能',
                    desc: skill.description || '',
                    sourceId: skill.id,
                    effects: [{ refId: skill.id }],
                    isNew: true,
                    source: 'sync',
                    createdAt: new Date().toISOString()
                });
            });
            try { saveCustomSkillData(); } catch(e) { console.warn('  ⚠️ saveCustomSkillData 失败:', e); }
            console.log('  ✓ 技能库:', customSkillData.length, '个');
        }
    } catch(e) { console.error('  ❌ 技能库加载失败:', e); }

    // 宝石
    try {
        if (data.gems && data.gems.length > 0) {
            gemData.length = 0;
            gemData.push(...data.gems);
            try { saveGemData(); } catch(e) { console.warn('  ⚠️ saveGemData 失败:', e); }
            console.log('  ✓ 宝石:', gemData.length, '个');
        }
    } catch(e) { console.error('  ❌ 宝石加载失败:', e); }

    console.log('  自动导入完成');
})();

// ============================================================
// ID规则分类定义
// ============================================================
const idRules = {
    format: "A+B+C+D+E+000F+G",
    segments: [
        { key: "A", name: "技能类型", desc: "区分主动/被动", values: { "1": "主动技能", "2": "被动技能(特技)" } },
        { key: "B", name: "技能大类", desc: "技能归属分类", values: { "1": "角色技能", "2": "法术技能", "3": "装备技能", "4": "通用/增益", "5": "天赋技能" } },
        { key: "C", name: "技能子类", desc: "细分类型", values: { "1": "战斗/元素之捷", "2": "法术/位移", "3": "特殊", "4": "增益/通用", "5": "天赋" } },
        { key: "D", name: "效果类型", desc: "效果方向", values: { "0": "默认" } },
        { key: "E", name: "元素/属性", desc: "元素属性标记", values: { "0": "无/默认" } },
        { key: "000F", name: "序号", desc: "4位序号(000前缀+F序号)", values: {} },
        { key: "G", name: "等级标识", desc: "版本/等级标记", values: { "0": "默认" } }
    ]
};

// ============================================================
// 主动技能分类映射 (B+C段位)
// ============================================================
const activeCategoryMap = {
    "11": { name: "战斗技能", desc: "近战/远程物理攻击技能", count: 0 },
    "12": { name: "法术技能", desc: "法术/元素/召唤技能", count: 0 },
    "14": { name: "增益技能", desc: "增益/战吼/祝福技能", count: 0 }
};

// ============================================================
// 主动技能 B段位分类映射
// ============================================================
const activeBMap = {
    "1": { name: "技能系", desc: "所有主动技能均属于技能系" }
};

// ============================================================
// 主动技能 C段位分类映射 (B=1下的子分类)
// ============================================================
const activeCMap = {
    "1": { name: "战斗攻击", desc: "近战斩击/穿刺/范围/远程射击类物理攻击" },
    "2": { name: "法术释放", desc: "法术/元素/位移/召唤类魔法攻击" },
    "4": { name: "增益辅助", desc: "增益/战吼/祝福类辅助技能" }
};

// ============================================================
// 被动技能分类映射 (B+C段位)
// ============================================================
const passiveCategoryMap = {
    "11": { name: "元素之捷", desc: "元素附加效果被动", count: 0 },
    "12": { name: "法术被动", desc: "法术/魔典相关被动", count: 0 },
    "14": { name: "通用被动", desc: "通用增益/装备被动", count: 0 },
    "15": { name: "天赋被动", desc: "天赋系统被动", count: 0 },
    "34": { name: "装备暗金被动", desc: "暗金装备专属被动", count: 0 }
};

// ============================================================
// 被动技能 B段位分类映射
// ============================================================
const passiveBMap = {
    "1": { name: "常规系", desc: "角色自身获取的被动技能" },
    "3": { name: "装备系", desc: "由装备提供的专属被动技能" }
};

// ============================================================
// 被动技能 C段位分类映射
// ============================================================
const passiveCMap = {
    "1": { name: "元素附加", desc: "元素之捷类被动，附加元素效果" },
    "2": { name: "法术相关", desc: "法术被动/魔典被动" },
    "4": { name: "通用增益", desc: "通用被动/装备被动" },
    "5": { name: "天赋系统", desc: "天赋树被动技能" }
};

// ============================================================
// 工具函数：解析技能ID
// ============================================================
function parseSkillId(id) {
    const idStr = String(id);
    return {
        A: idStr[0],
        B: idStr[1],
        C: idStr[2],
        D: idStr[3],
        E: idStr[4],
        F: idStr.slice(5, 9),
        seq: idStr.slice(5, 9),
        G: idStr[9],
        full: idStr
    };
}

// ============================================================
// 词缀ID段位解析
// 词缀ID为5位数字: 前缀(1位) + 序号(4位)
// 前缀1=技能词缀, 2=装备词缀, 3=传奇装备词缀, 4=天赋词缀
// ============================================================
const affixPrefixMap = {
    '1': { name: '技能词缀', desc: '作用于技能的词缀效果' },
    '2': { name: '装备词缀', desc: '装备提供的属性词缀' },
    '3': { name: '传奇装备词缀', desc: '暗金装备专属传奇词缀' },
    '4': { name: '天赋词缀', desc: '天赋系统词缀效果' }
};

// 词缀大分类：5位ID为通用词缀，大于5位为特殊词缀
function getAffixMainCategory(id) {
    const idStr = String(id);
    return idStr.length <= 5 ? '通用词缀' : '特殊词缀';
}

function parseAffixId(id) {
    const idStr = String(id);
    const prefix = idStr.charAt(0);
    const seq = idStr.slice(1);
    const cat = affixPrefixMap[prefix] || { name: '未知', desc: '未分类' };
    return {
        prefix: prefix,
        prefixName: cat.name,
        prefixDesc: cat.desc,
        seq: seq,
        full: idStr
    };
}

// ============================================================
// 根据技能ID自动确定分类 (基于B+C段位)
// ============================================================
function autoDetectSkillCategory(id) {
    const parsed = parseSkillId(id);
    const bc = parsed.B + parsed.C;
    const a = parsed.A;

    if (a === '1') {
        // 主动技能
        const map = activeCategoryMap[bc];
        if (map) return { category: map.name, subCategory: map.desc };
        return { category: '未知技能', subCategory: '未分类' };
    } else if (a === '2') {
        // 被动技能
        const map = passiveCategoryMap[bc];
        if (map) return { category: map.name, subCategory: map.desc };
        return { category: '未知被动', subCategory: '未分类' };
    }
    return { category: '未知', subCategory: '未分类' };
}

// ============================================================
// 根据词缀ID自动确定分类
// ============================================================
function autoDetectAffixCategory(id) {
    return {
        category: getAffixMainCategory(id),
        subCategory: parseAffixId(id).prefixName
    };
}

// ============================================================
// 检查ID是否已存在（技能+词缀）
// ============================================================
function isIdExists(id) {
    if (activeSkills.find(s => s.id === id)) return true;
    if (passiveSkills.find(s => s.id === id)) return true;
    if (affixes.find(a => a.id === id)) return true;
    return false;
}

// ============================================================
// 验证技能ID格式 (10位数字)
// ============================================================
function validateSkillId(id) {
    const idStr = String(id);
    if (!/^\d{10}$/.test(idStr)) return { valid: false, error: '技能ID必须为10位数字' };
    const a = idStr[0];
    if (a !== '1' && a !== '2') return { valid: false, error: 'A段位必须为1(主动)或2(被动)' };
    return { valid: true };
}

// ============================================================
// 验证词缀ID格式 (5位=通用词缀, 5位以上=特殊词缀, 前缀1-4)
// ============================================================
function validateAffixId(id) {
    const idStr = String(id);
    if (!/^\d{5,}$/.test(idStr)) return { valid: false, error: '词缀ID必须为至少5位数字' };
    const prefix = idStr.charAt(0);
    if (!affixPrefixMap[prefix]) return { valid: false, error: '前缀必须为1/2/3/4 (技能/装备/传奇/天赋词缀)' };
    return { valid: true };
}
function getCategoryColor(category) {
    const colors = {
        "战斗技能": "#e74c3c",
        "法术技能": "#9b59b6",
        "增益技能": "#f39c12",
        "元素之捷": "#3498db",
        "通用被动": "#2ecc71",
        "法术被动": "#9b59b6",
        "天赋被动": "#e67e22",
        "魔典被动": "#1abc9c",
        "装备被动": "#95a5a6",
        "装备暗金被动": "#c0392b",
        "技能词缀": "#3498db",
        "装备词缀": "#2ecc71",
        "传奇装备词缀": "#f39c12",
        "天赋词缀": "#e67e22",
        "通用词缀": "#3498db",
        "特殊词缀": "#e74c3c"
    };
    return colors[category] || "#7f8c8d";
}

// ============================================================
// 工具函数：获取分类图标
// ============================================================
function getCategoryIcon(category) {
    const icons = {
        "战斗技能": "⚔️",
        "法术技能": "🔮",
        "增益技能": "✨",
        "元素之捷": "❄️",
        "通用被动": "🛡️",
        "法术被动": "📖",
        "天赋被动": "🌟",
        "魔典被动": "📕",
        "装备被动": "👕",
        "装备暗金被动": "👑",
        "技能词缀": "✨",
        "装备词缀": "🔧",
        "传奇装备词缀": "🏆",
        "天赋词缀": "🌟",
        "通用词缀": "✨",
        "特殊词缀": "🔮"
    };
    return icons[category] || "📋";
}
