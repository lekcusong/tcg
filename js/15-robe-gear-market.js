

/* ===== 魔法裝備 PVP 防具系統 Robe Gear — start ===== */
// v0.4：無等級／無強化；每件裝備只有一個隨機屬性（減傷／護盾／回血）＋元素＋（史詩才有）詞條
const ROBE_SLOTS = ["robe", "gloves", "boots"];
const ROBE_SLOT_META = {
  robe:   { labelZh: "魔法袍", labelEn: "Magic Robe", icon: "🥻" },
  gloves: { labelZh: "魔法手套", labelEn: "Magic Gloves", icon: "🧤" },
  boots:  { labelZh: "魔法鞋", labelEn: "Magic Boots", icon: "👢" }
};
const ROBE_QUALITY_META = {
  common: { weight: 65, labelZh: "普通", labelEn: "Common", color: "var(--common)", valueRange: [0.05, 0.10] },
  rare:   { weight: 25, labelZh: "稀有", labelEn: "Rare", color: "var(--rare)", valueRange: [0.08, 0.13] },
  epic:   { weight: 8,  labelZh: "史詩", labelEn: "Epic", color: "var(--legendary-a)", valueRange: [0.11, 0.16] },
  // 傳說：2 個不同元素（兩個元素都算套裝）＋ 2 個不同種無效詞條（數值 7～12%）
  legendary: { weight: 1, labelZh: "傳說", labelEn: "Legendary", color: "var(--gold-bright)", valueRange: [0.14, 0.19] }
};
const ROBE_STAT_TYPES = ["defPct", "shieldPct", "healPct"];
const ROBE_STAT_META = {
  defPct:    { labelZh: "減傷", labelEn: "Damage Reduction", icon: "🛡️" },
  shieldPct: { labelZh: "護盾", labelEn: "Shield", icon: "🔷" },
  healPct:   { labelZh: "回血", labelEn: "Regen", icon: "💚" }
};
const ROBE_DEF_PCT_CAP = 0.6;
const ROBE_CRAFT_COST_SHARD = 2;
const ROBE_AFFIX_META = {
  crit_negate:       { labelZh: "暴擊無效", labelEn: "Crit Negate", weight: 8 },
  parry_negate:      { labelZh: "盾反無效", labelEn: "Parry Negate", weight: 10 },
  block_negate:      { labelZh: "格擋無效", labelEn: "Block Negate", weight: 12 },
  lifesteal_negate:  { labelZh: "吸血無效", labelEn: "Lifesteal Negate", weight: 15 },
  pursuit_negate:    { labelZh: "追擊無效", labelEn: "Pursuit Negate", weight: 18 },
  thorns_negate:     { labelZh: "反擊無效", labelEn: "Thorns Negate", weight: 18 },
  luckychain_negate: { labelZh: "幸運連鎖無效", labelEn: "Lucky Chain Negate", weight: 19 }
};
const ROBE_AFFIX_VALUE_WEIGHTS = [
  { value: 0.05, weight: 30 }, { value: 0.06, weight: 24 }, { value: 0.07, weight: 18 },
  { value: 0.08, weight: 14 }, { value: 0.09, weight: 9 }, { value: 0.10, weight: 5 }
];
// 傳說裝備的詞條數值池（7～12%，低值機率高，沿用史詩的形狀整體 +2%）
const ROBE_AFFIX_VALUE_WEIGHTS_LEGENDARY = [
  { value: 0.07, weight: 30 }, { value: 0.08, weight: 24 }, { value: 0.09, weight: 18 },
  { value: 0.10, weight: 14 }, { value: 0.11, weight: 9 }, { value: 0.12, weight: 5 }
];
const ROBE_SET_BONUS = { fire: { defPct: 0.05 }, water: { healPct: 0.05 }, wind: { shieldPct: 0.05 }, earth: { defPct: 0.02, shieldPct: 0.02, healPct: 0.02 } };
function rollNegatable(rate, rawRate){
  const roll = Math.random();
  const triggered = rate > 0 && roll < rate;
  const negated = !triggered && rawRate > 0 && roll < rawRate;
  return { triggered, negated };
}
function robeNegateAnnounceLines(negAffixesApplied, owner){
  if (!negAffixesApplied) return [];
  const who = owner || dc("對手", "Opponent");
  return Object.keys(negAffixesApplied).filter(k => negAffixesApplied[k] > 0 && ROBE_AFFIX_META[k]).map(k =>
    dc(`🚫 ${who}的裝備發動：${ROBE_AFFIX_META[k].labelZh}！`, `🚫 ${who}'s gear activates: ${ROBE_AFFIX_META[k].labelEn}!`)
  );
}
function robeNegateResultLines(roll){
  if (!roll) return [];
  const lines = [];
  roll.critNegated && lines.push(dc("💢 暴擊被無效化！", "💢 Crit was negated!"));
  roll.blockNegated && lines.push(dc("💢 格擋被無效化！", "💢 Block was negated!"));
  roll.parryNegated && lines.push(dc("💢 盾反被無效化！", "💢 Parry was negated!"));
  roll.thornsNegated && lines.push(dc("💢 反擊被無效化！", "💢 Thorns was negated!"));
  roll.pursuitNegated && lines.push(dc("💢 追擊被無效化！", "💢 Pursuit was negated!"));
  roll.lifestealNegated && lines.push(dc("💢 吸血被無效化！", "💢 Lifesteal was negated!"));
  roll.rerollNegatedCount > 0 && lines.push(dc("💢 幸運連鎖被無效化！", "💢 Lucky Chain was negated!"));
  return lines;
}
// 減傷（v0.4）：傷害結算順序＝原始傷害 → 先扣護盾池 → 溢出部分 ×(1-減傷%)（最低1）→ 才扣血；減傷上限 ROBE_DEF_PCT_CAP。
// 回血：每回合開始時（雙方出手前）各自回復 最大血量×回血%，不超過血量上限。
function robeRandInRange(range){ return range[0] + Math.random() * (range[1] - range[0]); }
function robeWeightedPickKey(weightsObj){
  const total = Object.values(weightsObj).reduce((a,b)=>a+b,0);
  let r = Math.random() * total;
  for (const k of Object.keys(weightsObj)) { r -= weightsObj[k]; if (r < 0) return k; }
  return Object.keys(weightsObj)[0];
}
function robeWeightedPickValue(arr){
  const total = arr.reduce((a,b)=>a+b.weight,0);
  let r = Math.random() * total;
  for (const it of arr) { r -= it.weight; if (r < 0) return it.value; }
  return arr[0].value;
}
function rollRobeQuality(){
  const r = 100 * Math.random(), M = ROBE_QUALITY_META;
  const lg = M.legendary.weight, ep = lg + M.epic.weight, ra = ep + M.rare.weight;
  return r < lg ? "legendary" : r < ep ? "epic" : r < ra ? "rare" : "common";
}
function rollRobeAffix(valueWeights){
  const affixWeights = {};
  Object.keys(ROBE_AFFIX_META).forEach(k => { affixWeights[k] = ROBE_AFFIX_META[k].weight; });
  const type = robeWeightedPickKey(affixWeights);
  const value = robeWeightedPickValue(valueWeights || ROBE_AFFIX_VALUE_WEIGHTS);
  return { type, value };
}
// 不放回抽 n 個不同種詞條（依 ROBE_AFFIX_META 的權重）
function rollRobeAffixes(n, valueWeights){
  const pool = {};
  Object.keys(ROBE_AFFIX_META).forEach(k => { pool[k] = ROBE_AFFIX_META[k].weight; });
  const out = [];
  for (let i = 0; i < n && Object.keys(pool).length; i++) {
    const type = robeWeightedPickKey(pool);
    delete pool[type];
    out.push({ type, value: robeWeightedPickValue(valueWeights || ROBE_AFFIX_VALUE_WEIGHTS) });
  }
  return out;
}
// 不放回抽 n 個不同元素
function rollRobeElements(n){
  const pool = elementTypes.slice(), out = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return out;
}
// 一件裝備的元素／詞條清單（傳說＝2 個；其他品質＝1 個／0～1 個。舊資料沒有 elements／affixes 欄位也能讀）
function robeItemElements(item){
  if (!item) return [];
  if (Array.isArray(item.elements) && item.elements.length) return item.elements;
  return item.element ? [item.element] : [];
}
function robeItemAffixes(item){
  if (!item) return [];
  if (Array.isArray(item.affixes) && item.affixes.length) return item.affixes;
  return item.affix ? [item.affix] : [];
}
function robeElementIcons(item){
  return robeItemElements(item).map(e => (elementMeta[e] || {}).icon || "").join("");
}
function robeElementLabelsHtml(item){
  return robeItemElements(item).map(e => { const m = elementMeta[e] || {}; return `<span style="color:${m.color || "inherit"};">${m.icon || ""} ${dc(m.labelZh || "", m.labelEn || "")}</span>`; }).join(" + ");
}
function robeAffixLabelText(af){
  const m = ROBE_AFFIX_META[af.type];
  return `${dc(m.labelZh, m.labelEn)} +${Math.round(af.value * 1000) / 10}%`;
}
function robeHealText(r,nameA,nameB){let t="";r.attackerHeal>0&&(t+=` 💚${nameA}+${r.attackerHeal.toLocaleString()}`);r.defenderHeal>0&&(t+=` 💚${nameB}+${r.defenderHeal.toLocaleString()}`);return t}
function robeStatText(item){
  const sm = ROBE_STAT_META[item.statType] || ROBE_STAT_META.defPct;
  return `${sm.icon} ${dc(sm.labelZh, sm.labelEn)} ${(item.statValue*100).toFixed(1)}%`;
}
function createRobeGear(slot){
  const quality = rollRobeQuality(), meta = ROBE_QUALITY_META[quality];
  const elements = "legendary" === quality ? rollRobeElements(2) : [rollPetV2Element()];
  const statType = ROBE_STAT_TYPES[Math.floor(Math.random() * ROBE_STAT_TYPES.length)];
  const item = {
    id: ql(), slot, quality, element: elements[0], statType,
    statValue: Math.round(robeRandInRange(meta.valueRange) * 1000) / 1000,
    affix: "epic" === quality ? rollRobeAffix() : null,
    favorite: false, createdAt: Date.now()
  };
  if ("legendary" === quality) { item.elements = elements; item.affixes = rollRobeAffixes(2, ROBE_AFFIX_VALUE_WEIGHTS_LEGENDARY); }
  return item;
}
function bnRobeLoadouts(player){
  if (!Array.isArray(player.robeLoadouts) || player.robeLoadouts.length !== 6) player.robeLoadouts = [null,null,null,null,null,null];
  player.robeLoadouts = player.robeLoadouts.map(lo => {
    const cur = (lo && "object" == typeof lo) ? lo : { name: "", robe: null, gloves: null, boots: null };
    return {
      name: "string" == typeof cur.name ? cur.name.slice(0,12) : "",
      robe:   cur.robe   && player.robeGear[cur.robe]   ? cur.robe   : null,
      gloves: cur.gloves && player.robeGear[cur.gloves] ? cur.gloves : null,
      boots:  cur.boots  && player.robeGear[cur.boots]  ? cur.boots  : null
    };
  });
}
function bnRobeGear(player){
  player.robeGear && "object" == typeof player.robeGear && !Array.isArray(player.robeGear) || (player.robeGear = {});
  let legacyPurged = false;
  Object.keys(player.robeGear).forEach(id => {
    const item = player.robeGear[id];
    // 舊版（有等級／三圍）的裝備一律刪除
    if (!item || "object" != typeof item || "level" in item || "baseDef" in item || !ROBE_STAT_TYPES.includes(item.statType) || "number" != typeof item.statValue) {
      delete player.robeGear[id]; legacyPurged = true; return;
    }
    if (!ROBE_QUALITY_META[item.quality]) return; // 不認得的品質（來自較新版本）一律保持原樣，不降級、不清欄位
    elementTypes.includes(item.element) || (item.element = rollPetV2Element());
    ROBE_SLOTS.includes(item.slot) || (item.slot = "robe");
    "boolean" != typeof item.favorite && (item.favorite = false);
    if (item.affix && ("object" != typeof item.affix || !ROBE_AFFIX_META[item.affix.type])) item.affix = null;
    if ("epic" === item.quality && !item.affix) item.affix = rollRobeAffix();
    if ("epic" !== item.quality) item.affix = null;
    if ("legendary" === item.quality) {
      let els = [item.element].concat(Array.isArray(item.elements) ? item.elements : []).filter((e, i, a) => elementTypes.includes(e) && a.indexOf(e) === i);
      if (els.length < 2) els = els.concat(rollRobeElements(4).filter(e => !els.includes(e)));
      els = els.slice(0, 2);
      item.elements = els; item.element = els[0];
      let afs = (Array.isArray(item.affixes) ? item.affixes : []).filter((x, i, a) => x && "object" == typeof x && ROBE_AFFIX_META[x.type] && "number" == typeof x.value && a.findIndex(y => y && y.type === x.type) === i);
      if (afs.length < 2) afs = afs.concat(rollRobeAffixes(8, ROBE_AFFIX_VALUE_WEIGHTS_LEGENDARY).filter(x => !afs.some(y => y.type === x.type)));
      item.affixes = afs.slice(0, 2);
    } else { delete item.elements; delete item.affixes; }
  });
  player.equippedRobe && "object" == typeof player.equippedRobe || (player.equippedRobe = { robe: null, gloves: null, boots: null });
  if (legacyPurged) { player.equippedRobe = { robe: null, gloves: null, boots: null }; player.robeLoadouts = null; }
  ROBE_SLOTS.forEach(slot => {
    const id = player.equippedRobe[slot];
    player.equippedRobe[slot] = id && player.robeGear[id] && player.robeGear[id].slot === slot ? id : null;
  });
  if (legacyPurged) player.arenaRobe = null;
  if (player.arenaRobe && "object" == typeof player.arenaRobe) {
    ROBE_SLOTS.forEach(slot => {
      const id = player.arenaRobe[slot];
      player.arenaRobe[slot] = id && player.robeGear[id] && player.robeGear[id].slot === slot ? id : null;
    });
  } else player.arenaRobe = null;   // null＝防守裝備跟隨攻擊裝備
  bnRobeLoadouts(player);
  bnPvpPresets(player);
}
function resolveEquippedRobeGear(player){
  const out = { robe: null, gloves: null, boots: null };
  if (!player || !player.robeGear || !player.equippedRobe) return out;
  ROBE_SLOTS.forEach(slot => {
    const id = player.equippedRobe[slot];
    out[slot] = id ? player.robeGear[id] || null : null;
  });
  return out;
}
// 傳說裝備有 2 個元素，兩個都算；三件都是傳說（火水）時，火套與水套同時啟動
function isElementSetActive(equippedRobeGear, element){
  return ROBE_SLOTS.every(slot => equippedRobeGear[slot] && robeItemElements(equippedRobeGear[slot]).includes(element));
}
function robeActiveSetElements(equippedRobeGear){
  return elementTypes.filter(el => isElementSetActive(equippedRobeGear, el));
}
function robeActiveSetElement(equippedRobeGear){
  return robeActiveSetElements(equippedRobeGear)[0] || null;
}
function aggregateRobeAffixes(equippedRobeGear){
  const sums = {};
  ROBE_SLOTS.forEach(slot => {
    robeItemAffixes(equippedRobeGear[slot]).forEach(af => {
      if (af && af.type) sums[af.type] = (sums[af.type] || 0) + af.value;
    });
  });
  return sums;
}
function aggregateRobeStatPct(equippedRobeGear, statType){
  let total = 0;
  ROBE_SLOTS.forEach(slot => { const item = equippedRobeGear[slot]; if (item && item.statType === statType) total += (item.statValue || 0); });
  elementTypes.forEach(el => {
    if (isElementSetActive(equippedRobeGear, el)) {
      const sb = ROBE_SET_BONUS[el] || {};
      "number" == typeof sb[statType] && (total += sb[statType]);
    }
  });
  return total;
}
// ===== GM 可調：減傷／護盾／回血 倍率與開關；護盾破後再生（存在 arnSettings.robeMods，跟競技場設定同一個 key）=====
function robeModsSanitize(m){
  const num = (v, d, lo) => (typeof v === "number" && isFinite(v) && v >= lo) ? v : d;
  const one = (k, dm) => { const x = (m && m[k]) || {}; return { on: x.on !== false, mult: num(x.mult, dm, 0) }; };
  const rg = (m && m.regen) || {};
  return { def: one("def", 1), shield: one("shield", 2), heal: one("heal", 1), regen: { on: rg.on !== false, delay: Math.max(1, Math.round(num(rg.delay, 3, 1))) } };
}
let _robeModsFetchedAt = 0;
function robeModsCfg(){
  if (Date.now() - _robeModsFetchedAt > 60000) { _robeModsFetchedAt = Date.now(); try { arnLoadSettings(); } catch (e) {} }   // 背景刷新，讓沒開競技場分頁的戰鬥也吃到 GM 設定
  return robeModsSanitize(arnSettings.robeMods);
}
function robeModApply(pct, key){ const m = robeModsCfg()[key]; return (!m || !m.on) ? 0 : pct * m.mult; }
function aggregateRobeDefPct(equippedRobeGear){ return Math.min(robeModApply(aggregateRobeStatPct(equippedRobeGear, "defPct"), "def"), ROBE_DEF_PCT_CAP); }
function aggregateRobeShieldPct(equippedRobeGear){ return robeModApply(aggregateRobeStatPct(equippedRobeGear, "shieldPct"), "shield"); }
function aggregateRobeHealPct(equippedRobeGear){ return robeModApply(aggregateRobeStatPct(equippedRobeGear, "healPct"), "heal"); }
/* ===== PVP 攻守佈陣 Loadout（骰子＋魔法裝備合併設定）— start =====
   攻擊陣容：骰子＝diceSlots、裝備＝equippedRobe（跟原本「目前裝備」同一份，Boss／主動挑戰都用它）
   防守陣容：骰子＝arenaDiceSlots、裝備＝arenaRobe（null＝跟隨攻擊裝備，舊玩家行為不變）；被挑戰與擂臺賽用它
   攻守組合：pvpPresets 6 組，每組＝3 顆骰子＋袍／手套／鞋，可一鍵套用到攻擊或防守 */
