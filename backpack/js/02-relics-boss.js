'use strict';
/* ===== 遺物 ===== */
const RELICS = [
  { id: "hourglass", nm: "沙漏", m: { cdAll: 0.92 }, desc: "所有牌冷卻 -8%" },
  { id: "whet", nm: "磨刀石", m: { dmgAdd: 1 }, desc: "所有攻擊牌傷害 +1" },
  { id: "chain", nm: "鎖鏈", m: { linkAdd: 1 }, desc: "每條相鄰連結，讓受益的牌主要數值 +1" },
  { id: "buckler", nm: "小圓盾", m: { open: 12 }, desc: "戰鬥開始時獲得 12 護盾" },
  { id: "pouch", nm: "錢袋", m: { incomeAdd: 3 }, desc: "每回合結束額外 +3 金幣" },
  { id: "herb", nm: "草藥包", m: { regenAll: 1 }, desc: "戰鬥中每秒回復 1 點血量" },
  { id: "hearth", nm: "暖爐", m: { hpAdd: 15 }, desc: "最大生命 +15" },
  { id: "mirror", nm: "魔鏡", m: { thorns: 2 }, desc: "被攻擊時反彈 2 傷害" },
  { id: "fang", nm: "毒牙", m: { poisonAdd: 1 }, desc: "所有攻擊牌額外施加 1 中毒" },
  { id: "ember", nm: "餘燼", m: { burnAdd: 1 }, desc: "所有攻擊牌額外施加 1 灼燒" },
  { id: "scale", nm: "天秤", m: { auraAmp: 0.4 }, desc: "光環效果強化 40%" },
  { id: "clover", nm: "四葉草", m: { freeReroll: 1 }, desc: "每回合第一次重抽免費" },
  { id: "coupon", nm: "折價券", m: { discount: 1 }, desc: "商店所有牌 -1 金幣（最低 1）" },
  { id: "phoenix", nm: "鳳凰羽", m: { phoenix: true }, desc: "每場戰鬥第一次倒下時，以 30% 血量復活" },
  { id: "tide", nm: "潮汐", m: { pulse: 6 }, desc: "戰鬥中每 5 秒獲得 6 護盾" }
];
const RID = Object.fromEntries(RELICS.map(r => [r.id, r]));
function relicMods(ids) {
  const m = {};
  (ids || []).forEach(id => { const r = RID[id]; if (!r) return; Object.entries(r.m).forEach(([k, v]) => { if (k === "cdAll") m[k] = (m[k] || 1) * v; else if (v === true) m[k] = true; else m[k] = (m[k] || 0) + v; }); });
  return m;
}
function relicChoices(owned, n) {
  const pool = RELICS.filter(r => !owned.includes(r.id)), out = [];
  while (out.length < (n || 3) && pool.length) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  return out;
}

/* ===== 起始角色 ===== */
const CHARS = [
  { id: "mage", nm: "魔術師", ic: "m1", start: ["w2"], gold: 0, m: { burnAdd: 1, hpAdd: -10 }, pro: "所有攻擊牌額外灼燒 +1", con: "最大生命 -10", unlock: null },
  { id: "priest", nm: "女祭司", ic: "m2", start: ["c3"], gold: -3, m: { regenAll: 1 }, pro: "戰鬥中每秒回復 1 血", con: "起始金幣 -3", unlock: null },
  { id: "chariot", nm: "戰車", ic: "m7", start: ["s4"], gold: 0, m: { cdAll: 0.92, hpAdd: -10 }, pro: "所有牌冷卻 -8%", con: "最大生命 -10", unlock: null },
  { id: "emperor", nm: "皇帝", ic: "m5", start: ["p5"], gold: 0, m: { open: 10, incomeAdd: 2, cdAll: 1.05 }, pro: "開場 10 護盾、每回合 +2 金幣", con: "所有牌冷卻 +5%", unlock: null },
  { id: "fool", nm: "愚者", ic: "m8", start: ["s3", "p3"], gold: 2, m: { freeReroll: 1, hpAdd: -8 }, pro: "起始 2 張牌、每回合首次重抽免費", con: "最大生命 -8", unlock: "擊破 1 個 Boss", ok: m => m.bossKills >= 1 },
  { id: "wheel", nm: "命運之輪", ic: "m10", start: ["p1"], gold: 4, m: { phoenix: true, hpAdd: -15 }, pro: "每場戰鬥第一次倒下時 30% 血量復活", con: "最大生命 -15", unlock: "通關一次", ok: m => m.clears >= 1 }
];
const CID = Object.fromEntries(CHARS.map(c => [c.id, c]));
CHARS.forEach(c => { RID["ch_" + c.id] = { id: "ch_" + c.id, nm: c.nm, m: c.m, desc: c.pro + "；" + c.con }; });
const charOfSuit = s => ({ wands: "mage", cups: "priest", swords: "chariot", pents: "emperor" })[s];

