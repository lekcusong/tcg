
/* ===== 🔮 塔羅三消 Match-3 — end ===== */

/* ===== 🎮 小遊戲總開關（GM）— 一個 kv 鍵 config:minigame_switches 存各小遊戲開關，沒設定過＝開啟；GM 本人不受影響（可進去測試）===== */
const MG_KEY = "config:minigame_switches";
const MG_LIST = [
  { id: "bomb", icon: "💣", zh: "全服數字炸彈", en: "Bomb Map" },
  { id: "match3", icon: "🔮", zh: "塔羅三消", en: "Tarot Match-3" },
  { id: "potion", icon: "⚗️", zh: "煉金藥水排序", en: "Alchemy Sort" },
  { id: "ballpit", icon: "🎱", zh: "塔羅彈珠", en: "Tarot Ball Pit" },
  { id: "survivor", icon: "⚔️", zh: "江湖倖存者", en: "Jianghu Survivors" },
  { id: "tarotshop", icon: "🌙", zh: "月影塔羅舖", en: "Moonshadow Tarot Shop" },
  { id: "starrace", icon: "🐎", zh: "賽馬場", en: "Star Race" },
  { id: "roulette", icon: "🎡", zh: "塔羅輪盤", en: "Tarot Roulette" },
  { id: "appraise", icon: "🔍", zh: "古董鑒定", en: "Antique Appraisal" }
];
let MG_SW = {}, MG_AT = 0;
function mgOn(id) { return MG_SW[id] !== false; }
async function mgLoad(force) {
  if (!force && Date.now() - MG_AT < 10000) return MG_SW;
  try { const r = await a.get(MG_KEY); MG_SW = r ? (JSON.parse(r.value) || {}) : {}; MG_AT = Date.now(); } catch (e) {}
  return MG_SW;
}
function mgStyle() {
  if (document.getElementById("mg-styles")) return;
  const el = document.createElement("style"); el.id = "mg-styles";
  el.textContent = ".tab.mg-closed{opacity:.55;}.tab.mg-closed::after{content:' 🔒';}.tab.mg-hidden{display:none!important;}";
  document.head.appendChild(el);
}
// 把分頁按鈕標上 🔒（開關狀態每次渲染都會順便同步）
function mgSyncNav(root) {
  mgStyle();
  (root || document).querySelectorAll("[data-bm-view],[data-srrlt-view],[data-bm-link]").forEach(el => {
    const id = el.dataset.bmView || el.dataset.srrltView || el.dataset.bmLink;
    el.classList.toggle("mg-closed", !mgOn(id));
    el.classList.toggle("mg-hidden", !mgOn(id) && !ku()); // 關閉的遊戲：一般玩家直接看不到分頁，GM 仍看得到（標 🔒）
  });
}
async function mgGate(id, root) { await mgLoad(); mgSyncNav(root); return mgOn(id) || ku(); }
// 開新局前一定重新讀一次最新開關（不吃 10 秒快取），避免 GM 剛關掉還能開新局
async function mgFresh(id) { await mgLoad(true); return mgOn(id) || ku(); }
// 外接連結型小遊戲（例如江湖倖存者）：被 GM 關閉時，點下去不開新分頁，改顯示提示
function mgLinkClick(id, ev) {
  if (mgOn(id) || ku()) return true;
  if (ev && ev.preventDefault) ev.preventDefault();
  ac(dc(mgName(id) + " 目前由 GM 暫時關閉", mgName(id) + " is temporarily closed by the GM"));
  return false;
}
function mgName(id) { const g = MG_LIST.find(x => x.id === id); return g ? `${g.icon} ${dc(g.zh, g.en)}` : id; }
function mgClosedRender(sub, id) {
  if (!sub) return;
  // 目前停在被關閉的分頁：改跳到同一組裡第一個還開著的遊戲（全都關了才顯示關閉說明）
  const nav = sub.parentElement;
  const alt = nav && Array.from(nav.querySelectorAll("[data-bm-view],[data-srrlt-view]")).find(el => !el.classList.contains("mg-closed"));
  if (alt) { alt.click(); return; }
  sub.innerHTML = `<div class="panel"><h2>🔒 ${mgName(id)}</h2><p class="sub">${dc("這個小遊戲目前由 GM 暫時關閉，請晚點再來。已經下注或進行中的結算不受影響。", "This minigame is temporarily closed by the GM — please check back later. Bets or runs already in progress are not affected.")}</p></div>`;
}
function mgPanelHtml() {
  setTimeout(() => { mgPaintPanel(true); }, 400);
  return gmCollapsibleWrap(`<div class="panel">
    <h2>🎮 ${dc("小遊戲總開關（GM）", "Minigame Switches (GM)")}</h2>
    <p class="sub">${dc("關閉後，玩家看不到該小遊戲的內容（分頁會標 🔒），也不能開新局；進行中的下注／回合照常結算。該遊戲目前的稱號會立刻被回收，重新開啟後不會自動恢復，要等下一次結算才會再產生。GM 帳號不受影響，可以進去測試。", "When closed, players can't see that minigame (its tab shows 🔒) or start new rounds; bets/rounds already in progress still settle. Its current titles are recalled immediately and won't come back on reopening — they're re-awarded at the next settlement. GM accounts are unaffected so you can still test.")}</p>
    <div id="mg-panel-body">${MG_LIST.map(g => `<div class="listing"><div class="left"><div class="icon-box">${g.icon}</div><div class="meta"><div>${dc(g.zh, g.en)}</div><div class="sub" id="mg-st-${g.id}">…</div></div></div><div class="right"><button class="btn small secondary" id="mg-btn-${g.id}" onclick="mgToggle('${g.id}')">…</button></div></div>`).join("")}</div>
    <div class="form-row" style="margin-top:8px;"><button class="btn small" onclick="mgSetAll(true)">${dc("全部開啟", "Open All")}</button><button class="btn small secondary" onclick="mgSetAll(false)">${dc("全部關閉", "Close All")}</button></div>
  </div>`, true);
}
async function mgPaintPanel(force) {
  await mgLoad(force);
  MG_LIST.forEach(g => {
    const on = mgOn(g.id), st2 = document.getElementById("mg-st-" + g.id), b = document.getElementById("mg-btn-" + g.id);
    if (st2) st2.textContent = on ? dc("🟢 開放中", "🟢 Open") : dc("🔴 已關閉", "🔴 Closed");
    if (b) b.textContent = on ? dc("關閉", "Close") : dc("開啟", "Open");
  });
}
async function mgWrite(patch) {
  const raw = await Vl(MG_KEY, t => { const o = t ? JSON.parse(t) : {}; Object.assign(o, patch); o.updatedAt = Date.now(); return JSON.stringify(o); }, JSON.stringify({}));
  MG_SW = raw ? JSON.parse(raw) : MG_SW; MG_AT = Date.now();
}
/* ---- 關閉小遊戲＝回收它發的稱號；關閉期間也不再發新稱號（所有稱號都經 setTitleHolder 這個出口）---- */
const MG_TITLES = {
  bomb: ["bombExplorer", "bombVictim"],
  match3: ["match3Champion"],
  game2048: ["game2048Champion"],
  potion: ["potionChampion"],
  ballpit: ["ballpitChampion"],
  starrace: ["starRace"],
  roulette: ["rouletteChampion"]
};
const MG_TITLE_GAME = {};
Object.keys(MG_TITLES).forEach(g => MG_TITLES[g].forEach(k => { MG_TITLE_GAME[k] = g; }));
async function mgTitleClosed(titleKey) {
  const g = MG_TITLE_GAME[titleKey];
  if (!g) return false;
  await mgLoad();
  return !mgOn(g);
}
async function mgRecallTitles(ids) {
  const keys = [];
  ids.forEach(g => (MG_TITLES[g] || []).forEach(k => keys.push(k)));
  if (!keys.length) return 0;
  let n = 0;
  await Vl("config:title_holders", raw => {
    const o = raw ? JSON.parse(raw) : {};
    n = 0; // 更新函式遇到衝突會重跑，每次重算
    keys.forEach(k => { if (o[k]) n++; o[k] = null; });
    o.updatedAt = Date.now();
    return JSON.stringify(o);
  }, JSON.stringify({}));
  keys.forEach(k => { Js[k] = null; });
  Js.updatedAt = Date.now();
  return n;
}
async function mgToggle(id) {
  if (!ku()) return;
  try {
    await mgLoad(true); await mgWrite({ [id]: !mgOn(id) });
    let recalled = 0, failed = false;
    if (!mgOn(id)) { try { recalled = await mgRecallTitles([id]); } catch (e) { failed = true; } }
    await mgPaintPanel();
    ac(dc(`${mgName(id)}：${mgOn(id) ? "已開啟" : "已關閉"}${recalled ? `，已回收 ${recalled} 個稱號` : ""}${failed ? "，但稱號回收失敗，請再關一次" : ""}`,
          `${mgName(id)}: ${mgOn(id) ? "opened" : "closed"}${recalled ? `, ${recalled} title(s) recalled` : ""}${failed ? ", but title recall failed — please close it again" : ""}`));
  }
  catch (e) { ac(dc("切換失敗，請稍後再試", "Couldn't switch, please try again")); }
}
async function mgSetAll(on) {
  if (!ku()) return;
  try {
    const p = {}; MG_LIST.forEach(g => { p[g.id] = !!on; }); await mgWrite(p);
    let recalled = 0, failed = false;
    if (!on) { try { recalled = await mgRecallTitles(MG_LIST.map(g => g.id)); } catch (e) { failed = true; } }
    await mgPaintPanel();
    ac(on ? dc("所有小遊戲已開啟", "All minigames opened")
          : dc(`所有小遊戲已關閉${recalled ? `，已回收 ${recalled} 個稱號` : ""}${failed ? "，但稱號回收失敗，請再按一次" : ""}`,
               `All minigames closed${recalled ? `, ${recalled} title(s) recalled` : ""}${failed ? ", but title recall failed — please press again" : ""}`));
  }
  catch (e) { ac(dc("切換失敗，請稍後再試", "Couldn't switch, please try again")); }
}
// 整支遊戲包在 !function(){...}() 裡，面板按鈕的 inline onclick 要靠 window 才找得到函式
window.mgToggle = mgToggle; window.mgSetAll = mgSetAll; window.mgLinkClick = mgLinkClick;

