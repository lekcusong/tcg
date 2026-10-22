

/* ===== 🔮 塔羅三消 Match-3 — begin =====
   免費玩，每天 3 次（GMT+8 重置，GM 不受限）。玩法：本機在瀏覽器裡跑完整場 60 秒（跟挖礦好運同一種「本機計時、結束才跟伺服器結算」模式，
   不是像炸彈地圖那樣每一步都呼叫伺服器——三消一秒要交換好幾次，每步都打一次 RPC 會很卡）。
   結算時伺服器用「經過的真實秒數 × 每秒金幣上限」夾住回報的金幣，防止改本機數值作弊（沿用原本挖礦好運小遊戲——現已移除——用過的同一套防作弊做法）。
   每日排行榜、封號「三消魔法師」則是比照炸彈地圖／塔羅輪盤既有的「kv_store 存每人每天最佳成績＋CAS 搶先結算」模式，沒有另外開 SQL 資料表。
   獎勵材料：直接發成品（player.professionItems，跟「成品庫存」面板、GM 發放道具用的同一個欄位與同一份 8 種道具清單 ue[]），
   不是神秘碎片——小型為主、偶爾中型，圖示／名稱用既有的 Lt(itemId) 查表，GM 改配方名稱或圖示時這裡會自動跟著換，不用另外維護一份。 */
const M3 = (function () {
"use strict";
// ===== 🔊 音效（用 Web Audio API 即時合成，不需要額外音檔），預設靜音，有專屬的開關按鈕，狀態存在本機瀏覽器 =====
let sfxMuted = true;
try { sfxMuted = localStorage.getItem("m3-sfx-muted") !== "0"; } catch (e) {}
let sfxCtx = null;
function ensureSfxCtx() {
  if (sfxCtx) return sfxCtx;
  try { sfxCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { sfxCtx = null; }
  return sfxCtx;
}
function playTone(freq, duration, opts) {
  if (sfxMuted) return;
  const ctx = ensureSfxCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") { ctx.resume().catch(() => {}); }
  opts = opts || {};
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = opts.type || "sine";
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, t0 + duration);
  const vol = opts.volume != null ? opts.volume : 0.16;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain); gain.connect(ctx.destination);
  osc.start(t0); osc.stop(t0 + duration + 0.02);
}
// 消除音：音高隨這次交換的第幾波連鎖往上升，波數越多聽起來越興奮
function sfxMatch(wave) {
  const freq = 420 * Math.pow(1.12, Math.min(Math.max(wave - 1, 0), 10));
  playTone(freq, 0.14, { type: "triangle", volume: 0.15 });
}
// 連鎖加成音：wave.mult > 1 時，在消除音之外多疊一個上揚的「叮」
function sfxChainBonus() {
  playTone(900, 0.09, { type: "sine", volume: 0.12 });
  setTimeout(() => playTone(1350, 0.12, { type: "sine", volume: 0.1 }), 60);
}
// 結算音：成功（上升三音）／失敗或沒次數（下滑一聲）
function sfxRoundEnd(success) {
  if (success) {
    playTone(660, 0.11, { type: "triangle", volume: 0.14 });
    setTimeout(() => playTone(880, 0.14, { type: "triangle", volume: 0.14 }), 90);
    setTimeout(() => playTone(1100, 0.2, { type: "triangle", volume: 0.14 }), 190);
  } else {
    playTone(220, 0.28, { type: "sawtooth", volume: 0.09, slideTo: 110 });
  }
}
function toggleSfxMuted() {
  sfxMuted = !sfxMuted;
  try { localStorage.setItem("m3-sfx-muted", sfxMuted ? "1" : "0"); } catch (e) {}
  return sfxMuted;
}
const W = 8, H = 8, TYPES = 6;
const idx = (r, c) => r * W + c;
const inB = (r, c) => r >= 0 && r < H && c >= 0 && c < W;

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function findRuns(get) {
  const runs = [];
  for (let r = 0; r < H; r++) {
    let c = 0;
    while (c < W) {
      const t = get(r, c);
      let c2 = c;
      while (c2 + 1 < W && get(r, c2 + 1) === t) c2++;
      if (c2 - c + 1 >= 3) runs.push({ cells: Array.from({ length: c2 - c + 1 }, (_, i) => idx(r, c + i)), dir: 'h', type: t });
      c = c2 + 1;
    }
  }
  for (let c = 0; c < W; c++) {
    let r = 0;
    while (r < H) {
      const t = get(r, c);
      let r2 = r;
      while (r2 + 1 < H && get(r2 + 1, c) === t) r2++;
      if (r2 - r + 1 >= 3) runs.push({ cells: Array.from({ length: r2 - r + 1 }, (_, i) => idx(r + i, c)), dir: 'v', type: t });
      r = r2 + 1;
    }
  }
  return runs;
}

function groupRuns(runs) {
  const groups = [];
  const used = new Array(runs.length).fill(false);
  for (let i = 0; i < runs.length; i++) {
    if (used[i]) continue;
    const stack = [i]; used[i] = true;
    const cellSet = new Set(runs[i].cells);
    const dirs = new Set([runs[i].dir]);
    const type = runs[i].type;
    while (stack.length) {
      stack.pop();
      for (let j = 0; j < runs.length; j++) {
        if (used[j] || runs[j].type !== type) continue;
        if (runs[j].cells.some(x => cellSet.has(x))) {
          used[j] = true; stack.push(j);
          runs[j].cells.forEach(x => cellSet.add(x));
          dirs.add(runs[j].dir);
        }
      }
    }
    groups.push({ cells: Array.from(cellSet), type, dirs: Array.from(dirs) });
  }
  return groups;
}

function findMatches(get) { return groupRuns(findRuns(get)); }

function specialKindFor(group) {
  if (group.dirs.length >= 2) return 'cross';
  const n = group.cells.length;
  if (n >= 5) return 'cross';
  if (n === 4) return group.dirs[0] === 'h' ? 'row' : 'col';
  return 'none';
}

function waveMultiplier(wave) { return Math.min(1 + (wave - 1) * 0.5, 3.0); }

function hasAnyMove(board) {
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    for (const d of [[0, 1], [1, 0]]) {
      const nr = r + d[0], nc = c + d[1];
      if (!inB(nr, nc)) continue;
      const a = idx(r, c), b = idx(nr, nc);
      const swapped = board.slice();
      const tmp = swapped[a]; swapped[a] = swapped[b]; swapped[b] = tmp;
      const get = (rr, cc) => swapped[idx(rr, cc)] ? swapped[idx(rr, cc)].type : -1;
      if (findMatches(get).length > 0) return true;
    }
  }
  return false;
}

