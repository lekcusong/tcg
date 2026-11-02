

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
// 特殊方塊生成／特殊組合：短短兩聲
function sfxSpecial() {
  playTone(520, 0.1, { type: "square", volume: 0.08 });
  setTimeout(() => playTone(780, 0.14, { type: "triangle", volume: 0.1 }), 70);
}
// 時間獎勵：輕輕一聲
function sfxTime() { playTone(1000, 0.08, { type: "sine", volume: 0.1 }); }
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
const W = 8, H = 8, TYPES = 6, WILD = 6;          // 6 種花色方塊（0~5）；WILD(6) 是「愚者」萬能牌，不屬於任何花色
const MAX_ROUND_SEC = 120, TIME_CAP = 90;          // 單局真實時間上限／剩餘時間上限（時間獎勵不能無限續命）
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

// 愚者（萬能牌）不參與一般三消：給它一個每格獨一無二的負數，永遠湊不成一排
function findMatches(get) {
  return groupRuns(findRuns((r, c) => { const t = get(r, c); return t === WILD ? -100 - idx(r, c) : t; }));
}

// 4 消 → 整行／整列；L／T／十字 → 十字；筆直 5 連（以上）→ 愚者（萬能牌）
function specialKindFor(group) {
  if (group.dirs.length >= 2) return 'cross';
  const n = group.cells.length;
  if (n >= 5) return 'wild';
  if (n === 4) return group.dirs[0] === 'h' ? 'row' : 'col';
  return 'none';
}

// opts（開局抽到的牌可以改）：multBonus 起跳加成、multStep 每波增量、multCap 倍率上限
function waveMultiplier(wave, opts) {
  const o = opts || {};
  return Math.min(1 + (o.multBonus || 0) + (wave - 1) * (o.multStep || 0.5), o.multCap || 3.0);
}

/* 特殊方塊交換組合（board 是「交換之後」的盤面，a、b 是兩格）。沒有組合回傳 null。
   - 愚者 ＋ 一般方塊：清掉全盤跟那顆同花色的方塊
   - 愚者 ＋ 整行／整列／十字：全盤同花色的方塊全部變成那種特殊方塊一起引爆
   - 愚者 ＋ 愚者：清掉整個盤面
   - 兩個行／列／十字特殊方塊：兩格的整行＋整列全清 */
function comboCells(board, a, b) {
  const ta = board[a], tb = board[b];
  if (!ta || !tb) return null;
  const wa = ta.special === 'wild', wb = tb.special === 'wild';
  if (!wa && !wb && !(ta.special && tb.special)) return null;
  const pick = (pred) => { const s = new Set(); for (let i = 0; i < W * H; i++) { const t = board[i]; if (t && pred(t)) s.add(i); } return s; };
  if (wa && wb) return { cells: pick(() => true), bonus: 3, markWilds: true };
  if (wa || wb) {
    const other = wa ? tb : ta, wcell = wa ? a : b;
    const cells = pick(t => t.special !== 'wild' && t.type === other.type);
    if (other.special) cells.forEach(i => { board[i].special = other.special; });
    cells.add(wcell);
    return { cells, bonus: 2, markWilds: true };
  }
  ta.special = 'cross'; tb.special = 'cross';
  return { cells: new Set([a, b]), bonus: 2, markWilds: false };
}

// 這個交換合不合法（會形成三消，或本身就是特殊組合）——不會動到盤面
function canSwap(board, a, b) {
  const ta = board[a], tb = board[b];
  if (!ta || !tb) return false;
  if (ta.special === 'wild' || tb.special === 'wild' || (ta.special && tb.special)) return true;
  const swapped = board.slice(); swapped[a] = tb; swapped[b] = ta;
  return findMatches((r, c) => swapped[idx(r, c)] ? swapped[idx(r, c)].type : -1).length > 0;
}

// 找一步可以走的棋（提示用）；找不到回傳 null
function findHintMove(board) {
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    for (const d of [[0, 1], [1, 0]]) {
      const nr = r + d[0], nc = c + d[1];
      if (!inB(nr, nc)) continue;
      const a = idx(r, c), b = idx(nr, nc);
      if (canSwap(board, a, b)) return [a, b];
    }
  }
  return null;
}
function hasAnyMove(board) { return !!findHintMove(board); }

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