/* ===== ⚔️ 江湖倖存者：在小遊戲分頁內以全螢幕 iframe 開啟（survivor/index.html，單檔獨立遊戲）=====
   - 開啟前先重新讀一次 GM 開關（mgFresh，id = survivor）；GM 本人不受影響，一般玩家被關閉時只顯示提示。
   - 開啟時暫停主遊戲背景音樂，關閉後（原本在播的話）恢復。遊戲自己的存檔（銀兩、修煉）放在 localStorage 的 wxs1 / wxs_mute，另外會同步到雲端 survivor_save:<暱稱>（見下方雲端存檔），跟主遊戲帳號資料互不干擾。
   - 關閉方式：上方 ✕ 返回、Esc、或 iframe 內 postMessage({src:"survivor",type:"close"})。 */
/* ---- 江湖榜：每人每天一筆（今日榜）＋歷史最高一筆（總榜），都取單局最高分；跟三消同一套 kv 模式（Vl 比較後寫入、a.listValues 讀榜）----
   分數由這裡用「擊敗數、存活秒數、是否通關」重算，不直接採用遊戲回報的分數。
   key：survivor_daily_score:<日期>:<暱稱小寫>、survivor_best:<暱稱小寫>。每日挑戰（不計強化）另存 survivor_challenge_score:<日期(Ii)>:<暱稱小寫>，每天由 09-roulette.js 的每日結算（MG_DAILY_GAMES.survivor）發第一名神秘碎片 ×3。 */
