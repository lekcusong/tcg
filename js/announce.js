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
  v: '2026-11-14',
  title: '新小遊戲上線：⚔️ 江湖倖存者（武俠割草生存）',
  add: [
    '<b>⚔️ 江湖倖存者</b>：到「小遊戲」分頁，點最右邊的 ⚔️ 就能開玩。撐過五個時辰（5 分鐘）、擊敗魔頭就過關；武功會自動出招，你只要負責走位',
    '<b>五種角色</b>：劍客（飛劍訣）、拳師（降龍掌）、暗器手（漫天花雨）、毒師（蝕骨毒霧）、輪客（迴旋輪），各有專屬被動',
    '<b>操作</b>：手機拖曳螢幕移動，電腦用 WASD；右下角「閃」可以閃避（會耗體力）、左下「停」可暫停或放棄本局',
    '<b>升級與進化</b>：殺敵撿經驗升級，挑選武功與內功；武功滿級再配上指定內功，可以進化成絕學。路上還會遇到「奇遇」事件，二選一賭運氣',
    '<b>修煉</b>：每局結算的銀兩可以在主頁「修煉」換永久強化（筋骨、內勁、身法、氣海、悟性、不死心法、財運、輕身、拾遺）'
  ],
  chg: [
    '<b>小遊戲分頁</b>：多了 ⚔️ 江湖倖存者 的入口；GM 總開關也能單獨開關這個遊戲',
    '<b>注意</b>：江湖倖存者的銀兩與修煉進度只存在你自己的瀏覽器裡，跟遊戲內的 ✦ 沒有互通；清除瀏覽器資料就會歸零。開啟時會暫停背景音樂，返回後自動恢復'
  ],
  fix: [],
  en: {
    title: 'New minigame: ⚔️ Jianghu Survivors (wuxia survival action)',
    add: [
      '<b>⚔️ Jianghu Survivors</b>: open the Minigames tab and tap the ⚔️ tab on the far right. Survive five "hours" (5 minutes) and defeat the demon lord to win; your skills fire automatically, you just handle the movement',
      '<b>Five heroes</b>: Swordsman (Flying Sword), Brawler (Dragon Palm), Dart Thrower (Flower Rain), Poisoner (Bone-Eating Mist) and Wheel Master (Boomerang Wheel), each with a unique passive',
      '<b>Controls</b>: drag the screen on mobile, WASD on desktop; the 閃 button in the lower right dodges (costs stamina) and the 停 button in the lower left pauses or abandons the run',
      '<b>Leveling and evolution</b>: collect XP to level up and pick skills and inner arts; a maxed skill plus its matching inner art evolves into an ultimate. Random "encounters" offer a two-way gamble',
      '<b>Training</b>: silver earned at the end of each run buys permanent upgrades from the main page (health, power, speed, stamina, XP, revive, silver bonus, dodge cost, pickup range)'
    ],
    chg: [
      '<b>Minigames tab</b>: added the ⚔️ Jianghu Survivors entry; the GM master switch can open or close this game on its own',
      '<b>Note</b>: silver and training progress are stored only in your own browser and are separate from the in-game ✦; clearing browser data resets them. Background music pauses while it is open and resumes when you return'
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
