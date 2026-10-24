'use strict';
/* ===== UI ===== */
const $ = s => document.querySelector(s);
const G = { relics: [], fate: [], bossAff: null, diff: 0, hpBonus: 0, mode: "normal", seed: "", rerolls: 0, freeUsed: false, over: true, round: 1, lives: LIVES, gold: START_GOLD, wins: 0, hp: START_HP, inv: [], shop: [], rerollCost: 1, enemy: null, sel: null, shopSel: -1, battle: null, running: false, best: +(localStorage.getItem("bb_best") || 0) };
const MODS = () => Object.assign(relicMods((G.char ? G.relics.concat("ch_" + G.char) : G.relics).concat((G.fate || []).map(f => "ft_" + f))), { sets: true }), priceOf = d => Math.max(1, d.cost - (MODS().discount || 0) - (G.nodeType === "shop" ? 1 : 0)), myMax = () => START_HP + G.hpBonus + (MODS().hpAdd || 0);
let CS = 52, drag = null, flashT = {};
function calcCS() { const w = Math.min(window.innerWidth, 440) - 24; CS = Math.max(36, Math.min(56, Math.floor(w / COLS))); document.documentElement.style.setProperty("--cs", CS + "px"); }
const mixc = (a, b, t) => { const p = x => [1, 3, 5].map(i => parseInt(x.slice(i, i + 2), 16)); const A = p(a), B = p(b); return "#" + A.map((v, i) => Math.round(v * t + B[i] * (1 - t)).toString(16).padStart(2, "0")).join(""); };
Object.values(SUITS).forEach(S => { S.hi = mixc(S.col, "#1a0f2c", 0.46); S.lo = mixc(S.col, "#100820", 0.1); S.lt = mixc(S.col, "#ffffff", 0.55); });
const sv = S => `--col:${S.col};--hi:${S.hi};--lo:${S.lo}`;
const bt = (ic, t, sz) => uiIcon(ic, sz || 16) + `<span>${t}</span>`;
const tag = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };

const TIERC = ["#9aa3ad", "#6fcf8a", "#4aa3ff", "#b98cf0", "#ffb040", "#ff6b5a"];
function linkCells(a, b) { for (const [x, y] of cellsOf(a)) for (const [x2, y2] of cellsOf(b)) if (Math.abs(x - x2) + Math.abs(y - y2) === 1) return [[x, y], [x2, y2]]; return null; }
function linkKeys(units) { const o = new Set(); units.forEach(u => u.links.forEach(l => o.add(l.n.it.uid + ">" + u.it.uid))); return o; }
/* 相鄰效果連結線：n → u（n 的效果加成給 u）。sel=選中牌 uid（可為 null）；fresh=新出現的連結 key 集合 */
function drawLinks(host, units, cs, w, h, sel, fresh, labels) {
  const old = host.querySelector(":scope > svg.links"); if (old) old.remove();
  const map = {}; let html = "";
  units.forEach(u => u.links.forEach(l => {
    const pair = linkCells(l.n.it, u.it); if (!pair) return;
    const [[ax, ay], [bx, by]] = pair; const ex = (ax + bx + 1) / 2 * cs, ey = (ay + by + 1) / 2 * cs, ux = bx - ax, uy = by - ay, px = -uy, py = ux, hl = cs * 0.3, off = cs * 0.14;
    const x1 = ex - ux * hl + px * off, y1 = ey - uy * hl + py * off, x2 = ex + ux * hl + px * off, y2 = ey + uy * hl + py * off, dx = x2 - x1, dy = y2 - y1;
    const S = SUITS[l.n.d.suit], col = l.kind === "aura" ? "#ffd84a" : S.lt, key = l.n.it.uid + ">" + u.it.uid;
    const mine = sel != null && (l.n.it.uid === sel || u.it.uid === sel), c = "lk " + (sel == null ? "" : mine ? "hi " : "lo ") + (fresh && fresh.has(key) ? "new " : "") + l.kind;
    const mx = x1 + dx * .55, my = y1 + dy * .55, a = Math.max(3.5, cs * 0.1), sh = t => t.replace("傷害", "傷").replace("回復", "回").replace("護盾", "盾").replace("冷卻", "冷").replace("再生", "生").replace("灼燒", "灼").replace("中毒", "毒");
    html += `<g class="${c}" data-lk="${l.n.idx}>${u.idx}" style="color:${col}"><line class="gl" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="currentColor" stroke-width="${Math.max(4, cs * .16)}" stroke-linecap="round"/>` +
      `<line class="fl" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#fff" stroke-width="${Math.max(1.6, cs * .05)}" stroke-dasharray="3 6" stroke-linecap="round"/>` +
      `<polygon class="ar" points="${mx + ux * a * 1.3},${my + uy * a * 1.3} ${mx - ux * a + px * a},${my - uy * a + py * a} ${mx - ux * a - px * a},${my - uy * a - py * a}" fill="currentColor" stroke="#1a0f2c" stroke-width="1"/>` +
      `<circle cx="${x1}" cy="${y1}" r="${Math.max(2.5, cs * .07)}" fill="currentColor"/><circle cx="${x2}" cy="${y2}" r="${Math.max(3, cs * .085)}" fill="#fff" stroke="currentColor" stroke-width="1.5"/>` +
      (labels && (labels === "all" || mine) ? `<text class="lt" x="${ex + px * cs * .38}" y="${ey + py * cs * .38 + 4}" text-anchor="middle">${sh(l.lbl)}</text>` : "") + `</g>`;
  }));
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svg.setAttribute("class", "links"); svg.setAttribute("width", w); svg.setAttribute("height", h); svg.innerHTML = html;
  host.appendChild(svg); svg.querySelectorAll("[data-lk]").forEach(g => map[g.dataset.lk] = g); return map;
}
const PRIMK = ["dmg", "heal", "shield", "burn", "poison", "regen", "thorns", "open", "pct"];
function badgeOf(u) {
  const k = PRIMK.find(k => u.vals[k]); if (k) return k === "pct" ? Math.round(u.vals[k] * 100) + "%" : String(Math.round(u.vals[k] * 10) / 10);
  if (u.d.income) return "+" + Math.round(u.d.income * LVM[u.it.lv || 1]);
  const a = u.d.aura; if (a) return a.stat === "cd" ? "×" + a.mul : "×" + a.mul; return "";
}
let labelAll = (() => { try { return localStorage.getItem("bb_lbl") === "1"; } catch (e) { return true; } })();
function mkItemEl(it, cs, opt) {
  opt = opt || {};
  const d = ID[it.id], S = SUITS[d.suit], cells = shapeOf(it), set = new Set(cells.map(c => c.join(",")));
  const w = Math.max(...cells.map(c => c[0])) + 1, h = Math.max(...cells.map(c => c[1])) + 1;
  const el = tag("div", "it"); el.style.width = w * cs + "px"; el.style.height = h * cs + "px"; el.dataset.uid = it.uid; el.classList.add("t" + (ID[it.id].tier || 1), "s-" + ID[it.id].suit); el.setAttribute("style", el.getAttribute("style") + ";" + sv(S));
  const mx = cells.reduce((a, c) => a + c[0], 0) / cells.length, my = cells.reduce((a, c) => a + c[1], 0) / cells.length;
  const main = cells.slice().sort((p, q) => Math.hypot(p[0] - mx, p[1] - my) - Math.hypot(q[0] - mx, q[1] - my))[0];
  cells.forEach(([x, y]) => {
    const c = tag("div", "ic"), has = (dx, dy) => set.has((x + dx) + "," + (y + dy)), R = cs * 0.22;
    c.style.cssText = `left:${x * cs}px;top:${y * cs}px;width:${cs}px;height:${cs}px;` +
      `border-top-color:${has(0, -1) ? "transparent" : S.col};border-bottom-color:${has(0, 1) ? "transparent" : S.col};border-left-color:${has(-1, 0) ? "transparent" : S.col};border-right-color:${has(1, 0) ? "transparent" : S.col};` +
      `border-radius:${!has(-1, 0) && !has(0, -1) ? R : 0}px ${!has(1, 0) && !has(0, -1) ? R : 0}px ${!has(1, 0) && !has(0, 1) ? R : 0}px ${!has(-1, 0) && !has(0, 1) ? R : 0}px;`;
    el.appendChild(c);
  });
  const [x, y] = main, isz = Math.round(cs * 0.8), off = (cs - isz) / 2;
  const ic = tag("div", "ico", itemIcon(it.id, isz)); ic.style.cssText = `left:${x * cs + off}px;top:${y * cs + off - cs * 0.03}px;width:${isz}px;height:${isz}px;`; el.appendChild(ic);
  if ((it.lv || 1) > 1) { const b = tag("div", "lvb", suitIcon("major", Math.max(8, Math.round(cs * 0.24))).repeat(it.lv - 1)); b.style.cssText = `left:${x * cs + 3}px;top:${y * cs + 2}px;`; b.querySelectorAll("svg").forEach(q => q.style.color = "#ffd84a"); el.appendChild(b); }
  if (cs >= 30) { const g = tag("i", "tg"); g.style.cssText = `left:${x * cs + cs - 11}px;top:${y * cs + 4}px;background:${TIERC[Math.min(5, (d.tier || 1) - 1)]}`; el.appendChild(g); }
  if (false && opt.u && cs >= 28) {
    const t = badgeOf(opt.u); if (t) { const nb = tag("div", "nb" + (opt.u.links.length ? " up" : "") + (opt.u.d.aura ? " au" : ""), t); nb.style.cssText = `left:${x * cs}px;width:${cs - 3}px;top:${y * cs + cs * (opt.bar ? 0.4 : 0.6) - 2}px;font-size:${Math.max(10, Math.round(cs * 0.27))}px`; el.appendChild(nb); }
  }
  if (opt.bar) { const bar = tag("div", "cdb"); bar.style.cssText = `left:${x * cs + 4}px;top:${y * cs + cs - 7}px;width:${cs - 8}px;`; bar.appendChild(tag("i")); el.appendChild(bar); el._bar = bar.firstChild; }
  return el;
}
function setCell(cs) { return cs; }