const SV_DAILY_PREFIX = "survivor_daily_score:", SV_BEST_PREFIX = "survivor_best:", SV_CH_PREFIX = "survivor_challenge_score:";
let svLastSubmit = 0;
function svScore(k, t, w) { return Math.floor(k) * 10 + Math.floor(t) * 2 + (w ? 1500 : 0); }
async function svStandings(prefix) {
  let ents = []; try { ents = await a.listValues(prefix); } catch (e) { ents = []; }
  return (ents || []).map(e => {
    let d = null; try { d = JSON.parse(e.value); } catch (err) { }
    if (!d) return null;
    return { nick: d.nick || e.key.slice(prefix.length), score: d.score || 0, lastAt: d.lastAt || 0, win: !!d.win, kills: d.kills || 0, time: d.time || 0, ch: d.ch | 0 };
  }).filter(Boolean).filter(p => p.score > 0).sort((x, y) => y.score - x.score || x.lastAt - y.lastAt);
}
async function svPutBest(key, rec) {
  const raw = await Vl(key, t => { const s = t ? JSON.parse(t) : { score: 0 }; return JSON.stringify(rec.score > (s.score || 0) ? rec : s); }, JSON.stringify({ score: 0 }));
  return raw ? JSON.parse(raw) : null;
}
function svRankOf(list, nick) { const n = String(nick).toLowerCase(); const i = list.findIndex(p => String(p.nick).toLowerCase() === n); return i < 0 ? 0 : i + 1; }
async function svSubmit(d) {
  const nick = zl && zl.nickname;
  if (!nick) return { ok: false, reason: "nologin" };
  if (Date.now() - svLastSubmit < 3000) return { ok: false, reason: "busy" };
  svLastSubmit = Date.now();
  const k = Math.floor(Number(d.kills)), tm = Math.floor(Number(d.time));
  if (!(k >= 0 && k <= 20000) || !(tm >= 10 && tm <= 900)) return { ok: false, reason: "invalid" };
  const win = !!d.win, score = svScore(k, tm, win), key = nick.toLowerCase();
  const rec = { nick, score, win, kills: k, time: tm, ch: Math.max(0, Math.min(4, d.ch | 0)), lastAt: Date.now() };
  if (d.mode === "daily") {
    // 每日挑戰：日期用本地日期 Ii()（跟每日結算同一套），跨日才打完的不算
    const cd = Ii();
    if (String(d.date) !== cd) return { ok: false, reason: "expired" };
    const mine = await svPutBest(SV_CH_PREFIX + cd + ":" + key, rec);
    const cl = await svStandings(SV_CH_PREFIX + cd + ":");
    return { ok: true, mode: "daily", score, chRank: svRankOf(cl, nick), newBest: !!(mine && mine.lastAt === rec.lastAt && mine.score === score) };
  }
  const day = ys();
  await svPutBest(SV_DAILY_PREFIX + day + ":" + key, rec);
  const best = await svPutBest(SV_BEST_PREFIX + key, rec);
  const [dl, al] = await Promise.all([svStandings(SV_DAILY_PREFIX + day + ":"), svStandings(SV_BEST_PREFIX)]);
  return { ok: true, score, dailyRank: svRankOf(dl, nick), allRank: svRankOf(al, nick), newBest: !!(best && best.lastAt === rec.lastAt && best.score === score) };
}
async function svBoard() {
  const nick = (zl && zl.nickname) || "", day = ys();
  const [dl, al, cl] = await Promise.all([svStandings(SV_DAILY_PREFIX + day + ":"), svStandings(SV_BEST_PREFIX), svStandings(SV_CH_PREFIX + Ii() + ":")]);
  const mk = (l, n) => { const r = svRankOf(l, n); return { rank: r, score: r ? l[r - 1].score : 0 }; };
  const z = { rank: 0, score: 0 }, md = nick ? mk(dl, nick) : z, ma = nick ? mk(al, nick) : z, mc = nick ? mk(cl, nick) : z;
  let yday = null;   // 昨天挑戰榜第一名（每日結算後才有）
  try { const r = await a.get("survivor_challenge_leaderboard:" + IiOffset(1)); const b = r ? JSON.parse(r.value) : null; if (b && b.top && b.top[0]) yday = { nick: b.top[0].nick, score: b.top[0].score }; } catch (e) { }
  return { daily: dl.slice(0, 10), all: al.slice(0, 10), ch: cl.slice(0, 10), yday, me: nick ? { nick, dailyRank: md.rank, dailyScore: md.score, allRank: ma.rank, allScore: ma.score, chRank: mc.rank, chScore: mc.score } : null };
}

