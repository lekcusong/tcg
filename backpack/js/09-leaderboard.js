'use strict';
/* ===== 排行榜（Supabase RPC；與主遊戲同一個專案；目前沒有獎勵）===== */
const BP_URL = "https://hmkpwrefecwjxnyggcej.supabase.co", BP_KEY = "sb_publishable_vs1K1Ao4Gjl2JK5xrK-GpQ_aXsHyty7";
const bpEsc = t => String(t == null ? "" : t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
// 身分：沿用主遊戲存在同一個網域 localStorage 的登入資訊（my-session）。伺服器會用 token 驗證，不能冒用別人。
function bpWho() { try { const o = JSON.parse(localStorage.getItem("my-session") || "null"); if (o && o.nickname && o.token) return { nick: o.nickname, token: o.token }; } catch (e) { } return null; }
async function bpRpc(fn, body) {
  const r = await fetch(BP_URL + "/rest/v1/rpc/" + fn, { method: "POST", headers: { apikey: BP_KEY, Authorization: "Bearer " + BP_KEY, "Content-Type": "application/json" }, body: JSON.stringify(body || {}), cache: "no-store" });
  if (!r.ok) throw new Error(fn + " " + r.status); return r.json();
}
const BP_ERR = { bad_session: "登入狀態失效：請回主遊戲重新整理一次（或重新登入），再按「重試」。", too_fast: "送出太快，請等 20 秒後再按「重試」。", daily_cap: "今天送出的次數已達上限。", bad_day: "每日挑戰日期不符，這局不計入。", bad_run: "這局資料不合法，無法上榜。", bad_mode: "模式不合法，無法上榜。" };
async function bpReport(run) {
  const el = $("#bpRes"); if (!el) return;
  const w = bpWho();
  if (!w) { el.innerHTML = "未偵測到主遊戲登入，這局不會上榜。請先在主遊戲登入，再用同一個瀏覽器開啟本頁。"; return; }
  el.textContent = "送出成績中…";
  try {
    const r = await bpRpc("bp_submit", { p_nick: w.nick, p_token: w.token, p_mode: run.mode, p_day: run.day, p_char: run.char, p_reached: run.reached, p_wins: run.wins, p_lives: run.lives, p_relics: run.relics, p_clear: run.clear });
    if (!el.isConnected) return;
    if (!r || !r.ok) {
      el.innerHTML = (BP_ERR[r && r.error] || "成績送出失敗") + ' <button class="btn" id="bpRetry" style="padding:4px 10px;font-size:12px">重試</button>';
      $("#bpRetry").onclick = () => bpReport(run); return;
    }
    const lb = run.mode === "daily" ? "今日挑戰榜" : "總榜";
    el.innerHTML = r.improved ? `🎉 ${lb}新個人最高 <b>${r.score}</b> 分・第 <b>${r.rank}</b> / ${r.total} 名` : `本局 ${r.score} 分，未超過你的最高 ${r.best} 分・${lb}第 <b>${r.rank}</b> / ${r.total} 名`;
  } catch (e) {
    if (!el.isConnected) return;
    el.innerHTML = '成績送出失敗（連線）。 <button class="btn" id="bpRetry" style="padding:4px 10px;font-size:12px">重試</button>';
    $("#bpRetry").onclick = () => bpReport(run);
  }
}
async function showBoard(tab) {
  const ov = $("#ov"); ov.hidden = false;
  const w = bpWho(), key = tab === "d" ? "d:" + todayStr() : "all";
  const head = `<div class="card"><h2>排行榜</h2><div class="mrow"><button class="btn ${tab === "d" ? "" : "primary"}" id="bpT1">總榜</button><button class="btn ${tab === "d" ? "primary" : ""}" id="bpT2">今日挑戰榜</button></div>`;
  const foot = `<button class="btn" id="bpBack" style="margin-top:10px">返回</button></div>`;
  const wire = () => { $("#bpT1").onclick = () => showBoard("all"); $("#bpT2").onclick = () => showBoard("d"); $("#bpBack").onclick = showStart; };
  ov.innerHTML = head + '<p class="sub">讀取中…</p>' + foot; wire();
  let b = null;
  try { b = await bpRpc("bp_board", { p_board: key, p_nick: w ? w.nick : null, p_limit: 50 }); } catch (e) { b = null; }
  if (!$("#bpBack")) return;   // 使用者已離開
  if (!b || !b.ok) { ov.innerHTML = head + '<p class="sub">無法讀取排行榜（後端 SQL 是否已安裝？）</p>' + foot; wire(); return; }
  const meNick = w ? w.nick.toLowerCase() : "", medal = n => n === 1 ? "🥇" : n === 2 ? "🥈" : n === 3 ? "🥉" : "#" + n;
  const row = (t, me) => `<div style="display:flex;gap:8px;align-items:center;padding:6px 8px;border-radius:9px;margin:4px 0;text-align:left;font-size:13px;background:${me ? "rgba(232,196,104,.18)" : "rgba(0,0,0,.25)"};${me ? "border:1px solid var(--gold)" : ""}"><b style="min-width:34px">${medal(t.rank)}</b><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${bpEsc(t.nick)}</span><small style="color:var(--muted);white-space:nowrap">${t.clear ? "通關" : "第" + t.reached + "回合"} · 勝${t.wins}</small><b style="color:var(--gold)">${t.score}</b></div>`;
  const rows = b.top.map(t => row(t, t.nick.toLowerCase() === meNick)).join("") || '<p class="sub">還沒有人上榜，搶頭香！</p>';
  const mine = b.me && !b.top.some(t => t.nick.toLowerCase() === meNick) ? '<p class="sub" style="margin:8px 0 0">你的名次</p>' + row(b.me, true) : "";
  const tip = w ? "" : '<p class="sub">未偵測到主遊戲登入，只能看榜，打完不會上榜。</p>';
  ov.innerHTML = head + `<p class="sub">${tab === "d" ? "今日挑戰榜（" + todayStr() + "）" : "一般旅程總榜"}・每人取最高分・共 ${b.total} 人・暫無獎勵</p>${tip}<div style="max-height:52vh;overflow-y:auto">${rows}${mine}</div>` + foot; wire();
}
function showStart() {
  const ov = $("#ov"); ov.hidden = false; G.over = true;
  const sv = readSave(), td = todayStr(), db = META.daily[td];
  ov.innerHTML = `<div class="card"><div class="big">${itemIcon("m19", 56)}</div><h2>塔羅背包亂鬥</h2><p class="sub">12 回合 · 3 場 Boss · 遺物與事件</p>
  <div class="menu">
   ${sv ? `<button class="btn primary mb" id="mCont">${uiIcon("save", 18)}<span>繼續旅程<small>第 ${sv.round} 回合${sv.mode === "daily" ? "（每日挑戰）" : ""}</small></span></button>` : ""}
   <button class="btn ${sv ? "" : "primary"} mb" id="mNew">${uiIcon("play", 18)}<span>開始新旅程<small>選擇角色與起始牌</small></span></button>
   <button class="btn mb" id="mDaily">${uiIcon("cal", 18)}<span>每日挑戰<small>${td}${db ? " · 今日最高 " + db : " · 全服同一組商店與對手"}</small></span></button>
   <button class="btn mb" id="mRank">${uiIcon("medal", 18)}<span>排行榜<small>總榜 · 每日挑戰榜（暫無獎勵）</small></span></button>
    <div class="mrow"><button class="btn" id="mCodex">${uiIcon("book", 16)}<span>圖鑑</span></button><button class="btn" id="mAch">${uiIcon("medal", 16)}<span>成就 ${Object.keys(META.ach).length}/${ACH.length}</span></button><button class="btn" id="mHow">${uiIcon("help", 16)}<span>玩法</span></button></div>
  </div>${G.best ? `<p class="sub">最佳紀錄：撐到第 ${G.best} 回合</p>` : ""}</div>`;
  if (sv) $("#mCont").onclick = () => { AU.ensure(); AU.buy(); loadRun(sv); };
  $("#mNew").onclick = () => { AU.ensure(); showPick(); };
  $("#mDaily").onclick = () => { AU.ensure(); AU.buy(); if (sv && !confirm("開始新的每日挑戰會覆蓋目前的存檔，確定嗎？")) return; const sd = "daily-" + td; startRun(dailyStartId(sd), "daily", sd); };
  $("#mRank").onclick = () => { AU.ensure(); showBoard("all"); };
  $("#mCodex").onclick = () => showCodex("items"); $("#mAch").onclick = () => showCodex("ach"); $("#mHow").onclick = showHow;
  if (!META.tut) { META.tut = 1; saveMeta(); showHow(); }
}
function showPick() {
  const ov = $("#ov");
  ov.innerHTML = `<div class="card"><h2>選擇角色</h2><div class="chars">${CHARS.map(c => { const open = !c.ok || c.ok(META), d = ID[c.ic], S = SUITS[d.suit]; return `<button class="chr ${open ? "" : "lk"}" data-id="${c.id}" style="${sv(S)}"><div class="sic">${open ? itemIcon(c.ic, 40) : uiIcon("lock", 30)}</div><div class="cinf"><b>${c.nm}</b><span class="pro">＋ ${c.pro}</span><span class="con">－ ${c.con}</span><small>${open ? "起始：" + c.start.map(i => ID[i].nm).join("、") : "解鎖：" + c.unlock}</small></div></button>`; }).join("")}</div><button class="btn" id="back" style="margin-top:10px">返回</button></div>`;
  ov.querySelectorAll(".chr").forEach(b => b.onclick = () => { const c = CID[b.dataset.id]; if (c.ok && !c.ok(META)) return toast("尚未解鎖：" + c.unlock); AU.buy(); clearRun(); startRun(c.id); }); $("#back").onclick = showStart;
}
function showHow() {
  const ov = $("#ov"); ov.hidden = false;
  ov.innerHTML = `<div class="card how"><div class="big">${uiIcon("help", 40, "#e8c468")}</div><h2>玩法</h2><ul>
   <li><b>買牌排牌：</b>用金幣買牌拖進背包。<b>相鄰</b>的牌會加成：同花色、特定花色，或光環牌；牌之間會出現發光連結線。</li>
   <li><b>花色共鳴：</b>背包內同花色放滿 <b>2／4 張</b>會觸發共鳴加成（權杖灼燒、聖杯回復／再生、寶劍傷害／易傷、錢幣護盾／反彈）；四種花色各 1 張還有「四象」冷卻加成。點背包下方的標籤看詳情。</li>
   <li><b>控場狀態：</b><b>緩速</b>讓敵方所有牌慢 30%、<b>易傷</b>讓敵方受到的直接傷害 +25%（灼燒、中毒不受影響）。聖杯系負責緩速、寶劍系負責易傷；淨化牌可以解除自己身上的狀態。</li>
   <li><b>自動戰鬥：</b>每張牌冷卻好就出手，打倒對手血量即勝。超過 20 秒會進入疲勞。</li>
   <li><b>合成：</b>兩張相同、同等級的牌可合成升級（最高 Lv3）。</li>
   <li><b>路線地圖：</b>每回合在地圖上選下一個節點：戰鬥、<b>精英</b>（更強，勝利必得遺物）、商店（全場 −1、可買遺物）、事件、營地（升級／回血）、神秘（隨機）。路線不能回頭，要規劃。</li>
   <li><b>Boss：</b>第 4、8、12 回合是 Boss，各有特殊機制；擊破可三選一<b>遺物</b>。</li>
   <li><b>事件：</b>回合之間可能遇到命運事件，用選擇換取風險與機會。</li>
   <li><b>每日挑戰：</b>每天固定的商店與對手，比拼分數。</li></ul><button class="btn primary" id="hOk" style="padding:11px 26px;font-size:15px">開始</button></div>`;
  $("#hOk").onclick = showStart;
}

/* ----- 連動說明：此牌從誰得到加成、又加成誰 ----- */
const SZ = { any: "任何牌", wands: "權杖", cups: "聖杯", swords: "寶劍", pents: "錢幣", major: "大牌" };
const ruleTxt = r => (r.stat === "cd" ? `冷卻 ×${r.mul}` : `${STAT_ZH[r.stat] || r.stat} ${r.add >= 0 ? "+" : ""}${r.add}`);
const auraTxt = a => a.stat === "cd" ? `冷卻 ×${a.mul}` : a.stat === "all" ? `全部效果 ×${a.mul}` : `${STAT_ZH[a.stat] || a.stat} ×${a.mul}`;
function synHTML(d, compact) {
  const gets = [], gives = [];
  d.rules.forEach(r => gets.push(`${SZ[r.from]}：<b>${ruleTxt(r)}</b>`));
  ITEMS.forEach(o => { if (o.aura && o.id !== d.id) { const to = [].concat(o.aura.to); if (to.includes("any") || to.includes(d.suit)) gets.push(`${itemIcon(o.id, 13)}<b>${auraTxt(o.aura)}</b>`); } });
  if (d.aura) [].concat(d.aura.to).forEach(t => gives.push(`${SZ[t]}：<b>${auraTxt(d.aura)}</b>`));
  ITEMS.forEach(o => { if (o.id === d.id) return; o.rules.forEach(r => { if (r.from === "any" || r.from === d.suit) gives.push(`${itemIcon(o.id, 14)}${o.nm}：<b>${ruleTxt(r)}</b>`); }); });
  const li = a => a.length ? a.map(x => `<span class="sy">${x}</span>`).join("") : '<span class="sy none">無</span>';
  if (compact) return (gets.length ? `<div class="sg"><em>得</em>${li(gets)}</div>` : "") + (d.aura ? `<div class="sg"><em>給</em>${li(gives.slice(0, 1))}</div>` : "");
  return `<div class="sg"><em>獲得加成</em>${li(gets)}</div><div class="sg"><em>提供加成</em>${li(gives)}</div>`;
}
/* ----- 圖鑑 / 成就 ----- */
function showCodex(tab, sel) {
  const ov = $("#ov"); ov.hidden = false; sel = sel || null;
  const tabs = [["items", "牌", "book"], ["syn", "連動", "merge"], ["relics", "遺物", "gem"], ["ach", "成就", "medal"]];
  let body = "", det = "";
  if (tab === "items") {
    body = `<div class="cg">${ITEMS.map(d => { const seen = META.items[d.id], S = SUITS[d.suit]; return `<button class="ct ${seen ? "" : "dim"} ${sel === d.id ? "sel" : ""}" data-id="${d.id}" style="${sv(S)}">${itemIcon(d.id, 34)}</button>`; }).join("")}</div>`;
    const d = sel && ID[sel];
    det = d ? `<div class="ih">${itemIcon(d.id, 28)}<b>${d.nm}</b><span class="su" style="color:${SUITS[d.suit].col}">${suitIcon(d.suit, 13)}${SUITS[d.suit].zh}</span><span class="lvt">階 ${d.tier}</span></div><div class="id">${d.desc}</div><div class="sub">費用 ${d.cost}　${d.cd ? "冷卻 " + d.cd + " 秒" : "被動"}　${SH[d.sh].length} 格</div>${synHTML(d)}` : `<div class="hint">已見過 ${Object.keys(META.items).length}/${ITEMS.length}（暗色＝尚未見過）。點選任一張查看詳細與連動。</div>`;
  } else if (tab === "syn") {
    const fs = window._synSuit || "wands";
    body = `<div class="sfil">${["wands", "cups", "swords", "pents", "major"].map(k => `<button class="btn tb ${k === fs ? "on" : ""}" data-s="${k}">${suitIcon(k, 14)}<span>${SUITS[k].zh}</span></button>`).join("")}</div><div class="synl">${ITEMS.filter(d => d.suit === fs).map(d => `<div class="synr" style="${sv(SUITS[d.suit])}"><div class="ovh"><span class="ovi">${itemIcon(d.id, 24)}</span><b>${d.nm}</b><span class="ovc">${d.desc}</span></div>${synHTML(d, true)}</div>`).join("")}</div>`;
} else if (tab === "relics") {
    body = `<div class="cg">${RELICS.map(r => `<button class="ct ${META.relics[r.id] ? "" : "unk"} ${sel === r.id ? "sel" : ""}" data-id="${r.id}" style="--col:#e8c468;--hi:#3a2a5c;--lo:#1a0f2c">${META.relics[r.id] ? relicIcon(r.id, 34) : uiIcon("lock", 20, "#6a5c80")}</button>`).join("")}</div>`;
    const r = sel && RID[sel];
    det = r ? (META.relics[sel] ? `<div class="ih">${relicIcon(r.id, 28)}<b>${r.nm}</b></div><div class="id">${r.desc}</div>` : `<div class="hint">尚未獲得。擊破 Boss 或事件中取得。</div>`) : `<div class="hint">已獲得 ${Object.keys(META.relics).length}/${RELICS.length}</div>`;
  } else {
    body = `<div class="al">${ACH.map(a => { const ok = META.ach[a.id], p = a.p && a.p(META); return `<div class="ar2 ${ok ? "ok" : ""}">${uiIcon(ok ? "medal" : "lock", 24, ok ? "#ffd84a" : "#6a5c80")}<div><b>${a.nm}</b><small>${a.d}${!ok && p ? `（${Math.min(p[0], p[1])}/${p[1]}）` : ""}</small></div></div>`; }).join("")}</div>`;
  }
  ov.innerHTML = `<div class="card cdx"><div class="tabs">${tabs.map(([k, n, ic]) => `<button class="btn tb ${k === tab ? "on" : ""}" data-t="${k}">${uiIcon(ic, 14)}<span>${n}</span></button>`).join("")}</div>${body}<div class="cdet">${det}</div><button class="btn" id="cx" style="margin-top:10px">返回</button></div>`;
  ov.querySelectorAll(".tb[data-t]").forEach(b => b.onclick = () => showCodex(b.dataset.t)); ov.querySelectorAll(".tb[data-s]").forEach(b => b.onclick = () => { window._synSuit = b.dataset.s; showCodex("syn"); }); ov.querySelectorAll(".ct").forEach(b => b.onclick = () => showCodex(tab, b.dataset.id)); $("#cx").onclick = showStart;
}

/* ----- 結算 ----- */
function showEnd(clear) {
  const reached = clear ? MAX_ROUND : G.round; G.over = true; clearRun();
  const bpRun = { mode: G.mode === "daily" ? "daily" : "normal", day: G.mode === "daily" ? G.seed.replace("daily-", "") : null, char: G.char || "", reached, wins: G.wins, lives: Math.max(0, G.lives), relics: G.relics.length, clear: !!clear };
  if (reached > G.best) { G.best = reached; try { localStorage.setItem("bb_best", reached); } catch (e) { } }
  META.relics = META.relics || {}; if (clear) { META.clears++; if (G.lost === 0) META.perfect = 1; }
  let extra = "";
  if (G.mode === "daily") {
    const sc = calcScore(reached, G.wins, Math.max(0, G.lives), G.relics.length, clear), td = G.seed.replace("daily-", ""), prev = META.daily[td] || 0; META.dailyDone++; if (sc > prev) META.daily[td] = sc;
    const txt = `塔羅背包亂鬥 每日挑戰 ${td}\n${clear ? "通關！" : "撐到第 " + reached + " 回合"} 勝 ${G.wins} 場 · 遺物 ${G.relics.length} 件\n分數 ${sc}`; window._share = txt;
    extra = `<div class="score">${sc}<small>分${sc > prev && prev ? "（新紀錄）" : prev ? "（今日最高 " + prev + "）" : ""}</small></div><button class="btn" id="shr">複製分享文字</button>`;
  }
  saveMeta(); checkAch();
  $("#bResult").hidden = true;
  const ov = $("#ov"); ov.hidden = false;
  ov.innerHTML = `<div class="card"><div class="big">${uiIcon(clear ? "trophy" : "heart0", 56, clear ? "#ffd84a" : "#c46a7a")}</div><h2>${clear ? "通關！命運站在你這邊" : "旅程結束"}</h2><p>撐到第 <b>${reached}</b> 回合　勝場 <b>${G.wins}</b></p>${extra}<p class="sub" id="bpRes" style="min-height:20px"></p><div class="rowi">${miniIcons(G.inv.filter(i => i.x != null))}</div>${G.relics.length ? `<div class="rowi">${G.relics.map(id => `<span class="rl">${relicIcon(id, 24)}</span>`).join("")}</div>` : ""}<button class="btn primary" id="again" style="padding:11px 26px;font-size:15px;margin-top:6px">回主選單</button></div>`;
  $("#again").onclick = showStart;
  bpReport(bpRun);
  if ($("#shr")) $("#shr").onclick = () => { try { navigator.clipboard.writeText(window._share); toast("已複製"); } catch (e) { toast("無法複製"); } };
}