const PVP_PRESET_COUNT = 6;
function pvpDefRobeIds(p){
  const a = p && p.arenaRobe;
  if (a && "object" == typeof a) {
    const out = {};
    ROBE_SLOTS.forEach(sl => { const id = a[sl]; out[sl] = id && p.robeGear && p.robeGear[id] && p.robeGear[id].slot === sl ? id : null; });
    return out;
  }
  return { ...((p && p.equippedRobe) || { robe: null, gloves: null, boots: null }) };
}
function pvpInUseRobeIds(p){
  const a = Object.values((p && p.equippedRobe) || {});
  const b = p && p.arenaRobe && "object" == typeof p.arenaRobe ? Object.values(p.arenaRobe) : [];
  return a.concat(b).filter(Boolean);
}
function bnPvpPresets(p){
  const src = Array.isArray(p.pvpPresets) ? p.pvpPresets : [], out = [];
  for (let i = 0; i < PVP_PRESET_COUNT; i++) {
    const lo = src[i];
    if (!lo || "object" != typeof lo) { out.push(null); continue; }
    const dice = [0, 1, 2].map(k => { const id = Array.isArray(lo.dice) ? lo.dice[k] : null; return id && p.dice && p.dice[id] ? id : null; });
    const g = {};
    ROBE_SLOTS.forEach(sl => { const id = lo[sl]; g[sl] = id && p.robeGear && p.robeGear[id] && p.robeGear[id].slot === sl ? id : null; });
    out.push({ name: String(lo.name || "").slice(0, 12), dice, robe: g.robe, gloves: g.gloves, boots: g.boots });
  }
  p.pvpPresets = out;
}
function pvpLaneDiceIds(p, lane){
  const a = "atk" === lane ? p.diceSlots : p.arenaDiceSlots, out = [null, null, null];
  (a || []).slice(0, 3).forEach((id, i) => { out[i] = id && p.dice && p.dice[id] ? id : null; });
  return out;
}
function pvpLaneGearIds(p, lane){
  if ("atk" !== lane) return pvpDefRobeIds(p);
  const o = {};
  ROBE_SLOTS.forEach(sl => { const id = p.equippedRobe && p.equippedRobe[sl]; o[sl] = id && p.robeGear && p.robeGear[id] ? id : null; });
  return o;
}
function pvpLaneEquipped(p, lane){
  const ids = pvpLaneGearIds(p, lane), out = {};
  ROBE_SLOTS.forEach(sl => { out[sl] = ids[sl] ? p.robeGear[ids[sl]] : null; });
  return out;
}
function pvpLaneStats(p, lane){
  const dice = pvpLaneDiceIds(p, lane).map(id => id ? p.dice[id] : null).filter(Boolean);
  const eq = pvpLaneEquipped(p, lane);
  const atk = dice.reduce((s, d) => s + getDiceTotalAttack(d), 0), hpDice = dice.reduce((s, d) => s + getDiceTotalHp(d), 0);
  const floor = (arnSettings && arnSettings.arenaHpBaseFloor) || 0, maxHp = Math.max(1, floor + hpDice);
  const defPct = aggregateRobeDefPct(eq), shieldPct = aggregateRobeShieldPct(eq), healPct = aggregateRobeHealPct(eq);
  let qc = null;
  if (dice.length >= 2) {
    const t = {}; dice.forEach(d => { t[d.quality] = (t[d.quality] || 0) + 1; });
    const kinds = Object.keys(t).length, mx = Math.max(...Object.values(t));
    qc = dice.length >= 3 && kinds >= 3 ? "straight" : mx >= 3 ? "triple" : 2 === mx ? "pair" : null;
  }
  return { n: dice.length, atk, hpDice, floor, maxHp, defPct, shieldPct, healPct, shield: Math.round(maxHp * shieldPct), sets: robeActiveSetElements(eq), affixes: aggregateRobeAffixes(eq), qc, gearN: ROBE_SLOTS.filter(sl => eq[sl]).length };
}
function pvpPlain(s){ return String(s == null ? "" : s).replace(/<[^>]*>/g, ""); }
function ploPct(v){ return (Math.round(v * 1000) / 10) + "%"; }
function pvpDieLabel(d){ const q = so[d.quality] || so.common; return `${dc(q.label, q.labelEn)} ${dc("攻", "ATK ")}${getDiceTotalAttack(d)} ${dc("血", "HP ")}${getDiceTotalHp(d)}`; }
function pvpGearLabel(it){
  const q = ROBE_QUALITY_META[it.quality] || ROBE_QUALITY_META.common;
  const afx = robeItemAffixes(it).filter(x => x && ROBE_AFFIX_META[x.type]).map(x => robeAffixLabelText(x)).join("/");
  return pvpPlain(`${dc(q.labelZh, q.labelEn)} ${robeElementIcons(it)} ${robeStatText(it)}${afx ? " · " + afx : ""}`);
}
function ploEnsureStyle(){
  if (typeof document === "undefined" || document.getElementById("plo-style")) return;
  const st = document.createElement("style"); st.id = "plo-style";
  st.textContent = `
.plo-lanes{display:grid;grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:12px;margin:10px 0}
.plo-lane{border:1px solid var(--lc,var(--line));border-radius:12px;padding:10px 12px;background:rgba(255,255,255,.02);box-shadow:inset 0 3px 0 var(--lc,var(--line))}
.plo-lane-t{font-size:16px;font-weight:700;color:var(--lc,var(--cream))}
.plo-lane-sub{font-size:11px;color:var(--muted);margin:2px 0 8px;line-height:1.5}
.plo-row-t{font-size:12px;color:var(--muted);margin:8px 0 4px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.plo-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.plo-tile{border:1px dashed var(--line);border-radius:8px;padding:5px 6px;min-width:0}
.plo-tile-h{font-size:10px;color:var(--muted)}
.plo-tile-main{font-size:11px;min-height:30px;display:flex;align-items:center;gap:4px;line-height:1.3;word-break:break-all;margin:2px 0 4px}
.plo-sw{width:12px;height:12px;border-radius:4px;display:inline-block;flex:none}
.plo-empty{color:var(--muted);opacity:.7}
.plo-sel{width:100%;max-width:100%;font-size:11px;padding:3px 2px;border-radius:6px;border:1px solid var(--line);background:var(--bg-void);color:var(--cream);text-overflow:ellipsis}
.plo-stats{display:flex;flex-wrap:wrap;gap:5px;margin-top:10px;padding-top:8px;border-top:1px solid var(--line)}
.plo-chip2{font-size:11px;border:1px solid var(--line);border-radius:999px;padding:2px 8px;white-space:nowrap}
.plo-chip2 b{color:var(--gold-bright)}
.plo-acts{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
.plo-follow{font-size:10px;color:var(--gold-bright);border:1px solid var(--gold);border-radius:999px;padding:1px 7px}
.plo-presets{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px}
.plo-preset{border:1px solid var(--line);border-radius:10px;padding:8px}
.plo-preset.has{border-color:var(--gold)}
.plo-preset input{width:100%;text-align:center;font-size:12px;padding:4px;margin-bottom:4px;border-radius:6px;border:1px solid var(--line);background:var(--bg-void);color:var(--cream)}
.plo-pchips{display:flex;justify-content:center;gap:3px;flex-wrap:wrap;margin:4px 0;min-height:22px}
.plo-pchip{min-width:26px;padding:1px 4px;border:1px solid var(--line);border-radius:6px;font-size:12px;text-align:center}
.plo-badges{min-height:18px;text-align:center;font-size:11px;margin-bottom:4px}
.plo-badge-a{color:#e0705a}.plo-badge-d{color:#5aa3e0}
.plo-pbtns{display:grid;grid-template-columns:1fr 1fr;gap:4px}
.plo-pbtns .btn{padding:4px 2px;font-size:11px}
`;
  document.head.appendChild(st);
}
function pvpDieSelectHtml(p, lane, idx){
  const cur = pvpLaneDiceIds(p, lane), other = pvpLaneDiceIds(p, "atk" === lane ? "def" : "atk");
  const rank = q => Object.keys(so).indexOf(q);
  const all = Object.values(p.dice || {}).sort((a, b) => (rank(b.quality) - rank(a.quality)) || (getDiceTotalAttack(b) - getDiceTotalAttack(a)));
  const opts = [`<option value="">${dc("— 空 —", "— Empty —")}</option>`].concat(all.map(d => {
    const at = cur.indexOf(d.id);
    const tag = (at >= 0 && at !== idx ? ` ｜${dc("本陣容第", "this lane #")}${at + 1}${dc("欄", "")}` : "") + (other.includes(d.id) ? ` ｜${dc("另一陣容", "other lane")}` : "") + (d.favorite ? " 💛" : "");
    return `<option value="${d.id}" ${cur[idx] === d.id ? "selected" : ""}>${Iu(pvpDieLabel(d) + tag)}</option>`;
  }));
  return `<select class="plo-sel" data-pvp-die="${lane}:${idx}">${opts.join("")}</select>`;
}
function pvpGearSelectHtml(p, lane, slot){
  const cur = pvpLaneGearIds(p, lane), other = pvpLaneGearIds(p, "atk" === lane ? "def" : "atk");
  const rank = q => ["common", "rare", "epic", "legendary"].indexOf(q);
  const all = Object.values(p.robeGear || {}).filter(it => it.slot === slot).sort((a, b) => (rank(b.quality) - rank(a.quality)) || ((b.statValue || 0) - (a.statValue || 0)));
  const opts = [`<option value="">${dc("— 空 —", "— Empty —")}</option>`].concat(all.map(it => {
    const tag = (other[slot] === it.id ? ` ｜${dc("另一陣容", "other lane")}` : "") + (it.favorite ? " 💛" : "");
    return `<option value="${it.id}" ${cur[slot] === it.id ? "selected" : ""}>${Iu(pvpGearLabel(it) + tag)}</option>`;
  }));
  return `<select class="plo-sel" data-pvp-gear="${lane}:${slot}">${opts.join("")}</select>`;
}
function pvpDieTileHtml(p, lane, idx){
  const id = pvpLaneDiceIds(p, lane)[idx], d = id && p.dice[id], q = d && (so[d.quality] || so.common);
  return `<div class="plo-tile" style="${d ? `border:1px solid ${q.color};box-shadow:0 0 6px ${q.color};` : ""}"><div class="plo-tile-h">🎲 ${dc("骰子", "Die")} ${idx + 1}</div><div class="plo-tile-main">${d ? `<span class="plo-sw" style="background:${q.color};"></span><span>${Iu(pvpDieLabel(d))}</span>` : `<span class="plo-empty">${dc("空", "Empty")}</span>`}</div>${pvpDieSelectHtml(p, lane, idx)}</div>`;
}
function pvpGearTileHtml(p, lane, slot){
  const id = pvpLaneGearIds(p, lane)[slot], it = id && p.robeGear[id], sm = ROBE_SLOT_META[slot], q = it && (ROBE_QUALITY_META[it.quality] || ROBE_QUALITY_META.common);
  return `<div class="plo-tile" style="${it ? `border:1px solid ${q.color};box-shadow:0 0 6px ${q.color};` : ""}"><div class="plo-tile-h">${sm.icon} ${dc(sm.labelZh, sm.labelEn)}</div><div class="plo-tile-main">${it ? `<span>${Iu(pvpGearLabel(it))}</span>` : `<span class="plo-empty">${dc("空", "Empty")}</span>`}</div>${pvpGearSelectHtml(p, lane, slot)}</div>`;
}
function pvpStatsHtml(p, lane){
  const s = pvpLaneStats(p, lane), chips = [];
  chips.push(`⚔️ ${dc("總攻擊", "ATK")} <b>${s.atk.toLocaleString()}</b>`);
  chips.push(`<span title="${Iu(dc(`骰子血量 ${s.hpDice.toLocaleString()} ＋ 競技場基礎 ${s.floor.toLocaleString()}`, `Dice HP ${s.hpDice.toLocaleString()} + Arena base ${s.floor.toLocaleString()}`))}">❤️ ${dc("血量", "HP")} <b>${s.maxHp.toLocaleString()}</b></span>`);
  chips.push(`🛡️ ${dc("減傷", "Red.")} <b>${ploPct(s.defPct)}</b>`);
  chips.push(`🔷 ${dc("護盾", "Shield")} <b>${s.shield.toLocaleString()}</b>`);
  chips.push(`💚 ${dc("回血", "Regen")} <b>${ploPct(s.healPct)}</b>${dc("/回合", "/rd")}`);
  s.sets.forEach(el => { const m = elementMeta[el]; chips.push(`<span style="color:${m.color};">${m.icon} ${dc(m.labelZh + "套", m.labelEn + " set")}</span>`); });
  if (s.qc) { const nm = { pair: dc("對子", "Pair"), triple: dc("豹子", "Triple"), straight: dc("順子", "Straight") }[s.qc]; chips.push(`🔷 ${dc("骰子品質", "Dice quality ")}${nm}${"undefined" != typeof Eo && Eo[s.qc] ? " ×" + Eo[s.qc] : ""}`); }
  Object.keys(s.affixes).filter(k => ROBE_AFFIX_META[k]).forEach(k => { chips.push(`✨ ${dc(ROBE_AFFIX_META[k].labelZh, ROBE_AFFIX_META[k].labelEn)} ${ploPct(s.affixes[k])}`); });
  return `<div class="plo-stats">${chips.map(c => `<span class="plo-chip2">${c}</span>`).join("")}</div>`;
}
function pvpLaneHtml(p, lane){
  const isAtk = "atk" === lane, color = isAtk ? "#e0705a" : "#5aa3e0";
  const follow = !isAtk && !(p.arenaRobe && "object" == typeof p.arenaRobe);
  const dice3 = [0, 1, 2].map(i => pvpDieTileHtml(p, lane, i)).join(""), gear3 = ROBE_SLOTS.map(sl => pvpGearTileHtml(p, lane, sl)).join("");
  const other = isAtk ? "def" : "atk";
  return `<div class="plo-lane" style="--lc:${color};">
    <div class="plo-lane-t">${isAtk ? "⚔️ " + dc("攻擊陣容", "Attack Lineup") : "🛡️ " + dc("防守陣容", "Defense Lineup")}</div>
    <div class="plo-lane-sub">${isAtk ? dc("你主動出手（競技場、金字塔挑戰、Boss）時使用。", "Used when YOU strike (Arena, Pyramid challenges, Boss).") : dc("別人挑戰你、以及擂臺賽時使用。", "Used when others challenge you, and in the Tournament.")}</div>
    <div class="plo-row-t">🎲 ${dc("骰子（最多 3 顆）", "Dice (up to 3)")}</div><div class="plo-tiles">${dice3}</div>
    <div class="plo-row-t">🥻 ${dc("魔法裝備", "Magic Gear")}${follow ? ` <span class="plo-follow">${dc("目前跟隨攻擊裝備", "following attack gear")}</span>` : ""}</div><div class="plo-tiles">${gear3}</div>
    ${pvpStatsHtml(p, lane)}
    <div class="plo-acts">
      <button class="btn small secondary" data-pvp-copy="${lane}:${other}">📋 ${isAtk ? dc("複製到防守", "Copy → Defense") : dc("複製到攻擊", "Copy → Attack")}</button>
      ${!isAtk && !follow ? `<button class="btn small secondary" data-pvp-follow="1">🔗 ${dc("裝備跟隨攻擊", "Gear follows attack")}</button>` : ""}
      <button class="btn small secondary" data-pvp-clear="${lane}">🧹 ${dc("全部卸下", "Clear all")}</button>
    </div>
  </div>`;
}
function pvpPresetHtml(p){
  const same = (a, b) => a.every((x, i) => (x || null) === (b[i] || null));
  const aD = pvpLaneDiceIds(p, "atk"), dD = pvpLaneDiceIds(p, "def"), aG = pvpLaneGearIds(p, "atk"), dG = pvpLaneGearIds(p, "def");
  return (p.pvpPresets || []).map((lo0, i) => {
    const lo = lo0 || { name: "", dice: [null, null, null], robe: null, gloves: null, boots: null };
    const has = lo.dice.some(Boolean) || ROBE_SLOTS.some(sl => lo[sl]);
    const dch = lo.dice.map(id => { const d = id && p.dice[id]; if (!d) return `<span class="plo-pchip" style="opacity:.4;border-style:dashed;">🎲</span>`; const q = so[d.quality] || so.common; return `<span class="plo-pchip" title="${Iu(pvpDieLabel(d))}" style="border-color:${q.color};box-shadow:0 0 4px ${q.color};">🎲</span>`; }).join("");
    const gch = ROBE_SLOTS.map(sl => { const it = lo[sl] && p.robeGear[lo[sl]], sm = ROBE_SLOT_META[sl]; if (!it) return `<span class="plo-pchip" style="opacity:.4;border-style:dashed;">${sm.icon}</span>`; const q = ROBE_QUALITY_META[it.quality] || ROBE_QUALITY_META.common; return `<span class="plo-pchip" title="${Iu(pvpGearLabel(it))}" style="border-color:${q.color};box-shadow:0 0 4px ${q.color};">${sm.icon}${robeElementIcons(it)}</span>`; }).join("");
    const lg = o => ROBE_SLOTS.map(sl => o[sl] || null);
    const isA = has && same(lo.dice, aD) && same(lg(lo), lg(aG)), isD = has && same(lo.dice, dD) && same(lg(lo), lg(dG));
    const badges = (isA ? `<span class="plo-badge-a">⚔️ ${dc("攻擊使用中", "Attack active")}</span> ` : "") + (isD ? `<span class="plo-badge-d">🛡️ ${dc("防守使用中", "Defense active")}</span>` : "");
    return `<div class="plo-preset ${has ? "has" : ""}">
      <input type="text" data-pvp-preset-name="${i}" value="${Iu(lo.name || "")}" placeholder="${dc("組合", "Combo")} ${i + 1}" maxlength="12" />
      <div class="plo-pchips">${dch}<span style="opacity:.4;">｜</span>${gch}</div>
      <div class="plo-badges">${badges}</div>
      <div class="plo-pbtns">
        <button class="btn small" data-pvp-preset-apply="${i}:atk" ${has ? "" : "disabled"}>⚔️ ${dc("套用攻擊", "Use: Atk")}</button>
        <button class="btn small" data-pvp-preset-apply="${i}:def" ${has ? "" : "disabled"}>🛡️ ${dc("套用防守", "Use: Def")}</button>
        <button class="btn small secondary" data-pvp-preset-save="${i}:atk">💾 ${dc("存自攻擊", "Save Atk")}</button>
        <button class="btn small secondary" data-pvp-preset-save="${i}:def">💾 ${dc("存自防守", "Save Def")}</button>
        ${has ? `<button class="btn small secondary" data-pvp-preset-clear="${i}" style="grid-column:1/-1;">🗑️ ${dc("清除", "Clear")}</button>` : ""}
      </div>
    </div>`;
  }).join("");
}
function pvpLoadoutPanelHtml(){
  const p = zl.player;
  if (!p) return "";
  ploEnsureStyle(); le(p); zo(p); bnRobeGear(p);
  const noDice = !Object.keys(p.dice || {}).length;
  return `<div class="panel plo-lo">
    <h3>🧭 ${dc("攻守佈陣", "Attack / Defense Lineups")}</h3>
    <p class="sub">${dc("骰子與魔法裝備在這裡一起設定：<b>攻擊陣容</b>是你主動出手時用的，<b>防守陣容</b>是別人挑戰你、以及擂臺賽用的，兩邊可以完全不同。下方可以把「骰子＋裝備」存成組合，一鍵套用到攻擊或防守。", "Set dice and magic gear together here. The <b>Attack Lineup</b> is used when you strike; the <b>Defense Lineup</b> is used when others challenge you and in the Tournament. They can differ. Save any dice + gear setup as a combo below and apply it to either side in one tap.")}</p>
    ${noDice ? `<div class="farm-upgrade-box" style="border-color:var(--danger);"><div class="farm-upgrade-line" style="color:var(--danger);">${dc("你還沒有任何骰子，先到「骰子」分頁抽一顆吧。", "You have no dice yet — draw one in the Dice tab first.")}</div></div>` : ""}
    <div class="plo-lanes">${pvpLaneHtml(p, "atk")}${pvpLaneHtml(p, "def")}</div>
    <h4 style="margin-top:16px;">📂 ${dc("攻守組合", "Combos")}</h4>
    <p class="sub">${dc(`最多 ${PVP_PRESET_COUNT} 組。儲存時，組合內的骰子與裝備會自動標記為最愛 💛（不會被拆解／回收）。`, `Up to ${PVP_PRESET_COUNT}. Saving auto-favorites the dice and gear in it 💛 (protected from dismantle/recycle).`)}</p>
    <div class="plo-presets">${pvpPresetHtml(p)}</div>
  </div>`;
}
// ---- 寫入：全部走 Wl（讀最新資料→改→CAS 寫回），操作會排隊依序執行，不會互相覆蓋 ----
let pvpChain = Promise.resolve();
function pvpMutate(fn, okMsg){
  const job = pvpChain.then(() => pvpMutateNow(fn, okMsg));
  pvpChain = job.catch(() => {});
  return job;
}
async function pvpMutateNow(fn, okMsg){
  if (!zl.nickname || !zl.player) return;
  try {
    let res = null;
    const updated = await Wl(zl.nickname, p => { res = null; le(p); zo(p); bnRobeGear(p); bnPvpPresets(p); res = fn(p) || null; });
    if (!updated) return void ac(dc("操作失敗，請重新整理後再試", "Failed — refresh and try again"));
    zl.player = updated;
    if (res && res.err) ac(res.err); else if (okMsg) ac(okMsg(res || {}));
    Eu();
  } catch (err) {
    console.error("[pvp loadout]", err); ac(dc("操作失敗，請重新整理後再試", "Failed — refresh and try again"));
  }
}
function pvpAssignDice(p, lane, arr){ const a = [0, 1, 2].map(i => arr[i] || null); "atk" === lane ? (p.diceSlots = a) : (p.arenaDiceSlots = a); }
function pvpAssignGear(p, lane, ids){
  const o = {}; ROBE_SLOTS.forEach(sl => { const id = ids[sl]; o[sl] = id && p.robeGear[id] && p.robeGear[id].slot === sl ? id : null; });
  "atk" === lane ? (p.equippedRobe = o) : (p.arenaRobe = o);
}
function pvpSetDie(lane, idx, id){
  return pvpMutate(p => {
    const arr = pvpLaneDiceIds(p, lane).slice();
    if (id) { if (!p.dice[id]) return { err: dc("找不到這顆骰子", "Die not found") }; arr.forEach((x, i) => { if (x === id) arr[i] = null; }); }
    arr[idx] = id || null; pvpAssignDice(p, lane, arr);
  });
}
function pvpSetGear(lane, slot, id){
  return pvpMutate(p => {
    if (id && !(p.robeGear[id] && p.robeGear[id].slot === slot)) return { err: dc("找不到這件裝備", "Gear not found") };
    const ids = { ...pvpLaneGearIds(p, lane) }; ids[slot] = id || null; pvpAssignGear(p, lane, ids);
  });
}
function pvpCopyLane(from, to){
  return pvpMutate(p => {
    const d = pvpLaneDiceIds(p, from), g = pvpLaneGearIds(p, from);
    if (!d.some(Boolean) && !ROBE_SLOTS.some(sl => g[sl])) return { err: dc("來源陣容是空的", "The source lineup is empty") };
    pvpAssignDice(p, to, d); pvpAssignGear(p, to, g);
  }, () => "atk" === to ? dc("已複製到攻擊陣容", "Copied to Attack Lineup") : dc("已複製到防守陣容", "Copied to Defense Lineup"));
}
function pvpClearLane(lane){
  return pvpMutate(p => { pvpAssignDice(p, lane, [null, null, null]); pvpAssignGear(p, lane, {}); }, () => dc("已全部卸下", "All unequipped"));
}
function pvpFollowGear(){
  return pvpMutate(p => { p.arenaRobe = null; }, () => dc("防守裝備改為跟隨攻擊裝備", "Defense gear now follows attack gear"));
}
function pvpPresetSave(idx, lane){
  const inp = document.querySelector(`[data-pvp-preset-name="${idx}"]`), typed = inp ? inp.value.slice(0, 12) : null;
  return pvpMutate(p => {
    const d = pvpLaneDiceIds(p, lane), g = pvpLaneGearIds(p, lane);
    if (!d.some(Boolean) && !ROBE_SLOTS.some(sl => g[sl])) return { err: dc("這個陣容是空的，沒有東西可以存", "This lineup is empty — nothing to save") };
    const cur = p.pvpPresets[idx] || { name: "" };
    p.pvpPresets[idx] = { name: null !== typed ? typed : (cur.name || ""), dice: d.slice(), robe: g.robe, gloves: g.gloves, boots: g.boots };
    d.forEach(id => { id && p.dice[id] && (p.dice[id].favorite = true); });
    ROBE_SLOTS.forEach(sl => { g[sl] && p.robeGear[g[sl]] && (p.robeGear[g[sl]].favorite = true); });
  }, () => dc("已儲存組合，裡面的骰子與裝備已標記為最愛 💛", "Combo saved — its dice and gear are now favorited 💛"));
}
function pvpPresetApply(idx, lane){
  return pvpMutate(p => {
    const lo = p.pvpPresets[idx];
    if (!lo || !(lo.dice.some(Boolean) || ROBE_SLOTS.some(sl => lo[sl]))) return { err: dc("這組是空的", "This combo is empty") };
    pvpAssignDice(p, lane, lo.dice); pvpAssignGear(p, lane, lo);
    return { name: lo.name || "" };
  }, r => { const label = r.name && r.name.trim() ? r.name.trim() : dc(`組合 ${idx + 1}`, `Combo ${idx + 1}`); return "atk" === lane ? dc(`「${label}」已套用到攻擊陣容`, `"${label}" applied to Attack Lineup`) : dc(`「${label}」已套用到防守陣容`, `"${label}" applied to Defense Lineup`); });
}
function pvpPresetRename(idx, name){
  return pvpMutate(p => {
    const cur = p.pvpPresets[idx];
    if (!cur || !(cur.dice.some(Boolean) || ROBE_SLOTS.some(sl => cur[sl]))) return;   // 空組合沒有東西可命名；名字會在「存自攻擊／防守」時一起存
    p.pvpPresets[idx] = { ...cur, name: String(name || "").slice(0, 12) };
  });
}
function pvpPresetClear(idx){
  return pvpMutate(p => { p.pvpPresets[idx] = null; }, () => dc("已清除組合", "Combo cleared"));
}
function pvpGotoWire(el){
  el.querySelectorAll("[data-pvp-goto]").forEach(b => { b.onclick = () => { zl.arnView = b.dataset.pvpGoto; Bu(); }; });
}
function pvpLoadoutWire(el){
  const q = s => el.querySelectorAll(s);
  q("[data-pvp-die]").forEach(sel => { sel.onchange = () => { const [lane, idx] = sel.dataset.pvpDie.split(":"); pvpSetDie(lane, parseInt(idx, 10), sel.value || null); }; });
  q("[data-pvp-gear]").forEach(sel => { sel.onchange = () => { const [lane, slot] = sel.dataset.pvpGear.split(":"); pvpSetGear(lane, slot, sel.value || null); }; });
  q("[data-pvp-copy]").forEach(b => { b.onclick = () => { const [f, t] = b.dataset.pvpCopy.split(":"); pvpCopyLane(f, t); }; });
  q("[data-pvp-clear]").forEach(b => { b.onclick = () => pvpClearLane(b.dataset.pvpClear); });
  q("[data-pvp-follow]").forEach(b => { b.onclick = () => pvpFollowGear(); });
  q("[data-pvp-preset-apply]").forEach(b => { b.onclick = () => { if (b.disabled) return; const [i, l] = b.dataset.pvpPresetApply.split(":"); pvpPresetApply(parseInt(i, 10), l); }; });
  q("[data-pvp-preset-save]").forEach(b => { b.onclick = () => { const [i, l] = b.dataset.pvpPresetSave.split(":"); pvpPresetSave(parseInt(i, 10), l); }; });
  q("[data-pvp-preset-clear]").forEach(b => { b.onclick = () => pvpPresetClear(parseInt(b.dataset.pvpPresetClear, 10)); });
  q("[data-pvp-preset-name]").forEach(inp => { inp.onchange = () => pvpPresetRename(parseInt(inp.dataset.pvpPresetName, 10), inp.value); });
  pvpGotoWire(el);
}
// 競技場・金字塔頁裡的「防守佈陣」只顯示摘要，要改請到「佈陣」分頁
function pvpDefenseSummaryHtml(p){
  ploEnsureStyle(); le(p); zo(p); bnRobeGear(p);
  const dIds = pvpLaneDiceIds(p, "def"), gIds = pvpLaneGearIds(p, "def");
  const dch = dIds.map(id => { const d = id && p.dice[id]; if (!d) return `<span class="plo-pchip" style="opacity:.4;border-style:dashed;">🎲</span>`; const q = so[d.quality] || so.common; return `<span class="plo-pchip" title="${Iu(pvpDieLabel(d))}" style="border-color:${q.color};box-shadow:0 0 4px ${q.color};">🎲</span>`; }).join("");
  const gch = ROBE_SLOTS.map(sl => { const it = gIds[sl] && p.robeGear[gIds[sl]], sm = ROBE_SLOT_META[sl]; if (!it) return `<span class="plo-pchip" style="opacity:.4;border-style:dashed;">${sm.icon}</span>`; const q = ROBE_QUALITY_META[it.quality] || ROBE_QUALITY_META.common; return `<span class="plo-pchip" title="${Iu(pvpGearLabel(it))}" style="border-color:${q.color};box-shadow:0 0 4px ${q.color};">${sm.icon}${robeElementIcons(it)}</span>`; }).join("");
  return `<div class="farm-upgrade-box" style="border-color:#5aa3e0;"><div class="farm-upgrade-line">🛡️ ${dc("別人挑戰你時，對手打的是這組防守陣容（骰子＋魔法裝備）：", "When challenged, opponents fight this Defense Lineup (dice + magic gear):")}</div><div class="plo-pchips" style="justify-content:flex-start;">${dch}<span style="opacity:.4;">｜</span>${gch}</div>${pvpStatsHtml(p, "def")}<div style="margin-top:8px;"><button class="btn small" data-arn-view="loadout">🧭 ${dc("前往佈陣修改", "Edit in Lineups")}</button></div></div>`;
}
/* ===== PVP 攻守佈陣 — end ===== */