function freshBoard(rng) {
  const board = new Array(W * H);
  let nextId = 1;
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    let t;
    do {
      t = Math.floor(rng() * TYPES);
    } while (
      (c >= 2 && board[idx(r, c - 1)] && board[idx(r, c - 2)] && board[idx(r, c - 1)].type === t && board[idx(r, c - 2)].type === t) ||
      (r >= 2 && board[idx(r - 1, c)] && board[idx(r - 2, c)] && board[idx(r - 1, c)].type === t && board[idx(r - 2, c)].type === t)
    );
    board[idx(r, c)] = { id: nextId++, type: t, special: null };
  }
  if (!hasAnyMove(board)) return freshBoard(rng);
  return { board, nextId };
}

function refill(board, nextId, rng) {
  for (let c = 0; c < W; c++) {
    const col = [];
    for (let r = H - 1; r >= 0; r--) { const t = board[idx(r, c)]; if (t) col.push(t); }
    let write = H - 1;
    for (const t of col) { board[idx(write, c)] = t; write--; }
    while (write >= 0) { board[idx(write, c)] = { id: nextId++, type: Math.floor(rng() * TYPES), special: null }; write--; }
  }
  return nextId;
}

function resolveSwap(board, nextId, a, b, rng) {
  const tmp = board[a]; board[a] = board[b]; board[b] = tmp;
  const get = (r, c) => board[idx(r, c)] ? board[idx(r, c)].type : -1;
  if (findMatches(get).length === 0) {
    const tmp2 = board[a]; board[a] = board[b]; board[b] = tmp2;
    return { waves: [], totalGold: 0, totalCleared: 0, board, nextId, reshuffled: false, invalid: true };
  }
  let wave = 1, totalGold = 0, totalCleared = 0;
  const waves = [];
  let lastSwapped = new Set([a, b]);
  while (true) {
    const groups = findMatches((r, c) => board[idx(r, c)] ? board[idx(r, c)].type : -1);
    if (groups.length === 0) break;
    const toClear = new Set();
    const spawns = [];
    for (const g of groups) {
      const kind = specialKindFor(g);
      if (kind === 'none') { g.cells.forEach(x => toClear.add(x)); continue; }
      let spawnCell = g.cells.find(x => lastSwapped.has(x));
      if (spawnCell === undefined) spawnCell = g.cells[Math.floor(g.cells.length / 2)];
      spawns.push({ cell: spawnCell, kind, type: g.type });
      g.cells.forEach(x => { if (x !== spawnCell) toClear.add(x); });
    }
    const spawnCells = new Set(spawns.map(s => s.cell));
    let grew = true;
    while (grew) {
      grew = false;
      for (const cell of Array.from(toClear)) {
        const t = board[cell];
        if (!t || !t.special) continue;
        const r = Math.floor(cell / W), c = cell % W;
        const addLine = (cells) => cells.forEach(x => { if (!toClear.has(x) && !spawnCells.has(x)) { toClear.add(x); grew = true; } });
        if (t.special === 'row' || t.special === 'cross') addLine(Array.from({ length: W }, (_, cc) => idx(r, cc)));
        if (t.special === 'col' || t.special === 'cross') addLine(Array.from({ length: H }, (_, rr) => idx(rr, c)));
      }
    }
    spawnCells.forEach(c => toClear.delete(c));
    const clearedCount = toClear.size;
    const mult = waveMultiplier(wave);
    const goldThisWave = clearedCount * 10 * mult;
    totalGold += goldThisWave;
    totalCleared += clearedCount;
    const clearedCells = Array.from(toClear);
    toClear.forEach(cell => { board[cell] = null; });
    spawns.forEach(s => { board[s.cell] = { id: nextId++, type: s.type, special: s.kind }; });
    nextId = refill(board, nextId, rng);
    waves.push({ wave, cleared: clearedCount, gold: Math.round(goldThisWave), mult, specials: spawns.length,
      clearedCells, spawns: spawns.slice(), afterBoard: board.slice() });
    lastSwapped = new Set();
    wave++;
  }
  let reshuffled = false;
  if (!hasAnyMove(board)) {
    const fresh = freshBoard(rng);
    board = fresh.board; nextId = fresh.nextId; reshuffled = true;
  }
  return { waves, totalGold: Math.round(totalGold), totalCleared, board, nextId, reshuffled, invalid: false };
}

