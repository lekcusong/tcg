
/* ===== GM：自訂寵物詞條並直接發寵物給玩家 — end ===== */
/* ===== 魔法裝備 PVP 防具系統 Robe Gear — end ===== */
/* ===== PVP 對戰畫面（競技場／切磋共用）— start ===== */
function pvpEnsureStyle(){
  if (document.getElementById("pvp-style")) return;
  const st = document.createElement("style");
  st.id = "pvp-style";
  st.textContent = `
.pvp-stage{border:1px solid var(--line);border-radius:14px;padding:12px;background:linear-gradient(180deg,rgba(255,255,255,.03),rgba(0,0,0,.18));margin:10px 0}
.pvp-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
.pvp-round{font-family:Cinzel,serif;color:var(--gold-bright);font-size:14px;letter-spacing:.5px}
.pvp-skip{font-size:11px;padding:3px 8px}
.pvp-arena{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:start}
.pvp-vs{align-self:center;font-family:Cinzel,serif;font-weight:700;color:var(--muted);font-size:12px}
.pvp-card{position:relative;min-width:0;border:1px solid var(--line);border-radius:12px;padding:8px;background:rgba(0,0,0,.22);transition:box-shadow .25s,border-color .25s,opacity .3s}
.pvp-card.active{border-color:var(--gold-bright);box-shadow:0 0 14px rgba(232,196,104,.45)}
.pvp-card.hit{animation:pvp-shake .4s}
.pvp-card.dead{opacity:.55;filter:grayscale(.6)}
.pvp-card.winner{border-color:var(--gold-bright);box-shadow:0 0 18px rgba(232,196,104,.6)}
.pvp-who{display:flex;align-items:center;gap:6px;min-width:0}
.pvp-avatar{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;overflow:hidden;flex:none;background:var(--bg-void);border:1px solid var(--line)}
.pvp-avatar img{width:100%;height:100%;object-fit:cover}
.pvp-name{font-weight:700;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pvp-tag{font-size:10px;color:var(--muted)}
.pvp-bar{position:relative;height:14px;border-radius:8px;overflow:hidden;background:var(--bg-void);border:1px solid var(--line);margin-top:6px}
.pvp-bar.pvp-shield{height:8px;margin-top:5px}
.pvp-bar .ghost{position:absolute;top:0;bottom:0;left:0;background:rgba(255,255,255,.35);transition:width 1s ease-out .35s}
.pvp-bar .fill{position:absolute;top:0;bottom:0;left:0;transition:width .3s ease-out;background:linear-gradient(90deg,var(--gold),var(--gold-bright))}
.pvp-bar.mid .fill{background:linear-gradient(90deg,#d9822b,#e8a44a)}
.pvp-bar.low .fill{background:linear-gradient(90deg,#c0392b,#e0554f)}
.pvp-bar.pvp-shield .fill{background:linear-gradient(90deg,#4f9fe0,#9fe0f5)}
.pvp-bar-text{font-size:11px;color:var(--muted);margin-top:2px}
.pvp-shield-text{font-size:10px;color:#7fd1f0;margin-top:1px}
.pvp-chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}
.pvp-chip{font-size:10px;padding:1px 6px;border-radius:999px;border:1px solid var(--line);background:rgba(255,255,255,.04);color:var(--muted);white-space:nowrap}
.pvp-chip.def{color:#e8c468}.pvp-chip.shield{color:#7fd1f0}.pvp-chip.heal{color:#7fd1a8}.pvp-chip.neg{color:#c99cf0}
.pvp-dice{margin-top:6px;min-height:56px}
.pvp-dice .dice-roll-anim{gap:6px;padding:2px 0}
.pvp-dice .dice-roll-die{width:42px;height:42px;font-size:18px;border-radius:10px}
.pvp-float-layer{position:absolute;left:0;right:0;top:34px;height:0;pointer-events:none;overflow:visible;z-index:5}
.pvp-float{position:absolute;transform:translateX(-50%);font-family:Cinzel,serif;font-weight:800;font-size:18px;text-shadow:0 1px 4px #000;white-space:nowrap;animation:pvp-float-up 1.1s ease-out forwards}
.pvp-float.dmg{color:#ff6b5e}.pvp-float.crit{color:#ffd24a;font-size:26px}.pvp-float.shield{color:#7fd1f0}.pvp-float.heal{color:#7fe0a8}
.pvp-log{margin-top:10px;max-height:150px;overflow-y:auto;font-size:12px;line-height:1.55;border-top:1px dashed var(--line);padding-top:6px}
.pvp-log div{padding:1px 0}
.pvp-log .round{color:var(--gold-bright);font-family:Cinzel,serif;margin-top:4px}
.pvp-log .crit{color:#ffd24a}.pvp-log .heal{color:#7fe0a8}.pvp-log .neg{color:#c99cf0}.pvp-log .block{color:#9fc4ff}
.pvp-log .rn{color:var(--gold-bright);font-family:Cinzel,serif;margin-right:4px}
.pvp-note{font-size:12px;color:var(--muted);margin-top:6px}
.pvp-log .detail{font-size:11px;color:var(--muted);padding-left:14px}
.pvp-die{display:inline-block;min-width:18px;text-align:center;font-family:Cinzel,serif;font-weight:700;font-size:12px;line-height:18px;border:1px solid var(--line);border-radius:5px;margin-right:3px;padding:0 3px;background:rgba(0,0,0,.25)}
.pvp-rd{border-bottom:1px dashed var(--line);padding:2px 0}
.pvp-rd>summary{cursor:pointer;list-style:none}
.pvp-rd>summary::-webkit-details-marker{display:none}
.pvp-turn{margin:4px 0 6px 10px;padding-left:8px;border-left:2px solid var(--line);font-size:12px;line-height:1.6}
.pvp-turn.a{border-left-color:var(--gold-bright)}.pvp-turn.b{border-left-color:#7fd1f0}
.pvp-turn .ln{color:var(--muted)}.pvp-turn .ln b{color:var(--cream)}
.pvp-stats{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}
.pvp-stats td,.pvp-stats th{padding:2px 6px;border-bottom:1px dashed var(--line);text-align:center}
.pvp-stats td:first-child{text-align:left;color:var(--muted)}
.pvp-replay-bar{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:8px}
.pvp-result{margin-top:10px;text-align:center;padding:10px;border-radius:12px;border:1px solid var(--gold-bright);background:rgba(232,196,104,.08);font-weight:700;font-size:15px}
.pvp-result.lose{border-color:var(--danger);background:rgba(224,85,79,.08)}
.pvp-result .sub{display:block;font-weight:400;font-size:12px;color:var(--muted);margin-top:2px}
/* 手機版：把連擊／暴擊等特效標籤縮小、改成圓角小標籤，光暈收斂，骰子縮小讓三顆排一行 */
@keyframes pvp-badge-glow{0%,100%{box-shadow:0 0 3px 0 var(--bc)}50%{box-shadow:0 0 9px 1px var(--bc)}}
@keyframes pvp-die-glow-fire{0%,100%{box-shadow:0 0 6px 1px rgba(255,91,26,.8);border-color:#ff5b1a}50%{box-shadow:0 0 11px 3px rgba(255,224,102,.9);border-color:#ffe066}}
@keyframes pvp-die-glow-gold{0%,100%{box-shadow:0 0 5px 1px rgba(232,196,104,.55);border-color:var(--gold-bright)}50%{box-shadow:0 0 11px 3px rgba(232,196,104,.85);border-color:var(--gold-bright)}}
@keyframes pvp-die-glow-violet{0%,100%{box-shadow:0 0 5px 1px rgba(139,107,209,.55);border-color:var(--violet)}50%{box-shadow:0 0 11px 3px rgba(139,107,209,.85);border-color:var(--violet)}}
@keyframes pvp-die-glow-rainbow{0%,100%{box-shadow:0 0 6px 1px rgba(255,91,91,.65);border-color:#ff5b5b}33%{box-shadow:0 0 6px 1px rgba(240,224,77,.65);border-color:#f0e04d}66%{box-shadow:0 0 8px 2px rgba(74,144,226,.7);border-color:#4a90e2}}
@media (max-width:600px){
.pvp-dice .dice-roll-anim{gap:4px;padding:2px 0}
.pvp-dice .dice-roll-die{width:34px;height:34px;font-size:16px;border-radius:9px}
.pvp-dice .dice-roll-die.combo-glow-triple7{animation:.38s cubic-bezier(.34,1.56,.64,1) dice-settle-pop,.85s ease-in-out .38s infinite pvp-die-glow-fire!important}
.pvp-dice .dice-roll-die.combo-glow-triple{animation:.38s cubic-bezier(.34,1.56,.64,1) dice-settle-pop,1.1s ease-in-out .38s infinite pvp-die-glow-gold!important}
.pvp-dice .dice-roll-die.combo-glow-pair{animation:.38s cubic-bezier(.34,1.56,.64,1) dice-settle-pop,1.1s ease-in-out .38s infinite pvp-die-glow-violet!important}
.pvp-dice .dice-roll-die.combo-glow-straight{animation:.38s cubic-bezier(.34,1.56,.64,1) dice-settle-pop,2.4s linear .38s infinite pvp-die-glow-rainbow!important}
.pvp-dice .dice-roll-badges{display:flex;flex-direction:column;align-items:stretch;gap:4px;margin-top:5px}
.pvp-dice .dice-roll-badge{display:block;margin:0;padding:3px 8px;border-radius:9px;font-size:11px;line-height:1.3;letter-spacing:0;text-align:center;box-sizing:border-box;white-space:normal;text-wrap:balance;--bc:rgba(232,196,104,.6);animation:.35s ease-out dice-badge-pop,1.4s ease-in-out .4s infinite pvp-badge-glow}
.pvp-dice .dice-roll-badge.pair{--bc:rgba(139,107,209,.7)}
.pvp-dice .dice-roll-badge.quality,.pvp-dice .dice-roll-badge.block{--bc:rgba(74,144,226,.7)}
.pvp-dice .dice-roll-badge.crit{--bc:rgba(224,85,79,.75)}
.pvp-dice .dice-roll-badge.lifesteal{--bc:rgba(79,178,134,.7)}
.pvp-dice .dice-roll-badge.triple7,.pvp-dice .dice-roll-badge.allwild{font-size:12px;padding:4px 8px;border-width:1px;--bc:rgba(255,150,60,.8);box-shadow:0 0 6px rgba(255,120,40,.5)}
.pvp-dice .dice-roll-badge.triple7{animation:.35s ease-out dice-badge-pop,1.2s ease-in-out .4s infinite pvp-badge-glow,1.8s linear infinite triple7-shimmer}
.pvp-dice .dice-roll-badge.allwild{animation:.35s ease-out dice-badge-pop,1.2s ease-in-out .4s infinite pvp-badge-glow,2.4s linear infinite allwild-shimmer}
.pvp-float{font-size:14px}.pvp-float.crit{font-size:19px}
}
@keyframes pvp-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-5px)}40%{transform:translateX(5px)}60%{transform:translateX(-3px)}80%{transform:translateX(3px)}}
@keyframes pvp-float-up{0%{opacity:0;margin-top:10px}15%{opacity:1;margin-top:0}100%{opacity:0;margin-top:-46px}}
`;
  document.head.appendChild(st);
}
const pvpFmt = n => Math.max(0, Math.round(n || 0)).toLocaleString();
const pvpBarClass = pct => pct < 25 ? "low" : pct < 50 ? "mid" : "";
function pvpGearChips(g){
  if (!g) return "";
  const c = [];
  g.defPct > 0 && c.push(`<span class="pvp-chip def">🛡️ ${dc("減傷","DR")} ${Math.round(g.defPct*1000)/10}%</span>`);
  g.shieldPct > 0 && c.push(`<span class="pvp-chip shield">🔷 ${dc("護盾","Shield")} ${Math.round(g.shieldPct*1000)/10}%</span>`);
  g.healPct > 0 && c.push(`<span class="pvp-chip heal">💚 ${dc("回血","Regen")} ${Math.round(g.healPct*1000)/10}%</span>`);
  (g.setElements && g.setElements.length ? g.setElements : (g.setElement ? [g.setElement] : [])).forEach(es => { elementMeta[es] && c.push(`<span class="pvp-chip" style="color:${elementMeta[es].color};">${elementMeta[es].icon} ${dc(elementMeta[es].labelZh + "套","Set")}：${robeSetBonusText(es)}</span>`); });
  Object.keys(g.affixes || {}).forEach(k => { ROBE_AFFIX_META[k] && g.affixes[k] > 0 && c.push(`<span class="pvp-chip neg">🚫 ${dc(ROBE_AFFIX_META[k].labelZh, ROBE_AFFIX_META[k].labelEn)} ${Math.round(g.affixes[k]*1000)/10}%</span>`); });
  return c.length ? `<div class="pvp-chips">${c.join("")}</div>` : "";
}
function pvpCardHtml(idp, side, res, cfg, hp, sh, live, cls){
  const b = res.battle, isA = "a" === side;
  const maxHp = isA ? b.attackerMaxHp : b.defenderMaxHp, shMax = (isA ? b.attackerShieldMax : b.defenderShieldMax) || 0;
  const name = isA ? cfg.cardA : cfg.cardB, tag = isA ? cfg.tagA : cfg.tagB, av = isA ? cfg.avatarHtmlA : cfg.avatarHtmlB, gear = isA ? b.attackerGear : b.defenderGear;
  const hpPct = Math.max(0, Math.min(100, 100 * hp / (maxHp || 1))), shPct = shMax > 0 ? Math.max(0, Math.min(100, 100 * sh / shMax)) : 0;
  return `<div class="pvp-card ${cls || ""}" id="${idp}-card-${side}">
    <div class="pvp-float-layer" id="${idp}-float-${side}"></div>
    <div class="pvp-who"><div class="pvp-avatar">${av || "🎲"}</div><div style="min-width:0;"><div class="pvp-name">${Iu(name || "")}</div><div class="pvp-tag">${tag || ""}</div></div></div>
    <div class="pvp-bar pvp-shield" id="${idp}-shwrap-${side}" style="${shMax > 0 ? "" : "display:none;"}"><div class="ghost" id="${idp}-shghost-${side}" style="width:${shPct}%"></div><div class="fill" id="${idp}-shfill-${side}" style="width:${shPct}%"></div></div>
    <div class="pvp-shield-text" id="${idp}-shtext-${side}" style="${shMax > 0 ? "" : "display:none;"}">🔷 ${dc("護盾","Shield")} ${pvpFmt(sh)} / ${pvpFmt(shMax)}</div>
    <div class="pvp-bar ${pvpBarClass(hpPct)}" id="${idp}-hpwrap-${side}"><div class="ghost" id="${idp}-hpghost-${side}" style="width:${hpPct}%"></div><div class="fill" id="${idp}-hpfill-${side}" style="width:${hpPct}%"></div></div>
    <div class="pvp-bar-text" id="${idp}-hptext-${side}">HP ${pvpFmt(hp)} / ${pvpFmt(maxHp)}</div>
    ${pvpGearChips(gear)}
    ${live ? `<div class="pvp-dice"><div id="${idp}-dice-${side}" class="dice-roll-anim" style="display:none;"></div></div>` : ""}
  </div>`;
}
function pvpStageHtml(idp, res, cfg){
  const b = res.battle;
  return `<div class="pvp-stage" id="${idp}-stage">
    <div class="pvp-head"><span class="pvp-round" id="${idp}-round">⚔️ ${dc("戰鬥開始","Battle start")}</span><button class="btn small secondary pvp-skip" id="${idp}-skip">⏩ ${dc("跳過動畫","Skip")}</button></div>
    <div class="pvp-arena">${pvpCardHtml(idp, "a", res, cfg, b.attackerMaxHp, b.attackerShieldMax || 0, true)}<div class="pvp-vs">VS</div>${pvpCardHtml(idp, "b", res, cfg, b.defenderMaxHp, b.defenderShieldMax || 0, true)}</div>
    <div id="${idp}-result"></div>
    <div class="pvp-log" id="${idp}-log"></div>
  </div>`;
}
function pvpResultHtml(res, cfg){
  const b = res.battle, aWon = "attacker" === b.winner, self = "self" === cfg.perspective;
  const title = self ? (aWon ? "🎉 " + dc("勝利","Victory") : "💔 " + dc("落敗","Defeat")) : `🏆 ${Iu(aWon ? cfg.nameA : cfg.nameB)} ${dc("獲勝","wins")}`;
  const timeout = b.maxRounds && b.rounds.length >= b.maxRounds && b.attackerHpLeft > 0 && b.defenderHpLeft > 0;
  const subs = [];
  timeout && subs.push(dc("回合數用盡，依剩餘血量比例判定","Round limit reached — decided by remaining HP %"));
  cfg.ratingHtml && subs.push(cfg.ratingHtml);
  return `<div class="pvp-result ${self && !aWon ? "lose" : ""}">${title}${subs.map(t => `<span class="sub">${t}</span>`).join("")}</div>`;
}
function robeSetBonusText(el){
  const sb = ROBE_SET_BONUS[el] || {}, nm = { defPct: [dc("減傷","DR")], shieldPct: [dc("護盾","Shield")], healPct: [dc("回血","Regen")] };
  return Object.keys(sb).filter(k => nm[k]).map(k => `${nm[k][0]}+${Math.round(sb[k]*1000)/10}%`).join(" ");
}
const PVP_FACE_EFFECT = { atk:["⚔️","攻擊加成","ATK up"], crit_rate:["🎯","暴擊率","Crit rate"], crit_dmg:["💥","暴擊傷害","Crit dmg"], flat_dmg:["➕","固定傷害","Flat dmg"], lifesteal:["🩸","吸血","Lifesteal"], block_chance:["🛡️","格擋","Block"], combo_boost:["🔗","連擊加成","Combo boost"], thorns:["🌵","反擊","Thorns"], pursuit:["🗡️","追擊","Pursuit"], parry:["🛡️⚔️","盾反","Parry"], reroll:["🎲","幸運連鎖","Lucky chain"], wild:["🃏","百搭","Wild"] };
// 依實際出手順序，還原每個動作「出手前」與「出手後」的血量／護盾（資料都來自模擬時的快照，不會重新亂數）
function pvpTurnSeq(b){
  const out = [], order = b.defenderFirst ? ["b","a"] : ["a","b"];
  let s = { aH: b.attackerMaxHp, aS: b.attackerShieldMax || 0, dH: b.defenderMaxHp, dS: b.defenderShieldMax || 0 };
  (b.rounds || []).forEach(r => {
    if (typeof r.attackerHpAfterHeal === "number") s = { ...s, aH: r.attackerHpAfterHeal };
    if (typeof r.defenderHpAfterHeal === "number") s = { ...s, dH: r.defenderHpAfterHeal };
    const turns = [];
    order.forEach(side => {
      const full = "a" === side ? r.attackerFull : r.defenderFull, snap = "a" === side ? r.turnAtk : r.turnDef;
      if (!full || !snap) return;
      const prev = { ...s }; s = { aH: snap.aH, aS: snap.aS, dH: snap.dH, dS: snap.dS };
      turns.push({ side, full, prev, snap });
    });
    out.push({ r, turns });
  });
  return out;
}
function pvpTurnCalc(r, t){
  const isA = "a" === t.side, f = t.full, tg = isA ? "d" : "a";
  const blocked = isA ? !!r.defenderBlocked : !!r.attackerBlocked;
  const raw = Math.round(f.damage || 0), dealt = blocked ? 0 : raw;
  const shAbs = Math.max(0, Math.round(t.prev[tg + "S"] - t.snap[tg + "S"]));
  const hpLoss = Math.max(0, Math.round(t.prev[tg + "H"] - t.snap[tg + "H"]));
  const over = Math.max(0, dealt - shAbs);
  return {
    isA, f, blocked, raw, dealt, shAbs, hpLoss, tg,
    drSaved: dealt > 0 ? Math.max(0, over - hpLoss) : 0,
    lifesteal: dealt > 0 && f.lifestealPct > 0 ? Math.round(dealt * f.lifestealPct) : 0,
    oppParry: Math.round((isA ? r.defenderParryStrike : r.attackerParryStrike) || 0),
    thornsBack: Math.round(f.thornsBackDamage || 0),
    hpBefore: Math.round(t.prev[tg + "H"]), hpAfter: Math.round(t.snap[tg + "H"])
  };
}
const pvpPct = v => Math.round((v || 0) * 1000) / 10;
// 單一動作的詳細說明（回傳多行 HTML；報告與即時播放共用）
function pvpTurnLines(b, r, t, cfg){
  const c = pvpTurnCalc(r, t), f = c.f, me = Iu(c.isA ? cfg.nameA : cfg.nameB), opp = Iu(c.isA ? cfg.nameB : cfg.nameA);
  const L = [];
  // ① 骰面
  const dice = (f.rolls || []).map(x => {
    const q = so[x.quality] || {}, ef = x.face && x.face.effect ? PVP_FACE_EFFECT[x.face.effect.kind] : null;
    return `<span class="pvp-die" style="border-color:${q.color || "var(--line)"};color:${q.color || "inherit"};" title="${ef ? dc(ef[1], ef[2]) : ""}">${x.face.num}${ef ? ef[0] : ""}</span>`;
  }).join("");
  L.push(`🎲 ${dice}`);
  // ② 加成與觸發
  const tags = [], CM = { pair:["✌️","對子","Pair"], triple:["🎯","豹子","Triple"], triple7:["🔥","三顆7","Triple 7s"], straight:["🌈","順子","Straight"], allWildStraight:["🃏","全百搭順子","Wild Straight"] };
  if (f.comboTier) { const m = CM[f.comboTier] || ["✨", f.comboTier, f.comboTier]; tags.push(`${m[0]}${dc(m[1], m[2])}×${xo[f.comboTier] || "?"}`); }
  if (f.qualityComboTier) tags.push(`🔷${dc("品質","Quality ")}${({pair:dc("對子","Pair"),triple:dc("豹子","Triple"),straight:dc("順子","Straight")})[f.qualityComboTier] || f.qualityComboTier}×${Eo[f.qualityComboTier] || "?"}`);
  f.allWild && tags.push(`🃏${dc("全百搭（必暴擊）","All wild (auto-crit)")}`);
  f.comboStreakBonus > 0 && tags.push(`🔥${dc("連擊","Streak")}×${f.comboStreakUsed || 0}（+${pvpPct(f.comboStreakBonus)}%）`);
  f.isCrit ? tags.push(`💥${dc("暴擊","Crit")}（${dc("暴傷","dmg")}+${pvpPct(f.critDmgBonus)}%）`)
           : (f.critNegated ? tags.push(`💢${dc("暴擊被無效化","Crit negated")}`) : (f.critRateBonus > 0 && tags.push(`${dc("暴擊率","Crit rate")} ${pvpPct(f.critRateBonus)}%（${dc("未暴擊","no crit")}）`)));
  f.atkBonus > 0 && tags.push(`⚔️${dc("攻擊","ATK")}+${pvpPct(f.atkBonus)}%`);
  f.flatDmgBonus > 0 && tags.push(`➕${dc("固定","Flat")}+${pvpFmt(f.flatDmgBonus)}`);
  f.pursuitTriggered && tags.push(`🗡️${dc("追擊發動","Pursuit")}×1.5`);
  (f.rerollEvents || []).length > 0 && tags.push(`🎲${dc("幸運連鎖","Lucky chain")}×${f.rerollEvents.length}（+${pvpFmt(f.rerollEvents.reduce((x, e) => x + (e.damage || 0), 0))}）`);
  tags.length && L.push(tags.join("　"));
  // ③ 傷害結算
  if (c.blocked) L.push(`🛡️ ${opp} ${dc("格擋了這次攻擊","blocked this attack")}（${dc("原本會造成","would have dealt")} ${pvpFmt(c.raw)}）`);
  else {
    const p = [`⚔️ <b>${pvpFmt(c.dealt)}</b> ${dc("傷害","dmg")}`];
    c.shAbs > 0 && p.push(`🔷 ${dc("護盾吸收","shield absorbed")} ${pvpFmt(c.shAbs)}`);
    c.drSaved > 0 && p.push(`🛡️ ${dc("減傷擋下","DR prevented")} ${pvpFmt(c.drSaved)}`);
    p.push(`❤️ ${opp} HP ${pvpFmt(c.hpBefore)} → ${pvpFmt(c.hpAfter)}（-${pvpFmt(c.hpLoss)}）`);
    L.push(p.join("　·　"));
  }
  // ④ 附帶效果
  const ex = [];
  c.lifesteal > 0 && ex.push(`🩸${me} ${dc("吸血","lifesteal")} +${pvpFmt(c.lifesteal)}（${pvpPct(f.lifestealPct)}%）`);
  f.blockTriggered && ex.push(`🛡️${dc("格擋就緒","Block ready")}（${pvpPct(f.blockChancePct)}%）`);
  f.parryTriggered && ex.push(`🛡️⚔️${dc("盾反就緒","Parry ready")}（${pvpPct(f.parryPct)}%）`);
  f.thornsTriggered && ex.push(`🌵${dc("反擊就緒","Thorns ready")}（${pvpPct(f.thornsPct)}%）`);
  c.oppParry > 0 && ex.push(`🛡️⚔️${opp} ${dc("盾反回敬","parried back")} ${pvpFmt(c.oppParry)}`);
  c.thornsBack > 0 && ex.push(`🌵${opp} ${dc("反擊","thorns")} ${pvpFmt(c.thornsBack)}`);
  ex.length && L.push(ex.join("　·　"));
  // ⑤ 對手裝備詞條
  const neg = [...robeNegateAnnounceLines(f.negAffixesApplied, opp), ...robeNegateResultLines(f)];
  neg.length && L.push(`<span class="neg">${neg.join(" ")}</span>`);
  return L;
}
function pvpBattleStatsHtml(res, cfg){
  const b = res.battle, blank = () => ({ dmg:0, hits:0, crits:0, max:0, blocked:0, sh:0, dr:0, heal:0, ls:0, parry:0, thorns:0 });
  const S = { a: blank(), b: blank() };
  pvpTurnSeq(b).forEach(({ r, turns }) => {
    S.a.heal += r.attackerHeal || 0; S.b.heal += r.defenderHeal || 0;
    turns.forEach(t => {
      const c = pvpTurnCalc(r, t), me = c.isA ? "a" : "b", op = c.isA ? "b" : "a";
      if (c.blocked) S[me].blocked++;
      else { S[me].dmg += c.dealt; S[me].hits++; c.f.isCrit && S[me].crits++; S[me].max = Math.max(S[me].max, c.dealt); }
      S[op].sh += c.shAbs; S[op].dr += c.drSaved; S[me].ls += c.lifesteal; S[op].parry += c.oppParry; S[op].thorns += c.thornsBack;
    });
  });
  const has = k => S.a[k] > 0 || S.b[k] > 0;
  const row = (zh, en, k, f) => `<tr><td>${dc(zh, en)}</td><td>${(f || pvpFmt)(S.a[k])}</td><td>${(f || pvpFmt)(S.b[k])}</td></tr>`;
  return `<table class="pvp-stats"><tr><th></th><th>${Iu(cfg.nameA)}</th><th>${Iu(cfg.nameB)}</th></tr>
    ${row("總傷害","Total damage","dmg")}${row("命中次數","Hits landed","hits")}${row("暴擊次數","Crits","crits")}${row("單次最高","Biggest hit","max")}
    ${has("blocked") ? row("被格擋次數","Attacks blocked","blocked") : ""}${has("sh") ? row("護盾吸收","Shield absorbed","sh") : ""}${has("dr") ? row("減傷擋下","DR prevented","dr") : ""}
    ${has("heal") ? row("每回合回血","Regen","heal") : ""}${has("ls") ? row("吸血","Lifesteal","ls") : ""}${has("parry") ? row("盾反回敬","Parry strikes","parry") : ""}${has("thorns") ? row("反擊傷害","Thorns","thorns") : ""}</table>`;
}
function pvpRoundRowsHtml(res, cfg){
  const b = res.battle, A = Iu(cfg.nameA), B = Iu(cfg.nameB), hasSh = b.attackerShieldMax > 0 || b.defenderShieldMax > 0;
  return pvpTurnSeq(b).map(({ r, turns }) => {
    const parts = [];
    r.attackerShieldRegen && parts.push(`🔷${A}${dc("重生","regen")}`);
    r.defenderShieldRegen && parts.push(`🔷${B}${dc("重生","regen")}`);
    r.attackerHeal > 0 && parts.push(`💚${A}+${pvpFmt(r.attackerHeal)}`);
    r.defenderHeal > 0 && parts.push(`💚${B}+${pvpFmt(r.defenderHeal)}`);
    turns.forEach(t => {
      const c = pvpTurnCalc(r, t), me = c.isA ? A : B;
      parts.push(c.blocked ? `🛡️${me} ${dc("被格擋","blocked")}` : `⚔️${me} ${pvpFmt(c.dealt)}${c.f.isCrit ? "💥" : ""}`);
    });
    const hpTxt = `HP ${pvpFmt(r.attackerHpAfter)} vs ${pvpFmt(r.defenderHpAfter)}` + (hasSh ? ` · 🔷 ${pvpFmt(r.attackerShieldAfter)} vs ${pvpFmt(r.defenderShieldAfter)}` : "");
    const head = `<span class="rn">${dc(`第${r.round}回合`, `R${r.round}`)}</span>${parts.join("　·　")} <span style="opacity:.75">（${hpTxt}）</span>`;
    const body = [];
    (r.attackerShieldRegen || r.defenderShieldRegen) && body.push(`<div class="pvp-turn"><div class="ln">🔷 ${dc("護盾重生","Shield regenerated")}：${r.attackerShieldRegen ? A : ""}${r.attackerShieldRegen && r.defenderShieldRegen ? "、" : ""}${r.defenderShieldRegen ? B : ""}</div></div>`);
    (r.attackerHeal > 0 || r.defenderHeal > 0) && body.push(`<div class="pvp-turn"><div class="ln">💚 ${dc("回合開始回血","Start-of-round regen")}：${r.attackerHeal > 0 ? `${A} +${pvpFmt(r.attackerHeal)}（→ ${pvpFmt(r.attackerHpAfterHeal)}）` : ""}${r.attackerHeal > 0 && r.defenderHeal > 0 ? "　" : ""}${r.defenderHeal > 0 ? `${B} +${pvpFmt(r.defenderHeal)}（→ ${pvpFmt(r.defenderHpAfterHeal)}）` : ""}</div></div>`);
    turns.forEach(t => {
      const me = "a" === t.side ? A : B;
      body.push(`<div class="pvp-turn ${t.side}"><div><b>${me}</b> ${dc("出手","acts")}</div>${pvpTurnLines(b, r, t, cfg).map(x => `<div class="ln">${x}</div>`).join("")}</div>`);
    });
    return `<details class="pvp-rd"><summary>${head}</summary>${body.join("")}</details>`;
  }).join("");
}
window.__pvpReplayReg = window.__pvpReplayReg || {};
function pvpBattleReportHtml(res, cfg){
  if (!res || !res.battle) return "";
  pvpEnsureStyle();
  const b = res.battle, idp = (cfg.idp || "pvp") + "-r", aWon = "attacker" === b.winner;
  window.__pvpReplayReg[idp] = { res, cfg };
  const shieldLine = (b.attackerShieldMax > 0 || b.defenderShieldMax > 0) ? `<div class="pvp-note">🔷 ${dc("護盾剩餘","Shield left")}：${Iu(cfg.nameA)} ${pvpFmt(b.attackerShieldLeft)}/${pvpFmt(b.attackerShieldMax)} ・ ${Iu(cfg.nameB)} ${pvpFmt(b.defenderShieldLeft)}/${pvpFmt(b.defenderShieldMax)}</div>` : "";
  const expandBtns = `<div style="display:flex;gap:6px;margin:6px 0;"><button class="btn small secondary" style="font-size:11px;padding:3px 8px;" onclick="this.closest('.pvp-detail-wrap').querySelectorAll('details.pvp-rd').forEach(d=>d.open=true)">${dc("全部展開","Expand all")}</button><button class="btn small secondary" style="font-size:11px;padding:3px 8px;" onclick="this.closest('.pvp-detail-wrap').querySelectorAll('details.pvp-rd').forEach(d=>d.open=false)">${dc("全部收合","Collapse all")}</button></div>`;
  return `<div class="pvp-stage">
    <div class="pvp-head"><span class="pvp-round">⚔️ ${cfg.reportTitle || dc("戰報","Battle report")}</span><button class="btn small secondary pvp-skip" data-pvp-replay="${idp}">▶ ${dc("重播","Replay")}</button></div>
    <div id="${idp}-replay-box"></div>
    <div class="pvp-arena">${pvpCardHtml(idp, "a", res, cfg, b.attackerHpLeft, b.attackerShieldLeft || 0, false, aWon ? "winner" : b.attackerHpLeft <= 0 ? "dead" : "")}<div class="pvp-vs">VS</div>${pvpCardHtml(idp, "b", res, cfg, b.defenderHpLeft, b.defenderShieldLeft || 0, false, !aWon ? "winner" : b.defenderHpLeft <= 0 ? "dead" : "")}</div>
    ${pvpResultHtml(res, cfg)}
    ${cfg.notesHtml || ""}${shieldLine}
    <details style="margin-top:8px;"><summary style="cursor:pointer;font-size:12px;color:var(--muted);">${dc("戰鬥統計","Battle stats")}</summary>${pvpBattleStatsHtml(res, cfg)}</details>
    <details class="pvp-detail-wrap" style="margin-top:8px;"><summary style="cursor:pointer;font-size:12px;color:var(--muted);">${dc("逐回合明細","Round details")}</summary>${expandBtns}<div class="pvp-log" style="max-height:420px;">${pvpRoundRowsHtml(res, cfg)}</div></details>
  </div>`;
}
// ===== 重播：戰報上的「▶ 重播」按鈕（用同一份戰鬥結果重新播一次動畫，不會重新擲骰／重新結算）=====
async function pvpStartReplay(key, reg, box){
  pvpEnsureStyle();
  const cfg = Object.assign({}, reg.cfg, { idp: key + "rp", isReplay: true });
  const tok = box.__pvpTok = (box.__pvpTok || 0) + 1;
  window.__pvpReplaySpeed = window.__pvpReplaySpeed || 1; window.__pvpReplayPaused = false;
  const spd = n => `<button class="btn small ${(window.__pvpReplaySpeed || 1) === n ? "" : "secondary"} pvp-skip" data-pvp-speed="${n}">${n}×</button>`;
  box.innerHTML = `<div class="pvp-replay-bar"><span class="pvp-tag">${dc("重播速度","Speed")}</span>${spd(1)}${spd(2)}${spd(4)}<button class="btn small secondary pvp-skip" data-pvp-pause="1">⏸ ${dc("暫停","Pause")}</button><button class="btn small secondary pvp-skip" data-pvp-replay="${key}">↺ ${dc("從頭","Restart")}</button><button class="btn small secondary pvp-skip" data-pvp-replay-close="${key}">✕</button></div>${pvpStageHtml(cfg.idp, reg.res, cfg)}`;
  const stage = box.querySelector("#" + cfg.idp + "-stage");
  if (!stage || tok !== box.__pvpTok) return;
  await pvpPlayBattle(stage, reg.res, cfg);
}
document.addEventListener("click", ev => {
  const t = ev.target && ev.target.closest ? ev.target.closest("[data-pvp-replay],[data-pvp-replay-close],[data-pvp-speed],[data-pvp-pause]") : null;
  if (!t) return;
  if (t.hasAttribute("data-pvp-speed")) {
    window.__pvpReplaySpeed = Number(t.dataset.pvpSpeed) || 1;
    (t.parentElement || document).querySelectorAll("[data-pvp-speed]").forEach(x => x.classList.toggle("secondary", x !== t));
    return;
  }
  if (t.hasAttribute("data-pvp-pause")) {
    window.__pvpReplayPaused = !window.__pvpReplayPaused;
    t.textContent = window.__pvpReplayPaused ? "▶ " + dc("繼續","Resume") : "⏸ " + dc("暫停","Pause");
    return;
  }
  const key = t.dataset.pvpReplay || t.dataset.pvpReplayClose, reg = window.__pvpReplayReg[key], box = document.getElementById(key + "-replay-box");
  if (!box) return;
  if (t.hasAttribute("data-pvp-replay-close")) { box.__pvpTok = (box.__pvpTok || 0) + 1; window.__pvpReplayPaused = false; box.innerHTML = ""; return; }
  if (!reg) return;
  pvpStartReplay(key, reg, box);
});
async function pvpPlayBattle(stage, res, cfg){
  if (!stage || !res || !res.battle) return;
  const idp = cfg.idp, b = res.battle, q = id => stage.querySelector("#" + idp + "-" + id);
  const A = Iu(cfg.nameA), B = Iu(cfg.nameB);
  const maxRounds = b.maxRounds || b.rounds.length;
  const maxHp = { a: b.attackerMaxHp, b: b.defenderMaxHp }, shMax = { a: b.attackerShieldMax || 0, b: b.defenderShieldMax || 0 };
  const st = { a: { hp: maxHp.a, sh: shMax.a }, b: { hp: maxHp.b, sh: shMax.b } };
  let skipped = false;
  const skipBtn = q("skip");
  skipBtn && (skipBtn.onclick = () => { skipped = true; skipBtn.style.display = "none"; });
  const spd = () => cfg.isReplay ? Math.max(1, Number(window.__pvpReplaySpeed) || 1) : 1;
  const sleep = async ms => {
    if (skipped) return;
    while (cfg.isReplay && window.__pvpReplayPaused && !skipped && stage.isConnected) await new Promise(r => setTimeout(r, 120));
    await new Promise(r => setTimeout(r, ms / spd()));
  };
  const log = q("log"), roundEl = q("round");
  const logLine = (t, cls) => { log.insertAdjacentHTML("beforeend", `<div class="${cls || ""}">${t}</div>`); log.scrollTop = log.scrollHeight; };
  let floatN = 0;
  const float = (side, text, cls) => {
    const layer = q("float-" + side); if (!layer) return;
    const el = document.createElement("span");
    el.className = "pvp-float " + cls; el.textContent = text;
    el.style.left = `calc(50% + ${((floatN++ % 3) - 1) * 26}px)`;
    layer.appendChild(el); setTimeout(() => el.remove(), 1200);
  };
  const hit = side => { if (skipped) return; const c = q("card-" + side); if (!c) return; c.classList.remove("hit"); void c.offsetWidth; c.classList.add("hit"); setTimeout(() => c.classList.remove("hit"), 450); };
  const render = side => {
    const s = st[side], hpPct = Math.max(0, Math.min(100, 100 * s.hp / (maxHp[side] || 1)));
    q("hpfill-" + side).style.width = hpPct + "%"; q("hpghost-" + side).style.width = hpPct + "%";
    q("hpwrap-" + side).className = "pvp-bar " + pvpBarClass(hpPct);
    q("hptext-" + side).textContent = `HP ${pvpFmt(s.hp)} / ${pvpFmt(maxHp[side])}`;
    if (shMax[side] > 0) {
      const p = Math.max(0, Math.min(100, 100 * s.sh / shMax[side]));
      q("shfill-" + side).style.width = p + "%"; q("shghost-" + side).style.width = p + "%";
      q("shtext-" + side).textContent = `🔷 ${dc("護盾","Shield")} ${pvpFmt(s.sh)} / ${pvpFmt(shMax[side])}`;
    }
    q("card-" + side).classList.toggle("dead", s.hp <= 0);
  };
  const setSide = (side, hp, sh, fx) => {
    const s = st[side]; hp = Math.max(0, hp); sh = Math.max(0, sh);
    const dSh = s.sh - sh, dHp = s.hp - hp;
    if (!skipped) {
      dSh >= 1 && float(side, "🔷 -" + pvpFmt(dSh), "shield");
      dSh <= -1 && float(side, "🔷 +" + pvpFmt(-dSh), "heal");
      dHp >= 1 && float(side, "-" + pvpFmt(dHp), fx && fx.crit ? "crit" : "dmg");
      dHp <= -1 && float(side, "+" + pvpFmt(-dHp), "heal");
      (dSh >= 1 || dHp >= 1) && hit(side);
    }
    s.hp = hp; s.sh = sh; render(side);
  };
  const active = (side, on) => { const c = q("card-" + side); c && c.classList.toggle("active", on); };
  render("a"); render("b");
  await sleep(300);
  for (const rnd of b.rounds) {
    if (!stage.isConnected) return;
    roundEl.textContent = "⚔️ " + dc(`第 ${rnd.round} / ${maxRounds} 回合`, `Round ${rnd.round} / ${maxRounds}`);
    logLine("── " + dc(`第 ${rnd.round} 回合`, `Round ${rnd.round}`) + " ──", "round");
    if (rnd.attackerShieldRegen) { setSide("a", st.a.hp, shMax.a); logLine(`🔷 ${A} ${dc("護盾重生，回滿","shield regenerated to full")} ${pvpFmt(shMax.a)}`, "heal"); await sleep(350); }
    if (rnd.defenderShieldRegen) { setSide("b", st.b.hp, shMax.b); logLine(`🔷 ${B} ${dc("護盾重生，回滿","shield regenerated to full")} ${pvpFmt(shMax.b)}`, "heal"); await sleep(350); }
    if (rnd.attackerHeal > 0) { setSide("a", rnd.attackerHpAfterHeal, st.a.sh); logLine(`💚 ${A} ${dc("回復","regenerated")} ${pvpFmt(rnd.attackerHeal)} ${dc("血量","HP")}`, "heal"); }
    if (rnd.defenderHeal > 0) { setSide("b", rnd.defenderHpAfterHeal, st.b.sh); logLine(`💚 ${B} ${dc("回復","regenerated")} ${pvpFmt(rnd.defenderHeal)} ${dc("血量","HP")}`, "heal"); }
    (rnd.attackerHeal > 0 || rnd.defenderHeal > 0) && await sleep(450);
    // 依實際出手順序播放（守方先手時要先播守方，否則快照血量會倒著套用）
    const playA = async () => {
    if (rnd.attackerFull) {
      active("a", true);
      const _pv = { aH: st.a.hp, aS: st.a.sh, dH: st.b.hp, dS: st.b.sh };
      robeNegateAnnounceLines(rnd.attackerFull.negAffixesApplied, B).forEach(t => logLine(t, "neg"));
      if (!skipped && spd() < 4) await Ni(rnd.attackerFull.rolls, rnd.attackerFull, idp + "-dice-a", null);
      robeNegateResultLines(rnd.attackerFull).forEach(t => logLine(t, "neg"));
      const t = rnd.turnAtk || { aH: rnd.attackerHpAfter, aS: rnd.attackerShieldAfter || 0, dH: rnd.defenderHpAfter, dS: rnd.defenderShieldAfter || 0 };
      if (rnd.defenderParryStrike > 0) {
        logLine(`🛡️⚔️ ${B} ${dc("盾反！回敬","parried — struck back for")} ${pvpFmt(rnd.defenderParryStrike)}`, "block");
        !skipped && await parryTriggerFx(idp + "-dice-b", (b.defenderFirst ? rnd : (b.rounds[b.rounds.indexOf(rnd) - 1] || {})).defenderFull, rnd.defenderParryStrike);
      }
      setSide("b", t.dH, t.dS, { crit: rnd.attackerRoll && rnd.attackerRoll.isCrit });
      setSide("a", t.aH, t.aS);
      const crit = rnd.attackerRoll && rnd.attackerRoll.isCrit && !rnd.defenderBlocked;
      logLine(rnd.defenderBlocked
        ? `🛡️ ${A}${dc("的攻擊被","'s attack was blocked by ")}${B}${dc("格擋！","!")}`
        : `⚔️ ${A} ${dc("造成","dealt")} ${pvpFmt(rnd.attackerRoll.damage)} ${dc("傷害","damage")}${crit ? " 💥" + dc("暴擊","Crit") : ""}`, rnd.defenderBlocked ? "block" : crit ? "crit" : "");
      try { pvpTurnLines(b, rnd, { side: "a", full: rnd.attackerFull, prev: _pv, snap: t }, cfg).forEach(x => logLine(x, "detail")); } catch (e) {}
      active("a", false);
      await sleep(250);
    }
    };
    const playB = async () => {
    if (rnd.defenderFull) {
      active("b", true);
      const _pv = { aH: st.a.hp, aS: st.a.sh, dH: st.b.hp, dS: st.b.sh };
      robeNegateAnnounceLines(rnd.defenderFull.negAffixesApplied, A).forEach(t => logLine(t, "neg"));
      if (!skipped && spd() < 4) await Ni(rnd.defenderFull.rolls, rnd.defenderFull, idp + "-dice-b", null);
      robeNegateResultLines(rnd.defenderFull).forEach(t => logLine(t, "neg"));
      const t = rnd.turnDef || { aH: rnd.attackerHpAfter, aS: rnd.attackerShieldAfter || 0, dH: rnd.defenderHpAfter, dS: rnd.defenderShieldAfter || 0 };
      if (rnd.attackerParryStrike > 0) {
        logLine(`🛡️⚔️ ${A} ${dc("盾反！回敬","parried — struck back for")} ${pvpFmt(rnd.attackerParryStrike)}`, "block");
        !skipped && await parryTriggerFx(idp + "-dice-a", (b.defenderFirst ? (b.rounds[b.rounds.indexOf(rnd) - 1] || {}) : rnd).attackerFull, rnd.attackerParryStrike);
      }
      setSide("a", t.aH, t.aS, { crit: rnd.defenderRoll && rnd.defenderRoll.isCrit });
      setSide("b", t.dH, t.dS);
      const crit = rnd.defenderRoll && rnd.defenderRoll.isCrit && !rnd.attackerBlocked;
      logLine(rnd.attackerBlocked
        ? `🛡️ ${B}${dc("的攻擊被","'s attack was blocked by ")}${A}${dc("格擋！","!")}`
        : `⚔️ ${B} ${dc("造成","dealt")} ${pvpFmt(rnd.defenderRoll.damage)} ${dc("傷害","damage")}${crit ? " 💥" + dc("暴擊","Crit") : ""}`, rnd.attackerBlocked ? "block" : crit ? "crit" : "");
      try { pvpTurnLines(b, rnd, { side: "b", full: rnd.defenderFull, prev: _pv, snap: t }, cfg).forEach(x => logLine(x, "detail")); } catch (e) {}
      active("b", false);
      await sleep(250);
    }
    };
    for (const play of (b.defenderFirst ? [playB, playA] : [playA, playB])) {
      await play();
      if (st.a.hp <= 0 || st.b.hp <= 0) break;
    }
    if (st.a.hp <= 0 || st.b.hp <= 0) break;
    await sleep(150);
  }
  // 對齊最終數值（跳過動畫時也一致）
  st.a.hp = b.attackerHpLeft; st.a.sh = b.attackerShieldLeft || 0; st.b.hp = b.defenderHpLeft; st.b.sh = b.defenderShieldLeft || 0;
  render("a"); render("b");
  const aWon = "attacker" === b.winner;
  const wc = q("card-" + (aWon ? "a" : "b")); wc && wc.classList.add("winner");
  q("result").innerHTML = pvpResultHtml(res, cfg);
  roundEl.textContent = "⚔️ " + dc("戰鬥結束","Battle over");
  skipBtn && (skipBtn.style.display = "none");
  await new Promise(r => setTimeout(r, skipped ? 500 : 1400));
}
/* ===== PVP 對戰畫面（競技場／切磋共用）— end ===== */
/* ===== PVP 畫面延伸（擂臺賽，沿用上面的 pvp-* 樣式）— start ===== */
function pvpEnsureStyleX(){
  pvpEnsureStyle();
  if (document.getElementById("pvpx-style")) return;
  const st = document.createElement("style"); st.id = "pvpx-style";
  st.textContent = `
.tn-round{margin-top:12px}
.tn-rtitle{font-family:Cinzel,serif;color:var(--gold-bright);font-size:14px;letter-spacing:.5px;margin-bottom:2px}
.tn-match{position:relative;border:1px solid var(--line);border-radius:14px;padding:10px 12px;margin:8px 0;background:linear-gradient(180deg,rgba(255,255,255,.03),rgba(0,0,0,.2))}
.tn-match.live{border-color:#e0554f;box-shadow:0 0 14px rgba(224,85,79,.35)}
.tn-match.final{border-color:var(--gold-bright);box-shadow:0 0 16px rgba(232,196,104,.25)}
.tn-mhead{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.tn-stage{font-family:Cinzel,serif;color:var(--gold-bright);font-size:13px;letter-spacing:.5px}
.tn-chip{font-size:11px;padding:1px 8px;border-radius:999px;border:1px solid var(--line);color:var(--muted);white-space:nowrap}
.tn-chip.live{color:#ff8080;border-color:#e0554f;animation:tn-pulse 1.4s ease-in-out infinite}
.tn-chip.go{color:var(--gold-bright);border-color:var(--gold-bright)}
.tn-duel{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center}
.tn-side{display:flex;align-items:center;gap:8px;min-width:0;padding:6px 8px;border:1px solid var(--line);border-radius:12px;background:rgba(0,0,0,.22);transition:opacity .3s,border-color .3s,box-shadow .3s}
.tn-side.b{flex-direction:row-reverse;text-align:right}
.tn-side.win{border-color:var(--gold-bright);box-shadow:0 0 12px rgba(232,196,104,.5)}
.tn-side.lose{opacity:.5;filter:grayscale(.5)}
.tn-side.me{outline:1px dashed var(--gold-bright);outline-offset:1px}
.tn-nm{min-width:0}
.tn-nm b{display:block;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tn-nm span{font-size:10px;color:var(--muted)}
.tn-foot{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px;font-size:12px;color:var(--muted)}
.tn-champ{margin:8px 0;font-size:15px}
.tn-watch{border-color:var(--gold-bright);margin-top:10px}
.pvp-roll{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;margin:8px 0;font-size:12px}
.pvp-roll .dice-roll-die{width:36px;height:36px;font-size:16px;border-radius:9px}
.pvp-roll .dice-roll-die.w{border-color:var(--gold-bright);color:var(--gold-bright);box-shadow:0 0 10px rgba(232,196,104,.5)}
@keyframes tn-pulse{0%,100%{box-shadow:0 0 0 rgba(224,85,79,0)}50%{box-shadow:0 0 10px rgba(224,85,79,.7)}}
`;
  document.head.appendChild(st);
}