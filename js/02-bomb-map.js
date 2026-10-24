
/* ===== 全服數字炸彈 Bomb Map — begin ===== */
const BOMB_URL = "https://hmkpwrefecwjxnyggcej.supabase.co";
const BOMB_KEY = "sb_publishable_vs1K1Ao4Gjl2JK5xrK-GpQ_aXsHyty7";
const BOMB_HEADERS = { apikey: BOMB_KEY, Authorization: `Bearer ${BOMB_KEY}` };

const BOMB_LITE = (() => { try { const u = navigator.userAgent || ""; const r = true; /* 簡化畫面：所有裝置都用輕量版（不分 iPad / 手機 / 電腦） */ document.documentElement.classList.add("bomb-lite"); return r; } catch (e) { return false; } })();
/* ===== 炸彈地圖：Canvas 繪製引擎 =====
   整張地圖只用 1 個 <canvas>，只畫螢幕上看得到的格子（取代原本 5625 個 div）。
   資料流程（bombState.cells / 輪詢 / 旗標 / 選取）完全沒變，只換最底層的畫法。
   畫面風格：領地色塊——翻開的格子整格塗上「翻開者」的顏色，同一個人相連的格子連成一片。 */
const BOMB_COLOR_NUMBERS = false;   // true＝數字依大小上色（1 藍 2 綠 3 紅…）；false＝統一淡白
const BOMB_NUM_COLORS = ["", "#8fc2ff", "#7ee8ac", "#ff9a9a", "#c9b1ff", "#ffbf94", "#79e6e6", "#f4f4f4", "#c4c4c4"];
const BOMB_CV = {
  bg: "#0a0613", fog: "#3b2c66", bombFill: "#8f1f2b", shard: "#5a3fd0", feather: "#c42aa8",
  zoneRisk: ["", "#3f3b77", "#614c61", "#6e3a62"],     // 外圈 藍／中圈 琥珀／核心 紅
  zoneReward: ["", "#3b2c66", "#534063", "#6e585f"],   // 獎勵模式：只用金色深淺
  typeCol: ["", "#ffd76a", "#6cc4ff", "#fff27a"], typeIcon: ["", "💰", "🛡", "⚡"]
};
const BC = { cv: null, ctx: null, wrap: null, grid: null, mapId: null, W: 0, H: 0, N: 0, px: 16, dpr: 1, cssW: 0, cssH: 0,
  own: null, num: null, bomb: null, typ: null, sp: null, zc: null, zcSrc: null, zoneOn: false, zr: false, sig: null, xs: null, ys: null,
  names: [], nameIdx: new Map(), cols: [], raf: 0, flash: new Map(), glyph: [], glyphKey: "", gs: 0, hover: -1, ro: null, bulk: false };
function bombCell(){ return null; }   // 舊版「每格一個 div」已經不存在，保留空函式避免舊呼叫出錯

function bombCvOwner(name){
  let id = BC.nameIdx.get(name);
  if (!id) { id = BC.names.length + 1; BC.names.push(name); BC.nameIdx.set(name, id); }
  return id;
}
function bombCvCols(id){
  let c = BC.cols[id]; if (c) return c;
  const name = BC.names[id - 1], hue = bombNameHue(name), hi = bombNameKey(name) < 12, me = bombIsMe(name);
  c = BC.cols[id] = {
    tint: `hsl(${hue},${me ? 56 : 46}%,${(hi ? 29 : 22) + (me ? 7 : 0)}%)`,   // 有數字的格子：領地色
    zero: `hsl(${hue},${me ? 46 : 38}%,${(hi ? 18 : 13) + (me ? 6 : 0)}%)`,   // 數字 0 的空地：同色但更深
    frame: bombFrameColor(name)
  };
  return c;
}
function bombCvInit(grid, wrap){
  const B = BC, st = bombState;
  if (B.ro) { try { B.ro.disconnect(); } catch (e) {} B.ro = null; }
  B.grid = grid; B.wrap = wrap; B.cv = grid ? grid.querySelector("canvas") : null;
  if (!B.cv || !wrap) { B.own = null; return; }
  B.ctx = B.cv.getContext("2d", { alpha: false });
  B.mapId = st.mapId; B.W = st.width; B.H = st.height; B.N = st.width * st.height;
  B.px = st.cellPx || 16;
  B.own = new Uint16Array(B.N); B.num = new Int8Array(B.N).fill(-1); B.bomb = new Uint8Array(B.N);
  B.typ = new Uint8Array(B.N); B.sp = new Uint8Array(B.N); B.zc = new Uint8Array(B.N); B.zcSrc = null; B.zoneOn = false;
  B.sig = new Array(B.N); B.xs = new Float32Array(B.W + 2); B.ys = new Float32Array(B.H + 2);
  B.names = []; B.nameIdx = new Map(); B.cols = []; B.flash.clear(); B.glyphKey = ""; B.hover = -1;
  wrap.addEventListener("scroll", bombCvInvalidate, { passive: true });
  if (typeof ResizeObserver !== "undefined") { B.ro = new ResizeObserver(() => bombCvResize()); B.ro.observe(wrap); }
  bombCvResize();
  try { if (document.fonts && document.fonts.load) document.fonts.load("700 12px 'Space Mono'").then(() => { B.glyphKey = ""; bombCvInvalidate(); }).catch(() => {}); } catch (e) {}
}
function bombCvResize(){
  const B = BC; if (!B.cv || !B.wrap || !B.grid) return;
  const gw = Math.round(B.W * B.px), gh = Math.round(B.H * B.px);
  B.grid.style.width = gw + "px"; B.grid.style.height = gh + "px";
  const cw = Math.max(1, Math.min(B.wrap.clientWidth, gw)), ch = Math.max(1, Math.min(B.wrap.clientHeight, gh));
  B.dpr = Math.min(window.devicePixelRatio || 1, 2);
  const pw = Math.round(cw * B.dpr), ph = Math.round(ch * B.dpr);
  if (B.cv.width !== pw || B.cv.height !== ph) { B.cv.width = pw; B.cv.height = ph; }
  B.cv.style.width = cw + "px"; B.cv.style.height = ch + "px";
  B.cssW = cw; B.cssH = ch;
  bombCvInvalidate();
}
function bombCvInvalidate(){
  if (BC.raf || !BC.cv) return;
  BC.raf = requestAnimationFrame(() => { BC.raf = 0; bombCvDraw(); });
}
function bombCvSetCell(idx, c){
  const B = BC;
  const sig = (c.is_bomb ? 1 : 0) + "|" + (c.cell_type || "") + "|" + (typeof c.nearby_count === "number" ? c.nearby_count : "") + "|" + (c.revealed_by_name || "") + "|" + (c.is_shard ? 1 : 0) + "|" + (c.is_feather ? 1 : 0);
  if (B.sig[idx] === sig) return 0;
  const was = B.own[idx];
  B.sig[idx] = sig;
  bombState._statsVer = (bombState._statsVer || 0) + 1;   // 領地統計（排行／圖例）的快取版本
  B.own[idx] = bombCvOwner(c.revealed_by_name || "?");
  B.bomb[idx] = c.is_bomb ? 1 : 0;
  const n = c.nearby_count;
  B.num[idx] = (!c.is_bomb && typeof n === "number") ? n : -1;
  B.typ[idx] = c.cell_type === "treasure" ? 1 : c.cell_type === "shield" ? 2 : c.cell_type === "chain" ? 3 : 0;
  B.sp[idx] = c.is_shard ? 1 : c.is_feather ? 2 : 0;
  if (!c.is_bomb && typeof n !== "number") bombQueueNumberRetry(idx);   // 還沒拿到數字：稍後補抓
  return was ? 2 : 1;
}
function bombCvFlash(idx, isBomb){
  if (BC.bulk || BC.px < 8 || BC.flash.size > 60) return;
  BC.flash.set(idx, [performance.now(), isBomb ? 1 : 0]);
}
function bombCvGlyphs(){
  const B = BC, key = B.px + "|" + B.dpr + "|" + (BOMB_COLOR_NUMBERS ? 1 : 0);
  if (B.glyphKey === key) return;
  B.glyphKey = key; B.glyph = [];
  const gs = Math.ceil(B.px), dev = Math.max(1, Math.round(gs * B.dpr)), fs = Math.max(8, Math.round(B.px * 0.62));
  B.gs = gs;
  for (let d = 1; d <= 8; d++) {   // 1～8 各預先畫成小圖，畫面上每個數字只是貼一張圖
    const cv = document.createElement("canvas"); cv.width = dev; cv.height = dev;
    const g = cv.getContext("2d"); g.scale(dev / gs, dev / gs);
    g.font = `700 ${fs}px 'Space Mono',monospace`; g.textAlign = "center"; g.textBaseline = "middle";
    g.shadowColor = "rgba(0,0,0,.5)"; g.shadowOffsetY = 1; g.shadowBlur = 0;
    g.fillStyle = BOMB_COLOR_NUMBERS ? BOMB_NUM_COLORS[d] : "#f4eeff";
    g.fillText(String(d), gs / 2, gs / 2 + 1);
    B.glyph[d] = cv;
  }
}
function bombCvColor(k){
  if (k === 0) return BOMB_CV.fog;
  if (k > 0 && k < 4) return (BC.zr ? BOMB_CV.zoneReward : BOMB_CV.zoneRisk)[k];
  if (k === -1) return BOMB_CV.bombFill;
  if (k === 5) return BOMB_CV.shard;
  if (k === 6) return BOMB_CV.feather;
  const c = bombCvCols((k - 10) >> 1);
  return (k - 10) & 1 ? c.zero : c.tint;
}
function bombCvFlag(ctx, x, y, w, h){
  if (w < 10) { ctx.fillStyle = "#ff5a5a"; ctx.fillRect(x + w * .3, y + h * .3, w * .4, h * .4); return; }
  const m = Math.max(2, w * .2), fx = x + w * .38, top = y + m, bot = y + h - m - 1;
  ctx.fillStyle = "#ff5a5a"; ctx.beginPath(); ctx.moveTo(fx, top); ctx.lineTo(fx + w * .4, top + (bot - top) * .27); ctx.lineTo(fx, top + (bot - top) * .54); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#f2e8ff"; ctx.fillRect(fx - 1, top, 1.6, bot - top);
}
function bombCvDraw(){
  const B = BC, st = bombState;
  if (!B.cv || !B.cv.isConnected || !B.own || !B.ctx || !B.cssW) return;
  const ctx = B.ctx, px = B.px, W = B.W, H = B.H, vw = B.cssW, vh = B.cssH, dpr = B.dpr;
  const sl = B.wrap.scrollLeft, stp = B.wrap.scrollTop;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1;
  ctx.fillStyle = BOMB_CV.bg; ctx.fillRect(0, 0, vw, vh);
  const c0 = Math.max(0, Math.floor(sl / px)), c1 = Math.min(W - 1, Math.floor((sl + vw) / px));
  const r0 = Math.max(0, Math.floor(stp / px)), r1 = Math.min(H - 1, Math.floor((stp + vh) / px));
  if (c1 < c0 || r1 < r0) return;
  const gap = px >= 10 ? 1 : 0, xs = B.xs, ys = B.ys;
  for (let c = c0; c <= c1 + 1; c++) xs[c] = Math.round(c * px) - sl;
  for (let r = r0; r <= r1 + 1; r++) ys[r] = Math.round(r * px) - stp;
  const own = B.own, num = B.num, bomb = B.bomb, sp = B.sp, zc = B.zc, zoneOn = B.zoneOn;
  const spotId = st.spot ? (B.nameIdx.get(st.spot) || -1) : 0;
  // 第 1 步：依「顏色」分組，同一種顏色只設定一次 fillStyle（比逐格設定快很多）
  const groups = new Map();
  for (let r = r0; r <= r1; r++) {
    const base = r * W;
    for (let c = c0; c <= c1; c++) {
      const i = base + c, o = own[i];
      let key;
      if (!o) key = zoneOn ? zc[i] : 0;
      else if (bomb[i]) key = -1;
      else if (sp[i]) key = 4 + sp[i];
      else key = 10 + o * 2 + (num[i] === 0 ? 1 : 0);
      if (o && spotId && o !== spotId) key += 100000;   // 「只看某人領地」：其他人變暗
      let g = groups.get(key); if (!g) { g = []; groups.set(key, g); } g.push(i);
    }
  }
  groups.forEach((list, key) => {
    const dim = key >= 99999, k = dim ? key - 100000 : key, merge = k >= 12 && gap > 0;
    ctx.globalAlpha = dim ? 0.2 : 1; ctx.fillStyle = bombCvColor(k);
    for (let n = 0; n < list.length; n++) {
      const i = list[n], r = (i / W) | 0, c = i - r * W, x = xs[c], y = ys[r], w = xs[c + 1] - x, h = ys[r + 1] - y;
      if (merge) {   // 同一個人相連的格子：把中間的格線補起來，連成一整片領地
        const o = own[i], sr = c < W - 1 && own[i + 1] === o && !bomb[i + 1], sb = r < H - 1 && own[i + W] === o && !bomb[i + W];
        ctx.fillRect(x, y, w - (sr ? 0 : gap), h - (sb ? 0 : gap));
        if (sr && sb && own[i + W + 1] === o && !bomb[i + W + 1]) ctx.fillRect(x + w - gap, y + h - gap, gap, gap);
      } else ctx.fillRect(x, y, w - gap, h - gap);
    }
  });
  ctx.globalAlpha = 1;
  if (px >= 14) {   // 沒翻開的格子：上緣一條細亮線，看起來像微微凸起
    ctx.fillStyle = "rgba(255,255,255,.09)";
    for (let k = 0; k < 4; k++) { const list = groups.get(k); if (!list) continue; for (let n = 0; n < list.length; n++) { const i = list[n], r = (i / W) | 0, c = i - r * W; ctx.fillRect(xs[c], ys[r], xs[c + 1] - xs[c] - gap, 1); } }
  }
  // 第 2 步：數字、炸彈、旗標
  const flags = st.flags, showNum = px >= 9, specials = [];
  if (showNum) bombCvGlyphs();
  const gs = B.gs;
  for (let r = r0; r <= r1; r++) {
    const base = r * W;
    for (let c = c0; c <= c1; c++) {
      const i = base + c, o = own[i], x = xs[c], y = ys[r], w = xs[c + 1] - x - gap, h = ys[r + 1] - y - gap;
      if (!o) { if (flags[i]) bombCvFlag(ctx, x, y, w, h); continue; }
      if (spotId && o !== spotId) continue;
      if (bomb[i]) {
        if (gap) { ctx.lineWidth = 2; ctx.strokeStyle = bombCvCols(o).frame; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2); }   // 誰踩到的：外框用他的顏色
        const m = Math.max(2, w * .28); ctx.lineWidth = Math.max(1.5, w * .1); ctx.strokeStyle = "#fff";
        ctx.beginPath(); ctx.moveTo(x + m, y + m); ctx.lineTo(x + w - m, y + h - m); ctx.moveTo(x + w - m, y + m); ctx.lineTo(x + m, y + h - m); ctx.stroke();
        continue;
      }
      const n = num[i];
      if (n > 0 && showNum) ctx.drawImage(B.glyph[n], Math.round((x + (w - gs) / 2) * dpr) / dpr, Math.round((y + (h - gs) / 2) * dpr) / dpr, gs, gs);
      if (B.typ[i] || sp[i]) specials.push(i);
    }
  }
  // 第 3 步：寶箱／護盾／連鎖、神秘碎片、羽毛的標記
  for (let n = 0; n < specials.length; n++) {
    const i = specials[n], r = (i / W) | 0, c = i - r * W, x = xs[c], y = ys[r], w = xs[c + 1] - x - gap, h = ys[r + 1] - y - gap, t = B.typ[i];
    if (t) {
      const col = BOMB_CV.typeCol[t]; ctx.fillStyle = col; ctx.strokeStyle = col;
      if (px < 10) ctx.fillRect(x + w * .25, y + h * .25, w * .5, h * .5);
      else {
        ctx.lineWidth = 1; ctx.strokeRect(x + .5, y + .5, w - 1, h - 1);
        ctx.beginPath(); ctx.arc(x + w - 3.5, y + 3.5, 2.2, 0, 6.2832); ctx.fill();
        if (px >= 22) { ctx.font = Math.round(px * .36) + "px sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText(BOMB_CV.typeIcon[t], x + 2, y + 1); }
      }
    }
    if (sp[i] && px >= 10) { ctx.fillStyle = "#fff"; ctx.font = "700 " + Math.round(px * .45) + "px sans-serif"; ctx.textAlign = "right"; ctx.textBaseline = "bottom"; ctx.fillText("★", x + w - 1, y + h); }
  }
  // 第 4 步：選取框
  const sel = st.selected;
  if (sel != null && sel >= 0 && sel < B.N) {
    const r = (sel / W) | 0, c = sel - r * W;
    if (c >= c0 && c <= c1 && r >= r0 && r <= r1) {
      const x = xs[c], y = ys[r], w = xs[c + 1] - x - gap, h = ys[r + 1] - y - gap;
      ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,.65)"; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      ctx.lineWidth = 2; ctx.strokeStyle = "#fff"; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    }
  }
  // 第 5 步：剛翻開的格子閃一下（只閃最多 60 格、0.4 秒）
  if (B.flash.size) {
    const now = performance.now();
    B.flash.forEach((v, i) => {
      const age = now - v[0];
      if (age > 420) { B.flash.delete(i); return; }
      const r = (i / W) | 0, c = i - r * W;
      if (c < c0 || c > c1 || r < r0 || r > r1) return;
      const k = age / 420, e = (1 - k) * px * .3, x = xs[c], y = ys[r];
      ctx.globalAlpha = (1 - k) * .85; ctx.fillStyle = v[1] ? "#ff6a5a" : "#ffffff";
      ctx.fillRect(x - e, y - e, xs[c + 1] - x - gap + 2 * e, ys[r + 1] - y - gap + 2 * e);
    });
    ctx.globalAlpha = 1;
    if (B.flash.size) bombCvInvalidate();
  }
}
// 手指／滑鼠點在哪一格（回傳格子編號，點在地圖外回傳 -1）
function bombCvHit(ev){
  const B = BC; if (!B.cv || !ev || !B.cv.isConnected) return -1;
  const rc = B.cv.getBoundingClientRect();
  const gx = ev.clientX - rc.left + B.wrap.scrollLeft, gy = ev.clientY - rc.top + B.wrap.scrollTop;
  if (gx < 0 || gy < 0) return -1;
  const c = Math.floor(gx / B.px), r = Math.floor(gy / B.px);
  if (c >= B.W || r >= B.H) return -1;
  return r * B.W + c;
}
function bombCvHover(ev){   // 滑鼠移到格子上：顯示誰翻開的（觸控裝置用點選看詳情）
  if (!ev || ev.pointerType !== "mouse" || !BC.cv) return;
  const i = bombCvHit(ev); if (i === BC.hover) return; BC.hover = i;
  const c = i >= 0 ? bombState.cells[i] : null;
  BC.cv.title = c ? (c.revealed_by_name || "?") + (c.is_bomb ? " 💣" : typeof c.nearby_count === "number" ? dc("　周圍炸彈 ", "  nearby bombs ") + c.nearby_count : "") : "";
}
const bombState = {
  mapId: null, width: 0, height: 0, totalCells: 0, bombCount: 0,
  revealedSafeCount: 0, status: "active", cells: {}, lastSeenAt: null,
  leaderboard: [], settings: null, shieldCount: 0,
  cellPx: 16, quick: false, selected: null, selHidden: false, flags: {}, flagsFor: null, prefsLoaded: false, numbersSupported: null, suppressClick: false, flagMode: false, pressId: 0, flagPress: -1,
  zones: null, zonesKey: null, zonesOn: true, zonesUnavailable: null,
  dayEnd: null, congratsPending: false,
  shardsTotal: 0, shardsFound: 0, shardSupported: null
};
let bombActionBusy = false;
const BOMB_DEATH_COOLDOWN_DEFAULT_SEC = 30;
const BOMB_RANK_SHARDS = [3, 2, 1];   // 一輪結束時，金幣第 1／2／3 名各拿到的神秘碎片數量