/* ===== 玩法設定（GM 可調）與每日次數 ===== */
let DAILY_PLAYS = 3, MAX_GOLD_PER_SEC = 150, GOLD_PER_ITEM_ROLL = 300, ITEM_MEDIUM_CHANCE = 0.18;
let RANK_SHARDS = [2, 1, 1];   // 每日排行榜第 1／2／3 名的神秘碎片數（GM 可調）
function settingsKey() { return "config:match3_settings"; }
async function loadSettings() {
  try {
    const r = await a.get(settingsKey());
    if (r) {
      const t = JSON.parse(r.value);
      if (typeof t.dailyPlays === "number" && t.dailyPlays > 0) DAILY_PLAYS = Math.round(t.dailyPlays);
      if (typeof t.maxGoldPerSec === "number" && t.maxGoldPerSec > 0) MAX_GOLD_PER_SEC = t.maxGoldPerSec;
      if (typeof t.goldPerItemRoll === "number" && t.goldPerItemRoll > 0) GOLD_PER_ITEM_ROLL = t.goldPerItemRoll;
      if (typeof t.itemMediumChance === "number" && t.itemMediumChance >= 0 && t.itemMediumChance <= 1) ITEM_MEDIUM_CHANCE = t.itemMediumChance;
      if (t.rankShards) RANK_SHARDS = rankShardParse(t.rankShards, RANK_SHARDS);
    }
  } catch (e) {}
}
async function saveSettings() {
  await a.set(settingsKey(), JSON.stringify({ dailyPlays: DAILY_PLAYS, maxGoldPerSec: MAX_GOLD_PER_SEC, goldPerItemRoll: GOLD_PER_ITEM_ROLL, itemMediumChance: ITEM_MEDIUM_CHANCE, rankShards: RANK_SHARDS }));
}
// 所有人每天固定 5 次（不受 GM 設定影響）。
const FIXED_DAILY_PLAYS = 5;
function playsCapFor(p) {
  return FIXED_DAILY_PLAYS;
}
function playsRemaining(p) {
  const cap = playsCapFor(p);
  if (!p) return cap;
  return p.match3PlaysDate === ys() ? Math.max(0, typeof p.match3PlaysLeft === "number" ? p.match3PlaysLeft : cap) : cap;
}

/* ===== 成品掉落：小型為主、偶爾中型（跟原本 demo 同一套機率），道具 id 沿用既有的 ue[] 8 種成品 ===== */
const ITEM_SMALL = ["potion_small", "weapon_common", "accessory_common", "furniture_common"];
const ITEM_MEDIUM = ["potion_medium", "weapon_uncommon", "accessory_uncommon", "furniture_uncommon"];
function rollItems(gold) {
  const bag = {};
  if (!(gold > 0)) return bag;
  const rolls = Math.max(1, Math.round(gold / GOLD_PER_ITEM_ROLL));
  for (let i = 0; i < rolls; i++) {
    const pool = Math.random() < ITEM_MEDIUM_CHANCE ? ITEM_MEDIUM : ITEM_SMALL;
    const itemId = pool[Math.floor(Math.random() * pool.length)];
    bag[itemId] = (bag[itemId] || 0) + 1;
  }
  return bag;
}
function itemLabel(itemId) {
  const def = typeof Lt === "function" ? Lt(itemId) : null;
  return def ? { icon: def.icon, name: dc(def.labelZh, def.labelEn) } : { icon: "📦", name: itemId };
}

/* ===== 結算（CAS 寫玩家資料，用經過秒數夾住回報金幣防作弊）===== */
async function claimReward(raw) {
  if (!zl.nickname) return null;
  await loadSettings();
  const goldIn = Math.max(0, Math.floor(Number(raw && raw.gold) || 0));
  const clearedIn = Math.max(0, Math.floor(Number(raw && raw.cleared) || 0));
  const bestMultIn = Math.max(1, Number(raw && raw.bestMult) || 1);
  const elapsed = Math.max(1, Math.floor(Number(raw && raw.elapsedSeconds) || 0));
  let err = null, granted = null;
  const fresh = await Wl(zl.nickname, p => {
    err = null; granted = null;
    const today = ys();
    (p.match3PlaysDate === today && typeof p.match3PlaysLeft === "number") || (p.match3PlaysDate = today, p.match3PlaysLeft = playsCapFor(p));
    if (p.match3PlaysLeft <= 0 && !ku()) { err = "noplays"; return; }
    const cap = elapsed * MAX_GOLD_PER_SEC, capped = goldIn > cap && goldIn > 0, ratio = capped ? cap / goldIn : 1;
    const gold = Math.floor(goldIn * ratio);
    ku() || (p.match3PlaysLeft -= 1);
    p.coins = (p.coins || 0) + gold;
    if (typeof kt === "function") kt(p);
    const itemBag = rollItems(gold);
    if (Object.keys(itemBag).length) {
      p.professionItems = p.professionItems || {};
      for (const k of Object.keys(itemBag)) p.professionItems[k] = (p.professionItems[k] || 0) + itemBag[k];
    }
    granted = { gold, itemBag, capped, playsLeft: p.match3PlaysLeft, cleared: clearedIn, bestMult: bestMultIn };
  });
  if (!fresh) return null;
  if (err === "noplays") return { ok: false, reason: "noplays" };
  zl.player = fresh;
  { const c = document.getElementById("player-coin"); if (c) c.textContent = "✦ " + fmtCoin(fresh.coins); } // 只更新金幣顯示，不整頁重畫（整頁重畫會洗掉結算彈窗與分頁按鈕的事件）
  if (granted && granted.gold > 0) { try { await submitDailyScore(zl.nickname, granted.gold); st.standingsFor = null; } catch (e) {} }
  return granted ? { ok: true, ...granted } : { ok: true, gold: 0, itemBag: {}, capped: false, playsLeft: fresh.match3PlaysLeft, cleared: clearedIn, bestMult: bestMultIn };
}

/* ===== 每日排行榜（每人每天一筆，取單局最高分；跟塔羅輪盤週榜同一套 kv_store 前綴查詢模式）===== */
function scoreKey(dateKey, nick) { return `match3_daily_score:${dateKey}:${(nick || "").toLowerCase()}`; }
async function submitDailyScore(nick, score) {
  if (!nick || !(score > 0)) return null;
  const raw = await Vl(scoreKey(ys(), nick), t => {
    const s = t ? JSON.parse(t) : { score: 0, lastAt: 0, nick: "" };
    if (score > (s.score || 0)) { s.score = score; s.lastAt = Date.now(); s.nick = nick; }
    return JSON.stringify(s);
  }, JSON.stringify({ score: 0, lastAt: 0, nick: "" }));
  return raw ? JSON.parse(raw) : null;
}
async function getStandings(dateKey) {
  let entries = [];
  try { entries = await a.listValues(`match3_daily_score:${dateKey}:`); } catch (e) { entries = []; }
  const prefix = `match3_daily_score:${dateKey}:`;
  return entries.map(e => {
    let d = null; try { d = JSON.parse(e.value); } catch (err) {}
    if (!d) return null;
    return { nick: d.nick || e.key.slice(prefix.length), score: d.score || 0, lastAt: d.lastAt || 0 };
  }).filter(Boolean).filter(p => p.score > 0).sort((a2, b2) => b2.score - a2.score || a2.lastAt - b2.lastAt);
}

