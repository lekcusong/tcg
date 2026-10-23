'use strict';
/* ===== 塔羅背包亂鬥 — 邏輯（無 DOM）===== */
const COLS = 6, ROWS = 4, MAX_ROUND = 12, TRAY_MAX = 8, LIVES = 4, START_GOLD = 10, START_HP = 60;
const LVM = [0, 1, 1.6, 2.4];
let _seed = null;
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function useSeed(str) { _seed = str == null ? null : hashStr(String(str)); }
function rnd() { if (_seed == null) return Math.random(); _seed = (_seed + 0x6D2B79F5) >>> 0; let t = _seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
function withSeed(str, fn) { const keep = _seed; useSeed(str); try { return fn(); } finally { _seed = keep; } }
const SUITS = {
  wands:  { zh: "權杖", ic: "🔥", col: "#e2703a" },
  cups:   { zh: "聖杯", ic: "💧", col: "#4a90e2" },
  swords: { zh: "寶劍", ic: "🌪", col: "#9fb4c8" },
  pents:  { zh: "錢幣", ic: "🪙", col: "#c9a24a" },
  major:  { zh: "大牌", ic: "⭐", col: "#b98cf0" }
};
const SH = { s1: [[0, 0]], h2: [[0, 0], [1, 0]], v2: [[0, 0], [0, 1]], h3: [[0, 0], [1, 0], [2, 0]], sq: [[0, 0], [1, 0], [0, 1], [1, 1]], L: [[0, 0], [0, 1], [1, 1]] };
const STAT_ZH = { dmg: "傷害", heal: "回復", shield: "護盾", burn: "灼燒", poison: "中毒", regen: "再生", cleanse: "淨化", self: "自損", pct: "敵方最大血量", thorns: "反彈", open: "開場護盾", slow: "緩速", vuln: "易傷" };
// act：每次觸發的效果；rules：被相鄰牌加成（from=相鄰牌的花色）；aura：光環（作用在相鄰牌上）；income：回合結束額外金幣
const ITEMS = [
  { id: "w2", nm: "權杖二", suit: "wands", ic: "🔥", sh: "s1", cost: 3, tier: 1, cd: 2.0, act: { dmg: 3 }, rules: [{ from: "wands", stat: "dmg", add: 1 }], desc: "造成傷害。相鄰每張權杖 +1 傷害" },
  { id: "w1", nm: "權杖王牌", suit: "wands", ic: "🪄", sh: "h2", cost: 5, tier: 1, cd: 2.5, act: { burn: 3 }, rules: [{ from: "swords", stat: "burn", add: 2 }], desc: "施加灼燒。相鄰寶劍 +2 灼燒" },
  { id: "wk", nm: "權杖騎士", suit: "wands", ic: "🐎", sh: "h2", cost: 6, tier: 3, cd: 3.0, act: { dmg: 7, burn: 2 }, rules: [{ from: "wands", stat: "cd", mul: 0.9 }], desc: "傷害並灼燒。相鄰每張權杖冷卻 -10%" },
  { id: "c3", nm: "聖杯三", suit: "cups", ic: "🍷", sh: "s1", cost: 3, tier: 1, cd: 3.0, act: { heal: 5 }, rules: [{ from: "cups", stat: "heal", add: 2 }], desc: "回復血量。相鄰每張聖杯 +2 回復" },
  { id: "c1", nm: "聖杯王牌", suit: "cups", ic: "🏺", sh: "v2", cost: 5, tier: 1, cd: 4.0, act: { regen: 3 }, rules: [{ from: "cups", stat: "regen", add: 1 }], desc: "獲得再生。相鄰每張聖杯 +1 再生" },
  { id: "c7", nm: "聖杯七", suit: "cups", ic: "⚗️", sh: "h2", cost: 6, tier: 2, cd: 3.5, act: { heal: 8, cleanse: 3 }, rules: [], desc: "回復並淨化灼燒／中毒" },
  { id: "c9", nm: "聖杯九", suit: "cups", ic: "🥂", sh: "s1", cost: 4, tier: 2, cd: 2.5, act: { heal: 3, shield: 3 }, rules: [{ from: "pents", stat: "shield", add: 2 }], desc: "回復並獲得護盾。相鄰錢幣 +2 護盾" },
  { id: "s4", nm: "寶劍四", suit: "swords", ic: "🗡️", sh: "v2", cost: 4, tier: 1, cd: 2.0, act: { dmg: 5 }, rules: [{ from: "swords", stat: "cd", mul: 0.92 }], desc: "造成傷害。相鄰每張寶劍冷卻 -8%" },
  { id: "s9", nm: "寶劍九", suit: "swords", ic: "⚔️", sh: "h3", cost: 7, tier: 3, cd: 3.5, act: { dmg: 18 }, rules: [], desc: "重擊，造成大量傷害" },
  { id: "sp", nm: "寶劍侍者", suit: "swords", ic: "🏹", sh: "s1", cost: 3, tier: 1, cd: 1.8, act: { dmg: 2, poison: 1 }, rules: [{ from: "swords", stat: "poison", add: 1 }], desc: "快速攻擊並下毒。相鄰寶劍 +1 中毒" },
  { id: "s2", nm: "寶劍二", suit: "swords", ic: "🤺", sh: "s1", cost: 4, tier: 2, cd: 3.0, act: { shield: 4, dmg: 4 }, rules: [], desc: "格擋並反擊" },
  { id: "p5", nm: "錢幣五", suit: "pents", ic: "🛡️", sh: "s1", cost: 3, tier: 1, cd: 3.0, act: { shield: 6 }, rules: [{ from: "pents", stat: "shield", add: 2 }], desc: "獲得護盾。相鄰每張錢幣 +2 護盾" },
  { id: "p10", nm: "錢幣十", suit: "pents", ic: "🏰", sh: "h2", cost: 7, tier: 3, cd: 4.0, act: { shield: 22 }, rules: [], desc: "大量護盾" },
  { id: "p1", nm: "錢幣王牌", suit: "pents", ic: "💰", sh: "s1", cost: 4, tier: 1, cd: 0, act: {}, income: 2, rules: [], desc: "被動：每回合結束 +2 金幣" },
  { id: "p8", nm: "錢幣八", suit: "pents", ic: "🔨", sh: "v2", cost: 5, tier: 2, cd: 3.0, act: { shield: 5, dmg: 3 }, rules: [{ from: "swords", stat: "dmg", add: 2 }], desc: "護盾並反擊。相鄰寶劍 +2 傷害" },
  { id: "pq", nm: "錢幣皇后", suit: "pents", ic: "👸", sh: "s1", cost: 6, tier: 3, cd: 0, act: {}, aura: { to: "pents", stat: "shield", mul: 1.6 }, rules: [], desc: "光環：相鄰錢幣的護盾 ×1.6" },
  { id: "m16", nm: "高塔", suit: "major", ic: "🗼", sh: "v2", cost: 11, tier: 5, cd: 5.5, act: { dmg: 36, pierce: 1 }, rules: [], desc: "雷擊，造成 36 傷害且無視護盾" },
  { id: "m13", nm: "死神", suit: "major", ic: "💀", sh: "v2", cost: 9, tier: 5, cd: 4.0, act: { pct: 0.22, pierce: 1 }, rules: [], desc: "削減敵方最大血量 22%（至少 8），無視護盾" },
  { id: "m19", nm: "太陽", suit: "major", ic: "☀️", sh: "h2", cost: 9, tier: 4, cd: 3.5, act: { heal: 12, dmg: 14 }, rules: [], desc: "回復並灼傷敵人" },
  { id: "m8", nm: "力量", suit: "major", ic: "🦁", sh: "s1", cost: 7, tier: 4, cd: 0, act: {}, aura: { to: "any", stat: "all", mul: 1.5 }, rules: [], desc: "光環：相鄰所有牌效果 ×1.5" },
  { id: "m1", nm: "魔術師", suit: "major", ic: "🎩", sh: "h2", cost: 9, tier: 6, cd: 4.0, act: { recharge: 3 }, rules: [], desc: "立刻讓三張隨機牌冷卻完成" },
  { id: "m10", nm: "命運之輪", suit: "major", ic: "🎡", sh: "h2", cost: 8, tier: 5, cd: 3.5, act: { wheel: 1 }, rules: [], desc: "隨機：傷害／回復／護盾／灼燒" },
  { id: "m15", nm: "惡魔", suit: "major", ic: "😈", sh: "s1", cost: 8, tier: 4, cd: 3.0, act: { dmg: 4, poison: 4, self: 2 }, rules: [], desc: "傷害並下毒，但自己損血" },
  { id: "m17", nm: "星星", suit: "major", ic: "🌟", sh: "s1", cost: 6, tier: 4, cd: 0, act: {}, aura: { to: "cups", stat: "cd", mul: 0.65 }, rules: [], desc: "光環：相鄰聖杯冷卻 -35%" },
  { id: "m18", nm: "月亮", suit: "major", ic: "🌕", sh: "v2", cost: 8, tier: 4, cd: 3.5, act: { poison: 6, heal: 8 }, rules: [], desc: "下毒並回復" },
  { id: "m3", nm: "皇后", suit: "major", ic: "👑", sh: "s1", cost: 5, tier: 4, cd: 0, act: {}, aura: { to: ["cups", "pents"], stat: "all", mul: 1.5 }, rules: [], desc: "光環：相鄰聖杯／錢幣效果 ×1.5" },
  { id: "c4", nm: "聖杯四", suit: "cups", sh: "s1", cost: 4, tier: 2, cd: 3.5, act: { heal: 3, slow: 2 }, rules: [{ from: "cups", stat: "slow", add: 0.5 }], desc: "回復並使敵方緩速。相鄰每張聖杯 +0.5 秒緩速" },
  { id: "c8", nm: "聖杯八", suit: "cups", sh: "h2", cost: 7, tier: 3, cd: 4.0, act: { shield: 4, cleanse: 2, slow: 3 }, rules: [], desc: "護盾、淨化，並使敵方緩速 3 秒" },
  { id: "s5", nm: "寶劍五", suit: "swords", sh: "s1", cost: 4, tier: 2, cd: 2.6, act: { dmg: 4, vuln: 2 }, rules: [{ from: "swords", stat: "vuln", add: 1 }], desc: "傷害並使敵方易傷。相鄰每張寶劍 +1 秒易傷" },
  { id: "m12", nm: "吊人", suit: "major", sh: "v2", cost: 10, tier: 5, cd: 4.5, act: { dmg: 9, slow: 6, vuln: 6 }, rules: [], desc: "倒吊：傷害，並使敵方緩速＋易傷 6 秒" },
  { id: "w3", nm: "權杖三", suit: "wands", sh: "s1", cost: 4, tier: 2, cd: 2.5, act: { dmg: 2, ramp: 1 }, rules: [], desc: "每次出手，本場傷害累積 +1（上限 +12）" },
  { id: "w5", nm: "權杖五", suit: "wands", sh: "h2", cost: 5, tier: 2, cd: 3.0, act: { dmg: 4, burn: 2 }, rules: [{ from: "cups", stat: "burn", add: 2 }], desc: "傷害並灼燒。相鄰聖杯 +2 灼燒" },
  { id: "w10", nm: "權杖十", suit: "wands", sh: "h2", cost: 6, tier: 4, cd: 3.5, act: { dmg: 8, detonate: 1 }, rules: [], desc: "引爆：消耗敵方全部灼燒，每層造成 2.5 傷害" },
  { id: "wq", nm: "權杖皇后", suit: "wands", sh: "s1", cost: 5, tier: 3, cd: 0, act: {}, aura: { to: "wands", stat: "cd", mul: 0.75 }, rules: [], desc: "光環：相鄰權杖冷卻 -25%" },
  { id: "c2", nm: "聖杯二", suit: "cups", sh: "s1", cost: 3, tier: 1, cd: 2.5, act: { heal: 3 }, rules: [{ from: "any", stat: "heal", add: 1 }], desc: "回復。相鄰每張牌 +1 回復" },
  { id: "ck", nm: "聖杯騎士", suit: "cups", sh: "h2", cost: 6, tier: 3, cd: 3.5, act: { regen: 3, cleanse: 2, shield: 4 }, rules: [], desc: "再生、淨化並獲得護盾" },
  { id: "c10", nm: "聖杯十", suit: "cups", sh: "v2", cost: 7, tier: 3, cd: 4.5, act: { heal: 16, regen: 3 }, rules: [], desc: "大量回復並獲得再生" },
  { id: "cq", nm: "聖杯皇后", suit: "cups", sh: "s1", cost: 5, tier: 3, cd: 0, act: {}, aura: { to: "cups", stat: "heal", mul: 1.6 }, rules: [], desc: "光環：相鄰聖杯的回復 ×1.6" },
  { id: "s3", nm: "寶劍三", suit: "swords", sh: "s1", cost: 3, tier: 1, cd: 2.2, act: { dmg: 4 }, rules: [{ from: "cups", stat: "dmg", add: 2 }], desc: "造成傷害。相鄰聖杯 +2 傷害" },
  { id: "sk", nm: "寶劍騎士", suit: "swords", sh: "s1", cost: 5, tier: 2, cd: 1.2, act: { dmg: 2 }, rules: [{ from: "swords", stat: "dmg", add: 1 }], desc: "極速連擊。相鄰寶劍 +1 傷害" },
  { id: "s6", nm: "寶劍六", suit: "swords", sh: "h2", cost: 5, tier: 2, cd: 3.5, act: { dmg: 5, delay: 1.5 }, rules: [], desc: "擊退：讓敵方一張牌延遲 1.5 秒" },
  { id: "s7", nm: "寶劍七", suit: "swords", sh: "h2", cost: 6, tier: 3, cd: 2.8, act: { dmg: 7, exec: 1 }, rules: [], desc: "處決：敵方血量低於 35% 時傷害 ×1.6" },
  { id: "sq", nm: "寶劍皇后", suit: "swords", sh: "s1", cost: 5, tier: 3, cd: 0, act: {}, aura: { to: "swords", stat: "dmg", mul: 1.55 }, rules: [], desc: "光環：相鄰寶劍傷害 ×1.55" },
  { id: "s10", nm: "寶劍十", suit: "swords", sh: "v2", cost: 8, tier: 4, cd: 4.0, act: { dmg: 10, poison: 3, pierce: 1 }, rules: [], desc: "背刺：無視護盾並下毒" },
  { id: "p3", nm: "錢幣三", suit: "pents", sh: "s1", cost: 3, tier: 1, cd: 0, act: { open: 8 }, rules: [{ from: "pents", stat: "open", add: 3 }], desc: "被動：戰鬥開始時獲得 8 護盾。相鄰錢幣 +3" },
  { id: "p4", nm: "錢幣四", suit: "pents", sh: "s1", cost: 5, tier: 2, cd: 0, act: { thorns: 2 }, rules: [{ from: "pents", stat: "thorns", add: 1 }], desc: "被動：被攻擊時反彈 2 傷害。相鄰錢幣 +1" },
  { id: "p7", nm: "錢幣七", suit: "pents", sh: "h2", cost: 6, tier: 2, cd: 4.0, act: { shield: 3 }, income: 3, rules: [], desc: "每回合結束 +3 金幣，戰鬥中小量護盾" },
  { id: "pk", nm: "錢幣騎士", suit: "pents", sh: "h2", cost: 6, tier: 3, cd: 3.5, act: { shield: 8, dmg: 4 }, rules: [{ from: "pents", stat: "dmg", add: 2 }], desc: "護盾並衝撞。相鄰錢幣 +2 傷害" },
  { id: "m2", nm: "女祭司", suit: "major", sh: "s1", cost: 7, tier: 4, cd: 3.5, act: { shield: 10, delay: 2 }, rules: [], desc: "獲得 10 護盾，並讓敵方一張牌延遲 2 秒" },
  { id: "m5", nm: "教皇", suit: "major", sh: "s1", cost: 6, tier: 4, cd: 0, act: {}, aura: { to: "any", stat: "cd", mul: 0.8 }, rules: [], desc: "光環：相鄰所有牌冷卻 -20%" },
  { id: "m6", nm: "戀人", suit: "major", sh: "h2", cost: 7, tier: 4, cd: 0, act: {}, aura: { to: ["wands", "swords"], stat: "all", mul: 1.5 }, rules: [], desc: "光環：相鄰權杖／寶劍效果 ×1.5" },
  { id: "m7", nm: "戰車", suit: "major", sh: "L", cost: 9, tier: 5, cd: 3.0, act: { dmg: 16, shield: 12 }, rules: [], desc: "衝鋒：傷害並獲得護盾" },
  { id: "m14", nm: "節制", suit: "major", sh: "s1", cost: 8, tier: 4, cd: 4.5, act: { cleanse: 6, regen: 3, heal: 4 }, rules: [], desc: "淨化、回復並獲得再生" },
];
const ID = Object.fromEntries(ITEMS.map(d => [d.id, d]));
let UID = 1;
const mkItem = (id, lv) => ({ uid: UID++, id, lv: lv || 1, x: null, y: null, rot: 0 });

function shapeOf(it) {
  let c = SH[ID[it.id].sh];
  for (let r = 0; r < (it.rot || 0); r++) c = c.map(([x, y]) => [-y, x]);
  const mx = Math.min(...c.map(p => p[0])), my = Math.min(...c.map(p => p[1]));
  return c.map(([x, y]) => [x - mx, y - my]);
}
const cellsOf = it => shapeOf(it).map(([x, y]) => [x + it.x, y + it.y]);
function canPlace(inv, it, x, y, rot) {
  const t = { id: it.id, rot, x, y }, occ = new Set();
  inv.forEach(o => { if (o !== it && o.x != null) cellsOf(o).forEach(c => occ.add(c[0] + "," + c[1])); });
  return cellsOf(t).every(([cx, cy]) => cx >= 0 && cy >= 0 && cx < COLS && cy < ROWS && !occ.has(cx + "," + cy));
}
function autoPlace(items, rf) {
  rf = rf || rnd;
  items.forEach(i => { i.x = null; i.y = null; });
  const order = items.slice().sort((a, b) => SH[ID[b.id].sh].length - SH[ID[a.id].sh].length || rf() - 0.5);
  order.forEach(it => {
    let best = null, bs = -1;
    for (let rot = 0; rot < 4; rot++) for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      if (!canPlace(items, it, x, y, rot)) continue;
      const t = { id: it.id, rot, x, y }, mine = new Set(cellsOf(t).map(c => c[0] + "," + c[1]));
      let sc = rf() * 0.6;
      items.forEach(o => { if (o === it || o.x == null) return; const same = ID[o.id].suit === ID[it.id].suit; cellsOf(o).forEach(([ox, oy]) => { [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { if (mine.has((ox + dx) + "," + (oy + dy))) sc += same ? 2 : 0.7; }); }); });
      if (sc > bs) { bs = sc; best = { x, y, rot }; }
    }
    if (best) { it.x = best.x; it.y = best.y; it.rot = best.rot; }
  });
}
// 計算每張牌在目前擺放下的實際數值（含相鄰加成與光環）
function buildUnits(items, mods) {
  mods = mods || {}; const amp = 1 + (mods.auraAmp || 0), amu = m => 1 + (m - 1) * amp;
  const placed = items.filter(i => i.x != null), map = new Map();
  placed.forEach(it => cellsOf(it).forEach(([x, y]) => map.set(x + "," + y, it)));
  const units = placed.map((it, idx) => ({ it, d: ID[it.id], nb: new Set(), idx, timer: 0 }));
  const by = new Map(units.map(u => [u.it.uid, u]));
  units.forEach(u => cellsOf(u.it).forEach(([x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const o = map.get((x + dx) + "," + (y + dy)); if (o && o !== u.it) u.nb.add(by.get(o.uid)); })));
  const NUM = ["dmg", "heal", "shield", "burn", "poison", "regen", "pct", "thorns", "open", "slow", "vuln"], PRIM = ["dmg", "heal", "shield", "burn", "poison", "regen", "thorns", "open"];
  let SB = null; const fx = { open: 0, thorns: 0, regen: 0 };
  if (mods.sets) {
    const cnt = { wands: 0, cups: 0, swords: 0, pents: 0 }; placed.forEach(it => { const su = ID[it.id].suit; if (cnt[su] != null) cnt[su]++; });
    SB = Object.assign({}, cnt, { rainbow: Object.values(cnt).every(n => n >= 1) });
    if (cnt.cups >= 4) fx.regen += 1;
    if (cnt.pents >= 2) fx.open += 6;
    if (cnt.pents >= 4) fx.thorns += 2;
  }
  units.forEach(u => {
    const d = u.d, lv = LVM[u.it.lv || 1];
    u.vals = {}; Object.keys(d.act).forEach(k => { u.vals[k] = (NUM.includes(k) || k === "cleanse") ? d.act[k] * lv : d.act[k]; });
    u.cdMul = 1; let all = 1; u.links = [];
    d.rules.forEach(r => u.nb.forEach(n => { if (r.from === "any" || n.d.suit === r.from) { if (r.stat === "cd") { u.cdMul *= r.mul; u.links.push({ n, kind: "rule", lbl: "冷卻×" + r.mul }); } else if (u.vals[r.stat] != null) { u.vals[r.stat] += r.add; u.links.push({ n, kind: "rule", lbl: (r.add >= 0 ? "+" : "") + r.add + (STAT_ZH[r.stat] || "") }); } } }));
    u.nb.forEach(n => { const a = n.d.aura; if (!a) return; const to = [].concat(a.to); if (to.includes("any") || to.includes(d.suit)) { u.links.push({ n, kind: "aura", lbl: a.stat === "cd" ? "冷卻×" + a.mul : a.stat === "all" ? "全效×" + a.mul : (STAT_ZH[a.stat] || "") + "×" + a.mul }); if (a.stat === "cd") u.cdMul *= amu(a.mul); else if (a.stat === "all") all *= amu(a.mul); else if (u.vals[a.stat] != null) u.vals[a.stat] *= amu(a.mul); } });
    if (SB) {
      const su = d.suit, hasAtk = !!u.vals.dmg;
      if (su === "wands" && SB.wands >= 2 && (hasAtk || u.vals.burn)) u.vals.burn = (u.vals.burn || 0) + 1;
      if (su === "wands" && SB.wands >= 4) u.cdMul *= 0.9;
      if (su === "cups" && SB.cups >= 2 && u.vals.heal) u.vals.heal += 2;
      if (su === "swords" && SB.swords >= 2 && hasAtk) u.vals.dmg += 1;
      if (su === "swords" && SB.swords >= 4 && hasAtk) u.vals.vuln = (u.vals.vuln || 0) + 1;
      if (su === "pents" && SB.pents >= 4 && u.vals.shield) u.vals.shield *= 1.2;
      if (SB.rainbow) u.cdMul *= 0.95;
    }
    if (mods.dmgAdd && u.vals.dmg) u.vals.dmg += mods.dmgAdd;
    if (u.vals.dmg) { if (mods.poisonAdd) u.vals.poison = (u.vals.poison || 0) + mods.poisonAdd; if (mods.burnAdd) u.vals.burn = (u.vals.burn || 0) + mods.burnAdd; }
    if (mods.linkAdd) u.links.forEach(() => { const k = PRIM.find(k => u.vals[k] != null); if (k) u.vals[k] += mods.linkAdd; });
    NUM.forEach(k => { if (u.vals[k] != null) u.vals[k] *= all; });
    u.pw = lv * all; u.cd = d.cd ? d.cd * u.cdMul * (mods.cdAll || 1) : 0; u.cnt = 0;
  });
  const income = placed.reduce((s, it) => s + (ID[it.id].income || 0) * LVM[it.lv || 1], 0);
  return { units, income: Math.round(income) + (mods.incomeAdd || 0), fx, sets: SB };
}