async function bombFetch(path, opts){
  opts = opts || {};
  const res = await fetch(`${BOMB_URL}${path}`, { ...opts, headers: { ...BOMB_HEADERS, ...(opts.headers||{}) }, cache: "no-store" });
  if (!res.ok) throw new Error("bomb fetch failed: " + res.status);
  return res.json();
}
async function bombRpc(fn, body){
  return bombFetch(`/rest/v1/rpc/${fn}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body||{}) });
}
async function bombGetActiveMap(){
  return bombRpc("bomb_ensure_active_map", {});
}
async function bombRevealCell(mapId, cellIndex, streakBefore){
  const rows = await bombRpc("bomb_reveal", { p_map_id: mapId, p_cell_index: cellIndex, p_player_id: zl.nickname, p_display_name: zl.nickname, p_streak_before: streakBefore });
  return rows[0];
}
async function bombFetchRevealedSince(mapId, since){
  const q = since ? `&revealed_at=gt.${encodeURIComponent(since)}` : "";
  const base = `/rest/v1/bomb_map_cells?map_id=eq.${mapId}&revealed=eq.true${q}&order=revealed_at.asc&limit=2000&select=cell_index,is_bomb,revealed_by_name,revealed_at,cell_type`;
  if (bombState.numbersSupported !== false) {
    if (bombState.featherSupported !== false && bombState.shardSupported !== false) {   // 🕊️ 羽毛欄位（feather_hint / is_feather）：伺服器還沒裝 v3 就退回碎片版
      try { const rows = await bombFetch(base + ",nearby_count,shard_hint,is_shard,feather_hint,is_feather"); bombState.numbersSupported = true; bombState.shardSupported = true; bombState.featherSupported = true; return rows; }
      catch (err) { if (!/ (400|401|403|404)\b/.test(String(err && err.message))) throw err; bombState.featherSupported = false; }
    }
    if (bombState.shardSupported !== false) {   // 神秘碎片欄位（shard_hint / is_shard）：伺服器還沒裝補丁就退回原本的畫法
      try { const rows = await bombFetch(base + ",nearby_count,shard_hint,is_shard"); bombState.numbersSupported = true; bombState.shardSupported = true; return rows; }
      catch (err) { if (!/ (400|401|403|404)\b/.test(String(err && err.message))) throw err; bombState.shardSupported = false; }
    }
    try { const rows = await bombFetch(base + ",nearby_count"); bombState.numbersSupported = true; return rows; }
    catch (err) { if (!/ (400|401|403|404)\b/.test(String(err && err.message))) throw err; bombState.numbersSupported = false; }   // 伺服器還沒裝 nearby_count 欄位：退回原本的畫法，遊戲照常可玩
  }
  return bombFetch(base);
}
// 剛翻開的格子（和連鎖翻開的格子）馬上去讀它們的數字／碎片提示，不用等下一次輪詢
const bombNumRetry = { q: new Set(), timer: null, tries: {} };
function bombQueueNumberRetry(idx){
  const R = bombNumRetry;
  if (bombState.numbersSupported === false || (R.tries[idx] || 0) >= 2) return;
  R.tries[idx] = (R.tries[idx] || 0) + 1; R.q.add(idx);
  if (R.timer) return;
  R.timer = setTimeout(() => { R.timer = null; const a = Array.from(R.q).slice(0, 300); R.q.clear(); if (a.length) bombRefreshNumbers(a); }, 2500);
}
async function bombRefreshNumbers(idxs){
  if (bombState.numbersSupported === false || !bombState.mapId || !idxs || !idxs.length) return;
  try {
    const cols = bombState.shardSupported === false ? "cell_index,nearby_count" : bombState.featherSupported === false ? "cell_index,nearby_count,shard_hint,is_shard" : "cell_index,nearby_count,shard_hint,is_shard,feather_hint,is_feather";
    const rows = await bombFetch(`/rest/v1/bomb_map_cells?map_id=eq.${bombState.mapId}&cell_index=in.(${idxs.join(",")})&select=${cols}`);
    rows.forEach(r => {
      const c = bombState.cells[r.cell_index];
      if (!c) return;
      if (typeof r.nearby_count === "number") c.nearby_count = r.nearby_count;
      if ("shard_hint" in r) { c.shard_hint = (typeof r.shard_hint === "number") ? r.shard_hint : null; c.is_shard = !!r.is_shard; }
      if ("feather_hint" in r) { c.feather_hint = (typeof r.feather_hint === "number") ? r.feather_hint : null; c.is_feather = !!r.is_feather; }
      bombApplyCellDom(c);
    });
  } catch (err) { idxs.forEach(i => bombQueueNumberRetry(i)); }
}
async function bombFetchMyShields(playerId){
  try {
    const rows = await bombFetch(`/rest/v1/bomb_player_state?player_id=eq.${encodeURIComponent(playerId)}&select=shield_count`);
    return rows[0] ? (rows[0].shield_count || 0) : 0;
  } catch (err) {
    return 0;
  }
}
async function bombFetchMapMeta(mapId){
  if (bombState.metaColsOk !== false) {
    try {
      const rows = await bombFetch(`/rest/v1/bomb_maps?map_id=eq.${mapId}&select=map_id,status,created_at,total_cells,bomb_count,revealed_safe_count,shards_total,shards_found,feathers_total,feathers_found`);
      bombState.metaColsOk = true;
      return rows[0] || null;
    } catch (err) {
      if (!/ (400|401|403|404)\b/.test(String(err && err.message))) throw err;
      bombState.metaColsOk = false;   // 伺服器還沒有某些欄位：退回 select=*
    }
  }
  const rows = await bombFetch(`/rest/v1/bomb_maps?map_id=eq.${mapId}&select=*`);
  return rows[0] || null;
}
async function bombFetchLeaderboard(mapId){
  return bombFetch(`/rest/v1/bomb_leaderboard_entries?map_id=eq.${mapId}&order=gold_this_round.desc&limit=10&select=display_name,gold_this_round,best_streak_this_round,death_count_this_round`);
}
async function bombFetchLeaderboardByDeaths(mapId){
  return bombFetch(`/rest/v1/bomb_leaderboard_entries?map_id=eq.${mapId}&order=death_count_this_round.desc&limit=10&select=display_name,gold_this_round,best_streak_this_round,death_count_this_round`);
}
async function bombFetchSettings(){
  const rows = await bombFetch(`/rest/v1/bomb_settings?select=*`);
  return rows[0] || { width: 75, height: 75, bomb_density: 0.20, schedule_enabled: false, open_start_hour: 0, open_start_minute: 0, open_end_hour: 0, open_end_minute: 0, reward_base: 100, reward_cap: 5000, death_cooldown_minutes: BOMB_DEATH_COOLDOWN_DEFAULT_SEC,
    outer_bomb_mult: 1.0, middle_bomb_mult: 1.0, core_bomb_mult: 1.0, outer_reward_mult: 1.0, middle_reward_mult: 1.0, core_reward_mult: 1.0,
    intel_card_chance: 0.08, treasure_cell_chance: 0.03, treasure_reward_mult_min: 2, treasure_reward_mult_max: 5, shield_cell_chance: 0.02, chain_cell_chance: 0.03, chain_reveal_min: 1, chain_reveal_max: 2 };
}
async function bombUpdateSettings(width, height, density, scheduleEnabled, openStartHour, openStartMinute, openEndHour, openEndMinute, rewardBase, rewardCap, deathCooldownMinutes){
  return bombRpc("bomb_update_settings", {
    p_width: width, p_height: height, p_bomb_density: density,
    p_schedule_enabled: scheduleEnabled,
    p_open_start_hour: openStartHour, p_open_start_minute: openStartMinute,
    p_open_end_hour: openEndHour, p_open_end_minute: openEndMinute,
    p_reward_base: rewardBase, p_reward_cap: rewardCap,
    p_death_cooldown_minutes: deathCooldownMinutes
  });
}
async function bombForceEndRound(){
  return bombRpc("bomb_force_end_round", {});
}
function bombScheduleOpen(){
  const s = bombState.settings;
  if (!s || !s.schedule_enabled) return true;
  const t = hs();
  const mins = t.hour * 60 + t.minute;
  const start = (s.open_start_hour || 0) * 60 + (s.open_start_minute || 0);
  const end = (s.open_end_hour || 0) * 60 + (s.open_end_minute || 0);
  if (start === end) return true;
  return start < end ? (mins >= start && mins < end) : (mins >= start || mins < end);
}

/* ---- 每日封號結算：炸彈探索王 / 踩雷之王（仿萬物熔爐 afSettleDay/afEnsureMySettlement 的作法） ---- */
function bombRoundKey(){
  const s = bombState.settings;
  if (s && s.schedule_enabled) {
    const t = hs();
    const mins = t.hour * 60 + t.minute;
    const start = (s.open_start_hour || 0) * 60 + (s.open_start_minute || 0);
    if (mins < start) return ys(Date.now() - 864e5);
  }
  return ys();
}
function bombSettledKey(roundKey){ return `config:bomb_round_settle:${roundKey}`; }
async function bombTryClaimSettlement(roundKey){
  // 原子搶結算權：只「新增」、不覆蓋。key 已存在時伺服器回空陣列 → 這個人沒搶到。
  // （舊寫法用 Vl：key 還不存在時它是無條件 upsert，同時結算的兩個人都會以為自己搶到 → 碎片發兩次）
  const res = await fetch(`${BOMB_URL}/rest/v1/kv_store`, {
    method: "POST",
    headers: { ...BOMB_HEADERS, "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify({ key: bombSettledKey(roundKey), value: JSON.stringify({ settledAt: Date.now() }), updated_at: new Date().toISOString() }),
    cache: "no-store"
  });
  if (!res.ok) throw new Error("bomb claim failed: " + res.status);
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0;
}
function bombRankByGold(list){   // 本輪金幣前三名（同分隨機排先後），回傳暱稱陣列
  const seen = new Set(), arr = [];
  (list || []).forEach(e => { if ((e.gold_this_round || 0) <= 0) return; const k = String(e.display_name || "").toLowerCase(); if (seen.has(k)) return; seen.add(k); arr.push(e); });
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  arr.sort((a, b) => (b.gold_this_round || 0) - (a.gold_this_round || 0));
  return arr.slice(0, BOMB_RANK_SHARDS.length).map(e => e.display_name);
}
function bombPickTitleWinner(list, field){
  const eligible = (list || []).filter(e => (e[field] || 0) > 0);
  if (!eligible.length) return null;
  const maxVal = Math.max(...eligible.map(e => e[field] || 0));
  const winners = eligible.filter(e => (e[field] || 0) === maxVal);
  return winners[Math.floor(Math.random() * winners.length)].display_name;
}
/* ---- 🧩 神秘碎片發放 ---- */
// onceKey（選填）：同一個 key 在玩家存檔裡只會發一次（冪等性記在玩家自己的存檔，跟擂臺賽 tourneyPaid 同一套做法）
async function bombGrantShard(nick, qty, source, onceKey){
  qty = Math.floor(Number(qty) || 0);
  if (!nick || qty <= 0) return false;
  let granted = false;
  const upd = await Wl(nick, p => {
    granted = false;   // Wl 撞版本重試時要歸零
    p.materials = p.materials || {};
    if (onceKey) {
      if (!p.bombPaid || typeof p.bombPaid !== "object") p.bombPaid = {};
      if (p.bombPaid[onceKey]) return;   // 這一輪已經發過了
      p.bombPaid[onceKey] = Date.now();
      const ks = Object.keys(p.bombPaid).sort((a, b) => p.bombPaid[a] - p.bombPaid[b]);
      while (ks.length > 40) delete p.bombPaid[ks.shift()];   // 只留最近 40 筆
    }
    p.materials.mysteryShard = (p.materials.mysteryShard || 0) + qty;
    granted = true;
  });
  if (!upd) return false;
  if (zl.nickname && String(nick).toLowerCase() === zl.nickname.toLowerCase()) zl.player = upd;
  if (!granted) return false;
  try { await shardNotify(nick, qty, source); } catch (e) {}
  return true;
}
/* ---- 🏆 每日排行榜名次碎片獎勵（三消／煉金藥水／塔羅彈珠共用；數量由各玩法 GM 面板設定）---- */
function rankShardParse(v, def){
  if (!Array.isArray(v) || v.length !== 3) return def.slice();
  const o = v.map(x => Math.max(0, Math.floor(Number(x) || 0)));
  return o;
}
async function rankShardPayout(game, dateKey, list, ranks){
  for (let i = 0; i < 3; i++) {
    const nick = list && list[i] && list[i].nick, q = ranks[i];
    if (!nick || !(q > 0)) continue;
    try { await bombGrantShard(nick, q, game + "_rank", game + "_rank" + (i + 1) + ":" + dateKey); } catch (e) { /* 發碎片失敗不擋結算 */ }
  }
}
function rankShardHint(ranks){
  return dc(`每日名次獎勵：🥇 ${ranks[0]}｜🥈 ${ranks[1]}｜🥉 ${ranks[2]} 個 🧩 神秘碎片（隔天結算，直接放進背包）。`,
            `Daily rank rewards: 🥇 ${ranks[0]} | 🥈 ${ranks[1]} | 🥉 ${ranks[2]} 🧩 Mystery Shards (settled the next day, delivered to your bag).`);
}
function rankShardGmHtml(prefix, ranks){
  const inp = i => `<input type="number" id="${prefix}-gm-rs${i}" value="${ranks[i]}" min="0" step="1" style="width:70px;" />`;
  return `<div><label>${dc("每日名次神秘碎片：第 1／2／3 名", "Daily rank Mystery Shards: 1st / 2nd / 3rd")}</label>${inp(0)} ${inp(1)} ${inp(2)}</div>`;
}
function rankShardGmRead(root, prefix, ranks){
  const out = ranks.slice();
  for (let i = 0; i < 3; i++) {
    const el = root.querySelector(`#${prefix}-gm-rs${i}`);
    const v = el ? parseInt(el.value, 10) : NaN;
    if (!isNaN(v) && v >= 0) out[i] = v;
  }
  return out;
}
// 向伺服器領「我翻到、還沒領」的隱藏碎片（伺服器端原子標記，不會重複領）
async function bombClaimAndGrantShards(){
  if (!zl.nickname || bombState.shardSupported === false) return 0;
  let n = 0;
  try { n = Number(await bombRpc("bomb_claim_shards", { p_player_id: zl.nickname })) || 0; } catch (e) { return 0; }
  if (n > 0) {
    const ok = await bombGrantShard(zl.nickname, n, "bomb_hidden");
    if (ok) { ac(dc(`🧩 神秘碎片 ×${n} 已放進背包！`, `🧩 Mystery Shard ×${n} added to your inventory!`)); Au(); }
  }
  return n;
}
/* ---- 🕊️ 羽毛發放 ---- */
async function bombGrantFeathers(nick, qty){
  qty = Math.floor(Number(qty) || 0);
  if (!nick || qty <= 0) return false;
  const upd = await Wl(nick, p => { p.feathers = (p.feathers || 0) + qty; });
  if (!upd) return false;
  if (zl.nickname && String(nick).toLowerCase() === zl.nickname.toLowerCase()) zl.player = upd;
  return true;
}
// 向伺服器領「我翻到、還沒領」的羽毛（伺服器端原子標記，回傳這次要發的羽毛總數；不會重複領）
async function bombClaimAndGrantFeathers(){
  if (!zl.nickname || bombState.featherSupported === false) return 0;
  let n = 0;
  try { n = Number(await bombRpc("bomb_claim_feathers", { p_player_id: zl.nickname })) || 0; } catch (e) { return 0; }
  if (n > 0) {
    const ok = await bombGrantFeathers(zl.nickname, n);
    if (ok) { ac(dc(`🕊️ 羽毛 ×${n} 已放進背包！`, `🕊️ Feathers ×${n} added to your inventory!`)); Au(); }
  }
  return n;
}
async function bombSettleRound(roundKey){
  const de = (bombState.dayEnd && bombState.dayEnd.roundKey === roundKey) ? bombState.dayEnd : null;
  if (!de && !bombState.mapId) return null;
  if (!(await bombTryClaimSettlement(roundKey))) return null;
  try {
    const [byGold, byDeaths] = de
      ? [de.leaderboard || [], de.leaderboard || []]
      : await Promise.all([
          bombFetchLeaderboard(bombState.mapId),
          bombFetchLeaderboardByDeaths(bombState.mapId)
        ]);
    const ranked = bombRankByGold(byGold);
    const explorer = ranked.length ? ranked[0] : null;
    const victim = bombPickTitleWinner(byDeaths, "death_count_this_round");
    if (explorer) await setTitleHolder("bombExplorer", explorer);
    for (let i = 0; i < ranked.length && i < BOMB_RANK_SHARDS.length; i++) {   // 一輪結束：金幣第 1／2／3 名發神秘碎片
      try { await bombGrantShard(ranked[i], BOMB_RANK_SHARDS[i], "bomb_rank" + (i + 1), "bomb_rank" + (i + 1) + ":" + roundKey); } catch (e) { /* 發碎片失敗不擋結算 */ }
    }
    if (victim) await setTitleHolder("bombVictim", victim);
    return { explorer, victim };
  } catch (err) {
    return null;
  }
}
async function bombEnsureRoundSettled(){
  if (bombState.dayEnd) { try { await bombSettleRound(bombState.dayEnd.roundKey); } catch (err) { /* ignore */ } return; }
  if (!bombState.settings || !bombState.settings.schedule_enabled) return;
  if (bombScheduleOpen()) return;
  if (!bombState.mapId) return;
  try { await bombSettleRound(bombRoundKey()); } catch (err) { /* ignore — retry next poll */ }
}

