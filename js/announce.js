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
  v: '2026-11-02',
  title: '塔羅三消大更新：新增「愚者」萬能牌與特殊組合、開局抽牌、時間獎勵，操作也更順手',
  add: [
    '<b>愚者（萬能牌）</b>：筆直消 5 連以上會生成一張 🃏 愚者。它不能自己三消，要靠「交換」來發動；被別的爆炸波及時，會清掉盤面上數量最多的花色',
    '<b>特殊組合</b>：交換兩顆特殊方塊會有大招——<b>愚者＋一般方塊</b>清掉全盤同花色；<b>愚者＋行／列／十字</b>讓全盤同花色都變成那種特殊方塊一起引爆；<b>愚者＋愚者</b>清空整個盤面；<b>兩顆行／列／十字互換</b>則是兩格的整行＋整列全清',
    '<b>開局抽牌</b>：每局開始前先抽 3 張大阿爾克那，選 1 張帶進這局：星星（開局 +10 秒）、力量（連鎖每波倍率 +0.75，上限 ×4）、惡魔（得分 ×1.5，但時間 −15 秒）、高塔（每 20 秒隨機炸掉一整行）、魔術師（開局盤面送 2 張愚者）、太陽（連鎖倍率從 ×1.25 起跳）',
    '<b>時間獎勵</b>：4 消 +1 秒、十字／愚者 +2 秒、特殊組合另有加成、連鎖到第 4 波 +2 秒、之後每多一波 +1 秒；畫面上會跳出 ⏱ 提示',
    '<b>操作提示</b>：5 秒沒動作時，會閃出一步可以走的棋',
    '<b>滑動操作</b>：手指（或滑鼠）按住方塊往旁邊一拖就能交換，原本的「點兩格」也照舊可用'
  ],
  chg: [
    '<b>時間規則</b>：剩餘時間最多累積到 90 秒，單局最長 120 秒，時間獎勵不會無限續命',
    '<b>特殊方塊外觀</b>：行／列／十字方塊右下角會標出 ↔ ↕ ✚，一眼分得出是哪一種',
    '<b>連鎖顯示</b>：第 2 波起才顯示連鎖倍率；產生特殊方塊或特殊組合時有專屬音效，特殊組合會顯示「✨ 特殊組合」',
    '<b>動畫節奏</b>：交換、消除、掉落的動畫速度加快，連鎖打起來更爽快'
  ],
  fix: [],
  en: {
    title: 'Tarot Match-3 big update: the Fool wild tile, special combos, a starting card draw and time bonuses, plus smoother controls',
    add: [
      '<b>The Fool (wild)</b>: a straight line of 5 or more creates a 🃏 Fool. It cannot match on its own and is triggered by swapping; if caught in another blast, it clears the most common suit on the board',
      '<b>Special combos</b>: swap two special tiles for a big effect. <b>Fool + normal tile</b> clears every tile of that suit; <b>Fool + row/column/cross</b> turns every tile of that suit into that special and detonates them all; <b>Fool + Fool</b> clears the whole board; <b>two row/column/cross tiles</b> clear both full rows and columns',
      '<b>Starting draw</b>: before each run, draw 3 Major Arcana and take 1 into the run: The Star (+10 seconds at the start), Strength (+0.75 per chain wave, cap x4), The Devil (score x1.5 but -15 seconds), The Tower (a random row explodes every 20 seconds), The Magician (start with 2 Fools), The Sun (chain multiplier starts at x1.25)',
      '<b>Time bonuses</b>: a 4-match gives +1 second, cross/Fool +2, special combos add more, reaching chain wave 4 gives +2 and each wave after that +1. A ⏱ pop-up shows each gain',
      '<b>Hints</b>: after 5 seconds without a move, one possible move starts to flash',
      '<b>Swipe controls</b>: press a tile and drag sideways to swap. Tapping two tiles still works'
    ],
    chg: [
      '<b>Time rules</b>: remaining time is capped at 90 seconds and a run lasts at most 120 seconds, so bonuses cannot extend a run forever',
      '<b>Special tile look</b>: row/column/cross tiles now show ↔ ↕ ✚ in the corner so you can tell them apart',
      '<b>Chain display</b>: the chain multiplier shows from wave 2 on; creating specials and special combos have their own sound, and combos show "✨ Special combo"',
      '<b>Animation pace</b>: swap, clear and fall animations are faster, so chains feel snappier'
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