/* ===== Boss ===== */
const BOSSES = {
  4: { type: "armor", nm: "石像鬼守衛", desc: "開場自帶 12 護盾，每 5 秒再獲得 5 護盾" },
  8: { type: "reap", nm: "死神使者", desc: "每 6 秒收割：清空你的護盾，並造成你最大血量 10% 的無視護盾傷害" },
  12: { type: "chaos", nm: "命運女神", desc: "每 5 秒擲出命運：自癒／灼燒你／延遲你的牌／獲得護盾" }
};


/* ===== Boss 詞綴（同一隻 Boss 的不同變體；名字與美術不變，只改行為）===== */
// p 參數：open 開場護盾、gain 週期護盾、thorns 反彈、delay 延遲你一張牌（秒）、clear 是否清護盾、pct 收割比例、poison 附加中毒、
//        enrageAt／enrageIv 血量低於比例後的新間隔、regenE 每秒回血、iv 行動間隔（秒）
const BOSS_VARIANTS = {
  4: [
    { id: "a1", nm: "標準", desc: "開場自帶 12 護盾，每 5 秒再獲得 5 護盾", p: {} },
    { id: "a2", nm: "荊棘", desc: "開場 4 護盾並反彈 2 傷害，每 5 秒獲得 3 護盾", p: { open: 4, thorns: 2, gain: 3 } },
    { id: "a3", nm: "石化", desc: "開場 8 護盾；每 5 秒獲得 3 護盾，並讓你一張牌延遲 1.5 秒", p: { open: 8, gain: 3, delay: 1.5 } }
  ],
  8: [
    { id: "b1", nm: "標準", desc: "每 6 秒收割：清空你的護盾，並造成你最大血量 10% 的無視護盾傷害", p: {} },
    { id: "b2", nm: "瘟疫", desc: "每 6 秒：不清護盾，但造成你最大血量 8% 的無視護盾傷害，並使你中毒 +4", p: { clear: false, pct: 0.08, poison: 4 } },
    { id: "b3", nm: "獵殺", desc: "收割同標準；血量低於 50% 後，收割間隔縮短為 4 秒", p: { enrageAt: 0.5, enrageIv: 4 } }
  ],
  12: [
    { id: "c1", nm: "標準", desc: "每 5 秒擲出命運：自癒／灼燒你／延遲你的牌／獲得護盾", p: {} },
    { id: "c2", nm: "傲慢", desc: "開場 8 護盾且每秒回復 2 血，但命運每 6 秒才擲一次", p: { open: 8, regenE: 2, iv: 6 } },
    { id: "c3", nm: "輪盤", desc: "命運擲得更頻繁：每 4 秒一次", p: { iv: 4 } }
  ]
};
function bossWith(round, afId) {
  const b = BOSSES[round]; if (!b) return null;
  const vs = BOSS_VARIANTS[round]; if (!vs) return b;
  const v = vs.find(x => x.id === afId) || vs[0];
  return Object.assign({}, b, { af: v.id, afNm: v.nm, afDesc: v.desc, desc: v === vs[0] ? v.desc : `【${v.nm}】${v.desc}`, p: v.p });
}