/* ---- 前一天沒清完的地圖：換日後自動換新地圖 ---- */
let bombRolloverBusy = false;
function bombRoundKeyAt(ts){
  const s = bombState.settings;
  if (s && s.schedule_enabled) {
    const t = hs(ts), mins = t.hour * 60 + t.minute;
    const start = (s.open_start_hour || 0) * 60 + (s.open_start_minute || 0);
    if (mins < start) return ys(ts - 864e5);
  }
  return ys(ts);
}
async function bombMapRoundKey(map){
  if (map && map.created_at) { const ts = Date.parse(map.created_at); if (!isNaN(ts)) return bombRoundKeyAt(ts); }
  try {
    const raw = await Vl("config:bomb_map_round:" + map.map_id, v => v ? v : JSON.stringify({ roundKey: bombRoundKey(), at: Date.now() }), "");
    const o = JSON.parse(raw);
    return (o && o.roundKey) || null;
  } catch (err) { return null; }
}
async function bombCheckStaleMap(map){
  if (bombRolloverBusy || !map || !map.map_id || map.status === "finished") return false;
  if (!bombState.settings) { try { bombState.settings = await bombFetchSettings(); } catch (err) {} }
  const oldKey = await bombMapRoundKey(map);
  if (!oldKey || oldKey === bombRoundKey()) return false;
  bombRolloverBusy = true;
  try {
    let claimed = false;
    await Vl("config:bomb_rollover:" + map.map_id, v => {
      let o = null; try { o = v ? JSON.parse(v) : null; } catch (e) {}
      if (o && Date.now() - (o.at || 0) < 60000) return v;
      claimed = true; return JSON.stringify({ at: Date.now() });
    }, "");
    if (claimed) {
      try { await bombSettleRound(oldKey); } catch (err) { /* 封號結算失敗不擋換圖 */ }
      await bombForceEndRound();
      ac(dc("🌅 新的一天！昨天沒清完的數字炸彈地圖已自動換成新地圖", "🌅 New day! Yesterday's unfinished Bomb Map was replaced with a fresh one"));
    }
    bombState.dayEnd = null; bombState.mapId = null; bombState.cells = {}; bombState.lastSeenAt = null; bombState.selected = null;
    await bombLoadSnapshot();
    return true;
  } catch (err) {
    return false;
  } finally {
    bombRolloverBusy = false;
  }
}

/* ---- 100% 完成 → 當天結束 ---- */
function bombDayEndKey(rk){ return `config:bomb_day_end:${rk}`; }
async function bombReadDayEnd(rk){
  try {
    const r = await Kl(bombDayEndKey(rk));
    if (!r || !r.value) return null;
    const o = typeof r.value === "string" ? JSON.parse(r.value) : r.value;
    return (o && !o.cleared && o.roundKey) ? o : null;
  } catch (err) { return null; }
}
function bombLastRevealer(){
  let best = null;
  Object.keys(bombState.cells).forEach(k => {
    const c = bombState.cells[k];
    if (c && !c.is_bomb && c.revealed_by_name && (!best || c.revealed_at > best.revealed_at)) best = c;
  });
  return best ? best.revealed_by_name : null;
}
async function bombEndDay(oldMapId){
  const rk = bombRoundKey();
  let lb = [];
  try { lb = await bombFetch(`/rest/v1/bomb_leaderboard_entries?map_id=eq.${oldMapId}&order=gold_this_round.desc&limit=200&select=display_name,gold_this_round,best_streak_this_round,death_count_this_round`); } catch (err) { lb = []; }
  if (!lb || !lb.length) lb = (bombState.leaderboard || []).slice();
  const rec = { roundKey: rk, mapId: oldMapId, finishedAt: Date.now(), finisher: bombLastRevealer(), totalCells: bombState.totalCells, bombCount: bombState.bombCount, leaderboard: lb };
  try { await Vl(bombDayEndKey(rk), v => v ? v : JSON.stringify(rec), ""); } catch (err) { /* fall through: use local copy */ }
  return (await bombReadDayEnd(rk)) || rec;   // 先寫入的人為準，大家看到同一份結果
}
function bombApplyDayEnd(rec, fresh){
  bombState.dayEnd = rec;
  bombState.leaderboard = (rec.leaderboard || []).slice(0, 10);
  bombState.selected = null;
  if (fresh && !bombLsGet("bomb-congrats:" + rec.roundKey)) bombState.congratsPending = true;
  bombEnsureRoundSettled();   // 當天結束就立刻結算兩個封號（不用等到關閉時段）
  if ("bomb" === zl.tab) Bu();
}
async function bombHandleMapFinished(oldMapId){
  let rec = await bombReadDayEnd(bombRoundKey());
  if (!rec) rec = await bombEndDay(oldMapId);
  bombApplyDayEnd(rec, true);
}
function bombNextOpenText(){
  const s = bombState.settings, t = hs();
  if (s && s.schedule_enabled) {
    const start = (s.open_start_hour || 0) * 60 + (s.open_start_minute || 0);
    const hh = String(s.open_start_hour || 0).padStart(2, "0"), mm = String(s.open_start_minute || 0).padStart(2, "0");
    const isToday = (t.hour * 60 + t.minute) < start;
    return dc(`${isToday ? "今天" : "明天"} ${hh}:${mm}`, `${isToday ? "today" : "tomorrow"} ${hh}:${mm}`);
  }
  return dc("明天", "tomorrow");
}
function bombBuildDayEndHtml(){
  const de = bombState.dayEnd;
  const gm = (typeof ku === "function" && ku());
  const finisher = de.finisher ? Iu(de.finisher) : "?";
  return `<div class="panel" style="text-align:center;border-color:var(--gold);">
    <h2>🎉 ${dc("全服數字炸彈：今日完成！", "Bomb Map: cleared for today!")}</h2>
    <div style="font-size:1.6em;margin:8px 0;">100% ✅</div>
    <div>${dc("全服玩家合力清空了今天的地圖", "Everyone worked together and cleared today's map")}${de.finisher ? dc(`，最後一格由 <b>${finisher}</b> 翻開`, `, the last cell was opened by <b>${finisher}</b>`) : ""}</div>
    <div style="margin-top:6px;color:var(--muted);">${dc("今日已結束，下一場開放時間：", "Today's round is over. Next round: ")}${bombNextOpenText()}</div>
    ${gm ? `<button class="btn" id="bomb-gm-reopen" style="margin-top:10px;">🔄 ${dc("GM：重新開放今日", "GM: reopen today")}</button>` : ""}
  </div>
  <div class="panel"><h3>${dc("本輪排行榜", "Round leaderboard")}</h3><div id="bomb-lb-list">${bombLeaderboardRowsHtml()}</div></div>`;
}
function bombWireDayEnd(root){
  const b = root.querySelector("#bomb-gm-reopen");
  if (!b) return;
  b.onclick = async () => {
    const ok = await ic(dc("確定要重新開放今天嗎？將取消「今日已完成」的狀態，大家可以繼續玩目前的新地圖。", "Reopen today? This clears the 'completed' state and players continue on the current map."));
    if (!ok) return;
    try {
      const rk = bombState.dayEnd.roundKey;
      await Vl(bombDayEndKey(rk), () => JSON.stringify({ cleared: true, at: Date.now() }), "");
      bombState.dayEnd = null; bombState.mapId = null; bombState.cells = {}; bombState.lastSeenAt = null;
      ac(dc("已重新開放", "Reopened"));
      await bombLoadSnapshot();
    } catch (err) { ac(dc("操作失敗", "Action failed")); }
  };
}
function bombShowCongrats(){
  const de = bombState.dayEnd;
  if (!de || document.getElementById("bomb-congrats")) return;
  bombState.congratsPending = false;
  bombLsSet("bomb-congrats:" + de.roundKey, "1");
  const top = (de.leaderboard || []).slice(0, 3).map((r, i) => `<div style="margin:2px 0;">${["🥇","🥈","🥉"][i]} ${Iu(r.display_name)} <span style="opacity:.8">✦${r.gold_this_round}</span></div>`).join("");
  const ov = document.createElement("div");
  ov.id = "bomb-congrats";
  ov.style.cssText = "position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:16px;";
  ov.innerHTML = `<div style="max-width:360px;width:100%;background:var(--panel,#1e1b2e);color:var(--text,#fff);border:2px solid var(--gold,#e6c34a);border-radius:16px;padding:22px 18px;text-align:center;box-shadow:0 8px 40px rgba(0,0,0,.6);">
    <div style="font-size:48px;line-height:1;">🎉🎊</div>
    <h2 style="margin:10px 0 4px;">${dc("恭喜全服完成！", "Congratulations!")}</h2>
    <div style="font-size:1.4em;font-weight:700;margin-bottom:8px;">${dc("進度 100%", "Progress 100%")}</div>
    <div style="margin-bottom:8px;">${dc("今天的數字炸彈地圖已全部清空", "Today's Bomb Map has been fully cleared")}${de.finisher ? "<br>" + dc(`最後一格：<b>${Iu(de.finisher)}</b>`, `Last cell: <b>${Iu(de.finisher)}</b>`) : ""}</div>
    ${top ? `<div style="margin:10px 0;padding:8px;border-radius:10px;background:rgba(255,255,255,.07);">${top}</div>` : ""}
    <div style="color:var(--muted,#aaa);font-size:.9em;margin-bottom:12px;">${dc("今日已結束，下一場開放時間：", "Today is over. Next round: ")}${bombNextOpenText()}</div>
    <button class="btn" id="bomb-congrats-close">${dc("太棒了！", "Awesome!")}</button>
  </div>`;
  document.body.appendChild(ov);
  document.getElementById("bomb-congrats-close").onclick = () => ov.remove();
}

