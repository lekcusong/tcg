/* ===== 📋 GM 白名單（批次發放對象）— kv 鍵 config:gm_whitelist 存暱稱陣列 ===== */
const GM_WL_KEY="config:gm_whitelist";
function gmWlParse(str){const seen=new Set(),out=[];String(str||"").split(/[\n,，、;；]+/).forEach(x=>{const n=x.trim();if(!n)return;const k=n.toLowerCase();if(seen.has(k))return;seen.add(k);out.push(n)});return out}
async function gmWlLoad(){try{const r=await a.get(GM_WL_KEY);const v=r?JSON.parse(r.value):[];return Array.isArray(v)?gmWlParse(v.join("\n")):[]}catch(e){return[]}}
async function gmWlSave(list){try{await a.set(GM_WL_KEY,JSON.stringify(gmWlParse((list||[]).join("\n"))));return!0}catch(e){return!1}}
/* 遠征寶箱系統已移除：玩家資料載入時直接清掉殘留的寶箱庫存與開箱欄位，下次存檔就會寫回資料庫 */
function dropExpeditionChests(o){o&&(delete o.chests,delete o.chestSlots)}
/* ===== 🧭 新手引導（分頁分組＋首頁新手任務）— begin =====
   1) 頂部 15 個分頁分成 4 組（起步／養成／挑戰與小遊戲／社交與交易），一次只顯示目前這組的分頁。
   2) 首頁最上方「新手任務」：所有帳號都會看到；7 個步驟各有自己的獎勵（見 NB_REWARDS），完成哪一步就能領哪一步，每步只能領一次。
      領取旗標 p.nbClaimed[步驟] 與獎勵在同一次 Wl() 原子寫入，不會重領；完成條件也在 Wl() 內用最新資料重新判斷。
      7 步全部領完後新手任務面板消失（沒有額外的「全部完成」獎勵）。
   玩家資料新增欄位：nbVisited（已逛過的分頁）、nbClaimed（各步驟已領獎時間）。 */
/* 每一步的獎勵。欄位：coins 金幣、feathers 羽毛、talisman 幽冥骰符、herb／ore／lumber 職業材料（藥草／礦石／木料）、
   其餘鍵＝職業物品 professionItems 的 itemId。要調整獎勵只改這張表。 */
