
/* ===== 🎮 小遊戲總開關 — end ===== */

/* ===== ⚗️ 煉金藥水排序 — 每次開局隨機出題（每場不同）、比最快通關時間；速度階梯獎勵、每日次數、排行榜與封號都比照 2048／塔羅三消 ===== */
const GPOT = (function () {
const CAP = 4, NCOL = 7, NEMPTY = 2, MAX_MOVES = 300;
// [名稱, 顏色, 色盲輔助符號]
const POTS = [["火", "#e5484d", "▲"], ["水", "#3b82f6", "●"], ["風", "#22c7b8", "≋"], ["土", "#a9703c", "■"], ["星", "#f2c230", "✦"], ["毒", "#79c943", "✕"], ["暮", "#9b5de5", "☾"]];

/* ===== 規則（出題、倒藥水、驗證通關）：客戶端跟結算驗證共用同一套，結算時會用玩家送上來的步驟在「當天題目」上重播一次 ===== */
const isFull = t => t.length === CAP && t.every(v => v === t[0]);
const solved = ts => ts.every(t => !t.length || isFull(t));
const clone = ts => ts.map(x => x.slice());
function canPour(ts, i, j) {
  if (i === j) return false;
  const a = ts[i], b = ts[j];
  if (!a || !b || !a.length || b.length >= CAP) return false;
  return !b.length || b[b.length - 1] === a[a.length - 1];
}
function pour(ts, i, j) {
  const a = ts[i], b = ts[j], c = a[a.length - 1];
  let k = 0;
  while (a.length && a[a.length - 1] === c && b.length < CAP) { b.push(a.pop()); k++; }
  return k;
}
function listMoves(ts) {
  const m = [];
  for (let i = 0; i < ts.length; i++) {
    const a = ts[i]; if (!a.length) continue;
    const c = a[a.length - 1], uni = a.every(x => x === c);
    for (let j = 0; j < ts.length; j++) {
      if (i === j) continue;
      const b = ts[j];
      if (b.length >= CAP) continue;
      if (b.length && b[b.length - 1] !== c) continue;
      if (!b.length && uni) continue;
      m.push([i, j]);
    }
  }
  return m;
}
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function seedOf(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
// 解題器只用「節點數」當上限（不看時間），所以任何裝置、任何速度算出來的當天題目都一模一樣。
function solvable(t0) {
  const seen = new Set(); let n = 0;
  const key = ts => ts.map(x => x.join("")).sort().join("|");
  const dfs = ts => {
    if (solved(ts)) return true;
    if (++n > 6000) return false;
    const k = key(ts); if (seen.has(k)) return false; seen.add(k);
    const ms = listMoves(ts).sort((p, q) => (ts[q[1]].length > 0) - (ts[p[1]].length > 0));
    for (const [i, j] of ms) { const u = clone(ts); pour(u, i, j); if (dfs(u)) return true; }
    return false;
  };
  return dfs(clone(t0));
}
const puzzleCache = {};
function genDaily(dateKey, nonce) {
  // nonce：每次開局抽的隨機數（存在 potionRun 裡，結算時伺服器用同一個 nonce 重播驗證）；舊紀錄沒有 nonce 就退回「當天固定題」
  const ck = nonce == null ? dateKey : dateKey + ":" + nonce;
  if (puzzleCache[ck]) return clone(puzzleCache[ck]);
  const r = mulberry(seedOf("potion:" + ck));
  let ts = null;
  for (let a = 0; a < 300; a++) {
    const u = []; for (let c = 0; c < NCOL; c++) for (let k = 0; k < CAP; k++) u.push(c);
    for (let i = u.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; [u[i], u[j]] = [u[j], u[i]]; }
    ts = []; for (let c = 0; c < NCOL; c++) ts.push(u.slice(c * CAP, c * CAP + CAP));
    for (let e = 0; e < NEMPTY; e++) ts.push([]);
    if (ts.some(isFull)) continue;
    if (solvable(ts)) { puzzleCache[ck] = clone(ts); return clone(ts); }
  }
  ts.push([]); // 理論上不會走到：300 次都無解時，固定多給一個空瓶（一樣是確定性的）
  puzzleCache[ck] = clone(ts);
  return clone(ts);
}
function replayOk(ts0, mv) {
  if (!Array.isArray(mv) || !mv.length || mv.length > MAX_MOVES) return false;
  const ts = clone(ts0);
  for (const m of mv) {
    if (!Array.isArray(m) || m.length !== 2) return false;
    const i = m[0], j = m[1];
    if (!Number.isInteger(i) || !Number.isInteger(j) || i < 0 || j < 0 || i >= ts.length || j >= ts.length) return false;
    if (!canPour(ts, i, j)) return false;
    pour(ts, i, j);
  }
  return solved(ts);
}

/* ===== 玩法設定（GM 可調）與每日次數：跟 2048／三消同一套模式（目前固定每人每天 3 次）===== */
let RANK_SHARDS = [2, 1, 1];   // 每日排行榜第 1／2／3 名的神秘碎片數（GM 可調）
let DAILY_PLAYS = 3, BASE_GOLD = 500, MAX_RUN_SEC = 600, MIN_MS_PER_MOVE = 300, GOLD_PER_ITEM_ROLL = 300, ITEM_MEDIUM_CHANCE = 0.18;
// 速度階梯：通關秒數 ≤ sec 就拿基礎金幣 +pct%（取最快的那一檔）；超過最後一檔只拿基礎金幣
let TIERS = [{ sec: 20, pct: 100 }, { sec: 40, pct: 60 }, { sec: 60, pct: 30 }];
function settingsKey() { return "config:potion_settings"; }
async function loadSettings() {
  try {
    const r = await a.get(settingsKey());
    if (r) {
      const t = JSON.parse(r.value);
      if (typeof t.dailyPlays === "number" && t.dailyPlays > 0) DAILY_PLAYS = Math.round(t.dailyPlays);
      if (typeof t.baseGold === "number" && t.baseGold >= 0) BASE_GOLD = t.baseGold;
      if (typeof t.maxRunSec === "number" && t.maxRunSec >= 60) MAX_RUN_SEC = t.maxRunSec;
      if (typeof t.minMsPerMove === "number" && t.minMsPerMove >= 0) MIN_MS_PER_MOVE = t.minMsPerMove;
      if (typeof t.goldPerItemRoll === "number" && t.goldPerItemRoll > 0) GOLD_PER_ITEM_ROLL = t.goldPerItemRoll;
      if (typeof t.itemMediumChance === "number" && t.itemMediumChance >= 0 && t.itemMediumChance <= 1) ITEM_MEDIUM_CHANCE = t.itemMediumChance;
      if (t.rankShards) RANK_SHARDS = rankShardParse(t.rankShards, RANK_SHARDS);
      if (Array.isArray(t.tiers) && t.tiers.length && t.tiers.every(x => x && x.sec > 0 && x.pct >= 0)) TIERS = t.tiers.map(x => ({ sec: +x.sec, pct: +x.pct })).sort((p, q) => p.sec - q.sec);
    }
  } catch (e) {}
}
async function saveSettings() {
  await a.set(settingsKey(), JSON.stringify({ dailyPlays: DAILY_PLAYS, baseGold: BASE_GOLD, maxRunSec: MAX_RUN_SEC, minMsPerMove: MIN_MS_PER_MOVE, goldPerItemRoll: GOLD_PER_ITEM_ROLL, itemMediumChance: ITEM_MEDIUM_CHANCE, tiers: TIERS, rankShards: RANK_SHARDS }));
}
function playsCapFor(p) { return 5; }  // 所有人每天固定 5 次
function playsRemaining(p) {
  const cap = playsCapFor(p);
  if (!p) return cap;
  return p.potionPlaysDate === ys() ? Math.max(0, typeof p.potionPlaysLeft === "number" ? p.potionPlaysLeft : cap) : cap;
}
// 進行中的挑戰存在玩家資料（p.potionRun = {dateKey, startedAt, nonce}）：重新整理、換裝置都不會讓計時重置，也不會多扣或少扣次數。
function activeRun(p) {
  const r = p && p.potionRun;
  return r && r.dateKey && typeof r.startedAt === "number" && Date.now() - r.startedAt < MAX_RUN_SEC * 1000 ? r : null;
}
function tierFor(ms) {
  const sec = ms / 1000;
  for (const t of TIERS) if (sec <= t.sec) return t;
  return null;
}

/* ===== 成品掉落：跟 2048／三消同一套機率與成品池 ===== */
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

/* ===== 開局：扣 1 次並記下開始時間（CAS 寫玩家資料）。已有進行中的挑戰就直接接續，不重複扣次數 ===== */
async function claimStart() {
  if (!zl.nickname) return null;
  await loadSettings();
  let err = null, run = null, resumed = false;
  const fresh = await Wl(zl.nickname, p => {
    err = null; run = null; resumed = false;
    const today = ys();
    (p.potionPlaysDate === today && typeof p.potionPlaysLeft === "number") || (p.potionPlaysDate = today, p.potionPlaysLeft = playsCapFor(p));
    const cur = activeRun(p);
    if (cur) { run = cur; resumed = true; return; }
    if (p.potionPlaysLeft <= 0 && !ku()) { err = "noplays"; return; }
    ku() || (p.potionPlaysLeft -= 1);
    p.potionRun = { dateKey: today, startedAt: Date.now(), nonce: Math.floor(Math.random() * 4294967296) };
    run = p.potionRun;
  });
  if (!fresh) return null;
  if (err) return { ok: false, reason: err };
  zl.player = fresh;
  return { ok: true, run, resumed };
}

/* ===== 結算：時間以「開局時存下的 startedAt」計算（不是玩家自己回報），步驟在當天題目上重播驗證，才給獎勵與上榜 ===== */
async function claimReward(raw) {
  if (!zl.nickname) return null;
  await loadSettings();
  const mv = Array.isArray(raw && raw.moves) ? raw.moves : [];
  const giveUp = !!(raw && raw.giveUp);
  let err = null, granted = null;
  const fresh = await Wl(zl.nickname, p => {
    err = null; granted = null;
    const run = p.potionRun;
    if (!run || !run.dateKey || typeof run.startedAt !== "number") { err = "norun"; return; }
    p.potionRun = null;
    const elapsedMs = Date.now() - run.startedAt;
    if (giveUp) { err = "gaveup"; return; }
    if (elapsedMs > MAX_RUN_SEC * 1000) { err = "expired"; return; }
    if (!replayOk(genDaily(run.dateKey, run.nonce), mv)) { err = "invalid"; return; }
    if (elapsedMs < mv.length * MIN_MS_PER_MOVE) { err = "toofast"; return; }
    const tier = tierFor(elapsedMs);
    const gold = Math.floor(BASE_GOLD * (1 + (tier ? tier.pct : 0) / 100));
    p.coins = (p.coins || 0) + gold;
    if (typeof kt === "function") kt(p);
    const itemBag = rollItems(gold);
    if (Object.keys(itemBag).length) {
      p.professionItems = p.professionItems || {};
      for (const k of Object.keys(itemBag)) p.professionItems[k] = (p.professionItems[k] || 0) + itemBag[k];
    }
    granted = { gold, itemBag, tier, elapsedMs, moves: mv.length, dateKey: run.dateKey, playsLeft: typeof p.potionPlaysLeft === "number" ? p.potionPlaysLeft : 0 };
  });
  if (!fresh) return null;
  zl.player = fresh;
  { const c = document.getElementById("player-coin"); if (c) c.textContent = "✦ " + fmtCoin(fresh.coins); } // 只更新金幣顯示，不整頁重畫（整頁重畫會讓結算彈窗與分頁按鈕失效）
  if (err) return { ok: false, reason: err };
  if (granted) { try { await submitDailyScore(zl.nickname, granted.elapsedMs, granted.moves, granted.dateKey); st.standingsFor = null; } catch (e) {} }
  return { ok: true, ...granted };
}

/* ===== 每日排行榜（每人每天一筆，取當天「最快通關時間」；同秒比步數少、再比誰先達成）===== */
function scoreKey(dateKey, nick) { return `potion_daily_score:${dateKey}:${(nick || "").toLowerCase()}`; }
async function submitDailyScore(nick, ms, moves, dateKey) {
  if (!nick || !(ms > 0)) return null;
  const empty = JSON.stringify({ ms: 0, moves: 0, lastAt: 0, nick: "" });
  const raw = await Vl(scoreKey(dateKey || ys(), nick), t => {
    const s = t ? JSON.parse(t) : { ms: 0, moves: 0, lastAt: 0, nick: "" };
    if (!(s.ms > 0) || ms < s.ms) { s.ms = ms; s.moves = moves; s.lastAt = Date.now(); s.nick = nick; }
    return JSON.stringify(s);
  }, empty);
  return raw ? JSON.parse(raw) : null;
}
async function getStandings(dateKey) {
  let entries = [];
  const prefix = `potion_daily_score:${dateKey}:`;
  try { entries = await a.listValues(prefix); } catch (e) { entries = []; }
  return entries.map(e => {
    let d = null; try { d = JSON.parse(e.value); } catch (err) {}
    if (!d) return null;
    return { nick: d.nick || e.key.slice(prefix.length), ms: d.ms || 0, moves: d.moves || 0, lastAt: d.lastAt || 0 };
  }).filter(Boolean).filter(p => p.ms > 0).sort((a2, b2) => a2.ms - b2.ms || a2.moves - b2.moves || a2.lastAt - b2.lastAt);
}

/* ===== 封號「煉金大師」：每天結算一次（等進入新的一天再結算昨天，第一名＝最快時間）===== */
function settledKey(dateKey) { return `config:potion_round_settle:${dateKey}`; }
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
    try { await rankShardPayout("potion", dateKey, list, RANK_SHARDS); } catch (e) {}   // 前三名發神秘碎片
    if (list.length) { await setTitleHolder("potionChampion", list[0].nick); return list[0].nick; }
  } catch (e) {}
  return null;
}
async function ensureYesterdaySettled() {
  try { await settleRound(ys(Date.now() - 864e5)); } catch (e) {}
}

/* ===== UI ===== */
const st = {
  ts: null, puzzle: null, sel: -1, hist: [], moves: [], running: false, busy: false, startedAt: 0, dateKey: "", timerHandle: null,
  result: null, // 結算彈窗的內容存在狀態裡（{loading:true} 或 {res}），任何整頁重畫都會照著它重新畫出彈窗，直到玩家自己按關閉
  standings: null, standingsFor: null, loaded: false
};
function ensureStyles() {
  if (document.getElementById("potion-styles")) return;
  const style = document.createElement("style");
  style.id = "potion-styles";
  style.textContent = `
    .pot-boardwrap{position:relative;max-width:340px;margin:0 auto;}
    .pot-board{display:flex;flex-wrap:wrap;justify-content:center;gap:24px 12px;padding:22px 8px 14px;border-radius:12px;background:rgba(0,0,0,.28);border:1px solid var(--line);user-select:none;-webkit-user-select:none;touch-action:manipulation;}
    .pot-tube{appearance:none;position:relative;width:44px;min-width:0;height:150px;min-height:0;padding:0;margin:0;background:rgba(255,255,255,.06);border:2px solid var(--line);border-radius:8px 8px 22px 22px;cursor:pointer;transition:transform .15s,box-shadow .2s;}
    .pot-tube::before{content:"";position:absolute;top:-9px;left:50%;transform:translateX(-50%);width:26px;height:8px;border-radius:3px 3px 0 0;background:#b98a52;}
    .pot-tube.sel{transform:translateY(-14px);border-color:var(--gold-bright);box-shadow:0 0 0 2px var(--gold-bright);}
    .pot-tube.done{border-color:var(--gold-bright);box-shadow:0 0 12px rgba(232,196,104,.5);}
    .pot-tube:focus-visible{outline:3px solid var(--gold-bright);outline-offset:3px;}
    .pot-liq{position:absolute;inset:3px;display:flex;flex-direction:column-reverse;gap:2px;overflow:hidden;border-radius:6px 6px 18px 18px;}
    .pot-liq i{flex:0 0 32px;display:grid;place-items:center;border-radius:6px;font-style:normal;font-size:12px;color:rgba(0,0,0,.45);box-shadow:inset 0 3px 5px rgba(255,255,255,.3);}
    #pot-startov{position:absolute;inset:0;z-index:15;display:flex;align-items:center;justify-content:center;border-radius:12px;background:rgba(15,8,20,.62);}
    #pot-resultov{position:absolute;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;background:rgba(15,8,20,.78);border-radius:12px;opacity:0;pointer-events:none;transition:opacity .22s ease;}
    #pot-resultov.show{opacity:1;pointer-events:auto;}
    .pot-card{width:88%;max-width:300px;background:linear-gradient(165deg,rgba(48,26,70,.97),rgba(18,10,28,.98));border:1px solid var(--gold-bright);border-radius:16px;padding:22px 18px 18px;box-shadow:0 0 34px rgba(139,63,214,.4),0 14px 40px rgba(0,0,0,.55);text-align:center;}
    .pot-title{font-family:Cinzel,serif;font-size:15px;font-weight:700;letter-spacing:1.5px;color:var(--gold-bright);margin-bottom:10px;text-shadow:0 0 10px rgba(232,196,104,.4);}
    .pot-time{font-family:'Space Mono',monospace;font-size:30px;font-weight:800;color:var(--cream);margin-bottom:2px;}
    .pot-amount{font-family:'Space Mono',monospace;font-size:24px;font-weight:800;color:var(--gold-bright);margin:6px 0;text-shadow:0 0 16px rgba(232,196,104,.55);}
    .pot-sub{font-size:12px;color:var(--muted);margin:0 0 4px;}
    .pot-chips{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:10px 0 6px;}
    .pot-chip{background:rgba(255,255,255,.05);border:1px solid var(--gold);border-radius:999px;padding:5px 12px;font-size:12px;color:var(--cream);white-space:nowrap;}
    .pot-actions{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:8px 0 2px;}
    @media (prefers-reduced-motion:reduce){.pot-tube{transition:none;}}
  `;
  document.head.appendChild(style);
}
const fmtSec = ms => (ms / 1000).toFixed(1);
const fmtSec2 = ms => (ms / 1000).toFixed(2);
function tubeLabel(tu, i) {
  return dc(`第${i + 1}瓶`, `Tube ${i + 1}`) + (tu.length ? dc("，由下往上：", ", bottom to top: ") + tu.map(c => POTS[c][0]).join("、") : dc("，空瓶", ", empty"));
}
function tubesHtml() {
  const ts = st.running && st.ts ? st.ts : Array.from({ length: NCOL + NEMPTY }, () => []);
  return ts.map((tu, i) => `<button type="button" class="pot-tube${st.sel === i ? " sel" : ""}${isFull(tu) ? " done" : ""}" data-i="${i}" aria-label="${tubeLabel(tu, i)}"><div class="pot-liq">${tu.map(c => `<i style="background:${POTS[c][1]};">${POTS[c][2]}</i>`).join("")}</div></button>`).join("");
}
function boardHtml() {
  const p = zl.player, left = playsRemaining(p), resume = !st.running && !!activeRun(p);
  return `<div class="pot-boardwrap" id="pot-boardwrap">
    <div class="pot-board" id="pot-board">${tubesHtml()}</div>
    <div id="pot-startov" style="display:${st.running ? "none" : "flex"};">
      <button class="btn" id="pot-start-btn" ${left <= 0 && !ku() && !resume ? "disabled" : ""}>${resume ? dc("▶️ 繼續挑戰（計時進行中）", "▶️ Resume (timer running)") : dc("⚗️ 開始挑戰", "⚗️ Start Challenge")}</button>
    </div>
    <div id="pot-resultov" class="${st.result ? "show" : ""}"><div class="pot-card" id="pot-res-body">${resultInnerHtml()}</div></div>
  </div>`;
}
// 找目前「真的還在畫面上」的結算彈窗容器，避免結算中途切走分頁時寫進已經被拔掉的舊節點。
function liveRoot() {
  const ov = document.getElementById("pot-resultov");
  return ov && ov.isConnected ? ov : null;
}
function tierLine(tier) {
  return tier ? dc(`⚡ ${tier.sec} 秒內通關　速度加成 +${tier.pct}%`, `⚡ Cleared within ${tier.sec}s · speed bonus +${tier.pct}%`) : dc("超過速度門檻，只有基礎獎勵", "Over the speed tiers — base reward only");
}
function resultBodyHtml(res) {
  if (!res || res.ok === false) {
    const reason = res && res.reason;
    const msg = reason === "gaveup" ? dc("你放棄了這局，這次的次數已用掉。", "You gave up this run; the play has been used.")
      : reason === "expired" ? dc("超過時間上限，這局作廢。", "Time limit exceeded — this run is void.")
      : reason === "toofast" ? dc("這局的操作速度不合理，沒有計入。", "That run's pace wasn't plausible and wasn't counted.")
      : reason === "invalid" ? dc("這局的步驟驗證沒通過，沒有計入。", "This run's moves failed verification and wasn't counted.")
      : reason === "norun" ? dc("找不到進行中的挑戰（可能已在別處結算）。", "No active run found (it may have been settled elsewhere).")
      : dc("結算失敗，請稍後再試", "Settlement failed, please try again");
    return `<div class="pot-title">${dc("這局沒有獎勵", "No reward this run")}</div><p class="pot-sub">${msg}</p>
      <div class="pot-actions"><button class="btn small secondary" id="pot-cancel-btn">${dc("關閉", "Close")}</button></div>`;
  }
  const itemChips = Object.keys(res.itemBag || {}).map(id => {
    const lbl = itemLabel(id);
    return `<span class="pot-chip">${lbl.icon} ${Iu(lbl.name)} ×${res.itemBag[id]}</span>`;
  }).join("");
  return `<div class="pot-title">${dc("煉成了！", "Brewed!")}</div>
    <div class="pot-time">${fmtSec2(res.elapsedMs)}<span style="font-size:14px;"> ${dc("秒", "s")}</span></div>
    <p class="pot-sub">${dc(`${res.moves} 步`, `${res.moves} moves`)}</p>
    <p class="pot-sub" style="color:var(--gold-bright);">${tierLine(res.tier)}</p>
    <div class="pot-amount">+${res.gold.toLocaleString()} ${dc("金幣", "coins")}</div>
    <div class="pot-chips">${itemChips || `<span class="pot-sub">${dc("這局沒有成品掉落", "No items dropped this round")}</span>`}</div>
    <p class="pot-sub">${dc(`今天還剩 ${res.playsLeft} 次`, `${res.playsLeft} plays left today`)}</p>
    <div class="pot-actions">
      <button class="btn small secondary" id="pot-cancel-btn" style="flex:1;">${dc("取消", "Cancel")}</button>
      <button class="btn" id="pot-again-btn" style="flex:1;">${dc("再玩一次", "Play Again")}</button>
    </div>`;
}
function resultInnerHtml() {
  if (!st.result) return "";
  return st.result.loading ? `<p class="pot-sub">${dc("結算中…", "Settling…")}</p>` : resultBodyHtml(st.result.res);
}
// 設定結算狀態，並同步畫到目前還在畫面上的彈窗（如果整頁剛好被重畫，之後的重畫也會從 st.result 還原）
function showResult(state) {
  st.result = state;
  const ov = liveRoot();
  if (!ov) return;
  const body = ov.querySelector("#pot-res-body");
  if (body) body.innerHTML = resultInnerHtml();
  ov.classList.add("show");
  if (state && !state.loading) wireResultOverlay();
}
function wireResultOverlay() {
  // 只重畫分頁內容（Bu），不整頁重畫（Eu）：Eu 會複製舊畫面並洗掉事件，造成按鈕失效。
  const cancelBtn = document.getElementById("pot-cancel-btn");
  if (cancelBtn) cancelBtn.onclick = () => { st.result = null; st.ts = null; Bu(); };
  const againBtn = document.getElementById("pot-again-btn");
  if (againBtn) againBtn.onclick = () => { st.result = null; st.ts = null; startRound(); };
}
function standingsHtml() {
  const list = st.standings || [];
  if (!list.length) return `<p class="empty-note">${dc("今天還沒有人通關過", "No one has cleared today's puzzle yet")}</p>`;
  return list.slice(0, 10).map((p, i) => `<div class="listing"><div class="left"><div class="icon-box">${i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "#" + (i + 1)}</div><div class="meta"><div>${Iu(p.nick)}${zl.nickname && p.nick.toLowerCase() === zl.nickname.toLowerCase() ? ` <span style="color:var(--gold-bright);">(${dc("你", "you")})</span>` : ""}</div><div class="sub">${dc(`${p.moves} 步`, `${p.moves} moves`)}</div></div></div><div class="right"><span class="price">${fmtSec2(p.ms)} ${dc("秒", "s")}</span></div></div>`).join("");
}
async function refreshStandings() {
  const key = ys();
  if (st.standingsFor === key && st.standings) return;
  st.standings = await getStandings(key);
  st.standingsFor = key;
}
function gmPanelHtml() {
  const t = i => TIERS[i] || { sec: 0, pct: 0 };
  return `<div class="panel">
    <h2>⚙️ ${dc("煉金藥水排序設定（GM）", "Alchemy Sort Settings (GM)")}</h2>
    <div class="form-row">
      <div><label>${dc("每日遊玩次數（已固定為 5，此欄位不再生效）", "Daily plays (fixed at 5, this field no longer applies)")}</label><input type="number" id="pot-gm-plays" value="${DAILY_PLAYS}" min="1" style="width:110px;" /></div>
      <div><label>${dc("通關基礎金幣", "Base gold per clear")}</label><input type="number" id="pot-gm-base" value="${BASE_GOLD}" min="0" style="width:110px;" /></div>
    </div>
    <div class="form-row">
      <div><label>${dc("速度第 1 檔：秒數／加成%", "Tier 1: seconds / bonus %")}</label><input type="number" id="pot-gm-t1s" value="${t(0).sec}" min="1" style="width:70px;" /> <input type="number" id="pot-gm-t1p" value="${t(0).pct}" min="0" style="width:70px;" /></div>
      <div><label>${dc("第 2 檔", "Tier 2")}</label><input type="number" id="pot-gm-t2s" value="${t(1).sec}" min="1" style="width:70px;" /> <input type="number" id="pot-gm-t2p" value="${t(1).pct}" min="0" style="width:70px;" /></div>
      <div><label>${dc("第 3 檔", "Tier 3")}</label><input type="number" id="pot-gm-t3s" value="${t(2).sec}" min="1" style="width:70px;" /> <input type="number" id="pot-gm-t3p" value="${t(2).pct}" min="0" style="width:70px;" /></div>
    </div>
    <div class="form-row">
      <div><label>${dc("單局時間上限（秒，超過作廢）", "Run time limit (s, void if exceeded)")}</label><input type="number" id="pot-gm-maxrun" value="${MAX_RUN_SEC}" min="60" style="width:110px;" /></div>
      <div><label>${dc("每步最短毫秒（防腳本）", "Min ms per move (anti-bot)")}</label><input type="number" id="pot-gm-minms" value="${MIN_MS_PER_MOVE}" min="0" style="width:110px;" /></div>
    </div>
    <div class="form-row">
      <div><label>${dc("每滾道具機率的金幣門檻", "Gold per item roll")}</label><input type="number" id="pot-gm-itemroll" value="${GOLD_PER_ITEM_ROLL}" min="1" style="width:110px;" /></div>
      <div><label>${dc("中型成品機率", "Medium item chance")}</label><input type="number" id="pot-gm-itemmed" value="${ITEM_MEDIUM_CHANCE}" min="0" max="1" step="0.01" style="width:100px;" /></div>
      ${rankShardGmHtml("pot", RANK_SHARDS)}
    </div>
    <div class="form-row"><button class="btn small" id="pot-gm-save-btn">${dc("儲存設定", "Save Settings")}</button></div>
  </div>`;
}
function tiersText() {
  return TIERS.map(t => dc(`${t.sec} 秒內 +${t.pct}%`, `≤${t.sec}s +${t.pct}%`)).join(dc("、", ", "));
}
function panelHtml() {
  const p = zl.player, left = playsRemaining(p), cap = playsCapFor(p), champion = Js.potionChampion;
  const elapsed = st.running ? Date.now() - st.startedAt : 0;
  return `<div class="panel">
    <h2>⚗️ ${dc("煉金藥水排序", "Alchemy Sort")}</h2>
    <p class="sub">${dc(`每天一道全服相同的題目（7 種藥水、2 個空瓶）：點一瓶取起最上層的藥水，再點要倒入的瓶子——目標瓶必須是空的或最上層同色，且還有空位；每瓶疊滿同一種顏色即完成。免費玩，每天 5 次，按下開始就會扣 1 次並開始計時。通關給基礎金幣＋成品，越快越多：${tiersText()}。`, `One puzzle a day, the same for everyone (7 potions, 2 empty tubes): tap a tube to lift its top potion, then tap where to pour — the target must be empty or have the same color on top, with room left. Fill every tube with one color to finish. Free to play, 5 times a day; starting uses 1 play and starts the clock. Clearing pays base coins + items, more the faster you are: ${tiersText()}.`)}</p>
    ${champion ? `<p class="who">${dc("今日封號", "Today's title")}: ${Ys("potionChampion", 13)} ${Iu(champion)}</p>` : ""}
    <div class="stats" style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin:10px 2px 4px;font-size:14px;">
      <div>⏱ <b id="pot-timer">${fmtSec(elapsed)}</b> ${dc("秒", "s")}</div>
      <div>${dc("步數", "Moves")} <b id="pot-moves">${st.moves.length}</b></div>
    </div>
    ${boardHtml()}
    <div class="pot-actions" id="pot-ctrl-row" style="display:${st.running ? "flex" : "none"};">
      <button class="btn small secondary" id="pot-undo-btn" ${st.hist.length ? "" : "disabled"}>${dc("復原", "Undo")}</button>
      <button class="btn small secondary" id="pot-reset-btn">${dc("重來（計時不停）", "Restart (clock keeps running)")}</button>
      <button class="btn small secondary" id="pot-giveup-btn">${dc("放棄", "Give up")}</button>
    </div>
    <p class="sub" style="text-align:center;margin-top:6px;">${dc(`今天剩餘次數：${left} / ${cap}`, `Plays left today: ${left} / ${cap}`)}</p>
  </div>
  <div class="panel">
    <h2>🏆 ${dc("今日排行榜（最快時間）", "Today's Leaderboard (fastest)")}</h2>
    <p class="sub">${dc("每人取當天最快的一次；明天結算出「煉金大師」封號。", "Each player's fastest clear today; the \"Alchemy Master\" title is settled tomorrow.")}</p><p class="sub">${rankShardHint(RANK_SHARDS)}</p>
    <div id="pot-standings-body">${standingsHtml()}</div>
  </div>
  ${ku() ? gmCollapsibleWrap(gmPanelHtml()) : ""}`;
}

function renderBoard() {
  const b = document.getElementById("pot-board");
  if (b) b.innerHTML = tubesHtml();
  const mv = document.getElementById("pot-moves"); if (mv) mv.textContent = st.moves.length;
  const un = document.getElementById("pot-undo-btn"); if (un) un.disabled = !st.hist.length;
}
function tap(i) {
  if (!st.running || st.busy || !st.ts) return;
  const t = st.ts;
  if (st.sel < 0) { if (t[i].length) st.sel = i; }
  else if (st.sel === i) st.sel = -1;
  else if (canPour(t, st.sel, i)) {
    if (st.moves.length >= MAX_MOVES) { ac(dc("步數已達上限，請按「重來」或「放棄」", "Move limit reached — restart or give up")); st.sel = -1; renderBoard(); return; }
    st.hist.push(clone(t));
    pour(t, st.sel, i);
    st.moves.push([st.sel, i]);
    st.sel = -1;
    if (solved(t)) { renderBoard(); finish(false); return; }
  } else st.sel = t[i].length ? i : -1;
  renderBoard();
}
function undo() {
  if (!st.running || st.busy || !st.hist.length) return;
  st.ts = st.hist.pop(); st.moves.pop(); st.sel = -1; renderBoard();
}
function restart() {
  if (!st.running || st.busy) return;
  st.ts = clone(st.puzzle); st.hist = []; st.moves = []; st.sel = -1; renderBoard();
}
function startTimer() {
  clearInterval(st.timerHandle);
  st.timerHandle = setInterval(() => {
    if (!st.running) { clearInterval(st.timerHandle); return; }
    const ms = Date.now() - st.startedAt;
    const el = document.getElementById("pot-timer"); if (el) el.textContent = fmtSec(ms);
    if (ms > MAX_RUN_SEC * 1000) finish(false);
  }, 100);
}
async function startRound() {
  if (st.busy) return;
  if (!(await mgFresh("potion"))) { ac(dc("煉金藥水排序目前由 GM 暫時關閉", "Alchemy Sort is temporarily closed by the GM")); Bu(); return; }
  st.busy = true;
  let r = null;
  try { r = await claimStart(); } catch (e) { r = null; }
  st.busy = false;
  if (!r) { ac(dc("開始失敗，請稍後再試", "Couldn't start, please try again")); return; }
  if (r.ok === false) {
    ac(r.reason === "noplays" ? dc("今天的煉金藥水次數已經用完了，明天再來吧！", "No Alchemy Sort plays left for today, come back tomorrow!") : dc("開始失敗，請稍後再試", "Couldn't start, please try again"));
    Bu(); return;
  }
  st.dateKey = r.run.dateKey; st.startedAt = r.run.startedAt;
  st.puzzle = genDaily(st.dateKey, r.run.nonce); st.ts = clone(st.puzzle);
  st.hist = []; st.moves = []; st.sel = -1; st.running = true;
  startTimer();
  Bu();
}
async function finish(giveUp) {
  if (st.busy) return;
  st.busy = true;
  st.running = false;
  clearInterval(st.timerHandle);
  const raw = { moves: st.moves.map(m => m.slice()), giveUp: !!giveUp };
  const ctrlRow = document.getElementById("pot-ctrl-row"); if (ctrlRow) ctrlRow.style.display = "none";
  try {
    showResult({ loading: true });
    let res; try { res = await claimReward(raw); } catch (err) { res = null; }
    showResult({ res });
    if (res && res.ok !== false) {
      const itemCount = Object.values(res.itemBag || {}).reduce((a2, b2) => a2 + b2, 0);
      ac(dc(`⚗️ 煉成！${fmtSec(res.elapsedMs)} 秒，+${res.gold.toLocaleString()} 金幣${itemCount ? `，獲得 ${itemCount} 件成品` : ""}`,
            `⚗️ Brewed! ${fmtSec(res.elapsedMs)}s, +${res.gold.toLocaleString()} coins${itemCount ? `, ${itemCount} item(s)` : ""}`), { legendary: !!(res.tier && res.tier === TIERS[0]) });
      st.standingsFor = null;
    }
  } catch (err) {
    showResult({ res: null });
    ac(dc("結算時發生錯誤，請稍後再試", "Something went wrong settling, please try again"));
  } finally { st.busy = false; }
}

function wireTab(e) {
  ensureStyles();
  const startBtn = e.querySelector("#pot-start-btn");
  if (startBtn) startBtn.onclick = () => startRound();
  const undoBtn = e.querySelector("#pot-undo-btn"); if (undoBtn) undoBtn.onclick = undo;
  const resetBtn = e.querySelector("#pot-reset-btn"); if (resetBtn) resetBtn.onclick = restart;
  const giveBtn = e.querySelector("#pot-giveup-btn");
  if (giveBtn) giveBtn.onclick = () => { if (window.confirm(dc("確定要放棄這局嗎？這次的次數不會退還，也沒有獎勵。", "Give up this run? The play won't be refunded and there's no reward."))) finish(true); };
  const boardEl = e.querySelector("#pot-board");
  if (boardEl) boardEl.onclick = ev => {
    const btn = ev.target.closest && ev.target.closest(".pot-tube");
    if (btn) tap(+btn.dataset.i);
  };
  if (st.result && !st.result.loading) wireResultOverlay();
  const gmSaveBtn = e.querySelector("#pot-gm-save-btn");
  if (gmSaveBtn) gmSaveBtn.onclick = async () => {
    const num = id => parseFloat(document.getElementById(id).value);
    const plays = parseInt(document.getElementById("pot-gm-plays").value, 10);
    const base = num("pot-gm-base"), maxRun = num("pot-gm-maxrun"), minMs = num("pot-gm-minms"), itemRoll = num("pot-gm-itemroll"), itemMed = num("pot-gm-itemmed");
    const tiers = [1, 2, 3].map(n => ({ sec: num(`pot-gm-t${n}s`), pct: num(`pot-gm-t${n}p`) })).filter(t => t.sec > 0 && t.pct >= 0).sort((p, q) => p.sec - q.sec);
    if (plays > 0) DAILY_PLAYS = plays;
    if (!isNaN(base) && base >= 0) BASE_GOLD = base;
    if (!isNaN(maxRun) && maxRun >= 60) MAX_RUN_SEC = maxRun;
    if (!isNaN(minMs) && minMs >= 0) MIN_MS_PER_MOVE = minMs;
    if (itemRoll > 0) GOLD_PER_ITEM_ROLL = itemRoll;
    if (!isNaN(itemMed) && itemMed >= 0 && itemMed <= 1) ITEM_MEDIUM_CHANCE = itemMed;
    if (tiers.length) TIERS = tiers;
    RANK_SHARDS = rankShardGmRead(e, "pot", RANK_SHARDS);
    await saveSettings();
    ac(dc("煉金藥水設定已儲存", "Alchemy Sort settings saved"));
  };
}
async function renderTab(e) {
  if (!st.loaded) { await loadSettings(); st.loaded = true; }
  await ensureYesterdaySettled();
  await refreshStandings();
  e.innerHTML = panelHtml();
  wireTab(e);
}

return { renderTab };
})();
function potionRenderTab(e) { return GPOT.renderTab(e); }