/* ===== 封號「三消魔法師」：每天結算一次（今天還沒過完就先不結算，等進入新的一天再結算昨天）===== */
function settledKey(dateKey) { return `config:match3_round_settle:${dateKey}`; }
async function tryClaimSettlement(dateKey) {
  let claimed = false;
  await Vl(settledKey(dateKey), v => { claimed = false; if (v) return v; claimed = true; return JSON.stringify({ settledAt: Date.now() }); }, "");
  return claimed;
}
async function settleRound(dateKey) {
  if (!(await tryClaimSettlement(dateKey))) return null;
  try {
    const list = await getStandings(dateKey);
    await loadSettings();
    try { await rankShardPayout("match3", dateKey, list, RANK_SHARDS); } catch (e) {}   // 前三名發神秘碎片
    if (list.length) { await setTitleHolder("match3Champion", list[0].nick); return list[0].nick; }
  } catch (e) {}
  return null;
}
async function ensureYesterdaySettled() {
  try { await settleRound(ys(Date.now() - 864e5)); } catch (e) {}
}

/* ===== UI ===== */
const ICONS = ["🔥", "🏆", "🗡️", "💰", "☀️", "🌙"];
function tarotName(i) { return dc(["權杖", "聖杯", "寶劍", "星幣", "太陽", "月亮"][i], ["Wands", "Cups", "Swords", "Pentacles", "Sun", "Moon"][i]); }

const st = {
  board: null, nextId: 1, rng: null, gold: 0, cleared: 0, bestMult: 1,
  timeLeft: 60, timerHandle: null, running: false, busy: false, tileSize: 40,
  els: {}, standings: null, standingsFor: null, loaded: false, result: null
};
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function ensureStyles() {
  if (document.getElementById("m3-styles")) return;
  const style = document.createElement("style");
  style.id = "m3-styles";
  style.textContent = `
    .m3-board{position:relative;margin:10px auto;border-radius:12px;background:rgba(0,0,0,.22);border:1px solid var(--line);}
    .m3-tile{position:absolute;display:flex;align-items:center;justify-content:center;border-radius:9px;cursor:pointer;
      transition:left .17s cubic-bezier(.4,0,.2,1),top .26s cubic-bezier(.3,0,.2,1),transform .14s ease,opacity .14s ease;}
    .m3-tile.sel{box-shadow:0 0 0 2px var(--gold-bright),0 0 14px rgba(232,195,74,.55);transform:scale(1.06);z-index:5;}
    .m3-tile.pop{transform:scale(.35);opacity:0;}
    .m3-tile.spawnIn{opacity:0;transform:scale(.55);}
    .m3-tile.special::after{content:"";position:absolute;inset:3px;border-radius:7px;pointer-events:none;
      border:2px solid rgba(255,255,255,.85);box-shadow:0 0 8px rgba(255,255,255,.55) inset;}
    .m3-t0{background:linear-gradient(150deg,#d68c34,#a15f1f);}
    .m3-t1{background:linear-gradient(150deg,#2f8f8a,#1d5f5b);}
    .m3-t2{background:linear-gradient(150deg,#5b6fd1,#3b4aa0);}
    .m3-t3{background:linear-gradient(150deg,#5c8a3a,#3d5f27);}
    .m3-t4{background:linear-gradient(150deg,#d1547e,#93335a);}
    .m3-t5{background:linear-gradient(150deg,#9a8fd6,#6c5fb0);}
    .m3-timerbar{height:6px;border-radius:4px;background:rgba(255,255,255,.08);overflow:hidden;margin:8px 2px;}
    .m3-timerbar>i{display:block;height:100%;background:linear-gradient(90deg,var(--gold),var(--gold-bright));transition:width .25s linear;}
    .m3-timerbar.low>i{background:linear-gradient(90deg,#9c3b2a,#d3654a);}
    .m3-combo{position:absolute;left:50%;top:8px;transform:translateX(-50%) translateY(-6px);z-index:8;
      background:rgba(20,10,26,.92);border:1px solid var(--gold);color:var(--gold-bright);padding:5px 12px;border-radius:999px;
      font-size:12.5px;font-weight:700;white-space:nowrap;opacity:0;transition:opacity .18s ease,transform .18s ease;pointer-events:none;}
    .m3-combo.show{opacity:1;transform:translateX(-50%) translateY(0);}
    #m3-resultov{opacity:0;pointer-events:none;}
    #m3-resultov.show{opacity:1;pointer-events:auto;}
    .gres-card{width:86%;max-width:300px;background:linear-gradient(165deg,rgba(48,26,70,.97),rgba(18,10,28,.98));border:1px solid var(--gold-bright);border-radius:16px;padding:22px 18px 18px;box-shadow:0 0 34px rgba(139,63,214,.4),0 14px 40px rgba(0,0,0,.55);}
    .gres-title{font-family:Cinzel,serif;font-size:15px;font-weight:700;letter-spacing:1.5px;color:var(--gold-bright);margin-bottom:12px;text-shadow:0 0 10px rgba(232,196,104,.4);}
    .gres-amount{font-family:'Space Mono',monospace;font-size:30px;font-weight:800;color:var(--gold-bright);margin-bottom:8px;text-shadow:0 0 16px rgba(232,196,104,.55);}
    .gres-sub{font-size:12px;color:var(--muted);margin:0 0 4px;}
    .gres-chips{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:10px 0 6px;}
    .gres-chip{background:rgba(255,255,255,.05);border:1px solid var(--gold);border-radius:999px;padding:5px 12px;font-size:12px;color:var(--cream);white-space:nowrap;}
    .gres-btn{width:100%;margin-top:14px;}
    .m3-legend{display:flex;flex-wrap:wrap;gap:6px 10px;justify-content:center;margin:8px 2px 2px;font-size:11px;color:var(--muted);}
    .m3-legend span{display:inline-flex;align-items:center;gap:4px;}
    .m3-legend i{width:13px;height:13px;border-radius:4px;display:inline-block;}
  `;
  document.head.appendChild(style);
}