const NB_REWARDS = {
  draw:       { coins: 10000 },
  resonance:  { coins: 10000, feathers: 1000 },
  farm:       { talisman: 10 },
  expedition: { herb: 10000, lumber: 10000, ore: 10000 },
  profession: { potion_small: 100, furniture_common: 100, weapon_common: 100, accessory_common: 100 },
  games:      { coins: 10000 },
  social:     { coins: 10000 }
};
const NB_RW_LABEL = {
  coins: ["✦ 金幣", "✦ Coins"], feathers: ["🕊️ 羽毛", "🕊️ Feathers"], talisman: ["🔮 幽冥骰符", "🔮 Ghost Dice Talisman"],
  herb: ["🌿 藥草", "🌿 Herb"], lumber: ["🌳 木料", "🌳 Lumber"], ore: ["⛏️ 礦石", "⛏️ Ore"],
  potion_small: ["🧪 小藥水", "🧪 Small Potion"], furniture_common: ["🪑 小家具", "🪑 Small Furniture"],
  weapon_common: ["⚔️ 小武器", "⚔️ Small Weapon"], accessory_common: ["💍 小飾品", "💍 Small Accessory"]
};
function nbRwText(r) {
  return Object.keys(r).map(k => { const l = NB_RW_LABEL[k] || [k, k]; return dc(l[0], l[1]) + " ×" + r[k].toLocaleString(); }).join(dc("、", ", "));
}
function nbRwGive(q, r) {
  for (const k in r) {
    const n = r[k];
    if (k === "coins") q.coins = (q.coins || 0) + n;
    else if (k === "feathers") q.feathers = (q.feathers || 0) + n;
    else if (k === "talisman") { q.materials = q.materials || {}; q.materials.ghostDiceTalisman = (q.materials.ghostDiceTalisman || 0) + n; }
    else if (k === "herb" || k === "ore" || k === "lumber") { q.professionMaterials = q.professionMaterials || {}; q.professionMaterials[k] = (q.professionMaterials[k] || 0) + n; }
    else { q.professionItems = q.professionItems || {}; q.professionItems[k] = (q.professionItems[k] || 0) + n; }
  }
}
const NB_GROUPS = [
  { k: "start",  zh: "🌟 起步",         en: "🌟 Start",             tabs: ["home", "resonance", "collection"] },
  { k: "grow",   zh: "🌱 養成",         en: "🌱 Grow",              tabs: ["farm", "expedition", "profession"] },
  { k: "battle", zh: "⚔️ 挑戰與小遊戲", en: "⚔️ Challenge & Games", tabs: ["season", "starchart", "boss", "arena", "starraceroulette", "bomb", "match3", "potion", "ballpit"] },
  { k: "social", zh: "🤝 社交與交易",   en: "🤝 Social & Market",   tabs: ["friends", "auction", "leaderboard", "chat", "gm"] }
];
const NB_STEPS = [
  { k: "draw",       zh: "每日抽卡",       en: "Daily Draw",         hz: "就在下方：抽三張塔羅牌，領今天的金幣", he: "Right below: draw 3 tarot cards and collect today's coins", auto: p => !!p.lastClaim },
  { k: "resonance",  zh: "三牌共鳴",       en: "Resonance",          hz: "三張牌一起翻開試手氣，三張史詩牌可獨得整包獎池", he: "Flip three cards together - three epics win the whole jackpot pool", visit: ["resonance"] },
  { k: "farm",       zh: "花園和寵物",     en: "Garden & Pets",      hz: "種作物、派寵物去尋寶，好友也能幫你澆水", he: "Grow crops and send pets treasure hunting - friends can water for you", visit: ["farm"] },
  { k: "expedition", zh: "遠征",           en: "Expedition",         hz: "選風險和時間派出遠征，時間到回來領獎勵", he: "Pick a risk level and duration, then collect the reward when it's done", visit: ["expedition"] },
  { k: "profession", zh: "職業和熔爐",     en: "Professions",        hz: "培養職業，並用熔爐製作物品", he: "Level up a profession and craft items at the furnace", visit: ["profession"] },
  { k: "games",      zh: "小遊戲",         en: "Minigames",          hz: "炸彈、三消等小遊戲，玩玩看有機會賺獎勵", he: "Bomb, match-3 and more - play for a chance at rewards", visit: ["bomb", "match3", "potion", "ballpit"] },
  { k: "social",     zh: "好友與拍賣行",   en: "Friends & Auction",  hz: "加好友、看信箱，或到拍賣行買賣卡片", he: "Add friends, check your mailbox, or trade cards at the auction house", visit: ["friends", "auction"] }
];
const NB_VISIT_KEYS = [].concat.apply([], NB_STEPS.map(s => s.visit || []));
function nbGroupOf(tab) { for (const g of NB_GROUPS) if (g.tabs.indexOf(tab) >= 0) return g.k; return null; }
function nbActive(p) { return !!p && !NB_STEPS.every(st => (p.nbClaimed || {})[st.k]); }   // 7 步的獎勵都領完才會消失
function nbStepDone(p, s) { if (s.auto) return !!s.auto(p); const v = p.nbVisited || {}; return (s.visit || []).some(k => v[k]); }
function nbAllDone(p) { return NB_STEPS.every(s => nbStepDone(p, s)); }
function nbMarkVisit() {
  const p = zl.player, k = zl.tab;
  if (!p || !zl.nickname || !nbActive(p) || NB_VISIT_KEYS.indexOf(k) < 0) return;
  if ((p.nbVisited || {})[k]) return;
  (p.nbVisited = p.nbVisited || {})[k] = 1;                       // 本地先記，下次畫首頁就會打勾
  Wl(zl.nickname, q => { q.nbVisited = q.nbVisited || {}; q.nbVisited[k] = 1; }).catch(() => {});
}
function nbDecorateTabs() {
  try {
    const bar = document.querySelector("#app>.tabs");
    if (!bar) return;
    if (!document.getElementById("nb-style")) {
      const st = document.createElement("style"); st.id = "nb-style";
      st.textContent = ".nb-grps{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0 0}.nb-grp{padding:6px 14px;border:1px solid var(--line);border-radius:999px;font-size:13px;color:var(--muted);cursor:pointer;user-select:none}.nb-grp.active{color:var(--gold-bright);border-color:var(--gold)}.nb-grps+.tabs{margin-top:8px}";
      document.head.appendChild(st);
    }
    /* 還原成單排分頁（不分組）：所有分頁一直顯示，順序已依新手流程排好 */
    nbMarkVisit();
    nbSyncHelp();
  } catch (e) { console.warn("[nb] decorate failed", e); }
}
function nbHomeHtml(p) {
  if (!nbActive(p)) return "";
  const cl = p.nbClaimed || {}, total = NB_STEPS.length, got = NB_STEPS.filter(s => cl[s.k]).length;
  const rows = NB_STEPS.map(s => {
    const ok = nbStepDone(p, s), taken = !!cl[s.k];
    const btn = taken ? `<span class="sub" style="margin:0;white-space:nowrap;">${dc("已領取", "Claimed")}</span>`
      : ok ? `<button class="btn small" data-nb-claim="${s.k}">${dc("領取", "Claim")}</button>`
      : s.k === "draw" ? "" : `<button class="btn small" data-nb-go="${s.k}">${dc("前往", "Go")}</button>`;
    return `<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--line);"><span style="font-size:18px;">${taken ? "✅" : ok ? "🎁" : "⬜"}</span><div style="flex:1;min-width:0;"><div style="font-weight:600;">${dc(s.zh, s.en)}</div><div class="sub" style="margin:2px 0 0;">${dc(s.hz, s.he)}</div><div class="sub" style="margin:2px 0 0;color:var(--gold-bright);">🎁 ${nbRwText(NB_REWARDS[s.k])}</div></div>${btn}</div>`;
  }).join("");
  return `<div class="panel"><h2>🧭 ${dc("新手任務", "Starter Quests")} ${got}/${total}</h2><p class="sub">${dc("完成每一步就能領該步的獎勵，每步只能領一次。分頁已依新手流程由左到右排好，照順序玩就對了。", "Finish a step to claim that step's reward - each can be claimed once. The tabs above are ordered for beginners - just go left to right.")}</p>${rows}</div>`;
}
function nbGoStep(k) {
  const s = NB_STEPS.find(x => x.k === k);
  if (!s) return;
  for (const t of (s.visit || [])) {
    const el = document.querySelector('#app>.tabs .tab[data-tab="' + t + '"]');
    if (el) { el.click(); return; }
  }
}
async function nbClaim(k) {
  const nick = zl.nickname, step = NB_STEPS.find(x => x.k === k), rw = NB_REWARDS[k];
  if (!nick || !step || !rw) return;
  let got = false;
  try {
    const upd = await Wl(nick, q => {
      got = false;                                   // Wl 遇到衝突會重跑，所以每次先歸零
      q.nbClaimed = q.nbClaimed || {};
      if (q.nbClaimed[k] || !nbStepDone(q, step)) return;   // 已領過、或最新資料顯示這步還沒完成：什麼都不改
      q.nbClaimed[k] = Date.now();
      nbRwGive(q, rw);
      got = true;
    });
    if (upd) {
      zl.player = upd;
      if (got) ac(dc(`完成「${step.zh}」！獲得 ${nbRwText(rw)} 🎉`, `"${step.en}" done! You received ${nbRwText(rw)} 🎉`));
      Eu();
    }
  } catch (e) {}
}
function nbBind(root) {
  root.querySelectorAll("[data-nb-go]").forEach(b => { b.onclick = () => nbGoStep(b.dataset.nbGo); });
  root.querySelectorAll("[data-nb-claim]").forEach(b => { b.onclick = () => { b.disabled = true; nbClaim(b.dataset.nbClaim); }; });
}