function bombNorm(e){
  ("number"!=typeof e.bombStreak||e.bombStreak<0)&&(e.bombStreak=0);
  ("number"!=typeof e.bombDeathCount||e.bombDeathCount<0)&&(e.bombDeathCount=0);
  (void 0===e.bombMapId||null!==e.bombMapId&&"string"!=typeof e.bombMapId)&&(e.bombMapId=null);
  (void 0===e.bombRevivePendingAt||null!==e.bombRevivePendingAt&&"string"!=typeof e.bombRevivePendingAt)&&(e.bombRevivePendingAt=null);
  "boolean"!=typeof e.bombDeadAwaitingPick&&(e.bombDeadAwaitingPick=!1);
}

function resetBombStateIfNewMap(player, currentMapId){
  if (!currentMapId) return;
  if (player.bombMapId !== currentMapId) {
    player.bombMapId = currentMapId;
    player.bombStreak = 0;
    player.bombDeathCount = 0;
    player.bombRevivePendingAt = null;
    player.bombDeadAwaitingPick = false;
  }
}
function countRareCards(player){
  let n = 0;
  for (const id in player.cards) {
    const def = v[id];
    if (def && def.rarity === "rare") n += player.cards[id] || 0;
  }
  return n;
}
function consumeRareCards(player, amount){
  let remaining = amount;
  for (const id of Object.keys(player.cards)) {
    if (remaining <= 0) break;
    const def = v[id];
    if (!def || def.rarity !== "rare") continue;
    const have = player.cards[id] || 0;
    if (have <= 0) continue;
    const take = Math.min(have, remaining);
    player.cards[id] = have - take;
    remaining -= take;
  }
  return remaining <= 0;
}
function bombPlayerStatus(player){
  if (!player.bombDeadAwaitingPick) return "alive";
  if (player.bombRevivePendingAt && Date.now() < Date.parse(player.bombRevivePendingAt)) return "cooling_down";
  return "revive_ready";
}
// 玩家顏色：12 個彼此分得開的色相（刻意避開金色）× 2 種明暗；「你」也用暱稱算出專屬顏色，自己的格子另外加粗外框
const BOMB_HUES = [0, 18, 100, 140, 170, 195, 215, 75, 120, 155, 30, 340];
function bombIsMe(name){ return !!(name && zl && zl.nickname && name === zl.nickname); }
function bombNameKey(name){
  let h = 0;
  const s = String(name || "?");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 24;
}
function bombNameHue(name){ return BOMB_HUES[bombNameKey(name) % 12]; }   // 每個人（包含你自己）都用暱稱算出專屬顏色
function bombNameLight(name){ return bombNameKey(name) < 12 ? 60 : 45; }
function bombFrameColor(name){ return `hsl(${bombNameHue(name)},72%,${bombNameLight(name)}%)`; }   // 格子外框（翻開者）的顏色
function bombTintColor(name){ return `hsl(${bombNameHue(name)},${bombIsMe(name) ? 50 : 38}%,${bombIsMe(name) ? 30 : 22}%)`; }   // 實色底（不用半透明疊圖層，比較不卡）   // 領地底色
function bombFrameWidth(px){ return px >= 32 ? 4 : px >= 20 ? 3 : 2; }   // 外框粗細：格子越大越粗
function bombNameColor(name){ return `hsl(${bombNameHue(name)},55%,42%)`; }
function bombLeaderboardRowsHtml(){
  return (bombState.leaderboard || []).map((row, i) => `
    <div class="bomb-lb-row${i < 3 ? " r" + (i + 1) : ""}" data-bomb-spot="${Iu(row.display_name)}" style="cursor:pointer;" title="${dc("點一下：只看他的領地", "Tap: show only their land")}">
      <span class="bomb-lb-rank">${i < 3 ? ["🥇", "🥈", "🥉"][i] : "#" + (i + 1)}</span>
      <span class="bomb-lb-avatar" style="background:${bombNameColor(row.display_name)};box-shadow:0 0 0 2px ${bombFrameColor(row.display_name)}">${Iu((row.display_name || "?").slice(0, 1))}</span>
      <span class="bomb-lb-name">${Iu(row.display_name)}</span>
      <span class="bomb-lb-gold">✦${row.gold_this_round}</span>
      <span class="bomb-lb-meta">${dc("連勝", "streak")} ${row.best_streak_this_round} · ${dc("死亡", "deaths")} ${row.death_count_this_round}</span>
    </div>`).join("") || `<div class="empty-note">${dc("目前還沒有紀錄", "No entries yet")}</div>`;
}
// ===== 炸彈地圖：畫格子（數字、顏色、旗標）=====
function bombLsGet(k){ try { return localStorage.getItem(k); } catch (e) { return null; } }
function bombLsSet(k, v){ try { localStorage.setItem(k, v); } catch (e) {} }
function bombInitPrefs(){
  if (bombState.prefsLoaded) return;
  bombState.prefsLoaded = true;
  const z = parseInt(bombLsGet("bomb-cellpx"), 10);
  if (z >= 6 && z <= 48) bombState.cellPx = z;
  bombState.quick = bombLsGet("bomb-quick") === "1";
  bombState.zonesOn = bombLsGet("bomb-zones") !== "0";   // 圈層著色預設開啟
  document.addEventListener("visibilitychange", () => { if (!document.hidden && "bomb" === zl.tab) bombFlagPull(true); });   // 切回炸彈頁面時馬上對一次旗標
}
function bombLoadFlags(){
  bombState.flags = {};
  if (!bombState.mapId) return;
  try { JSON.parse(bombLsGet("bomb-flags:" + bombState.mapId) || "[]").forEach(i => { bombState.flags[i] = 1; }); } catch (e) {}
}
function bombSaveFlags(){ bombLsSet("bomb-flags:" + bombState.mapId, JSON.stringify(Object.keys(bombState.flags).map(Number).slice(-3000))); }
// ===== 🚩 旗標同步：標記存在伺服器（bomb_flags 表），手機標的電腦也看得到 =====
// 本機（localStorage）仍然即時更新，手感不變；標記／取消標記會批次送到伺服器，並定期把伺服器上的旗標抓回來合併。
// 伺服器 SQL 還沒裝、或連續送不出去：自動停用同步，旗標照舊只存在這台裝置上（跟以前一樣）。
const bombFlagSync = { addQ: new Set(), remQ: new Set(), inflightAdd: new Set(), inflightRem: new Set(), queueMap: null, timer: null, busy: false, pulling: false, pulledFor: null, lastPullAt: 0, fails: 0, off: false };
function bombFlagSyncOn(){ return !bombFlagSync.off && !!zl.nickname && !!bombState.mapId; }
function bombFlagQueue(idx, on){
  const S = bombFlagSync, mapId = String(bombState.mapId);
  if (S.queueMap !== mapId) { S.addQ = new Set(); S.remQ = new Set(); S.queueMap = mapId; }   // 換地圖：舊地圖還沒送出的操作作廢
  if (on) { S.addQ.add(idx); S.remQ.delete(idx); } else { S.remQ.add(idx); S.addQ.delete(idx); }
  bombFlagFlushSoon();
}
function bombFlagFlushSoon(ms){
  const S = bombFlagSync;
  if (S.timer || S.off) return;
  S.timer = setTimeout(() => { S.timer = null; bombFlagFlush(); }, ms || 600);   // 連續標記幾格只送一次
}
async function bombFlagFlush(){
  const S = bombFlagSync;
  if (S.busy || S.off || !zl.nickname || !S.queueMap || (!S.addQ.size && !S.remQ.size)) return;
  S.busy = true;
  const mapId = S.queueMap;
  S.inflightAdd = S.addQ; S.inflightRem = S.remQ; S.addQ = new Set(); S.remQ = new Set();
  let ok = false;
  try {
    await bombRpc("bomb_set_flags", { p_player_id: zl.nickname, p_map_id: mapId, p_add: [...S.inflightAdd], p_remove: [...S.inflightRem] });
    ok = true; S.fails = 0;
  } catch (e) {
    if (S.queueMap === mapId) {   // 送不出去：放回佇列（送出期間又有新操作的話，以新的為準）
      S.inflightAdd.forEach(i => { if (!S.remQ.has(i)) S.addQ.add(i); });
      S.inflightRem.forEach(i => { if (!S.addQ.has(i)) S.remQ.add(i); });
    }
    if (++S.fails >= 4) S.off = true;
  } finally {
    S.inflightAdd = new Set(); S.inflightRem = new Set(); S.busy = false;
    if ((S.addQ.size || S.remQ.size) && !S.off) bombFlagFlushSoon(ok ? 600 : 4000);
  }
}
function bombSyncFlagDom(idxs){
  if (!bombGridMatchesCurrentMap()) return;
  bombCvInvalidate();
  if (bombState.selected != null && idxs.indexOf(bombState.selected) >= 0) bombUpdateActionBar();
}
async function bombFlagPull(force){
  const S = bombFlagSync;
  if (!bombFlagSyncOn() || S.pulling) return;
  if (!force && Date.now() - S.lastPullAt < 8000) return;   // 輪詢是 1.5 秒一次，旗標最多每 8 秒對一次帳
  const mapId = String(bombState.mapId);
  S.pulling = true; S.lastPullAt = Date.now();
  try {
    if (bombState.flagsFor !== bombState.mapId) { bombLoadFlags(); bombState.flagsFor = bombState.mapId; }   // 先確定本機（localStorage）的旗標已經讀進來
    const rows = await bombRpc("bomb_get_flags", { p_player_id: zl.nickname, p_map_id: mapId });
    if (String(bombState.mapId) !== mapId || !Array.isArray(rows)) return;
    S.fails = 0;
    const server = new Set(rows.map(Number)), first = S.pulledFor !== mapId;
    S.pulledFor = mapId;
    // 這台裝置「從來沒跟伺服器對過這張地圖」（例如舊版留在 localStorage 的旗標）：只存在本機的旗標上傳，不會被清掉。
    // 對過帳之後（有 bomb-flags-synced 記號）就一律以伺服器為準，別台裝置取消的旗標才不會又被這台補回去。
    if (first && bombLsGet("bomb-flags-synced:" + mapId) !== "1") Object.keys(bombState.flags).forEach(k => { if (!server.has(+k)) bombFlagQueue(+k, true); });
    if (first) bombLsSet("bomb-flags-synced:" + mapId, "1");
    const next = new Set(server);   // 之後以伺服器為準，再套用「還沒送出／送出中」的本機操作
    S.addQ.forEach(i => next.add(i)); S.inflightAdd.forEach(i => next.add(i));
    S.remQ.forEach(i => next.delete(i)); S.inflightRem.forEach(i => next.delete(i));
    const changed = [];
    next.forEach(i => { if (!bombState.flags[i]) changed.push(i); });
    Object.keys(bombState.flags).forEach(k => { if (!next.has(+k)) changed.push(+k); });
    if (changed.length) {
      bombState.flags = {}; next.forEach(i => { bombState.flags[i] = 1; });
      bombSaveFlags();
      bombSyncFlagDom(changed);
    }
  } catch (e) {
    if (++S.fails >= 4) S.off = true;
  } finally { S.pulling = false; }
}
// 一格畫成什麼樣：炸彈 💣；安全格顯示「周圍 8 格的炸彈數」（0 = 空白）；寶箱／護盾／連鎖格用底色區分；翻開的人用底部色條表示
let bombPopStamp = 0, bombPopBudget = 0;
/* ---- 🧩 隱藏的神秘碎片：場上藏 3 個，翻開附近的格子會有顏色提示（格子底部的色條） ---- */
function bombShardsActive(){ return (bombState.shardsTotal || 0) > (bombState.shardsFound || 0); }   // 還有碎片沒被找到才顯示提示
function bombShardTier(d){ return d <= 2 ? 1 : d <= 4 ? 2 : 3; }
function bombShardHintText(d){
  const tag = d <= 2 ? dc("🔥 超近", "🔥 Very close") : d <= 4 ? dc("🌡 不遠", "🌡 Getting warm") : dc("❄ 有點遠", "❄ Somewhere around");
  return dc(`🧩 ${tag}：最近的神秘碎片距離這格 ${d} 格（含斜角）`, `🧩 ${tag}: the nearest Mystery Shard is ${d} cell(s) away (diagonals count)`);
}
/* ---- 🕊️ 隱藏的羽毛：場上藏 30 根（每根 100 羽毛），翻開附近的格子會有顏色提示（格子頂部的色條） ---- */
function bombFeathersActive(){ return (bombState.feathersTotal || 0) > (bombState.feathersFound || 0); }
function bombFeatherTier(d){ return d <= 2 ? 1 : d <= 4 ? 2 : 3; }
function bombFeatherHintText(d){
  const tag = d <= 2 ? dc("🔥 超近", "🔥 Very close") : d <= 4 ? dc("🌡 不遠", "🌡 Getting warm") : dc("❄ 有點遠", "❄ Somewhere around");
  return dc(`🕊️ 附近有寶物！${tag}：最近的羽毛距離這格 ${d} 格（含斜角）`, `🕊️ Treasure nearby! ${tag}: the nearest Feather is ${d} cell(s) away (diagonals count)`);
}
function bombApplyCellDom(cellData){
  if (!BC.own || !bombGridMatchesCurrentMap()) return;
  const idx = +cellData.cell_index;
  if (!(idx >= 0 && idx < BC.N)) return;
  const r = bombCvSetCell(idx, cellData);
  if (!r) return;
  if (r === 1) bombCvFlash(idx, !!cellData.is_bomb);
  bombRefreshLegend(false);
  bombCvInvalidate();
}
let bombPaintToken = 0;
function bombPaintAll(){
  if (!BC.own || !bombGridMatchesCurrentMap()) return;
  const cells = bombState.cells;
  BC.bulk = true;
  try { for (const k in cells) { const i = +k; if (i >= 0 && i < BC.N) bombCvSetCell(i, cells[k]); } }
  finally { BC.bulk = false; }
  bombApplySpotAll(); bombRefreshLegend(true); bombCvInvalidate();
}
/* ===== 領地視覺：同一個人的格子連成一片（只畫邊界）、玩家名單、只看某人的領地 ===== */
function bombOwnerStats(){
  const C = bombState._ownerCache, ver = bombState._statsVer || 0;
  if (C && C.cells === bombState.cells && C.ver === ver) return C.res;
  const m = {};
  Object.keys(bombState.cells).forEach(k => { const c = bombState.cells[k]; if (c.is_bomb) return; const n = c.revealed_by_name || "?"; m[n] = (m[n] || 0) + 1; });
  const res = Object.entries(m).sort((a, b) => b[1] - a[1]);
  bombState._ownerCache = { cells: bombState.cells, ver: ver, res: res };
  return res;
}
function bombLegendInner(){
  const st = bombState, stats = bombOwnerStats();
  if (!stats.length) return `<span style="opacity:.7;">🗺 ${dc("還沒有人翻開格子", "Nobody has opened a cell yet")}</span>`;
  const total = stats.reduce((a, e) => a + e[1], 0);
  const chip = ([n, cnt]) => `<button class="bol-chip${bombIsMe(n) ? " me" : ""}${st.spot === n ? " on" : ""}" data-bomb-spot="${Iu(n)}" title="${dc("點一下：只看他的領地", "Tap: show only their land")} · ${Math.round(100 * cnt / total)}%"><i style="background:${bombFrameColor(n)}"></i>${Iu(n)}${bombIsMe(n) ? dc("（你）", " (you)") : ""} <b>${cnt}</b></button>`;
  const me = stats.find(e => bombIsMe(e[0])), others = stats.filter(e => !bombIsMe(e[0]));
  let shown = (me ? [me] : []).concat(others.slice(0, me ? 7 : 8));
  if (st.spot && !shown.some(e => e[0] === st.spot)) { const e = stats.find(x => x[0] === st.spot); if (e) shown.push(e); }
  const more = stats.length - shown.length;
  return `<span style="opacity:.8;">🗺 ${dc("領地（格數）", "Territory (cells)")}</span>` + shown.map(chip).join("") + (more > 0 ? `<span style="opacity:.6;">+${more}</span>` : "") +
    (st.spot ? `<button class="bol-chip" data-bomb-spot="">✕ ${dc("看全部", "Show all")}</button>` : "");
}
let bombLegendTimer = 0;
function bombRefreshLegend(now){
  const run = () => { bombLegendTimer = 0; const el = document.getElementById("bomb-owner-legend"); if (el) { const h = bombLegendInner(); if (el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; } } };
  if (now) { clearTimeout(bombLegendTimer); run(); return; }
  if (!bombLegendTimer) bombLegendTimer = setTimeout(run, 400);
}
function bombApplySpotAll(){
  const st = bombState;
  if (st.spot && !Object.keys(st.cells).some(k => (st.cells[k].revealed_by_name || "?") === st.spot)) st.spot = null;   // 換新地圖後這個人沒有領地了
  bombCvInvalidate();
}
function bombSetSpot(name){
  bombState.spot = (!name || bombState.spot === name) ? null : name;
  bombApplySpotAll(); bombRefreshLegend(true);
}
function bombWireSpot(){
  const h = ev => { const b = ev.target.closest && ev.target.closest("[data-bomb-spot]"); if (!b) return; bombSetSpot(b.dataset.bombSpot || null); if (bombState.selected != null) bombUpdateActionBar(); };
  const lg = document.getElementById("bomb-owner-legend"); if (lg) lg.onclick = h;
  const lb = document.getElementById("bomb-lb-list"); if (lb) lb.onclick = h;
}
function bombStatInner(icon, label, value, pct){
  return `<span class="bs-ico">${icon}</span><span class="bs-txt"><span class="bs-lbl">${label}</span><b class="bs-val">${value}</b></span>` + (pct != null ? `<span class="bomb-progress"><i style="width:${pct}%"></i></span>` : "");
}
function bombSetStat(id, icon, label, value, pct){
  const el = document.getElementById(id);
  if (!el) return;
  const v = el.querySelector(".bs-val");
  if (v) {
    v.textContent = value;
    const fill = el.querySelector(".bomb-progress i");
    if (fill && pct != null) fill.style.width = pct + "%";
  } else el.innerHTML = bombStatInner(icon, label, value, pct);
}
function bombUpdateProgressDom(){
  const safeTotal = bombState.totalCells - bombState.bombCount;
  const pct = safeTotal > 0 ? Math.round(100 * bombState.revealedSafeCount / safeTotal) : 0;
  bombSetStat("bomb-progress-text", "🗺", dc("本輪進度", "Round progress"), `${bombState.revealedSafeCount}/${safeTotal} (${pct}%)`, pct);
  bombSyncShardUi();
}
function bombSyncShardUi(){
  if ((bombState.shardsTotal || 0) > 0) bombSetStat("bomb-shard-text", "🧩", dc("隱藏碎片", "Hidden shards"), `${bombState.shardsFound || 0}/${bombState.shardsTotal}`);
  if ((bombState.feathersTotal || 0) > 0) bombSetStat("bomb-feather-text", "🕊️", dc("隱藏羽毛", "Hidden feathers"), `${bombState.feathersFound || 0}/${bombState.feathersTotal}`);
  const fAct = bombFeathersActive();
  if (bombState._featherActive !== fAct) {   // 最後一根羽毛被找到 → 重畫一次，把提示色條拿掉
    const fFirst = bombState._featherActive === undefined;
    bombState._featherActive = fAct;
    if (!fFirst && "bomb" === zl.tab && bombGridMatchesCurrentMap()) bombPaintAll();
  }
  const act = bombShardsActive();
  if (bombState._shardActive !== act) {   // 最後一個碎片被找到 → 重畫一次，把提示色條拿掉
    const first = bombState._shardActive === undefined;
    bombState._shardActive = act;
    if (!first && "bomb" === zl.tab && bombGridMatchesCurrentMap()) bombPaintAll();
  }
}
function bombUpdatePersonalStatsDom(){
  const p = zl.player;
  if (!p) return;
  bombSetStat("bomb-streak-text", "🔥", dc("你的連勝", "Your streak"), p.bombStreak || 0);
  bombSetStat("bomb-deaths-text", "💀", dc("本輪死亡", "Deaths this round"), p.bombDeathCount || 0);
  bombSetStat("bomb-rare-text", "🃏", dc("持有稀有卡", "Rare cards"), countRareCards(p));
  bombSetStat("bomb-shield-text", "🛡", dc("護盾庫存", "Shields"), bombState.shieldCount || 0);
}
function bombUpdateBannerDom(){
  const el = document.getElementById("bomb-banner");
  if (!el || !zl.player) return;
  if (!bombScheduleOpen()) {
    el.innerHTML = `<div class="panel" style="border-color:var(--muted);">⏸ ${dc("目前不在開放時段，暫時無法行動", "Outside the open hours — actions are paused right now")}</div>`;
    return;
  }
  const status = bombPlayerStatus(zl.player);
  if (status === "cooling_down") {
    const remainMs = Math.max(0, Date.parse(zl.player.bombRevivePendingAt) - Date.now());
    el.innerHTML = `<div class="panel" style="border-color:var(--danger);">💀 ${dc(`你已經陣亡，還需要等待 ${Zr(remainMs)} 才能復活`, `You're dead — ${Zr(remainMs)} left before you can revive`)}</div>`;
  } else if (status === "revive_ready") {
    el.innerHTML = `<div class="panel" style="border-color:var(--gold);">✨ ${dc("可以復活了！點擊地圖上任一未揭開的格子重新落地（該格也可能是炸彈）", "You can revive! Click any unrevealed cell to land there (it might also be a bomb)")}</div>`;
  } else {
    el.innerHTML = "";
  }
}
function bombUpdateLeaderboardDom(){
  const el = document.getElementById("bomb-lb-list");
  if (!el) return;
  const h = bombLeaderboardRowsHtml();
  if (el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; }
}
function bombGridMatchesCurrentMap(){
  const grid = document.getElementById("bomb-grid");
  return !!(grid && grid.dataset.mapId === bombState.mapId);
}