/* 一連串消除（共用）：forced = 一開始就強制清掉的格子（特殊組合／高塔炸行）；沒有就只看三消。
   每一波：算出要清的格子 → 特殊方塊連鎖引爆 → 算分數與時間獎勵 → 生成新特殊方塊 → 補位，直到沒有三消為止。 */
function runWaves(board, nextId, rng, opts, forced, lastSwapped) {
  opts = opts || {};
  const goldMult = opts.goldMult || 1;
  let wave = 1, totalGold = 0, totalCleared = 0, totalTime = 0;
  const waves = [];
  lastSwapped = lastSwapped || new Set();
  let forcedNow = forced || null;
  while (wave <= 60) {
    const groups = findMatches((r, c) => board[idx(r, c)] ? board[idx(r, c)].type : -1);
    if (groups.length === 0 && !forcedNow) break;
    const toClear = new Set();
    const triggeredWild = new Set();
    if (forcedNow) {
      forcedNow.cells.forEach(x => toClear.add(x));
      if (forcedNow.markWilds) forcedNow.cells.forEach(x => { const t = board[x]; if (t && t.special === 'wild') triggeredWild.add(x); });
    }
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
        const addCell = (x) => { if (!toClear.has(x) && !spawnCells.has(x)) { toClear.add(x); grew = true; } };
        if (t.special === 'row' || t.special === 'cross') for (let cc = 0; cc < W; cc++) addCell(idx(r, cc));
        if (t.special === 'col' || t.special === 'cross') for (let rr = 0; rr < H; rr++) addCell(idx(rr, c));
        if (t.special === 'wild' && !triggeredWild.has(cell)) {
          // 愚者被別的爆炸波及：清掉盤面上數量最多的那個花色
          triggeredWild.add(cell);
          const counts = new Array(TYPES).fill(0);
          for (let i = 0; i < W * H; i++) { const u = board[i]; if (u && u.type < TYPES) counts[u.type]++; }
          let best = 0;
          for (let k = 1; k < TYPES; k++) if (counts[k] > counts[best]) best = k;
          for (let i = 0; i < W * H; i++) { const u = board[i]; if (u && u.type === best) addCell(i); }
        }
      }
    }
    spawnCells.forEach(c => toClear.delete(c));
    const clearedCount = toClear.size;
    const mult = waveMultiplier(wave, opts);
    const goldThisWave = clearedCount * 10 * mult * goldMult;
    // 時間獎勵：4 消 +1、十字／愚者 +2、特殊組合另加、第 4 波連鎖 +2、之後每波 +1
    let tb = 0;
    spawns.forEach(s => { tb += (s.kind === 'row' || s.kind === 'col') ? 1 : 2; });
    if (forcedNow) tb += forcedNow.bonus || 0;
    if (wave === 4) tb += 2; else if (wave > 4) tb += 1;
    totalGold += goldThisWave;
    totalCleared += clearedCount;
    totalTime += tb;
    const clearedCells = Array.from(toClear);
    toClear.forEach(cell => { board[cell] = null; });
    spawns.forEach(s => { board[s.cell] = { id: nextId++, type: s.kind === 'wild' ? WILD : s.type, special: s.kind }; });
    nextId = refill(board, nextId, rng);
    waves.push({ wave, cleared: clearedCount, gold: Math.round(goldThisWave), mult, specials: spawns.length, timeBonus: tb,
      forced: !!forcedNow, clearedCells, spawns: spawns.slice(), afterBoard: board.slice() });
    lastSwapped = new Set();
    forcedNow = null;
    wave++;
  }
  let reshuffled = false;
  if (!hasAnyMove(board)) {
    const fresh = freshBoard(rng);
    board = fresh.board; nextId = fresh.nextId; reshuffled = true;
  }
  return { waves, totalGold: Math.round(totalGold), totalCleared, totalTime, board, nextId, reshuffled, invalid: false };
}