function layout(boardEl) {
  const outer = boardEl.parentElement; // #m3-boardwrap
  const wrapW = (outer.parentElement ? outer.parentElement.clientWidth : 0) || 320;
  st.tileSize = Math.floor(Math.min(wrapW, 420) / W);
  const px = (st.tileSize * W) + "px", py = (st.tileSize * H) + "px";
  boardEl.style.width = px; boardEl.style.height = py;
  outer.style.width = px; outer.style.height = py;
}
function cellXY(cell) {
  const r = Math.floor(cell / W), c = cell % W;
  return { left: c * st.tileSize + 2, top: r * st.tileSize + 2 };
}
function makeTileEl(boardEl, tile, cell) {
  const el = document.createElement("div");
  el.className = "m3-tile m3-t" + tile.type + (tile.special ? " special" : "");
  const { left, top } = cellXY(cell);
  el.style.left = left + "px"; el.style.top = top + "px";
  el.style.width = (st.tileSize - 4) + "px"; el.style.height = (st.tileSize - 4) + "px";
  el.style.fontSize = Math.round(st.tileSize * 0.5) + "px";
  el.textContent = ICONS[tile.type];
  boardEl.appendChild(el);
  st.els[tile.id] = el;
  return el;
}
function renderFull(boardEl) {
  boardEl.innerHTML = "";
  st.els = {};
  for (let cell = 0; cell < W * H; cell++) { const t = st.board[cell]; if (t) makeTileEl(boardEl, t, cell); }
}
function setSelectedVisual(cell) {
  Object.values(st.els).forEach(el => el.classList.remove("sel"));
  if (cell != null && st.board[cell] && st.els[st.board[cell].id]) st.els[st.board[cell].id].classList.add("sel");
}
function showCombo(e, text) {
  const el = e.querySelector("#m3-combo"); if (!el) return;
  el.textContent = text; el.classList.add("show");
  clearTimeout(showCombo._t); showCombo._t = setTimeout(() => el.classList.remove("show"), 850);
}

async function animateWave(e, boardEl, prevBoard, wave) {
  wave.clearedCells.forEach(cell => { const t = prevBoard[cell]; if (t && st.els[t.id]) st.els[t.id].classList.add("pop"); });
  if (wave.cleared > 0) sfxMatch(wave.wave);
  if (wave.mult > 1) { showCombo(e, dc(`連鎖 x${wave.mult.toFixed(1)}！+${wave.gold}`, `Chain x${wave.mult.toFixed(1)}! +${wave.gold}`)); sfxChainBonus(); }
  else if (wave.cleared > 0) showCombo(e, "+" + wave.gold);
  await sleep(190);
  wave.clearedCells.forEach(cell => { const t = prevBoard[cell]; if (t && st.els[t.id]) { st.els[t.id].remove(); delete st.els[t.id]; } });
  const after = wave.afterBoard;
  const seenIds = new Set();
  for (let cell = 0; cell < W * H; cell++) {
    const t = after[cell]; if (!t) continue;
    seenIds.add(t.id);
    let el = st.els[t.id];
    const { left, top } = cellXY(cell);
    if (el) { el.style.left = left + "px"; el.style.top = top + "px"; if (t.special && !el.classList.contains("special")) el.classList.add("special"); }
    else { el = makeTileEl(boardEl, t, cell); el.classList.add("spawnIn"); requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove("spawnIn"))); }
  }
  Object.keys(st.els).forEach(id => { if (!seenIds.has(Number(id))) { st.els[id].remove(); delete st.els[id]; } });
  st.board = after.slice();
  await sleep(230);
}

async function onTileClick(e, boardEl, cell) {
  if (st.busy || !st.running) return;
  if (st.selected == null) { st.selected = cell; setSelectedVisual(cell); return; }
  if (st.selected === cell) { st.selected = null; setSelectedVisual(null); return; }
  const r1 = Math.floor(st.selected / W), c1 = st.selected % W, r2 = Math.floor(cell / W), c2 = cell % W;
  if (Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) { st.selected = cell; setSelectedVisual(cell); return; }
  const a2 = st.selected, b2 = cell;
  st.selected = null; setSelectedVisual(null);
  st.busy = true;
  const ta = st.board[a2], tb = st.board[b2];
  const posA = cellXY(b2), posB = cellXY(a2);
  if (st.els[ta.id]) { st.els[ta.id].style.left = posA.left + "px"; st.els[ta.id].style.top = posA.top + "px"; }
  if (st.els[tb.id]) { st.els[tb.id].style.left = posB.left + "px"; st.els[tb.id].style.top = posB.top + "px"; }
  await sleep(180);
  const res = resolveSwap(st.board, st.nextId, a2, b2, st.rng);
  st.nextId = res.nextId;
  if (res.invalid) {
    if (st.els[ta.id]) { st.els[ta.id].style.left = posB.left + "px"; st.els[ta.id].style.top = posB.top + "px"; }
    if (st.els[tb.id]) { st.els[tb.id].style.left = posA.left + "px"; st.els[tb.id].style.top = posA.top + "px"; }
    await sleep(180);
    st.busy = false;
    return;
  }
  let snapshot = st.board.slice();
  snapshot[a2] = tb; snapshot[b2] = ta;
  for (const wave of res.waves) {
    await animateWave(e, boardEl, snapshot, wave);
    snapshot = wave.afterBoard;
    if (wave.mult > st.bestMult) st.bestMult = wave.mult;
  }
  st.gold += res.totalGold; st.cleared += res.totalCleared;
  st.board = res.board;
  const goldEl = e.querySelector("#m3-gold"); if (goldEl) goldEl.textContent = st.gold.toLocaleString();
  if (res.reshuffled) { renderFull(boardEl); showCombo(e, dc("盤面卡住，已重新洗牌", "Board stuck, reshuffled")); await sleep(200); }
  st.busy = false;
}

