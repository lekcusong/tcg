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
  v: '2026-11-15c',
  title: '⚔️ 江湖倖存者更新：Boss 分階段換招、精英詞綴、技能圖示列、結算統計、簡化模式',
  add: [
    '<b>Boss 分階段</b>：「梟」與「魔頭」血量降到 60%、30% 會換招並跳出公告。梟會射羽箭、召喚更多小怪，後段還會衝撞（地上有紅線預警）；魔頭會放螺旋彈幕，後段加上震地和更密的彈幕。血條上有 60%、30% 刻度',
    '<b>精英詞綴</b>：精英怪會帶「疾、盾、毒」，頭上標示。<b>疾</b>＝移速大增；<b>盾</b>＝先破護盾才傷得到血；<b>毒</b>＝沿途留下毒瘴。3 分鐘後精英會同時帶兩個詞綴',
    '<b>技能圖示列</b>：上方改成武功圖示加等級點，進化後變金色；兩門武功各練到第 3 重、合擊成立時，對應圖示會發光',
    '<b>結算頁本局統計</b>：顯示總傷害、精英擊殺、打到哪個 Boss，以及各武功的傷害占比與擊殺數，方便下一局換搭配',
    '<b>簡化模式</b>：主頁與暫停選單可設定「傷害數字」（全部／只顯暴擊／關閉）與「畫面特效」（標準／精簡）。精簡會關掉震屏、白閃與多數粒子，畫面更清楚、低階手機更順'
  ],
  chg: [
    '切到別的視窗或分頁時，遊戲會自動暫停，不會被打死',
    '結算與選單畫面內容較長時，現在可以捲動，上方不會再被切掉'
  ],
  fix: [],
  en: {
    title: '⚔️ Jianghu Survivors update: boss phases, elite affixes, skill icon bar, run stats, simple mode',
    add: [
      '<b>Boss phases</b>: the two bosses change moves at 60% and 30% HP, with an on-screen notice. The first boss fires feather volleys, summons more minions and later charges (a red line warns you); the final boss adds spiral bullet patterns, then ground slams and denser barrages. The boss bar shows the 60% / 30% marks',
      '<b>Elite affixes</b>: elites now carry <b>Swift</b> (much faster), <b>Shield</b> (break the shield before you can hurt them) or <b>Venom</b> (leaves poison pools). After 3 minutes they carry two at once',
      '<b>Skill icon bar</b>: skills are shown as icons with level dots (gold when evolved), and the icons glow when a combo is active',
      '<b>Run stats on the result screen</b>: total damage, elites slain, which boss you reached, and each skill\'s damage share and kills',
      '<b>Simple mode</b>: in the menu and pause screen, set damage numbers (all / crits only / off) and visual effects (standard / reduced). Reduced mode removes screen shake, flashes and most particles for a cleaner screen and smoother play on low-end phones'
    ],
    chg: [
      'The game now pauses automatically when you switch windows or tabs',
      'Long menu and result screens can now be scrolled instead of being cut off at the top'
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