// ===== 魔法裝備交易（只能用🧩神秘碎片；固定價；價格依品質鎖上下限，GM 可調；目前不收手續費）=====
const GEAR_MKT_DEFAULT_LIMITS = { common: [1, 4], rare: [2, 8], epic: [3, 15], legendary: [10, 40] };
const GEAR_MKT_LIMITS_KEY = "config:gear_market_limits";
let gearMktLimits = JSON.parse(JSON.stringify(GEAR_MKT_DEFAULT_LIMITS));
// 每位玩家同時最多掛賣幾件（只算 status 為 active 的單）
const GEAR_MKT_MAX_LISTINGS = 5;
// 近期成交記錄：全服所有人都看得到，保留（＝顯示）全服最近幾筆。預設 20。GM 可調 0～200。
const GEAR_MKT_RECENT_KEEP_DEFAULT = 20, GEAR_MKT_RECENT_KEEP_MAX = 200;
const GEAR_MKT_RECENT_KEEP_KEY = "config:gear_market_recent_keep";
let gearMktRecentKeep = GEAR_MKT_RECENT_KEEP_DEFAULT;
function gearMktKey(id){ return `gearmkt:${id}`; }
function gearMktSame(x, y){ return (x || "").toLowerCase() === (y || "").toLowerCase(); }
async function gearMktLoadLimits(){
  gearMktLimits = JSON.parse(JSON.stringify(GEAR_MKT_DEFAULT_LIMITS));
  try {
    const r = await a.get(GEAR_MKT_LIMITS_KEY);
    if (!r) return;
    const t = JSON.parse(r.value);
    ["common", "rare", "epic", "legendary"].forEach(q => {
      const v = t && t[q];
      if (Array.isArray(v) && v.length === 2 && Number.isInteger(v[0]) && Number.isInteger(v[1]) && v[0] >= 1 && v[1] >= v[0]) gearMktLimits[q] = [v[0], v[1]];
    });
  } catch (err) {}
}
async function gearMktSaveLimits(){ await a.set(GEAR_MKT_LIMITS_KEY, JSON.stringify(gearMktLimits)); }
function gearMktPriceCheck(item, price){
  const lim = gearMktLimits[item.quality];
  if (!lim || !Number.isInteger(price)) return { ok: false, lim: lim || null };
  return { ok: price >= lim[0] && price <= lim[1], lim };
}
async function gearMktListAll(){
  try {
    const rows = await a.listValues("gearmkt:");
    return rows.map(r => { try { return JSON.parse(r.value); } catch (err) { return null; } }).filter(L => L && L.id && L.item);
  } catch (err) { return []; }
}
// 冪等發放：同一個 doneKey 在玩家存檔裡只會生效一次，重試也不會重複發
async function gearMktGrantOnce(nick, doneKey, fn){
  const r = await Wl(nick, p => {
    (p.gearMktDone && "object" == typeof p.gearMktDone) || (p.gearMktDone = {});
    if (p.gearMktDone[doneKey]) return;
    fn(p);
    p.gearMktDone[doneKey] = 1;
    const ks = Object.keys(p.gearMktDone);
    if (ks.length > 400) ks.slice(0, ks.length - 400).forEach(k => { delete p.gearMktDone[k]; });
  });
  if (r && gearMktSame(nick, zl.nickname)) zl.player = r;
  return !!r;
}
function gearMktGiveItem(p, item){
  bnRobeGear(p);
  const it = JSON.parse(JSON.stringify(item));
  it.favorite = false;
  p.robeGear[it.id] = it;
}
async function gearMktMarkFlag(id, flag){
  try {
    await Vl(gearMktKey(id), t => {
      if (!t) return t;
      const s = JSON.parse(t);
      s[flag] = true;
      return JSON.stringify(s);
    }, "");
  } catch (err) {}
}
// 成交／取消後的收尾：買家拿裝備、賣家拿碎片、取消退回賣家。全部冪等，可以重複呼叫。
async function gearMktSettle(L){
  if (!L) return;
  if ("sold" === L.status) {
    if (!L.sellerNotified && L.buyer && L.seller) {
      try {
        const q = ROBE_QUALITY_META[L.item.quality] || ROBE_QUALITY_META.common, sm = ROBE_SLOT_META[L.item.slot] || ROBE_SLOT_META.robe;
        await wd(L.seller, L.buyer, "gear_sold", { id: "gearsold_" + L.id, price: L.price, gearNameZh: q.labelZh + sm.labelZh, gearNameEn: q.labelEn + " " + sm.labelEn });
        await gearMktMarkFlag(L.id, "sellerNotified");
      } catch (err) { console.error("[gearMktNotify]", err); }
    }
    if (!L.itemGranted && L.buyer && await gearMktGrantOnce(L.buyer, L.id + ":item", p => gearMktGiveItem(p, L.item))) {
      if (!L.buyerNotified && L.seller) {
        try {
          const q2 = ROBE_QUALITY_META[L.item.quality] || ROBE_QUALITY_META.common, sm2 = ROBE_SLOT_META[L.item.slot] || ROBE_SLOT_META.robe;
          gearMktSame(L.buyer, zl.nickname) && Uc.add("gearbought_" + L.id);
          await wd(L.buyer, L.seller, "gear_bought", { id: "gearbought_" + L.id, price: L.price, gearNameZh: q2.labelZh + sm2.labelZh, gearNameEn: q2.labelEn + " " + sm2.labelEn });
          await gearMktMarkFlag(L.id, "buyerNotified");
        } catch (err) { console.error("[gearMktNotifyBuyer]", err); }
      }
      await gearMktMarkFlag(L.id, "itemGranted");
    }
    if (!L.payoutGranted && await gearMktGrantOnce(L.seller, L.id + ":pay", p => { le(p); p.materials.mysteryShard = (p.materials.mysteryShard || 0) + L.price; })) await gearMktMarkFlag(L.id, "payoutGranted");
  } else if ("cancelled" === L.status && !L.itemReturned) {
    if (await gearMktGrantOnce(L.seller, L.id + ":ret", p => gearMktGiveItem(p, L.item))) {
      try {
        const q3 = ROBE_QUALITY_META[L.item.quality] || ROBE_QUALITY_META.common, sm3 = ROBE_SLOT_META[L.item.slot] || ROBE_SLOT_META.robe;
        gearMktSame(L.seller, zl.nickname) && Uc.add("gearret_" + L.id);
        await wd(L.seller, "system", "gear_returned", { id: "gearret_" + L.id, gearNameZh: q3.labelZh + sm3.labelZh, gearNameEn: q3.labelEn + " " + sm3.labelEn });
      } catch (err) { console.error("[gearMktNotifyReturn]", err); }
      await gearMktMarkFlag(L.id, "itemReturned");
    }
  }
}
async function gearMktLoadRecentKeep(){
  gearMktRecentKeep = GEAR_MKT_RECENT_KEEP_DEFAULT;
  try {
    const r = await a.get(GEAR_MKT_RECENT_KEEP_KEY);
    if (!r) return;
    const n = (JSON.parse(r.value) || {}).keep;
    if (Number.isInteger(n) && n >= 0 && n <= GEAR_MKT_RECENT_KEEP_MAX) gearMktRecentKeep = n;
  } catch (err) {}
}
async function gearMktSaveRecentKeep(){ await a.set(GEAR_MKT_RECENT_KEEP_KEY, JSON.stringify({ keep: gearMktRecentKeep })); }
// 算出「超過全服保留筆數」的成交紀錄（全服共用一份，所有人看到的一樣）。
// 只會挑已經完全結算（買家拿到裝備、賣家拿到碎片）的紀錄，還沒發放完的一律不動，避免有人少拿東西。
function gearMktTrimTargets(listings, keep){
  const done = listings.filter(L => "sold" === L.status && L.itemGranted && L.payoutGranted).sort((x, y) => (y.soldAt || 0) - (x.soldAt || 0));
  return done.slice(keep);
}
// GM 一鍵清洗：刪掉所有成交紀錄。還沒發放完的會先補發（冪等）、確認發完才刪；補發失敗的保留，不會有人少拿裝備或碎片。
// 掛賣中、已取消的單不受影響。
async function gearMktGmPurgeRecent(){
  const rows = await listAllValuesPaginated("gearmkt:");
  const sold = rows.map(r => { try { return JSON.parse(r.value); } catch (err) { return null; } }).filter(L => L && L.id && L.item && "sold" === L.status);
  let deleted = 0, skipped = 0;
  for (const L0 of sold) {
    try {
      let L = L0;
      if (!(L.itemGranted && L.payoutGranted)) {
        await gearMktSettle(L);
        const r = await Kl(gearMktKey(L.id));
        L = r && r.value ? JSON.parse(r.value) : null;
      }
      if (L && L.itemGranted && L.payoutGranted) { await a.delete(gearMktKey(L.id)); deleted++; }
      else skipped++;
    } catch (err) { console.error("[gearMktPurge]", L0.id, err); skipped++; }
  }
  return { deleted, skipped };
}
async function gearMktCreate(itemId, price){
  if (!zl.nickname || !zl.player) return false;
  await gearMktLoadLimits();
  {
    const myActive = (await gearMktListAll()).filter(L => "active" === L.status && gearMktSame(L.seller, zl.nickname)).length;
    if (myActive >= GEAR_MKT_MAX_LISTINGS) {
      ac(dc(`同時最多只能掛賣 ${GEAR_MKT_MAX_LISTINGS} 件裝備，請先取消或等賣出後再上架`, `You can only have ${GEAR_MKT_MAX_LISTINGS} listings at a time. Cancel one or wait for a sale first`));
      return false;
    }
  }
  let result = null, listing = null;
  const updated = await Wl(zl.nickname, p => {
    result = null; listing = null;
    bnRobeGear(p);
    const item = p.robeGear[itemId];
    if (!item) return void (result = { error: "missing" });
    if (pvpInUseRobeIds(p).includes(itemId)) return void (result = { error: "equipped" });
    if (item.favorite) return void (result = { error: "favorited" });
    const chk = gearMktPriceCheck(item, price);
    if (!chk.ok) return void (result = { error: "price", lim: chk.lim });
    delete p.robeGear[itemId];
    listing = { id: ql(), seller: p.nickname, item: JSON.parse(JSON.stringify(item)), price, createdAt: Date.now(), status: "active", buyer: null, itemGranted: false, payoutGranted: false, itemReturned: false };
    result = { ok: true };
  });
  if (!updated) { ac(dc("掛賣失敗，請重新整理後再試", "Listing failed, refresh and try again")); return false; }
  if (result && result.error) {
    const m = {
      missing: dc("找不到這件裝備", "Gear not found"),
      equipped: dc("裝備中的道具需先卸下才能掛賣", "Unequip this gear before listing it"),
      favorited: dc("已標記最愛的道具需先取消最愛才能掛賣", "Un-favorite this gear before listing it"),
      price: result.lim ? dc(`價格必須是 ${result.lim[0]}–${result.lim[1]} 之間的整數`, `Price must be a whole number between ${result.lim[0]} and ${result.lim[1]}`) : dc("價格無效", "Invalid price")
    };
    ac(m[result.error] || dc("掛賣失敗", "Listing failed"));
    return false;
  }
  zl.player = updated;
  try {
    await a.set(gearMktKey(listing.id), JSON.stringify(listing));
  } catch (err) {
    // 掛單寫入失敗：把裝備還給自己，避免裝備消失
    await Wl(zl.nickname, p => { gearMktGiveItem(p, listing.item); }).then(r => { r && (zl.player = r); }).catch(() => {});
    ac(dc("掛賣失敗，裝備已退回", "Listing failed, gear returned"));
    return false;
  }
  ac(dc(`✅ 已掛賣，定價 🧩${price}`, `✅ Listed for 🧩${price}`));
  return true;
}
async function gearMktBuy(listingId){
  if (!zl.nickname || !zl.player) return false;
  const me = zl.nickname, key = gearMktKey(listingId);
  let raw = null;
  try { raw = (await Kl(key)).value; } catch (err) { ac(dc("讀取失敗，請稍後再試", "Read failed, try again")); return false; }
  if (!raw) { ac(dc("這件裝備已不存在", "This listing no longer exists")); return false; }
  const L0 = JSON.parse(raw);
  if ("active" !== L0.status) { ac(dc("這件裝備已被買走或下架", "Already sold or withdrawn")); return false; }
  if (gearMktSame(L0.seller, me)) { ac(dc("不能買自己的掛賣", "You can't buy your own listing")); return false; }
  const price = L0.price;
  if (!Number.isInteger(price) || price < 1) { ac(dc("價格資料異常", "Invalid price data")); return false; }
  // 1) 先扣碎片（託管）
  let pay = null;
  const paid = await Wl(me, p => {
    pay = null; le(p);
    if ((p.materials.mysteryShard || 0) < price) return void (pay = { error: "shard" });
    p.materials.mysteryShard -= price;
    pay = { ok: true };
  });
  if (!paid) { ac(dc("購買失敗，請重新整理後再試", "Purchase failed, refresh and try again")); return false; }
  if (pay && pay.error) { ac(dc(`神秘碎片不足，需要 🧩${price}`, `Not enough Mystery Shards - need 🧩${price}`)); return false; }
  zl.player = paid;
  // 2) 用 CAS 搶單，只會有一個買家成功
  let claimed = false, unknown = false;
  try {
    await Vl(key, t => {
      claimed = false;
      if (!t) return t;
      const s = JSON.parse(t);
      if ("active" !== s.status || gearMktSame(s.seller, me)) return t;
      s.status = "sold"; s.buyer = me; s.soldAt = Date.now();
      claimed = true;
      return JSON.stringify(s);
    }, "");
  } catch (err) {
    // 網路錯誤：重讀一次確認是不是其實成功了
    try {
      const r2 = await Kl(key);
      const s2 = r2.value ? JSON.parse(r2.value) : null;
      claimed = !!(s2 && "sold" === s2.status && gearMktSame(s2.buyer, me));
    } catch (err2) { unknown = true; }
  }
  if (unknown) { ac(dc("網路異常，無法確認交易結果，請重新整理頁面查看", "Network problem - couldn't confirm the trade, please refresh")); return false; }
  if (!claimed) {
    const back = await Wl(me, p => { le(p); p.materials.mysteryShard = (p.materials.mysteryShard || 0) + price; });
    back && (zl.player = back, shardNotify(me, price, "gear_refund"));
    ac(dc("被別人搶先買走了，碎片已退回", "Someone bought it first - your shards were refunded"));
    return false;
  }
  // 3) 買家拿裝備、賣家拿碎片
  try {
    const raw2 = (await Kl(key)).value;
    await gearMktSettle(JSON.parse(raw2));
  } catch (err) { console.error("[gearMktSettle] will retry on next page open", err); }
  ac(dc(`🛒 購買成功！花費 🧩${price}`, `🛒 Purchased for 🧩${price}!`));
  return true;
}
async function gearMktCancel(listingId){
  if (!zl.nickname) return false;
  const me = zl.nickname, key = gearMktKey(listingId);
  let ok = false;
  try {
    await Vl(key, t => {
      ok = false;
      if (!t) return t;
      const s = JSON.parse(t);
      if ("active" !== s.status || !gearMktSame(s.seller, me)) return t;
      s.status = "cancelled"; s.cancelledAt = Date.now();
      ok = true;
      return JSON.stringify(s);
    }, "");
  } catch (err) { ac(dc("取消失敗，請稍後再試", "Cancel failed, try again")); return false; }
  if (!ok) { ac(dc("已被買走或已取消", "Already sold or cancelled")); return false; }
  try { await gearMktSettle(JSON.parse((await Kl(key)).value)); } catch (err) { console.error("[gearMktSettle]", err); }
  ac(dc("已取消掛賣，裝備已退回", "Listing cancelled, gear returned"));
  return true;
}
function gearMktItemHtml(item){
  const meta = ROBE_QUALITY_META[item.quality] || ROBE_QUALITY_META.common, sm = ROBE_SLOT_META[item.slot] || ROBE_SLOT_META.robe;
  const af = robeItemAffixes(item).filter(x => x && ROBE_AFFIX_META[x.type]).map(x => `<div style="font-size:11px;color:var(--muted);">${robeAffixLabelText(x)}</div>`).join("");
  return `<div class="left"><div class="icon-box">${sm.icon}</div><div class="meta"><div style="color:${meta.color};">${robeElementIcons(item)} ${dc(meta.labelZh + sm.labelZh, meta.labelEn + " " + sm.labelEn)}</div><div style="font-size:11px;color:var(--muted);">${dc("屬性：","Element: ")}${robeElementLabelsHtml(item)} ・ ${dc("品質：","Quality: ")}<span style="color:${meta.color};">${dc(meta.labelZh,meta.labelEn)}</span></div><div>${robeStatText(item)}</div>${af}</div></div>`;
}
function gearMktOptionLabel(item){
  const meta = ROBE_QUALITY_META[item.quality] || ROBE_QUALITY_META.common, sm = ROBE_SLOT_META[item.slot] || ROBE_SLOT_META.robe;
  const af = robeItemAffixes(item).filter(x => x && ROBE_AFFIX_META[x.type]).map(x => " · " + dc(ROBE_AFFIX_META[x.type].labelZh, ROBE_AFFIX_META[x.type].labelEn)).join("");
  return `${sm.icon}${robeElementIcons(item)} ${dc(meta.labelZh + sm.labelZh, meta.labelEn + " " + sm.labelEn)} · ${robeStatText(item)}${af}`;
}
function gearMktLimitText(){
  return ["common", "rare", "epic", "legendary"].map(q => `${dc(ROBE_QUALITY_META[q].labelZh, ROBE_QUALITY_META[q].labelEn)} ${gearMktLimits[q][0]}–${gearMktLimits[q][1]}`).join(dc("、", ", "));
}
async function renderGearMarketInto(root, tabsHtml, wireTabs){
  const scrollY = window.scrollY;
  await gearMktLoadLimits();
  await gearMktLoadRecentKeep();
  const me = zl.nickname, p = zl.player;
  bnRobeGear(p); le(p);
  let listings = await gearMktListAll();
  const pending = listings.filter(L => (gearMktSame(L.seller, me) || gearMktSame(L.buyer, me)) && (("sold" === L.status && (!L.itemGranted || !L.payoutGranted)) || ("cancelled" === L.status && !L.itemReturned)));
  if (pending.length) {
    for (const L of pending) { try { await gearMktSettle(L); } catch (err) { console.error("[gearMktSettle]", L.id, err); } }
    listings = await gearMktListAll();
  }
  // 清掉 3 天前已完全結算的紀錄（盡力而為）
  const cutoff = Date.now() - 3 * 864e5;
  listings.forEach(L => {
    const doneAt = L.soldAt || L.cancelledAt || 0;
    if (doneAt && doneAt < cutoff && (("sold" === L.status && L.itemGranted && L.payoutGranted) || ("cancelled" === L.status && L.itemReturned))) a.delete(gearMktKey(L.id)).catch(() => {});
  });
  // 超過保留筆數的舊成交紀錄（盡力而為，失敗下次開頁再清）
  gearMktTrimTargets(listings, gearMktRecentKeep).forEach(L => { a.delete(gearMktKey(L.id)).catch(() => {}); });
  const shards = zl.player.materials.mysteryShard || 0;
  const flt = zl.gearMktFilter = zl.gearMktFilter || { quality: "all", slot: "all", element: "all" };
  const active = listings.filter(L => "active" === L.status);
  const mine = active.filter(L => gearMktSame(L.seller, me)).sort((x, y) => y.createdAt - x.createdAt);
  const others = active.filter(L => !gearMktSame(L.seller, me) && ("all" === flt.quality || L.item.quality === flt.quality) && ("all" === flt.slot || L.item.slot === flt.slot) && ("all" === (flt.element || "all") || robeItemElements(L.item).includes(flt.element))).sort((x, y) => x.price - y.price || y.createdAt - x.createdAt);
  const recent = listings.filter(L => "sold" === L.status).sort((x, y) => (y.soldAt || 0) - (x.soldAt || 0)).slice(0, gearMktRecentKeep);
  const equippedIds = pvpInUseRobeIds(p);
  const blockedInUse = Object.values(p.robeGear).filter(it => equippedIds.includes(it.id) && !it.favorite);
  const sellable = Object.values(p.robeGear).filter(it => !equippedIds.includes(it.id) && !it.favorite).sort((x, y) => (["legendary", "epic", "rare", "common"].indexOf(x.quality) - ["legendary", "epic", "rare", "common"].indexOf(y.quality)) || (y.createdAt || 0) - (x.createdAt || 0));
  const opt = (v, cur, label) => `<option value="${v}" ${cur === v ? "selected" : ""}>${label}</option>`;
  let html = tabsHtml;
  html += `<div class="panel"><h2>⚔️ ${dc("魔法裝備交易", "Magic Gear Trading")}</h2>
    <p class="sub">${dc("只能用 🧩神秘碎片 買賣魔法袍、手套、鞋，固定價格，先到先得。", "Magic robes, gloves and boots can only be traded for 🧩Mystery Shards, at fixed prices, first come first served.")}</p>
    <p class="sub" style="color:var(--gold-bright);">${dc("價格範圍（🧩）：", "Price range (🧩): ")}${gearMktLimitText()}</p>
    <div class="stat-row"><div class="stat">🧩 ${dc("我的神秘碎片", "My Mystery Shards")}: <b>${shards}</b></div></div></div>`;
  const listingFull = mine.length >= GEAR_MKT_MAX_LISTINGS;
  html += `<div class="panel"><h2>${dc("掛賣裝備", "List Gear")}（${mine.length}/${GEAR_MKT_MAX_LISTINGS}）</h2>`;
  if (blockedInUse.length) {
    const where = it => { const atk = p.equippedRobe && p.equippedRobe[it.slot] === it.id, def = p.arenaRobe && "object" == typeof p.arenaRobe && p.arenaRobe[it.slot] === it.id; return atk && def ? dc("攻擊＋防守陣容", "attack + defense lineup") : def ? dc("競技場防守佈陣", "Arena defense lineup") : dc("攻擊陣容", "attack lineup"); };
    html += `<p class="sub" style="color:var(--gold-bright);">${dc("以下裝備正在使用中，所以不在可掛賣清單裡（到「魔法裝備」頁卸下後即可掛賣）：", "These gear pieces are in use, so they're not in the list (unequip them on the Magic Gear page first): ")}${blockedInUse.map(it => Iu(gearMktOptionLabel(it)) + "〔" + where(it) + "〕").join("、")}</p>`;
  }
  if (listingFull) html += `<p class="empty-note">${dc(`你已經掛滿 ${GEAR_MKT_MAX_LISTINGS} 件了（同時最多 ${GEAR_MKT_MAX_LISTINGS} 件），請先取消或等賣出後再上架`, `You've reached the limit of ${GEAR_MKT_MAX_LISTINGS} listings at a time. Cancel one or wait for a sale before listing more`)}</p>`;
  else if (!sellable.length) html += `<p class="empty-note">${dc("沒有可掛賣的裝備（裝備中與已標記最愛的不能掛賣）", "No gear available to list (equipped or favorited gear can't be listed)")}</p>`;
  else {
    html += `<div class="form-row"><div style="flex:1;min-width:220px;"><label>${dc("選擇裝備", "Gear")}</label><select id="gearmkt-item-select" style="width:100%;">${sellable.map(it => `<option value="${it.id}" data-q="${it.quality}">${Iu(gearMktOptionLabel(it))}</option>`).join("")}</select></div>
      <div><label id="gearmkt-price-label">${dc("定價（🧩）", "Price (🧩)")}</label><input type="number" id="gearmkt-price-input" min="1" step="1" style="width:100px;" /></div>
      <button class="btn" id="gearmkt-list-btn">${dc("掛賣", "List")}</button></div>`;
  }
  html += `</div>`;
  html += `<div class="panel"><h2>${dc("我的掛賣", "My Listings")}（${mine.length}/${GEAR_MKT_MAX_LISTINGS}）</h2>`;
  html += mine.length ? mine.map(L => `<div class="listing">${gearMktItemHtml(L.item)}<div class="right"><span class="price">🧩 ${L.price}</span><button class="btn small secondary" data-gearmkt-cancel="${L.id}">${dc("取消", "Cancel")}</button></div></div>`).join("") : `<p class="empty-note">${dc("目前沒有掛賣中的裝備", "You have nothing listed")}</p>`;
  html += `</div>`;
  html += `<div class="panel"><h2>${dc("裝備市場", "Gear Market")}（${others.length}）</h2>
    <div class="filter-row"><select id="gearmkt-filter-quality">${opt("all", flt.quality, dc("全部品質", "All qualities"))}${["common", "rare", "epic", "legendary"].map(q => opt(q, flt.quality, dc(ROBE_QUALITY_META[q].labelZh, ROBE_QUALITY_META[q].labelEn))).join("")}</select>
    <select id="gearmkt-filter-slot">${opt("all", flt.slot, dc("全部部位", "All slots"))}${ROBE_SLOTS.map(s => opt(s, flt.slot, dc(ROBE_SLOT_META[s].labelZh, ROBE_SLOT_META[s].labelEn))).join("")}</select>
    <select id="gearmkt-filter-element">${opt("all", flt.element || "all", dc("全部屬性", "All Elements"))}${elementTypes.map(el => opt(el, flt.element || "all", elementMeta[el].icon + " " + dc(elementMeta[el].labelZh, elementMeta[el].labelEn))).join("")}</select></div>`;
  html += others.length ? others.map(L => `<div class="listing">${gearMktItemHtml(L.item)}<div class="right"><div class="who">${dc("賣家", "Seller")}: ${Iu(L.seller)}</div><span class="price">🧩 ${L.price}</span><button class="btn small" data-gearmkt-buy="${L.id}" ${shards < L.price ? "disabled" : ""}>${dc("購買", "Buy")}</button></div></div>`).join("") : `<p class="empty-note">${dc("市場上目前沒有符合條件的裝備", "No matching gear on the market")}</p>`;
  html += `</div>`;
  if (recent.length) {
    html += `<div class="panel"><h2>${dc("近期成交", "Recent Trades")}</h2>` + recent.map(L => {
      const iSold = gearMktSame(L.seller, me), iBought = gearMktSame(L.buyer, me);
      return `<div class="listing">${gearMktItemHtml(L.item)}<div class="right"><div class="who">${dc("賣家", "Seller")}: ${Iu(L.seller)}${iSold ? " ★" : ""} → ${dc("買家", "Buyer")}: ${Iu(L.buyer)}${iBought ? " ★" : ""}</div><span class="timer">${iSold ? dc("✅ 已售出", "✅ Sold") : iBought ? dc("🛒 已購入", "🛒 Bought") : dc("🤝 成交", "🤝 Traded")}</span><span class="price">🧩 ${L.price}</span></div></div>`;
    }).join("") + `</div>`;
  }
  if (Yg()) {
    const row = q => `<div class="form-row"><div style="width:70px;">${dc(ROBE_QUALITY_META[q].labelZh, ROBE_QUALITY_META[q].labelEn)}</div><div><label>${dc("最低", "Min")}</label><input type="number" id="gearmkt-gm-min-${q}" min="1" step="1" value="${gearMktLimits[q][0]}" style="width:80px;" /></div><div><label>${dc("最高", "Max")}</label><input type="number" id="gearmkt-gm-max-${q}" min="1" step="1" value="${gearMktLimits[q][1]}" style="width:80px;" /></div></div>`;
    html += `<div class="panel"><h2>⚙️ ${dc("魔法裝備交易價格範圍（GM）", "Magic Gear Price Range (GM)")}</h2>
      <p class="sub">${dc("依品質限制掛賣價格（神秘碎片），即時對所有玩家生效。已掛出的單不會被改動。", "Limit listing prices (Mystery Shards) by quality, effective immediately. Existing listings are not changed.")}</p>
      ${["common", "rare", "epic", "legendary"].map(row).join("")}
      <div class="form-row"><button class="btn small" id="gearmkt-gm-save-btn">${dc("儲存", "Save")}</button><button class="btn small secondary" id="gearmkt-gm-reset-btn">${dc("還原預設值", "Reset to Default")}</button></div></div>`;
  }
  if (Yg()) {
    const soldTotal = listings.filter(L => "sold" === L.status).length;
    html += `<div class="panel"><h2>🧹 ${dc("近期成交記錄管理（GM）", "Recent Trades Records (GM)")}</h2>
      <p class="sub">${dc(`目前資料庫有 ${soldTotal} 筆成交記錄。「保留筆數」是全服所有玩家都看得到、也最多留存的最近成交筆數，超過的舊記錄會自動清掉。`, `There are ${soldTotal} trade record(s) stored. "Keep" is the number of most recent trades kept and shown to everyone; older ones are cleared automatically.`)}</p>
      <div class="form-row"><div><label>${dc("全服保留最近幾筆（0～200）", "Trades kept server-wide (0–200)")}</label><input type="number" id="gearmkt-gm-keep-input" min="0" max="${GEAR_MKT_RECENT_KEEP_MAX}" step="1" value="${gearMktRecentKeep}" style="width:100px;" /></div>
      <button class="btn small" id="gearmkt-gm-keep-save-btn">${dc("儲存", "Save")}</button></div>
      <div class="form-row"><button class="btn small secondary" id="gearmkt-gm-purge-btn" style="border-color:var(--danger);color:var(--danger);">🗑️ ${dc("清洗全部成交記錄", "Clear all trade records")}</button></div>
      <p class="sub" style="font-size:12px;">${dc("還沒發放完的成交（買家沒拿到裝備或賣家沒拿到碎片）不會被直接刪掉，清洗時會先補發。掛賣中的裝備不受影響。", "Unsettled trades (buyer hasn't received the gear, or seller hasn't received the shards) are never dropped; they are settled first. Active listings are not affected.")}</p></div>`;
  }
  root.innerHTML = html;
  window.scrollTo(0, scrollY);
  wireTabs();
  // ---- 事件 ----
  const busy = (btn, fn) => async () => { if (btn.disabled) return; btn.disabled = true; try { await fn(); } catch (err) { console.error("[gearmkt]", err); ac(dc("操作失敗，請稍後再試", "Action failed, try again")); } finally { Bu(); } };
  const sel = document.getElementById("gearmkt-item-select"), priceInput = document.getElementById("gearmkt-price-input");
  const syncPrice = () => {
    if (!sel || !priceInput) return;
    const lim = gearMktLimits[sel.options[sel.selectedIndex].dataset.q];
    if (!lim) return;
    priceInput.min = lim[0]; priceInput.max = lim[1]; priceInput.placeholder = `${lim[0]}–${lim[1]}`;
    const cur = parseInt(priceInput.value, 10);
    if (!cur || cur < lim[0] || cur > lim[1]) priceInput.value = lim[0];
    const lab = document.getElementById("gearmkt-price-label");
    lab && (lab.textContent = dc(`定價（🧩 ${lim[0]}–${lim[1]}）`, `Price (🧩 ${lim[0]}–${lim[1]})`));
  };
  if (sel) { sel.onchange = syncPrice; syncPrice(); }
  const listBtn = document.getElementById("gearmkt-list-btn");
  listBtn && (listBtn.onclick = busy(listBtn, async () => { await gearMktCreate(sel.value, parseInt(priceInput.value, 10)); }));
  root.querySelectorAll("[data-gearmkt-buy]").forEach(btn => { btn.onclick = busy(btn, async () => { await gearMktBuy(btn.dataset.gearmktBuy); }); });
  root.querySelectorAll("[data-gearmkt-cancel]").forEach(btn => { btn.onclick = busy(btn, async () => { await gearMktCancel(btn.dataset.gearmktCancel); }); });
  const fq = document.getElementById("gearmkt-filter-quality"), fs = document.getElementById("gearmkt-filter-slot");
  fq && (fq.onchange = () => { zl.gearMktFilter.quality = fq.value; Bu(); });
  fs && (fs.onchange = () => { zl.gearMktFilter.slot = fs.value; Bu(); });
  const fe = document.getElementById("gearmkt-filter-element");
  fe && (fe.onchange = () => { zl.gearMktFilter.element = fe.value; Bu(); });
  const gsave = document.getElementById("gearmkt-gm-save-btn");
  gsave && (gsave.onclick = async () => {
    const next = {};
    for (const q of ["common", "rare", "epic", "legendary"]) {
      const lo = parseInt(document.getElementById(`gearmkt-gm-min-${q}`).value, 10), hi = parseInt(document.getElementById(`gearmkt-gm-max-${q}`).value, 10);
      if (!(lo >= 1) || !(hi >= lo)) return void ac(dc("最低價至少 1，且最高價不能低於最低價", "Min must be at least 1 and max can't be below min"));
      next[q] = [lo, hi];
    }
    gearMktLimits = next;
    await gearMktSaveLimits();
    ac(dc("價格範圍已更新，即時生效 ⚡", "Price range updated, effective immediately ⚡"));
    Bu();
  });
  const greset = document.getElementById("gearmkt-gm-reset-btn");
  greset && (greset.onclick = async () => {
    gearMktLimits = JSON.parse(JSON.stringify(GEAR_MKT_DEFAULT_LIMITS));
    await gearMktSaveLimits();
    ac(dc("已還原預設價格範圍", "Reverted to default price range"));
    Bu();
  });
  const keepSave = document.getElementById("gearmkt-gm-keep-save-btn");
  keepSave && (keepSave.onclick = async () => {
    if (keepSave.disabled) return;
    const raw = (document.getElementById("gearmkt-gm-keep-input").value || "").trim();
    const n = /^\d+$/.test(raw) ? parseInt(raw, 10) : NaN;
    if (!(n >= 0 && n <= GEAR_MKT_RECENT_KEEP_MAX)) return void ac(dc(`請輸入 0 到 ${GEAR_MKT_RECENT_KEEP_MAX} 之間的整數`, `Enter a whole number from 0 to ${GEAR_MKT_RECENT_KEEP_MAX}`));
    keepSave.disabled = true;
    try {
      gearMktRecentKeep = n;
      await gearMktSaveRecentKeep();
      const trimmed = gearMktTrimTargets(await gearMktListAll(), n);
      await Promise.all(trimmed.map(L => a.delete(gearMktKey(L.id)).catch(() => {})));
      ac(dc(`已設定每位玩家保留最近 ${n} 筆${trimmed.length ? `，清掉 ${trimmed.length} 筆舊記錄` : ""}`, `Each player now keeps their latest ${n} trade(s)${trimmed.length ? `; ${trimmed.length} old record(s) removed` : ""}`));
    } catch (err) { console.error("[gearmkt keep]", err); ac(dc("儲存失敗，請稍後再試", "Save failed, try again")); }
    finally { Bu(); }
  });
  const purgeBtn = document.getElementById("gearmkt-gm-purge-btn");
  purgeBtn && (purgeBtn.onclick = async () => {
    if (purgeBtn.disabled) return;
    if (!await ic(dc("確定要清洗全部魔法裝備的成交記錄嗎？此動作無法復原。掛賣中的裝備不受影響，還沒發放完的成交會先補發再清。", "Clear ALL magic gear trade records? This can't be undone. Active listings are not affected, and unsettled trades are settled first."))) return;
    purgeBtn.disabled = true;
    try {
      const res = await gearMktGmPurgeRecent();
      ac(dc(`🗑️ 已清洗 ${res.deleted} 筆成交記錄${res.skipped ? `，${res.skipped} 筆因發放未完成而保留` : ""}`, `🗑️ Cleared ${res.deleted} trade record(s)${res.skipped ? `; ${res.skipped} kept because settlement is incomplete` : ""}`));
    } catch (err) { console.error("[gearmkt purge]", err); ac(dc("清洗失敗，請稍後再試", "Clear failed, try again")); }
    finally { Bu(); }
  });
}