function tickTimer(e) {
  st.timeLeft -= 1;
  const timeEl = e.querySelector("#m3-time"), fillEl = e.querySelector("#m3-timerfill"), barEl = e.querySelector("#m3-timerbar");
  if (timeEl) timeEl.textContent = Math.max(0, st.timeLeft);
  if (fillEl) fillEl.style.width = Math.max(0, (st.timeLeft / 60) * 100) + "%";
  if (barEl) barEl.classList.toggle("low", st.timeLeft <= 10);
  if (st.timeLeft <= 0) endRound(e);
}

function startRound(e) {
  const boardEl = e.querySelector("#m3-board"); if (!boardEl) return;
  st.gold = 0; st.cleared = 0; st.bestMult = 1; st.timeLeft = 60; st.selected = null; st.busy = false; st.running = true;
  st.startedAt = Date.now();
  layout(boardEl);
  st.rng = mulberry32((Date.now() ^ Math.floor(Math.random() * 1e9)) & 0xffffffff);
  const fresh = freshBoard(st.rng);
  st.board = fresh.board; st.nextId = fresh.nextId;
  renderFull(boardEl);
  const startOv = e.querySelector("#m3-startov"); if (startOv) startOv.style.display = "none";
  const resOv = e.querySelector("#m3-resultov"); if (resOv) resOv.classList.remove("show");
  clearInterval(st.timerHandle);
  st.timerHandle = setInterval(() => tickTimer(e), 1000);
}

// 找目前「真的還在畫面上」的那個彈窗容器，而不是死認交換分頁時被拿掉的那個舊節點——
// 玩家在計時進行中如果切走分頁、或頁面被其他背景更新整個重畫過一次，startRound() 當初拿到的
// e 就會變成一個已經從畫面上被拔掉、沒人看得到的舊節點；这種時候「彈窗有沒有跳出來」全部
// 取決於是不是去抓「現在真正接在畫面上」的那個容器，抓錯就等於結算完全沒有任何畫面回饋。
function liveM3Root() {
  const ov = document.getElementById("m3-resultov");
  return ov && ov.isConnected ? ov : null;
}
// 結算彈窗內容存在 st.result（{loading:true} 或 {res}），boardHtml() 重畫時會照著它畫出彈窗，
// 所以不管整頁被重畫幾次，彈窗都不會消失，直到玩家按「取消」或「再玩一次」。
function resultInnerHtml() {
  if (!st.result) return "";
  return st.result.loading ? `<p class="sub">${dc("結算中…", "Settling…")}</p>` : resultBodyHtml(st.result.res, st.result.raw);
}
function showResult(state) {
  st.result = state;
  const ov = liveM3Root();
  if (!ov) return;
  const body = ov.querySelector("#m3-res-body");
  if (body) body.innerHTML = resultInnerHtml();
  ov.classList.add("show");
  if (state && !state.loading) wireResultOverlay();
}
async function endRound(e) {
  st.running = false;
  clearInterval(st.timerHandle);
  const elapsedSeconds = Math.max(1, Math.round((Date.now() - st.startedAt) / 1000));
  const raw = { gold: st.gold, cleared: st.cleared, bestMult: st.bestMult, elapsedSeconds };
  try {
    showResult({ loading: true });
    let res;
    try { res = await claimReward(raw); } catch (err) { res = null; }
    showResult({ res, raw });
    if (res && res.ok !== false) {
      const itemCount = Object.values(res.itemBag || {}).reduce((a, b2) => a + b2, 0);
      sfxRoundEnd(true);
      ac(dc(`🔮 三消結算：+${res.gold.toLocaleString()} 金幣${itemCount ? `，獲得 ${itemCount} 件成品` : ""}`,
            `🔮 Match-3 settled: +${res.gold.toLocaleString()} coins${itemCount ? `, ${itemCount} item(s)` : ""}`));
    } else if (res && res.reason === "noplays") {
      sfxRoundEnd(false);
      ac(dc("今天的三消次數已經用完了，明天再來吧！", "No Match-3 plays left for today, come back tomorrow!"));
    } else if (!liveM3Root()) {
      ac(dc("三消結算失敗，請稍後再試", "Match-3 settlement failed, please try again"));
    }
  } catch (err) {
    showResult({ res: null });
    ac(dc("三消結算時發生錯誤，請稍後再試", "Something went wrong settling Match-3, please try again"));
  }
}