/* ----- 背包 ----- */
function renderBoard() {
  const bi = $("#boardItems"); bi.innerHTML = "";
  $("#board").style.width = COLS * CS + 4 + "px"; $("#board").style.height = ROWS * CS + 4 + "px";
  const umap = new Map(buildUnits(G.inv, MODS()).units.map(u => [u.it.uid, u]));
  G.inv.filter(i => i.x != null).forEach(it => {
    const el = mkItemEl(it, CS, { u: umap.get(it.uid) }); el.style.left = it.x * CS + "px"; el.style.top = it.y * CS + "px";
    if (G.sel === it.uid) el.classList.add("sel");
    el.addEventListener("pointerdown", e => onItemDown(e, it.uid)); bi.appendChild(el);
  });
  // 加成提示線：選中的牌與相鄰牌
  const un = buildUnits(G.inv, MODS()).units, su = un.find(u => u.it.uid === G.sel);
  if (su) su.nb.forEach(n => { const el = bi.querySelector(`[data-uid="${n.it.uid}"]`); if (el) el.classList.add("nbr"); });
  const keys = linkKeys(un), fresh = G.linkKeys ? new Set([...keys].filter(k => !G.linkKeys.has(k))) : null; G.linkKeys = keys;
  drawLinks(bi, un, CS, COLS * CS, ROWS * CS, G.sel, fresh, false);
  if (fresh && fresh.size) AU.link();
  G.linkCount = keys.size;
}
function renderTray() {
  const t = $("#tray"); t.innerHTML = ""; t.classList.remove("empty");
  const list = G.inv.filter(i => i.x == null);
  if (!list.length) t.appendChild(tag("div", "hint", "購買的牌先放這裡，拖進背包即可")); t.classList.add("empty");
  list.forEach(it => {
    const w = tag("div", "tw" + (G.sel === it.uid ? " sel" : "")), el = mkItemEl(it, 30);
    w.appendChild(el); w.addEventListener("pointerdown", e => onItemDown(e, it.uid)); t.appendChild(w);
  });
  $("#trayCnt").textContent = `${list.length}/${TRAY_MAX}`;
}
function statLine(it, shop) {
  const d = ID[it.id], u = buildUnits(G.inv, MODS()).units.find(x => x.it.uid === it.uid);
  let v, cd;
  if (u) { v = u.vals; cd = u.cd; } else { const t = buildUnits([Object.assign({}, it, { x: 0, y: 0, rot: 0 })], MODS()).units[0]; v = t.vals; cd = t.cd; }
  const parts = Object.keys(v).filter(k => STAT_ZH[k] && v[k]).map(k => k === "pct" ? `${STAT_ZH[k]} ${Math.round(v[k] * 100)}%` : `${STAT_ZH[k]} ${Math.round(v[k] * 10) / 10}${k === "slow" || k === "vuln" ? " 秒" : ""}`);
  if (d.income) parts.push(`每回合 +${Math.round(d.income * LVM[it.lv])} 金幣`);
  if (d.act.recharge) parts.push("充能 " + d.act.recharge + " 張牌"); if (d.act.wheel) parts.push("隨機效果");
  return (cd ? `${uiIcon("clock", 13)} 每 ${Math.round(cd * 10) / 10} 秒　` : "") + parts.join("　") + (u || shop ? "" : "　（放進背包才會計算相鄰加成）");
}
function renderInfo() {
  const box = $("#info"); box.innerHTML = "";
  if (G.shopSel >= 0) {
    const s = G.shop[G.shopSel], d = ID[s.id], S = SUITS[d.suit], tmp = mkItem(d.id);
    box.innerHTML = `<div class="ih">${itemIcon(d.id, 26)}<b>${d.nm}</b> <span class="su" style="color:${S.col}">${suitIcon(d.suit, 13)}${S.zh}</span></div><div class="id">${d.desc}</div><div class="is">${statLine(tmp, true)}</div>`;
    const b = tag("button", "btn primary", bt("coin", `購買（${priceOf(d)}）`)); b.onclick = () => buy(G.shopSel); box.appendChild(b); return;
  }
  const it = G.inv.find(i => i.uid === G.sel);
  if (!it) { box.innerHTML = `<div class="hint">點選商店的牌查看並購買；把牌放在<b>同花色相鄰</b>的位置會有加成。可拖曳排列，點選牌後可旋轉。</div>`; return; }
  const d = ID[it.id], S = SUITS[d.suit];
  box.innerHTML = `<div class="ih">${itemIcon(d.id, 26)}<b>${d.nm}</b> <span class="su" style="color:${S.col}">${suitIcon(d.suit, 13)}${S.zh}</span> ${it.lv > 1 ? "<span class='lvt'>Lv" + it.lv + "</span>" : ""}</div><div class="id">${d.desc}</div><div class="is">${statLine(it)}</div>`;
  const row = tag("div", "brow");
  const rot = tag("button", "btn", bt("rot", "旋轉", 15)); rot.onclick = () => rotateSel(); row.appendChild(rot);
  if (it.x != null) { const un = tag("button", "btn", bt("down", "收起", 15)); un.onclick = () => { it.x = it.y = null; if (G.inv.filter(i => i.x == null).length > TRAY_MAX) { toast("收納區已滿"); const j = G.inv.indexOf(it); } refresh(); }; row.appendChild(un); }
  const mate = G.inv.find(o => o !== it && o.id === it.id && o.lv === it.lv && it.lv < 3);
  const mg = tag("button", "btn" + (mate ? " gold" : ""), bt("merge", "合成", 15)); mg.disabled = !mate; mg.onclick = () => merge(it, mate); row.appendChild(mg);
  const sl = tag("button", "btn warn", bt("coin", `賣出 +${sellPrice(it)}`, 15)); sl.onclick = () => sell(it); row.appendChild(sl);
  box.appendChild(row);
}
function renderShop() {
  const sh = $("#shop"); sh.innerHTML = "";
  G.shop.forEach((s, i) => {
    const d = ID[s.id], S = SUITS[d.suit], c = tag("div", "sc" + (s.sold ? " sold" : "") + (G.shopSel === i ? " sel" : "") + (G.gold < priceOf(d) ? " poor" : ""));
    c.setAttribute("style", sv(S));
    const sz = SH[d.sh], w = Math.max(...sz.map(p => p[0])) + 1, h = Math.max(...sz.map(p => p[1])) + 1;
    let grid = `<div class="mini" style="grid-template-columns:repeat(${w},9px);grid-template-rows:repeat(${h},9px)">`;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) grid += `<i class="${sz.some(p => p[0] === x && p[1] === y) ? "on" : ""}"></i>`;
    c.innerHTML = `<div class="sic">${itemIcon(d.id, 34)}</div><div class="snm">${d.nm}</div>${grid}</div><div class="spr">${s.sold ? "已購" : uiIcon("coin", 13) + priceOf(d)}</div>`;
    if (!s.sold) c.onclick = () => { G.shopSel = G.shopSel === i ? -1 : i; G.sel = null; refresh(); };
    sh.appendChild(c);
  });
  $("#btnReroll").innerHTML = bt("dice", "重抽", 15) + (rerollFree() ? "<span>免費</span>" : uiIcon("coin", 13) + G.rerollCost);
}
const miniIcons = items => items.map(i => { const d = ID[i.id]; return `<div class="mi" style="${sv(SUITS[d.suit])}">${itemIcon(i.id, 24)}${i.lv > 1 ? "<sup>" + i.lv + "</sup>" : ""}</div>`; }).join("");
function renderHud() {
  $("#hRound").innerHTML = `第 ${G.round}<small>/${MAX_ROUND}</small> 回合`;
  $("#hLives").innerHTML = '<span class="hearts">' + uiIcon("heart", 15).repeat(Math.max(0, G.lives)) + uiIcon("heart0", 15).repeat(Math.max(0, LIVES - G.lives)) + "</span>";
  $("#hGold").innerHTML = uiIcon("coin", 16) + G.gold; $("#hWins").innerHTML = uiIcon("trophy", 15) + G.wins; $("#myHp").textContent = myMax(); renderRelics(); bump("maxLinks", G.linkCount || 0);
  $("#pips").innerHTML = Array.from({ length: MAX_ROUND }, (_, i) => `<i class="${i + 1 < G.round ? "done" : i + 1 === G.round ? "cur" : ""}"></i>`).join("");
  $("#btnMute").innerHTML = uiIcon(AU.isMuted() ? "mute" : "vol", 16);
  const e = G.enemy; $("#enemyBar").hidden = !e && G.phase !== "shop"; if (!e && G.phase === "shop") $("#enemyBar").innerHTML = `<div class="er"><b>${uiIcon("cart", 16, "#e8c468")} 商人的攤位</b><span class="chip" style="padding:2px 8px">全場 −1</span></div>${G.offer ? `<div class="offer ${G.offer.sold ? "sold" : ""}" id="offer">${relicIcon(G.offer.id, 30)}<div><b>${RID[G.offer.id].nm}</b><small>${RID[G.offer.id].d || RID[G.offer.id].desc || ""}</small></div><button class="btn gold" id="offBuy" ${G.offer.sold ? "disabled" : ""}>${G.offer.sold ? "已購" : uiIcon("coin", 13) + G.offer.price}</button></div>` : ""}`; if (e) $("#enemyBar").innerHTML = `<div class="erw">${eImg(e, "full", "ebp" + eTag(e))}<div class="ebody"><div class="er"><b>${e.boss ? uiIcon("crown", 16, "#ffd84a") + ' <span class="bosst">BOSS</span> ' : e.elite ? uiIcon("skull", 16, "#ff5a4a") + ' <span class="bosst el">精英</span> ' : "對手："}${e.name}</b><span class="chip" style="padding:2px 8px">${uiIcon("heart", 13)}${e.hp}</span></div>${e.boss ? `<div class="bdesc">${e.boss.desc}</div>` : ""}<div class="ei">${miniIcons(e.items)}</div></div></div>`;
  $("#enemyBar").classList.toggle("boss", !!(e && e.boss)); $("#enemyBar").classList.toggle("elite", !!(e && e.elite)); if ($("#offBuy")) $("#offBuy").onclick = buyOffer;
  $("#btnFight").innerHTML = G.phase === "shop" ? bt("down", "離開商店", 16) : bt("fight", "開戰", 18); $("#shopTitle").lastChild.textContent = G.phase === "shop" ? "商人的貨架" : "商店";
  const inc = buildUnits(G.inv, MODS()).income; $("#incLine").innerHTML = `${uiIcon("merge", 12)}連結 ${G.linkCount || 0}` + (inc ? `　額外 +${inc} ${uiIcon("coin", 12)}` : "");
}
let sheetOpen = false;
function renderOverview() {
  const box = $("#overview"), sh = $("#sheet"), us = buildUnits(G.inv, MODS()).units;
  if (!us.length) { box.innerHTML = ""; sh.hidden = true; return; }
  us.sort((a, b) => a.it.y - b.it.y || a.it.x - b.it.x);
  let dps = 0, hps = 0, sps = 0;
  us.forEach(u => { if (!u.cd) return; dps += ((u.vals.dmg || 0) + (u.vals.pct ? u.vals.pct * 50 : 0)) / u.cd; hps += (u.vals.heal || 0) / u.cd; sps += (u.vals.shield || 0) / u.cd; });
  const f = n => (Math.round(n * 10) / 10), sum = `<span class="sum"><span>${uiIcon("burn", 12)}${f(dps)}</span><span>${uiIcon("heart", 12)}${f(hps)}</span><span>${uiIcon("shield", 12)}${f(sps)}</span><span>${uiIcon("merge", 12)}${G.linkCount || 0}</span></span>`;
  box.innerHTML = `<button class="ovbar" id="ovOpen">${uiIcon("chart", 15)}<b>背包總覽</b>${sum}<span class="mo">詳情</span></button>`;
  $("#ovOpen").onclick = () => { sheetOpen = true; renderOverview(); };
  sh.hidden = !sheetOpen; if (!sheetOpen) return;
  const rows = us.map(u => {
    const d = u.d, S = SUITS[d.suit], parts = Object.keys(u.vals).filter(k => STAT_ZH[k] && u.vals[k]).map(k => `<span class="pt">${STAT_ZH[k].replace("敵方最大血量", "削血")}<b>${k === "pct" ? Math.round(u.vals[k] * 100) + "%" : f(u.vals[k]) + (k === "slow" || k === "vuln" ? "s" : "")}</b></span>`);
    if (d.income) parts.push(`<span class="pt">收入<b>+${Math.round(d.income * LVM[u.it.lv || 1])}</b></span>`);
    if (d.act.recharge) parts.push('<span class="pt">充能</span>'); if (d.act.wheel) parts.push('<span class="pt">隨機</span>');
    if (u.vals.delay) parts.push(`<span class="pt">延遲<b>${u.vals.delay}s</b></span>`); if (u.vals.ramp) parts.push('<span class="pt">累積</span>'); if (u.vals.exec) parts.push('<span class="pt">處決</span>'); if (u.vals.detonate) parts.push('<span class="pt">引爆</span>');
    if (d.aura) parts.push('<span class="pt au">光環</span>');
    const links = u.links.map(l => `<span class="lc ${l.kind}" style="--lc:${l.kind === "aura" ? "#ffd84a" : SUITS[l.n.d.suit].lt}">${itemIcon(l.n.it.id, 13)}<b>${l.lbl}</b></span>`).join("");
    return `<div class="ovr${G.sel === u.it.uid ? " sel" : ""}" data-uid="${u.it.uid}" style="${sv(S)}"><div class="ovh"><span class="ovi">${itemIcon(d.id, 24)}</span><b>${d.nm}</b>${u.it.lv > 1 ? `<span class="lvt">Lv${u.it.lv}</span>` : ""}<span class="ovs">${parts.join("")}</span><span class="ovc">${u.cd ? f(u.cd) + "s" : ""}</span></div>${links ? `<div class="ovl">${links}</div>` : ""}</div>`;
  }).join("");
  sh.innerHTML = `<div class="shb" id="shBk"></div><div class="shp"><div class="sht"><b>${uiIcon("chart", 14)} 背包總覽</b>${sum}<button class="btn tg2" id="shX">收起</button></div><div class="sbody">${rows}</div></div>`;
  const close = () => { sheetOpen = false; renderOverview(); };
  $("#shX").onclick = close; $("#shBk").onclick = close;
  sh.querySelectorAll(".ovr").forEach(r => r.onclick = () => { G.sel = +r.dataset.uid; G.shopSel = -1; refresh(); });
}
const SET_TXT = {
  wands: ["攻擊牌灼燒 +1", "權杖冷卻 -10%"],
  cups: ["聖杯回復 +2", "戰鬥中每秒再生 +1"],
  swords: ["寶劍傷害 +1", "寶劍出手附帶 +1 秒易傷"],
  pents: ["開場護盾 +6", "反彈 +2、錢幣護盾 ×1.2"]
};
let setOpen = false;
function renderSets() {
  const box = $("#setBar"), sb = buildUnits(G.inv, MODS()).sets;
  if (!sb || !G.inv.some(i => i.x != null)) { box.innerHTML = ""; return; }
  const ks = ["wands", "cups", "swords", "pents"], lvOf = n => n >= 4 ? 2 : n >= 2 ? 1 : 0;
  const chips = ks.map(k => { const n = sb[k], lv = lvOf(n); return `<span class="setc lv${lv}" style="--col:${SUITS[k].col}">${suitIcon(k, 14)}<b>${n}</b><i>${lv === 2 ? "MAX" : n + "/" + (lv ? 4 : 2)}</i></span>`; }).join("") + `<span class="setc rb${sb.rainbow ? " lv1" : ""}" style="--col:#e8c468"><b>四象</b><i>${sb.rainbow ? "冷卻 -5%" : "四花色各 1"}</i></span>`;
  let det;
  if (setOpen) det = ks.map(k => { const lv = lvOf(sb[k]); return `<div class="sl" style="--col:${SUITS[k].col}">${suitIcon(k, 13)}<b>${SUITS[k].zh}</b>${SET_TXT[k].map((t, i) => `<span class="${lv > i ? "on" : ""}">${i ? 4 : 2} 張：${t}</span>`).join("")}</div>`; }).join("") + `<div class="sl" style="--col:#e8c468"><b>四象</b><span class="${sb.rainbow ? "on" : ""}">四種花色各至少 1 張：全牌冷卻 -5%</span></div>`;
  else { const on = ks.flatMap(k => SET_TXT[k].filter((t, i) => lvOf(sb[k]) > i).map(t => SUITS[k].zh + "：" + t)); if (sb.rainbow) on.push("四象：冷卻 -5%"); det = on.length ? `<div class="sl on1">${on.join("　")}</div>` : `<div class="sl dim">同花色擺滿 2／4 張觸發「花色共鳴」，點此看詳情</div>`; }
  box.innerHTML = `<div class="setrow">${chips}</div>${det}`;
  box.onclick = () => { setOpen = !setOpen; renderSets(); };
}
function refresh() { renderBoard(); renderSets(); renderHud(); renderTray(); renderInfo(); renderOverview(); renderShop(); saveRun(); }
function toast(m, ms) { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), ms || 1400); }