async function craftRandomRobeGear(){
  if (!zl.nickname || !zl.player) return;
  if (((zl.player.materials && zl.player.materials.mysteryShard) || 0) < ROBE_CRAFT_COST_SHARD)
    return void ac(dc(`神秘碎片不足，製作需要 🧩${ROBE_CRAFT_COST_SHARD}`, `Not enough Mystery Shards - crafting needs 🧩${ROBE_CRAFT_COST_SHARD}`));
  let result = null;
  const updated = await Wl(zl.nickname, p => {
    bnRobeGear(p);
    p.materials || (p.materials = {});
    if ((p.materials.mysteryShard || 0) < ROBE_CRAFT_COST_SHARD) return void (result = { error: "shard" });
    p.materials.mysteryShard -= ROBE_CRAFT_COST_SHARD;
    const slot = ROBE_SLOTS[Math.floor(Math.random() * ROBE_SLOTS.length)];
    const item = createRobeGear(slot);
    p.robeGear[item.id] = item;
    result = { item };
  });
  if (!updated) return void ac(dc("製作失敗，請重新整理後再試", "Crafting failed, refresh and try again"));
  if (result && "shard" === result.error) return void ac(dc("神秘碎片不足", "Not enough Mystery Shards"));
  zl.player = updated;
  const meta = ROBE_QUALITY_META[result.item.quality], slotMeta = ROBE_SLOT_META[result.item.slot], elMeta = { icon: robeElementIcons(result.item) };
  ac(dc(`${elMeta.icon} 開出一件${meta.labelZh}${slotMeta.labelZh}：${robeStatText(result.item)}`, `${elMeta.icon} Got a ${meta.labelEn} ${slotMeta.labelEn}: ${robeStatText(result.item)}`));
  Eu();
  if ("legendary" === result.item.quality) robeLegendaryCongrats(result.item);
}
// 開到傳說魔法裝備：彈窗恭喜
function robeLegendaryCongrats(item){
  try {
    const old = document.getElementById("robe-legend-congrats"); if (old) old.remove();
    const meta = ROBE_QUALITY_META[item.quality], slotMeta = ROBE_SLOT_META[item.slot];
    const affixes = (item.affixes || []).map(a => `<div>${robeAffixLabelText(a)}</div>`).join("");
    const ov = document.createElement("div");
    ov.id = "robe-legend-congrats";
    ov.style.cssText = "position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.65);padding:16px;";
    ov.innerHTML = `<div style="max-width:340px;width:100%;text-align:center;padding:22px 18px;border-radius:16px;background:linear-gradient(160deg,#2a2140,#171126);border:2px solid #e8c468;box-shadow:0 0 28px rgba(232,196,104,.6);color:#fff;">
      <div style="font-size:44px;line-height:1.1;">🎉✨🎉</div>
      <h2 style="margin:8px 0 4px;color:#ffd978;">${dc("恭喜！開到傳說裝備！", "Congratulations! Legendary gear!")}</h2>
      <div style="font-size:16px;margin:6px 0;color:#e8c468;font-weight:700;">${robeElementIcons(item)} ${dc(meta.labelZh + slotMeta.labelZh, meta.labelEn + " " + slotMeta.labelEn)}</div>
      <div style="font-size:13px;line-height:1.7;opacity:.95;">${robeStatText(item)}${affixes}</div>
      <button type="button" class="btn" id="robe-legend-congrats-ok" style="margin-top:14px;min-width:120px;">${dc("太棒了！", "Awesome!")}</button>
    </div>`;
    const close = () => ov.remove();
    ov.addEventListener("click", e => { if (e.target === ov) close(); });
    document.body.appendChild(ov);
    ov.querySelector("#robe-legend-congrats-ok").onclick = close;
  } catch (e) { console.warn("legendary congrats failed", e); }
}
async function toggleRobeFavorite(itemId){
  if (!zl.nickname || !zl.player) return;
  const updated = await Wl(zl.nickname, p => {
    bnRobeGear(p);
    const item = p.robeGear[itemId];
    if (item) item.favorite = !item.favorite;
  });
  if (updated) { zl.player = updated; Eu(); }
}
async function equipRobeGear(itemId, slot){
  if (!zl.nickname || !zl.player) return;
  const updated = await Wl(zl.nickname, p => {
    bnRobeGear(p);
    const item = p.robeGear[itemId];
    if (item && item.slot === slot) p.equippedRobe[slot] = itemId;
  });
  if (!updated) return void ac(dc("裝備失敗，請重新整理後再試", "Equip failed, refresh and try again"));
  zl.player = updated;
  Eu();
}
async function unequipRobeGear(slot){
  if (!zl.nickname || !zl.player) return;
  const updated = await Wl(zl.nickname, p => { bnRobeGear(p); p.equippedRobe[slot] = null; });
  if (updated) { zl.player = updated; Eu(); }
}
// 回收魔法裝備可得的神秘碎片（依品質）。維持 ≤ 拍賣最低價，才不會有低買回收的套利；
// 合成一件 🧩2，期望回收約 1.35，合成再回收不會無限賺。
const ROBE_RECYCLE_SHARDS = { common: 1, rare: 2, epic: 3, legendary: 10 };
function robeRecycleShards(item){ return ROBE_RECYCLE_SHARDS[item && item.quality] || ROBE_RECYCLE_SHARDS.common; }
async function recycleRobeGear(itemId){
  if (!zl.nickname || !zl.player) return;
  const cur = (zl.player.robeGear || {})[itemId];
  if (cur && "common" !== cur.quality) {
    const q = ROBE_QUALITY_META[cur.quality] || ROBE_QUALITY_META.common, sm = ROBE_SLOT_META[cur.slot] || ROBE_SLOT_META.robe, n = robeRecycleShards(cur);
    if (!confirm(dc(`確定要回收「${q.labelZh}${sm.labelZh}」，換得 🧩${n} 神秘碎片？此動作無法復原。`, `Recycle "${q.labelEn} ${sm.labelEn}" for 🧩${n} Mystery Shards? This cannot be undone.`))) return;
  }
  let result = null;
  const updated = await Wl(zl.nickname, p => {
    bnRobeGear(p);
    const item = p.robeGear[itemId];
    if (!item) return void (result = { error: "missing" });
    if (pvpInUseRobeIds(p).includes(itemId)) return void (result = { error: "equipped" });
    if (item.favorite) return void (result = { error: "favorited" });
    const gain = robeRecycleShards(item);
    p.materials || (p.materials = {});
    p.materials.mysteryShard = (p.materials.mysteryShard || 0) + gain;
    delete p.robeGear[itemId];
    result = { ok: true, gain };
  });
  if (!updated) return void ac(dc("回收失敗，請重新整理後再試", "Recycle failed, refresh and try again"));
  if (result && result.error) {
    if ("equipped" === result.error) ac(dc("裝備中的道具需先卸下才能回收", "Unequip this item before recycling it"));
    else if ("favorited" === result.error) ac(dc("已標記最愛的道具需先取消最愛才能回收", "Un-favorite this item before recycling it"));
    return;
  }
  zl.player = updated;
  shardNotify(zl.nickname, (result && result.gain) || 1, "gear_recycle");
  ac(dc(`回收成功！獲得 🧩神秘碎片+${result && result.gain || 1}`, `Recycled! +🧩${result && result.gain || 1} Mystery Shard`));
  Eu();
}
// 一鍵回收：回收「目前篩選條件下」所有可回收的魔法裝備（排除裝備中、已標記最愛）。回收前先彈窗確認，寫入時再檢查一次。
function robeBulkRecyclable(p){
  const rf = (zl.robeGearFilter = zl.robeGearFilter || { element: "all", quality: "all" });
  const eq = pvpInUseRobeIds(p);
  return Object.values(p.robeGear || {}).filter(it => !it.favorite && !eq.includes(it.id) && ("all" === rf.element || robeItemElements(it).includes(rf.element)) && ("all" === rf.quality || it.quality === rf.quality));
}
let robeBulkRecycling = false;
async function recycleAllRobeGear(){
  if (robeBulkRecycling || !zl.nickname || !zl.player) return;
  bnRobeGear(zl.player);
  const list = robeBulkRecyclable(zl.player);
  if (!list.length) return void ac(dc("沒有可回收的裝備（裝備中與已標記最愛的不會回收）", "Nothing to recycle (equipped and favorited gear are skipped)"));
  const ids = list.map(it => it.id);
  const total = list.reduce((a, it) => a + robeRecycleShards(it), 0);
  const cnt = {}; list.forEach(it => { cnt[it.quality] = (cnt[it.quality] || 0) + 1; });
  const detail = ["legendary", "epic", "rare", "common"].filter(q => cnt[q]).map(q => `${ROBE_QUALITY_META[q].labelZh} ×${cnt[q]}`).join("、");
  const detailEn = ["legendary", "epic", "rare", "common"].filter(q => cnt[q]).map(q => `${ROBE_QUALITY_META[q].labelEn} ×${cnt[q]}`).join(", ");
  const hasEpic = !!(cnt.epic || cnt.legendary), hasRare = !!cnt.rare;
  if (!confirm(dc(`⚠️ 一鍵回收\n\n將回收 ${list.length} 件魔法裝備（${detail}），共換得 🧩${total} 神秘碎片。${hasEpic ? "\n\n其中包含史詩裝備！" : hasRare ? "\n\n其中包含稀有裝備。" : ""}\n裝備中與已標記最愛的不會被回收。\n此動作無法復原，確定要回收嗎？`, `⚠️ Recycle All\n\nThis will recycle ${list.length} piece(s) of gear (${detailEn}) for 🧩${total} Mystery Shards.${hasEpic ? "\n\nIncludes EPIC gear!" : hasRare ? "\n\nIncludes RARE gear." : ""}\nEquipped and favorited gear are NOT recycled.\nThis cannot be undone. Continue?`))) return;
  robeBulkRecycling = true;
  try {
    let result = null;
    const updated = await Wl(zl.nickname, p => {
      result = null;
      bnRobeGear(p);
      const eq = pvpInUseRobeIds(p);
      let gain = 0, n = 0;
      ids.forEach(id => {
        const it = p.robeGear[id];
        if (!it || it.favorite || eq.includes(id)) return;
        gain += robeRecycleShards(it); n++;
        delete p.robeGear[id];
      });
      if (!n) return void (result = { error: "none" });
      p.materials || (p.materials = {});
      p.materials.mysteryShard = (p.materials.mysteryShard || 0) + gain;
      result = { ok: true, gain, n };
    });
    if (!updated) return void ac(dc("回收失敗，請重新整理後再試", "Recycle failed, refresh and try again"));
    if (!result || result.error) return void ac(dc("沒有可回收的裝備", "Nothing to recycle"));
    zl.player = updated;
    shardNotify(zl.nickname, result.gain, "gear_recycle");
    ac(dc(`一鍵回收完成！回收 ${result.n} 件，獲得 🧩神秘碎片+${result.gain}`, `Recycled ${result.n} piece(s)! +🧩${result.gain} Mystery Shards`));
    Eu();
  } finally { robeBulkRecycling = false; }
}
async function applyRobeLoadout(loadoutIndex){
  if (!zl.nickname || !zl.player) return;
  let result = null;
  const updated = await Wl(zl.nickname, p => {
    result = null;
    bnRobeGear(p);
    const lo = p.robeLoadouts[loadoutIndex];
    if (!lo || !ROBE_SLOTS.some(slot => lo[slot] && p.robeGear[lo[slot]])) return void (result = { error: "missing" });
    ROBE_SLOTS.forEach(slot => { p.equippedRobe[slot] = lo[slot] && p.robeGear[lo[slot]] && p.robeGear[lo[slot]].slot === slot ? lo[slot] : null; });
    result = { ok: true, name: lo.name || "" };
  });
  if (!updated) return void ac(dc("套用失敗，請重新整理後再試", "Failed to apply, refresh and try again"));
  if (result && result.error) return void ac(dc("此組合是空的", "This loadout is empty"));
  zl.player = updated;
  ac(dc("已套用裝備組合", "Loadout applied"));
  Eu();
}
async function saveRobeLoadout(loadoutIndex, name){
  if (!zl.nickname || !zl.player) return;
  let result = null;
  const updated = await Wl(zl.nickname, p => {
    result = null;
    bnRobeGear(p);
    if (!ROBE_SLOTS.some(slot => p.equippedRobe[slot])) return void (result = { error: "none" });
    const cur = p.robeLoadouts[loadoutIndex] || { name: "" };
    p.robeLoadouts[loadoutIndex] = { name: ("string" == typeof name ? name : (cur.name || "")).slice(0,12), robe: p.equippedRobe.robe, gloves: p.equippedRobe.gloves, boots: p.equippedRobe.boots };
    ROBE_SLOTS.forEach(slot => { const gid = p.equippedRobe[slot]; if (gid && p.robeGear[gid]) p.robeGear[gid].favorite = true; });
    result = { ok: true };
  });
  if (!updated) return void ac(dc("儲存失敗，請重新整理後再試", "Save failed, refresh and try again"));
  if (result && "none" === result.error) return void ac(dc("目前沒有裝備任何魔法裝備，無法儲存", "No magic gear equipped right now - nothing to save"));
  zl.player = updated;
  ac(dc("已儲存目前裝備為組合，組合內的裝備已自動標記為最愛 💛", "Current gear saved as loadout - gear in it is now marked as favorite 💛"));
  Eu();
}
async function renameRobeLoadout(loadoutIndex, name){
  if (!zl.nickname || !zl.player) return;
  const updated = await Wl(zl.nickname, p => {
    bnRobeGear(p);
    const cur = p.robeLoadouts[loadoutIndex] || { name: "", robe: null, gloves: null, boots: null };
    p.robeLoadouts[loadoutIndex] = { name: (name || "").slice(0,12), robe: cur.robe, gloves: cur.gloves, boots: cur.boots };
  });
  if (!updated) return void ac(dc("命名失敗，請重新整理後再試", "Rename failed, refresh and try again"));
  zl.player = updated;
  ac(dc("已更新組合名稱", "Loadout name updated"));
  Eu();
}
async function clearRobeLoadout(loadoutIndex){
  if (!zl.nickname || !zl.player) return;
  const updated = await Wl(zl.nickname, p => {
    bnRobeGear(p);
    const cur = p.robeLoadouts[loadoutIndex] || { name: "" };
    p.robeLoadouts[loadoutIndex] = { name: cur.name || "", robe: null, gloves: null, boots: null };
  });
  if (!updated) return void ac(dc("清除失敗，請重新整理後再試", "Clear failed, refresh and try again"));
  zl.player = updated;
  ac(dc("已清除組合內容", "Loadout cleared"));
  Eu();
}
async function randomRobeLoadout(){
  if (!zl.nickname || !zl.player) return;
  let result = null;
  const updated = await Wl(zl.nickname, p => {
    result = null;
    bnRobeGear(p);
    const valid = [];
    p.robeLoadouts.forEach((lo, idx) => { lo && ROBE_SLOTS.some(slot => lo[slot] && p.robeGear[lo[slot]]) && valid.push(idx); });
    if (!valid.length) return void (result = { error: "none" });
    const pick = valid[Math.floor(Math.random() * valid.length)], lo = p.robeLoadouts[pick];
    ROBE_SLOTS.forEach(slot => { p.equippedRobe[slot] = lo[slot] && p.robeGear[lo[slot]] && p.robeGear[lo[slot]].slot === slot ? lo[slot] : null; });
    result = { ok: true, pick, name: lo.name || "" };
  });
  if (!updated) return void ac(dc("切換失敗，請重新整理後再試", "Switch failed, refresh and try again"));
  if (result && "none" === result.error) return void ac(dc("尚未儲存任何裝備組合", "No loadouts saved yet"));
  zl.player = updated;
  const label = result.name && result.name.trim() ? result.name.trim() : dc(`組合 ${result.pick + 1}`, `Combo ${result.pick + 1}`);
  ac(dc(`🎲 已隨機切換至「${label}」`, `🎲 Randomly switched to "${label}"`));
  Eu();
}
// 這件裝備是否正被「防守陣容」(arenaRobe) 使用（攻擊陣容 equippedRobe 沒穿也算）
function robeInDefenseLane(p, item){
  if (!p || !item || !p.arenaRobe || "object" != typeof p.arenaRobe) return false;
  return p.arenaRobe[item.slot] === item.id;
}
function robeGearCardHtml(item, equippedId){
  const meta = ROBE_QUALITY_META[item.quality] || ROBE_QUALITY_META.common, slotMeta = ROBE_SLOT_META[item.slot];
  const affixHtml = robeItemAffixes(item).filter(x => x && ROBE_AFFIX_META[x.type]).map(x => `<div style="font-size:11px;color:var(--muted);background:var(--bg-void);border:1px solid var(--line);border-radius:6px;padding:2px 6px;display:inline-block;margin-top:4px;margin-right:4px;">${robeAffixLabelText(x)}</div>`).join("");
  const isEquipped = equippedId === item.id;
  const equipBtn = isEquipped
    ? `<button class="btn small secondary" data-robe-unequip="${item.slot}">${dc("卸下","Unequip")}</button>`
    : `<button class="btn small" data-robe-equip="${item.id}" data-robe-equip-slot="${item.slot}">${dc("裝備","Equip")}</button>`;
  const fav = !!item.favorite;
  const inDef = !isEquipped && robeInDefenseLane(zl.player, item);
  const defBtn = inDef ? `<button class="btn small secondary" data-robe-def-unequip="${item.slot}" title="${dc("從競技場防守佈陣卸下","Remove from Arena defense lineup")}">${dc("🛡️ 卸下防守","🛡️ Remove from defense")}</button>` : "";
  const defNote = inDef ? `<div style="font-size:11px;color:var(--gold-bright);margin-top:4px;">${dc("🛡️ 正在「競技場防守佈陣」使用中：需先卸下防守，才能掛賣／回收","🛡️ Used in your Arena defense lineup: remove it first to list or recycle")}</div>` : "";
  const favBtn = `<button class="btn small ${fav?"":"secondary"}" data-robe-toggle-favorite="${item.id}" title="${dc("設為最愛","Toggle favorite")}" style="${fav?"border-color:var(--gold-bright);color:var(--gold-bright);":""}">${fav?dc("💛 最愛","💛 Favorite"):dc("🤍 最愛","🤍 Favorite")}</button>`;
  const recycleDisabled = isEquipped || inDef || fav;
  const recycleBtn = `<button class="btn small secondary" data-robe-recycle="${item.id}" ${recycleDisabled?"disabled":""}>${dc("回收","Recycle")} → 🧩${robeRecycleShards(item)}</button>`;
  return `<div class="farm-upgrade-box" style="${isEquipped?"border:2px solid var(--gold-bright);":fav?"border:1px solid var(--gold-bright);box-shadow:0 0 8px rgba(232,196,104,.3);":""}">
    <div class="farm-upgrade-title" style="color:${meta.color};">${fav?"💛 ":""}${slotMeta.icon} ${robeElementIcons(item)} ${dc(meta.labelZh+slotMeta.labelZh, meta.labelEn+" "+slotMeta.labelEn)}</div>
    <div style="font-size:11px;color:var(--muted);margin-top:2px;">${dc("屬性：","Element: ")}${robeElementLabelsHtml(item)} ・ ${dc("品質：","Quality: ")}<span style="color:${meta.color};">${dc(meta.labelZh,meta.labelEn)}</span></div>
    <div style="font-size:13px;margin-top:2px;">${robeStatText(item)}</div>
    ${affixHtml}
    ${defNote}
    <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;">${equipBtn}${favBtn}${defBtn}${recycleBtn}</div>
  </div>`;
}
function robeLoadoutsHtml(player){
  const loadouts = Array.isArray(player.robeLoadouts) ? player.robeLoadouts : [];
  const gear = player.robeGear || {};
  const cells = loadouts.map((lo0, i) => {
    const lo = lo0 && "object" == typeof lo0 ? lo0 : { name: "", robe: null, gloves: null, boots: null };
    const has = ROBE_SLOTS.some(slot => lo[slot] && gear[lo[slot]]);
    const chips = ROBE_SLOTS.map(slot => {
      const sm = ROBE_SLOT_META[slot], it = lo[slot] && gear[lo[slot]];
      if (!it) return `<span title="${Iu(dc(sm.labelZh, sm.labelEn))}" style="min-width:34px;padding:2px 4px;border:1px dashed var(--line);border-radius:6px;font-size:13px;opacity:.45;">${sm.icon}</span>`;
      const q = ROBE_QUALITY_META[it.quality] || ROBE_QUALITY_META.common, el = { icon: robeElementIcons(it) };
      return `<span title="${Iu(dc(q.labelZh + sm.labelZh, q.labelEn + " " + sm.labelEn))}" style="min-width:34px;padding:2px 4px;border:1px solid ${q.color};border-radius:6px;font-size:13px;box-shadow:0 0 4px ${q.color};">${sm.icon}${el.icon}</span>`;
    }).join("");
    return `<div style="border:1px solid ${has ? "var(--gold)" : "var(--line)"};border-radius:10px;padding:8px;text-align:center;">
      <input type="text" id="robe-loadout-name-${i}" value="${Iu(lo.name || "")}" placeholder="${dc("組合", "Combo")} ${i+1}" maxlength="12" style="width:100%;text-align:center;font-size:12px;padding:4px;margin-bottom:4px;border-radius:6px;border:1px solid var(--line);background:var(--bg-void);color:var(--cream);" />
      <div style="display:flex;justify-content:center;gap:3px;margin-bottom:6px;min-height:22px;">${chips}</div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:center;">
        <button class="btn small secondary" data-robe-loadout-rename="${i}">${dc("命名", "Rename")}</button>
        <button class="btn small secondary" data-robe-loadout-apply="${i}" ${has ? "" : "disabled"}>${dc("套用", "Load")}</button>
        <button class="btn small secondary" data-robe-loadout-save="${i}">${has ? dc("覆蓋", "Overwrite") : dc("儲存目前", "Save Current")}</button>
        ${has ? `<button class="btn small secondary" data-robe-loadout-clear="${i}">${dc("清除", "Clear")}</button>` : ""}
      </div>
    </div>`;
  }).join("");
  return `<p class="sub" style="margin-top:6px;">${dc("最多可儲存 6 組魔法裝備組合，方便快速切換，也可以按下方按鈕隨機切換成任一已儲存的組合。", "Save up to 6 magic gear loadouts for quick switching, or hit the button below to randomly switch to a saved combo.")}</p>
    <button class="btn small" id="robe-random-loadout-btn" style="margin-bottom:10px;">🎲 ${dc("隨機切換裝備組合", "Random Switch Loadout")}</button>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;">${cells}</div>`;
}
function robeSetEffectsHtml(equipped, activeSet){
  const actSets = Array.isArray(activeSet) ? activeSet : (activeSet ? [activeSet] : []);
  const stat = { defPct: ["🛡️", "減傷", "Damage reduction", "傷害結算時，溢出護盾的部分再打折", "applied to damage that gets past the shield"],
                 shieldPct: ["🔷", "護盾", "Shield", "戰鬥開始時獲得最大血量的這個比例當護盾", "of max HP as a shield at battle start"],
                 healPct: ["💚", "回血", "Regen", "每回合開始時回復最大血量的這個比例", "of max HP restored at the start of every round"] };
  const slotIcons = ROBE_SLOTS.map(sl => ROBE_SLOT_META[sl] ? ROBE_SLOT_META[sl].icon : "•");
  const slotNames = ROBE_SLOTS.map(sl => ROBE_SLOT_META[sl] ? dc(ROBE_SLOT_META[sl].labelZh, ROBE_SLOT_META[sl].labelEn) : sl).join(" + ");
  const rows = elementTypes.map(el => {
    const m = elementMeta[el], sb = ROBE_SET_BONUS[el] || {}, on = actSets.includes(el);
    const have = ROBE_SLOTS.filter(sl => equipped[sl] && robeItemElements(equipped[sl]).includes(el)).length;
    const pieces = ROBE_SLOTS.map((sl, i) => `<span style="opacity:${equipped[sl] && robeItemElements(equipped[sl]).includes(el) ? 1 : 0.3};">${slotIcons[i]}</span>`).join("");
    const effs = Object.keys(sb).filter(k => stat[k]).map(k => `<div style="font-size:12px;">${stat[k][0]} ${dc(stat[k][1], stat[k][2])} <b style="color:${m.color};">+${Math.round(sb[k] * 1000) / 10}%</b> <span style="color:var(--muted);font-size:11px;">${dc(stat[k][3], stat[k][4])}</span></div>`).join("");
    return `<div style="border:1px solid ${on ? m.color : "var(--line)"};border-radius:8px;padding:6px 8px;${on ? `background:${m.color}22;box-shadow:0 0 8px ${m.color}55;` : ""}">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;"><b style="color:${m.color};">${m.icon} ${dc(m.labelZh + "系套裝", m.labelEn + " Set")}</b><span style="font-size:11px;color:${on ? m.color : "var(--muted)"};">${pieces} ${have}/${ROBE_SLOTS.length}${on ? " · " + dc("已啟動","Active") : ""}</span></div>
      ${effs}
    </div>`;
  }).join("");
  return `<div style="margin-top:10px;">
    <h4 style="margin:0 0 4px;">✨ ${dc("套裝效果","Set Bonuses")}</h4>
    <div style="font-size:12px;color:var(--muted);margin-bottom:6px;">${dc(`${slotNames} 三件的元素都相同才會觸發（各元素只看該元素的件數，不會混搭；傳說裝備有兩個元素，兩個都算）；套裝加成會直接算進下方合計。`, `All 3 pieces (${slotNames}) must share the same element (a Legendary piece counts for both of its elements). The bonus is added to the totals below.`)}</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:6px;">${rows}</div>
  </div>`;
}
function robeGearPanelHtml(){
  const player = zl.player;
  if (!player) return "";
  bnRobeGear(player);
  const equipped = resolveEquippedRobeGear(player);
  const activeSets = robeActiveSetElements(equipped);
  const shard = (player.materials && player.materials.mysteryShard) || 0;
  const slotsHtml = ROBE_SLOTS.map(slot => {
    const item = equipped[slot], slotMeta = ROBE_SLOT_META[slot];
    if (!item) return `<div class="farm-upgrade-box" style="opacity:.6;text-align:center;"><div class="farm-upgrade-title">${slotMeta.icon} ${dc(slotMeta.labelZh,slotMeta.labelEn)}</div><div style="font-size:12px;color:var(--muted);margin-top:4px;">${dc("未裝備","Not equipped")}</div></div>`;
    return robeGearCardHtml(item, item.id);
  }).join("");
  const setHtml = activeSets.length
    ? activeSets.map(es => `<div style="margin-top:8px;font-size:12px;color:${elementMeta[es].color};">${elementMeta[es].icon} ${dc(`套裝效果啟動：${elementMeta[es].labelZh}套`, `Set bonus active: ${elementMeta[es].labelEn} Set`)}</div>`).join("")
    : `<div style="margin-top:8px;font-size:12px;color:var(--muted);">${dc("尚未觸發套裝效果","No set bonus active")}</div>`;
  const setListHtml = robeSetEffectsHtml(equipped, activeSets);
  const defPct = aggregateRobeDefPct(equipped), shieldPct = aggregateRobeShieldPct(equipped), healPct = aggregateRobeHealPct(equipped);
  const totalsHtml = `<div style="margin-top:6px;font-size:12px;color:var(--muted);">${dc("合計","Totals")}：🛡️${dc("減傷","Damage reduction")} ${(defPct*100).toFixed(1)}%（${dc("上限","cap")} ${ROBE_DEF_PCT_CAP*100}%） ・ 🔷${dc("護盾","Shield")} ${(shieldPct*100).toFixed(1)}% ${dc("最大血量","of max HP")} ・ 💚${dc("回血","Regen")} ${(healPct*100).toFixed(1)}% ${dc("最大血量／回合","of max HP per round")}</div>`;
  const allItems = Object.values(player.robeGear || {}).sort((a,b) => (b.createdAt||0)-(a.createdAt||0));
  const rf = (zl.robeGearFilter = zl.robeGearFilter || { element: "all", quality: "all" });
  const items = allItems.filter(it => ("all" === rf.element || robeItemElements(it).includes(rf.element)) && ("all" === rf.quality || it.quality === rf.quality));
  const rfSelStyle = "padding:6px 8px;border-radius:8px;border:1px solid var(--line);background:var(--bg-void);color:var(--cream);font-size:12px;";
  const filterBarHtml = allItems.length
    ? `<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:10px 0;">
      <select id="robe-filter-element" style="${rfSelStyle}"><option value="all" ${"all"===rf.element?"selected":""}>${dc("全部屬性","All Elements")}</option>${elementTypes.map(el=>`<option value="${el}" ${rf.element===el?"selected":""}>${elementMeta[el].icon} ${dc(elementMeta[el].labelZh,elementMeta[el].labelEn)}</option>`).join("")}</select>
      <select id="robe-filter-quality" style="${rfSelStyle}"><option value="all" ${"all"===rf.quality?"selected":""}>${dc("全部品質","All Qualities")}</option>${["common","rare","epic","legendary"].map(q=>`<option value="${q}" ${rf.quality===q?"selected":""}>${dc(ROBE_QUALITY_META[q].labelZh,ROBE_QUALITY_META[q].labelEn)}</option>`).join("")}</select>
      ${"all"===rf.element&&"all"===rf.quality?"":`<button class="btn small secondary" id="robe-filter-reset-btn" type="button">${dc("清除篩選","Clear Filters")}</button>`}
      <span style="font-size:12px;color:var(--muted);">${dc(`顯示 ${items.length} / ${allItems.length} 件`,`Showing ${items.length} / ${allItems.length}`)}</span>
      ${(()=>{const rl=robeBulkRecyclable(player);return `<button class="btn small secondary" id="robe-recycle-all-btn" type="button" ${rl.length?"":"disabled"} style="margin-left:auto;" title="${dc("回收目前顯示範圍內、未裝備且未標記最愛的裝備","Recycle all shown gear that is not equipped or favorited")}">♻️ ${dc(`一鍵回收（${rl.length} 件 → 🧩${rl.reduce((a,it)=>a+robeRecycleShards(it),0)}）`,`Recycle All (${rl.length} → 🧩${rl.reduce((a,it)=>a+robeRecycleShards(it),0)})`)}</button>`;})()}
    </div>`
    : "";
  const ownedHtml = items.length
    ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;margin-top:10px;">${items.map(it => robeGearCardHtml(it, player.equippedRobe[it.slot])).join("")}</div>`
    : `<p class="sub" style="margin-top:10px;">${allItems.length ? dc("沒有符合篩選條件的魔法裝備","No magic gear matches the filters") : dc("尚未擁有任何魔法裝備","No magic gear yet")}</p>`;
  return `<div class="panel">
    <h3>${dc("🛡️ 魔法裝備","🛡️ Magic Gear")}</h3>
    <p class="sub">${dc("PVP 專用防具：競技場與擂臺賽時生效。每件裝備開出時隨機一種屬性（減傷／護盾／回血），沒有等級，開出來就是最終數值。史詩／傳說詞條（無效類）：對手每次出手前有該數值的機率發動，發動時對手該次的對應效果完全失效。傳說裝備有兩個不同元素（兩個都算套裝）和兩個不同種詞條。","PVP-only armor: active in Arena and Tournament battles. Each piece rolls one random stat (damage reduction / shield / regen) — no levels, what you roll is final. Epic and Legendary affixes (negate): before each opponent action they activate with that % chance; when active, the opponent's matching effect is fully disabled for that action. Legendary gear has 2 different elements (both count toward set bonuses) and 2 different affixes.")}</p>
    <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center;margin:8px 0;">
      <span>🧩 ${dc("神秘碎片","Mystery Shards")}: ${shard}</span>
      <button class="btn small" id="robe-craft-btn">${dc(`製作（消耗🧩${ROBE_CRAFT_COST_SHARD}）`,`Craft (🧩${ROBE_CRAFT_COST_SHARD})`)}</button>
    </div>
    <div style="font-size:12px;color:var(--muted);margin:2px 0 8px;">⚔️ ${dc("下面「裝備中」的是攻擊裝備；防守裝備、骰子與攻守組合請到", "The gear below is your ATTACK gear; set defense gear, dice and combos in")} <button class="btn small secondary" data-pvp-goto="loadout">🧭 ${dc("佈陣", "Lineups")}</button></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;">${slotsHtml}</div>
    ${setHtml}
    ${setListHtml}
    ${totalsHtml}
    <h4 style="margin-top:14px;">${dc("我的魔法裝備","My Gear")}</h4>
    ${filterBarHtml}
    ${ownedHtml}
  </div>`;
}
function robeGearWire(container){
  const el = container || document;
  pvpGotoWire(el);
  const btn = el.querySelector ? el.querySelector("#robe-craft-btn") : document.getElementById("robe-craft-btn");
  if (btn) btn.onclick = () => craftRandomRobeGear();
  el.querySelectorAll("[data-robe-equip]").forEach(b => { b.onclick = () => equipRobeGear(b.dataset.robeEquip, b.dataset.robeEquipSlot); });
  el.querySelectorAll("[data-robe-unequip]").forEach(b => { b.onclick = () => unequipRobeGear(b.dataset.robeUnequip); });
  el.querySelectorAll("[data-robe-toggle-favorite]").forEach(b => { b.onclick = () => toggleRobeFavorite(b.dataset.robeToggleFavorite); });
  el.querySelectorAll("[data-robe-def-unequip]").forEach(b => { b.onclick = () => pvpSetGear("def", b.dataset.robeDefUnequip, null); });
  { const ra = el.querySelector ? el.querySelector("#robe-recycle-all-btn") : document.getElementById("robe-recycle-all-btn"); if (ra) ra.onclick = () => { if (!ra.disabled) recycleAllRobeGear(); }; }
  el.querySelectorAll("[data-robe-recycle]").forEach(b => { b.onclick = () => { if (!b.disabled) recycleRobeGear(b.dataset.robeRecycle); }; });
  const lbBusy = (btn, fn) => async () => { if (btn.disabled) return; btn.disabled = true; try { await fn(); } catch (err) { console.error("[robe loadout]", err); } finally { btn.disabled = false; } };
  const nameOf = idx => { const inp = el.querySelector ? el.querySelector("#robe-loadout-name-" + idx) : document.getElementById("robe-loadout-name-" + idx); return inp ? inp.value.slice(0,12) : ""; };
  el.querySelectorAll("[data-robe-loadout-apply]").forEach(b => { b.onclick = lbBusy(b, () => applyRobeLoadout(parseInt(b.dataset.robeLoadoutApply,10))); });
  el.querySelectorAll("[data-robe-loadout-save]").forEach(b => { b.onclick = lbBusy(b, () => { const idx = parseInt(b.dataset.robeLoadoutSave,10); return saveRobeLoadout(idx, nameOf(idx)); }); });
  el.querySelectorAll("[data-robe-loadout-rename]").forEach(b => { b.onclick = lbBusy(b, () => { const idx = parseInt(b.dataset.robeLoadoutRename,10); return renameRobeLoadout(idx, nameOf(idx)); }); });
  el.querySelectorAll("[data-robe-loadout-clear]").forEach(b => { b.onclick = lbBusy(b, () => clearRobeLoadout(parseInt(b.dataset.robeLoadoutClear,10))); });
  const rndBtn = el.querySelector ? el.querySelector("#robe-random-loadout-btn") : document.getElementById("robe-random-loadout-btn");
  if (rndBtn) rndBtn.onclick = lbBusy(rndBtn, () => randomRobeLoadout());
  const rfq = id => el.querySelector ? el.querySelector("#" + id) : document.getElementById(id);
  const rfEl = rfq("robe-filter-element"), rfQu = rfq("robe-filter-quality"), rfRs = rfq("robe-filter-reset-btn");
  const rfGet = () => (zl.robeGearFilter = zl.robeGearFilter || { element: "all", quality: "all" });
  rfEl && (rfEl.onchange = e => { rfGet().element = e.target.value; Eu(); });
  rfQu && (rfQu.onchange = e => { rfGet().quality = e.target.value; Eu(); });
  rfRs && (rfRs.onclick = () => { zl.robeGearFilter = { element: "all", quality: "all" }; Eu(); });
}
function robeSparCfg(res){
  const notes = [];
  notes.push(`<div class="pvp-note">${dc("骰組","Loadout")}：${"main" === res.loadoutMode ? dc("目前裝備的骰子","Current equipped dice") : dc("競技場陣容（沒設定就用目前裝備）","Arena lineup (falls back to current dice)")} ・ ${Iu(res.nickA)} ${res.diceA || 0} ${dc("顆","dice")} / ${Iu(res.nickB)} ${res.diceB || 0} ${dc("顆","dice")}${res.diceA !== res.diceB ? " ⚠️" + dc("骰子數量不同","dice counts differ") : ""}</div>`);
  res.noFloor && notes.push(`<div class="pvp-note">${dc("（本場已關閉競技場血量基礎值，血量只算骰子）","(Arena base HP was off for this spar — HP is dice only)")}</div>`);
  return {
    idp: "rg", perspective: "spectator", reportTitle: dc("切磋戰報","Spar report"),
    nameA: res.nickA, nameB: res.nickB, cardA: res.nickA, cardB: res.nickB,
    tagA: dc("A 方 · 先手","A · first"), tagB: dc("B 方","B"),
    avatarHtmlA: M({ avatarId: res.avatarA }), avatarHtmlB: M({ avatarId: res.avatarB }),
    notesHtml: notes.join("")
  };
}
function robeSparReportHtml(res){
  if (!res || !res.battle) return "";
  return pvpBattleReportHtml(res, robeSparCfg(res));
}
async function robeGmPlayBattleAnimation(res, rootEl){
  if (!res || !res.battle) return;
  const scope = rootEl instanceof Element ? rootEl : document;
  const container = (scope.querySelector && scope.querySelector("#rg-spar-result")) || document.getElementById("rg-spar-result");
  if (!container) return;
  pvpEnsureStyle();
  container.innerHTML = "";
  const cfg = robeSparCfg(res);
  const wrap = document.createElement("div"); wrap.id = "rg-battle-stage";
  wrap.innerHTML = pvpStageHtml(cfg.idp, res, cfg);
  container.appendChild(wrap);
  await pvpPlayBattle(wrap, res, cfg);
}
async function gmGrantRobeGear(targetNick, opts){
  if (!ku()) { ac(dc("僅GM可使用", "GM only")); return null; }
  const slot = ROBE_SLOTS.includes(opts.slot) ? opts.slot : "robe";
  const quality = ROBE_QUALITY_META[opts.quality] ? opts.quality : "common";
  const element = elementTypes.includes(opts.element) ? opts.element : elementTypes[0];
  const element2 = elementTypes.includes(opts.element2) && opts.element2 !== element ? opts.element2 : null;
  const statType = ROBE_STAT_TYPES.includes(opts.statType) ? opts.statType : "defPct";
  const statValue = Math.max(0, Math.min(1, opts.statValue || 0));
  let item = null, updated;
  try {
    updated = await Wl(targetNick, p => {
      bnRobeGear(p);
      item = {
        id: ql(), slot, quality, element, statType, statValue,
        affix: ("epic" === quality && opts.affixType && ROBE_AFFIX_META[opts.affixType]) ? { type: opts.affixType, value: Math.max(0, Math.min(1, opts.affixValue || 0)) } : null,
        favorite: false, createdAt: Date.now(), gmGranted: true
      };
      if ("legendary" === quality) {
        item.elements = element2 ? [element, element2] : [element];
        const afs = [];
        if (opts.affixType && ROBE_AFFIX_META[opts.affixType]) afs.push({ type: opts.affixType, value: Math.max(0, Math.min(1, opts.affixValue || 0)) });
        if (opts.affix2Type && ROBE_AFFIX_META[opts.affix2Type] && !afs.some(x => x.type === opts.affix2Type)) afs.push({ type: opts.affix2Type, value: Math.max(0, Math.min(1, opts.affix2Value || 0)) });
        item.affixes = afs;   // 沒填滿的元素／詞條由 bnRobeGear 隨機補齊
      }
      p.robeGear[item.id] = item;
      bnRobeGear(p);
      if (opts.autoEquip) p.equippedRobe[slot] = item.id;
    });
  } catch (err) {
    ac(dc("發放失敗，找不到這位玩家，請確認暱稱", "Grant failed — player not found, check the nickname"));
    return null;
  }
  if (!updated) { ac(dc("發放失敗，請再試一次", "Grant failed, try again")); return null; }
  if (zl.nickname && targetNick.toLowerCase() === zl.nickname.toLowerCase()) zl.player = updated;
  return item;
}
function robeSparPickSlots(p, mode){
  const ok = ids => (ids || []).filter(id => id && p.dice && p.dice[id]);
  const arena = ok(p.arenaDiceSlots), main = ok(p.diceSlots);
  return ("main" === mode ? (main.length ? main : arena) : (arena.length ? arena : main)).slice(0, 3);
}
function robeSparView(p, slots, mode){
  const padded = slots.slice(); while (padded.length < 3) padded.push(null);
  // 骰組用哪一邊，裝備就跟著用哪一邊（攻守都用同一套，才公平）
  return { ...p, diceSlots: padded, arenaDiceSlots: padded.slice(), equippedRobe: "main" === mode ? { ...p.equippedRobe } : pvpDefRobeIds(p), arenaRobe: null };
}
async function gmRunRobeSpar(nickA, nickB, noFloor, loadoutMode){
  if (!ku()) { ac(dc("僅GM可使用", "GM only")); return; }
  let pA = null, pB = null;
  try { pA = (await Gl(nickA)).player; } catch (err) { pA = null; }
  try { pB = (await Gl(nickB)).player; } catch (err) { pB = null; }
  if (!pA || !pB) return void ac(dc("找不到其中一位玩家，請確認暱稱", "One of the players wasn't found — check the nicknames"));
  const mode = "main" === loadoutMode ? "main" : "arena";
  const slotsA = robeSparPickSlots(pA, mode), slotsB = robeSparPickSlots(pB, mode);
  if (!slotsA.length) return void ac(dc(`${nickA} 尚未裝備骰子`, `${nickA} has no dice equipped`));
  if (!slotsB.length) return void ac(dc(`${nickB} 尚未裝備骰子`, `${nickB} has no dice equipped`));
  await arnLoadSettings();
  // 兩邊都把「攻擊用骰組」與「防守用骰組」設成同一組，避免先手吃主骰組、後手吃競技場陣容造成不公平
  const battle = arnSimulateBattle(robeSparView(pA, slotsA, mode), robeSparView(pB, slotsB, mode), false, noFloor ? 0 : undefined);
  gmSparResult = { battle, winner: battle.winner, nickA: pA.nickname, nickB: pB.nickname, avatarA: pA.avatarId || null, avatarB: pB.avatarId || null, noFloor: !!noFloor, loadoutMode: mode, diceA: slotsA.length, diceB: slotsB.length };
}
async function robeGmPanelHtml(){
  await arnLoadSettings();
  const rm = robeModsSanitize(arnSettings.robeMods);
  const row = (k, zh, en, icon) => `<div class="form-row" style="gap:8px;align-items:flex-end;">
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;min-width:110px;margin:0;"><input type="checkbox" id="rgm-${k}-on" ${rm[k].on ? "checked" : ""} /> ${icon} ${dc(zh, en)}</label>
      <div><label>${dc("倍率 ×", "Multiplier ×")}</label><input type="number" id="rgm-${k}-mult" value="${rm[k].mult}" min="0" step="0.1" style="width:80px;" /></div>
    </div>`;
  const modsPanel = `<div class="panel">
    <h2>🛡️ ${dc("GM：減傷／護盾／回血 倍率", "GM: Reduction / Shield / Regen Multipliers")}</h2>
    <p class="sub">${dc("倍率乘在「裝備＋套裝加成」的總和上；關閉＝該屬性完全不生效。減傷乘完後仍受 60% 上限限制。對所有用到魔法裝備的對戰生效。", "Multiplier applies to the total of gear + set bonus; off = that stat has no effect. Damage Reduction is still capped at 60% after multiplying. Affects every battle that uses magic gear.")}</p>
    ${row("def", "減傷", "Damage Reduction", "🛡️")}
    ${row("shield", "護盾", "Shield", "🔷")}
    ${row("heal", "回血", "Regen", "💚")}
    <div class="form-row" style="gap:8px;align-items:flex-end;">
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;min-width:110px;margin:0;"><input type="checkbox" id="rgm-regen-on" ${rm.regen.on ? "checked" : ""} /> ♻️ ${dc("護盾破後再生", "Shield regen after break")}</label>
      <div><label>${dc("破盾後第 N 回合開頭回滿", "Refill at start of round N after break")}</label><input type="number" id="rgm-regen-delay" value="${rm.regen.delay}" min="1" max="20" step="1" style="width:80px;" /></div>
    </div>
    <p class="sub" style="font-size:11px;">${dc("例：N=3 → R1 破盾，R2、R3 沒盾，R4 開頭回滿。護盾沒被打破就不會回復。", "e.g. N=3 → broken in R1, no shield in R2/R3, full again at the start of R4. A shield that isn't fully broken never regenerates.")}</p>
    <div class="form-row"><button class="btn small" id="rgm-save-btn">${dc("儲存倍率設定", "Save multipliers")}</button><button class="btn small secondary" id="rgm-reset-btn">↩️ ${dc("還原預設", "Reset defaults")}</button></div>
  </div>`;
  const slotOptions = ROBE_SLOTS.map(s => `<option value="${s}">${dc(ROBE_SLOT_META[s].labelZh, ROBE_SLOT_META[s].labelEn)}</option>`).join("");
  const qualityOptions = Object.keys(ROBE_QUALITY_META).map(q => `<option value="${q}">${dc(ROBE_QUALITY_META[q].labelZh, ROBE_QUALITY_META[q].labelEn)}</option>`).join("");
  const elementOptions = elementTypes.map(el => `<option value="${el}">${elementMeta[el].icon} ${dc(elementMeta[el].labelZh, elementMeta[el].labelEn)}</option>`).join("");
  const statOptions = ROBE_STAT_TYPES.map(k => `<option value="${k}">${ROBE_STAT_META[k].icon} ${dc(ROBE_STAT_META[k].labelZh, ROBE_STAT_META[k].labelEn)}</option>`).join("");
  const affixOptions = `<option value="">${dc("（無詞條）","(No affix)")}</option>` + Object.keys(ROBE_AFFIX_META).map(k => `<option value="${k}">${dc(ROBE_AFFIX_META[k].labelZh, ROBE_AFFIX_META[k].labelEn)}</option>`).join("");
  return modsPanel + `<div class="panel">
    <h2>🛡️ ${dc("GM：自訂魔法裝備發放","GM: Custom Magic Gear Grant")}</h2>
    <p class="sub">${dc("直接指定部位／品質／元素／屬性種類／屬性數值／詞條，發放到目標玩家的魔法裝備欄位中，不消耗任何材料。屬性數值不受品質區間限制，由你自訂。","Directly specify slot/quality/element/stat type/stat value/affix and grant straight into the target player's gear - no materials consumed. The stat value is not limited to the quality range.")}</p>
    <div class="form-row" style="gap:8px;">
      <div style="flex:1;min-width:160px;"><label>${dc("目標玩家暱稱","Target nickname")}</label><input type="text" id="rg-grant-nick-input" placeholder="${dc("玩家暱稱","Player nickname")}" /></div>
    </div>
    <div class="form-row" style="gap:8px;">
      <div><label>${dc("部位","Slot")}</label><select id="rg-grant-slot">${slotOptions}</select></div>
      <div><label>${dc("品質","Quality")}</label><select id="rg-grant-quality">${qualityOptions}</select></div>
      <div><label>${dc("元素","Element")}</label><select id="rg-grant-element">${elementOptions}</select></div>
      <div><label>${dc("元素2（僅傳說）","Element 2 (legendary only)")}</label><select id="rg-grant-element2"><option value="">${dc("（隨機）","(random)")}</option>${elementOptions}</select></div>
    </div>
    <div class="form-row" style="gap:8px;">
      <div><label>${dc("屬性","Stat")}</label><select id="rg-grant-stat-type">${statOptions}</select></div>
      <div><label>${dc("屬性數值（%）","Stat value (%)")}</label><input type="number" id="rg-grant-stat-value" value="10" min="0" max="100" step="0.1" style="width:90px;" /></div>
    </div>
    <div class="form-row" style="gap:8px;">
      <div><label>${dc("詞條1（史詩／傳說）","Affix 1 (epic / legendary)")}</label><select id="rg-grant-affix-type">${affixOptions}</select></div>
      <div><label>${dc("詞條數值（%）","Affix value (%)")}</label><input type="number" id="rg-grant-affix-value" value="5" min="0" max="100" step="0.1" style="width:90px;" /></div>
      <div><label>${dc("詞條2（僅傳說）","Affix 2 (legendary only)")}</label><select id="rg-grant-affix2-type">${affixOptions}</select></div>
      <div><label>${dc("詞條2數值（%）","Affix 2 value (%)")}</label><input type="number" id="rg-grant-affix2-value" value="7" min="0" max="100" step="0.1" style="width:90px;" /></div>
      <div><label>${dc("立即裝備","Equip now")}</label><select id="rg-grant-autoequip"><option value="0">${dc("否","No")}</option><option value="1">${dc("是","Yes")}</option></select></div>
    </div>
    <button class="btn small" id="rg-grant-btn">${dc("發放","Grant")}</button>
    <hr style="margin:14px 0;border-color:var(--line);">
    <h2>⚔️ ${dc("GM：指定切磋","GM: Designate a Spar")}</h2>
    <p class="sub">${dc("讓兩位玩家用目前的骰子與魔法裝備打一場友誼賽（A方先手），純測試用，不影響積分、勝敗場次與任何獎勵，也不會寫入任何一方的資料。","Have two players fight a friendly match with their current dice + gear (Player A goes first) - testing only, doesn't touch rating/win-loss/rewards or write to either player's data.")}</p>
    <div class="form-row" style="gap:8px;">
      <div style="flex:1;min-width:140px;"><label>${dc("A 方（先手）","Player A (first)")}</label><input type="text" id="rg-spar-a-input" placeholder="${dc("玩家暱稱","Nickname")}" /></div>
      <div style="flex:1;min-width:140px;"><label>${dc("B 方","Player B")}</label><input type="text" id="rg-spar-b-input" placeholder="${dc("玩家暱稱","Nickname")}" /></div>
    </div>
    <div class="form-row" style="gap:8px;margin-top:6px;">
      <div><label>${dc("雙方使用的骰組","Dice lineup for both")}</label><select id="rg-spar-loadout"><option value="arena">${dc("競技場陣容（沒設定就用目前裝備）","Arena lineup (fallback: current dice)")}</option><option value="main">${dc("目前裝備的骰子","Current equipped dice")}</option></select></div>
    </div>
    <label style="display:flex;align-items:center;gap:6px;font-size:12px;margin:6px 0;cursor:pointer;">
      <input type="checkbox" id="rg-spar-nofloor" />
      ${dc("這場切磋關閉競技場血量基礎值（只影響這次測試，不會動到 GM 競技場設定裡的正式數值，血量只算骰子）","Turn off the arena base HP for this spar only (doesn't touch the real Arena setting — HP is dice only)")}
    </label>
    <button class="btn small" id="rg-spar-btn">${dc("開始切磋","Start Spar")}</button>
    <div id="rg-spar-result">${gmSparResult ? robeSparReportHtml(gmSparResult) : ""}</div>
  </div>`;
}
function robeGmWirePanel(){
  const rgmVal = (id, d) => { const el = document.getElementById(id); const v = el ? parseFloat(el.value) : NaN; return isFinite(v) && v >= 0 ? v : d; };
  const rgmSave = document.getElementById("rgm-save-btn");
  if (rgmSave) rgmSave.onclick = async () => {
    rgmSave.disabled = true;
    try {
      await arnLoadSettings();
      const chk = id => { const el = document.getElementById(id); return !!(el && el.checked); };
      arnSettings.robeMods = robeModsSanitize({
        def: { on: chk("rgm-def-on"), mult: rgmVal("rgm-def-mult", 1) },
        shield: { on: chk("rgm-shield-on"), mult: rgmVal("rgm-shield-mult", 2) },
        heal: { on: chk("rgm-heal-on"), mult: rgmVal("rgm-heal-mult", 1) },
        regen: { on: chk("rgm-regen-on"), delay: rgmVal("rgm-regen-delay", 3) }
      });
      await arnSaveSettings();
      ac(dc("已儲存減傷／護盾／回血設定", "Reduction / Shield / Regen settings saved"));
    } catch (err) { ac(dc("儲存失敗，請再試一次", "Save failed, please try again")); }
    finally { rgmSave.disabled = false; }
  };
  const rgmReset = document.getElementById("rgm-reset-btn");
  if (rgmReset) rgmReset.onclick = () => {
    const d = robeModsSanitize(null);
    [["def", d.def], ["shield", d.shield], ["heal", d.heal]].forEach(([k, v]) => { document.getElementById("rgm-" + k + "-on").checked = v.on; document.getElementById("rgm-" + k + "-mult").value = v.mult; });
    document.getElementById("rgm-regen-on").checked = d.regen.on; document.getElementById("rgm-regen-delay").value = d.regen.delay;
    ac(dc("已還原成預設值，記得按「儲存倍率設定」才會生效", "Reset to defaults — press Save to apply"));
  };
  const grantBtn = document.getElementById("rg-grant-btn");
  if (grantBtn) grantBtn.onclick = async () => {
    const nickInput = document.getElementById("rg-grant-nick-input");
    const nick = (nickInput ? nickInput.value : "").trim();
    if (!nick) return void ac(dc("請輸入玩家暱稱", "Enter a player nickname"));
    const opts = {
      slot: document.getElementById("rg-grant-slot").value,
      quality: document.getElementById("rg-grant-quality").value,
      element: document.getElementById("rg-grant-element").value,
      statType: document.getElementById("rg-grant-stat-type").value,
      statValue: (parseFloat(document.getElementById("rg-grant-stat-value").value) || 0) / 100,
      affixType: document.getElementById("rg-grant-affix-type").value || null,
      affixValue: (parseFloat(document.getElementById("rg-grant-affix-value").value) || 0) / 100,
      element2: document.getElementById("rg-grant-element2").value || null,
      affix2Type: document.getElementById("rg-grant-affix2-type").value || null,
      affix2Value: (parseFloat(document.getElementById("rg-grant-affix2-value").value) || 0) / 100,
      autoEquip: "1" === document.getElementById("rg-grant-autoequip").value
    };
    grantBtn.disabled = true;
    try {
      const item = await gmGrantRobeGear(nick, opts);
      if (item) { ac(dc(`⚡ 已發放給 ${nick}`, `⚡ Granted to ${nick}`)); Bu(); }
    } finally { grantBtn.disabled = false; }
  };
  const sparBtn = document.getElementById("rg-spar-btn");
  if (sparBtn) sparBtn.onclick = async () => {
    const nickAInput = document.getElementById("rg-spar-a-input"), nickBInput = document.getElementById("rg-spar-b-input");
    const nickA = (nickAInput ? nickAInput.value : "").trim(), nickB = (nickBInput ? nickBInput.value : "").trim();
    if (!nickA || !nickB) return void ac(dc("請輸入兩位玩家的暱稱", "Enter both players' nicknames"));
    const noFloorInput = document.getElementById("rg-spar-nofloor");
    const noFloor = !!(noFloorInput && noFloorInput.checked);
    const loadoutSel = document.getElementById("rg-spar-loadout");
    const loadoutMode = loadoutSel ? loadoutSel.value : "arena";
    sparBtn.disabled = true;
    const dock = document.getElementById("gm-dock");
    if (dock) dock.__busy = true;   // 防止 GM 面板的自動刷新在動畫播放到一半時把畫面洗掉
    try {
      await gmRunRobeSpar(nickA, nickB, noFloor, loadoutMode);
      if (gmSparResult) await robeGmPlayBattleAnimation(gmSparResult, dock || document);
    } finally {
      sparBtn.disabled = false;
      if (dock) { dock.__busy = false; gmDockSync(dock.__root || dock, "rg", robeGmPanelHtml, robeGmWirePanel, true).catch(() => {}); }
      else Bu();
    }
  };
}