// 同一時間只讀一次（輪詢、畫面重繪、玩家操作同時要讀時共用同一個請求）
let bombSnapshotPromise = null;
function bombLoadSnapshot(){
  if (bombSnapshotPromise) return bombSnapshotPromise;
  bombSnapshotPromise = bombLoadSnapshotOnce().finally(() => { bombSnapshotPromise = null; });
  return bombSnapshotPromise;
}
// 自動讀取（畫面重繪、輪詢）要遵守退避時間：讀不到地圖時，等 3、6、12、24 秒（最多 30 秒）再試，不再無限立刻重試
function bombAutoLoadSnapshot(){
  if (Date.now() < (bombState.retryAt || 0)) return;
  return bombLoadSnapshot();
}
async function bombLoadSnapshotOnce(){
  try {
    const dayRec = await bombReadDayEnd(bombRoundKey());
    if (dayRec) {
      if (!bombState.settings) { try { bombState.settings = await bombFetchSettings(); } catch (err) {} }
      bombApplyDayEnd(dayRec, !bombState.dayEnd);
      return;
    }
    bombState.dayEnd = null;
    const map = await bombGetActiveMap();
    if (!map || !map.map_id) throw new Error("no active map");   // 伺服器回應了但沒有地圖（例如炸彈的 SQL 還沒裝好）也算失敗
    const isNewMap = bombState.mapId !== map.map_id;
    bombState.mapId = map.map_id;
    bombState.width = map.width;
    bombState.height = map.height;
    bombState.totalCells = map.total_cells;
    bombState.bombCount = map.bomb_count;
    bombState.revealedSafeCount = map.revealed_safe_count;
    if (typeof map.shards_total === "number") { bombState.shardsTotal = map.shards_total; bombState.shardsFound = map.shards_found || 0; }
    if (typeof map.feathers_total === "number") { bombState.feathersTotal = map.feathers_total; bombState.feathersFound = map.feathers_found || 0; }
    bombState.status = map.status;
    if (await bombCheckStaleMap(map)) return;
    if (isNewMap) { bombState.cells = {}; bombState.lastSeenAt = null; bombState.selected = null; bombState.flags = {}; bombState.flagsFor = null; }

    if (isNewMap && zl.nickname && zl.player && zl.player.bombMapId !== map.map_id) {
      try {
        const updated = await Wl(zl.nickname, p => resetBombStateIfNewMap(p, map.map_id));
        if (updated) zl.player = updated;
      } catch (err) {
        // ignore — will retry next time the snapshot loads
      }
    }

    let since = null;
    for (;;) {
      const rows = await bombFetchRevealedSince(map.map_id, since);
      rows.forEach(r => {
        bombState.cells[r.cell_index] = r;
        if (!bombState.lastSeenAt || r.revealed_at > bombState.lastSeenAt) bombState.lastSeenAt = r.revealed_at;
      });
      if (rows.length < 2000) break;
      since = rows[rows.length - 1].revealed_at;
    }

    if (!bombState.settings) bombState.settings = await bombFetchSettings();
    bombLoadZones().catch(() => {});   // 圈層資料（只跟地圖大小有關，抓一次就存在這台裝置上）。要等設定讀進來才知道要不要顯示圈層，所以放在這裡
    bombState.leaderboard = await bombFetchLeaderboard(map.map_id);
    if (zl.nickname) bombState.shieldCount = await bombFetchMyShields(zl.nickname);
    bombFlagPull(true);   // 旗標跟伺服器對帳（不用等它）
    bombClaimAndGrantShards().catch(() => {});
    bombClaimAndGrantFeathers().catch(() => {});   // 補領之前翻到、但還沒領到背包的碎片
    await bombEnsureRoundSettled();
  } catch (err) {
    // 讀不到地圖時由下面的 finally 記錄失敗並安排退避重試
  } finally {
    if (bombState.mapId || bombState.dayEnd) { bombState.loadFails = 0; bombState.retryAt = 0; }
    else { bombState.loadFails = (bombState.loadFails || 0) + 1; bombState.retryAt = Date.now() + Math.min(30000, 3000 * Math.pow(2, bombState.loadFails - 1)); }
    if ("bomb" === zl.tab) Bu();
  }
}

function bombUpdateRetryInfoDom(){
  const el = document.getElementById("bomb-retry-info");
  if (!el) return;
  const wait = Math.max(0, Math.ceil(((bombState.retryAt || 0) - Date.now()) / 1000));
  el.textContent = wait > 0 ? dc(`約 ${wait} 秒後自動重試`, `retrying in ~${wait}s`) : dc("重試中…", "retrying…");
}
async function bombPoll(){
  if (document.hidden) return;
  if (bombState.dayEnd) {
    if (bombState.dayEnd.roundKey !== bombRoundKey()) {   // 新的一天：解除「今日已完成」，載入新地圖
      bombState.dayEnd = null; bombState.mapId = null; bombState.cells = {}; bombState.lastSeenAt = null;
      await bombLoadSnapshot();
      return;
    }
    await bombEnsureRoundSettled();
    return;
  }
  if (!bombState.mapId) { bombUpdateRetryInfoDom(); return bombAutoLoadSnapshot(); }
  try {
    const rows = await bombFetchRevealedSince(bombState.mapId, bombState.lastSeenAt);
    rows.forEach(r => {
      bombState.cells[r.cell_index] = r;
      if (!bombState.lastSeenAt || r.revealed_at > bombState.lastSeenAt) bombState.lastSeenAt = r.revealed_at;
    });
    const _now = Date.now();
    if (bombState._pollFor !== bombState.mapId) { bombState._pollFor = bombState.mapId; bombState._metaAt = 0; bombState._lbAt = 0; }
    let map = null;
    if (_now - (bombState._metaAt || 0) >= 6000) { bombState._metaAt = _now; map = await bombFetchMapMeta(bombState.mapId); }
    if (map) {
      if (map.status === "finished") {
        const safeTotal = (map.total_cells || 0) - (map.bomb_count || 0);
        if (safeTotal > 0 && (map.revealed_safe_count || 0) >= safeTotal) await bombHandleMapFinished(bombState.mapId);   // 100% 清空 → 今日結束
        else await bombLoadSnapshot();                                                                                      // GM 強制結束 → 照舊換新地圖
        return;
      }
      if (await bombCheckStaleMap(map)) return;
      bombState.revealedSafeCount = map.revealed_safe_count;
    if (typeof map.shards_total === "number") { bombState.shardsTotal = map.shards_total; bombState.shardsFound = map.shards_found || 0; }
    if (typeof map.feathers_total === "number") { bombState.feathersTotal = map.feathers_total; bombState.feathersFound = map.feathers_found || 0; }
    }
    if (_now - (bombState._lbAt || 0) >= 12000) { bombState._lbAt = _now; bombState.leaderboard = await bombFetchLeaderboard(bombState.mapId); }
    bombFlagPull(false);   // 最多每 8 秒對一次帳
    await bombEnsureRoundSettled();

    if ("bomb" === zl.tab) {
      if (bombGridMatchesCurrentMap()) {
        rows.forEach(bombApplyCellDom);
        if (bombState.selected != null && bombState.selHidden && bombState.cells[bombState.selected]) { bombSetSelected(null); ac(dc("你選的那一格剛剛被別人翻開了", "Someone just revealed the cell you selected")); }
        bombUpdateProgressDom();
        bombUpdateLeaderboardDom();
      } else {
        Bu();
      }
    }
  } catch (err) {
    // ignore — retry next tick
  }
}

