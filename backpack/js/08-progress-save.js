'use strict';
/* ===== 進度、遺物、事件、圖鑑、成就、每日挑戰、存檔 ===== */
const META = (() => { let m = {}; try { m = JSON.parse(localStorage.getItem("bb_meta") || "{}"); } catch (e) { } return Object.assign({ games: 0, clears: 0, totalWins: 0, bossKills: 0, eliteKills: 0, maxLinks: 0, lv3: 0, maxRelics: 0, perfect: 0, dailyDone: 0, diffClear: 0, diffSel: 0, maxHit: 0, phoenix: 0, tut: 0, items: {}, relics: {}, daily: {}, ach: {} }, m); })();
let _mt = 0;
function saveMeta() { try { localStorage.setItem("bb_meta", JSON.stringify(META)); } catch (e) { } }
function bump(k, v) { if (v > META[k]) { META[k] = v; clearTimeout(_mt); _mt = setTimeout(() => { saveMeta(); checkAch(); }, 600); } }
function noteSeen() {
  let ch = false;
  const add = (map, id) => { if (!map[id]) { map[id] = 1; ch = true; } };
  (G.shop || []).forEach(s => add(META.items, s.id)); (G.inv || []).forEach(i => add(META.items, i.id)); ((G.enemy && G.enemy.items) || []).forEach(i => add(META.items, i.id)); (G.relics || []).forEach(r => add(META.relics, r));
  if (ch) { saveMeta(); checkAch(); }
}
const ACH = [
  { id: "first", nm: "初陣", d: "贏下一場戰鬥", ok: m => m.totalWins >= 1 },
  { id: "clear", nm: "命運的終點", d: "通關 12 回合", ok: m => m.clears >= 1 },
  { id: "elite3", nm: "精英獵人", d: "累計擊敗 3 個精英", ok: m => (m.eliteKills || 0) >= 3, p: m => [m.eliteKills || 0, 3] },
  { id: "boss1", nm: "斬將", d: "擊破一個 Boss", ok: m => m.bossKills >= 1 },
  { id: "boss5", nm: "屠魔者", d: "累計擊破 5 個 Boss", ok: m => m.bossKills >= 5, p: m => [m.bossKills, 5] },
  { id: "link6", nm: "連結大師", d: "背包同時有 6 條相鄰連結", ok: m => m.maxLinks >= 6, p: m => [m.maxLinks, 6] },
  { id: "lv3", nm: "登峰造極", d: "擁有一張 Lv3 的牌", ok: m => m.lv3 >= 1 },
  { id: "relic4", nm: "遺物收藏家", d: "單局持有 4 件遺物", ok: m => m.maxRelics >= 4, p: m => [m.maxRelics, 4] },
  { id: "perfect", nm: "完美旅程", d: "不損失任何一條命通關", ok: m => m.perfect >= 1 },
  { id: "collect", nm: "圖鑑收集者", d: "見過 30 張不同的牌", ok: m => Object.keys(m.items).length >= 30, p: m => [Object.keys(m.items).length, 30] },
  { id: "daily", nm: "今日占卜", d: "完成一次每日挑戰", ok: m => m.dailyDone >= 1 },
  { id: "tier1", nm: "逆行者", d: "通關命運階 I", ok: m => m.diffClear >= 2 },
  { id: "tier3", nm: "命運主宰", d: "通關命運階 III", ok: m => m.diffClear >= 4 },
  { id: "hit40", nm: "雷霆一擊", d: "單次攻擊造成 40 以上傷害", ok: m => m.maxHit >= 40, p: m => [m.maxHit, 40] },
  { id: "phoenix", nm: "浴火重生", d: "觸發鳳凰羽復活", ok: m => m.phoenix >= 1 }
];
function checkAch() { let n = 0; ACH.forEach(a => { if (!META.ach[a.id] && a.ok(META)) { META.ach[a.id] = 1; n++; setTimeout(() => toast("成就解鎖：" + a.nm, 2600), n * 900); } }); if (n) saveMeta(); }

