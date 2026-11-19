'use strict';
/* 更新通告 —— 秘境集卡（做法跟雷克斯農場的 announce.js 一樣）。
   每次更新只要改下面這一份 ANNOUNCE：v 換成新的版本代號（一個新字串就會讓大家再看到一次），
   「新增／調整／修正」三塊內容各寫幾行，沒有的那塊就整個刪掉或留空陣列。
   玩家每個版本只會自動看到一次（按「知道了」後記在自己的瀏覽器），新通告會直接蓋掉舊的，不保留歷史。
   不想彈窗時：把 v 設成 ''。
   內文可以用 <b>粗體</b>；標題會自動跳脫。
   英文版是選填：沒寫 en 的話，英文介面也顯示中文。
   這個是「每個版本一次」的更新說明；原本 GM 面板的「📜 公告 / GM 留言」另外照舊，兩者互不影響。 */
const ANNOUNCE = {
  v: '2026-11-20b',
  title: '🌙 新小遊戲「月影塔羅舖」上線：累計營業送神秘碎片、有排行榜',
  add: [
    '<b>月影塔羅舖</b>：在「小遊戲」分頁點 🌙 進入。經營一間塔羅小店，白天接待客人、打烊後外出進貨與合成，每天都是一次新的經營',
    '<b>營業里程碑</b>：累計營業天數<b>第一次</b>達到 <b>10、20、30 天</b>，各送 <b>🧩神秘碎片 ×10</b>（直接放進背包，信箱也會通知）。重開新局會接著累計，每個里程碑只送一次',
    '<b>排行榜</b>：遊戲主頁和打烊畫面都有「🏆 排行榜與里程碑」，可看累計天數榜、賺錢榜（累計營業額，是店內金幣），前 20 名＋你的名次',
    '<b>雲端存檔</b>：存檔、圖鑑、結局會自動同步，手機和電腦登入同一個帳號就能接著玩',
    '<b>新手教學</b>：第一次開店會有圖示引導，帶你走完背包、開店、賣貨、打烊；右上角「？」可以重看'
  ],
  chg: [
    '月影塔羅舖：<b>點一下貨品＝查看貨品資料</b>（種類、等級、格數、基礎價值、進價），手機也看得到；備貨時資料卡上有「↻ 旋轉」按鈕',
    '月影塔羅舖：營業中貨品<b>只能拖到櫃檯</b>賣出，點一下不會再直接上櫃檯，避免誤觸',
    '「🎒 塔羅背包亂鬥」已從小遊戲分頁移除'
  ],
  fix: [],
  en: {
    title: '🌙 New minigame "Moonshadow Tarot Shop": Mystery Shards for total days played, with leaderboards',
    add: [
      '<b>Moonshadow Tarot Shop</b>: tap 🌙 in the Minigames tab. Run a small tarot shop: serve customers by day, restock and craft after closing',
      '<b>Milestones</b>: the <b>first time</b> your total days open reaches <b>10, 20 and 30</b>, you get <b>🧩 Mystery Shard x10</b> each (added to your inventory, with a mailbox notice). Days keep adding up across new runs; each milestone pays once',
      '<b>Leaderboards</b>: tap "🏆 排行榜與里程碑" on the main page or the closing screen for the total-days board and the earnings board (total revenue in shop coins), top 20 plus your rank',
      '<b>Cloud save</b>: saves, the codex and endings sync automatically, so you can continue on another device with the same account',
      '<b>Tutorial</b>: your first shop day now has a guided walkthrough (bag, opening, selling, closing); replay it with the "?" button'
    ],
    chg: [
      'Moonshadow Tarot Shop: <b>tap an item to see its details</b> (type, tier, size, base value, cost), including on phones; while stocking, the card has a "↻ Rotate" button',
      'Moonshadow Tarot Shop: while selling, items can <b>only be dragged</b> to the counter; tapping no longer places them, so no more accidental picks',
      '"🎒 Backpack Brawl" has been removed from the Minigames tab'
    ],
    fix: []
  }
};
const ANN_KEY = 'tcg_annc_seen';
let anEl = null, anOpen = false, anDone = false, anTimer = null;   // anDone：這次開啟頁面已經看過（就算瀏覽器存不了紀錄也不會重複彈）
const anSeen = () => { try { return localStorage.getItem(ANN_KEY) || ''; } catch (e) { return ''; } };
const anEsc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const anIsEn = () => { try { return localStorage.getItem('app-lang') === 'en'; } catch (e) { return false; } };
function anInjectCss() {
  if (document.getElementById('annc-css')) return;
  const s = document.createElement('style'); s.id = 'annc-css';
  s.textContent = '.an-card{max-width:420px;text-align:left;outline:none}' +
    '.an-card .an-h{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}' +
    '.an-card .an-h h2{margin:0;font-family:Cinzel,"Noto Sans TC",serif;font-size:18px;color:var(--gold-bright)}' +
    '.an-card .an-chip{font-family:"Space Mono",monospace;font-size:10px;color:var(--muted);border:1px solid var(--line);border-radius:999px;padding:2px 8px;white-space:nowrap}' +
    '.an-card .an-ver{margin:4px 0 10px;font-size:13px;line-height:1.5;color:var(--muted)}' +
    '.an-card .an-sec{margin:10px 0 0}' +
    '.an-card .an-t{display:block;font-size:13px;margin-bottom:4px}' +
    '.an-card .an-t.new{color:#6fcf8a}.an-card .an-t.chg{color:#8fd3ff}.an-card .an-t.fix{color:#ff9a7a}' +
    '.an-card ul{margin:0;padding-left:18px}' +
    '.an-card li{font-size:12.5px;line-height:1.6;margin:0 0 5px}' +
    '.an-card li b{color:var(--gold-bright)}';
  document.head.appendChild(s);
}
function anClose() {
  if (anEl) { anEl.remove(); anEl = null; }
  anOpen = false; anDone = true;
  document.removeEventListener('keydown', anKey);
  try { localStorage.setItem(ANN_KEY, ANNOUNCE.v); } catch (e) { /* 略過：下次登入會再看到一次 */ }
}
function anKey(ev) { if (ev.key === 'Escape') anClose(); }
function anShow() {
  anInjectCss();
  const en = anIsEn() && ANNOUNCE.en ? ANNOUNCE.en : null;
  const pick = k => (en && en[k] != null) ? en[k] : ANNOUNCE[k];
  const L = en
    ? { head: '📢 Update Notes', add: '✨ New', chg: '🔧 Changed', fix: '🐛 Fixed', ok: 'Got it' }
    : { head: '📢 更新通告', add: '✨ 新增', chg: '🔧 調整', fix: '🐛 修正', ok: '知道了' };
  const sec = (cls, name, arr) => arr && arr.length ? '<div class="an-sec"><b class="an-t ' + cls + '">' + name + '</b><ul>' + arr.map(t => '<li>' + t + '</li>').join('') + '</ul></div>' : '';
  anEl = document.createElement('div'); anEl.className = 'card-modal-overlay'; anEl.id = 'annc';
  const title = pick('title');
  anEl.innerHTML = '<div class="card-modal-box an-card" tabindex="-1"><div class="an-h"><h2>' + L.head + '</h2><span class="an-chip">' + anEsc(ANNOUNCE.v) + '</span></div>' +
    (title ? '<p class="an-ver">' + anEsc(title) + '</p>' : '') +
    sec('new', L.add, pick('add')) + sec('chg', L.chg, pick('chg')) + sec('fix', L.fix, pick('fix')) +
    '<button type="button" class="btn full" data-a="ok" style="margin-top:12px">' + L.ok + '</button></div>';
  document.body.appendChild(anEl);
  anOpen = true;
  document.addEventListener('keydown', anKey);
  anEl.addEventListener('click', e => { if (e.target === anEl || e.target.closest('button[data-a="ok"]')) anClose(); });
  const b = anEl.querySelector('button[data-a="ok"]'); if (b) b.focus();
}
// 其他彈窗（每日彈窗、GM 公告、卡片放大、成就、檔案）開著時先等，等它們關掉再顯示
const AN_OTHERS = ['daily-popup-modal', 'announce-modal', 'card-modal', 'achievement-modal', 'profile-modal'];
const anBusy = () => AN_OTHERS.some(id => { const el = document.getElementById(id); return !!(el && el.style.display && el.style.display !== 'none'); });
function anTick() {
  if (anOpen || anDone || !ANNOUNCE.v) return;
  if (anSeen() === ANNOUNCE.v) { clearInterval(anTimer); anTimer = null; return; }   // 這個版本看過了，不用再檢查
  let logged = false;
  try { logged = !!(typeof zl !== 'undefined' && zl && zl.player); } catch (e) { logged = false; }
  if (!logged || document.hidden || anBusy()) return;   // 要登入進遊戲、頁面在前景、沒有其他彈窗
  anShow();
}
anTimer = setInterval(anTick, 1500);