/* 每個分頁上方的「❓這頁怎麼玩」摺疊說明（放在 #tab-body 外面，Bu() 重繪分頁內容時不會被洗掉）。
   展開／收起的狀態記在 zl.nbHelpOpen，重畫後會保留。小遊戲分頁各有自己的說明，這裡不加。 */
const NB_HELP = {
  home:       { zh: "每天可免費抽三張塔羅牌並領金幣，連續簽到還有額外獎勵。完成下方的每日任務可拿隨機史詩卡，全部完成還有金幣加碼。", en: "Draw three free tarot cards every day and collect coins - streaks earn bonus coins. Finish the daily quests below for random epic cards, plus extra coins when you clear them all." },
  resonance:  { zh: "花金幣翻開三張牌試手氣。沒中獎的抽成會存進共鳴獎池，抽中三張史詩牌就能獨得整包獎池。GM 可能設定休息時段，休息中暫時不能玩。", en: "Spend coins to flip three cards. A cut of every miss goes into the jackpot pool, and three epic cards win the whole pool. A rest period may be set, during which play is paused." },
  collection: { zh: "這裡看你收集到的塔羅牌。VIP 每天領獎勵可得塔羅token，token 可自選兌換卡牌（每 1 token：普通 5 張／Uncommon 3 張／稀有 2 張／史詩 1 張）。", en: "Browse the tarot cards you've collected. VIPs earn Tarot Tokens from the daily reward and can swap each token for cards of their choice (5 common / 3 uncommon / 2 rare / 1 epic per token)." },
  farm:       { zh: "用金幣種下元素種子，等時間到再收成；也可以召喚、養成寵物，派牠們去尋寶換材料、金幣和骰子精華。記得逛逛好友的花園，互相澆水。", en: "Plant elemental seeds with coins and harvest when the timer ends. You can also summon and raise pets and send them treasure hunting for materials, coins and Dice Essence. Visit friends' gardens to water each other's plants." },
  expedition: { zh: "選擇風險等級和時長派出遠征，時間到再回來領結果。連勝有額外獎勵（只有「亡命」風險＋8小時遠征的成敗會累加或打斷連勝）。", en: "Pick a risk level and duration, send the expedition out, and come back for the result when time is up. Streaks earn bonus rewards (only Reckless risk + 8-hour trips add to or break the streak)." },
  profession: { zh: "培養職業等級、累積材料與物品；萬物熔爐每天結算一次獎勵，記得每天回來看看。", en: "Level up your professions and gather materials and items. The All-Things Furnace settles rewards once a day, so check back daily." },
  friends:    { zh: "這裡是信箱和好友：輸入對方暱稱就能送出好友邀請。好友幫你澆水、拍賣成交等通知，都會寄到信箱。", en: "Your mailbox and friends list: enter a nickname to send a friend request. Notifications such as friends watering your plants or an auction selling arrive in the mailbox." },
  auction:    { zh: "掛賣自己的卡片和物品、競標或一口價購買，也可以掛求購單。「最新交易」看成交行情，「魔法裝備交易」用神秘碎片買賣裝備，遺物與古董、古董鑒定也在這一頁。", en: "List your cards and items, bid or buy outright, or post buy orders. 'Latest Trades' shows market prices, 'Magic Gear' trades gear for Mystery Shards, and Relics & Antiques and Appraisal live here too." },
  boss:       { zh: "世界 Boss：加入並排隊入座後，用骰子造成傷害。擊敗 Boss 可領金幣和骰子精華，傷害第一名還有封號。", en: "World Boss: join and queue for a seat, then deal damage with your dice. Defeating the boss pays coins and Dice Essence, and the top damage dealer earns a title." },
  arena:      { zh: "非同步 PvP，對手不用在線，選一位對手立即出結果。攻擊用你身上裝備的骰子，被挑戰時用你設定的防守佈陣，記得先設定。積分榜每週一 00:00 重置，第一名拿「天下無雙」封號。", en: "Asynchronous PvP - your opponent doesn't need to be online and you get the result instantly. Attacks use your equipped dice; when challenged, your saved defence lineup is used, so set one first. The ranking resets every Monday 00:00 and #1 earns a title." },
  season:     { zh: "用貢獻點抽賽季卡（保證抽到沒收集過的），集滿 12 張可解鎖第 13 張傳說卡；也可以用貢獻點點亮 12 星座節點，同元素三連有加成，賽季結束會重置。", en: "Spend contribution points to draw season cards (always a new one) - collect all 12 to unlock the 13th legendary card. You can also light the 12 zodiac nodes with points; element triples add bonuses, and everything resets when the season ends." },
  starraceroulette: { zh: "賽馬場（星軌競速）和塔羅輪盤都在這一頁。塔羅輪盤有 22 格，押中愚者直注賠 20:1，其餘外圍注在愚者出現時全輸；休市時間不能下注。", en: "Star Race and the Tarot Roulette are both here. The roulette has 22 slots: a straight bet on the Fool pays 20:1, while outside bets lose when the Fool appears. Betting is closed outside opening hours." },
  leaderboard:{ zh: "看財富、種菜收成、拍賣交易量、遠征連勝等各種排行榜；達成成就可以解鎖徽章，裝備在名字旁邊。", en: "See rankings for wealth, harvests, auction volume, expedition streaks and more. Achievements unlock badges that you can equip next to your name." }
};
function nbSyncHelp() {
  const app = document.getElementById("app"), body = document.getElementById("tab-body");
  if (!app || !body || !zl.player) return;
  const key = zl.tab === "starchart" ? "season" : zl.tab, h = NB_HELP[key];
  const cur = app.querySelector(":scope>.nb-help");
  if (!h) { if (cur) cur.remove(); return; }
  if (cur && cur.dataset.nbTab === key) return;
  if (cur) cur.remove();
  const det = document.createElement("details");
  det.className = "bomb-help nb-help";
  det.dataset.nbTab = key;
  det.open = !!(zl.nbHelpOpen && zl.nbHelpOpen[key]);
  det.innerHTML = `<summary>❓ ${dc("這頁怎麼玩（點開）", "How this page works (tap to open)")}</summary><p class="sub" style="font-size:12px;">${dc(h.zh, h.en)}</p>`;
  det.addEventListener("toggle", () => { (zl.nbHelpOpen = zl.nbHelpOpen || {})[key] = det.open; });
  body.parentNode.insertBefore(det, body);
}
if (!window.__nbHelpTimer) window.__nbHelpTimer = setInterval(() => { try { nbSyncHelp(); } catch (e) {} }, 1000);   // 分頁在 Bu() 裡被切換時也會跟上
/* ===== 🧭 新手引導 — end ===== */
function ku(){return!!zl.nickname&&zl.nickname.toLowerCase()===wu.toLowerCase()}function xu(e){document.getElementById("app").innerHTML=e}async function Eu(){"resonance"!==zl.tab&&(zl.resonanceRerollPending=null,zl.pickPending&&(zl.pickPending=null,zl.flipped=[!0,!0,!0],id()));const e=window.scrollY,t=document.getElementById("tab-body"),n=t?t.innerHTML:"";if(!zl.nickname||!zl.player){xu(`\n      <div class="login-screen">\n        <div class="sigil">🔮</div>\n        <h1>${cc("appName")}</h1>\n        <p>${cc("loginIntro")}</p>\n        <input id="nick-input" type="text" placeholder="${cc("nickPlaceholder")}" maxlength="20" value="${sc?Iu(sc):""}" />\n        <input id="pw-input" type="password" placeholder="${cc("pwPlaceholder")}" />\n        <input id="confirm-pw-input" type="password" placeholder="${dc("新帳號請再次輸入密碼確認","New account? Confirm your password")}" style="display:none;" />\n        <input id="invite-code-input" type="text" placeholder="${dc("新帳號請輸入 GM 提供的邀請碼","New account? Enter the invite code from your GM")}" maxlength="12" style="display:none;text-transform:uppercase;" />\n        <button class="btn full" id="login-btn">${cc("loginBtn")}</button>\n        <p style="font-size:11px;color:var(--muted);margin-top:14px;">${cc("pwWarning")}</p>\n        <p style="font-size:12px;color:var(--muted);margin-top:8px;">${cc("igFollow")} <a href="https://www.instagram.com/lekcusong" target="_blank" rel="noopener" class="ig-link">@lekcusong</a> ${cc("igFollowSuffix")}</p>\n      </div>\n    `);const t=document.getElementById("nick-input"),n=document.getElementById("confirm-pw-input"),a=document.getElementById("invite-code-input"),i=async()=>{const e=t.value.trim();if(!e)return n.style.display="none",n.value="",a.style.display="none",void(a.value="");try{const t=await Zl(e),i=!t;n.style.display=i?"block":"none",t&&(n.value="");const o=i&&e.toLowerCase()!==wu.toLowerCase();a.style.display=o?"block":"none",o||(a.value="")}catch(e){}};t.addEventListener("blur",i),sc&&i();const o=()=>Pc(t.value,document.getElementById("pw-input").value,n.value,a.value);return document.getElementById("login-btn").onclick=o,document.getElementById("pw-input").addEventListener("keydown",e=>{"Enter"===e.key&&o()}),n.addEventListener("keydown",e=>{"Enter"===e.key&&o()}),a.addEventListener("keydown",e=>{"Enter"===e.key&&o()}),void window.scrollTo(0,e)}const a=zl.player;or(a),xu(`\n    <div class="brand">\n      <div>\n        <h1>${cc("appName")}</h1>\n        <div class="tag">Tarot Collection · <a href="https://www.instagram.com/lekcusong" target="_blank" rel="noopener" class="ig-link">@lekcusong</a></div>\n      </div>\n      ${HEADER_BANNER_URL?`<div class="brand-banner" id="brand-banner"><img src="${HEADER_BANNER_URL}" alt="banner" onerror="this.parentNode.style.display='none'" onclick="openBannerLightbox(this.src)" /></div>`:""}\n      <div class="player-chip">\n        <span class="name">${M(a)} ${Iu(a.nickname)}${ir(a,16)}</span>\n        <span class="coin" id="player-coin">✦ ${fmtCoin(a.coins)}</span>\n        <button id="notif-bell-btn" style="position:relative;">🔔<span id="notif-badge" style="display:${Zc>0?"inline-flex":"none"};position:absolute;top:-4px;right:-4px;background:#e0455f;color:#fff;border-radius:999px;font-size:10px;line-height:1;padding:2px 5px;">${Zc>9?"9+":Zc}</span></button>\n        <button id="pwa-install-btn" title="${dc("安裝到手機","Install app")}" style="display:${window.__pwaShow&&window.__pwaShow()?"inline-block":"none"};">📲</button>\n        <button id="logout-btn">${cc("logout")}</button>\n      </div>\n    </div>\n    <div class="tabs">\n      <div class="tab ${"home"===zl.tab?"active":""}" data-tab="home">${cc("tabHome")}</div>\n      <div class="tab ${"resonance"===zl.tab?"active":""}" data-tab="resonance">${cc("tabResonance")}</div>\n      <div class="tab ${"collection"===zl.tab?"active":""}" data-tab="collection">🎴 ${cc("tabCollection")}</div>\n      <div class="tab ${"farm"===zl.tab?"active":""}" data-tab="farm">${cc("tabFarm")}</div>\n      <div class="tab ${"expedition"===zl.tab?"active":""}" data-tab="expedition">${cc("tabExpedition")}</div>\n      <div class="tab ${"profession"===zl.tab?"active":""}" data-tab="profession">${cc("tabProfession")}</div>\n      ${ae?`<div class="tab ${"boss"===zl.tab?"active":""}" data-tab="boss">⚔️ ${dc("Boss","Boss")}</div>`:""}\n      <div class="tab ${"arena"===zl.tab?"active":""}" data-tab="arena">⚔️ ${dc("pvp和裝備","PvP & Gear")}</div>\n      ${ae?`<div class="tab ${"season"===zl.tab||"starchart"===zl.tab?"active":""}" data-tab="season">✦ ${dc("星象幻境和星盤","Astral Reverie & Star Chart")}</div>`:""}\n      <div class="tab ${"auction"===zl.tab?"active":""}" data-tab="auction">${cc("tabAuction")}</div>\n      <div class="tab ${"bomb"===zl.tab||"match3"===zl.tab||"potion"===zl.tab||"ballpit"===zl.tab?"active":""}" data-tab="${"match3"===zl.tab?"match3":"potion"===zl.tab?"potion":"ballpit"===zl.tab?"ballpit":"bomb"===zl.tab?"bomb":zl.bmLast||"bomb"}">🎮 ${dc("小遊戲","Minigames")}</div>\n      <div class="tab ${"starraceroulette"===zl.tab?"active":""}" data-tab="starraceroulette">🎡 ${dc("塔羅賽馬場和輪盤","Star Race & Roulette")}</div>\n      <div class="tab ${"leaderboard"===zl.tab?"active":""}" data-tab="leaderboard">${cc("tabLeaderboard")}</div>\n      <div class="tab ${"friends"===zl.tab?"active":""}" data-tab="friends">${cc("tabFriends")}</div>\n      <div class="tab ${"chat"===zl.tab?"active":""}" data-tab="chat" style="position:relative;">${cc("tabChat")}<span id="chat-tab-badge" style="display:${Gc>0?"inline-flex":"none"};position:absolute;top:2px;right:2px;background:#e0455f;color:#fff;border-radius:999px;font-size:9px;line-height:1;padding:2px 5px;">${Gc>9?"9+":Gc}</span></div>\n      
      ${ku()?`<div class="tab ${"gm"===zl.tab?"active":""}" data-tab="gm">${cc("tabGM")}</div>`:""}\n    </div>\n    <div id="tab-body">${n}</div>\n  `),nbDecorateTabs(),document.getElementById("logout-btn").onclick=Nc;const i=document.getElementById("notif-bell-btn");i&&(i.onclick=async()=>{zl.tab="friends",zl.fmView="mailbox",await qc(),Eu()}),document.querySelectorAll(".tab").forEach(e=>{e.onclick=async()=>{zl.tab=e.dataset.tab,"farm"!==zl.tab&&(zl.farmUpgradeMode=!1,zl.farmUpgradeSelections=null),await qc(),"chat"===zl.tab&&Pd(),Eu()}});const o=Bu();await o,window.scrollTo(0,e),ur&&(clearInterval(ur),ur=null),"farm"===zl.tab&&(ur=setInterval(()=>{if("farm"===zl.tab){if(document.hidden)return;if(!zl.farmUpgradeMode){const ae=document.activeElement,skipTick=ae&&ae.id&&0===ae.id.indexOf("pet-v2-filter-");if(!skipTick){const e=window.scrollY;Bu({tick:!0}),window.scrollTo(0,e)}}}else clearInterval(ur),ur=null},1e3)),mr&&(clearInterval(mr),mr=null),"expedition"===zl.tab&&(mr=setInterval(async()=>{if("expedition"===zl.tab){if(document.hidden||mrBusy)return;const e=document.activeElement;if(e&&(e.tagName==="INPUT"||e.tagName==="SELECT"||e.tagName==="TEXTAREA"))return;if(zl.streakBossAnimating)return;if(zl.expeditionRescueAnimating)return;if(Date.now()-_potionTouchTs<2500)return;mrBusy=!0;try{const t=Array.from(document.querySelectorAll('select[id^="furniture-sel-"], select[id^="accessory-sel-"], select[id^="weapon-sel-"]')).map(e=>({id:e.id,value:e.value}));await Bu({tick:!0}),t.forEach(({id:e,value:t})=>{const n=document.getElementById(e);n&&!n.disabled&&Array.from(n.options).some(e=>e.value===t)&&(n.value=t)})}finally{mrBusy=!1}}else clearInterval(mr),mr=null},1e3)),pr&&(clearInterval(pr),pr=null),"profession"===zl.tab&&(pr=setInterval(()=>{if("profession"===zl.tab){if(document.hidden)return;const active=document.activeElement;if(active&&("INPUT"===active.tagName||"SELECT"===active.tagName||"TEXTAREA"===active.tagName))return;if("furnace"===zl.profView){if(window.__afRenderBusy)return;window.__afTick=(window.__afTick||0)+1;if(window.__afTick%15!==0)return}const e=window.scrollY;Bu(),window.scrollTo(0,e)}else clearInterval(pr),pr=null},1e3)),bmTimer&&(clearInterval(bmTimer),bmTimer=null),"bomb"===zl.tab&&(bmTimer=setInterval(()=>{"bomb"===zl.tab?bombPoll():(clearInterval(bmTimer),bmTimer=null)},BOMB_LITE?3000:1500)),bmCountdownTimer&&(clearInterval(bmCountdownTimer),bmCountdownTimer=null),"bomb"===zl.tab&&(bmCountdownTimer=setInterval(()=>{"bomb"===zl.tab?bombUpdateBannerDom():(clearInterval(bmCountdownTimer),bmCountdownTimer=null)},1000)),bmChatTimer&&(clearInterval(bmChatTimer),bmChatTimer=null),"bomb"===zl.tab&&(bmChatTimer=setInterval(()=>{"bomb"===zl.tab?bombChatPoll():(clearInterval(bmChatTimer),bmChatTimer=null)},BOMB_LITE?6000:2500))}const Mu=10;function Cu(e,t,n){return t<=1?"":`<div class="form-row" style="justify-content:center;margin-top:10px;gap:10px;align-items:center;">\n    <button class="btn small secondary" id="${n}-prev" ${e<=1?"disabled":""}>‹ ${dc("上一頁","Prev")}</button>\n    <span style="font-family:'Space Mono',monospace;font-size:12px;color:var(--muted);">${dc(`第 ${e} / ${t} 頁`,`Page ${e} / ${t}`)}</span>\n    <button class="btn small secondary" id="${n}-next" ${e>=t?"disabled":""}>${dc("下一頁","Next")} ›</button>\n  </div>`}function Su(e,t,n,a){if(t<=1)return;const i=document.getElementById(`${n}-prev`),o=document.getElementById(`${n}-next`);i&&(i.onclick=()=>{zl[a]=Math.max(1,e-1),Bu()}),o&&(o.onclick=()=>{zl[a]=Math.min(t,e+1),Bu()})}function Iu(e){return String(e).replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[e]))}function fmtCoin(e){const n=Math.floor(Number(e));return isFinite(n)?n.toLocaleString("en-US"):String(e)}