/* ----- 遺物列 ----- */
function renderRelics() {
  const b = $("#relicBar"); if (!G.relics.length && !G.char && !(G.fate && G.fate.length)) { b.hidden = true; return; } b.hidden = false;
  b.innerHTML = (G.char ? `<button class="rl chb" data-id="ch_${G.char}">${itemIcon(CID[G.char].ic, 24)}</button>` : "") + (G.fate || []).map(id => `<button class="rl chb" data-id="ft_${id}">${itemIcon(FATE_ALL[id].ic, 24)}</button>`).join("") + G.relics.map(id => `<button class="rl" data-id="${id}">${relicIcon(id, 24)}</button>`).join("");
  b.querySelectorAll(".rl").forEach(x => x.onclick = () => { const r = RID[x.dataset.id]; toast(`${r.nm}：${r.desc}`, 3000); });
}

/* ----- 事件 / 遺物選擇 ----- */
function showEvent(ev, cb) {
  const ov = $("#ov"); ov.hidden = false; AU.vs();
  ov.innerHTML = `<div class="card">${evArt(ev.id, uiIcon("scroll", 44, "#e8c468"), 44)}<h2>${ev.nm}</h2><p>${ev.txt}</p><div class="chs">${ev.ch.map((c, i) => `<button class="btn ch" data-i="${i}" ${c.can && !c.can(G) ? "disabled" : ""}><b>${c.t}</b><small>${c.d}</small></button>`).join("")}</div></div>`;
  ov.querySelectorAll(".ch").forEach(b => b.onclick = () => {
    const c = ev.ch[+b.dataset.i], msg = withSeed(sdKey(`evrun|${G.round}`), () => c.run(G)); noteSeen(); AU.merge(); refresh(); saveRun();
    ov.innerHTML = `<div class="card">${evArt(ev.id, uiIcon("gem", 40, "#e8c468"), 40)}<h2>${ev.nm}</h2><p>${msg}</p><button class="btn primary" id="evOk" style="padding:11px 26px;font-size:15px">繼續</button></div>`; $("#evOk").onclick = () => { ov.hidden = true; if (cb) cb(); };
  });
}
function showRelicPick(cb) {
  const ov = $("#ov"); ov.hidden = false;
  const ch = withSeed(sdKey(`relic|${G.round}`), () => relicChoices(G.relics, 3));
  if (!ch.length) { G.gold += 10; ov.hidden = true; toast("遺物已蒐集完，改得 10 金幣"); return cb(); }
  AU.win();
  const POS = ch.length >= 3 ? [24, 50, 76] : ch.length === 2 ? [37, 63] : [50]; let pick = null;
  ov.innerHTML = `<div class="rw"><div class="rwt">${uiIcon("crown", 26, "#ffd84a")}<h2>選擇一件遺物</h2></div>${ch.map((r, i) => `<button class="rws" data-id="${r.id}" style="left:${POS[i]}%"><span class="rwi">${relicIcon(r.id, 56)}</span><b>${r.nm}</b></button>`).join("")}<div class="rwp"><div class="rwd" id="rwd">點選展示台上的遺物，查看效果</div><button class="btn primary" id="rwOk" disabled>拿取遺物</button></div></div>`;
  const rwd = $("#rwd"), rwOk = $("#rwOk");
  ov.querySelectorAll(".rws").forEach(b => b.onclick = () => {
    pick = b.dataset.id; ov.querySelectorAll(".rws").forEach(x => x.classList.toggle("sel", x === b));
    const r = ch.find(x => x.id === pick); rwd.innerHTML = `<b>${r.nm}</b><small>${r.desc}</small>`; rwOk.disabled = false;
  });
  rwOk.onclick = () => { if (!pick) return; G.relics.push(pick); noteSeen(); bump("maxRelics", G.relics.length); AU.merge(); ov.hidden = true; cb(); };
}