/* ---- 江湖倖存者雲端存檔：key = survivor_save:<暱稱小寫>，內容 {g 銀兩, u 強化等級, t 時間}。
   手機、電腦開同一個暱稱就共用。衝突規則（客戶端與這裡一致）：累計財富（銀兩＋已買強化的總花費，只增不減）高者勝，相同再比 t；
   所以較舊的裝置不會把進度蓋回去。強化等級、銀兩上限在這裡驗證。 ---- */
const SV_SAVE_PREFIX = "survivor_save:";
const SV_UPG = { hp: [60, 5], atk: [80, 5], spd: [60, 5], sta: [60, 5], exp: [80, 5], rev: [300, 2], gold: [70, 5], dash: [70, 4], pick: [50, 5],
  b_crit: [90, 5], b_cdmg: [90, 5], b_chain: [90, 5], c_asura: [600, 1], b_arm: [90, 5], b_heal: [90, 5], b_last: [90, 5], c_gold: [600, 1] };   // [單價, 等級上限]，要跟 survivor/index.html 的 UP / UPB 一致
function svCleanSave(m) {
  if (!m || typeof m !== "object") return null;
  const g = Math.floor(Number(m.g)); if (!(g >= 0 && g <= 20000000)) return null;
  const u = {}; const mu = m.u && typeof m.u === "object" ? m.u : {};
  for (const k of Object.keys(SV_UPG)) { const l = Math.floor(Number(mu[k]) || 0); if (l < 0 || l > SV_UPG[k][1]) return null; if (l > 0) u[k] = l; }
  if ((u.c_asura || 0) + (u.c_gold || 0) > 1) return null;   // 絕頂只能選一個
  if ((u.b_crit || u.b_cdmg || u.b_chain || u.c_asura) && (u.atk || 0) < 3) return null;   // 攻伐分支需內勁 3 重
  if ((u.b_arm || u.b_heal || u.b_last || u.c_gold) && (u.hp || 0) < 3) return null;   // 護體分支需筋骨 3 重
  const t = Math.floor(Number(m.t)) || 0;
  return { g, u, t: t > 0 && t < 4102444800000 ? t : 0 };
}
function svSaveWealth(m) { let w = m.g || 0; for (const k of Object.keys(SV_UPG)) { const l = (m.u && m.u[k]) || 0; w += SV_UPG[k][0] * l * (l + 1) / 2; } return w; }
function svSaveCmp(a, b) { return (svSaveWealth(a) - svSaveWealth(b)) || ((a.t || 0) - (b.t || 0)); }
async function svLoadSave() {
  const nick = zl && zl.nickname; if (!nick) return null;
  const r = await a.get(SV_SAVE_PREFIX + nick.toLowerCase());
  return r ? svCleanSave(JSON.parse(r.value)) : null;
}
async function svStoreSave(m) {
  const nick = zl && zl.nickname; if (!nick) return null;
  const cl = svCleanSave(m); if (!cl) return null;
  const raw = await Vl(SV_SAVE_PREFIX + nick.toLowerCase(), t => {
    let old = null; try { old = t ? svCleanSave(JSON.parse(t)) : null; } catch (e) { }
    return JSON.stringify(old && svSaveCmp(cl, old) < 0 ? old : cl);
  }, "");
  return raw ? JSON.parse(raw) : null;
}
function svOpenOverlay(ev) { if (ev && ev.preventDefault) ev.preventDefault(); svOpenAsync(); return false; }
async function svOpenAsync() {
  if (document.getElementById("sv-overlay")) return;
  let ok = true; try { ok = await mgFresh("survivor"); } catch (e) { }
  if (!ok) { mgLinkClick("survivor"); return; }
  if (document.getElementById("sv-overlay")) return;
  const bgm = document.getElementById("bgm-audio"); const bgmWas = !!(bgm && !bgm.paused);
  if (bgmWas) { try { bgm.pause(); } catch (e) { } }
  if (!document.getElementById("sv-overlay-css")) {
    const st = document.createElement("style"); st.id = "sv-overlay-css";
    st.textContent = "#sv-overlay{position:fixed;inset:0;z-index:3000;background:#a9b8a6;display:flex;flex-direction:column}" +
      "#sv-overlay .sv-bar{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 10px;background:#120a1e;border-bottom:1px solid #4a3a20;color:#e8c468;font:600 13px/1.2 Cinzel,'Noto Sans TC',serif}" +
      "#sv-overlay .sv-x{cursor:pointer;border:1px solid #c9a24a;background:transparent;color:#e8c468;border-radius:8px;padding:4px 12px;font:inherit}" +
      "#sv-overlay iframe{flex:1 1 auto;width:100%;border:0;background:#a9b8a6}" +
      "body.sv-open{overflow:hidden}";
    document.head.appendChild(st);
  }
  const box = document.createElement("div"); box.id = "sv-overlay";
  const bar = document.createElement("div"); bar.className = "sv-bar";
  const ttl = document.createElement("span"); ttl.textContent = "⚔️ " + dc("江湖倖存者", "Jianghu Survivors");
  const x = document.createElement("button"); x.className = "sv-x"; x.textContent = "✕ " + dc("返回", "Back");
  bar.appendChild(ttl); bar.appendChild(x);
  const fr = document.createElement("iframe"); fr.title = "Jianghu Survivors"; fr.allow = "autoplay";
  fr.src = "survivor/index.html?embed=1" + (ku() ? "&gm=1" : "") + "&t=" + Date.now();
  box.appendChild(bar); box.appendChild(fr); document.body.appendChild(box); document.body.classList.add("sv-open");
  const close = () => {
    window.removeEventListener("message", onMsg); document.removeEventListener("keydown", onKey);
    box.remove(); document.body.classList.remove("sv-open");
    if (bgmWas && bgm) { try { bgm.play().catch(() => { }); } catch (e) { } }
  };
  const reply = (type, o) => { try { fr.contentWindow.postMessage(Object.assign({ src: "survivor-host", type }, o || {}), location.origin); } catch (e) { } };
  const onMsg = e => {
    if (e.origin !== location.origin || e.source !== fr.contentWindow || !e.data || e.data.src !== "survivor") return;
    if (e.data.type === "close") close();
    else if (e.data.type === "score") svSubmit(e.data).then(r => reply("submitted", r), () => reply("submitted", { ok: false, reason: "error" }));
    else if (e.data.type === "board") svBoard().then(r => reply("board", r), () => { /* 讀取失敗：遊戲端 7 秒後會顯示失敗提示 */ });
    else if (e.data.type === "load") svLoadSave().then(m => reply("save", { m }), () => { /* 讀取失敗：遊戲端繼續用本機存檔 */ });
    else if (e.data.type === "save") svStoreSave(e.data.m).then(m => { if (m) reply("save", { m }); }, () => { /* 寫入失敗：下次存檔再試 */ });
  };
  const onKey = e => { if (e.key === "Escape") close(); };
  x.onclick = close; window.addEventListener("message", onMsg); document.addEventListener("keydown", onKey);
}
window.svOpenOverlay = svOpenOverlay;

