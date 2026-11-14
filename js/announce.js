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
  v: '2026-11-14c',
  title: '⚔️ 江湖倖存者新增「每日挑戰」：不計強化，榜首送神秘碎片',
  add: [
    '<b>每日挑戰</b>：在江湖倖存者主頁點「每日挑戰」。每天固定一位角色和一個詞綴（悍匪橫行／疾風驟起／體弱多病／大器晚成），<b>修煉的永久強化全部失效</b>，所有人條件相同，比的是操作和選技能',
    '<b>挑戰榜與獎勵</b>：可以無限重打，每人取當天單局最高分。每天結算，<b>第一名自動獲得 🧩神秘碎片 ×3</b>（直接放進背包）；「江湖榜」多了「挑戰榜」頁籤，也看得到昨天的榜首',
    '<b>注意</b>：挑戰以本地日期為準，跨日才打完的那局不會上榜；中途放棄不計分'
  ],
  chg: [
    '江湖榜（今日榜／總榜）與武俠配樂也已上線；一般模式的排行仍然沒有獎勵，也照常吃修煉強化'
  ],
  fix: [],
  en: {
    title: '⚔️ Jianghu Survivors adds the Daily Challenge: no upgrades, #1 wins Mystery Shards',
    add: [
      '<b>Daily Challenge</b>: tap "每日挑戰" on the Jianghu Survivors main page. Each day has one fixed hero and one modifier (Bandit Tide / Gale / Frail / Late Bloomer), and <b>all permanent training upgrades are disabled</b> so everyone plays under the same conditions',
      '<b>Challenge board and reward</b>: retry as often as you like; your best single run of the day counts. Settled daily, <b>the #1 player automatically receives 🧩 Mystery Shard x3</b> in their inventory. The Jianghu Board has a new Challenge tab and shows yesterday\'s winner',
      '<b>Note</b>: the challenge uses your local date, so a run that finishes after midnight is not ranked; abandoned runs do not count'
    ],
    chg: [
      'The Jianghu Board (daily / all-time) and the wuxia music are also live; normal runs still have no reward and still use your training upgrades'
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