/* ----- 存檔 ----- */
const snapItems = l => l.map(i => ({ id: i.id, lv: i.lv, x: i.x, y: i.y, rot: i.rot }));
const loadItems = l => l.map(o => { const it = mkItem(o.id, o.lv); it.x = o.x; it.y = o.y; it.rot = o.rot || 0; return it; });
function saveRun() {
  if (G.over || G.running || !G.map) return; if (G.phase === "build" && !G.enemy) return;
  try { localStorage.setItem("bb_save", JSON.stringify({ v: 2, round: G.round, lives: G.lives, gold: G.gold, wins: G.wins, hpBonus: G.hpBonus, relics: G.relics, mode: G.mode, fate: G.fate, bossAff: G.bossAff, diff: G.diff, char: G.char, seed: G.seed, rerolls: G.rerolls, freeUsed: G.freeUsed, rerollCost: G.rerollCost, lost: G.lost, inv: snapItems(G.inv), shop: G.shop, map: G.map, path: G.path, phase: G.phase, nodeType: G.nodeType, offer: G.offer, enemy: G.enemy ? { name: G.enemy.name, hp: G.enemy.hp, boss: G.enemy.boss, elite: G.enemy.elite, items: snapItems(G.enemy.items) } : null })); } catch (e) { }
}
// 存檔檢查：裡面只要有「已不存在」的牌／遺物／命運牌／角色／Boss 詞綴，載入時畫面會畫到一半就報錯變空白，所以直接視為壞檔清掉
const saveOk = s => {
  const itemIds = new Set(ITEMS.map(d => d.id)), okItems = l => (l || []).every(o => o && itemIds.has(o.id));
  return okItems(s.inv) && (!s.enemy || okItems(s.enemy.items)) && (s.relics || []).every(id => RID[id]) && (s.fate || []).every(id => FATE_ALL[id]) && (!s.char || CID[s.char]) && (!s.diff || DIFFS[s.diff]);
};
const readSave = () => { try { const s = JSON.parse(localStorage.getItem("bb_save")); if (!s || s.v !== 2) return null; if (!saveOk(s)) { localStorage.removeItem("bb_save"); return null; } return s; } catch (e) { return null; } };
const clearRun = () => { try { localStorage.removeItem("bb_save"); } catch (e) { } };
function loadRun(s) {
  Object.assign(G, { round: s.round, lives: s.lives, gold: s.gold, wins: s.wins, hpBonus: s.hpBonus, relics: s.relics || [], mode: s.mode, fate: s.fate || [], bossAff: s.bossAff || null, diff: s.diff || 0, char: s.char || null, seed: s.seed, rerolls: s.rerolls, freeUsed: s.freeUsed, rerollCost: s.rerollCost || 1, lost: s.lost || 0, inv: loadItems(s.inv), shop: s.shop, map: s.map, path: s.path || [], phase: s.phase, nodeType: s.nodeType, offer: s.offer, enemy: s.enemy ? { name: s.enemy.name, hp: s.enemy.hp, boss: s.enemy.boss, elite: s.enemy.elite, items: loadItems(s.enemy.items) } : null, sel: null, shopSel: -1, over: false, running: false, linkKeys: null });
  $("#ov").hidden = true; $("#vBattle").hidden = true; $("#vBuild").hidden = false;
  if (G.phase === "map" || G.phase === "node" && !G.nodeType) return enterMap();
  if (G.phase === "node") { $("#mapv").hidden = true; return startNode(G.nodeType); }
  $("#mapv").hidden = true; refresh();
}

/* ----- 每日挑戰 ----- */
const todayStr = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const dailyStartId = seed => ["mage", "priest", "chariot", "emperor"][hashStr(seed + "|start") % 4];
const calcScore = (reached, wins, lives, relics, clear) => reached * 100 + wins * 15 + lives * 25 + relics * 10 + (clear ? 500 : 0);

/* ----- 主選單 ----- */