function resolveSwap(board, nextId, a, b, rng, opts) {
  const ta = board[a], tb = board[b];
  const bad = { waves: [], totalGold: 0, totalCleared: 0, totalTime: 0, board, nextId, reshuffled: false, invalid: true };
  if (!ta || !tb) return bad;
  board[a] = tb; board[b] = ta;
  const combo = comboCells(board, a, b);
  if (!combo && findMatches((r, c) => board[idx(r, c)] ? board[idx(r, c)].type : -1).length === 0) {
    board[a] = ta; board[b] = tb;
    return bad;
  }
  return runWaves(board, nextId, rng, opts, combo, new Set([a, b]));
}

// 高塔：整行炸掉（不用交換），後面照常連鎖
function blastRow(board, nextId, row, rng, opts) {
  const cells = new Set(Array.from({ length: W }, (_, c) => idx(row, c)));
  return runWaves(board, nextId, rng, opts, { cells, bonus: 0, markWilds: false }, new Set());
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

const SP_GLYPH = { row: "↔", col: "↕", cross: "✚" };
const SWAP_MS = 140, POP_MS = 150, FALL_MS = 200, HINT_IDLE_MS = 5000;

/* ===== 開局抽牌：每局先抽 3 張大阿爾克那，選 1 張帶進這局（數值都集中在這張表，要調平衡改這裡）=====
   addTime：開局時間加減（秒）；opts：傳給計分（multBonus 倍率起跳加成／multStep 每波增量／multCap 上限／goldMult 得分倍率）；
   tower：每 20 秒炸一整行；startWilds：開局盤面送幾張愚者 */
const BUFFS = [
  { id: "star",     num: "XVII", icon: "⭐", art: "major-the-star",     zh: "星星",   en: "The Star",     dzh: "開局 +10 秒",               den: "+10 seconds at the start",       addTime: 10 },
  { id: "strength", num: "VIII", icon: "🦁", art: "major-strength",     zh: "力量",   en: "Strength",     dzh: "連鎖更猛：每波倍率 +0.75（上限 ×4）", den: "Bigger chains: +0.75 per wave (cap x4)", opts: { multStep: 0.75, multCap: 4 } },
  { id: "devil",    num: "XV",   icon: "😈", art: "major-the-devil",    zh: "惡魔",   en: "The Devil",    dzh: "得分 ×1.5，但時間 −15 秒",   den: "Score x1.5, but -15 seconds",    addTime: -15, opts: { goldMult: 1.5 } },
  { id: "tower",    num: "XVI",  icon: "⚡", art: "major-the-tower",    zh: "高塔",   en: "The Tower",    dzh: "每 20 秒隨機炸掉一整行",     den: "Every 20s a random row explodes", tower: true },
  { id: "magician", num: "I",    icon: "🎩", art: "major-the-magician", zh: "魔術師", en: "The Magician", dzh: "開局盤面送 2 張愚者（萬能牌）", den: "Start with 2 Fools (wilds) on the board", startWilds: 2 },
  { id: "sun",      num: "XIX",  icon: "🌞", art: "major-the-sun",      zh: "太陽",   en: "The Sun",      dzh: "連鎖倍率從 ×1.25 起跳",      den: "Chain multiplier starts at x1.25", opts: { multBonus: 0.25 } }
];
function buffById(id) { return BUFFS.find(b => b.id === id) || null; }
function buffArtUrl(b) { return "https://lekcusong.github.io/tcg/assets/" + b.art + ".jpg"; }
function buffChipHtml() {
  const b = st.running && st.buff;
  return b ? `<span class="m3-buffchip">${b.icon} ${b.num} ${dc(b.zh, b.en)}：${dc(b.dzh, b.den)}</span>` : "";
}
function updateBuffChip() { const el = document.getElementById("m3-buff"); if (el) el.innerHTML = buffChipHtml(); }

const st = {
  board: null, nextId: 1, rng: null, gold: 0, cleared: 0, bestMult: 1,
  timeLeft: 60, elapsed: 0, timerHandle: null, running: false, busy: false, tileSize: 40,
  buff: null, opts: {}, pendingBlast: false, lastActionAt: 0, hintCells: null, timeBonusTotal: 0,
  els: {}, standings: null, standingsFor: null, loaded: false, result: null
};
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function ensureStyles() {
  if (document.getElementById("m3-styles")) return;
  const style = document.createElement("style");
  style.id = "m3-styles";
  style.textContent = `
    .m3-board{position:relative;margin:10px auto;border-radius:12px;background:rgba(0,0,0,.22);border:1px solid var(--line);touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;}
    .m3-tile{position:absolute;display:flex;align-items:center;justify-content:center;border-radius:9px;cursor:pointer;
      transition:left .13s cubic-bezier(.4,0,.2,1),top .2s cubic-bezier(.3,0,.2,1),transform .12s ease,opacity .12s ease;}
    .m3-tile.sel{box-shadow:0 0 0 2px var(--gold-bright),0 0 14px rgba(232,195,74,.55);transform:scale(1.06);z-index:5;}
    .m3-tile.pop{transform:scale(.35);opacity:0;}
    .m3-tile.spawnIn{opacity:0;transform:scale(.55);}
    .m3-tile.special::after{content:"";position:absolute;inset:3px;border-radius:7px;pointer-events:none;
      border:2px solid rgba(255,255,255,.85);box-shadow:0 0 8px rgba(255,255,255,.55) inset;}
    .m3-tile .m3-sp{position:absolute;right:3px;bottom:1px;font-size:.4em;line-height:1;font-weight:800;color:#fff;text-shadow:0 0 3px #000,0 0 6px #000;pointer-events:none;}
    .m3-tile.sp-wild{background:conic-gradient(from 0deg,#e8c468,#d1547e,#5b6fd1,#2f8f8a,#5c8a3a,#e8c468);animation:m3wild 2.2s ease-in-out infinite;}
    @keyframes m3wild{0%,100%{box-shadow:0 0 6px rgba(232,196,104,.6);filter:hue-rotate(0deg)}50%{box-shadow:0 0 14px rgba(255,255,255,.85);filter:hue-rotate(40deg)}}
    .m3-tile.hint{animation:m3hint .85s ease-in-out infinite;z-index:4;}
    @keyframes m3hint{0%,100%{transform:scale(1);filter:brightness(1)}50%{transform:scale(1.13);filter:brightness(1.5)}}
    .m3-timepop{display:inline-block;margin-left:6px;color:var(--gold-bright);font-weight:700;opacity:0;transition:opacity .2s ease;}
    .m3-timepop.show{opacity:1;}
    .m3-timerbar.over>i{background:linear-gradient(90deg,var(--gold-bright),#fff6d8);}
    .m3-buffchip{display:inline-block;margin:2px 0 0;padding:3px 12px;border-radius:999px;font-size:12px;color:var(--gold-bright);border:1px solid var(--gold);background:rgba(201,162,74,.1);}
    .m3-draw{width:100%;padding:8px 6px;text-align:center;}
    .m3-draw-title{font-family:Cinzel,serif;font-size:12px;letter-spacing:.5px;color:var(--gold-bright);margin-bottom:8px;}
    .m3-draw-cards{display:flex;gap:6px;justify-content:center;}
    .m3-bcard{flex:1 1 0;max-width:106px;min-width:0;border:1px solid var(--gold);border-radius:10px;overflow:hidden;cursor:pointer;padding-bottom:6px;
      background:linear-gradient(170deg,rgba(48,26,70,.97),rgba(18,10,28,.98));transition:transform .15s ease,box-shadow .15s ease;}
    .m3-bcard:hover,.m3-bcard:active{transform:translateY(-4px);box-shadow:0 0 16px rgba(232,196,104,.55);}
    .m3-bcard-art{position:relative;width:100%;aspect-ratio:3/4;background-size:cover;background-position:center top;background-color:rgba(0,0,0,.4);}
    .m3-bcard-art span{position:absolute;left:3px;top:2px;font-size:15px;filter:drop-shadow(0 0 3px #000);}
    .m3-bcard-name{font-family:Cinzel,serif;font-size:11px;color:var(--gold-bright);margin:5px 2px 2px;}
    .m3-bcard-desc{font-size:10.5px;line-height:1.3;color:var(--cream);padding:0 4px;}
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
  el.className = "m3-tile m3-t" + tile.type + (tile.special ? " special sp-" + tile.special : "");
  const { left, top } = cellXY(cell);
  el.style.left = left + "px"; el.style.top = top + "px";
  el.style.width = (st.tileSize - 4) + "px"; el.style.height = (st.tileSize - 4) + "px";
  el.style.fontSize = Math.round(st.tileSize * 0.5) + "px";
  if (tile.special === "wild") {
    el.textContent = "🃏";      // 愚者
  } else {
    el.textContent = ICONS[tile.type];
    if (tile.special) { const b = document.createElement("b"); b.className = "m3-sp"; b.textContent = SP_GLYPH[tile.special] || ""; el.appendChild(b); }
  }
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
  const el = document.getElementById("m3-combo"); if (!el) return;
  el.textContent = text; el.classList.add("show");
  clearTimeout(showCombo._t); showCombo._t = setTimeout(() => el.classList.remove("show"), 850);
}
function clearHint() {
  st.hintCells = null;
  Object.values(st.els).forEach(el => el.classList.remove("hint"));
}
function maybeShowHint() {
  if (!st.running || st.busy || st.hintCells || !st.board) return;
  if (Date.now() - st.lastActionAt < HINT_IDLE_MS) return;
  const mv = findHintMove(st.board);
  if (!mv) return;
  st.hintCells = mv;
  mv.forEach(cell => { const t = st.board[cell]; if (t && st.els[t.id]) st.els[t.id].classList.add("hint"); });
}
function updateTimerUI() {
  const timeEl = document.getElementById("m3-time"), fillEl = document.getElementById("m3-timerfill"), barEl = document.getElementById("m3-timerbar");
  const t = Math.max(0, st.timeLeft);
  if (timeEl) timeEl.textContent = t;
  if (fillEl) fillEl.style.width = Math.min(100, (t / 60) * 100) + "%";
  if (barEl) { barEl.classList.toggle("low", t <= 10); barEl.classList.toggle("over", t > 60); }
}
function addTime(sec) {
  const before = st.timeLeft;
  st.timeLeft = Math.min(TIME_CAP, st.timeLeft + sec);
  const gained = st.timeLeft - before;
  updateTimerUI();
  if (gained > 0) {
    st.timeBonusTotal += gained;
    sfxTime();
    const pop = document.getElementById("m3-timepop");
    if (pop) { pop.textContent = "+" + gained + "s"; pop.classList.add("show"); clearTimeout(addTime._t); addTime._t = setTimeout(() => pop.classList.remove("show"), 900); }
  }
}

async function animateWave(e, boardEl, prevBoard, wave) {
  wave.clearedCells.forEach(cell => { const t = prevBoard[cell]; if (t && st.els[t.id]) st.els[t.id].classList.add("pop"); });
  if (wave.cleared > 0) sfxMatch(wave.wave);
  if (wave.specials > 0 || wave.forced) sfxSpecial();
  const tt = wave.timeBonus > 0 ? ` ⏱+${wave.timeBonus}` : "";
  if (wave.forced) showCombo(e, dc(`✨ 特殊組合！+${wave.gold}${tt}`, `✨ Special combo! +${wave.gold}${tt}`));
  else if (wave.wave > 1) { showCombo(e, dc(`連鎖 x${wave.mult.toFixed(1)}！+${wave.gold}${tt}`, `Chain x${wave.mult.toFixed(1)}! +${wave.gold}${tt}`)); sfxChainBonus(); }
  else if (wave.cleared > 0) showCombo(e, "+" + wave.gold + tt);
  await sleep(POP_MS);
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
  await sleep(FALL_MS);
}

// 播完一次交換（或高塔）產生的所有波次，並結算金幣／時間獎勵。pre = 消除前（交換後）的盤面快照，第一波的消除動畫要靠它找方塊。
async function playResult(e, boardEl, res, pre) {
  let snapshot = pre;
  for (const wave of res.waves) {
    await animateWave(e, boardEl, snapshot, wave);
    snapshot = wave.afterBoard;
    if (wave.mult > st.bestMult) st.bestMult = wave.mult;
  }
  st.gold += res.totalGold; st.cleared += res.totalCleared;
  st.board = res.board;
  const goldEl = document.getElementById("m3-gold"); if (goldEl) goldEl.textContent = st.gold.toLocaleString();
  if (res.totalTime > 0 && st.running) addTime(res.totalTime);
  if (res.reshuffled) { renderFull(boardEl); showCombo(e, dc("盤面卡住，已重新洗牌", "Board stuck, reshuffled")); await sleep(200); }
}

async function doSwap(e, boardEl, a2, b2) {
  if (st.busy || !st.running || !st.board) return;
  const ta = st.board[a2], tb = st.board[b2];
  if (!ta || !tb) return;
  st.busy = true; clearHint(); st.lastActionAt = Date.now();
  st.selected = null; setSelectedVisual(null);
  const posA = cellXY(b2), posB = cellXY(a2);
  if (st.els[ta.id]) { st.els[ta.id].style.left = posA.left + "px"; st.els[ta.id].style.top = posA.top + "px"; }
  if (st.els[tb.id]) { st.els[tb.id].style.left = posB.left + "px"; st.els[tb.id].style.top = posB.top + "px"; }
  await sleep(SWAP_MS);
  const pre = st.board.slice(); pre[a2] = tb; pre[b2] = ta;      // 交換後、消除前的盤面
  const res = resolveSwap(st.board, st.nextId, a2, b2, st.rng, st.opts);
  st.nextId = res.nextId;
  if (res.invalid) {
    if (st.els[ta.id]) { st.els[ta.id].style.left = posB.left + "px"; st.els[ta.id].style.top = posB.top + "px"; }
    if (st.els[tb.id]) { st.els[tb.id].style.left = posA.left + "px"; st.els[tb.id].style.top = posA.top + "px"; }
    await sleep(SWAP_MS);
    st.busy = false; st.lastActionAt = Date.now();
    return;
  }
  await playResult(e, boardEl, res, pre);
  st.busy = false; st.lastActionAt = Date.now();
  maybeRunBlast(e);
}

// 點選：先點一格、再點相鄰的一格就交換
function onTileClick(e, boardEl, cell) {
  if (st.busy || !st.running) return;
  st.lastActionAt = Date.now(); clearHint();
  if (st.selected == null) { st.selected = cell; setSelectedVisual(cell); return; }
  if (st.selected === cell) { st.selected = null; setSelectedVisual(null); return; }
  const r1 = Math.floor(st.selected / W), c1 = st.selected % W, r2 = Math.floor(cell / W), c2 = cell % W;
  if (Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) { st.selected = cell; setSelectedVisual(cell); return; }
  doSwap(e, boardEl, st.selected, cell);
}

// 滑動：手指（或滑鼠）按在方塊上往旁邊拖超過半格，就跟那個方向的鄰居交換；沒拖動就當成點選
function wireBoardInput(e, boardEl) {
  let down = null;
  const cellAt = (ev) => {
    const rect = boardEl.getBoundingClientRect();
    const col = Math.floor((ev.clientX - rect.left) / st.tileSize), row = Math.floor((ev.clientY - rect.top) / st.tileSize);
    return (col < 0 || col >= W || row < 0 || row >= H) ? -1 : row * W + col;
  };
  boardEl.addEventListener("pointerdown", ev => {
    if (st.busy || !st.running) return;
    const cell = cellAt(ev); if (cell < 0) return;
    clearHint(); st.lastActionAt = Date.now();
    down = { cell, x: ev.clientX, y: ev.clientY, id: ev.pointerId, done: false };
    try { boardEl.setPointerCapture(ev.pointerId); } catch (err) {}
  });
  boardEl.addEventListener("pointermove", ev => {
    if (!down || down.done || ev.pointerId !== down.id) return;
    const dx = ev.clientX - down.x, dy = ev.clientY - down.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < st.tileSize * 0.35) return;
    let r = Math.floor(down.cell / W), c = down.cell % W;
    if (Math.abs(dx) > Math.abs(dy)) c += dx > 0 ? 1 : -1; else r += dy > 0 ? 1 : -1;
    down.done = true;
    if (!inB(r, c)) return;
    doSwap(e, boardEl, down.cell, idx(r, c));
  });
  boardEl.addEventListener("pointerup", ev => {
    if (!down || ev.pointerId !== down.id) return;
    const d = down; down = null;
    if (d.done || st.busy || !st.running) return;
    const cell = cellAt(ev); if (cell < 0) return;
    onTileClick(e, boardEl, cell);
  });
  boardEl.addEventListener("pointercancel", () => { down = null; });
}

// 高塔：每 20 秒隨機炸一整行（先閃一下預警），後面照常連鎖，得分／時間獎勵一樣算
function maybeRunBlast(e) { if (st.pendingBlast && st.running && !st.busy) runBlast(e); }
async function runBlast(e) {
  const boardEl = document.getElementById("m3-board");
  st.pendingBlast = false;
  if (!boardEl || !st.board) return;
  st.busy = true; clearHint(); st.selected = null; setSelectedVisual(null);
  const row = Math.floor(Math.random() * H);
  for (let c = 0; c < W; c++) { const t = st.board[idx(row, c)]; if (t && st.els[t.id]) st.els[t.id].classList.add("hint"); }
  showCombo(e, dc("⚡ 高塔降下！", "⚡ The Tower strikes!"));
  await sleep(450);
  clearHint();
  const pre = st.board.slice();
  const res = blastRow(st.board, st.nextId, row, st.rng, st.opts);
  st.nextId = res.nextId;
  await playResult(e, boardEl, res, pre);
  st.busy = false; st.lastActionAt = Date.now();
}

function tickTimer(e) {
  if (!st.running) return;
  st.timeLeft -= 1; st.elapsed += 1;
  updateTimerUI();
  if (st.timeLeft <= 0 || st.elapsed >= MAX_ROUND_SEC) { endRound(e); return; }
  if (st.buff && st.buff.tower && st.elapsed % 20 === 0) st.pendingBlast = true;
  maybeRunBlast(e);
  maybeShowHint();
}

function startRound(e, buff) {
  const boardEl = document.getElementById("m3-board"); if (!boardEl) return;
  st.buff = buff || null;
  st.opts = buff && buff.opts ? Object.assign({}, buff.opts) : {};
  st.gold = 0; st.cleared = 0; st.bestMult = 1; st.timeBonusTotal = 0;
  st.timeLeft = 60 + ((buff && buff.addTime) || 0); st.elapsed = 0;
  st.selected = null; st.busy = false; st.running = true; st.pendingBlast = false; st.hintCells = null;
  st.startedAt = Date.now(); st.lastActionAt = Date.now();
  layout(boardEl);
  st.rng = mulberry32((Date.now() ^ Math.floor(Math.random() * 1e9)) & 0xffffffff);
  const fresh = freshBoard(st.rng);
  st.board = fresh.board; st.nextId = fresh.nextId;
  if (buff && buff.startWilds) {
    // 魔術師：開局送愚者（挑不重複的格子，直接換掉原本那格）
    const used = new Set();
    for (let i = 0; i < buff.startWilds; i++) {
      let cell; do { cell = Math.floor(st.rng() * W * H); } while (used.has(cell));
      used.add(cell);
      st.board[cell] = { id: st.nextId++, type: WILD, special: "wild" };
    }
  }
  renderFull(boardEl);
  const startOv = document.getElementById("m3-startov"); if (startOv) startOv.style.display = "none";
  const resOv = document.getElementById("m3-resultov"); if (resOv) resOv.classList.remove("show");
  const goldEl = document.getElementById("m3-gold"); if (goldEl) goldEl.textContent = "0";
  updateTimerUI(); updateBuffChip();
  clearInterval(st.timerHandle);
  st.timerHandle = setInterval(() => tickTimer(e), 1000);
}

// 開局抽牌：隨機抽 3 張大牌，玩家選 1 張帶進這局（還沒選之前不扣次數、計時也還沒開始）
function showDraw(e) {
  const ov = document.getElementById("m3-startov"); if (!ov) return;
  const pool = BUFFS.slice();
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
  const picks = pool.slice(0, 3);
  ov.style.display = "flex"; ov.style.background = "rgba(15,8,20,.9)";
  ov.innerHTML = `<div class="m3-draw"><div class="m3-draw-title">${dc("🔮 抽到三張牌，選一張帶進這局", "🔮 Three cards drawn — pick one for this round")}</div>
    <div class="m3-draw-cards">${picks.map(b => `<div class="m3-bcard" role="button" data-m3-buff="${b.id}">
      <div class="m3-bcard-art" style="background-image:url('${buffArtUrl(b)}')"><span>${b.icon}</span></div>
      <div class="m3-bcard-name">${b.num} ${dc(b.zh, b.en)}</div><div class="m3-bcard-desc">${dc(b.dzh, b.den)}</div></div>`).join("")}</div></div>`;
  ov.querySelectorAll("[data-m3-buff]").forEach(el => { el.onclick = () => startRound(e, buffById(el.dataset.m3Buff)); });
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
  clearHint();
  for (let i = 0; i < 60 && st.busy; i++) await sleep(50);   // 等最後一步動畫跑完，這步的金幣才不會漏算
  const elapsedSeconds = Math.max(1, Math.round((Date.now() - st.startedAt) / 1000));
  const raw = { gold: st.gold, cleared: st.cleared, bestMult: st.bestMult, elapsedSeconds, buff: st.buff ? st.buff.id : null };
  st.buff = null; updateBuffChip();
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
    ${(() => { const bf = raw && raw.buff ? buffById(raw.buff) : null; return bf ? `<p class="gres-sub">${bf.icon} ${bf.num} ${dc(bf.zh, bf.en)}</p>` : ""; })()}
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
  return `<div class="m3-legend">${ICONS.map((ic, i) => `<span><i class="m3-t${i}"></i>${ic} ${tarotName(i)}</span>`).join("")}</div>
  <div class="m3-legend"><span>↔ ${dc("清整行", "row")}</span><span>↕ ${dc("清整列", "column")}</span><span>✚ ${dc("清十字", "cross")}</span><span>🃏 ${dc("愚者・萬能", "Fool · wild")}</span></div>`;
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
    <p class="sub">${dc(`每局先抽 3 張大牌選 1 張加成，再用滑動（或點兩下）交換相鄰方塊，湊 3 個以上同圖案消除；4 消清整行／整列，L／T 型清十字，筆直 5 連會變成「愚者」🃏——跟任何方塊交換就清掉全盤那個花色，兩個特殊方塊交換還會組合。4 消、5 消、4 連鎖以上都會加時間（最多 90 秒）；連鎖（一次交換引發的每一波消除）獎勵會往上加成。免費玩，每天 5 次，獎勵金幣＋成品（藥水／武器／飾品／家具，小型為主偶爾中型）。`, `Pick 1 of 3 tarot cards for a bonus, then swipe (or tap twice) to swap adjacent tiles and match 3+. A 4-match clears its row/column, an L/T-shape clears a cross, and a straight 5 becomes the Fool 🃏 — swap it with any tile to wipe that suit off the board; two specials combine. 4-matches, 5-matches and 4+ chains add time (max 90s). Each chain wave pays out more. Free to play, 5 times a day, rewards coins + crafted items (potions/weapons/accessories/furniture, mostly small tier with occasional medium).`)}</p>
    ${champion ? `<p class="who">${dc("今日封號", "Today's title")}: ${Ys("match3Champion", 13)} ${Iu(champion)}</p>` : ""}
    <div class="stats" style="display:flex;align-items:center;justify-content:space-between;margin:10px 2px 4px;font-size:14px;">
      <div>✦ <b id="m3-gold">${st.gold}</b> ${dc("金幣", "coins")}</div>
      <div>⏱ <span id="m3-time">60</span> ${dc("秒", "s")}<span id="m3-timepop" class="m3-timepop"></span></div>
    </div>
    <div class="m3-timerbar" id="m3-timerbar"><i id="m3-timerfill" style="width:100%"></i></div>
    <div id="m3-buff" style="min-height:22px;text-align:center;">${buffChipHtml()}</div>
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
  const resOv = document.getElementById("m3-resultov"); if (resOv) resOv.classList.remove("show");
  showDraw(e);     // 先抽牌；選好牌才開始計時
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
    wireBoardInput(e, boardEl);
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