async function bombDoStep(cellIndex){
  if (!zl.nickname || !zl.player) return;
  if (bombActionBusy) { ac(dc("上一步還在處理中，請稍等一下…", "Still processing the previous step, please wait…")); return; }
  if (!bombState.mapId) return;
  if (bombState.dayEnd) { ac(dc("今日已完成，下一場再見！", "Today's map is cleared — see you next round!")); return; }

  if (!bombScheduleOpen()) {
    ac(dc("目前不在開放時段，暫時無法行動", "Outside the open hours right now"));
    return;
  }
  if (bombPlayerStatus(zl.player) === "cooling_down") {
    ac(dc("還在冷卻中，暫時無法行動", "Still on cooldown"));
    return;
  }
  if (countRareCards(zl.player) < 1) {
    ac(dc("稀有塔羅牌不足，無法探索", "Not enough rare tarot cards to explore"));
    return;
  }

  bombActionBusy = true;
  try {
    const row = await bombRevealCell(bombState.mapId, cellIndex, zl.player.bombStreak || 0);

    if (row.result === "map_outdated") {
      ac(dc("地圖已更新，重新載入中...", "Map refreshed, reloading..."));
      await bombLoadSnapshot();
      return;
    }
    if (row.result === "cell_taken") {
      ac(dc("這格剛剛被別人踩過了", "Someone just took that cell"));
      return;
    }

    const isShielded = row.result === "bomb_shielded";
    const cellData = { cell_index: cellIndex, is_bomb: row.is_bomb, revealed_by_name: zl.nickname, revealed_at: new Date().toISOString(), cell_type: row.cell_type, shard_hint: (typeof row.shard_hint === "number") ? row.shard_hint : null, is_shard: !row.is_bomb && row.shard_hint === 0, feather_hint: (typeof row.feather_hint === "number") ? row.feather_hint : null, is_feather: !row.is_bomb && row.feather_hint === 0 };
    bombState.cells[cellIndex] = cellData;
    if (!row.is_bomb) bombState.revealedSafeCount++;
    bombState.shardsFound = (bombState.shardsFound || 0) + (row.shards_found || 0);
    bombState.feathersFound = (bombState.feathersFound || 0) + (row.feathers_found || 0);

    const chainCells = [];
    if (Array.isArray(row.chain_reveals) && row.chain_reveals.length) {
      row.chain_reveals.forEach(c => {
        const chainCellData = { cell_index: c.cell_index, is_bomb: c.is_bomb, revealed_by_name: zl.nickname, revealed_at: new Date().toISOString(), cell_type: null, is_shard: !!c.shard, shard_hint: c.shard ? 0 : (typeof c.shard_hint === "number" ? c.shard_hint : null), is_feather: !!c.feather, feather_hint: c.feather ? 0 : (typeof c.feather_hint === "number" ? c.feather_hint : null) };
        bombState.cells[c.cell_index] = chainCellData;
        if (!c.is_bomb) bombState.revealedSafeCount++;
        chainCells.push(chainCellData);
      });
    }

    // 伺服器已經確定這格翻開了：先把格子畫出來、同時去抓數字，再慢慢存玩家資料（以前要等存檔完才看得到）
    const _early = !row.map_finished && "bomb" === zl.tab && bombGridMatchesCurrentMap();
    if (_early) { bombApplyCellDom(cellData); chainCells.forEach(bombApplyCellDom); bombUpdateProgressDom(); }
    const _numsP = row.map_finished ? null : bombRefreshNumbers([cellIndex].concat(chainCells.map(c => c.cell_index)));

    let cardErr = false;
    const updated = await Wl(zl.nickname, p => {
      resetBombStateIfNewMap(p, bombState.mapId);
      if (!consumeRareCards(p, 1)) { cardErr = true; return; }
      if (row.result === "bomb") {
        p.bombStreak = 0;
        p.bombDeathCount = (p.bombDeathCount || 0) + 1;
        if (p.bombDeathCount === 1) {
          p.bombDeadAwaitingPick = true;
          p.bombRevivePendingAt = null;
        } else {
          const cooldownSec = (bombState.settings && bombState.settings.death_cooldown_minutes != null) ? bombState.settings.death_cooldown_minutes : BOMB_DEATH_COOLDOWN_DEFAULT_SEC;
          p.bombRevivePendingAt = new Date(Date.now() + cooldownSec * 1000).toISOString();
          p.bombDeadAwaitingPick = true;
        }
      } else if (isShielded) {
        // 護盾擋下這顆炸彈：不算死亡、連勝維持不變
      } else {
        p.bombStreak = row.new_streak;
        p.coins = (p.coins || 0) + (row.reward || 0);
        p.bombDeadAwaitingPick = false;
        p.bombRevivePendingAt = null;
      }
    });

    if (!updated) { ac(dc("動作失敗，請重新整理後再試", "Action failed, refresh and try again")); return; }
    zl.player = updated;
    Au();
    if ((row.shards_found || 0) > 0) { try { await bombClaimAndGrantShards(); } catch (e) {} }
    if ((row.feathers_found || 0) > 0) { try { await bombClaimAndGrantFeathers(); } catch (e) {} }   // 🕊️ 翻到羽毛：向伺服器領取並發進玩家羽毛   // 翻到隱藏碎片：向伺服器領取並發進背包

    if (row.shield_consumed) bombState.shieldCount = Math.max(0, (bombState.shieldCount || 0) - 1);
    if (row.shield_granted) bombState.shieldCount = (bombState.shieldCount || 0) + 1;

    if (cardErr) {
      ac(dc("稀有塔羅牌不足", "Not enough rare tarot cards"));
    } else if (isShielded) {
      ac(dc(`🛡 護盾生效，幫你擋下了這顆炸彈！剩餘護盾 ${bombState.shieldCount}`, `🛡 Shield activated — blocked that bomb! Shields left: ${bombState.shieldCount}`));
    } else if (row.result === "bomb") {
      const cooldownSec = (bombState.settings && bombState.settings.death_cooldown_minutes != null) ? bombState.settings.death_cooldown_minutes : BOMB_DEATH_COOLDOWN_DEFAULT_SEC;
      ac(updated.bombDeathCount === 1
        ? dc(`💥 踩到炸彈了！本輪第一次死亡免費復活，下次死亡需等待${cooldownSec}秒冷卻`, `💥 Hit a bomb! First death is a free revive — next one needs a ${cooldownSec}-second cooldown`)
        : dc(`💥 踩到炸彈了！需要等待${cooldownSec}秒才能復活`, `💥 Hit a bomb! You need to wait ${cooldownSec} seconds to revive`));
    } else {
      let msg = dc(`✦${row.reward} 獲得金幣`, `+✦${row.reward} coins`);
      if (row.cell_type === "treasure") msg = dc(`💰 寶箱格！獎勵大爆發，✦${row.reward} 獲得金幣`, `💰 Treasure cell! Big payout, +✦${row.reward} coins`);
      else if (row.cell_type === "shield") msg += dc(`　🛡 獲得護盾 +1（目前 ${bombState.shieldCount}）`, `　🛡 +1 Shield (now ${bombState.shieldCount})`);
      else if (row.cell_type === "chain") msg += dc(`　⚡ 連鎖格觸發，附近格子自動揭曉`, `　⚡ Chain triggered — nearby cells auto-revealed`);
      if ((row.shards_found || 0) > 0) msg += dc(`　🧩 找到隱藏的神秘碎片 ×${row.shards_found}！`, `　🧩 Found ${row.shards_found} hidden Mystery Shard(s)!`);
      if ((row.feathers_found || 0) > 0) msg += dc(`　🕊️ 找到隱藏的羽毛寶物 ×${row.feathers_found}！`, `　🕊️ Found ${row.feathers_found} hidden Feather treasure(s)!`);
      if (bombState.numbersSupported === false && row.nearby_bomb_count !== null && row.nearby_bomb_count !== undefined) msg += dc(`　🔍情報卡：附近3x3有 ${row.nearby_bomb_count} 顆雷`, `　🔍Intel: ${row.nearby_bomb_count} bomb(s) nearby (3x3)`);   // 沒有數字的舊伺服器：情報卡還是照舊提示
      ac(msg);
    }

    if (row.map_finished) {
      const doneRec = await bombEndDay(bombState.mapId);   // 記錄今日完成（要在載入新地圖之前）
      bombApplyDayEnd(doneRec, true);
    } else if ("bomb" === zl.tab && bombGridMatchesCurrentMap()) {
      bombApplyCellDom(cellData);
      chainCells.forEach(bombApplyCellDom);
      bombUpdateProgressDom();
      bombUpdatePersonalStatsDom();
      bombUpdateBannerDom();
      bombUpdateLeaderboardDom();
    } else if ("bomb" === zl.tab) {
      Bu();
    }
    if (_numsP) await _numsP;
  } catch (err) {
    ac(dc("連線異常，請稍後再試", "Connection error, please try again"));
  } finally {
    bombActionBusy = false;
  }
}

function bombBuildHtml(){
  const st = bombState;
  if (st.dayEnd) return bombBuildDayEndHtml();
  if (!st.mapId) {
    if ((st.loadFails || 0) > 0) {
      const wait = Math.max(0, Math.ceil(((st.retryAt || 0) - Date.now()) / 1000));
      return `<div class="panel"><h2>💣 ${dc("全服數字炸彈", "Bomb Map")}</h2><div class="loading-line" style="color:var(--danger);">${dc("地圖載入失敗（網路或伺服器暫時連不上）", "Could not load the map (network or server unavailable)")}　<span id="bomb-retry-info">${wait > 0 ? dc(`約 ${wait} 秒後自動重試`, `retrying in ~${wait}s`) : dc("重試中…", "retrying…")}</span></div><button class="btn small" id="bomb-retry-btn" style="margin-top:8px;">${dc("立即重試", "Retry now")}</button></div>`;
    }
    return `<div class="panel"><h2>💣 ${dc("全服數字炸彈", "Bomb Map")}</h2><div class="loading-line">${dc("載入地圖中...", "Loading map...")}</div></div>`;
  }
  const player = zl.player;
  const status = bombPlayerStatus(player);
  const rareCount = countRareCards(player);
  const safeTotal = st.totalCells - st.bombCount;
  const progressPct = safeTotal > 0 ? Math.round(100 * st.revealedSafeCount / safeTotal) : 0;

  let banner = "";
  if (!bombScheduleOpen()) {
    banner = `<div class="panel" style="border-color:var(--muted);">⏸ ${dc("目前不在開放時段，暫時無法行動", "Outside the open hours — actions are paused right now")}</div>`;
  } else if (status === "cooling_down") {
    const remainMs = Math.max(0, Date.parse(player.bombRevivePendingAt) - Date.now());
    banner = `<div class="panel" style="border-color:var(--danger);">💀 ${dc(`你已經陣亡，還需要等待 ${Zr(remainMs)} 才能復活`, `You're dead — ${Zr(remainMs)} left before you can revive`)}</div>`;
  } else if (status === "revive_ready") {
    banner = `<div class="panel" style="border-color:var(--gold);">✨ ${dc("可以復活了！點擊地圖上任一未揭開的格子重新落地（該格也可能是炸彈）", "You can revive! Click any unrevealed cell to land there (it might also be a bomb)")}</div>`;
  }

  bombInitPrefs();
  if (bombState.flagsFor !== st.mapId) { bombLoadFlags(); bombState.flagsFor = st.mapId; }
  const px = bombState.cellPx || 16;
  const gridStyle = `--bw:${st.width};--bc:${px}px;--fw:${bombFrameWidth(px)}px;`;

  const lbRows = bombLeaderboardRowsHtml();

  const gmPanel = ku() ? `
    <div class="panel" id="bomb-gm-panel">
      <h3>⚙️ GM ${dc("下一張地圖設定", "Next Map Settings")}</h3>
      <p class="sub" style="font-size:12px;">${dc("寬高/密度只影響本輪結束後生成的下一張地圖；開放時段是即時生效的", "Width/height/density only affect the next map after this round ends; open hours take effect immediately")}</p>
      <div class="form-row">
        <label>${dc("寬", "Width")}<input type="number" id="bomb-gm-width" value="${st.settings ? st.settings.width : 75}" min="10" max="200" style="width:70px;"/></label>
        <label>${dc("高", "Height")}<input type="number" id="bomb-gm-height" value="${st.settings ? st.settings.height : 75}" min="10" max="200" style="width:70px;"/></label>
        <label>${dc("炸彈密度", "Bomb %")}<input type="number" id="bomb-gm-density" value="${st.settings ? Math.round(st.settings.bomb_density * 100) : 20}" min="1" max="90" style="width:60px;"/>%</label>
      </div>
      <div class="form-row" style="margin-top:8px;">
        <label><input type="checkbox" id="bomb-gm-schedule-enabled" ${st.settings && st.settings.schedule_enabled ? "checked" : ""}/> ${dc("啟用開放時段限制", "Restrict to open hours")}</label>
      </div>
      <div class="form-row">
        <label>${dc("開始", "Start")}
          <input type="number" id="bomb-gm-start-h" value="${st.settings ? st.settings.open_start_hour || 0 : 0}" min="0" max="23" style="width:50px;"/>:<input type="number" id="bomb-gm-start-m" value="${st.settings ? st.settings.open_start_minute || 0 : 0}" min="0" max="59" style="width:50px;"/>
        </label>
        <label>${dc("結束", "End")}
          <input type="number" id="bomb-gm-end-h" value="${st.settings ? st.settings.open_end_hour || 0 : 0}" min="0" max="23" style="width:50px;"/>:<input type="number" id="bomb-gm-end-m" value="${st.settings ? st.settings.open_end_minute || 0 : 0}" min="0" max="59" style="width:50px;"/>
        </label>
      </div>
      <p class="sub" style="font-size:11px;">${dc("開始=結束（例如 0:00 到 0:00）代表全天開放", "Start = end (e.g. 0:00 to 0:00) means open all day")}</p>
      <div class="form-row" style="margin-top:8px;">
        <label>${dc("單步獎勵基數", "Reward base")}<input type="number" id="bomb-gm-reward-base" value="${st.settings ? st.settings.reward_base : 100}" min="1" style="width:80px;"/></label>
        <label>${dc("單步獎勵封頂", "Reward cap")}<input type="number" id="bomb-gm-reward-cap" value="${st.settings ? st.settings.reward_cap : 5000}" min="1" style="width:90px;"/></label>
        <label>${dc("死亡冷卻(秒)", "Death cooldown (sec)")}<input type="number" id="bomb-gm-cooldown" value="${st.settings && st.settings.death_cooldown_minutes != null ? st.settings.death_cooldown_minutes : BOMB_DEATH_COOLDOWN_DEFAULT_SEC}" min="0" max="86400" style="width:70px;"/></label>
      </div>
      <div class="form-row">
        <button class="btn small" id="bomb-gm-save">${dc("儲存", "Save")}</button>
        <button class="btn small secondary" id="bomb-gm-force-end">🛑 ${dc("強制結束本輪", "Force End Round")}</button>
        <button class="btn small secondary" id="bomb-gm-settle-titles">🏆 ${dc("手動結算本輪封號", "Force Settle Titles")}</button>
      </div>
    </div>` : "";

  return `
    <div class="panel bomb-panel">
      <h2>💣 ${dc("全服數字炸彈", "Bomb Map")}</h2>
      <p class="sub">${dc("每走一步消耗1張稀有塔羅牌，安全格獲得金幣（連續存活翻倍），踩到炸彈本條命結束", "Each step costs 1 rare tarot card. Safe cells pay gold that doubles with your streak. Bombs end that life.")}</p>
      <details class="bomb-help"><summary>📖 ${dc("玩法說明（點開）", "How to play (tap to open)")}</summary>
      <p class="sub" style="font-size:12px;">${dc("🔢 翻開的格子會顯示「周圍 8 格有幾顆炸彈」（已炸開的💣也算；空白＝周圍沒有炸彈）。全服玩家的數字合在一起，就能推理出哪些格子是安全的！格子外框的顏色＝翻開的人（點格子看名字；排行榜頭像旁邊的光圈是同一個顏色）。", "🔢 Every revealed cell shows how many bombs touch it (8 neighbours; exploded 💣 count; blank = none). Put everybody's numbers together and you can work out which cells are safe! The colour of a cell frame shows who opened it (tap a cell for the name; the glow around a leaderboard avatar is the same colour).")}</p>
      <p class="sub" style="font-size:11px;">${dc("💰寶箱格（金色底）獎勵大爆發｜🛡護盾格（藍色底）可累積、下次踩雷免死一次｜⚡連鎖格（黃色底）自動開周圍格子（連到雷不算死亡）", "💰Treasure cells (gold) pay big｜🛡Shield cells (blue) stack and block your next bomb death｜⚡Chain cells (yellow) auto-reveal neighbours")}${bombZoneNote()}</p>
      <p class="sub" style="font-size:11px;">${dc("🗺 領地：同一個人翻開的格子會連成一片同色底，只在跟別人交界的地方畫邊線；你自己永遠是金色。點地圖上方的名字（或排行榜、點開格子的「只看 Ta 的領地」）可以只亮出某個人的領地，其他人的格子會變暗。", "🗺 Territory: cells opened by the same player merge into one tinted area, with outlines only where it meets someone else. You are always gold. Tap a name above the map (or in the leaderboard, or \"show only their land\" on a cell) to spotlight one player — everyone else dims.")}</p>
      <p class="sub" style="font-size:11px;">${dc("🧩🕊️ 每張地圖的安全格裡藏著神秘碎片和羽毛寶物（找到的人直接拿走），沒有任何距離或方向提示，全看運氣和全服一起摸索。另外，一輪結束時金幣前三名可獲得神秘碎片（第一名 ×"+BOMB_RANK_SHARDS[0]+"、第二名 ×"+BOMB_RANK_SHARDS[1]+"、第三名 ×"+BOMB_RANK_SHARDS[2]+"）。", "🧩🕊️ Each map hides Mystery Shards and Feather treasures inside safe cells — whoever opens one keeps it. There are no distance or direction hints at all: it is down to luck and server-wide teamwork. Also, when a round ends the top 3 coin earners get Mystery Shards (1st ×"+BOMB_RANK_SHARDS[0]+", 2nd ×"+BOMB_RANK_SHARDS[1]+", 3rd ×"+BOMB_RANK_SHARDS[2]+").")}</p>
      <p class="sub" style="font-size:11px;">${dc("🌅 每天換日時，前一天沒清完的地圖會自動換成全新地圖（連勝與死亡次數一併重置）。", "🌅 At each daily rollover, an unfinished map from the previous day is automatically replaced with a brand-new one (streak and death count reset too).")}</p>
      <p class="sub" style="font-size:11px;">${dc("👆 點格子選取，按「探索」才會扣牌；長按（電腦按右鍵）標記地雷 🚩，手機也可以開「標記模式」＝點一下就標記；用 ＋／－ 或雙指縮放地圖；「快速模式」＝點一下就探索", "👆 Tap a cell to select it — the card is only spent when you press Explore. Long-press (right-click on desktop) flags a bomb 🚩 — on phones you can also turn on Flag mode so one tap flags. Zoom with ＋／－ or two fingers. Quick mode = one tap explores.")}</p>
      </details>
      <div class="bomb-legend">
        <span class="bl-chip"><span class="bl-dot u"></span>${dc("未翻開", "Hidden")}</span>
        <span class="bl-chip"><span class="bl-dot t">💰</span>${dc("寶箱", "Treasure")}</span>
        <span class="bl-chip"><span class="bl-dot s">🛡</span>${dc("護盾", "Shield")}</span>
        <span class="bl-chip"><span class="bl-dot c">⚡</span>${dc("連鎖", "Chain")}</span>
        <span class="bl-chip"><span class="bl-dot b">💣</span>${dc("炸彈", "Bomb")}</span>
        <span class="bl-chip"><span class="bomb-mine-leg" style="border-color:${bombFrameColor(zl.nickname)}"></span>${dc("加粗框＝你翻的格子（你的專屬顏色）", "Thick frame = your cells (your own color)")}</span>
        <span class="bl-chip"><span class="bl-nums"><span style="color:#7db4ff">1</span><span style="color:#63d99a">2</span><span style="color:#ff8080">3</span><span style="color:#b99cff">4</span><span style="color:#ffab7a">5</span><span style="color:#5fd8d8">6</span></span>${dc("周圍炸彈數", "Nearby bombs")}</span>
      </div>
      <div class="bomb-stats-row">
        ${st.feathersTotal > 0 ? `<span class="bomb-stat" id="bomb-feather-text">${bombStatInner("🕊️", dc("隱藏羽毛", "Hidden feathers"), `${st.feathersFound || 0}/${st.feathersTotal}`)}</span>` : ""}
        ${st.shardsTotal > 0 ? `<span class="bomb-stat" id="bomb-shard-text">${bombStatInner("🧩", dc("隱藏碎片", "Hidden shards"), `${st.shardsFound || 0}/${st.shardsTotal}`)}</span>` : ""}
        <span class="bomb-stat wide" id="bomb-progress-text">${bombStatInner("🗺", dc("本輪進度", "Round progress"), `${st.revealedSafeCount}/${safeTotal} (${progressPct}%)`, progressPct)}</span>
        <span class="bomb-stat" id="bomb-streak-text">${bombStatInner("🔥", dc("你的連勝", "Your streak"), player.bombStreak || 0)}</span>
        <span class="bomb-stat" id="bomb-deaths-text">${bombStatInner("💀", dc("本輪死亡", "Deaths this round"), player.bombDeathCount || 0)}</span>
        <span class="bomb-stat" id="bomb-rare-text">${bombStatInner("🃏", dc("持有稀有卡", "Rare cards"), rareCount)}</span>
        <span class="bomb-stat" id="bomb-shield-text">${bombStatInner("🛡", dc("護盾庫存", "Shields"), st.shieldCount || 0)}</span>
      </div>
      <div id="bomb-banner">${banner}</div>
      ${bombToolbarHtml()}
      <div class="bomb-action-bar" id="bomb-action-bar">${bombActionBarHtml()}</div>
      <div id="bomb-owner-legend" class="bomb-owner-legend">${bombLegendInner()}</div><div class="bomb-grid-wrap"><div class="bomb-cvgrid" id="bomb-grid" data-map-id="${st.mapId}" style="width:${Math.round(st.width * px)}px;height:${Math.round(st.height * px)}px;"><canvas id="bomb-cv" aria-label="${dc("數字炸彈地圖", "Bomb map")}"></canvas></div></div>
    </div>
    <div class="panel">
      <h3>🏆 ${dc("本輪排行榜", "This Round's Leaderboard")}</h3>
      <div class="who" style="margin-bottom:6px;">💣 ${dc("炸彈探索王", "Bomb Explorer")}：${Js.bombExplorer ? Iu(Js.bombExplorer) : dc("尚未產生", "Not yet crowned")}　☠️ ${dc("踩雷之王", "Bomb Victim King")}：${Js.bombVictim ? Iu(Js.bombVictim) : dc("尚未產生", "Not yet crowned")}</div>
      <p class="sub" style="font-size:11px;">${dc("每日開放時段結束時自動結算封號。本輪金幣前三名會獲得 🧩 神秘碎片（第一名 ×"+BOMB_RANK_SHARDS[0]+"、第二名 ×"+BOMB_RANK_SHARDS[1]+"、第三名 ×"+BOMB_RANK_SHARDS[2]+"），直接放進背包；第一名是炸彈探索王，另有稱號；踩雷之王只有稱號，沒有額外獎勵。", "Titles settle automatically when the daily open window closes. The top 3 coin earners get 🧩 Mystery Shards (1st ×"+BOMB_RANK_SHARDS[0]+", 2nd ×"+BOMB_RANK_SHARDS[1]+", 3rd ×"+BOMB_RANK_SHARDS[2]+") delivered to their bag; 1st place is the Bomb Explorer King and also gets the title; the Bomb Victim King gets the title only, no extra rewards.")}</p>
      <div class="bomb-lb-list" id="bomb-lb-list">${lbRows}</div>
    </div>
    <div class="panel">
      ${srChatSectionHtml()}
    </div>
    ${gmCollapsibleWrap(gmPanel)}
  `;
}