/* ===== 🌙 月影塔羅舖：做法跟江湖倖存者一樣，在小遊戲分頁內以全螢幕 iframe 開啟（tarotshop/index.html，單檔獨立遊戲）=====
   - 開啟前先重新讀一次 GM 開關（mgFresh，id = tarotshop）；GM 本人不受影響，一般玩家被關閉時只顯示提示。
   - 遊戲本身的存檔、圖鑑放在 iframe 的 localStorage（鍵名加暱稱後綴）；主遊戲這邊只記「累計」：
     key tarotshop_stat:<暱稱小寫> = { nick, days 累計營業天數, earn 累計營業額, run 最近一局編號, lastDay 該局最後計入的天數, lastAt }。
   - 遊戲每次「打烊」回報 { run, day, rev }：同一局 day 沒有大於 lastDay 就是重複（讀檔重玩同一天），不計；
     兩次計入之間要隔 TS_MIN_GAP_MS（太快回 busy，遊戲端稍後重送）；單日營業額上限 TS_MAX_REV。
   - 里程碑：累計營業天數第一次達到 10／20／30 天，各發神秘碎片 ×10，每個里程碑每位玩家只發一次。
     防重發靠玩家存檔上的 tshopPaid[里程碑]（跟 mgDailyPaid 同一個 CAS 做法）；發放失敗不會標記，
     下一次回報或打開排行榜時會自動補發。發成功一律寄信箱通知（shardNotify，來源 tarotshop_days）。
   - 排行榜：累計天數榜、賺錢榜（累計營業額）各取前 20，並附上自己的名次。 */