/* ===== GM：自訂寵物詞條並直接發寵物給玩家 — start ===== */
async function gmGrantPetV2(targetNick, opts){
  if (!ku()) { ac(dc("僅GM可使用", "GM only")); return null; }
  const quality = petQualityMeta[opts.quality] ? opts.quality : "common";
  const level = Math.max(1, Math.min(10, Math.round(opts.level || 1)));
  const count = Math.max(1, Math.min(20, Math.round(opts.count || 1)));
  const slots = (opts.affixes || []).filter(x => x === "random" || petAffixTypes.includes(x));
  let made = [], updated;
  try {
    updated = await Wl(targetNick, p => {
      bnV2(p);
      made = [];
      for (let i = 0; i < count; i++) {
        let affixes = slots.map(x => "random" === x ? rollPetV2Affix() : x);
        if (!affixes.length) affixes = [rollPetV2Affix()];
        const element = elementTypes.includes(opts.element) ? opts.element : rollPetV2Element();
        const pet = { id: ql(), quality, level, affixes, element, createdAt: Date.now(), favorite: false, gmGranted: true };
        p.petsV2.push(pet); made.push(pet);
      }
    });
  } catch (err) {
    ac(dc("發放失敗，找不到這位玩家，請確認暱稱", "Grant failed — player not found, check the nickname"));
    return null;
  }
  if (!updated) { ac(dc("發放失敗，請再試一次", "Grant failed, try again")); return null; }
  if (zl.nickname && targetNick.toLowerCase() === zl.nickname.toLowerCase()) zl.player = updated;
  return made;
}
async function petGmPanelHtml(){
  const qualityOptions = Object.keys(petQualityMeta).map(q => `<option value="${q}">${dc(petQualityMeta[q].labelZh, petQualityMeta[q].labelEn)}</option>`).join("");
  const elementOptions = `<option value="random">${dc("隨機", "Random")}</option>` + elementTypes.map(el => `<option value="${el}">${elementMeta[el].icon} ${dc(elementMeta[el].labelZh, elementMeta[el].labelEn)}</option>`).join("");
  const affixOpts = sel => `<option value=""${"" === sel ? " selected" : ""}>${dc("（不放）", "(none)")}</option><option value="random"${"random" === sel ? " selected" : ""}>${dc("🎲 隨機", "🎲 Random")}</option>` + petAffixTypes.map(k => `<option value="${k}">${dc(petAffixMeta[k].labelZh, petAffixMeta[k].labelEn)}</option>`).join("");
  const slotRow = [1, 2, 3, 4].map(i => `<div><label>${dc("詞條 ", "Affix ")}${i}</label><select id="pg-affix-${i}">${affixOpts(i <= 3 ? "random" : "")}</select></div>`).join("");
  return `<div class="panel">
    <h2>🐾 ${dc("GM：自訂寵物詞條並發寵物", "GM: Custom Pet Affixes & Grant")}</h2>
    <p class="sub">${dc("直接指定品質／等級／元素／詞條，把寵物發到目標玩家的寵物欄，不消耗羽毛。詞條數值依等級階梯（Lv1-2／3-5／6-9／10）自動決定；詞條可重複，最多 4 個。四格全部留空時會補一個隨機詞條。", "Directly specify quality / level / element / affixes and add the pet to the target player's pets, no Feathers spent. Affix values follow the level tiers (Lv1-2 / 3-5 / 6-9 / 10). Affixes may repeat, up to 4. If all four are empty, one random affix is added.")}</p>
    <div class="form-row" style="gap:8px;">
      <div style="flex:1;min-width:160px;"><label>${dc("目標玩家暱稱", "Target nickname")}</label><input type="text" id="pg-nick" placeholder="${dc("玩家暱稱", "Player nickname")}" /></div>
    </div>
    <div class="form-row" style="gap:8px;">
      <div><label>${dc("品質", "Quality")}</label><select id="pg-quality">${qualityOptions}</select></div>
      <div><label>${dc("等級", "Level")}</label><input type="number" id="pg-level" value="1" min="1" max="10" step="1" style="width:70px;" /></div>
      <div><label>${dc("元素", "Element")}</label><select id="pg-element">${elementOptions}</select></div>
      <div><label>${dc("數量", "Count")}</label><input type="number" id="pg-count" value="1" min="1" max="20" step="1" style="width:70px;" /></div>
    </div>
    <div class="form-row" style="gap:8px;">${slotRow}</div>
    <button class="btn small" id="pg-grant-btn">${dc("發放寵物", "Grant pet")}</button>
  </div>`;
}
function petGmWirePanel(){
  const btn = document.getElementById("pg-grant-btn");
  if (!btn) return;
  btn.onclick = async () => {
    const nick = (document.getElementById("pg-nick").value || "").trim();
    if (!nick) return void ac(dc("請輸入玩家暱稱", "Enter a player nickname"));
    const opts = {
      quality: document.getElementById("pg-quality").value,
      level: parseInt(document.getElementById("pg-level").value, 10) || 1,
      element: document.getElementById("pg-element").value,
      count: parseInt(document.getElementById("pg-count").value, 10) || 1,
      affixes: [1, 2, 3, 4].map(i => document.getElementById("pg-affix-" + i).value).filter(Boolean)
    };
    btn.disabled = true;
    try {
      const made = await gmGrantPetV2(nick, opts);
      if (made) { ac(dc(`🐾 已發放 ${made.length} 隻寵物給 ${nick}`, `🐾 Granted ${made.length} pet(s) to ${nick}`)); Bu(); }
    } finally { btn.disabled = false; }
  };
}