function Au(){const e=document.getElementById("player-coin");e&&zl.player&&(e.textContent=`✦ ${fmtCoin(zl.player.coins)}`);const t=document.getElementById("player-feathers");t&&zl.player&&(t.textContent=`🕊️ ${zl.player.feathers||0}`)}/* ---------- 每秒刷新用的就地更新（遠征倒數等）----------
   原本每秒 innerHTML 整頁重建：所有節點被砍掉重畫，畫面會每秒往下彈一下、按鈕點擊會被吃掉。
   這裡改成只改有變的文字／屬性，節點本身不動。改完會比對結果，任何不一致就退回整頁重建（＝舊行為）。 */
function __buSameNode(o,n){return o.nodeType===n.nodeType&&o.nodeName===n.nodeName}
function __buMorphAttrs(o,n){
  for(const at of Array.from(o.attributes)) if(!n.hasAttribute(at.name)) o.removeAttribute(at.name);
  for(const at of Array.from(n.attributes)) if(o.getAttribute(at.name)!==at.value) o.setAttribute(at.name,at.value);
}
function __buMorphKids(a,b){
  const nk=Array.from(b.childNodes);
  for(let i=0;i<nk.length;i++){
    const n=nk[i],o=a.childNodes[i];
    if(!o){a.appendChild(n);continue}
    if(!__buSameNode(o,n)){a.replaceChild(n,o);continue}
    if(o.nodeType!==1){if(o.data!==n.data)o.data=n.data;continue}
    if(o.hasAttribute("data-live")&&n.hasAttribute("data-live")){   // 倒數文字／進度條由 __liveTick 自己更新，整頁刷新不碰它們
      ["data-ready-at","data-start-at"].forEach(k=>{if(n.hasAttribute(k)&&o.getAttribute(k)!==n.getAttribute(k))o.setAttribute(k,n.getAttribute(k))});
      continue;
    }
    __buMorphAttrs(o,n);
    __buMorphKids(o,n);
  }
  while(a.childNodes.length>nk.length)a.removeChild(a.lastChild);
}
function __buSetHtml(host,html){
  if(!window.__buTick||!host.firstChild){host.innerHTML=html;return}
  try{
    const neutral=root=>{root.querySelectorAll("[data-live]").forEach(x=>{x.textContent="";x.removeAttribute("style")});return root.innerHTML};
    const tpl=document.createElement("template");tpl.innerHTML=html;
    const wrap=document.createElement("div");wrap.innerHTML=html;const want=neutral(wrap);   // 先取序列化結果：下面的 morph 會把節點從 tpl 搬走
    __buMorphKids(host,tpl.content);
    if(neutral(host.cloneNode(true))!==want){window.__buFellBack=true;host.innerHTML=html}   // 保險：不一致就整頁重建
  }catch(err){window.__buFellBack=true;host.innerHTML=html}
}
window.__BU_BUILD="tick-inplace-v5-pin-docspace";
/* ---------- 每秒刷新的視覺錨點 ----------
   遠征頁每秒刷新時畫面會被整片推走約 20px、0.3 秒後再彈回來（原因還在查）。
   不管是什麼推的：刷新前記住畫面上一個參考元素的位置，刷新後、解鎖後、以及之後 0.9 秒內每一幀，
   位置被推走就立刻捲回去（同一個任務內完成，不會畫出偏移的那一幀）。使用者自己在捲動時完全不介入。 */
