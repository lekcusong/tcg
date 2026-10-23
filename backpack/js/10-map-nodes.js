'use strict';
/* ===== 路線地圖與節點 ===== */
const NODE_COL = { fight: "#e2703a", elite: "#ff5a4a", shop: "#e8c468", event: "#b98cf0", rest: "#6fcf8a", mystery: "#6fb4ff", boss: "#ffd84a" };
const NODE_IC = { fight: "fight", elite: "skull", shop: "cart", event: "scroll", rest: "camp", mystery: "help", boss: "crown" };
const NODE_IMG = {"fight": "img/node-fight.webp", "elite": "img/node-elite.webp", "shop": "img/node-shop.webp", "event": "img/node-event.webp", "rest": "img/node-rest.webp", "mystery": "img/node-mystery.webp", "boss": "img/node-boss.webp"};
const nodeIcon = (t, sz) => NODE_IMG[t] ? `<img class="nimg" src="${NODE_IMG[t]}" width="${sz}" height="${sz}" alt="" draggable="false">` : uiIcon(NODE_IC[t], sz, NODE_COL[t]);
function mapFace(t, f) { const e = t === "boss" ? (BOSSES[f] && { boss: BOSSES[f] }) : t === "elite" ? { elite: true } : null; return e ? ENEMY_ART.face[eArtKey(e)] || null : null; }
function nodeFO(t, f, mys) { const mf = !mys && mapFace(t, f), s = t === "boss" ? 46 : 36; return mf ? `<foreignObject x="${-s / 2}" y="${-s / 2}" width="${s}" height="${s}"><div xmlns="http://www.w3.org/1999/xhtml" class="ni np"><img src="${mf}" alt=""></div></foreignObject>` : (() => { const tt = mys ? "mystery" : t, d = tt === "boss" ? 50 : 40; return `<foreignObject x="${-d / 2}" y="${-d / 2}" width="${d}" height="${d}"><div xmlns="http://www.w3.org/1999/xhtml" class="ni nm">${nodeIcon(tt, d)}</div></foreignObject>`; })(); }
let mapSel = -1;