/* ----- 動作 ----- */
function buy(i) {
  const s = G.shop[i], d = ID[s.id];
  if (s.sold) return; if (G.gold < priceOf(d)) return toast("金幣不足");
  if (G.inv.filter(x => x.x == null).length >= TRAY_MAX) return toast("收納區已滿，先放進背包或賣掉");
  G.gold -= priceOf(d); s.sold = true; noteSeen(); const it = mkItem(d.id); G.inv.push(it);
  // 有空位就自動放入，並選取它
  for (let rot = 0; rot < 1; rot++) { let done = false; for (let y = 0; y < ROWS && !done; y++) for (let x = 0; x < COLS && !done; x++) if (canPlace(G.inv, it, x, y, 0)) { it.x = x; it.y = y; done = true; } }
  G.shopSel = -1; G.sel = it.uid; AU.buy(); refresh(); toast(`購買 ${d.nm}`);
}
function sell(it) { G.gold += sellPrice(it); G.inv.splice(G.inv.indexOf(it), 1); G.sel = null; refresh(); }
function merge(a, b) {
  if (!b) return; a.lv++; G.inv.splice(G.inv.indexOf(b), 1); AU.merge(); refresh(); toast(`${ID[a.id].nm} 升到 Lv${a.lv}！`);
}
function rotateSel() {
  const it = G.inv.find(i => i.uid === G.sel); if (!it) return;
  const nr = (it.rot + 1) % 4;
  if (it.x == null) { it.rot = nr; refresh(); return; }
  for (let k = 1; k <= 4; k++) { const r = (it.rot + k) % 4; if (canPlace(G.inv, it, it.x, it.y, r)) { it.rot = r; refresh(); return; } }
  toast("這裡放不下旋轉後的形狀");
}
function placeAt(it, cx, cy) {
  const cells = shapeOf(it), w = Math.max(...cells.map(c => c[0])) + 1, h = Math.max(...cells.map(c => c[1])) + 1;
  const ox = cx - Math.floor((w - 1) / 2), oy = cy - Math.floor((h - 1) / 2);
  if (canPlace(G.inv, it, ox, oy, it.rot)) { it.x = ox; it.y = oy; return true; }
  return false;
}
function cellFromPoint(px, py) {
  const r = $("#board").getBoundingClientRect(), x = Math.floor((px - r.left - 2) / CS), y = Math.floor((py - r.top - 2) / CS);
  return (px >= r.left - 2 && py >= r.top - 2 && px <= r.right + 2 && py <= r.bottom + 2) ? { x: Math.max(0, Math.min(COLS - 1, x)), y: Math.max(0, Math.min(ROWS - 1, y)) } : null;
}
/* ----- 拖曳 ----- */
function onItemDown(e, uid) {
  if (G.running) return; e.preventDefault(); e.stopPropagation();
  const it = G.inv.find(i => i.uid === uid); if (!it) return;
  G.shopSel = -1; const wasSel = G.sel === uid; G.sel = uid;
  drag = { uid, sx: e.clientX, sy: e.clientY, moved: false, ghost: null, wasSel };
  renderInfo(); document.querySelectorAll(".it.sel,.tw.sel").forEach(x => x.classList.remove("sel"));
  const el = e.currentTarget; el.classList.add("sel");
  window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp, { once: true });
}
function onMove(e) {
  if (!drag) return; const it = G.inv.find(i => i.uid === drag.uid);
  if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 8) return;
  drag.moved = true;
  if (!drag.ghost) { drag.ghost = mkItemEl(it, CS); drag.ghost.classList.add("ghost"); document.body.appendChild(drag.ghost); document.body.classList.add("dragging"); const ie = document.querySelector(`#boardItems [data-uid="${it.uid}"]`); if (ie) ie.style.opacity = 0.25; }
  const cells = shapeOf(it), w = Math.max(...cells.map(c => c[0])) + 1, h = Math.max(...cells.map(c => c[1])) + 1;
  drag.ghost.style.left = (e.clientX - w * CS / 2) + "px"; drag.ghost.style.top = (e.clientY - h * CS / 2 - 18) + "px";
  const prev = $("#boardPrev"); prev.innerHTML = "";
  const c = cellFromPoint(e.clientX, e.clientY - 18);
  $("#sellZone").classList.toggle("hot", isOver($("#sellZone"), e));
  if (c) {
    const ox = c.x - Math.floor((w - 1) / 2), oy = c.y - Math.floor((h - 1) / 2), ok = canPlace(G.inv, it, ox, oy, it.rot);
    cells.forEach(([x, y]) => { const p = tag("div", "pv " + (ok ? "ok" : "bad")); p.style.cssText = `left:${(ox + x) * CS}px;top:${(oy + y) * CS}px;width:${CS}px;height:${CS}px`; prev.appendChild(p); });
  }
}
const isOver = (el, e) => { const r = el.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; };
function onUp(e) {
  window.removeEventListener("pointermove", onMove);
  const d = drag; drag = null; if (!d) return;
  document.body.classList.remove("dragging"); $("#sellZone").classList.remove("hot"); $("#boardPrev").innerHTML = "";
  if (d.ghost) d.ghost.remove();
  const it = G.inv.find(i => i.uid === d.uid); if (!it) return refresh();
  if (d.moved) {
    if (isOver($("#sellZone"), e)) { AU.buy(); sell(it); return; }
    const c = cellFromPoint(e.clientX, e.clientY - 18);
    if (c) { const ox = it.x, oy = it.y; if (!placeAt(it, c.x, c.y)) { toast("放不下"); it.x = ox; it.y = oy; } else AU.drop(); }
    else if (isOver($("#tray"), e) && it.x != null) { it.x = it.y = null; }
  }
  refresh();
}
$("#board").addEventListener("pointerdown", e => {
  if (G.running) return; const it = G.inv.find(i => i.uid === G.sel); if (!it || e.target.closest(".it")) return;
  const c = cellFromPoint(e.clientX, e.clientY); if (!c) return;
  const ox = it.x, oy = it.y; if (placeAt(it, c.x, c.y)) refresh(); else { it.x = ox; it.y = oy; toast("放不下"); }
});
document.addEventListener("pointerdown", e => { if (!e.target.closest("#board,#tray,#info,#shop,.sc,.btn,#ov,#vBattle")) { /* 點空白不取消選取 */ } });