const __tickPin={lastUserAt:0,lastScrollAt:0,ours:0,raf:0};
["wheel","touchstart","touchmove","keydown","mousedown","pointerdown"].forEach(ev=>window.addEventListener(ev,()=>{__tickPin.lastUserAt=Date.now()},{passive:true,capture:true}));
/* 手指離開後的慣性滑動／iOS 底部橡皮筋回彈不會再有 touch 事件，只有 scroll 事件。
   不是我們自己 scrollBy 造成的 scroll 事件，一律視為「使用者還在捲」。 */
window.addEventListener("scroll",()=>{ if(__tickPin.ours>0)return; __tickPin.lastScrollAt=Date.now() },{passive:true});
function __pinUserBusy(){const n=Date.now();return n-__tickPin.lastUserAt<350||n-__tickPin.lastScrollAt<250}
function __pinScroll(d){ __tickPin.ours++; window.scrollBy(0,d); requestAnimationFrame(()=>requestAnimationFrame(()=>{__tickPin.ours=Math.max(0,__tickPin.ours-1)})) }
function __pinPick(tb){
  const vh=window.innerHeight||800; let cur=tb,path=[];
  for(let depth=0;depth<5;depth++){
    let hit=-1; const kids=cur.children;
    for(let i=0;i<kids.length;i++){const r=kids[i].getBoundingClientRect(); if(r.height>0&&r.bottom>8&&r.top<vh){hit=i;break}}
    if(hit<0)break; cur=kids[hit]; path.push(hit);
  }
  if(!path.length)return null;
  return {path,top:cur.getBoundingClientRect().top+window.scrollY};   // 文件座標：使用者捲動不會改變它，只有版面位移才會
}
function __pinEl(tb,pin){let el=tb; for(const i of pin.path){el=el&&el.children[i]} return el&&el.isConnected?el:null}
function __pinFix(tb,pin){
  if(!pin)return false; const el=__pinEl(tb,pin); if(!el)return false;
  const d=el.getBoundingClientRect().top+window.scrollY-pin.top;   // 文件座標位移＝真正的版面位移；使用者捲動／橡皮筋回彈時 d 恆為 0
  if(Math.abs(d)<1)return false;
  pin.top+=d;                                                       // 不論有沒有補，都以新版面為基準，避免下一幀重複補
  if(__pinUserBusy())return false;                                  // 使用者還在捲：不去碰捲動位置（iOS 上程式捲動會打斷慣性）
  if(Math.abs(d)<=120){__pinScroll(d);return true}
  return false;
}
function __pinAround(tb,pin,fn){   // 執行 fn（例如解除高度鎖）前後量同一個元素，被推走就補回來
  const el=pin?__pinEl(tb,pin):null; const t1=el?el.getBoundingClientRect().top:0;
  fn();
  if(!el||__pinUserBusy())return;
  const d=el.getBoundingClientRect().top-t1;
  if(Math.abs(d)>=1&&Math.abs(d)<=120)__pinScroll(d);
}
function __pinWatch(tb,pin){
  if(!pin)return; cancelAnimationFrame(__tickPin.raf); const t0=performance.now();
  const step=()=>{ __pinFix(tb,pin); if(performance.now()-t0<900)__tickPin.raf=requestAnimationFrame(step); };
  __tickPin.raf=requestAnimationFrame(step);
}
/* 診斷：網址加 ?shiftdebug=1 會在左上角顯示每次版面位移是哪個元素、從哪到哪 */
(function(){
  try{
    if(!/[?&]shiftdebug=1/.test(location.search)||!window.PerformanceObserver)return;
    const box=document.createElement("div");
    box.style.cssText="position:fixed;left:0;top:0;z-index:99999;max-width:96vw;background:rgba(0,0,0,.85);color:#7f7;font:10px/1.35 monospace;padding:4px 6px;pointer-events:none;white-space:pre-wrap";
    const lines=[]; let n=0;
    const desc=el=>!el?"?":(el.nodeType!==1?"#text":(el.tagName.toLowerCase()+(el.id?"#"+el.id:"")+(el.className&&typeof el.className==="string"?"."+el.className.trim().split(/\s+/).slice(0,2).join("."):"")+" \""+(el.textContent||"").trim().slice(0,14)+"\""));
    new PerformanceObserver(list=>{
      for(const e of list.getEntries()){ if(e.hadRecentInput)continue; n++;
        const s=(e.sources||[]).slice(0,2).map(x=>desc(x.node)+" y"+Math.round(x.previousRect.y)+"→"+Math.round(x.currentRect.y)+" h"+Math.round(x.previousRect.height)+"→"+Math.round(x.currentRect.height)).join(" | ");
        lines.push("#"+n+" "+(performance.now()/1000).toFixed(1)+"s v="+e.value.toFixed(4)+" "+s); if(lines.length>7)lines.shift(); box.textContent="layout-shift log\n"+lines.join("\n"); }
    }).observe({type:"layout-shift",buffered:true});
    box.textContent="layout-shift log (waiting…)"; (document.body?Promise.resolve():new Promise(r=>addEventListener("DOMContentLoaded",r))).then(()=>document.body.appendChild(box));
  }catch(err){}
})();
function Bu(opts){
  // opts.tick===true：每秒自動刷新（例如遠征倒數），不是使用者操作。
  // 這種重繪會重新建立橫幅圖等元素，元素就緒前高度會瞬間塌縮；若此時提早解除高度鎖，
  // 捲到頁面底部的人會被瀏覽器夾住 scrollY，畫面就會上下彈跳一下。所以 tick 一律保持鎖定，等 300ms 靜止後才釋放。
  const isTick=!!(opts&&opts.tick===true), __tickStart=Date.now();
  const tb=document.getElementById("tab-body"), y=window.scrollY;
  let pin=null; if(isTick&&tb){ try{pin=__pinPick(tb)}catch(err){} }
  let token=0;
  if(tb){ token=(tb.__buLock=(tb.__buLock||0)+1); tb.style.minHeight=tb.offsetHeight+"px"; }
  const release=()=>{ if(tb&&tb.__buLock===token){ if(pin){ try{__pinAround(tb,pin,()=>{tb.style.minHeight=""})}catch(err){tb.style.minHeight=""} } else tb.style.minHeight=""; } };
  const settle=()=>{
    if(isTick&&!window.__buFellBack){
      // 每秒刷新只改了文字，版面沒動：不需要高度鎖，也不需要等 300ms。
      // 舊做法會讓鎖撐住 300ms，期間整頁被推下去約 15px，解鎖時再彈回來（影片裡每秒一次的上下彈跳）。
      release();
      if(Math.abs(window.scrollY-y)>1&&!(__tickPin.lastUserAt>=__tickStart||__tickPin.lastScrollAt>=__tickStart||__pinUserBusy())) window.scrollTo(0,y);   // 刷新期間使用者有捲動：y 已過期，不能拉回
      if(pin){ try{__pinFix(tb,pin);__pinWatch(tb,pin)}catch(err){} }
      return;
    }
    window.__buFellBack=false;
    // 新內容比鎖住的高度矮、而且原本的捲動位置已經超出新內容底部時，立刻解除鎖定，
    // 否則畫面會停在下方空白處（黑畫面）直到 300ms 後才解鎖。例如「確認出征」後版面從很長的任務清單縮成進行中面板。
    if(tb&&!isTick){
      try{
        const prevMin=tb.style.minHeight;
        tb.style.minHeight="";
        const maxY=Math.max(0,document.documentElement.scrollHeight-window.innerHeight);
        if(y<=maxY+1) tb.style.minHeight=prevMin;
      }catch(err){}
    }
    if(Math.abs(window.scrollY-y)>1) window.scrollTo(0,y);
    if(pin){ try{__pinFix(tb,pin);__pinWatch(tb,pin)}catch(err){} }
    if(!tb) return;
    let timer=null, cap=null, obs=null;
    const done=()=>{ if(obs) obs.disconnect(); clearTimeout(timer); clearTimeout(cap); release(); };
    const bump=()=>{ clearTimeout(timer); timer=setTimeout(done,300); };
    obs=new MutationObserver(bump); obs.observe(tb,{childList:true,subtree:true});
    cap=setTimeout(done,4000); bump();
  };
  let res;
  window.__buTick=isTick;
  try{ res=__BuCore(); }catch(err){ window.__buTick=false; release(); throw err; }
  const endTick=()=>{ if(isTick) window.__buTick=false; };
  if(res&&typeof res.then==="function") return res.then(v=>{endTick();settle();return v;},err=>{endTick();settle();throw err;});
  endTick(); settle(); return res;
}