/* ===== 命運牌陣：過去（饋贈，立即生效）／現在（本局修正，有利有弊）／未來（Boss 預兆）===== */
// fx：開局一次性效果；m：本局持續修正（與遺物同一套 mods）；bossDmg/bossOpen/bossCd/bossGold/bossHp 只在 Boss 戰生效
const FATE = {
  past: [
    { id: "pa1", ic: "m3", nm: "皇后的饋贈", pro: "起始金幣 +5", fx: { gold: 5 } },
    { id: "pa2", ic: "m8", nm: "力量的餘韻", pro: "最大生命 +8", fx: { hp: 8 } },
    { id: "pa3", ic: "m1", nm: "魔術師的行囊", pro: "額外獲得 1 張隨機一階牌", fx: { item: 1 } },
    { id: "pa4", ic: "m5", nm: "教皇的祝福", pro: "獲得 1 件隨機遺物", fx: { relic: 1 } },
    { id: "pa5", ic: "m14", nm: "節制的記憶", pro: "戰鬥中每秒回復 1 血", m: { regenAll: 1 } },
    { id: "pa6", ic: "m7", nm: "戰車的磨礪", pro: "所有攻擊牌傷害 +1", m: { dmgAdd: 1 } }
  ],
  present: [
    { id: "pr1", ic: "m15", nm: "惡魔契約", pro: "起始金幣 +10", con: "最大生命 -10", fx: { gold: 10 }, m: { hpAdd: -10 } },
    { id: "pr2", ic: "m10", nm: "輪轉的命運", pro: "每回合結束 +2 金幣", con: "所有牌冷卻 +5%", m: { incomeAdd: 2, cdAll: 1.05 } },
    { id: "pr3", ic: "m12", nm: "倒吊的姿態", pro: "戰鬥開始獲得 10 護盾", con: "最大生命 -8", m: { open: 10, hpAdd: -8 } },
    { id: "pr4", ic: "m19", nm: "烈日當空", pro: "所有牌冷卻 -8%", con: "商店牌價 +1", m: { cdAll: 0.92, discount: -1 } },
    { id: "pr5", ic: "m18", nm: "月下迷霧", pro: "所有攻擊牌額外 +1 中毒", con: "最大生命 -6", m: { poisonAdd: 1, hpAdd: -6 } },
    { id: "pr6", ic: "m16", nm: "高塔的雷鳴", pro: "所有攻擊牌傷害 +2", con: "最大生命 -12", m: { dmgAdd: 2, hpAdd: -12 } }
  ],
  future: [
    { id: "fu1", ic: "m16", nm: "高塔預兆", pro: "對 Boss 傷害 +15%", m: { bossDmg: 0.15 } },
    { id: "fu2", ic: "m7", nm: "戰車預兆", pro: "Boss 戰開場 +18 護盾", m: { bossOpen: 18 } },
    { id: "fu3", ic: "m17", nm: "星星預兆", pro: "Boss 戰所有牌冷卻 -10%", m: { bossCd: 0.10 } },
    { id: "fu4", ic: "m3", nm: "皇后預兆", pro: "每擊破一個 Boss，額外 +8 金幣", m: { bossGold: 8 } },
    { id: "fu5", ic: "m13", nm: "死神預兆", pro: "每擊破一個 Boss，最大生命 +4", m: { bossHp: 4 } }
  ]
};
const FATE_ALL = {};
Object.values(FATE).forEach(l => l.forEach(c => { FATE_ALL[c.id] = c; RID["ft_" + c.id] = { id: "ft_" + c.id, nm: c.nm, m: c.m || {}, desc: c.pro + (c.con ? "；" + c.con : "") }; }));

/* ===== 命運階（難度）：只用於一般旅程，每日挑戰固定為 0 ===== */
const DIFFS = [
  { nm: "階 0", d: "標準旅程" },
  { nm: "階 I", d: "敵方血量 +8%" },
  { nm: "階 II", d: "敵方血量 +16%；精英與 Boss 多 1 張牌" },
  { nm: "階 III", d: "敵方血量 +24%；精英與 Boss 多 1 張牌；只有 3 條命" }
];
