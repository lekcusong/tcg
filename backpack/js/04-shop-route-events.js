'use strict';
/* ===== 對手與商店 ===== */
const ENEMY_NAMES = ["見習占卜師", "星象學徒", "月下術士", "吉普賽卡蜜拉", "沙漠先知", "塔羅老人", "午夜讀牌人", "霧中女巫", "命運編織者", "水晶球商人", "高塔守望者", "命運女神"];
function genEnemy(round, elite) {
  const bs = BOSSES[round]; if (bs) elite = false;
  const n = Math.min(12, 3 + Math.round(round * 1.0) + (elite ? 1 : 0)), maxTier = bs ? Math.min(round, 6) : Math.min(round + 1, 6);
  const suits = ["wands", "cups", "swords", "pents"].sort(() => rnd() - 0.5), themes = [suits[0], suits[1]];
  const pool = ITEMS.filter(d => d.tier <= maxTier && d.id !== "p1" && d.id !== "p7" && !(round <= 2 && (d.id === "c1" || d.tier >= 3)) && !(bs && d.tier < 2)), items = [];
  for (let i = 0; i < n; i++) {
    const w = pool.map(d => (themes.includes(d.suit) ? 3 : 1) * (d.suit === "major" ? 0.7 : 1)), tot = w.reduce((a, b) => a + b, 0);
    let r = rnd() * tot, k = 0; while (k < pool.length - 1 && (r -= w[k]) > 0) k++;
    const p3 = Math.max(0, (round - 7) * 0.1) + (elite ? 0.05 : 0), p2 = Math.max(0, (round - 2) * 0.1) + (elite ? 0.08 : 0), q = rnd();
    items.push(mkItem(pool[k].id, q < p3 ? 3 : q < p3 + p2 ? 2 : 1));
  }
  autoPlace(items);
  return { name: bs ? bs.nm : (elite ? "精英・" : "") + ENEMY_NAMES[Math.min(round - 1, ENEMY_NAMES.length - 1)], items: items.filter(i => i.x != null), hp: Math.round((45 + round * 7) * (bs ? 1.15 : elite ? 1.2 : 1)), boss: bs || null, elite: !!elite };
}
function genShop(round, n) {
  const pool = ITEMS.filter(d => d.tier <= round), out = [];
  for (let i = 0; i < (n || 5); i++) {
    const w = pool.map(d => (d.tier === round ? 1.6 : 1) * (d.suit === "major" ? 0.7 : 1)), tot = w.reduce((a, b) => a + b, 0);
    let r = rnd() * tot, k = 0; while (k < pool.length - 1 && (r -= w[k]) > 0) k++;
    out.push({ id: pool[k].id, sold: false });
  }
  return out;
}
const sellPrice = it => Math.max(1, Math.floor(ID[it.id].cost * (it.lv || 1) / 2));

/* ===== 路線地圖 ===== */
const NODES = {
  fight: { nm: "戰鬥", d: "一般對手。勝利可獲得金幣，戰前可買牌排牌。" },
  elite: { nm: "精英", d: "更強的對手（血量 ×1.2、多一張牌）。勝利必得遺物三選一。" },
  shop: { nm: "商店", d: "不戰鬥。7 張商品全部 -1 金幣，還有一件遺物販售。" },
  event: { nm: "事件", d: "遭遇命運事件，用選擇換取風險與機會。" },
  rest: { nm: "休息", d: "升級一張牌、回復 1 條命，或獲得 10 金幣。" },
  mystery: { nm: "神秘", d: "進入前不知道會遇到什麼。" },
  boss: { nm: "BOSS", d: "強大的守關者，擊破可選擇遺物。" }
};
function pickNodeType(f) {
  const w = [["fight", 46], ["elite", f >= 3 ? 13 : 0], ["shop", 12], ["event", 14], ["rest", 8], ["mystery", 7]], tot = w.reduce((a, b) => a + b[1], 0);
  let r = rnd() * tot; for (const [t, v] of w) { if ((r -= v) < 0) return t; } return "fight";
}
function resolveMystery(f) {
  const w = [["fight", 34], ["elite", f >= 3 ? 8 : 0], ["shop", 17], ["event", 26], ["rest", 15]], tot = w.reduce((a, b) => a + b[1], 0);
  let r = rnd() * tot; for (const [t, v] of w) { if ((r -= v) < 0) return t; } return "fight";
}
function genMap() {
  const F = [];
  for (let f = 1; f <= MAX_ROUND; f++) {
    const n = f === 1 ? 2 : BOSSES[f] ? 1 : (rnd() < 0.5 ? 2 : 3), nodes = [];
    for (let i = 0; i < n; i++) nodes.push({ t: BOSSES[f] ? "boss" : f === 1 ? "fight" : pickNodeType(f), next: [] });
    if ([3, 7, 11].includes(f) && !nodes.some(x => x.t === "rest" || x.t === "shop")) nodes[Math.floor(rnd() * n)].t = "rest";
    if (!BOSSES[f] && f > 1 && nodes.every(x => x.t === "elite")) nodes[0].t = "fight";
    F.push(nodes);
  }
  for (let f = 0; f < F.length - 1; f++) {
    const A = F[f], B = F[f + 1], pos = (i, nA, nB) => nA === 1 ? (nB - 1) / 2 : i * (nB - 1) / (nA - 1);
    A.forEach((a, i) => {
      if (A.length === 1) { B.forEach((_, k) => a.next.push(k)); return; }
      const j = Math.round(pos(i, A.length, B.length)); a.next.push(j);
      if (rnd() < 0.4) { const j2 = j + (rnd() < 0.5 ? -1 : 1); if (j2 >= 0 && j2 < B.length && !a.next.includes(j2)) a.next.push(j2); }
    });
    B.forEach((_, k) => { if (!A.some(a => a.next.includes(k))) { let best = 0, bd = 99; A.forEach((a, i) => { const d = Math.abs(pos(i, A.length, B.length) - k); if (d < bd) { bd = d; best = i; } }); A[best].next.push(k); } });
    A.forEach(a => a.next.sort((x, y) => x - y));
  }
  return F;
}