const TS_PREFIX = "tarotshop_stat:", TS_MILESTONES = [10, 20, 30], TS_SHARDS = 10, TS_MIN_GAP_MS = 6000, TS_MAX_REV = 20000;
function tsPaidList() {
  const m = zl && zl.player && zl.player.tshopPaid;
  return m && typeof m === "object" ? TS_MILESTONES.filter(k => m[k]) : [];
}
// 補發／發放里程碑獎勵：只處理「累計天數已達標、但玩家存檔還沒有標記」的里程碑
async function tsPay(nick, days) {
  const rewards = [];
  const paidNow = tsPaidList();
  const need = TS_MILESTONES.filter(m => days >= m && !paidNow.includes(m));
  for (const m of need) {
    let paid = false, upd = null;
    try {
      upd = await Wl(nick, pl => {
        paid = false; le(pl);
        if (!pl.tshopPaid || typeof pl.tshopPaid !== "object") pl.tshopPaid = {};
        if (pl.tshopPaid[m]) return;
        pl.tshopPaid[m] = Date.now();
        pl.materials.mysteryShard = (pl.materials.mysteryShard || 0) + TS_SHARDS;
        paid = true;
      });
    } catch (e) { console.error("[tsPay]", m, e); continue; }
    if (!upd) continue;
    if (String(nick).toLowerCase() === String((zl && zl.nickname) || "").toLowerCase()) { zl.player = upd; try { Au(); } catch (e) { } }
    if (paid) { rewards.push({ m, qty: TS_SHARDS }); await shardNotify(nick, TS_SHARDS, "tarotshop_days"); }
  }
  return rewards;
}
async function tsReadRec(nick) {
  try { const r = await a.get(TS_PREFIX + nick.toLowerCase()); const d = r ? JSON.parse(r.value) : null; return d && typeof d === "object" ? d : null; }
  catch (e) { return null; }
}
async function tsReport(d) {
  const nick = zl && zl.nickname, at = d && d.at;
  if (!nick) return { ok: false, reason: "nologin", at };
  const day = Math.floor(Number(d.day)), run = String(d.run == null ? "" : d.run).slice(0, 24);
  let rev = Math.floor(Number(d.rev));
  if (!(day >= 0 && day <= 9999) || !run || !(rev >= 0)) return { ok: false, reason: "invalid", at };
  rev = Math.min(rev, TS_MAX_REV);
  let busy = false, dup = false;
  const raw = await Vl(TS_PREFIX + nick.toLowerCase(), t => {
    busy = false; dup = false; // 更新函式遇到衝突會重跑，每次重算
    let s = null; try { s = t ? JSON.parse(t) : null; } catch (e) { }
    s = s && typeof s === "object" ? s : { days: 0, earn: 0, run: "", lastDay: -1, lastAt: 0 };
    const now = Date.now();
    if (now - (s.lastAt || 0) < TS_MIN_GAP_MS) { busy = true; return JSON.stringify(s); }
    if (s.run === run && day <= (s.lastDay == null ? -1 : s.lastDay)) { dup = true; return JSON.stringify(s); }
    s.nick = nick; s.days = (s.days | 0) + 1; s.earn = (Number(s.earn) || 0) + rev; s.run = run; s.lastDay = day; s.lastAt = now;
    return JSON.stringify(s);
  }, "");
  const rec = raw ? JSON.parse(raw) : { days: 0, earn: 0 };
  if (busy) return { ok: false, reason: "busy", at };
  const rewards = await tsPay(nick, rec.days | 0).catch(() => []);
  const me = { days: rec.days | 0, earn: Math.floor(rec.earn) || 0, paid: tsPaidList() };
  return dup ? { ok: false, reason: "dup", at, me } : { ok: true, at, me, rewards };
}
async function tsStat() {
  const nick = zl && zl.nickname; if (!nick) return { me: null };
  const rec = (await tsReadRec(nick)) || { days: 0, earn: 0 };
  await tsPay(nick, rec.days | 0).catch(() => []);
  return { me: { days: rec.days | 0, earn: Math.floor(rec.earn) || 0, paid: tsPaidList() } };
}
async function tsBoard() {
  const nick = (zl && zl.nickname) || "", n = nick.toLowerCase();
  let ents = []; try { ents = await a.listValues(TS_PREFIX); } catch (e) { ents = []; }
  const all = (ents || []).map(e => {
    let d = null; try { d = JSON.parse(e.value); } catch (err) { }
    return d ? { nick: d.nick || e.key.slice(TS_PREFIX.length), days: d.days | 0, earn: Math.floor(Number(d.earn)) || 0, lastAt: d.lastAt || 0 } : null;
  }).filter(p => p && p.days > 0);
  const byDays = all.slice().sort((x, y) => y.days - x.days || y.earn - x.earn || x.lastAt - y.lastAt);
  const byEarn = all.slice().sort((x, y) => y.earn - x.earn || y.days - x.days || x.lastAt - y.lastAt);
  const idx = l => l.findIndex(p => String(p.nick).toLowerCase() === n);
  const mk = l => l.slice(0, 20).map(p => ({ nick: p.nick, days: p.days, earn: p.earn, mine: !!n && String(p.nick).toLowerCase() === n }));
  let me = null;
  if (nick) {
    const i = idx(byDays), j = idx(byEarn), rec = i >= 0 ? byDays[i] : { days: 0, earn: 0 };
    await tsPay(nick, rec.days).catch(() => []);
    me = { days: rec.days, earn: rec.earn, dRank: i + 1, eRank: j + 1, paid: tsPaidList() };
  }
  return { days: mk(byDays), earn: mk(byEarn), total: all.length, me };
}
/* ---- 雲端存檔：key = tarotshop_save:<暱稱小寫>，內容 { t 時間, s 店內存檔(字串，null＝已清除), cx 圖鑑成就, en 結局 }。
   手機、電腦開同一個暱稱就共用。衝突規則：t 較新的蓋較舊的（遊戲端只在主頁才套用雲端，不會蓋掉進行中的一天）；
   伺服器端拒收 t 比現有舊的、格式不對的、太大的。累計天數／營業額／獎勵不在存檔裡，不受存檔影響。 ---- */