function availNodes() {
  if (G.round <= 1) return G.map[0].map((_, i) => i);
  return G.map[G.round - 2][G.path[G.round - 2]].next;
}
function enterMap() {
  G.running = false; G.nodeType = null; G.enemy = null; G.phase = "map"; G.over = false; mapSel = -1;
  $("#vBattle").hidden = true; $("#vBuild").hidden = false; $("#bResult").hidden = true; $("#ov").hidden = true;
  refresh(); renderMap(); saveRun();
}
function renderMap() {
  const mv = $("#mapv"); mv.hidden = false; $("#vBuild").hidden = true;
  const W = Math.min(innerWidth, 440) - 24, SY = 84, PAD = 38, H = (MAX_ROUND - 1) * SY + PAD * 2, avail = availNodes();
  const px = (n, i) => W * (i + 1) / (n + 1), py = f => (MAX_ROUND - f) * SY + PAD;
  let edges = "", nodes = "";
  G.map.forEach((fl, f0) => {
    const f = f0 + 1;
    fl.forEach((nd, i) => nd.next.forEach(k => {
      if (!G.map[f]) return;
      const taken = G.path[f0] === i && G.path[f] === k && f < G.round, live = f === G.round - 1 && G.path[f0] === i || (f === G.round && false);
      const a = f === G.round && avail.includes(i) && false;
      const x1 = px(fl.length, i), y1 = py(f), x2 = px(G.map[f].length, k), y2 = py(f + 1);
      const on = (f0 < G.round - 1 && G.path[f0] === i && G.path[f] === k) || (f === G.round - 1 + 0 && G.path[f0] === i && avail.includes(k));
      const cls = on ? "e on" : (f >= G.round && avail.includes(i) && f === G.round) ? "e nx" : "e";
      edges += `<line class="${cls}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
    }));
  });
  G.map.forEach((fl, f0) => {
    const f = f0 + 1;
    fl.forEach((nd, i) => {
      const done = G.path[f0] === i && f < G.round, cur = f === G.round, can = cur && avail.includes(i), sel = can && mapSel === i;
      const t = nd.t, mys = t === "mystery" && !done;
      nodes += `<g class="nd ${done ? "done" : can ? "can" : cur ? "lock" : "fut"} ${sel ? "sel" : ""} ${t}" data-i="${i}" transform="translate(${px(fl.length, i)} ${py(f)})"><circle r="${t === "boss" ? 27 : 22}" ${t === "boss" ? "" : ""}/>${can ? '<circle class="pulse" r="22"/>' : ""}${nodeFO(t, f, mys)}</g>`;
    });
    nodes += `<text class="fl2 ${f === G.round ? "cur" : ""}" x="2" y="${py(f) + 4}">${f}</text>`;
  });
  const legend = ["fight", "elite", "shop", "event", "rest", "mystery"].map(t => `<span>${nodeIcon(t, 14)}${NODES[t].nm}</span>`).join("");
  const bar = mapSel >= 0 ? (() => { const t = G.map[G.round - 1][mapSel].t; return `<div class="mbar"><div class="mi2">${mapFace(t, G.round) ? `<img class="mbp" src="${mapFace(t, G.round)}" alt="">` : nodeIcon(t, 28)}<div><b>${NODES[t].nm}</b><small>${NODES[t].d}</small></div></div><button class="btn primary" id="mGo">前往</button></div>`; })() : `<div class="mbar"><small>點選發亮的節點，確認後前往</small></div>`;
  mv.innerHTML = `<div class="mh"><span class="chip">第 ${G.round}/${MAX_ROUND} 回合</span><span class="chip">${uiIcon("heart", 14)}${G.lives}</span><span class="chip">${uiIcon("coin", 14)}${G.gold}</span><span class="chip">${uiIcon("gem", 14)}${G.relics.length}</span><button class="btn" id="mDeck" style="padding:5px 9px">${uiIcon("book", 14)}</button></div><div class="mleg">${legend}</div><div class="mscroll" id="mscroll"><svg class="mapsvg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${edges}${nodes}</svg></div>${bar}`;
  mv.querySelectorAll(".nd.can").forEach(g => g.onclick = () => { mapSel = +g.dataset.i; AU.tick(); renderMap(); });
  if ($("#mGo")) $("#mGo").onclick = () => { AU.buy(); chooseNode(mapSel); };
  $("#mDeck").onclick = showDeckPeek;
  const sc = $("#mscroll"); sc.scrollTop = Math.max(0, py(G.round) - sc.clientHeight / 2);
}
function showDeckPeek() {
  const ov = $("#ov"); ov.hidden = false;
  ov.innerHTML = `<div class="card"><h2>我的牌組</h2><div class="rowi">${miniIcons(G.inv)}</div>${G.relics.length ? `<div class="rowi">${G.relics.map(id => `<span class="rl">${relicIcon(id, 24)}</span>`).join("")}</div><div class="sub">${G.relics.map(id => RID[id].nm).join("、")}</div>` : ""}<button class="btn primary" id="dkOk" style="margin-top:10px">返回地圖</button></div>`;
  $("#dkOk").onclick = () => { ov.hidden = true; };
}
function chooseNode(i) {
  const nd = G.map[G.round - 1][i]; G.path[G.round - 1] = i; let t = nd.t;
  if (t === "mystery") { t = withSeed(sdKey(`myst|${G.round}`), () => resolveMystery(G.round)); toast(`神秘節點：${NODES[t].nm}`, 1600); }
  $("#mapv").hidden = true; $("#vBuild").hidden = false; startNode(t);
}
function startNode(t) {
  G.nodeType = t; G.over = false;
  if (t === "fight" || t === "elite" || t === "boss") return prepFight(t === "elite");
  if (t === "shop") {
    G.phase = "shop"; G.enemy = null; G.rerollCost = 1; G.rerolls = 0; G.freeUsed = false; G.shopSel = -1;
    G.shop = withSeed(sdKey(`shopn|${G.round}|0`), () => genShop(Math.min(6, G.round + 1), 7));
    const r = withSeed(sdKey(`offer|${G.round}`), () => relicChoices(G.relics, 1)[0]); G.offer = r ? { id: r.id, price: 12, sold: false } : null;
    noteSeen(); refresh(); saveRun(); return;
  }
  G.phase = "node"; G.enemy = null; refresh();
  if (t === "rest") return showRest();
  if (t === "event") { const ev = withSeed(sdKey(`ev|${G.round}`), () => pickEvent(G.round)); return showEvent(ev, afterNode); }
}
function prepFight(elite) {
  G.rerollCost = 1; G.rerolls = 0; G.freeUsed = false; G.over = false; G.phase = "build"; G.shop = rollShop();
  G.enemy = withSeed(sdKey(`enemy|${G.round}${elite ? "|e" : ""}`), () => genEnemy(G.round, elite)); G.shopSel = -1; G.offer = null;
  noteSeen(); refresh(); saveRun();
}
function afterNode() {
  if (["shop", "rest", "event"].includes(G.nodeType)) G.gold += 6;
  G.offer = null; G.round++; if (G.round > MAX_ROUND) return showEnd(true);
  enterMap();
}
function buyOffer() {
  const o = G.offer; if (!o || o.sold) return; if (G.gold < o.price) return toast("金幣不足");
  G.gold -= o.price; o.sold = true; G.relics.push(o.id); noteSeen(); bump("maxRelics", G.relics.length); AU.merge(); toast("獲得遺物：" + RID[o.id].nm); refresh();
}
function showRest() {
  const ov = $("#ov"); ov.hidden = false;
  const up = G.inv.filter(i => (i.lv || 1) < 3), heal = G.lives < LIVES;
  ov.innerHTML = `<div class="card">${evArt("rest", uiIcon("camp", 46, "#6fcf8a"), 46)}<h2>休息營地</h2><p>營火旁很安靜，你可以整理背包、恢復精神。</p><div class="chs">
   <button class="btn ch" id="rUp" ${up.length ? "" : "disabled"}><b>升級一張牌</b><small>選擇一張牌，等級 +1</small></button>
   <button class="btn ch" id="rHeal"><b>${heal ? "回復 1 條命" : "最大生命 +6"}</b><small>${heal ? "目前 " + G.lives + "/" + LIVES : "命已滿，改為永久強化"}</small></button>
   <button class="btn ch" id="rGold"><b>獲得 10 金幣</b><small>去商店用得上</small></button></div></div>`;
  $("#rHeal").onclick = () => { if (heal) G.lives++; else G.hpBonus += 6; AU.heal(); ov.hidden = true; afterNode(); };
  $("#rGold").onclick = () => { G.gold += 10; AU.buy(); ov.hidden = true; afterNode(); };
  $("#rUp").onclick = () => {
    ov.innerHTML = `<div class="card"><h2>選擇要升級的牌</h2><div class="upg">${up.map(it => `<button class="btn up" data-u="${it.uid}">${itemIcon(it.id, 30)}<span>${ID[it.id].nm}<small>Lv${it.lv || 1} → Lv${(it.lv || 1) + 1}</small></span></button>`).join("")}</div><button class="btn" id="rBack" style="margin-top:10px">返回</button></div>`;
    $("#rBack").onclick = showRest;
    ov.querySelectorAll(".up").forEach(b => b.onclick = () => { const it = G.inv.find(x => x.uid === +b.dataset.u); it.lv = (it.lv || 1) + 1; if (it.lv >= 3) META.lv3 = 1; AU.merge(); ov.hidden = true; afterNode(); });
  };
}

window.addEventListener("resize", () => { if (!G.running && !G.over) { calcCS(); refresh(); } });
$("#btnAuto").innerHTML = bt("auto", "自動排列"); $("#btnFight").innerHTML = bt("fight", "開戰", 18); $("#btnSkip").innerHTML = bt("skip", "跳過", 14);
$("#shopTitle").innerHTML = uiIcon("cart", 17) + "<span>商店</span>"; $("#sellZone").innerHTML = uiIcon("trash", 16) + "拖到這裡賣出"; $("#hpLbl").innerHTML = uiIcon("heart", 13) + "我方生命 <b id='myHp'>60</b>";