function resultBodyHtml(res, raw) {
  if (!res || res.ok === false) {
    const msg = res && res.reason === "noplays"
      ? dc("今天的三消次數已經用完了，明天再來吧！", "No Match-3 plays left for today, come back tomorrow!")
      : dc("結算失敗，請稍後再試", "Settlement failed, please try again");
    return `<div class="gres-title">${dc("這局沒有結算", "This round wasn't settled")}</div><p class="gres-sub">${msg}</p>
      <button class="btn gres-btn" id="m3-cancel-btn">${dc("關閉", "Close")}</button>`;
  }
  const capNote = res.capped ? `<p class="gres-sub" style="color:var(--gold-bright);">${dc("分數超出合理範圍，已依實際遊玩時間調整", "Score exceeded a reasonable pace and was scaled down")}</p>` : "";
  const itemChips = Object.keys(res.itemBag || {}).map(id => {
    const lbl = itemLabel(id);
    return `<span class="gres-chip">${lbl.icon} ${Iu(lbl.name)} ×${res.itemBag[id]}</span>`;
  }).join("");
  return `<div class="gres-title">${dc("本局結算", "Round Settlement")}</div>
    <div class="gres-amount">+${res.gold.toLocaleString()} ${dc("金幣", "coins")}</div>
    <p class="gres-sub">${dc(`消除 ${res.cleared} 個　最高連鎖 x${res.bestMult.toFixed(1)}`, `Cleared ${res.cleared} · Best chain x${res.bestMult.toFixed(1)}`)}</p>
    ${capNote}<div class="gres-chips">${itemChips || `<span class="gres-sub">${dc("這局沒有成品掉落", "No items dropped this round")}</span>`}</div>
    <p class="gres-sub">${dc(`今天還剩 ${res.playsLeft} 次`, `${res.playsLeft} plays left today`)}</p>
    <div class="form-row" style="gap:8px;margin-top:14px;justify-content:center;">
      <button class="btn small secondary" id="m3-cancel-btn" style="flex:1;">${dc("取消", "Cancel")}</button>
      <button class="btn" id="m3-again-btn" style="flex:1;">${dc("再玩一次", "Play Again")}</button>
    </div>`;
}

function boardHtml() {
  // 外層 #m3-boardwrap 固定不動；#m3-board（棋盤格子本身）每次 renderFull() 都會整個清空重畫，
  // 計時開始／結束的遮罩一定要放在 #m3-board 外面當它的「手足」，不能當它的子節點，
  // 不然一清空棋盤，遮罩會被一起清掉、整個從畫面上消失。
  return `<div class="m3-boardwrap" id="m3-boardwrap" style="position:relative;width:320px;margin:0 auto;">
    <div class="m3-board" id="m3-board" style="width:320px;height:320px;"></div>
    <div class="m3-combo" id="m3-combo"></div>
    <div id="m3-startov" style="position:absolute;inset:0;z-index:15;display:flex;align-items:center;justify-content:center;border-radius:12px;background:rgba(15,8,20,.55);">
      <button class="btn" id="m3-start-btn">${dc("開始 60 秒挑戰", "Start 60s Challenge")}</button>
    </div>
    <div id="m3-resultov" class="${st.result ? "show" : ""}" style="position:absolute;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;background:rgba(15,8,20,.72);border-radius:12px;transition:opacity .22s ease;">
      <div class="gres-card" id="m3-res-body">${resultInnerHtml()}</div>
    </div>
  </div>`;
}

function legendHtml() {
  return `<div class="m3-legend">${ICONS.map((ic, i) => `<span><i class="m3-t${i}"></i>${ic} ${tarotName(i)}</span>`).join("")}</div>`;
}

function standingsHtml() {
  if (st.standings === null) return `<p class="sub">${dc("讀取排行榜中…", "Loading leaderboard…")}</p>`;
  if (!st.standings.length) return `<p class="sub">${dc("今天還沒有人上榜，快來搶頭香！", "No one on today's board yet — be the first!")}</p>`;
  return st.standings.slice(0, 10).map((p2, i) => {
    const rank = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
    return `<div class="listing"><div class="left"><div class="meta"><div>${rank} ${Iu(p2.nick)}</div></div></div><div class="right">✦ ${p2.score.toLocaleString()}</div></div>`;
  }).join("");
}

function panelHtml() {
  const p = zl.player, left = playsRemaining(p), cap = playsCapFor(p), champion = Js.match3Champion;
  return `<div class="panel">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
      <h2 style="margin-bottom:0;">🔮 ${dc("塔羅三消", "Tarot Match-3")}</h2>
      <button class="btn small secondary" id="m3-sfx-toggle" title="${dc("音效開關", "Sound effects on/off")}" style="padding:6px 12px;">${sfxMuted ? "🔇" : "🔊"} ${dc("音效", "SFX")}</button>
    </div>
    <p class="sub">${dc(`交換相鄰方塊湊 3 個以上同圖案消除；4 消清整行／整列，5 消或 L／T 型清整行＋整列；連鎖（一次交換引發的每一波消除）獎勵會往上加成。免費玩，每天 5 次，獎勵金幣＋成品（藥水／武器／飾品／家具，小型為主偶爾中型）。`, `Swap adjacent tiles to match 3+; a 4-match clears its row/column, a 5-match or L/T-shape clears both. Each chain wave in one swap pays out more. Free to play, 5 times a day, rewards coins + crafted items (potions/weapons/accessories/furniture, mostly small tier with occasional medium).`)}</p>
    ${champion ? `<p class="who">${dc("今日封號", "Today's title")}: ${Ys("match3Champion", 13)} ${Iu(champion)}</p>` : ""}
    <div class="stats" style="display:flex;align-items:center;justify-content:space-between;margin:10px 2px 4px;font-size:14px;">
      <div>✦ <b id="m3-gold">${st.gold}</b> ${dc("金幣", "coins")}</div>
      <div>⏱ <span id="m3-time">60</span> ${dc("秒", "s")}</div>
    </div>
    <div class="m3-timerbar" id="m3-timerbar"><i id="m3-timerfill" style="width:100%"></i></div>
    ${boardHtml()}
    ${legendHtml()}
    <p class="sub" style="text-align:center;margin-top:6px;">${dc(`今天剩餘次數：${left} / ${cap}`, `Plays left today: ${left} / ${cap}`)}</p>
  </div>
  <div class="panel">
    <h2>🏆 ${dc("今日排行榜", "Today's Leaderboard")}</h2>
    <p class="sub">${dc("每人取當天單局最高分；明天結算出「三消魔法師」封號。", "Each player's best single session today; the \"Match-3 Wizard\" title is settled tomorrow.")}</p><p class="sub">${rankShardHint(RANK_SHARDS)}</p>
    <div id="m3-standings-body">${standingsHtml()}</div>
  </div>
  ${ku() ? gmCollapsibleWrap(gmPanelHtml()) : ""}`;
}

