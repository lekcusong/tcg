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
  v: '2026-11-01b',
  title: '塔羅彈珠通關條件調整：要打死第 60 層 BOSS 才通關；另新增 BOSS 遺物與每日規則',
  add: [
    '<b>BOSS 遺物</b>：每擊敗一隻 BOSS（第 10、20、30、40、50 層），可以從 3 件遺物中選 1 件；遺物只在本局有效、可以累積，共 14 種，例如沙漏、鳳凰羽、智者之書、雙生子',
    '<b>每日規則</b>：每天會有一條全服共通的規則（共 8 種，例如月蝕、疾風之日、易碎之日），每條都有好處也有代價，隨每日地圖一起更換；排行榜仍然是同一天同一規則下比分'
  ],
  chg: [
    '<b>通關條件</b>：不再是「撐到第 60 層就結束」，改成<b>必須打死第 60 層的 BOSS</b> 才算通關',
    '<b>沒打死 BOSS 會怎樣</b>：第 60 層 BOSS 還活著時遊戲會繼續，直到你把它打死，或是被它（或其他怪物）打倒、被逼進深坑才結束',
    '<b>排行榜</b>：沒打死第 60 層 BOSS 就倒下，成績最多算到第 60 層，不算通關；通關才有通關加分'
  ],
  fix: [],
  en: {
    title: 'Ball Pit clear condition changed: you must defeat the floor-60 boss to clear; plus boss relics and a daily rule',
    add: [
      '<b>Boss relics</b>: defeat a boss (floors 10, 20, 30, 40, 50) and pick 1 of 3 relics. Relics last for the current run and stack; there are 14, such as Hourglass, Phoenix Feather, Sage\'s Tome and Gemini',
      '<b>Daily rule</b>: each day has one rule shared by every player (8 in total, e.g. Eclipse, Gale Day, Fragile Day). Each has an upside and a cost and changes with the daily map; the leaderboard still compares scores under the same rule on the same day'
    ],
    chg: [
      '<b>Clear condition</b>: surviving to floor 60 no longer ends the run. You now have to <b>defeat the floor-60 boss</b> to clear',
      '<b>If the boss is still alive</b>: the run keeps going until you kill it, or you are slain or pushed into the pit',
      '<b>Leaderboard</b>: if you fall before killing the floor-60 boss, your result counts as floor 60 at most and is not a clear; only a clear earns the clear bonus'
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