const TS_SAVE_PREFIX = "tarotshop_save:", TS_SAVE_MAX = 150000;
function tsCleanSave(m) {
  if (!m || typeof m !== "object") return null;
  const t = Math.floor(Number(m.t)); if (!(t > 0 && t <= Date.now() + 600000)) return null;
  const str = v => v == null ? null : (typeof v === "string" && v.length <= TS_SAVE_MAX ? v : undefined);
  const s = str(m.s), cx = str(m.cx), en = str(m.en);
  if (s === undefined || cx === undefined || en === undefined) return null;
  try {
    if (s) { const o = JSON.parse(s); if (!o || typeof o.coins !== "number" || !(o.day >= 0 && o.day <= 9999)) return null; }
    if (cx) { const o = JSON.parse(cx); if (!o || typeof o !== "object") return null; }
    if (en) { if (!Array.isArray(JSON.parse(en))) return null; }
  } catch (e) { return null; }
  return { t, s, cx, en };
}
async function tsLoadSave() {
  const nick = zl && zl.nickname; if (!nick) return { m: null };
  try { const r = await a.get(TS_SAVE_PREFIX + nick.toLowerCase()); return { m: r ? tsCleanSave(JSON.parse(r.value)) : null }; }
  catch (e) { return { m: null }; }
}
async function tsStoreSave(m) {
  const nick = zl && zl.nickname; if (!nick) return;
  const cl = tsCleanSave(m); if (!cl) return;
  await Vl(TS_SAVE_PREFIX + nick.toLowerCase(), t => {
    let old = null; try { old = t ? tsCleanSave(JSON.parse(t)) : null; } catch (e) { }
    return JSON.stringify(old && old.t >= cl.t ? old : cl);
  }, "");
}
function tsOpenOverlay(ev) { if (ev && ev.preventDefault) ev.preventDefault(); tsOpenAsync(); return false; }
async function tsOpenAsync() {
  if (document.getElementById("ts-overlay")) return;
  let ok = true; try { ok = await mgFresh("tarotshop"); } catch (e) { }
  if (!ok) { mgLinkClick("tarotshop"); return; }
  if (document.getElementById("ts-overlay")) return;
  const bgm = document.getElementById("bgm-audio"); const bgmWas = !!(bgm && !bgm.paused);
  if (bgmWas) { try { bgm.pause(); } catch (e) { } }
  if (!document.getElementById("ts-overlay-css")) {
    const st = document.createElement("style"); st.id = "ts-overlay-css";
    st.textContent = "#ts-overlay{position:fixed;inset:0;z-index:3000;background:#130a24;display:flex;flex-direction:column}" +
      "#ts-overlay .ts-bar{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 10px;background:#120a1e;border-bottom:1px solid #4a3a20;color:#e8c468;font:600 13px/1.2 Cinzel,'Noto Sans TC',serif}" +
      "#ts-overlay .ts-x{cursor:pointer;border:1px solid #c9a24a;background:transparent;color:#e8c468;border-radius:8px;padding:4px 12px;font:inherit}" +
      "#ts-overlay iframe{flex:1 1 auto;width:100%;border:0;background:#130a24}" +
      "body.ts-open{overflow:hidden}";
    document.head.appendChild(st);
  }
  const box = document.createElement("div"); box.id = "ts-overlay";
  const bar = document.createElement("div"); bar.className = "ts-bar";
  const ttl = document.createElement("span"); ttl.textContent = "🌙 " + dc("月影塔羅舖", "Moonshadow Tarot Shop");
  const x = document.createElement("button"); x.className = "ts-x"; x.textContent = "✕ " + dc("返回", "Back");
  bar.appendChild(ttl); bar.appendChild(x);
  const fr = document.createElement("iframe"); fr.title = "Moonshadow Tarot Shop"; fr.allow = "autoplay";
  fr.src = "tarotshop/index.html?embed=1&nick=" + encodeURIComponent((zl && zl.nickname) || "") + (ku() ? "&gm=1" : "") + "&t=" + Date.now();
  box.appendChild(bar); box.appendChild(fr); document.body.appendChild(box); document.body.classList.add("ts-open");
  const close = () => {
    window.removeEventListener("message", onMsg); document.removeEventListener("keydown", onKey2);
    box.remove(); document.body.classList.remove("ts-open");
    if (bgmWas && bgm) { try { bgm.play().catch(() => { }); } catch (e) { } }
  };
  const reply = (type, o) => { try { fr.contentWindow.postMessage(Object.assign({ src: "tarotshop-host", type }, o || {}), location.origin); } catch (e) { } };
  const onMsg = e => {
    if (e.origin !== location.origin || e.source !== fr.contentWindow || !e.data || e.data.src !== "tarotshop") return;
    const m = e.data;
    if (m.type === "close") close();
    else if (m.type === "day") tsReport(m).then(r => reply("dayResult", r), () => reply("dayResult", { ok: false, reason: "error", at: m.at }));
    else if (m.type === "loadSave") tsLoadSave().then(r => reply("save", r), () => { /* 讀取失敗：遊戲端繼續用本機存檔 */ });
    else if (m.type === "saveCloud") tsStoreSave(m.m).catch(() => { /* 寫入失敗：下次存檔再試 */ });
    else if (m.type === "stat") tsStat().then(r => reply("stat", r), () => { /* 讀取失敗：遊戲端保留「讀取中」 */ });
    else if (m.type === "board") tsBoard().then(r => reply("board", r), () => { /* 讀取失敗：遊戲端保留「讀取中」 */ });
  };
  let closing = false;
  const softClose = () => { if (closing) return; closing = true; reply("flush"); setTimeout(close, 450); };
  const onKey2 = e => { if (e.key === "Escape") softClose(); };
  document.addEventListener("keydown", onKey2);
  x.onclick = softClose; window.addEventListener("message", onMsg);
}
window.tsOpenOverlay = tsOpenOverlay;