// 開新局前的共用檢查（總開關＋今日次數），「開始」跟「再玩一次」都走這裡
async function tryStart(e) {
  if (!(await mgFresh("match3"))) { ac(dc("塔羅三消目前由 GM 暫時關閉", "Tarot Match-3 is temporarily closed by the GM")); Bu(); return; }
  const left = playsRemaining(zl.player);
  if (left <= 0 && !ku()) { ac(dc("今天的三消次數已經用完了，明天再來吧！", "No Match-3 plays left for today, come back tomorrow!")); return; }
  startRound(e);
}
function wireResultOverlay() {
  // 只重畫分頁內容（Bu），不整頁重畫（Eu）：Eu 會複製舊畫面並洗掉事件，造成按鈕失效。
  const cancelBtn = document.getElementById("m3-cancel-btn");
  if (cancelBtn) cancelBtn.onclick = () => { st.result = null; Bu(); };
  const againBtn = document.getElementById("m3-again-btn");
  if (againBtn) againBtn.onclick = () => { st.result = null; tryStart(document); };
}
function wireTab(e) {
  ensureStyles();
  if (st.result && !st.result.loading) wireResultOverlay();
  const sfxBtn = e.querySelector("#m3-sfx-toggle");
  if (sfxBtn) sfxBtn.onclick = () => {
    const muted = toggleSfxMuted();
    sfxBtn.innerHTML = `${muted ? "🔇" : "🔊"} ${dc("音效", "SFX")}`;
    if (!muted) playTone(660, 0.1, { type: "triangle", volume: 0.14 });
  };
  const startBtn = e.querySelector("#m3-start-btn");
  if (startBtn) startBtn.onclick = () => tryStart(e);
  const boardEl = e.querySelector("#m3-board");
  if (boardEl && !boardEl.dataset.wired) {
    boardEl.dataset.wired = "1";
    boardEl.addEventListener("click", ev => {
      if (st.busy || !st.running) return;
      const rect = boardEl.getBoundingClientRect();
      const x = ev.clientX - rect.left, y = ev.clientY - rect.top;
      const col = Math.floor(x / st.tileSize), row = Math.floor(y / st.tileSize);
      if (col < 0 || col >= W || row < 0 || row >= H) return;
      onTileClick(e, boardEl, row * W + col);
    });
  }
  wireGmPanel(e);
}
async function refreshStandings() {
  st.standingsFor = null;
  try { st.standings = await getStandings(ys()); st.standingsFor = ys(); } catch (err) { st.standings = st.standings || []; }
  const host = document.getElementById("m3-standings-body");
  if (host) host.innerHTML = standingsHtml();
}

async function renderTabCore(e) {
  await loadSettings();
  ensureYesterdaySettled().catch(() => {});
  if (st.standingsFor !== ys()) { try { st.standings = await getStandings(ys()); st.standingsFor = ys(); } catch (err) { st.standings = []; } }
  e.innerHTML = panelHtml();
  wireTab(e);
}
async function renderTab(e) {
  await renderTabCore(e);
}

/* ===== GM 面板 ===== */
function gmPanelHtml() {
  return `<div class="panel">
    <h2>🔮 ${dc("塔羅三消控制", "Tarot Match-3 Control")}</h2>
    <p class="sub">${dc("調整三消的每日次數、防作弊上限與神秘碎片轉換比例。", "Tune Match-3's daily plays, anti-cheat cap, and Mystery Shard conversion rate.")}</p>
    <div class="form-row">
      <div><label>${dc("每日遊玩次數（已固定為 5，此欄位不再生效）", "Daily plays (fixed at 5, no longer applies)")}</label><input type="number" id="m3-gm-plays" value="${DAILY_PLAYS}" min="1" style="width:90px;" /></div>
      <div><label>${dc("每秒金幣上限（防作弊）", "Max gold/sec (anti-cheat)")}</label><input type="number" id="m3-gm-cap" value="${MAX_GOLD_PER_SEC}" min="10" style="width:100px;" /></div>
      <div><label>${dc("每 N 金幣抽 1 次成品", "Gold per item roll")}</label><input type="number" id="m3-gm-itemroll" value="${GOLD_PER_ITEM_ROLL}" min="20" style="width:100px;" /></div>
      <div><label>${dc("中型成品機率（0~1）", "Medium-tier item chance (0-1)")}</label><input type="number" step="0.01" id="m3-gm-itemmed" value="${ITEM_MEDIUM_CHANCE}" min="0" max="1" style="width:100px;" /></div>
      ${rankShardGmHtml("m3", RANK_SHARDS)}
    </div>
    <button class="btn small" id="m3-gm-save-btn">${dc("儲存設定", "Save settings")}</button>
  </div>`;
}
function wireGmPanel(e) {
  const btn = e.querySelector("#m3-gm-save-btn");
  if (btn) btn.onclick = async () => {
    const plays = parseInt(e.querySelector("#m3-gm-plays").value, 10), cap = parseFloat(e.querySelector("#m3-gm-cap").value),
      itemRoll = parseFloat(e.querySelector("#m3-gm-itemroll").value), itemMed = parseFloat(e.querySelector("#m3-gm-itemmed").value);
    if (plays > 0) DAILY_PLAYS = plays;
    if (cap > 0) MAX_GOLD_PER_SEC = cap;
    if (itemRoll > 0) GOLD_PER_ITEM_ROLL = itemRoll;
    if (!isNaN(itemMed) && itemMed >= 0 && itemMed <= 1) ITEM_MEDIUM_CHANCE = itemMed;
    RANK_SHARDS = rankShardGmRead(e, "m3", RANK_SHARDS);
    await saveSettings();
    ac(dc("三消設定已儲存", "Match-3 settings saved"));
  };
}

return { renderTab };
})();
function match3RenderTab(e) { return M3.renderTab(e); }