// ===== 圈層著色（外圈／中圈／核心）=====
// 每一格的「距離中心比例」由伺服器（呼叫你資料庫裡決定炸彈密度與獎勵的同一個函式）算出來，所以畫面上的圈一定跟實際規則一致。
// 只跟地圖大小有關，第一次拿到就存在這台裝置上。伺服器沒有這個函式（或驗算不過）就自動不顯示。
// 圈層要顯示成什麼，完全看 GM 的設定（bomb_settings）：
//   risk   ＝ 各圈炸彈倍率不同（越中心雷越多）→ 紅色＝危險
//   reward ＝ 炸彈倍率都一樣（均勻隨機）、但各圈獎勵倍率不同 → 金色＝獎勵
//   none   ＝ 炸彈和獎勵倍率都一樣 → 完全不顯示圈層
function bombZoneMode(){
  const c = bombState.settings;
  if (!c) return "risk";
  const eq = (a, b) => Math.abs((a != null ? +a : 1) - (b != null ? +b : 1)) < 1e-9;
  const bombsFlat = eq(c.outer_bomb_mult, c.middle_bomb_mult) && eq(c.middle_bomb_mult, c.core_bomb_mult);
  const rewardFlat = eq(c.outer_reward_mult, c.middle_reward_mult) && eq(c.middle_reward_mult, c.core_reward_mult);
  return bombsFlat ? (rewardFlat ? "none" : "reward") : "risk";
}
function bombZoneNote(){
  const m = bombZoneMode();
  if (m === "none") return dc("｜💣 炸彈隨機分布在整張地圖，不會集中在某個地方", "｜💣 Bombs are spread randomly over the whole map — no hotspots");
  if (m === "reward") return dc("｜💣 炸彈隨機分布在整張地圖，不會集中在中間；越靠近中心，獎勵倍率越高", "｜💣 Bombs are spread randomly over the whole map (not concentrated in the middle); rewards are higher toward the centre");
  return dc("｜地圖分外圈/中圈/核心圈，越中心雷越多、獎勵倍率也越高", "｜The map has outer/middle/core rings — denser bombs but higher rewards toward the centre");
}
function bombZoneClass(pct){ return pct >= 66 ? "z-out" : pct >= 33 ? "z-mid" : "z-core"; }
async function bombLoadZones(){
  const st = bombState;
  if (!st.mapId || !st.width || !st.height) return;
  if (bombZoneMode() === "none") return;   // 沒有圈層可顯示：連圈層資料都不用去要
  const key = st.width + "x" + st.height, n = st.width * st.height;
  if (st.zonesKey === key && st.zones) return;
  // 圈層資料只從本機快取讀（伺服器沒有對應的 bomb_zone_ratios RPC，拿掉遠端抓取；
  // 圈層倍率目前全部是 1，就算有快取也不會顯示任何著色，這裡純粹避免無謂的失敗嘗試）
  let arr = null;
  try { const c = bombLsGet("bomb-zones-v1:" + key); if (c) arr = JSON.parse(c); } catch (e) {}
  if (Array.isArray(arr) && arr.length === n) { st.zones = arr; st.zonesKey = key; bombApplyZones(); bombRefreshZoneUi(); }
}
function bombApplyZones(){
  const B = BC, z = bombState.zones;
  if (!B.cv || !B.own || !bombGridMatchesCurrentMap()) return;
  const mode = bombZoneMode();
  B.zr = mode === "reward";
  B.zoneOn = !!(z && bombState.zonesOn && mode !== "none");
  if (z && B.zcSrc !== z) {
    const n = Math.min(z.length, B.N);
    for (let i = 0; i < n; i++) { const p = z[i]; B.zc[i] = p >= 66 ? 1 : p >= 33 ? 2 : 3; }   // 1 外圈 2 中圈 3 核心
    B.zcSrc = z;
  }
  bombCvInvalidate();
}
function bombZoneLegendHtml(){
  const st = bombState;
  if (!st.zones) return "";
  const mode = bombZoneMode();
  if (mode === "none") return "";
  const cfg = st.settings || {}, mult = (a, b) => mode === "reward" ? (b != null ? dc(`獎勵 ×${b}`, `reward ×${b}`) : "") : (a != null && b != null) ? dc(`雷 ×${a}・獎勵 ×${b}`, `bombs ×${a}・reward ×${b}`) : "";
  const row = (cls, name, a, b) => `<span class="bomb-zone-chip ${mode === "reward" ? "zr " : ""}${cls}">${name}${mult(a, b) ? " " + mult(a, b) : ""}</span>`;
  return `<label style="display:flex;gap:4px;align-items:center;"><input type="checkbox" id="bomb-zones-toggle" ${st.zonesOn ? "checked" : ""}/> 🎨 ${dc("圈層", "Rings")}</label>${st.zonesOn ? row("z-out", dc("外圈", "Outer"), cfg.outer_bomb_mult, cfg.outer_reward_mult) + row("z-mid", dc("中圈", "Middle"), cfg.middle_bomb_mult, cfg.middle_reward_mult) + row("z-core", dc("核心", "Core"), cfg.core_bomb_mult, cfg.core_reward_mult) : ""}`;
}
function bombRefreshZoneUi(){
  const slot = document.getElementById("bomb-zone-slot");
  if (!slot) return;
  slot.innerHTML = bombZoneLegendHtml();
  const t = document.getElementById("bomb-zones-toggle");
  if (t) t.onchange = ev => { bombState.zonesOn = !!ev.target.checked; bombLsSet("bomb-zones", bombState.zonesOn ? "1" : "0"); bombApplyZones(); bombRefreshZoneUi(); };
}
// ===== 炸彈地圖：工具列、選取後確認、旗標、縮放 =====
function bombToolbarHtml(){
  const px = bombState.cellPx || 16;
  return `<div class="bomb-toolbar" id="bomb-toolbar"><button class="btn small secondary" id="bomb-zoom-out" aria-label="zoom out">－</button><span id="bomb-zoom-label">${Math.round(px)}px</span><button class="btn small secondary" id="bomb-zoom-in" aria-label="zoom in">＋</button><button class="btn small secondary" id="bomb-zoom-fit">🗺 ${dc("全圖", "Fit")}</button><button class="btn small secondary" id="bomb-jump-me">⌖ ${dc("我的位置", "Me")}</button><button class="btn small secondary" id="bomb-jump-center">◎ ${dc("中心", "Center")}</button><span id="bomb-zone-slot" style="display:contents;">${bombZoneLegendHtml()}</span><label style="display:flex;gap:4px;align-items:center;"><input type="checkbox" id="bomb-quick-toggle" ${bombState.quick ? "checked" : ""}/> ${dc("快速模式（點一下就探索）", "Quick mode (one tap explores)")}</label><label style="display:flex;gap:4px;align-items:center;"><input type="checkbox" id="bomb-flag-toggle" ${bombState.flagMode ? "checked" : ""}/> 🚩 ${dc("標記模式（點一下就標記）", "Flag mode (tap to flag)")}</label></div>`;
}
function bombActionBarHtml(){
  const st = bombState, idx = st.selected;
  if (idx == null && st.flagMode) return `<span style="color:#e0455f;">🚩 ${dc("標記模式：點一下格子＝標記／取消標記（不會探索、不扣牌）", "Flag mode: tap a cell to flag / unflag it (nothing is explored, no card spent)")}</span>`;
  if (idx == null) return `<span style="color:var(--muted);">${dc("👆 點一下格子選取（長按或按右鍵＝標記地雷 🚩）　數字＝周圍 8 格的炸彈數", "👆 Tap a cell to select it (long-press / right-click = flag a bomb 🚩)　Numbers = bombs among the 8 neighbours")}</span>`;
  const r = Math.floor(idx / st.width) + 1, c = (idx % st.width) + 1, pos = dc(`第 ${r} 列・第 ${c} 欄`, `Row ${r}, Col ${c}`), cd = st.cells[idx];
  const close = `<button class="btn small secondary" data-bomb-act="close">${dc("關閉", "Close")}</button>`;
  if (cd) {
    let what = cd.is_bomb ? dc("💣 炸彈", "💣 bomb") : typeof cd.nearby_count === "number" ? dc(`周圍有 ${cd.nearby_count} 顆炸彈`, `${cd.nearby_count} bomb(s) nearby`) : dc("安全格", "safe cell");
    if (cd.is_shard) what += "　🧩 " + dc("隱藏的神秘碎片！", "Hidden Mystery Shard!");
    if (cd.is_feather) what += "　🕊️ " + dc("隱藏的羽毛寶物！", "Hidden Feather treasure!");
    const ow = cd.revealed_by_name || "?", isMe = bombIsMe(ow);
    return `<span><b>${pos}</b>：${what}　<i style="display:inline-block;width:11px;height:11px;border-radius:3px;vertical-align:-1px;background:${bombFrameColor(ow)}"></i> <b>${Iu(ow)}</b>${isMe ? dc("（你）", " (you)") : ""}</span><button class="btn small" data-bomb-act="spot">🔦 ${bombState.spot === ow ? dc("看全部", "Show all") : isMe ? dc("只看我的領地", "Only my land") : dc("只看 Ta 的領地", "Only their land")}</button>${close}`;
  }
  if (st.flags[idx]) return `<span><b>${pos}</b>：🚩 ${dc("已標記為炸彈", "flagged as a bomb")}</span><button class="btn small" data-bomb-act="flag">${dc("取消標記", "Remove flag")}</button>${close}`;
  return `<span><b>${pos}</b></span><button class="btn small" data-bomb-act="explore">🎲 ${dc("探索（花 1 張稀有卡）", "Explore (1 rare card)")}</button><button class="btn small secondary" data-bomb-act="flag">🚩 ${dc("標記", "Flag")}</button>${close}`;
}
function bombUpdateActionBar(){ const el = document.getElementById("bomb-action-bar"); if (el) el.innerHTML = bombActionBarHtml(); }
function bombSetSelected(idx){
  bombState.selected = idx;
  bombState.selHidden = idx != null && !bombState.cells[idx];
  bombCvInvalidate();
  bombUpdateActionBar();
}
function bombToggleFlag(idx){
  if (bombState.cells[idx]) return;   // 翻開的格子不能標記
  if (bombState.flags[idx]) delete bombState.flags[idx]; else bombState.flags[idx] = 1;
  bombSaveFlags();
  bombFlagQueue(idx, !!bombState.flags[idx]);   // 同步到伺服器（手機標的電腦也看得到）
  bombCvInvalidate();
  if (bombState.selected === idx) bombUpdateActionBar();
  try { navigator.vibrate && navigator.vibrate(15); } catch (e) {}
}
function bombConfirmExplore(){
  const idx = bombState.selected;
  if (idx == null || bombState.cells[idx]) return;
  if (bombState.flags[idx]) { ac(dc("這格標記了炸彈，先取消標記才能探索", "This cell is flagged — remove the flag first")); return; }
  bombSetSelected(null);
  bombDoStep(idx);
}
// 縮放：以指定的點（手指中心）為基準，縮放後那個點仍停在原處
function bombZoomAnchor(oldPx, newPx, scroll, focal){ return ((scroll + focal) / oldPx) * newPx - focal; }
function bombApplyZoom(px, fx, fy){
  px = Math.max(6, Math.min(48, Math.round(px * 10) / 10));
  const old = bombState.cellPx || 16, wrap = document.querySelector(".bomb-grid-wrap");
  let sl = 0, stp = 0;
  if (wrap) {
    const rect = wrap.getBoundingClientRect ? wrap.getBoundingClientRect() : { left: 0, top: 0 };
    const ox = fx == null ? wrap.clientWidth / 2 : fx - rect.left, oy = fy == null ? wrap.clientHeight / 2 : fy - rect.top;
    sl = bombZoomAnchor(old, px, wrap.scrollLeft, ox); stp = bombZoomAnchor(old, px, wrap.scrollTop, oy);
  }
  bombState.cellPx = px; bombLsSet("bomb-cellpx", String(Math.round(px)));
  BC.px = px;
  bombCvResize();   // 先把地圖區域改成新大小，才能設定捲動位置
  if (wrap) { wrap.scrollLeft = Math.max(0, sl); wrap.scrollTop = Math.max(0, stp); }
  bombCvDraw();
  const lab = document.getElementById("bomb-zoom-label"); if (lab) lab.textContent = Math.round(px) + "px";
}
function bombScrollToCell(idx){
  const wrap = document.querySelector(".bomb-grid-wrap"); if (!wrap || !bombState.width) return;
  const pitch = (bombState.cellPx || 16), x = (idx % bombState.width) * pitch, y = Math.floor(idx / bombState.width) * pitch;
  wrap.scrollLeft = Math.max(0, x - wrap.clientWidth / 2 + pitch / 2); wrap.scrollTop = Math.max(0, y - wrap.clientHeight / 2 + pitch / 2);
}
function bombMyLastCell(){
  let best = null;
  Object.keys(bombState.cells).forEach(k => { const c = bombState.cells[k]; if (c.revealed_by_name === zl.nickname && (!best || String(c.revealed_at) > String(best.revealed_at))) best = { idx: +k, revealed_at: c.revealed_at }; });
  return best ? best.idx : null;
}
function bombWireGrid(){
  const grid = document.getElementById("bomb-grid"), wrap = document.querySelector(".bomb-grid-wrap");
  if (!grid) return;
  bombCvInit(grid, wrap);   // 地圖改用 Canvas 畫：先建立畫布，最後再 bombPaintAll() 上色
  let lpTimer = null, lpStart = null;
  const stopLp = () => { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } };
  // 長按／右鍵標記：同一次按壓只會切換一次標記。
  // 手機瀏覽器長按會同時觸發 contextmenu；以前「計時器」和「contextmenu」各切換一次＝剛標上又立刻取消，手機上就像標不了。
  const flagOncePerPress = idx => {
    if (Number.isNaN(idx) || bombState.flagPress === bombState.pressId) return;
    bombState.flagPress = bombState.pressId;
    bombState.suppressClick = true;
    stopLp();
    bombToggleFlag(idx);
  };
  grid.onpointerdown = ev => {
    bombState.suppressClick = false; bombState.pressId++;
    const idx = bombCvHit(ev);
    if (idx < 0 || bombState.cells[idx]) return;
    if (ev.pointerType === "mouse" && ev.button !== 0) return;   // 滑鼠右鍵交給 contextmenu
    lpStart = { x: ev.clientX || 0, y: ev.clientY || 0 }; stopLp();
    lpTimer = setTimeout(() => { lpTimer = null; flagOncePerPress(idx); }, 450);   // 長按＝標記／取消標記
  };
  grid.onpointermove = ev => { bombCvHover(ev); if (lpTimer && lpStart && Math.hypot((ev.clientX || 0) - lpStart.x, (ev.clientY || 0) - lpStart.y) > 10) stopLp(); };   // 手指在滑動（捲動地圖）就不算長按
  grid.onpointerup = stopLp; grid.onpointercancel = stopLp; grid.onpointerleave = stopLp;
  grid.oncontextmenu = ev => {
    ev.preventDefault();   // 擋掉手機長按的系統選單
    const i = bombCvHit(ev);
    if (i >= 0 && !bombState.cells[i]) flagOncePerPress(i);
  };
  grid.onclick = ev => {
    if (bombState.suppressClick) { bombState.suppressClick = false; return; }
    const idx = bombCvHit(ev);
    if (idx < 0) return;
    if (bombState.cells[idx]) { bombSetSelected(bombState.selected === idx ? null : idx); return; }   // 點已翻開的格子＝看詳情
    if (bombState.flagMode) { bombToggleFlag(idx); return; }   // 標記模式：點一下＝標記／取消標記（手機最穩的方式）
    if (bombState.quick) {
      if (bombState.flags[idx]) { ac(dc("這格標記了炸彈（長按，或開「標記模式」點一下可取消標記）", "This cell is flagged (long-press, or turn on Flag mode and tap, to remove the flag)")); return; }
      bombSetSelected(null); bombDoStep(idx); return;
    }
    if (bombState.selected !== idx) bombSetSelected(idx);   // 再點同一格不會做任何事：一定要按「探索」才會扣牌
  };
  if (wrap) {   // 雙指縮放
    let pinch = null;
    const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    wrap.addEventListener("touchstart", ev => { if (ev.touches && ev.touches.length === 2) { stopLp(); pinch = { d: dist(ev.touches), px: bombState.cellPx || 16 }; } }, { passive: true });
    let zoomRaf = 0, zoomArgs = null;
    wrap.addEventListener("touchmove", ev => { if (pinch && ev.touches && ev.touches.length === 2) { ev.preventDefault(); const t = ev.touches; zoomArgs = [pinch.px * dist(t) / pinch.d, (t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2]; if (!zoomRaf) zoomRaf = requestAnimationFrame(() => { zoomRaf = 0; if (zoomArgs) { const a = zoomArgs; zoomArgs = null; bombApplyZoom(a[0], a[1], a[2]); } }); } }, { passive: false });
    wrap.addEventListener("touchend", ev => { if (!ev.touches || ev.touches.length < 2) { pinch = null; if (zoomArgs) { const a = zoomArgs; zoomArgs = null; bombApplyZoom(a[0], a[1], a[2]); } } }, { passive: true });
  }
  const bar = document.getElementById("bomb-action-bar");
  if (bar) bar.onclick = ev => {
    const b = ev.target.closest && ev.target.closest("[data-bomb-act]"); if (!b) return;
    const act = b.dataset.bombAct;
    if (act === "explore") bombConfirmExplore();
    else if (act === "flag" && bombState.selected != null) bombToggleFlag(bombState.selected);
    else if (act === "spot" && bombState.selected != null) { const c0 = bombState.cells[bombState.selected]; if (c0) { bombSetSpot(c0.revealed_by_name || "?"); bombUpdateActionBar(); } }
    else if (act === "close") bombSetSelected(null);
  };
  const $ = id => document.getElementById(id);
  if ($("bomb-zoom-in")) $("bomb-zoom-in").onclick = () => bombApplyZoom((bombState.cellPx || 16) * 1.25);
  if ($("bomb-zoom-out")) $("bomb-zoom-out").onclick = () => bombApplyZoom((bombState.cellPx || 16) / 1.25);
  if ($("bomb-zoom-fit")) $("bomb-zoom-fit").onclick = () => { if (wrap && bombState.width) bombApplyZoom((wrap.clientWidth - 4) / bombState.width); };
  if ($("bomb-jump-me")) $("bomb-jump-me").onclick = () => { const i = bombMyLastCell(); bombScrollToCell(i != null ? i : Math.floor(bombState.totalCells / 2)); if (i == null) ac(dc("你在這張地圖還沒有翻過格子，先帶你到地圖中心", "You have not revealed anything on this map yet — showing the centre")); };
  if ($("bomb-jump-center")) $("bomb-jump-center").onclick = () => bombScrollToCell(Math.floor(bombState.height / 2) * bombState.width + Math.floor(bombState.width / 2));
  if ($("bomb-flag-toggle")) $("bomb-flag-toggle").onchange = ev => { bombState.flagMode = !!ev.target.checked; bombSetSelected(null); };
  if ($("bomb-quick-toggle")) $("bomb-quick-toggle").onchange = ev => { bombState.quick = !!ev.target.checked; bombLsSet("bomb-quick", bombState.quick ? "1" : "0"); bombSetSelected(null); };
  bombPaintAll(); bombWireSpot();
  bombApplyZones(); bombRefreshZoneUi();
}
function bombWire(e){
  srWireChatBox(e, () => { if ("bomb" === zl.tab) srRefreshChatBoxDom(); });
  const retryBtn = document.getElementById("bomb-retry-btn");
  if (retryBtn) retryBtn.onclick = () => { retryBtn.disabled = true; bombState.retryAt = 0; bombLoadSnapshot(); };
  bombWireGrid();
  const saveBtn = document.getElementById("bomb-gm-save");
  if (saveBtn) {
    saveBtn.onclick = async () => {
      const w = Math.max(10, Math.min(200, parseInt(document.getElementById("bomb-gm-width").value, 10) || 75));
      const h = Math.max(10, Math.min(200, parseInt(document.getElementById("bomb-gm-height").value, 10) || 75));
      const d = Math.max(1, Math.min(90, parseInt(document.getElementById("bomb-gm-density").value, 10) || 20)) / 100;
      const schedEnabled = !!document.getElementById("bomb-gm-schedule-enabled")?.checked;
      const startH = Math.max(0, Math.min(23, parseInt(document.getElementById("bomb-gm-start-h")?.value, 10) || 0));
      const startM = Math.max(0, Math.min(59, parseInt(document.getElementById("bomb-gm-start-m")?.value, 10) || 0));
      const endH = Math.max(0, Math.min(23, parseInt(document.getElementById("bomb-gm-end-h")?.value, 10) || 0));
      const endM = Math.max(0, Math.min(59, parseInt(document.getElementById("bomb-gm-end-m")?.value, 10) || 0));
      const rewardBase = Math.max(1, parseInt(document.getElementById("bomb-gm-reward-base")?.value, 10) || 100);
      const rewardCap = Math.max(1, parseInt(document.getElementById("bomb-gm-reward-cap")?.value, 10) || 5000);
      const cooldownSec = Math.max(0, Math.min(86400, parseInt(document.getElementById("bomb-gm-cooldown")?.value, 10) || 0));
      try {
        const saved = await bombUpdateSettings(w, h, d, schedEnabled, startH, startM, endH, endM, rewardBase, rewardCap, cooldownSec);
        bombState.settings = saved;
        ac(dc("已儲存", "Saved"));
        bombUpdateBannerDom();
        Bu();
      } catch (err) {
        ac(dc("儲存失敗", "Save failed"));
      }
    };
  }
  const forceEndBtn = document.getElementById("bomb-gm-force-end");
  if (forceEndBtn) {
    forceEndBtn.onclick = async () => {
      const confirmed = await ic(dc("確定要強制結束本輪嗎？目前地圖會立刻關閉，並生成一張新地圖。", "End the current round now? The current map will close immediately and a new one will be generated."));
      if (!confirmed) return;
      try {
        await bombForceEndRound();
        ac(dc("已強制結束本輪，新地圖已生成", "Round ended — a new map has been generated"));
        await bombLoadSnapshot();
      } catch (err) {
        ac(dc("操作失敗", "Action failed"));
      }
    };
  }
  const settleTitlesBtn = document.getElementById("bomb-gm-settle-titles");
  if (settleTitlesBtn) {
    settleTitlesBtn.onclick = async () => {
      settleTitlesBtn.disabled = true;
      try {
        const result = await bombSettleRound(bombRoundKey());
        if (result) {
          ac(dc(`已結算本輪封號：💣${result.explorer || "—"}　☠️${result.victim || "—"}`, `Titles settled: 💣${result.explorer || "—"}  ☠️${result.victim || "—"}`));
          Bu();
        } else {
          ac(dc("本輪已經結算過了，或目前沒有可結算的資料", "This round is already settled, or there's nothing to settle yet"));
        }
      } catch (err) {
        ac(dc("結算失敗，請稍後再試", "Settlement failed, please try again later"));
      } finally {
        settleTitlesBtn.disabled = false;
      }
    };
  }
}