/* ===== 延後載入 Lazy-load：塔羅三消 / 煉金藥水 / 塔羅彈珠（三個檔合計約 270KB）=====
   玩家第一次點進該小遊戲才下載。index.html 裡用「type=text/plain 且帶 data-lazy=m3|pot|bp 的 script 標記」
   登記檔名與版本碼（瀏覽器不會下載也不會執行；auto-update 也靠它偵測新版）。
   檔案載入後，裡面同名的 xxxRenderTab 會覆蓋這裡的 stub，之後 09-roulette.js 的呼叫就直接走正式版。
   ※ 新增延後載入的檔：index.html 加 data-lazy 標記、這裡加一個 stub，並確保其他檔案只透過這個 stub 進入。 */
const __lazyP = {}, __lazyDone = {};
function lazyLoadJs(key) {
  if (__lazyDone[key]) return Promise.resolve();
  if (__lazyP[key]) return __lazyP[key];
  const tag = document.querySelector('script[data-lazy="' + key + '"]');
  if (!tag) return Promise.reject(new Error("lazy script tag missing: " + key));
  return (__lazyP[key] = new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = tag.getAttribute("src");
    s.onload = () => { __lazyDone[key] = 1; res(); };
    s.onerror = () => { delete __lazyP[key]; s.remove(); rej(new Error("lazy load failed: " + key)); };
    document.head.appendChild(s);
  }));
}
function lazyRenderTab(key, e, run) {
  if (__lazyDone[key]) return run();
  if (e && e.isConnected) e.innerHTML = '<div class="loading-line">' + dc("載入中…", "Loading…") + "</div>";
  return lazyLoadJs(key).then(() => {
    if (e && !e.isConnected) return; // 載入期間玩家已經切到別頁，不用再畫
    return run();
  }).catch(err => {
    console.error(err);
    if (e && e.isConnected) e.innerHTML = '<div class="empty-note">' + dc("載入失敗，請檢查網路後再點一次", "Load failed - check your connection and tap again") + "</div>";
  });
}
function match3RenderTab(e) { return lazyRenderTab("m3", e, () => M3.renderTab(e)); }
function potionRenderTab(e) { return lazyRenderTab("pot", e, () => GPOT.renderTab(e)); }
function ballpitRenderTab(e) { return lazyRenderTab("bp", e, () => BP.renderTab(e)); }