/* ===== 事件 ===== */
function giveItem(S, id) { const tray = S.inv.filter(i => i.x == null).length; if (tray >= TRAY_MAX) { S.gold += Math.floor(ID[id].cost / 2); return `收納區已滿，${ID[id].nm} 轉成金幣`; } S.inv.push(mkItem(id)); return `獲得 ${ID[id].nm}`; }
function randItem(round, minTier) { const pool = ITEMS.filter(d => d.tier <= Math.max(round + 1, minTier || 1) && d.tier >= (minTier || 1)); return pool[Math.floor(rnd() * pool.length)].id; }
function upgradeRandom(S) { const c = S.inv.filter(i => (i.lv || 1) < 3); if (!c.length) return "沒有可升級的牌"; const it = c[Math.floor(rnd() * c.length)]; it.lv = (it.lv || 1) + 1; return `${ID[it.id].nm} 升到 Lv${it.lv}`; }
function giveRelic(S) { const r = relicChoices(S.relics, 1)[0]; if (!r) { S.gold += 10; return "遺物已蒐集完，改得 10 金幣"; } S.relics.push(r.id); return `獲得遺物：${r.nm}`; }
const EVENTS = [
  { id: "contract", nm: "血之契約", txt: "黑袍占卜師遞來一張泛紅的牌：「付出一點生命，換取力量。」", ch: [
    { t: "簽下契約", d: "最大生命 -8，獲得一張高階牌", run: S => { S.hpBonus -= 8; return giveItem(S, randItem(S.round, 3)) + "，最大生命 -8"; } },
    { t: "婉拒離開", d: "什麼都不發生", run: S => "你轉身離開" }] },
  { id: "gamble", nm: "命運賭局", txt: "街角的骰子攤：「押四枚金幣，擲出大於三就加倍奉還！」", ch: [
    { t: "押 4 金幣", d: "50% 贏得 12 金幣，50% 全輸", can: S => S.gold >= 4, run: S => { S.gold -= 4; if (rnd() < 0.5) { S.gold += 12; return "擲出六點！獲得 12 金幣"; } return "擲出二點…金幣沒了"; } },
    { t: "不賭", d: "離開", run: S => "你忍住了" }] },
  { id: "spring", nm: "月光泉水", txt: "一汪映著月亮的泉水，喝下去似乎能滋養身心。", ch: [
    { t: "飲用", d: "最大生命 +8", run: S => { S.hpBonus += 8; return "最大生命 +8"; } },
    { t: "浸泡牌組", d: "隨機一張牌升級 1 級", run: S => upgradeRandom(S) }] },
  { id: "merchant", nm: "流浪商人", txt: "披著星空斗篷的商人：「這件寶物，只賣給有緣人。」", ch: [
    { t: "買下遺物", d: "花 14 金幣，獲得隨機遺物", can: S => S.gold >= 14, run: S => { S.gold -= 14; return giveRelic(S); } },
    { t: "兌換金幣", d: "不買，商人送你 5 金幣", run: S => { S.gold += 5; return "獲得 5 金幣"; } }] },
  { id: "bag", nm: "廢棄的背包", txt: "路邊倒著一只破舊背包，裡面似乎還有東西。", ch: [
    { t: "翻找", d: "獲得 2 張當前階級的牌", run: S => giveItem(S, randItem(S.round, 1)) + "；" + giveItem(S, randItem(S.round, 1)) },
    { t: "拿走錢幣", d: "獲得 10 金幣", run: S => { S.gold += 10; return "獲得 10 金幣"; } }] },
  { id: "smith", nm: "流亡鐵匠", txt: "鐵匠正在修補一把斷劍：「給我幾枚金幣，我讓你的牌更鋒利。」", ch: [
    { t: "付 6 金幣", d: "隨機一張牌升級 1 級", can: S => S.gold >= 6, run: S => { S.gold -= 6; return upgradeRandom(S); } },
    { t: "不需要", d: "離開", run: S => "你揮手告別" }] },
  { id: "altar", nm: "詛咒祭壇", txt: "祭壇上放著一件閃耀的遺物，旁邊刻著：「以血為祭。」", ch: [
    { t: "獻祭", d: "最大生命 -10，獲得隨機遺物", run: S => { S.hpBonus -= 10; return giveRelic(S) + "，最大生命 -10"; } },
    { t: "不碰", d: "離開", run: S => "你不敢靠近" }] }
];
function pickEvent(round, force) { return EVENTS[Math.floor(rnd() * EVENTS.length)]; }
if (false) module.exports = { ITEMS, ID, SUITS, LVM, Battle, buildUnits, autoPlace, genEnemy, genShop, mkItem, canPlace, cellsOf, shapeOf, sellPrice, COLS, ROWS, MAX_ROUND, START_HP, START_GOLD, LIVES, RELICS, RID, CHARS, CID, charOfSuit, genMap, resolveMystery, NODES, relicMods, relicChoices, BOSSES, EVENTS, pickEvent, useSeed, withSeed, rnd, TRAY_MAX, giveItem, giveRelic };