let bombChatSig = null, bombChatFullAt = 0;
async function bombChatPoll(){
  try {
    // 先只讀小小的 chat:meta（幾十 bytes）；沒有新訊息就不下載整份 chat:log（最多 300 則）
    // 保險：每 2 分鐘仍強制完整讀一次，萬一 meta 沒被更新也不會漏太久
    if (typeof Td === "function" && typeof _d === "function") {
      const sig = _d(await Td());
      if (bombChatSig !== null && sig === bombChatSig && Date.now() - bombChatFullAt < 120000) return;
      bombChatSig = sig;
    }
    bombChatFullAt = Date.now();
    await srRefreshChatCache();
    if ("bomb" === zl.tab) srRefreshChatBoxDom();
  } catch (err) {
    // ignore — retry next tick
  }
}

/* 炸彈探索的分頁入口：原本跟彈珠放在同一個檔，彈珠改成延後載入後搬到這裡（炸彈是預設進入的頁面，必須常駐） */
async function bombRenderTab(e){
  srCaptureChatUiState();
  try { await srRefreshChatCache(); } catch (err) { /* ignore, chat will just show empty until next poll */ }
  if ("bomb" !== zl.tab) return;
  e.innerHTML = bombBuildHtml();
  if (bombState.dayEnd) { bombWireDayEnd(e); if (bombState.congratsPending) bombShowCongrats(); return; }
  bombWire(e);
  if (!bombState.mapId) bombAutoLoadSnapshot();
}