/* ----- 流程 ----- */
const sdKey = k => G.mode === "daily" ? `${G.seed}|${k}` : null;
function rollShop() { return withSeed(sdKey(`shop|${G.round}|${G.rerolls}`), () => genShop(G.round)); }
function startRun(cid, mode, seed, diff) {
  const ch = CID[cid], df = mode === "daily" ? 0 : Math.max(0, Math.min(3, diff || 0));
  G.linkKeys = null; Object.assign(G, { round: 1, lives: LIVES - (df >= 3 ? 1 : 0), gold: START_GOLD + ch.gold, char: cid, wins: 0, inv: [], sel: null, shopSel: -1, relics: [], fate: [], diff: df, bossAff: null, hpBonus: 0, mode: mode || "normal", seed: seed || "", over: false, lost: 0, path: [], offer: null, nodeType: null, phase: "map" });
  G.map = withSeed(sdKey("map"), genMap);
  G.bossAff = withSeed(sdKey("bossaff"), () => Object.fromEntries(Object.keys(BOSS_VARIANTS).map(r => [r, BOSS_VARIANTS[r][Math.floor(rnd() * BOSS_VARIANTS[r].length)].id])));
  ch.start.forEach(id => G.inv.push(mkItem(id))); autoPlace(G.inv); G.sel = G.inv[0].uid; META.games++; saveMeta();
  $("#ov").hidden = true; $("#vBattle").hidden = true; showSpread(enterMap);
}
const rerollFree = () => !!MODS().freeReroll && !G.freeUsed;
$("#btnReroll").onclick = () => {
  const free = rerollFree(); if (!free && G.gold < G.rerollCost) return toast("金幣不足");
  if (free) G.freeUsed = true; else { G.gold -= G.rerollCost; G.rerollCost++; }
  G.rerolls++; G.shop = rollShop(); G.shopSel = -1; noteSeen(); AU.tick(); refresh();
};
$("#btnAuto").onclick = () => { const items = G.inv.filter(i => i.x != null || true); autoPlace(items.filter(i => true).slice(0, 99)); refresh(); const left = G.inv.filter(i => i.x == null).length; if (left) toast(`有 ${left} 張放不下，留在收納區`); };
$("#btnFight").onclick = () => { if (G.phase === "shop") return afterNode(); if (!G.inv.some(i => i.x != null)) return toast("背包裡還沒有牌"); startBattle(); };

