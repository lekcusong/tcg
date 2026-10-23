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

