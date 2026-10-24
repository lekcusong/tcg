'use strict';
/* ===== 命運牌陣（開局）＋ Boss 預告 ＋ 命運階選擇 ===== */
const SPREAD_POS = [["past", "過去", "饋贈・立即生效"], ["present", "現在", "試煉・本局修正"], ["future", "未來", "預兆・Boss 戰專用"]];
const dMax = () => Math.min(3, META.diffClear || 0);

function bossHint(round) {
  const b = bossWith(round, G.bossAff && G.bossAff[round]);
  return b ? `<br><span class="afx">【${b.afNm}】${b.afDesc}</span>` : "";
}
function bossPreviewHtml() {
  return Object.keys(BOSSES).map(r => {
    const b = bossWith(r, G.bossAff && G.bossAff[r]);
    return `<div class="sp-b"><b>第 ${r} 回合・${b.nm}<span class="af">【${b.afNm}】</span></b><small>${b.afDesc}</small></div>`;
  }).join("");
}
function fateCardHtml(c, i, on) {
  return `<button class="chr sp-c ${on ? "on" : ""}" data-i="${i}" data-id="${c.id}" style="${sv(SUITS.major)}"><div class="sic">${itemIcon(c.ic, 34)}</div><div class="cinf"><b>${c.nm}</b><span class="pro">＋ ${c.pro}</span>${c.con ? `<span class="con">－ ${c.con}</span>` : ""}</div></button>`;
}
// 每個位置翻出兩張；每日挑戰用種子，全服看到同一組
function spreadOffers() {
  return SPREAD_POS.map(([k]) => withSeed(sdKey("spread|" + k), () => {
    const pool = FATE[k].slice(), out = [];
    while (out.length < 2) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
    return out;
  }));
}
function applySpread(cards) {
  G.fate = cards.map(c => c.id);
  withSeed(sdKey("spreadfx"), () => cards.forEach(c => {
    const f = c.fx; if (!f) return;
    if (f.gold) G.gold += f.gold;
    if (f.hp) G.hpBonus += f.hp;
    if (f.item) { const pool = ITEMS.filter(d => d.tier === 1 && d.id !== "p1"); giveItem(G, pool[Math.floor(rnd() * pool.length)].id); }
    if (f.relic) giveRelic(G);
  }));
  noteSeen(); bump("maxRelics", G.relics.length);
}
function showSpread(cb) {
  const ov = $("#ov"), offers = spreadOffers(), pick = [null, null, null];
  ov.hidden = false; AU.vs();
  const render = () => {
    ov.innerHTML = `<div class="card spread"><h2>命運牌陣</h2><p class="sub">每個位置翻出兩張，各選一張</p>${SPREAD_POS.map(([k, zh, sub], i) => `<div class="sp-row"><div class="sp-h">${zh}<small>${sub}</small></div><div class="sp-cards">${offers[i].map(c => fateCardHtml(c, i, pick[i] === c.id)).join("")}</div></div>`).join("")}<div class="sp-boss"><div class="sp-h">Boss 預告<small>本局三場守關者的詞綴</small></div>${bossPreviewHtml()}</div><button class="btn primary" id="spGo" ${pick.every(Boolean) ? "" : "disabled"} style="margin-top:10px;padding:11px 26px;font-size:15px">${pick.every(Boolean) ? "命運已定，出發" : "請在三個位置各選一張"}</button></div>`;
    ov.querySelectorAll(".sp-c").forEach(b => b.onclick = () => { pick[+b.dataset.i] = b.dataset.id; AU.tick(); render(); });
    $("#spGo").onclick = () => {
      if (!pick.every(Boolean)) return;
      applySpread(pick.map((id, i) => offers[i].find(c => c.id === id)));
      AU.buy(); ov.hidden = true; cb();
    };
  };
  render();
}

/* ----- 命運階選擇（角色選擇畫面上方；尚未通關過就不顯示）----- */
function tierRowHtml() {
  const mx = dMax(); if (!mx) return "";
  const sel = Math.min(META.diffSel || 0, mx);
  return `<div class="tiers">${DIFFS.map((d, i) => `<button class="btn ${i === sel ? "on" : ""}" data-d="${i}" ${i > mx ? "disabled" : ""}>${i > mx ? uiIcon("lock", 12) : ""}${d.nm}</button>`).join("")}</div><p class="sub tdesc" id="tdesc">命運階 ${DIFFS[sel].nm.slice(2)}：${DIFFS[sel].d}</p>`;
}
function wireTiers() {
  document.querySelectorAll(".tiers .btn").forEach(b => b.onclick = () => {
    if (b.disabled) return; AU.tick();
    const d = +b.dataset.d; META.diffSel = d; saveMeta();
    document.querySelectorAll(".tiers .btn").forEach(x => x.classList.toggle("on", x === b));
    $("#tdesc").textContent = `命運階 ${DIFFS[d].nm.slice(2)}：${DIFFS[d].d}`;
  });
}