/* ----- 戰鬥畫面 ----- */
let BT = null;
const KIND = { wands: "fire", cups: "orb", swords: "slash", pents: "coin", major: "star" };
const GLOW = { wands: "#ff8a3a", cups: "#6fb4ff", swords: "#dff0ff", pents: "#ffd84a", major: "#c79bff" };
const center = el => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
function barPt(si) { const r = $(si ? "#eHpW" : "#pHpW").getBoundingClientRect(); return [r.left + r.width * (0.2 + Math.random() * 0.6), r.top + r.height / 2]; }
function startBattle() {
  G.running = true; G.sel = null; G.shopSel = -1; AU.ensure(); FX.clear();
  const placed = G.inv.filter(i => i.x != null);
  const mods = MODS(), b = new Battle(placed, myMax(), G.enemy.items, G.enemy.hp, mods, G.enemy.boss);
  BT = { b, speed: 1, acc: 0, last: performance.now(), done: false, els: [[], []], links: [{}, {}], pend: [0, 0], pendAb: [0, 0], freeze: 0, shake: 0, overAt: 0, ko: false, lastSeen: [0, 0], maxHit: 0 };
  $("#vBuild").hidden = true; $("#vBattle").hidden = false; window.scrollTo(0, 0);
  const mini = Math.max(28, Math.min(46, Math.floor((Math.min(window.innerWidth, 440) - 28) / COLS), Math.floor((window.innerHeight - 470) / (ROWS * 2))));
  [[1, "#eBoard", G.enemy.items], [0, "#pBoard", placed]].forEach(([si, sel, items]) => {
    const bd = $(sel); bd.innerHTML = ""; bd.style.width = COLS * mini + 4 + "px"; bd.style.setProperty("--cs", mini + "px"); bd.style.height = ROWS * mini + 4 + "px";
    b.s[si].units.forEach(u => { const el = mkItemEl(u.it, mini, { bar: true, u }); el.style.left = u.it.x * mini + "px"; el.style.top = u.it.y * mini + "px"; bd.appendChild(el); BT.els[si][u.idx] = el; });
    BT.links[si] = drawLinks(bd, b.s[si].units, mini, COLS * mini, ROWS * mini, null, null, false);
  });
  const mkAv = (id, items) => { if (!items.length) return; const top = items.slice().sort((p, q) => ID[q.id].tier - ID[p.id].tier)[0], S = SUITS[ID[top.id].suit]; $(id).setAttribute("style", sv(S)); $(id).innerHTML = itemIcon(top.id, 26); };
  mkAv("#eAv", G.enemy.items); $("#eAv").className = "av"; { const fa = eImg(G.enemy, "face", ""); if (fa) { $("#eAv").className = "av eart" + eTag(G.enemy); $("#eAv").innerHTML = fa; } } $("#pAv").removeAttribute("style"); $("#pAv").className = "av eart"; $("#pAv").innerHTML = `<img src="${PLAYER_FACE}" alt="" draggable="false">`;
  const it_ = $("#intro"), bs = G.enemy.boss; it_.hidden = false;
  it_.innerHTML = bs ? `<div class="vs bossv">${eImg(G.enemy, "full", "ivp bs")}<small>BOSS</small><b>${bs.nm}</b><span class="bd2">${bs.desc}</span></div>` : `<div class="vs"><img class="pl" src="${document.querySelector('#pChar img[data-p=idle]').src}" alt=""><b>VS</b>${eImg(G.enemy, "full", "ivp" + eTag(G.enemy))}<span class="b">${G.enemy.name}</span></div>`;
  const wait = bs ? 1900 : 950; setTimeout(() => it_.hidden = true, wait); BT.freeze = performance.now() + wait + 50; AU.vs(); saveMeta();
  $("#eName").innerHTML = (G.enemy.boss ? uiIcon("crown", 15, "#ffd84a") + " " : "") + G.enemy.name; $("#pName").textContent = "你"; setupDuel();
  $("#btnSpd").textContent = "×1"; $("#bResult").hidden = true;
  ["p", "e"].forEach(k => { $("#" + k + "Hp").style.width = "100%"; $("#" + k + "Gh").style.width = "100%"; });
  requestAnimationFrame(t => { BT.last = t; battleLoop(t); });
}
function floatTxt(si, html, col, size, crit) {
  const w = $(si ? "#eHpW" : "#pHpW"), f = tag("div", "fl" + (crit ? " crit" : ""), html); f.style.color = col; f.style.fontSize = (size || 15) + "px"; f.style.left = (12 + Math.random() * 62) + "%"; w.appendChild(f); setTimeout(() => f.remove(), 1000);
}
function pop(el, col) { if (!el) return; el.classList.remove("fire"); void el.offsetWidth; el.classList.add("fire"); if (col) { const [x, y] = center(el); FX.ring(x, y, col, 26, 3, .3); } }
function addShake(v) { if (BT) BT.shake = Math.min(14, Math.max(BT.shake, v)); }
function cls(el, c, ms) { el.classList.remove(c); void el.offsetWidth; el.classList.add(c); setTimeout(() => el.classList.remove(c), ms || 320); }
function impact(si, v, ab, x, y, suit, now, pr) {
  if (si === 0) { if (v > 0) setPose("hurt", 480); } else if (v > 0) cls(document.getElementById("eChar"), "hit", 260);
  const col = GLOW[suit] || "#ff6b5a";
  if (v > 0) {
    const big = v >= 14, size = Math.round(14 + Math.min(v, 36) * 0.55);
    floatTxt(si, "-" + v + (big ? "!" : ""), big ? "#ffd84a" : si ? "#ffffff" : "#ff7a6a", size, big);
    FX.burst(x, y, col, Math.round(7 + v * 0.8), 140 + v * 7, { cols: [col, "#fff", "#ffb08a"], sh: big ? "s" : "c" });
    if (big) FX.ring(x, y, "#fff", 40 + v, 4, .36); else FX.ring(x, y, col, 22, 2.5, .22);
    if (suit === "swords") FX.mark(x, y, col, -0.7 + Math.random() * 1.4, 26 + v);
    if (suit === "swords") FX.sprite("slash", x, y, { w: 70 + Math.min(v, 30) * 2.2, dur: 0.34, r0: -1.1 + Math.random() * 0.4, r1: 0.5, s0: 0.7, s1: 1.05, flip: Math.random() < 0.5 });
    else if (big) FX.sprite("slash", x, y, { w: 96, dur: 0.36, r0: -1.0, r1: 0.6, s0: 0.7, s1: 1.1, flip: Math.random() < 0.5 });
    if (suit !== "swords") FX.sprite("hit", x, y, { w: 40 + Math.min(v, 30) * 1.4, dur: 0.26, s0: 0.5, s1: 1.1, r0: (Math.random() - .5) * .6 });
    if (pr) FX.sprite("pierce", x, y - 34, { w: 64, dur: 0.4, s0: 0.8, s1: 1.05 });
    if (suit === "wands") FX.sprite("flame", x, y - 6, { w: 50 + Math.min(v, 24) * 1.5, dur: 0.5, s0: 0.5, s1: 1, rise: 18 });
    cls($(si ? "#eHpW" : "#pHpW"), big ? "bigh" : "hurt", big ? 320 : 200); cls($(si ? "#eBoard" : "#pBoard"), "hit", 220);
    addShake((si === 0 ? 3 : 2) + Math.min(9, v * 0.32));
    if (si === 0 && v >= 5) { const vg = $("#vig"); vg.classList.add("on"); setTimeout(() => vg.classList.remove("on"), 140); }
    AU.hit(v);
    if (big && BT.speed === 1) BT.freeze = now + 55 + Math.min(55, v * 2);
    if (navigator.vibrate && (si === 0 || big)) try { navigator.vibrate(Math.min(45, 8 + v)); } catch (e) { }
  }
  if (ab > 0) {
    floatTxt(si, uiIcon("shield", 14) + ab, "#9fdcff", 14);
    FX.burst(x, y, "#9fdcff", 8, 120, { cols: ["#9fdcff", "#fff"], sh: "s", g: 120 }); FX.ring(x, y, "#9fdcff", 24, 3, .26); FX.sprite("shield", x, y, { w: 46, dur: .3, s0: .6, s1: 1.1 });
    if (v === 0) { cls($(si ? "#eHpW" : "#pHpW"), "hurt", 200); addShake(1.5); AU.block(); }
  }
}
function itemTxt(el, txt, col) { const [x, y] = center(el), t = tag("div", "ft", txt); t.style.cssText = `left:${x}px;top:${y - 14}px;color:${col}`; document.body.appendChild(t); setTimeout(() => t.remove(), 1000); }
function chain(si, u) {
  const L = BT.links[si], els = BT.els[si], sp = Math.max(0.1, 0.22 / Math.sqrt(BT.speed)); let any = false;
  u.links.forEach((l, i) => {
    const g = L[l.n.idx + ">" + u.idx], from = els[l.n.idx], to = els[u.idx]; if (!g || !from || !to) return; any = true;
    const col = l.kind === "aura" ? "#ffd84a" : SUITS[l.n.d.suit].lt;
    g.classList.add("on"); setTimeout(() => g.classList.remove("on"), 600);
    const [x0, y0] = center(from), [x1, y1] = center(to);
    setTimeout(() => { FX.proj("link", x0, y0, x1, y1, sp, col, (x, y) => { FX.burst(x, y, col, 6, 70, { sh: "s", g: -40 }); FX.ring(x, y, col, 18, 2, .25); }); pop(from); itemTxt(to, l.lbl, col); }, i * 70);
  });
  u.d.aura && Object.keys(L).forEach(k => { const [a] = k.split(">"); if (+a === u.idx) { L[k].classList.add("on"); setTimeout(() => L[k] && L[k].classList.remove("on"), 600); } });
  if (any) AU.link();
}
function banner(t) { const b = $("#banner"); b.textContent = t; b.hidden = false; b.classList.remove("go"); void b.offsetWidth; b.classList.add("go"); setTimeout(() => b.hidden = true, 1100); }
function handleEvents(now) {
  const b = BT.b;
  b.ev.forEach(e => {
    if (e.k === "dmg") {
      if (e.src != null && e.si === 1) BT.maxHit = Math.max(BT.maxHit, e.v + e.ab);
      if (e.src != null) {
        const sEl = BT.els[1 - e.si][e.src], suit = sEl ? ID[b.s[1 - e.si].units.find(u => u.idx === e.src).it.id].suit : "wands";
        BT.pend[e.si] += e.v; BT.pendAb[e.si] += e.ab;
        const [x0, y0] = sEl ? center(sEl) : barPt(1 - e.si), [x1, y1] = barPt(e.si);
        const dur = Math.max(0.07, 0.24 / Math.sqrt(BT.speed));
        FX.proj(KIND[suit], x0, y0, x1, y1, dur, GLOW[suit], (x, y) => { BT.pend[e.si] -= e.v; BT.pendAb[e.si] -= e.ab; impact(e.si, e.v, e.ab, x, y, suit, performance.now(), e.pr); });
      } else {
        const burn = e.dot === "burn", boss = e.dot === "boss", thorn = e.dot === "thorn", col = boss ? "#ff4a4a" : thorn ? "#ffd0a0" : burn ? "#ff9a4a" : "#c08cf0", [x, y] = barPt(e.si);
        if (e.v > 0) floatTxt(e.si, (boss ? uiIcon("skull", 13) : thorn ? "反彈 " : uiIcon(burn ? "burn" : "poison", 12)) + "-" + e.v, col, boss ? 18 : 13); else if (boss) floatTxt(e.si, uiIcon("burn", 13) + "灼燒+4", col, 14);
        if (thorn) FX.ring(x, y, col, 24, 3, .25); if (boss) { addShake(8); FX.burst(x, y, "#ff4a4a", 16, 200, { sh: "s" }); }
        FX.burst(x, y, col, 4, 60, { g: -80, life: 1.2 }); if (burn) FX.sprite("burn", x, y - 8, { w: 44, dur: 0.5, s0: 0.5, s1: 1, rise: 20 }); else if (!boss && !thorn) FX.sprite("poison", x, y - 6, { w: 48, dur: 0.6, s0: 0.5, s1: 1, rise: 16 }); AU.dot(); cls($(e.si ? "#eHpW" : "#pHpW"), "hurt", 200); if (e.si === 0) addShake(1.2);
      }
    } else if (e.k === "heal") {
      const [x, y] = barPt(e.si); floatTxt(e.si, uiIcon("heart", 13) + "+" + e.v, "#7fe0a0", 14 + Math.min(8, e.v * 0.3));
      if (e.src != null && BT.els[e.si][e.src]) { const [x0, y0] = center(BT.els[e.si][e.src]); FX.proj("orb", x0, y0, x, y, 0.2, "#7fe0a0"); }
      FX.burst(x, y, "#7fe0a0", 8, 60, { g: -120, life: 1.3, sh: "s", cols: ["#7fe0a0", "#e8ffe8"] }); FX.sprite("heal", x, y - 4, { w: 62, dur: 0.65, s0: 0.6, s1: 1, rise: 22 }); AU.heal();
    } else if (e.k === "shield") {
      const [x, y] = barPt(e.si); floatTxt(e.si, uiIcon("shield", 14) + "+" + e.v, "#8fd3ff", 14);
      if (e.src != null && BT.els[e.si][e.src]) { const [x0, y0] = center(BT.els[e.si][e.src]); FX.proj("orb", x0, y0, x, y, 0.2, "#8fd3ff"); }
      FX.ring(x, y, "#8fd3ff", 30, 3, .3); FX.sprite("shield", x, y, { w: 60, dur: 0.5, s0: 0.5, s1: 1.1 }); AU.shield();
    } else if (e.k === "fire") {
      if (e.si === 0) setPose("cast", 420);
      const el = BT.els[e.si][e.idx]; if (el) { const u = b.s[e.si].units.find(q => q.idx === e.idx), suit = ID[u.it.id].suit; pop(el, GLOW[suit]); AU.shoot(suit); chain(e.si, u); }
    } else if (e.k === "charge") { pop(BT.els[e.si][e.idx], "#ffe27a"); }
    else if (e.k === "delay") { const el = BT.els[e.si][e.idx]; if (el) { itemTxt(el, "延遲", "#c8b0ff"); const [x, y] = center(el); FX.ring(x, y, "#c8b0ff", 22, 3, .35); cls(el, "stun", 500); } }
    else if (e.k === "boom") { const [x, y] = center($(e.si ? "#eBoard" : "#pBoard")); FX.burst(x, y, "#ff8a3a", 40, 380, { cols: ["#ff8a3a", "#ffd84a", "#fff"], sh: "s", life: 1.2 }); FX.ring(x, y, "#ff8a3a", 110, 6, .5); FX.sprite("flame", x, y, { w: 170, dur: 0.7, s0: 0.4, s1: 1.1, rise: 30 }); addShake(10); }
    else if (e.k === "status") { const sl = e.st === "slow", col = sl ? "#8fd3ff" : "#ff8a8a", [x, y] = barPt(e.si); floatTxt(e.si, uiIcon(e.st, 13) + (sl ? "緩速" : "易傷"), col, 13); FX.ring(x, y, col, 26, 3, .3); FX.sprite(sl ? "slow" : "vuln", x, y, sl ? { w: 62, dur: 0.6, s0: 0.5, s1: 1, r0: 0, r1: 1.6 } : { w: 56, dur: 0.45, s0: 0.6, s1: 1.1 }); }
    else if (e.k === "boss") { banner(e.type === "reap" ? "死神收割" : "命運擲骰"); }
    else if (e.k === "phoenix") { const [x, y] = barPt(0); banner("鳳凰重生"); floatTxt(0, uiIcon("heart", 16) + "重生！", "#ffb03a", 20, true); FX.burst(x, y, "#ffb03a", 50, 380, { cols: ["#ff8a3a", "#ffd84a", "#fff"], sh: "s", life: 1.5, g: -60 }); FX.ring(x, y, "#ffd84a", 120, 6, .6); FX.sprite("flame", x, y, { w: 180, dur: 0.8, s0: 0.4, s1: 1.1, rise: 40 }); cls($("#flash"), "on", 520); addShake(10); AU.heal(); AU.win(); META.phoenix = 1; }
  });
  b.ev.length = 0;
}
function drawBattle() {
  const b = BT.b;
  [[0, "p"], [1, "e"]].forEach(([si, k]) => {
    const s = b.s[si], hpv = Math.min(s.max, Math.max(0, s.hp + BT.pend[si])), shv = Math.max(0, s.shield + BT.pendAb[si]);
    $("#" + k + "Hp").style.width = hpv / s.max * 100 + "%"; $("#" + k + "Gh").style.width = hpv / s.max * 100 + "%"; $("#" + k + "HpT").textContent = Math.ceil(hpv) + "/" + s.max;
    $("#" + k + "Sh").style.width = Math.min(100, shv / s.max * 100) + "%";
    $("#" + k + "St").innerHTML = [shv > 0.5 ? `<span style="color:#9fdcff">${uiIcon("shield", 14)}${Math.round(shv)}</span>` : "", s.burn ? `<span style="color:#ff9a4a">${uiIcon("burn", 14)}${s.burn}</span>` : "", s.poison ? `<span style="color:#c08cf0">${uiIcon("poison", 14)}${s.poison}</span>` : "", s.regen ? `<span style="color:#7fe0a0">${uiIcon("regen", 14)}${s.regen}</span>` : "", s.slow > 0 ? `<span style="color:#8fd3ff">${uiIcon("slow", 14)}${Math.ceil(s.slow)}s</span>` : "", s.vuln > 0 ? `<span style="color:#ff8a8a">${uiIcon("vuln", 14)}${Math.ceil(s.vuln)}s</span>` : ""].filter(Boolean).join("");
    s.units.forEach(u => { const el = BT.els[si][u.idx]; if (el && el._bar && u.cd) el._bar.style.width = Math.min(100, u.timer / u.cd * 100) + "%"; if (el) el.classList.toggle("slowed", s.slow > 0); });
  });
  const f = b.t > 20; $("#bTime").innerHTML = uiIcon("clock", 14) + (f ? `疲勞 ${Math.floor(b.t)}s` : `${Math.floor(b.t)}s`);
}
function battleLoop(now) {
  if (!BT || BT.done) return;
  const dtr = Math.min(0.1, (now - BT.last) / 1000); BT.last = now;
  if (now >= BT.freeze && !BT.b.over) { BT.acc += dtr * BT.speed; while (BT.acc >= 0.05 && !BT.b.over) { BT.b.step(0.05); BT.acc -= 0.05; } }
  handleEvents(now); drawBattle();
  const vb = $("#vBattle");
  if (BT.shake > 0.25) { vb.style.transform = `translate(${(Math.random() * 2 - 1) * BT.shake}px,${(Math.random() * 2 - 1) * BT.shake}px)`; BT.shake *= Math.pow(0.0008, dtr); } else if (vb.style.transform) vb.style.transform = "";
  if (BT.b.over) {
    if (!BT.overAt) BT.overAt = now;
    if (!BT.ko && (!FX.busy() || now - BT.overAt > 1200)) doKO(now);
  }
  if (!BT.done) requestAnimationFrame(battleLoop);
}
function doKO(now) {
  BT.ko = true; const win = BT.b.winner === 0, loser = win ? 1 : 0; koPose(win);
  BT.pend = [0, 0]; BT.pendAb = [0, 0]; drawBattle();
  const [x, y] = center($(loser ? "#eBoard" : "#pBoard"));
  FX.burst(x, y, "#ff6b5a", 46, 360, { cols: ["#ff6b5a", "#ffd84a", "#fff"], sh: "s", life: 1.6 }); FX.ring(x, y, "#fff", 120, 6, .55); FX.ring(x, y, "#ffd84a", 80, 4, .7);
  const fl = $("#flash"); cls(fl, "on", 520); addShake(14); AU.ko();
  if (navigator.vibrate) try { navigator.vibrate([40, 30, 80]); } catch (e) { }
  const bd = $(loser ? "#eBoard" : "#pBoard"); bd.style.transition = "filter .6s,opacity .6s"; bd.style.filter = "grayscale(1) brightness(.6)"; bd.style.opacity = ".5";
  setTimeout(() => { bd.style.filter = bd.style.opacity = bd.style.transition = ""; finishBattle(); }, 950);
}
$("#btnSpd").onclick = () => { if (!BT) return; BT.speed = BT.speed === 1 ? 2 : BT.speed === 2 ? 4 : 1; $("#btnSpd").textContent = "×" + BT.speed; };
$("#btnSkip").onclick = () => { if (!BT || BT.done || BT.ko) return; let g = 0; while (!BT.b.over && g++ < 4000) BT.b.step(0.05); BT.b.ev.length = 0; FX.clear(); BT.pend = [0, 0]; BT.pendAb = [0, 0]; BT.ko = true; drawBattle(); finishBattle(); };
$("#btnMute").onclick = () => { AU.toggle(); renderHud(); };
document.addEventListener("pointerdown", () => AU.ensure(), { once: true });
function statRows(b) {
  const st = b.stat[0], rows = Object.keys(st).map(k => ({ u: b.s[0].units.find(u => u.idx === +k), d: st[k].d, s: st[k].s })).filter(r => r.u && (r.d || r.s)).sort((p, q) => (q.d + q.s * 0.6) - (p.d + p.s * 0.6)).slice(0, 4);
  if (!rows.length) return "";
  const mx = Math.max(...rows.map(r => r.d + r.s * 0.6)) || 1;
  return `<div class="stats"><div class="sub" style="text-align:left;margin-bottom:4px">${uiIcon("chart", 12)} 本場貢獻</div>` + rows.map(r => `<div class="sr"><span class="si">${itemIcon(r.u.it.id, 22)}</span><div class="sbar"><i style="width:${Math.max(6, (r.d + r.s * 0.6) / mx * 100)}%;background:${SUITS[r.u.d.suit].col}"></i></div><span class="sn2">${r.d ? "傷 " + r.d : ""}${r.d && r.s ? "　" : ""}${r.s ? "輔 " + r.s : ""}</span></div>`).join("") + `</div>`;
}
function finishBattle() {
  if (!BT || BT.done) return; BT.done = true; const b = BT.b, win = b.winner === 0, inc = buildUnits(G.inv.filter(i => i.x != null), MODS()).income, boss = G.enemy.boss, elite = G.enemy.elite;
  if (win) { G.wins++; META.totalWins++; if (boss) META.bossKills++; if (elite) META.eliteKills = (META.eliteKills || 0) + 1; } else { G.lives--; G.lost++; }
  bump("maxHit", BT.maxHit); if (G.inv.some(i => i.lv >= 3)) META.lv3 = 1; bump("maxRelics", G.relics.length);
  const fm = MODS(), gain = 8 + (win ? 2 : 0) + (win && elite ? 4 : 0) + inc + (win && boss ? (fm.bossGold || 0) : 0); G.gold += gain; if (win && boss && fm.bossHp) G.hpBonus += fm.bossHp;
  const last = G.round >= MAX_ROUND, dead = G.lives <= 0, end = dead || (last && win);
  const r = $("#bResult"); r.hidden = false; $("#vBattle").style.transform = "";
  r.innerHTML = `<div class="card">${eImg(G.enemy, "full", "rpt" + eTag(G.enemy) + (win ? " def" : "")) ? `<div class="rwrap">${eImg(G.enemy, "full", "rpt" + eTag(G.enemy) + (win ? " def" : ""))}<span class="rbadge">${uiIcon(win ? "trophy" : "heart0", 28, win ? "#ffd84a" : "#c46a7a")}</span></div>` : `<div class="big">${uiIcon(win ? "trophy" : "heart0", 52, win ? "#ffd84a" : "#c46a7a")}</div>`}<h2>${win ? (boss ? "擊破 BOSS" : elite ? "擊敗精英" : "勝利") : "落敗"}</h2><p>${win ? ((boss || elite) && !last ? "戰利品：選擇一件遺物" : "對手被打倒了") : "你被打倒了，失去 1 條命"}</p><p class="sub">收入 +${gain} ${uiIcon("coin", 13)}${inc ? `（含額外收入 ${inc}）` : ""}　剩 ${G.lives} 條命</p>${statRows(b)}<button class="btn primary" id="bNext" style="margin-top:10px;padding:11px 26px;font-size:15px">${end ? "查看結果" : win && (boss || elite) ? "選擇遺物" : "回到地圖"}</button></div>`;
  if (win) { AU.win(); const w = innerWidth; for (let i = 0; i < 4; i++) setTimeout(() => FX.burst(w * (0.2 + 0.2 * i), innerHeight * 0.3, "#ffd84a", 22, 260, { cols: ["#ffd84a", "#ff8a3a", "#c79bff", "#8fd3ff"], sh: "s", life: 1.8, g: 300 }), i * 140); } else AU.lose();
  saveMeta(); checkAch();
  $("#bNext").onclick = () => {
    BT = null; G.running = false; FX.clear();
    const go = () => { if (end) return showEnd(!dead); if (last && !win) { $("#vBattle").hidden = true; $("#vBuild").hidden = false; $("#bResult").hidden = true; return prepFight(false); } G.round++; enterMap(); };
    if (end) return go();
    if (win && (boss || elite) && !last) { $("#bResult").hidden = true; showRelicPick(go); } else go();
  };
}

