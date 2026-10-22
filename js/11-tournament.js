
/* ===== 擂臺賽 Tournament（每週一次：競技場積分前 8 名，8強 → 4強 → 決賽）===== */
// 沒有伺服器排程：由在線的玩家端輪流推進，所有狀態放在 kv_store 的 tourney:cur，靠版本檢查（Vl）確保每個動作只會被一個人執行。
const tourneyInstance = Math.random().toString(36).slice(2, 8), tourneyMe = () => (zl.nickname || "?") + "#" + tourneyInstance;   // 搶執行權的識別：暱稱＋這個頁面的唯一代碼（同一個玩家開兩個分頁也分得出來）
const tourneySleep = ms => new Promise(res => setTimeout(res, ms));
// 寫入結果一定要成功：版本檢查被別人搶先時，退避一下再重試（玩家端很多時，同一個時間點會有很多人同時在寫）
async function tourneyCommit(fn){
  for (let i = 0; i < 8; i++) { try { return await Vl(TOURNEY_CUR_KEY, fn, "null"); } catch (err) { await tourneySleep(150 + Math.random() * 450 * (i + 1)); } }
  throw new Error("tourney commit contention");
}
const TOURNEY_CUR_KEY = "tourney:cur", TOURNEY_SETTINGS_KEY = "tourney:settings", TOURNEY_KEEP = 4, TOURNEY_TZ_MS = 8 * 36e5;
const TOURNEY_LOADOUT = "arena";   // "arena"＝競技場防守陣容（沒設定就用目前裝備）；"main"＝目前裝備的骰子
const TOURNEY_BRACKET = { QF1: { seeds: [1, 8] }, QF2: { seeds: [4, 5] }, QF3: { seeds: [2, 7] }, QF4: { seeds: [3, 6] }, SF1: { from: ["QF1", "QF2"] }, SF2: { from: ["QF3", "QF4"] }, F: { from: ["SF1", "SF2"] } };
const TOURNEY_STAGES = [["QF1", "QF2", "QF3", "QF4"], ["SF1", "SF2"], ["F"]];
let tourneySettings = { enabled: true, weekday: 0, startTime: "19:00", waitMin: 5, fightMin: 2, minMatches: 3, betEnabled: true, minBet: 1000, maxBet: 1000000, maxExposure: 10000000, edgePct: 8, oddsTrials: 800 };
let tourneySettingsAt = 0, tourneyState = null, tourneyStateAt = 0, tourneyBusy = false, tourneyViewState = null, tourneyHistory = [], tourneyReplayToken = 0, tourneyUiTimer = null;
function tourneyTimeOf(str){ const m = /^(\d{1,2}):(\d{2})$/.exec(String(str || "")); return { h: m ? Math.min(23, +m[1]) : 19, mi: m ? Math.min(59, +m[2]) : 0 }; }
// 最近一次（≤ now）與下一次的開賽時間：每週 weekday（0=週日）的 startTime，以 GMT+8 計
function tourneyOccurrence(now, settings){
  const t = tourneyTimeOf(settings.startTime), wd = Math.max(0, Math.min(6, +settings.weekday || 0)), local = new Date(now + TOURNEY_TZ_MS);
  const back = (local.getUTCDay() - wd + 7) % 7;
  let last = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - back, t.h, t.mi) - TOURNEY_TZ_MS;
  if (last > now) last -= 7 * 864e5;
  return { last, next: last + 7 * 864e5 };
}
function tourneyIdFor(startAt){ const d = new Date(startAt + TOURNEY_TZ_MS); return "w-" + d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0"); }
function tourneyClock(ts){ const d = new Date(ts + TOURNEY_TZ_MS); return String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0"); }
function tourneyDay(ts){ const d = new Date(ts + TOURNEY_TZ_MS); return (d.getUTCMonth() + 1) + "/" + d.getUTCDate() + "（" + ["日", "一", "二", "三", "四", "五", "六"][d.getUTCDay()] + "）"; }
function tourneyCountdown(ms){ ms = Math.max(0, Math.ceil(ms / 1000)); const d = Math.floor(ms / 86400), h = Math.floor(ms % 86400 / 3600), m = Math.floor(ms % 3600 / 60), s = ms % 60; return d > 0 ? `${d}${dc("天", "d")} ${h}${dc("時", "h")}` : h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`; }
const tourneyMatchKey = (id, mid) => `tourney:m:${id}:${mid}`, tourneySnapKey = (id, nick) => `tourney:snap:${id}:${String(nick).toLowerCase()}`;
async function tourneyLoadSettings(force){
  if (!force && Date.now() - tourneySettingsAt < 300000) return tourneySettings;
  try {
    const r = await a.get(TOURNEY_SETTINGS_KEY);
    if (r) {
      const s = JSON.parse(r.value);
      if (typeof s.enabled === "boolean") tourneySettings.enabled = s.enabled;
      if (Number.isInteger(s.weekday) && s.weekday >= 0 && s.weekday <= 6) tourneySettings.weekday = s.weekday;
      if (typeof s.startTime === "string" && /^\d{1,2}:\d{2}$/.test(s.startTime)) tourneySettings.startTime = s.startTime;
      if (typeof s.waitMin === "number" && s.waitMin >= 0) tourneySettings.waitMin = s.waitMin;
      if (typeof s.fightMin === "number" && s.fightMin >= 1) tourneySettings.fightMin = s.fightMin;
      if (typeof s.minMatches === "number" && s.minMatches >= 0) tourneySettings.minMatches = s.minMatches;
      if (typeof s.betEnabled === "boolean") tourneySettings.betEnabled = s.betEnabled;
      if (typeof s.minBet === "number" && s.minBet >= 1) tourneySettings.minBet = Math.floor(s.minBet);
      if (typeof s.maxBet === "number" && s.maxBet >= 1) tourneySettings.maxBet = Math.floor(s.maxBet);
      if (typeof s.maxExposure === "number" && s.maxExposure >= 1) tourneySettings.maxExposure = Math.floor(s.maxExposure);
      if (typeof s.edgePct === "number" && s.edgePct >= 0 && s.edgePct <= 40) tourneySettings.edgePct = s.edgePct;
      if (typeof s.oddsTrials === "number" && s.oddsTrials >= 100) tourneySettings.oddsTrials = Math.min(3000, Math.floor(s.oddsTrials));
    }
  } catch (err) {}
  tourneySettingsAt = Date.now();
  return tourneySettings;
}
async function tourneySaveSettings(){ await a.set(TOURNEY_SETTINGS_KEY, JSON.stringify(tourneySettings)); tourneySettingsAt = Date.now(); }
async function tourneyReadState(){ try { const r = await a.get(TOURNEY_CUR_KEY); tourneyState = r ? JSON.parse(r.value) : null; } catch (err) {} tourneyStateAt = Date.now(); return tourneyState; }
// ---- 陣容快照：鎖定名單時記下每位選手的出戰骰子與星盤（之後不能換，賠率與重播才穩定）----
function tourneyPickLoadout(player){
  const ok = ids => (ids || []).filter(id => id && player.dice && player.dice[id]);
  const arena = ok(player.arenaDiceSlots), main = ok(player.diceSlots);
  return "arena" === TOURNEY_LOADOUT ? (arena.length ? arena : main) : (main.length ? main : arena);
}
function tourneySnapshot(player, slots, side){
  const dice = {}; slots.forEach(id => { dice[id] = JSON.parse(JSON.stringify(player.dice[id])); });
  bnRobeGear(player);
  return { nickname: player.nickname, avatarId: player.avatarId || null, slots, dice, starChart: { unlocked: ((player.starChart && player.starChart.unlocked) || []).slice() }, robeGear: JSON.parse(JSON.stringify(player.robeGear || {})), equippedRobe: "def" === side ? pvpDefRobeIds(player) : { ...player.equippedRobe } };
}
function tourneyViewOf(snap){
  const v = { nickname: snap.nickname, dice: snap.dice, diceSlots: snap.slots.slice(), arenaDiceSlots: snap.slots.slice(), starChart: { unlocked: snap.starChart.unlocked.slice() }, robeGear: snap.robeGear || {}, equippedRobe: snap.equippedRobe || { robe: null, gloves: null, boots: null } };
  le(v); return v;
}
async function tourneyPickTopEight(minMatches){
  // 金字塔前三排（第 1～3 層，共 8 位）＝ 8 強；對戰順序隨機抽籤（隨機遇敵）
  const st = await pyrReadState(), picked = [], seen = {};
  const seats = st.seats.filter(x => x.holder && x.layer <= 3 && x.holder.toLowerCase() !== wu.toLowerCase()).sort((x, y) => x.layer - y.layer || String(x.id).localeCompare(String(y.id)));
  for (const sd of seats) {
    if (picked.length >= 8) break;
    const nick = sd.holder;
    if (seen[nick.toLowerCase()]) continue;
    seen[nick.toLowerCase()] = 1;
    let player = null;
    try { const r = await Gl(nick); player = r && r.player; } catch (err) {}
    if (!player) continue;
    const slots = tourneyPickLoadout(player);
    if (!slots.length) continue;
    picked.push({ nick, layer: sd.layer, rating: null, avatarId: player.avatarId || null, snap: tourneySnapshot(player, slots, "arena" === TOURNEY_LOADOUT ? "def" : "atk") });
  }
  for (let i = picked.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); [picked[i], picked[k]] = [picked[k], picked[i]]; }
  return { seasonId: "pyramid", picked, examined: seats.length };
}
async function tourneyCreate(startAt, opts, meArg){
  opts = opts || {};
  const me = meArg || tourneyMe(), id = opts.test ? "test-" + startAt : tourneyIdFor(startAt), settings = await tourneyLoadSettings();
  let claimed = false, prev = null;
  try { await Vl(TOURNEY_CUR_KEY, cur => {
    claimed = false; prev = null;
    const st = cur ? JSON.parse(cur) : null;
    if (st && st.id === id && st.status !== "creating") return cur;
    if (st && st.status === "creating" && st.claimBy !== me && Date.now() - st.claimAt < 12e4) return cur;
    if (st && st.id !== id) {
      // 進行中的賽事、或獎勵還沒發完的賽事，不能被蓋掉（唯一例外：測試賽換測試賽）。GM 要先取消，才能開新的。
      const unfinished = !["finished", "cancelled", "skipped"].includes(st.status) && Date.now() - st.createdAt < 6 * 36e5;
      const owed = st.status === "finished" && !st.test && st.rewards && st.rewards.status !== "done" && Date.now() - (st.finishedAt || 0) < 24 * 36e5;
      if ((unfinished || owed) && !(opts.test && st.test)) return cur;
    }
    claimed = true; prev = st;
    return JSON.stringify({ v: 1, id, status: "creating", claimBy: me, claimAt: Date.now(), createdAt: Date.now(), startAt, test: !!opts.test });
  }, "null"); } catch (err) { return null; }   // 搶輸了（很多人同時在搶）＝別人在建，不用重複做
  if (!claimed) return null;
  const back = await tourneyReadState();
  if (!back || back.claimBy !== me || back.id !== id) return null;   // 同時有兩個人搶：最後寫入的人才繼續
  try { if (prev && prev.id && prev.status === "finished" && !prev.test) await a.set("tourney:hist:" + prev.id, JSON.stringify(prev)); } catch (err) {}
  const waitMs = opts.waitMs != null ? opts.waitMs : Math.round(settings.waitMin * 6e4), fightMs = opts.fightMs != null ? opts.fightMs : Math.round(settings.fightMin * 6e4);
  const top = await tourneyPickTopEight(opts.test ? 0 : settings.minMatches);
  const base = { v: 1, id, createdAt: back.createdAt, startAt, test: !!opts.test, claimBy: me, seasonId: top.seasonId, bo: TOURNEY_BEST_OF };
  if (top.picked.length < 8) {
    await tourneyCommit(cur => { const st = cur ? JSON.parse(cur) : null; if (!st || st.id !== id || st.claimBy !== me) return cur; return JSON.stringify({ ...base, status: "skipped", reason: "not_enough", have: top.picked.length, need: 8 }); });
    return await tourneyReadState();
  }
  await Promise.all(top.picked.map(p => a.set(tourneySnapKey(id, p.nick), JSON.stringify(p.snap))));
  const players = top.picked.map((p, i) => ({ seed: i + 1, nick: p.nick, rating: p.rating, layer: p.layer || null, avatarId: p.avatarId }));
  const qfAt = startAt + waitMs, sfAt = qfAt + fightMs + waitMs, fAt = sfAt + fightMs + waitMs, atOf = { QF: qfAt, SF: sfAt, F: fAt }, matches = {};
  Object.keys(TOURNEY_BRACKET).forEach(mid => {
    const def = TOURNEY_BRACKET[mid], stage = mid.replace(/\d+$/, "");
    matches[mid] = { id: mid, stage, at: atOf[stage], status: "pending", a: def.seeds ? players[def.seeds[0] - 1].nick : null, b: def.seeds ? players[def.seeds[1] - 1].nick : null, seeds: def.seeds || null, from: def.from || null, result: null };
  });
  await tourneyCommit(cur => {
    const st = cur ? JSON.parse(cur) : null;
    if (!st || st.id !== id || st.claimBy !== me || st.status !== "creating") return cur;
    return JSON.stringify({ ...base, status: "announced", waitMs, fightMs, players, matches, champion: null, rewards: { status: "none" } });
  });
  tourneyPrune().catch(() => {});
  return await tourneyReadState();
}
async function tourneyHasHistory(id){ try { return !!(await a.get("tourney:hist:" + id)); } catch (err) { return false; } }
async function tourneyPrune(){
  const keys = ((await a.list("tourney:hist:")).keys || []).sort().reverse();
  for (const k of keys.slice(TOURNEY_KEEP)) {
    const id = k.slice("tourney:hist:".length);
    for (const pre of [`tourney:m:${id}:`, `tourney:snap:${id}:`, `tourney:b:${id}:`, `tourney:x:${id}:`, `tourney:s:${id}:`]) { try { for (const dk of (await a.list(pre)).keys || []) await a.delete(dk); } catch (err) {} }
    try { await a.delete(k); } catch (err) {}
  }
}
// ---- 對戰模擬：先擲骰決定先後手（點數大的先攻，平手重擲），其餘完全沿用競技場的模擬 ----
function tourneyRollOff(){
  const rolls = [];
  for (let i = 0; i < 10; i++) { const ra = 1 + Math.floor(Math.random() * 6), rb = 1 + Math.floor(Math.random() * 6); rolls.push([ra, rb]); if (ra !== rb) return { rolls, first: ra > rb ? "a" : "b" }; }
  return { rolls, first: Math.random() < .5 ? "a" : "b" };
}
const tourneyPlayMs = log => (log.rolloff || []).length * 900 + 1400 + (log.rounds || []).reduce((sum, r) => sum + 1300 + (r.s ? 1300 : 0), 0) + 2200;
// ---- 三戰兩勝（Bo3）：第 1 局擲骰決定先後手、第 2 局換對方先手、1:1 時第 3 局再擲骰（TOURNEY_DECIDER_ROLLOFF=false 則嚴格輪流＝第 3 局回到第 1 局的先手）----
const TOURNEY_BEST_OF = 3, TOURNEY_WINS_NEEDED = 2, TOURNEY_GAME_GAP_MS = 2500, TOURNEY_DECIDER_ROLLOFF = true;
const tourneyGamesOf = log => (log && log.games && log.games.length) ? log.games : [log];
const tourneySeriesPlayMs = log => { const gs = tourneyGamesOf(log); return gs.reduce((sum, g) => sum + tourneyPlayMs(g), 0) + (gs.length - 1) * TOURNEY_GAME_GAP_MS; };
// 整輪勝率：pf＝A 先手時單局勝率、ps＝A 後手時單局勝率。第 1、2 局先後手互換，所以 (p1,p2) 只是 (pf,ps) 的順序；第 3 局平均先後手
const tourneySeriesProb = (pf, ps) => pf * ps + (pf + ps - 2 * pf * ps) * (pf + ps) / 2;
function tourneySlimDice(full){ return ((full && full.rolls) || []).map(r => [r.face && r.face.num, String(r.quality || "c").charAt(0)]); }
function tourneySimulate(snapA, snapB, seedA, seedB, forceFirst){   // forceFirst："a"／"b" 指定先手（不擲骰）；沒給就擲骰決定
  const off = forceFirst ? { rolls: [], first: forceFirst } : tourneyRollOff(), viewA = tourneyViewOf(snapA), viewB = tourneyViewOf(snapB), fk = off.first, firstV = fk === "a" ? viewA : viewB, secondV = fk === "a" ? viewB : viewA;
  const battle = arnSimulateBattle(firstV, secondV);   // 先手當「攻擊方」：每回合先出手
  const sk = fk === "a" ? "b" : "a", noKO = battle.attackerHpLeft > 0 && battle.defenderHpLeft > 0;
  let winner = battle.winner === "attacker" ? fk : sk, reason = noKO ? "hp" : "ko";
  if (noKO && battle.attackerHpLeft * battle.defenderMaxHp === battle.defenderHpLeft * battle.attackerMaxHp) { winner = seedA < seedB ? "a" : "b"; reason = "seed"; }   // 血量百分比剛好平手：種子排名高的晉級
  return tourneyBuildLog(battle, snapA, snapB, seedA, seedB, off, viewA, viewB, fk, winner, reason);
}
// 把一場已經算好的對戰（arnSimulateBattle 的結果）整理成精簡戰報，擂臺賽與金字塔重播共用
function tourneyBuildLog(battle, snapA, snapB, seedA, seedB, off, viewA, viewB, fk, winner, reason){
  const side = (s) => ({ dmg: s.dmg, crit: s.crit, combo: s.combo, blk: s.blk, par: s.par, d: s.d, raw: s.raw });
  const rounds = battle.rounds.map(r => ({
    r: r.round,
    f: side({ dmg: r.attackerRoll.damage, crit: r.attackerRoll.isCrit ? 1 : 0, combo: r.attackerRoll.comboTier || null, blk: r.defenderBlocked ? 1 : 0, par: r.defenderParryStrike || 0, d: tourneySlimDice(r.attackerFull), raw: Math.round(r.attackerFull ? r.attackerFull.damage : 0) }),
    s: r.defenderFull ? side({ dmg: r.defenderRoll.damage, crit: r.defenderRoll.isCrit ? 1 : 0, combo: r.defenderRoll.comboTier || null, blk: r.attackerBlocked ? 1 : 0, par: r.attackerParryStrike || 0, d: tourneySlimDice(r.defenderFull), raw: Math.round(r.defenderFull.damage) }) : null,
    hf: Math.round(r.attackerHpAfter), hs: Math.round(r.defenderHpAfter), sf: Math.round(r.attackerShieldAfter || 0), ss: Math.round(r.defenderShieldAfter || 0)
  }));
  const views = { a: viewA, b: viewB };
  const info = (snap, seed, key) => {
    const isF = fk === key, g = isF ? battle.attackerGear : battle.defenderGear, eq = resolveEquippedRobeGear(views[key]);
    return {
      nick: snap.nickname, seed, maxHp: Math.round(isF ? battle.attackerMaxHp : battle.defenderMaxHp),
      sh: Math.round((isF ? battle.attackerShieldMax : battle.defenderShieldMax) || 0),   // 護盾量（魔法裝備的護盾加成 × 最大血量）
      gear: g ? { defPct: g.defPct, shieldPct: g.shieldPct, healPct: g.healPct, setElement: g.setElement || null, setElements: g.setElements || [], affixes: g.affixes || {} } : null,
      pieces: ROBE_SLOTS.map(sl => { const it = eq[sl]; return it ? { sl, q: it.quality, st: it.statType, v: it.statValue, el: it.element, els: robeItemElements(it) } : null; }).filter(Boolean),   // 每件魔法裝備的品質／屬性
      dice: snap.slots.map(id => { const d = snap.dice[id]; return { q: d.quality, atk: getDiceTotalAttack(d), hp: getDiceTotalHp(d) }; })
    };
  };
  return { v: 1, a: info(snapA, seedA, "a"), b: info(snapB, seedB, "b"), rolloff: off.rolls, first: fk, rounds, winner, reason, hpLeft: { a: Math.round(fk === "a" ? battle.attackerHpLeft : battle.defenderHpLeft), b: Math.round(fk === "b" ? battle.attackerHpLeft : battle.defenderHpLeft) } };
}
function tourneySimulateSeries(snapA, snapB, seedA, seedB){
  const games = [], score = { a: 0, b: 0 };
  for (let n = 1; n <= TOURNEY_BEST_OF && score.a < TOURNEY_WINS_NEEDED && score.b < TOURNEY_WINS_NEEDED; n++) {
    let force = null;
    if (n === 2) force = games[0].first === "a" ? "b" : "a";   // 第 2 局：換對方先手
    else if (n >= 3 && !TOURNEY_DECIDER_ROLLOFF) force = games[n - 2].first === "a" ? "b" : "a";   // 嚴格輪流
    const g = tourneySimulate(snapA, snapB, seedA, seedB, force);
    g.n = n; games.push(g); score[g.winner]++;
  }
  return { v: 2, a: games[0].a, b: games[0].b, games, score, winner: score.a > score.b ? "a" : "b", first: games[0].first };
}
// 在版本檢查的交易裡呼叫：某個階段全部打完，就把贏家放進下一階段；決賽打完就產生冠軍
function tourneyAdvance(st){
  Object.keys(TOURNEY_BRACKET).forEach(mid => {
    const def = TOURNEY_BRACKET[mid], m = st.matches[mid];
    if (!def.from || m.a || m.b) return;
    const src = def.from.map(x => st.matches[x]);
    if (src.every(x => x.status === "done" && x.result)) { m.a = src[0].result.winnerNick; m.b = src[1].result.winnerNick; }
  });
  const f = st.matches.F;
  if (f && f.status === "done" && f.result && !st.champion) { st.champion = f.result.winnerNick; st.status = "finished"; st.finishedAt = Date.now(); }
}
async function tourneyRunMatch(mid, meArg){
  const me = meArg || tourneyMe();
  const due = st => st && st.matches && st.matches[mid] && st.matches[mid].a && st.matches[mid].b && Date.now() >= st.matches[mid].at && (st.matches[mid].status === "pending" || (st.matches[mid].status === "running" && Date.now() - st.matches[mid].claimAt > 9e4));
  try { const look = await a.get(TOURNEY_CUR_KEY); if (!look || !due(JSON.parse(look.value))) return false; } catch (err) { return false; }   // 先看一眼：沒人需要做就不去搶（很多玩家端同時醒來時，避免大家擠在同一個版本檢查上）
  let claimed = false, snapshotState = null;
  try { await Vl(TOURNEY_CUR_KEY, cur => {
    claimed = false;
    const st = cur ? JSON.parse(cur) : null;
    if (!due(st)) return cur;
    const m = st.matches[mid];
    m.status = "running"; m.claimBy = me; m.claimAt = Date.now(); claimed = true; snapshotState = st;
    return JSON.stringify(st);
  }, "null"); } catch (err) { return false; }
  if (!claimed) return false;
  const st = snapshotState, m = st.matches[mid];
  try {
    await arnLoadSettings();
    const [ra, rb] = await Promise.all([a.get(tourneySnapKey(st.id, m.a)), a.get(tourneySnapKey(st.id, m.b))]);
    if (!ra || !rb) throw new Error("snapshot missing");
    const seedOf = nick => (st.players.find(p => p.nick === nick) || {}).seed || 9;
    const log = st.bo >= 3 ? tourneySimulateSeries(JSON.parse(ra.value), JSON.parse(rb.value), seedOf(m.a), seedOf(m.b)) : tourneySimulate(JSON.parse(ra.value), JSON.parse(rb.value), seedOf(m.a), seedOf(m.b));
    log.id = st.id; log.matchId = mid; log.at = m.at;
    const playMs = tourneySeriesPlayMs(log), startedAt = Date.now(), lastG = log.games ? log.games[log.games.length - 1] : log;
    await a.set(tourneyMatchKey(st.id, mid), JSON.stringify(log));
    await tourneyCommit(cur => {
      const s2 = cur ? JSON.parse(cur) : null;
      if (!s2 || s2.id !== st.id || !s2.matches[mid] || s2.matches[mid].status === "done") return cur;
      s2.matches[mid].status = "done";
      s2.matches[mid].result = { winner: log.winner, winnerNick: log.winner === "a" ? m.a : m.b, first: log.first, reason: lastG.reason, hpLeft: lastG.hpLeft, rounds: lastG.rounds.length, score: log.score, games: log.games ? log.games.map(g => ({ w: g.winner, f: g.first, r: g.reason, h: g.hpLeft })) : undefined, playMs, startedAt };
      tourneyAdvance(s2);
      return JSON.stringify(s2);
    });
    return true;
  } catch (err) {
    // 算失敗：把這場放回「待開戰」，讓別的玩家端接手（不會卡死）
    try {
      await tourneyCommit(cur => {
        const s2 = cur ? JSON.parse(cur) : null;
        if (!s2 || !s2.matches[mid] || s2.matches[mid].status !== "running" || s2.matches[mid].claimBy !== me) return cur;
        const mm = s2.matches[mid]; mm.fails = (mm.fails || 0) + 1;
        if (mm.fails >= 3) {   // 連續 3 次算不出來（例如陣容資料遺失）：種子排名高的晉級，避免整屆卡死
          const seedOf = nick => (s2.players.find(p => p.nick === nick) || {}).seed || 9, w = seedOf(mm.a) <= seedOf(mm.b) ? "a" : "b";
          mm.status = "done"; mm.result = { winner: w, winnerNick: w === "a" ? mm.a : mm.b, first: "a", reason: "error", hpLeft: { a: 0, b: 0 }, rounds: 0, playMs: 0, startedAt: Date.now() };
          tourneyAdvance(s2);
        } else mm.status = "pending";
        return JSON.stringify(s2);
      });
    } catch (e2) {}
    return false;
  }
}
function tourneyWins(st){
  const wins = {}; (st.players || []).forEach(p => { wins[p.nick] = 0; });
  Object.keys(st.matches || {}).forEach(mid => { const m = st.matches[mid]; if (m.status === "done" && m.result) wins[m.result.winnerNick] = (wins[m.result.winnerNick] || 0) + 1; });
  return wins;
}
const tourneyFinalRevealAt = st => st.matches && st.matches.F && st.matches.F.result ? st.matches.F.result.startedAt + st.matches.F.result.playMs : Infinity;
// 獎勵：8 強每人 1 個神秘碎片、每贏一場再 +1；冠軍拿稱號。冪等性記在「玩家自己的存檔」裡（tourneyPaid），怎麼重複執行都不會重複發。
async function tourneyGrantRewards(meArg){
  const me = meArg || tourneyMe();
  let claimed = false, st0 = null;
  try { const look = await a.get(TOURNEY_CUR_KEY), ls = look && JSON.parse(look.value); if (!ls || ls.status !== "finished" || ls.test || Date.now() < tourneyFinalRevealAt(ls) || (ls.rewards && (ls.rewards.status === "done" || (ls.rewards.status === "claiming" && Date.now() - ls.rewards.at < 12e4)))) return false; } catch (err) { return false; }
  try { await Vl(TOURNEY_CUR_KEY, cur => {
    claimed = false;
    const st = cur ? JSON.parse(cur) : null;
    if (!st || st.status !== "finished" || st.test || Date.now() < tourneyFinalRevealAt(st)) return cur;
    const r = st.rewards || { status: "none" };
    if (r.status === "done" || (r.status === "claiming" && Date.now() - r.at < 12e4)) return cur;
    st.rewards = { status: "claiming", at: Date.now(), by: me }; claimed = true; st0 = st;
    return JSON.stringify(st);
  }, "null"); } catch (err) { return false; }
  if (!claimed) return false;
  const wins = tourneyWins(st0), paid = {};
  for (const p of st0.players) {
    const amount = 1 + (wins[p.nick] || 0);
    try {
      let tGave = false;
      await Wl(p.nick, pl => {
        tGave = false;
        le(pl); pl.tourneyPaid = pl.tourneyPaid || {};
        if (pl.tourneyPaid[st0.id]) return;
        tGave = true;
        pl.materials.mysteryShard = (pl.materials.mysteryShard || 0) + amount;
        pl.tourneyPaid[st0.id] = amount;
        Object.keys(pl.tourneyPaid).sort().slice(0, -8).forEach(k => { delete pl.tourneyPaid[k]; });
      });
      paid[p.nick] = amount;
      if (tGave) await shardNotify(p.nick, amount, "tournament");
    } catch (err) {}
  }
  if (st0.champion) await setTitleHolder("tourneyChampion", st0.champion);
  await tourneyCommit(cur => { const s2 = cur ? JSON.parse(cur) : null; if (!s2 || s2.id !== st0.id) return cur; s2.rewards = { status: "done", at: Date.now(), paid }; return JSON.stringify(s2); });
  try { for (const p of st0.players) await a.delete(tourneySnapKey(st0.id, p.nick)); } catch (err) {}
  return true;
}
async function tourneyTick(force, meArg){
  if (tourneyBusy || !zl.nickname || !zl.player) return;
  tourneyBusy = true;
  try {
    const settings = await tourneyLoadSettings(), now = Date.now(), occ = tourneyOccurrence(now, settings);
    // 只有「賽事進行中、開賽前後幾分鐘、獎勵還沒發完」才密集檢查（每 8 秒）；其餘時間 5 分鐘看一次，平常幾乎沒有負擔
    const running = tourneyState && !["finished", "cancelled", "skipped"].includes(tourneyState.status), haveThisWeek = tourneyState && tourneyState.id === tourneyIdFor(occ.last);
    const active = running || occ.next - now < 18e4 || (now - occ.last < 6e5 && !haveThisWeek) || (tourneyState && tourneyState.status === "finished" && !tourneyState.test && tourneyState.rewards && tourneyState.rewards.status !== "done") || Object.keys((zl.player && zl.player.tourneyBetPending) || {}).length > 0;
    if (!force && now - tourneyStateAt < (active ? 8000 : 300000)) return;
    let st = await tourneyReadState();
    if (settings.enabled && now - occ.last < 2 * 36e5 && (!st || st.id !== tourneyIdFor(occ.last) || (st.status === "creating" && now - st.claimAt > 12e4)) && !(await tourneyHasHistory(tourneyIdFor(occ.last)))) { const created = await tourneyCreate(occ.last, {}, meArg); if (created) st = created; }
    if (st && st.matches && (st.status === "announced" || st.status === "running")) {
      const dueIds = TOURNEY_STAGES.flat().filter(mid => { const m = st.matches[mid]; return m && m.a && m.b && m.status !== "done" && now >= m.at; });
      if (dueIds.length && !meArg) await tourneySleep(Math.random() * 1200);
      for (const mid of dueIds) await tourneyRunMatch(mid, meArg);
      st = await tourneyReadState();
    }
    if (st && st.status === "finished" && !st.test && st.rewards && st.rewards.status !== "done" && now >= tourneyFinalRevealAt(st)) { await tourneyGrantRewards(meArg); st = await tourneyReadState(); }
    await tourneyNotify(st);
    if (st) { await tourneyEnsureOdds(meArg); st = await tourneyReadState(); }
    await tourneySettleAndCollect(meArg);
    await tourneyRefreshBets(st);
    tourneyRefreshUi();
  } catch (err) {} finally { tourneyBusy = false; }
}
async function tourneyNotify(st){
  try {
    const me = zl.nickname;
    if (!st || !me || st.test || !st.players) return;
    const mine = st.players.find(p => p.nick.toLowerCase() === me.toLowerCase());
    if (!mine) return;
    const k1 = `tourney-notified:${st.id}:${me.toLowerCase()}`;
    if (!localStorage.getItem(k1)) { localStorage.setItem(k1, "1"); ac(dc(`🏆 擂臺賽：你入選 8 強（抽籤第 ${mine.seed} 號）！陣容已鎖定，${tourneyClock(st.startAt + st.waitMs)} 開戰，全程自動進行，不用在線。`, `🏆 Arena Tournament: you made the top 8 (seed #${mine.seed})! Loadout locked — the first fight starts at ${tourneyClock(st.startAt + st.waitMs)}, fully automatic.`)); }
    const k2 = `tourney-paid:${st.id}:${me.toLowerCase()}`;
    if (st.rewards && st.rewards.status === "done" && !localStorage.getItem(k2)) {
      localStorage.setItem(k2, "1");
      const amount = (st.rewards.paid && st.rewards.paid[mine.nick]) || 0;
      try { const fresh = await Gl(me); if (fresh && fresh.player) zl.player = fresh.player; } catch (err) {}
      ac(dc(`🏆 擂臺賽獎勵：神秘碎片 ×${amount}${st.champion === mine.nick ? "，並獲得稱號「擂臺霸主」！" : ""}`, `🏆 Tournament reward: Mystery Shard ×${amount}${st.champion === mine.nick ? " and the title \"Arena Overlord\"!" : ""}`));
    }
  } catch (err) {}
}

// ===== 下注（第二階段）=====
// 每場只能押「誰贏」，每人每場一注。賠率＝模擬對戰算出的勝率、扣掉莊家抽成，開放下注時就固定，之後不變。
// 下注記錄各自存成獨立的資料（tourney:b:賽事:場次:暱稱），不擠在主狀態上；每場每邊有「最高賠付」上限。
// 結算由「押了這場的玩家自己的頁面」在重播結束後觸發，中獎金額由玩家自己的頁面領取（記在玩家自己的存檔，怎麼重複都不會多領）。
const TOURNEY_MIN_ODDS = 1.05, TOURNEY_MAX_ODDS = 15, TOURNEY_LOPSIDED = 0.92, TOURNEY_LATE_GRACE_MS = 8000;
const tourneyBetKey = (id, mid, nick) => `tourney:b:${id}:${mid}:${String(nick).toLowerCase()}`, tourneyExpKey = (id, mid) => `tourney:x:${id}:${mid}`, tourneySettleKey = (id, mid) => `tourney:s:${id}:${mid}`;
let tourneyBets = {}, tourneyBetDraft = {}, tourneyBetsFor = null;
const tourneyEmptyExp = () => ({ a: { n: 0, stake: 0, liab: 0 }, b: { n: 0, stake: 0, liab: 0 } });
function tourneyOddsFromProb(p, edgePct){
  const raw = (1 - edgePct / 100) / Math.max(.02, p);
  return Math.min(TOURNEY_MAX_ODDS, Math.max(TOURNEY_MIN_ODDS, Math.round(raw * 100) / 100));
}
// 用雙方鎖定的陣容模擬很多場（一半讓 A 先手、一半讓 B 先手，跟真正的先後手是隨機一樣），算出 A 的勝率
async function tourneyComputeOdds(st, mid){
  const m = st.matches[mid], [ra, rb] = await Promise.all([a.get(tourneySnapKey(st.id, m.a)), a.get(tourneySnapKey(st.id, m.b))]);
  if (!ra || !rb) return null;
  await arnLoadSettings();
  const va = tourneyViewOf(JSON.parse(ra.value)), vb = tourneyViewOf(JSON.parse(rb.value)), seedOf = nick => (st.players.find(p => p.nick === nick) || {}).seed || 9, sa = seedOf(m.a), sb = seedOf(m.b);
  const N = Math.max(100, Math.min(3000, tourneySettings.oddsTrials || 800)); let wins = 0, wf = 0, nf = 0, ws = 0, ns = 0;
  for (let i = 0; i < N; i++) {
    const aFirst = i % 2 === 0, battle = arnSimulateBattle(aFirst ? va : vb, aFirst ? vb : va);
    let aWon = (battle.winner === "attacker") === aFirst;
    if (battle.attackerHpLeft > 0 && battle.defenderHpLeft > 0 && battle.attackerHpLeft * battle.defenderMaxHp === battle.defenderHpLeft * battle.attackerMaxHp) aWon = sa < sb;
    if (aWon) wins++; if (aFirst) { nf++; if (aWon) wf++; } else { ns++; if (aWon) ws++; }
    if (i % 200 === 199) await tourneySleep(0);   // 讓出時間給畫面
  }
  const pa = st.bo >= 3 ? tourneySeriesProb(nf ? wf / nf : .5, ns ? ws / ns : .5) : wins / N, edge = tourneySettings.edgePct;   // Bo3：用先手／後手各自的單局勝率推算整輪勝率
  return { pa: Math.round(pa * 1000) / 1000, oa: tourneyOddsFromProb(pa, edge), ob: tourneyOddsFromProb(1 - pa, edge), n: N, open: Math.max(pa, 1 - pa) <= TOURNEY_LOPSIDED };
}
// 陣容公布之後（還沒開戰之前），由第一個看到的玩家端算出這場的賠率並存進賽事狀態
async function tourneyEnsureOdds(meArg){
  const me = meArg || tourneyMe(), now = Date.now(), st0 = tourneyState;
  if (!tourneySettings.betEnabled || !st0 || !st0.matches || !["announced", "running"].includes(st0.status)) return;
  for (const mid of TOURNEY_STAGES.flat()) {
    const m0 = st0.matches[mid];
    if (!m0 || m0.odds || !m0.a || !m0.b || m0.status !== "pending" || tourneyPhase(st0, mid, now) !== "wait") continue;
    let claimed = false;
    try { const look = await a.get(TOURNEY_CUR_KEY), ls = look && JSON.parse(look.value), lm = ls && ls.matches && ls.matches[mid]; if (!lm || lm.odds || (lm.oddsClaim && now - lm.oddsClaim.at < 3e4)) continue; } catch (err) { continue; }
    try { await Vl(TOURNEY_CUR_KEY, cur => { claimed = false; const st = cur ? JSON.parse(cur) : null, m = st && st.matches && st.matches[mid]; if (!m || m.odds || m.status !== "pending" || (m.oddsClaim && Date.now() - m.oddsClaim.at < 3e4 && m.oddsClaim.by !== me)) return cur; m.oddsClaim = { by: me, at: Date.now() }; claimed = true; return JSON.stringify(st); }, "null"); } catch (err) { continue; }
    if (!claimed) continue;
    try {
      const odds = await tourneyComputeOdds(st0, mid);
      if (!odds) continue;
      try { if (!(await a.get(tourneyExpKey(st0.id, mid)))) await a.set(tourneyExpKey(st0.id, mid), JSON.stringify(tourneyEmptyExp())); } catch (err) {}   // 先建好賠付額度紀錄：之後每一注都是「版本檢查」更新，不會有兩個人同時建立而互相覆蓋
      await tourneyCommit(cur => { const st = cur ? JSON.parse(cur) : null; if (!st || st.id !== st0.id || !st.matches[mid] || st.matches[mid].odds) return cur; st.matches[mid].odds = odds; return JSON.stringify(st); });
    } catch (err) {}
  }
}
async function tourneyExpAdjust(expKey, side, n, stake, liab){
  try { await Vl(expKey, cur => { const x = cur && cur !== "null" ? JSON.parse(cur) : tourneyEmptyExp(); x[side].n = Math.max(0, x[side].n + n); x[side].stake = Math.max(0, x[side].stake + stake); x[side].liab = Math.max(0, x[side].liab + liab); return JSON.stringify(x); }, "null"); } catch (err) {}
}
// 下注：占位（每人每場一注）→ 預留賠付額度 → 扣款 → 正式記錄。任何一步失敗都會把前面做的還原（退款、釋放額度）。
async function tourneyPlaceBet(mid, side, amountRaw){
  const me = zl.nickname, amount = Math.floor(Number(amountRaw));
  const s = await tourneyLoadSettings(true);   // 下注前一定讀最新設定（GM 剛改的上下限馬上生效）
  if (!s.betEnabled) return { ok: false, reason: "off" };
  if (side !== "a" && side !== "b") return { ok: false, reason: "bad" };
  if (!(amount >= s.minBet)) return { ok: false, reason: "min" };
  if (amount > s.maxBet) return { ok: false, reason: "max" };
  const st = await tourneyReadState(), m = st && st.matches && st.matches[mid], now = Date.now();
  if (!m || !["announced", "running"].includes(st.status) || tourneyPhase(st, mid, now) !== "wait" || m.status !== "pending" || now >= m.at) return { ok: false, reason: "closed" };
  if (!m.odds) return { ok: false, reason: "noodds" };
  if (!m.odds.open) return { ok: false, reason: "lopsided" };
  const odds = side === "a" ? m.odds.oa : m.odds.ob, liab = Math.floor(amount * odds), betKey = tourneyBetKey(st.id, mid, me), expKey = tourneyExpKey(st.id, mid), token = Math.random().toString(36).slice(2), marker = `${st.id}|${mid}`;
  try { const r = await a.get(betKey); if (r) return { ok: false, reason: "already" }; } catch (err) { return { ok: false, reason: "busy" }; }
  try { await a.set(betKey, JSON.stringify({ status: "reserved", token, nick: me, at: now })); const back = await a.get(betKey); if (!back || JSON.parse(back.value).token !== token) return { ok: false, reason: "already" }; } catch (err) { return { ok: false, reason: "busy" }; }
  const release = async () => { try { await a.delete(betKey); } catch (err) {} };
  let over = false, busy = false;
  try { await Vl(expKey, cur => { over = false; const x = cur && cur !== "null" ? JSON.parse(cur) : tourneyEmptyExp(); if (x[side].liab + liab > s.maxExposure) { over = true; return JSON.stringify(x); } x[side].n++; x[side].stake += amount; x[side].liab += liab; return JSON.stringify(x); }, "null"); } catch (err) { busy = true; }
  if (over || busy) { await release(); return { ok: false, reason: over ? "exposure" : "busy" }; }
  let err2 = null, updated = null;
  try { updated = await Wl(me, p => { err2 = null; le(p); if ((p.coins || 0) < amount) { err2 = "coins"; return; } p.coins -= amount; p.tourneyBetPending = p.tourneyBetPending || {}; p.tourneyBetPending[marker] = 1; }); } catch (err) { err2 = "busy"; }
  if (!updated || err2) { await tourneyExpAdjust(expKey, side, -1, -amount, -liab); await release(); return { ok: false, reason: err2 || "busy" }; }
  zl.player = updated;
  const bet = { status: "open", nick: me, side, amount, odds, liab, at: Date.now(), mid, tid: st.id };
  try { await a.set(betKey, JSON.stringify(bet)); } catch (err) {
    try { const fresh = await Wl(me, p => { le(p); p.coins = (p.coins || 0) + amount; if (p.tourneyBetPending) delete p.tourneyBetPending[marker]; }); if (fresh) zl.player = fresh; } catch (e2) {}
    await tourneyExpAdjust(expKey, side, -1, -amount, -liab); await release(); return { ok: false, reason: "busy" };
  }
  tourneyBets[mid] = { ...(tourneyBets[mid] || {}), mine: bet };
  return { ok: true, bet };
}
// ---- 結算：這場重播結束後，由押了這場的玩家端做（每場只有一個人做，其他人略過）----
async function tourneySettleMatch(st, mid, meArg){
  const me = meArg || tourneyMe(), m = st.matches[mid];
  if (!m || !m.result || !tourneyRevealed(m, Date.now())) return false;
  const key = tourneySettleKey(st.id, mid);
  try { const look = await a.get(key); if (look) { const s0 = JSON.parse(look.value); if (s0.status === "done" || (s0.status === "settling" && Date.now() - s0.at < 12e4)) return false; } } catch (err) { return false; }
  let claimed = false;
  try { await Vl(key, cur => { claimed = false; const s0 = JSON.parse(cur); if (s0 && (s0.status === "done" || (s0.status === "settling" && Date.now() - s0.at < 12e4 && s0.by !== me))) return cur; claimed = true; return JSON.stringify({ status: "settling", by: me, at: Date.now() }); }, "null"); } catch (err) { return false; }
  if (!claimed) return false;
  try { const back = await a.get(key); if (!back || JSON.parse(back.value).by !== me) return false; } catch (err) { return false; }
  const rows = await a.listValues(`tourney:b:${st.id}:${mid}:`), voidAll = m.result.reason === "error";
  for (const row of rows) {
    let b; try { b = JSON.parse(row.value); } catch (err) { continue; }
    if (b.status !== "open") continue;
    const res = (voidAll || b.at > m.at + TOURNEY_LATE_GRACE_MS) ? { status: "void", payout: b.amount } : b.side === m.result.winner ? { status: "won", payout: Math.floor(b.amount * b.odds) } : { status: "lost", payout: 0 };   // 開戰後才送出的注、或這場沒能正常打完：退款
    await a.set(row.key, JSON.stringify({ ...b, ...res, settledAt: Date.now() }));
  }
  await a.set(key, JSON.stringify({ status: "done", by: me, at: Date.now() }));
  return true;
}
// 賽事被 GM 取消：還沒結算的注全部退款
async function tourneyVoidBets(st){
  for (const row of await a.listValues(`tourney:b:${st.id}:`)) {
    let b; try { b = JSON.parse(row.value); } catch (err) { continue; }
    if (b.status === "open") await a.set(row.key, JSON.stringify({ ...b, status: "void", payout: b.amount, settledAt: Date.now() }));
  }
}
async function tourneyStateById(tid){
  if (tourneyState && tourneyState.id === tid) return tourneyState;
  try { const r = await a.get("tourney:hist:" + tid); return r ? JSON.parse(r.value) : null; } catch (err) { return null; }
}
async function tourneyClearMarker(marker){
  try { const fresh = await Wl(zl.nickname, p => { le(p); if (p.tourneyBetPending) delete p.tourneyBetPending[marker]; }); if (fresh) zl.player = fresh; } catch (err) {}
}
// 領取自己的一注：中獎領獎金、作廢領回本金、沒中就只是清掉標記。玩家存檔裡的 tourneyBetPaid 讓它不會重複入帳。
async function tourneyCollectOne(st, mid){
  const me = zl.nickname, marker = `${st.id}|${mid}`, k = tourneyBetKey(st.id, mid, me);
  let bet = null; try { const r = await a.get(k); bet = r && JSON.parse(r.value); } catch (err) { return 0; }
  tourneyBets[mid] = { ...(tourneyBets[mid] || {}), mine: bet };
  if (!bet) { await tourneyClearMarker(marker); return 0; }
  if (bet.status === "open" || bet.status === "reserved") return 0;
  if (bet.status === "lost" || bet.collected) { await tourneyClearMarker(marker); return 0; }
  let credited = false;
  try {
    const fresh = await Wl(me, p => {
      credited = false; le(p); p.tourneyBetPaid = p.tourneyBetPaid || {};
      if (!p.tourneyBetPaid[marker]) { p.coins = (p.coins || 0) + bet.payout; p.tourneyBetPaid[marker] = bet.payout; credited = true; Object.keys(p.tourneyBetPaid).sort().slice(0, -40).forEach(x => { delete p.tourneyBetPaid[x]; }); }
      if (p.tourneyBetPending) delete p.tourneyBetPending[marker];
    });
    if (fresh) zl.player = fresh;
  } catch (err) { return 0; }
  bet = { ...bet, collected: true }; try { await a.set(k, JSON.stringify(bet)); } catch (err) {}
  tourneyBets[mid] = { ...(tourneyBets[mid] || {}), mine: bet };
  if (credited) { const nm = bet.side === "a" ? st.matches[mid].a : st.matches[mid].b; ac(bet.status === "won" ? dc(`🎉 擂臺賽下注中獎！押 ${nm} ✦${bet.amount.toLocaleString()} → 獲得 ✦${bet.payout.toLocaleString()}`, `🎉 Tournament bet won! ${nm} ✦${bet.amount.toLocaleString()} → ✦${bet.payout.toLocaleString()}`) : dc(`↩️ 擂臺賽下注已退款 ✦${bet.payout.toLocaleString()}（這場沒能正常打完或已取消）`, `↩️ Tournament bet refunded ✦${bet.payout.toLocaleString()} (match void or cancelled)`)); }
  return credited ? bet.payout : 0;
}
async function tourneySettleAndCollect(meArg){
  const pend = (zl.player && zl.player.tourneyBetPending) || {}, markers = Object.keys(pend);
  if (!markers.length) return 0;
  let total = 0;
  for (const marker of markers) {
    const cut = marker.lastIndexOf("|"), tid = marker.slice(0, cut), mid = marker.slice(cut + 1), st = await tourneyStateById(tid);
    if (!st || !st.matches || !st.matches[mid]) { await tourneyClearMarker(marker); continue; }
    try { if (st.status === "cancelled") await tourneyVoidBets(st); else await tourneySettleMatch(st, mid, meArg); } catch (err) {}
    total += await tourneyCollectOne(st, mid);
  }
  return total;
}
// ---- 畫面用的資料：自己的注、這場目前的下注人數 ----
async function tourneyRefreshBets(st){
  if (!st || !st.matches || !document.getElementById("tourney-root") || !zl.nickname) return;
  if (tourneyBetsFor !== st.id) { tourneyBetsFor = st.id; tourneyBets = {}; for (const mid of TOURNEY_STAGES.flat()) { try { const r = await a.get(tourneyBetKey(st.id, mid, zl.nickname)); tourneyBets[mid] = { mine: r ? JSON.parse(r.value) : null }; } catch (err) {} } }
  const now = Date.now();
  for (const mid of TOURNEY_STAGES.flat()) {
    if (!st.matches[mid].odds || tourneyPhase(st, mid, now) !== "wait") continue;
    try { const r = await a.get(tourneyExpKey(st.id, mid)); tourneyBets[mid] = { ...(tourneyBets[mid] || {}), x: r ? JSON.parse(r.value) : null }; } catch (err) {}
  }
}
const TOURNEY_BET_ERR = { off: ["下注目前關閉", "Betting is off"], bad: ["選項錯誤", "Bad choice"], min: ["低於最低下注額", "Below the minimum bet"], max: ["超過最高下注額", "Above the maximum bet"], closed: ["這場已經截止下注", "Betting for this match is closed"], noodds: ["賠率還在計算中，請稍等幾秒", "Odds are still being calculated — wait a few seconds"], lopsided: ["實力差距太大，這場不開放下注", "Too lopsided — no betting on this match"], already: ["這場你已經下過注了（每人每場一注）", "You already bet on this match (one bet per match)"], exposure: ["這一邊的賠付額度已滿，請改押另一邊或降低金額", "This side's payout limit is full — pick the other side or bet less"], coins: ["金幣不足", "Not enough coins"], busy: ["下注人數太多，請再試一次", "Busy right now — please try again"] };
function tourneyBetHtml(st, mid, m, ph){
  const s = tourneySettings; if (!s.betEnabled) return "";
  const entry = tourneyBets[mid] || {}, mine = entry.mine, nm = k => Iu(k === "a" ? m.a : m.b), n = x => Number(x || 0).toLocaleString();
  let out = "";
  if (mine && mine.status && mine.status !== "reserved") {
    const stt = { open: dc("⏳ 等待結果", "⏳ pending"), won: `<b style="color:var(--gold-bright);">🎉 ${dc("中獎", "won")} +✦${n(mine.payout)}</b>`, lost: dc("未中", "lost"), void: dc(`已退款 ✦${n(mine.amount)}`, `refunded ✦${n(mine.amount)}`) }[mine.status] || "";
    out += `<div style="font-size:12px;margin-top:4px;">🎫 ${dc("你押了", "Your bet")} ${nm(mine.side)} ✦${n(mine.amount)} @×${mine.odds} ・ ${stt}</div>`;
  }
  if (!m.odds) return out + (ph === "wait" ? `<div style="font-size:12px;color:var(--muted);margin-top:4px;">📊 ${dc("賠率計算中…", "Calculating odds…")}</div>` : "");
  const oddsLine = m.odds.open ? `${nm("a")} ×${m.odds.oa}　${nm("b")} ×${m.odds.ob}` : "";
  if (ph === "wait") {
    if (!m.odds.open) return out + `<div style="font-size:12px;color:var(--muted);margin-top:4px;">📊 ${dc("實力差距太大，這場不開放下注", "Too lopsided — no betting on this match")}</div>`;
    const cnt = entry.x ? entry.x.a.n + entry.x.b.n : 0;
    out += `<div style="font-size:12px;margin-top:4px;color:var(--muted);">📊 ${st.bo >= 3 ? dc("賠率（押整輪勝負）", "Odds (series winner)") : dc("賠率", "Odds")}：${oddsLine}${cnt ? "　" + dc(`已有 ${cnt} 人下注`, `${cnt} bettor(s)`) : ""}</div>`;
    if (!mine) {
      const draft = tourneyBetDraft[mid] != null ? tourneyBetDraft[mid] : s.minBet, amt = Math.floor(Number(draft)) || 0;
      out += `<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:6px;"><input type="number" id="tn-bet-amt-${mid}" min="${s.minBet}" max="${s.maxBet}" step="100" value="${Iu(draft)}" style="width:110px;"/><button class="btn small" data-tourney-bet="${mid}" data-side="a">${dc("押", "Bet")} ${nm("a")}</button><button class="btn small" data-tourney-bet="${mid}" data-side="b">${dc("押", "Bet")} ${nm("b")}</button></div><div id="tn-bet-prev-${mid}" style="font-size:11px;color:var(--muted);margin-top:2px;">${dc("中獎可得", "Payout if it wins")}：${nm("a")} ✦${n(Math.floor(amt * m.odds.oa))}　${nm("b")} ✦${n(Math.floor(amt * m.odds.ob))}　(${dc("下注 ✦", "bet ✦")}${n(s.minBet)}～${n(s.maxBet)})</div>`;
    }
  } else if (!mine && m.odds.open) out += `<div style="font-size:12px;color:var(--muted);margin-top:4px;">🔒 ${dc("投注已截止", "Betting closed")}</div>`;
  return out;
}
async function tourneyBetClick(mid, side){
  const box = document.getElementById("tn-bet-amt-" + mid), amt = box ? box.value : tourneySettings.minBet;
  document.querySelectorAll(`[data-tourney-bet="${mid}"]`).forEach(b => { b.disabled = true; });
  let r; try { r = await tourneyPlaceBet(mid, side, amt); } catch (err) { r = { ok: false, reason: "busy" }; }
  if (r.ok) { delete tourneyBetDraft[mid]; const pick = tourneyState.matches[mid][side === "a" ? "a" : "b"]; ac(dc(`🎫 已下注：${pick} ✦${r.bet.amount.toLocaleString()} @×${r.bet.odds}（中獎可得 ✦${Math.floor(r.bet.amount * r.bet.odds).toLocaleString()}）`, `🎫 Bet placed: ${pick} ✦${r.bet.amount.toLocaleString()} @×${r.bet.odds} (pays ✦${Math.floor(r.bet.amount * r.bet.odds).toLocaleString()})`)); }
  else { const e = TOURNEY_BET_ERR[r.reason] || TOURNEY_BET_ERR.busy; ac(dc(e[0], e[1])); }
  const rootEl = document.getElementById("tourney-root"), focused = document.activeElement;
  if (rootEl && focused && focused.tagName === "INPUT" && rootEl.contains(focused)) focused.blur();   // 送出後要讓畫面更新（打字中畫面不會被重繪，但送出之後不該卡住）
  tourneyLastHtml = ""; await tourneyRefreshBets(tourneyState); tourneyRefreshUi();
}
// ===== 畫面 =====
const tourneyRevealed = (m, now) => !!(m && m.status === "done" && m.result && now >= m.result.startedAt + m.result.playMs);
function tourneyPhase(st, mid, now){
  const m = st.matches[mid], def = TOURNEY_BRACKET[mid];
  if (def.from && !def.from.every(x => tourneyRevealed(st.matches[x], now))) return "tbd";
  if (!m.a || !m.b) return "tbd";
  if (m.status === "done" && m.result) return now >= m.result.startedAt + m.result.playMs ? "revealed" : "live";
  if (m.status === "running") return "live";
  return now >= m.at ? "starting" : "wait";
}
function tourneyMatchHtml(st, mid, now){
  pvpEnsureStyleX();
  const m = st.matches[mid], ph = tourneyPhase(st, mid, now), me = (zl.nickname || "").toLowerCase();
  const pl = nick => (st.players || []).find(p => p.nick === nick) || {};
  const stageName = { QF: dc("8強", "QF"), SF: dc("4強", "SF"), F: dc("決賽", "Final") }[m.stage];
  const rev = ph === "revealed", tbd = ph === "tbd";
  const side = k => {
    const nick = m[k], p = pl(nick), empty = tbd || !nick, won = rev && m.result.winnerNick === nick, lost = rev && !won;
    const av = empty ? "❔" : M({ avatarId: p.avatarId }), nm = empty ? dc("待定", "TBD") : Iu(nick);
    const sub = empty ? "" : `#${p.seed || "?"} ${dc("種子", "seed")}${p.rating ? " · " + p.rating : ""}`;
    return `<div class="tn-side ${k} ${won ? "win" : ""} ${lost ? "lose" : ""} ${!empty && String(nick).toLowerCase() === me ? "me" : ""}"><div class="pvp-avatar">${av}</div><div class="tn-nm"><b>${nm}${won ? " 🏅" : ""}</b><span>${sub}</span></div></div>`;
  };
  let chip = "", foot = "", btn = "";
  if (ph === "wait" || ph === "tbd") chip = `<span class="tn-chip">${tourneyClock(m.at)}${ph === "wait" ? " · " + dc("倒數", "in") + " " + tourneyCountdown(m.at - now) : ""}</span>`;
  else if (ph === "starting") chip = `<span class="tn-chip go">⚔️ ${dc("即將開戰…", "Starting…")}</span>`;
  else if (ph === "live") { chip = `<span class="tn-chip live">🔴 ${dc("對戰中", "LIVE")}</span>`; btn = m.status === "done" ? `<button class="btn small" data-tourney-watch="${mid}">👁 ${dc("觀戰", "Watch")}</button>` : ""; }
  else { const r = m.result; chip = `<span class="tn-chip">✔ ${dc("已結束", "Done")}</span>`; foot = `${r.score ? dc(`三戰兩勝 ${r.score.a}–${r.score.b}　G1 `, `Bo3 ${r.score.a}–${r.score.b}  G1 `) : ""}${dc("先手", "First")}：${Iu(r.first === "a" ? m.a : m.b)}${"seed" === r.reason ? "・" + dc("平手→種子晉級", "tie → seed") : "hp" === r.reason ? "・" + dc("回合上限，比血量", "HP decision") : ""}`; btn = `<button class="btn small secondary" data-tourney-watch="${mid}">▶ ${dc("重播", "Replay")}</button>`; }
  return `<div class="tn-match ${ph === "live" || ph === "starting" ? "live" : ""} ${m.stage === "F" ? "final" : ""}"><div class="tn-mhead"><b class="tn-stage">${stageName}${m.stage === "F" ? " 👑" : " " + mid.slice(-1)}${st.bo >= 3 ? " · Bo3" : ""}</b>${chip}</div><div class="tn-duel">${side("a")}<div class="pvp-vs">VS</div>${side("b")}</div>${foot || btn ? `<div class="tn-foot"><span>${foot}</span>${btn}</div>` : ""}${tourneyBetHtml(st, mid, m, ph)}</div>`;
}
function tourneyBracketHtml(st, now){
  const titles = [dc("⚔️ 8強", "⚔️ Quarter-finals"), dc("🥊 4強", "🥊 Semi-finals"), dc("👑 決賽", "👑 Final")];
  return TOURNEY_STAGES.map((ids, i) => `<div class="tn-round"><div class="tn-rtitle">${titles[i]}</div>${ids.map(mid => tourneyMatchHtml(st, mid, now)).join("")}</div>`).join("");
}
function tourneyRewardsHtml(st, now){
  if (!(st.status === "finished" && now >= tourneyFinalRevealAt(st))) return "";
  const wins = tourneyWins(st);
  return `<div class="who" style="margin-top:10px;"><b>${dc("獎勵", "Rewards")}</b>（${dc("入選 8 強 +1，每贏一輪再 +1", "top-8 +1, +1 per round won")}）</div><div style="font-size:12px;line-height:1.7;">${st.players.slice().sort((x, y) => (wins[y.nick] - wins[x.nick]) || (x.seed - y.seed)).map(p => `${p.nick === st.champion ? "🏆 " : ""}${Iu(p.nick)}：🧩 ×${1 + (wins[p.nick] || 0)}`).join("　")}</div>`;
}
function tourneyPanelHtml(){
  const now = Date.now(), s = tourneySettings, occ = tourneyOccurrence(now, s), viewing = !!tourneyViewState, st = viewing ? tourneyViewState : tourneyState;
  const weekly = dc(`每週${["日", "一", "二", "三", "四", "五", "六"][s.weekday]} ${s.startTime}（GMT+8）`, `Every ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][s.weekday]} ${s.startTime} (GMT+8)`);
  const live = st && ["announced", "running"].includes(st.status), recent = st && st.status === "finished" && now - (st.finishedAt || 0) < 6 * 36e5;
  let body = "";
  if (viewing) body += `<div class="who" style="margin-bottom:6px;"><button class="btn small secondary" data-tourney-back="1">← ${dc("返回", "Back")}</button>　${dc("賽事", "Tournament")} ${Iu(st.id)}${st.champion ? "　🏆 " + Iu(st.champion) : ""}</div>`;
  if (st && st.status === "creating" && !viewing) {
    body += `<div class="who">⏳ ${dc("正在抽出前 8 名、鎖定陣容…", "Drawing the top 8 and locking loadouts…")}</div>`;
  } else if (st && st.matches && (viewing || live || recent)) {
    const first = st.matches.QF1.at, phaseText = now < first ? dc(`8強 ${tourneyClock(first)} 開戰・倒數 ${tourneyCountdown(first - now)}`, `Quarter-finals at ${tourneyClock(first)} · in ${tourneyCountdown(first - now)}`) : st.status === "finished" ? dc("已結束", "Finished") : dc("進行中", "In progress");
    if (!viewing) body += `<div class="who">${dc("本屆", "This one")}：${phaseText}　<span style="color:var(--muted);font-size:12px;">${dc("陣容已鎖定，全程自動進行，選手不用在線", "Loadouts locked · fully automatic, players needn't be online")}</span></div>`;
    if (st.status === "finished" && now >= tourneyFinalRevealAt(st)) { const cp = (st.players || []).find(p => p.nick === st.champion) || {}; pvpEnsureStyleX(); body += `<div class="pvp-result tn-champ"><span class="pvp-avatar" style="display:inline-flex;vertical-align:middle;margin-right:8px;">${M({ avatarId: cp.avatarId })}</span>🏆 ${dc("冠軍", "Champion")}：<b style="color:var(--gold-bright);font-size:17px;">${Iu(st.champion)}</b></div>`; }
    body += tourneyBracketHtml(st, now) + tourneyRewardsHtml(st, now);
  } else {
    body += `<div class="who">${dc("下一屆", "Next")}：<b style="color:var(--gold-bright);">${tourneyDay(occ.next)} ${tourneyClock(occ.next)}</b>　${s.enabled ? dc("倒數", "in") + " " + tourneyCountdown(occ.next - now) : `<span style="color:var(--muted);">${dc("（目前關閉）", "(disabled)")}</span>`}</div>`;
    if (st && st.status === "skipped") body += `<div class="who" style="color:var(--muted);margin-top:4px;">${dc(`上一屆因為有效選手不足而取消（找到 ${st.have}／${st.need} 位）`, `The last one was skipped: not enough eligible players (${st.have}/${st.need})`)}</div>`;
    if (st && st.status === "finished") body += `<div class="who" style="margin-top:4px;">🏆 ${dc("上一屆冠軍", "Last champion")}：<b style="color:var(--gold-bright);">${Iu(st.champion)}</b>　<button class="btn small secondary" data-tourney-view="cur">${dc("看對戰表與重播", "Bracket & replays")}</button></div>`;
  }
  if (tourneyHistory.length && !viewing) body += `<div class="who" style="margin-top:10px;font-size:12px;color:var(--muted);">${dc("歷屆", "Past")}：${tourneyHistory.map(h => `<button class="btn small secondary" data-tourney-view="${Iu(h.id)}" style="margin:2px;">${Iu(h.id.replace(/^w-/, ""))} 🏆${Iu(h.champion || "?")}</button>`).join("")}</div>`;
  return `<div class="panel" id="tourney-card" style="border-color:var(--gold-bright);"><h2>🏆 ${dc("擂臺賽", "Arena Tournament")}</h2><p class="sub">${weekly}${dc("，金字塔前三排（第 1～3 層共 8 人）隨機抽籤對戰：8強 → 4強 → 決賽。每輪三戰兩勝：第 1 局擲骰決定先後手，第 2 局換對方先手，打成 1:1 時第 3 局再擲骰；其餘規則跟競技場相同。入選 8 強得 1 個神秘碎片，每贏一輪再多 1 個，冠軍拿稱號「擂臺霸主」。", ". The 8 holders of pyramid layers 1–3 are drawn at random to fight QF → SF → Final; each round is best-of-3 — a dice roll-off decides who acts first in game 1, the other side goes first in game 2, and a 1–1 tie is settled by a fresh roll-off in game 3; everything else follows Arena rules. Top 8 earn 1 Mystery Shard, +1 per round won; the champion gets the title \"Arena Overlord\".")}</p>${body}<div id="tourney-replay"></div></div>`;
}
let tourneyLastHtml = "";
function tourneyRefreshUi(){
  const root = document.getElementById("tourney-root");
  if (!root) return;
  const replay = root.querySelector("#tourney-replay");
  if (replay && replay.childNodes.length) return;                      // 正在看重播時不重繪，避免打斷
  const ae = document.activeElement; if (ae && ae.tagName === "INPUT" && root.contains(ae)) return;   // 正在輸入下注金額時不重繪
  const html = tourneyPanelHtml();
  if (html === tourneyLastHtml && root.firstChild) return;             // 沒變就不動 DOM
  tourneyLastHtml = html; root.innerHTML = html;
}
async function tourneyLoadHistory(){
  try { tourneyHistory = (await a.listValues("tourney:hist:")).map(r => { try { const s = JSON.parse(r.value); return { id: s.id, champion: s.champion }; } catch (err) { return null; } }).filter(Boolean).sort((x, y) => y.id.localeCompare(x.id)).slice(0, TOURNEY_KEEP); } catch (err) { tourneyHistory = []; }
}
// ===== 觀戰／重播（沿用競技場／切磋的 pvp-* 畫面：頭像卡、血條殘影、飄字傷害、受擊震動、勝者發光）=====
function tnTagOf(info){
  if (info.role === "atk") return dc("挑戰者", "Challenger");
  if (info.role === "def") return dc(`守方・第 ${info.layer} 層`, `Defender · L${info.layer}`) + (info.streak > 0 ? dc(`・連守 ${info.streak} 次`, ` · ${info.streak} defenses`) : "");
  return `#${info.seed} ${dc("種子", "seed")}`;
}
function tnCardHtml(k, info, av){
  const shMax = info.sh || 0, fmtN = n => Math.max(0, Math.round(n || 0)).toLocaleString();
  const shieldHtml = shMax > 0 ? `<div class="pvp-bar pvp-shield" id="tn-${k}-shwrap"><div class="ghost" id="tn-${k}-shghost" style="width:100%"></div><div class="fill" id="tn-${k}-shfill" style="width:100%"></div></div><div class="pvp-shield-text" id="tn-${k}-shtext">🔷 ${dc("護盾", "Shield")} ${fmtN(shMax)} / ${fmtN(shMax)}</div>` : "";
  const pieceHtml = (info.pieces || []).length ? `<div class="pvp-chips">${info.pieces.map(pc => { const qm = ROBE_QUALITY_META[pc.q] || ROBE_QUALITY_META.common, sm = ROBE_SLOT_META[pc.sl] || {}, tm = ROBE_STAT_META[pc.st] || ROBE_STAT_META.defPct, em = elementMeta[pc.el], emIcons = (pc.els && pc.els.length ? pc.els : [pc.el]).map(e => elementMeta[e] ? elementMeta[e].icon : "").join(""); return `<span class="pvp-chip" style="color:${qm.color};border-color:${qm.color};">${sm.icon || ""}${emIcons} ${dc(qm.labelZh, qm.labelEn)} ${tm.icon}${dc(tm.labelZh, tm.labelEn)} ${Math.round((pc.v || 0) * 1000) / 10}%</span>`; }).join("")}</div>` : "";
  const dice = (info.dice || []).map(d => { const qi = so[d.q] || so.common; return `<span class="pvp-chip" style="color:${qi.color};border-color:${qi.color};">${dc(qi.label, qi.labelEn)} ⚔${d.atk} ❤${d.hp}</span>`; }).join("");
  return `<div class="pvp-card" id="tn-${k}-card"><div class="pvp-float-layer" id="tn-${k}-float"></div><div class="pvp-who"><div class="pvp-avatar">${av}</div><div style="min-width:0;"><div class="pvp-name">${Iu(info.nick)}</div><div class="pvp-tag" id="tn-${k}-tag">${tnTagOf(info)}</div></div></div>${shieldHtml}<div class="pvp-bar" id="tn-${k}-wrap"><div class="ghost" id="tn-${k}-ghost" style="width:100%"></div><div class="fill" id="tn-${k}-fill" style="width:100%"></div></div><div class="pvp-bar-text" id="tn-${k}-text">HP ${Math.round(info.maxHp).toLocaleString()} / ${Math.round(info.maxHp).toLocaleString()}</div><div class="pvp-chips">${dice}</div>${pieceHtml}${pvpGearChips(info.gear)}</div>`;
}
function tourneyFrames(log, names, stageLabel, opts){
  opts = opts || {};
  const gTag = opts.total > 1 ? dc(`第 ${opts.n} 局・`, `G${opts.n} · `) : "";
  const frames = [], A = log.a, B = log.b, $ = id => document.getElementById(id), fmt = n => Math.max(0, Math.round(n || 0)).toLocaleString();
  const cur = { a: A.maxHp, b: B.maxHp }, mx = { a: A.maxHp, b: B.maxHp };
  const csh = { a: A.sh || 0, b: B.sh || 0 }, msh = { a: A.sh || 0, b: B.sh || 0 };
  let fx = true, fn = 0;
  const float = (k, text, cls) => { if (!fx) return; const layer = $(`tn-${k}-float`); if (!layer) return; const el = document.createElement("span"); el.className = "pvp-float " + cls; el.textContent = text; el.style.left = `calc(50% + ${((fn++ % 3) - 1) * 26}px)`; layer.appendChild(el); setTimeout(() => el.remove(), 1200); };
  const hitFx = k => { if (!fx) return; const c = $(`tn-${k}-card`); if (!c) return; c.classList.remove("hit"); void c.offsetWidth; c.classList.add("hit"); setTimeout(() => c.classList.remove("hit"), 450); };
  const setHp = (k, hp, crit) => {
    hp = Math.max(0, hp); const d = cur[k] - hp; cur[k] = hp;
    if (d >= 1) { float(k, "-" + fmt(d), crit ? "crit" : "dmg"); hitFx(k); } else if (d <= -1) float(k, "+" + fmt(-d), "heal");
    const pct = Math.max(0, Math.min(100, 100 * hp / (mx[k] || 1))), f = $(`tn-${k}-fill`), g = $(`tn-${k}-ghost`), w = $(`tn-${k}-wrap`), x = $(`tn-${k}-text`), c = $(`tn-${k}-card`);
    f && (f.style.width = pct + "%"); g && (g.style.width = pct + "%"); w && (w.className = "pvp-bar " + pvpBarClass(pct)); x && (x.textContent = `HP ${fmt(hp)} / ${fmt(mx[k])}`); c && c.classList.toggle("dead", hp <= 0);
  };
  const setSh = (k, sh) => {
    if (sh == null || !(msh[k] > 0)) return;   // 沒有護盾（或舊戰報沒記錄）就不動
    sh = Math.max(0, Math.min(msh[k], sh)); const prev = csh[k]; csh[k] = sh;
    const pct = 100 * sh / msh[k], f = $(`tn-${k}-shfill`), g = $(`tn-${k}-shghost`), x = $(`tn-${k}-shtext`);
    f && (f.style.width = pct + "%"); g && (g.style.width = pct + "%"); x && (x.textContent = `🔷 ${dc("護盾", "Shield")} ${fmt(sh)} / ${fmt(msh[k])}`);
    if (prev > 0 && sh <= 0) float(k, "🔷 " + dc("破盾", "Shield broken"), "shield"); else if (prev <= 0 && sh > 0) float(k, "🔷 " + dc("護盾再生", "Shield back"), "shield");
  };
  const active = k => { ["a", "b"].forEach(x => { const c = $(`tn-${x}-card`); c && c.classList.toggle("active", x === k); }); };
  const line = (html, cls) => { const el = $("tn-log"); if (el) { el.insertAdjacentHTML("beforeend", `<div class="${cls || ""}">${html}</div>`); el.scrollTop = el.scrollHeight; } };
  const roundTxt = t => { const el = $("tn-round"); if (el) el.dataset.base !== undefined && (el.textContent = el.dataset.base + (t ? "　" + gTag + t : "")); };
  const setScore = sc => { const el = $("tn-score"); if (!el || !sc || !(opts.total > 1)) return; el.innerHTML = `<b>${Iu(names.a)}</b> <span style="color:var(--gold-bright);font-size:18px;">${sc.a} – ${sc.b}</span> <b>${Iu(names.b)}</b><span style="color:var(--muted);font-size:12px;"> ・ ${dc("三戰兩勝", "Best of 3")}</span>`; };
  const setRoll = (ra, rb, done) => { const el = $("tn-rolloff"); if (!el) return; const wa = done && ra > rb, wb = done && rb > ra; el.innerHTML = `<span>${Iu(names.a)}</span><div class="dice-roll-die ${done ? "settled" : ""} ${wa ? "w" : ""}">${ra}</div><b style="color:var(--muted);">VS</b><div class="dice-roll-die ${done ? "settled" : ""} ${wb ? "w" : ""}">${rb}</div><span>${Iu(names.b)}</span>`; };
  frames.push({ t: 0, run: () => { fx = false; cur.a = A.maxHp; cur.b = B.maxHp; setHp("a", A.maxHp); setHp("b", B.maxHp); csh.a = A.sh || 0; csh.b = B.sh || 0; setSh("a", A.sh || 0); setSh("b", B.sh || 0); ["a", "b"].forEach(k => { const c = $(`tn-${k}-card`); c && c.classList.remove("winner", "dead", "active"); const tg = $(`tn-${k}-tag`); tg && (tg.textContent = tnTagOf(k === "a" ? A : B)); }); const el = $("tn-log"); el && (el.innerHTML = ""); const rs = $("tn-result"); rs && (rs.innerHTML = ""); roundTxt(opts.label || (opts.forced ? dc("輪流先手", "Alternating first move") : dc("擲骰決定先後手", "Roll-off"))); if (opts.forced) { const ro = $("tn-rolloff"); ro && (ro.innerHTML = ""); } else setRoll("?", "?", false); setScore(opts.scoreBefore); fx = true; } });
  let t = 0;
  log.rolloff.forEach((pair, i) => { t += 900; frames.push({ t, run: () => { setRoll(pair[0], pair[1], i === log.rolloff.length - 1 && pair[0] !== pair[1]); if (pair[0] === pair[1]) line(dc("🎲 點數一樣，重擲！", "🎲 Tie — roll again!"), "neg"); } }); });
  t += 1400;
  const fk = log.first, sk = fk === "a" ? "b" : "a", firstName = names[fk], secondName = names[sk];
  frames.push({ t, run: () => { const t1 = $(`tn-${fk}-tag`), t2 = $(`tn-${sk}-tag`); t1 && (t1.textContent += " · " + dc("先手", "1st")); t2 && (t2.textContent += " · " + dc("後手", "2nd")); line(`<b style="color:var(--gold-bright);">${dc(`⚔️ ${Iu(firstName)} 先攻！`, `⚔️ ${Iu(firstName)} goes first!`)}${opts.forced && !opts.label ? ` <span style="color:var(--muted);font-size:12px;">${dc("（輪流先手）", "(alternating)")}</span>` : ""}</b>`); } });
  const act = (who, tgt, s) => { const dice = s.d.map(x => `<span class="pvp-die">${x[0]}</span>`).join(""), extra = (s.crit ? " 💥" + dc("暴擊", "Crit") : "") + (s.combo ? " ✨" + s.combo : ""); return s.blk ? dc(`${Iu(who)} ${dice} 攻擊被 ${Iu(tgt)} 格擋！`, `${Iu(who)} ${dice} blocked by ${Iu(tgt)}!`) : dc(`${Iu(who)} ${dice} → 造成 <b>${s.dmg.toLocaleString()}</b> 傷害${extra}`, `${Iu(who)} ${dice} → <b>${s.dmg.toLocaleString()}</b> damage${extra}`); };
  const hp = (r, crit) => { setHp(fk, r.hf, crit); setHp(sk, r.hs, false); setSh(fk, r.sf); setSh(sk, r.ss); };   // 先手的血量永遠是 hf、後手永遠是 hs
  log.rounds.forEach(r => {
    t += 1300; frames.push({ t, run: q => { fx = !q; active(fk); roundTxt(dc(`第 ${r.r} 回合`, `Round ${r.r}`)); line(`<span class="rn">${dc(`R${r.r}`, `R${r.r}`)}</span>${act(firstName, secondName, r.f)}`, r.f.crit ? "crit" : r.f.blk ? "block" : ""); if (r.f.blk) float(sk, "🛡️ " + dc("格擋", "Block"), "shield"); if (r.s && r.f.par) line(dc(`🛡️⚔️ ${Iu(secondName)} 盾反，回敬 ${r.f.par.toLocaleString()}`, `🛡️⚔️ ${Iu(secondName)} parried for ${r.f.par.toLocaleString()}`), "block"); setHp(sk, r.hs, r.f.crit); setSh(sk, r.ss); fx = true; } });
    if (r.s) { t += 1300; frames.push({ t, run: q => { fx = !q; active(sk); line(`<span class="rn"> </span>${act(secondName, firstName, r.s)}`, r.s.crit ? "crit" : r.s.blk ? "block" : ""); if (r.s.blk) float(fk, "🛡️ " + dc("格擋", "Block"), "shield"); if (r.s.par) line(dc(`🛡️⚔️ ${Iu(firstName)} 盾反，回敬 ${r.s.par.toLocaleString()}`, `🛡️⚔️ ${Iu(firstName)} parried for ${r.s.par.toLocaleString()}`), "block"); hp(r, r.s.crit); fx = true; } }); }
    else frames.push({ t, run: q => { fx = !q; hp(r, false); fx = true; } });
  });
  t += 2200;
  const wk = log.winner, lk = wk === "a" ? "b" : "a", winName = names[wk];
  const headHtml = opts.total > 1 ? (opts.isLast ? "🏆 " + dc(`系列賽勝者：${Iu(winName)}（${opts.scoreAfter.a}–${opts.scoreAfter.b}）`, `Series winner: ${Iu(winName)} (${opts.scoreAfter.a}–${opts.scoreAfter.b})`) : "🏅 " + dc(`本局勝者：${Iu(winName)}（比數 ${opts.scoreAfter.a}–${opts.scoreAfter.b}）`, `Game winner: ${Iu(winName)} (${opts.scoreAfter.a}–${opts.scoreAfter.b})`)) : "🏅 " + dc(`勝者：${Iu(winName)}`, `Winner: ${Iu(winName)}`);
  frames.push({ t, run: () => { fx = false; active(null); hp(log.rounds[log.rounds.length - 1], false); const wc = $(`tn-${wk}-card`); wc && wc.classList.add("winner"); const lc = $(`tn-${lk}-card`); lc && lc.classList.add("dead"); roundTxt(dc("戰鬥結束", "Finished")); setScore(opts.scoreAfter); const w = $("tn-result"); if (w) w.innerHTML = `<div class="pvp-result">${headHtml}${"seed" === log.reason ? `<span class="sub">${dc("血量剛好平手，種子排名高者晉級", "Exact HP tie — higher seed advances")}</span>` : "hp" === log.reason ? `<span class="sub">${dc("回合上限，比剩餘血量", "Round limit — decided on remaining HP")}</span>` : ""}</div>`; fx = true; } });
  return frames;
}
function tourneySeriesFrames(series, names, stageLabel){
  if (!series.games) return tourneyFrames(series, names, stageLabel);   // 舊版單場戰報
  const games = series.games, frames = [], sc = { a: 0, b: 0 }; let off = 0;
  games.forEach((g, i) => {
    const before = { a: sc.a, b: sc.b }; sc[g.winner]++;
    const gf = tourneyFrames(g, names, stageLabel, { n: i + 1, total: games.length, forced: !(g.rolloff && g.rolloff.length), scoreBefore: before, scoreAfter: { a: sc.a, b: sc.b }, isLast: i === games.length - 1 });
    gf.forEach(f => frames.push({ t: f.t + off, run: f.run }));
    off += tourneyPlayMs(g) + TOURNEY_GAME_GAP_MS;
  });
  return frames;
}
async function tourneyPlayFrames(frames, offsetMs, token){
  const start = Date.now() - offsetMs;
  for (const fr of frames) {
    if (token !== tourneyReplayToken) return false;
    const wait = fr.t - (Date.now() - start);
    if (wait > 0) await new Promise(res => setTimeout(res, wait));
    if (token !== tourneyReplayToken) return false;
    fr.run(wait < -600);   // 中途才加入直播時，補播的畫面不要噴一堆飄字
  }
  return true;
}
async function tourneyWatch(mid, opts){
  const st = tourneyViewState || tourneyState;
  if (!st || !st.matches || !st.matches[mid]) return;
  const box = document.getElementById("tourney-replay");
  if (!box) return;
  pvpEnsureStyleX();
  const m = st.matches[mid];
  box.innerHTML = `<div class="who" style="margin-top:8px;">${dc("讀取戰報中…", "Loading…")}</div>`;
  let log = null;
  try { const r = await a.get(tourneyMatchKey(st.id, mid)); log = r ? JSON.parse(r.value) : null; } catch (err) {}
  if (!log) { box.innerHTML = `<div class="who" style="margin-top:8px;color:var(--muted);">${dc("找不到這場的戰報（可能已被清理）", "No battle log found (it may have been cleaned up)")}</div>`; return; }
  const names = { a: log.a.nick, b: log.b.nick }, token = ++tourneyReplayToken, playMs = tourneySeriesPlayMs(log);
  const elapsed = m.result ? Date.now() - m.result.startedAt : playMs + 1, live = !(opts && opts.fromStart) && elapsed >= 0 && elapsed < playMs;
  const avOf = nick => M({ avatarId: ((st.players || []).find(p => p.nick === nick) || {}).avatarId });
  const stageLabel = { QF: dc("8強", "QF"), SF: dc("4強", "SF"), F: dc("決賽", "Final") }[m.stage] + (m.stage === "F" ? "" : " " + mid.slice(-1)) + (log.games ? " · " + dc("三戰兩勝", "Bo3") : "");
  const base = (live ? "🔴 " + dc("直播中", "LIVE") : "▶ " + dc("重播", "Replay")) + "　" + stageLabel;
  box.innerHTML = `<div class="pvp-stage tn-watch"><div class="pvp-head"><span class="pvp-round" id="tn-round" data-base="${Iu(base)}">${base}</span><span style="display:flex;gap:4px;"><button class="btn small secondary pvp-skip" id="tn-again">↺ ${dc("從頭", "Restart")}</button><button class="btn small secondary pvp-skip" id="tn-skip">⏩ ${dc("跳到結果", "Skip")}</button><button class="btn small secondary pvp-skip" id="tn-close">✕</button></span></div><div id="tn-score" class="who" style="text-align:center;margin:4px 0;"></div><div class="pvp-roll" id="tn-rolloff"></div><div class="pvp-arena">${tnCardHtml("a", log.a, avOf(names.a))}<div class="pvp-vs">VS</div>${tnCardHtml("b", log.b, avOf(names.b))}</div><div id="tn-result"></div><div class="pvp-log" id="tn-log"></div></div>`;
  const frames = tourneySeriesFrames(log, names, stageLabel);
  const run = offset => { const tk = ++tourneyReplayToken; tourneyPlayFrames(frames, offset, tk); };
  document.getElementById("tn-close").onclick = () => { tourneyReplayToken++; box.innerHTML = ""; };
  document.getElementById("tn-again").onclick = () => { run(0); };
  document.getElementById("tn-skip").onclick = () => { tourneyReplayToken++; frames.forEach(f => f.run(true)); };
  tourneyReplayToken = token; tourneyPlayFrames(frames, live ? elapsed : 0, token);
  box.scrollIntoView && box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
function tourneyMount(){
  tourneyLastHtml = "";
  tourneyLoadSettings().then(() => tourneyReadState()).then(() => tourneyLoadHistory()).then(() => { tourneyRefreshUi(); tourneyTick(true); }).catch(() => {});
  if (!tourneyUiTimer) tourneyUiTimer = setInterval(() => { if (document.getElementById("tourney-root")) tourneyRefreshUi(); }, 1000);
}
function tourneyWire(rootEl){
  if (!rootEl || rootEl.__tnWired) return;
  rootEl.__tnWired = true;
  rootEl.addEventListener("input", ev => {
    const el = ev.target;
    if (!el || !el.id || !el.id.startsWith("tn-bet-amt-")) return;
    const mid = el.id.slice("tn-bet-amt-".length), m = tourneyState && tourneyState.matches && tourneyState.matches[mid], prev = document.getElementById("tn-bet-prev-" + mid);
    tourneyBetDraft[mid] = el.value;
    if (m && m.odds && prev) { const amt = Math.floor(Number(el.value)) || 0, nn = x => Number(x).toLocaleString(); prev.textContent = dc(`中獎可得：${m.a} ✦${nn(Math.floor(amt * m.odds.oa))}　${m.b} ✦${nn(Math.floor(amt * m.odds.ob))}`, `Payout if it wins: ${m.a} ✦${nn(Math.floor(amt * m.odds.oa))}  ${m.b} ✦${nn(Math.floor(amt * m.odds.ob))}`); }
  });
  rootEl.addEventListener("click", async ev => {
    const btn = ev.target.closest && ev.target.closest("button");
    if (!btn) return;
    if (btn.dataset.tourneyBet) { tourneyBetClick(btn.dataset.tourneyBet, btn.dataset.side); return; }
    if (btn.dataset.tourneyWatch) tourneyWatch(btn.dataset.tourneyWatch);
    else if (btn.dataset.tourneyBack) { tourneyViewState = null; tourneyRefreshUi(); }
    else if (btn.dataset.tourneyView) {
      const id = btn.dataset.tourneyView;
      if (id === "cur") { tourneyViewState = tourneyState; }
      else { try { const r = await a.get("tourney:hist:" + id); tourneyViewState = r ? JSON.parse(r.value) : null; } catch (err) {} }
      const rp = document.getElementById("tourney-replay"); if (rp) rp.innerHTML = "";
      tourneyRefreshUi();
    }
  });
}
// ===== GM 面板 =====
async function tourneyGmPanelHtml(){
  await tourneyLoadSettings(true); const st = await tourneyReadState(), s = tourneySettings, wd = ["日", "一", "二", "三", "四", "五", "六"];
  const status = !st ? dc("（還沒有紀錄）", "(none yet)") : `${Iu(st.id)}・${Iu(st.status)}${st.test ? "・" + dc("測試賽", "test") : ""}`;
  return `<div class="panel"><h2>🏆 ${dc("擂臺賽控制", "Tournament control")}</h2><p class="sub">${dc("每週固定時間自動由金字塔前三排 8 人隨機抽籤對戰。時間以 GMT+8 計。", "Every week the 8 holders of pyramid layers 1–3 are drawn at random. Times are GMT+8.")}</p>
    <div class="who" style="margin:6px 0;">${dc("目前狀態", "Current")}：<b>${status}</b></div>
    <div class="form-row"><label style="display:flex;gap:6px;align-items:center;"><input type="checkbox" id="tn-gm-enabled" ${s.enabled ? "checked" : ""}/> ${dc("啟用", "Enabled")}</label>
      <div><label>${dc("星期", "Day")}</label><select id="tn-gm-weekday">${wd.map((n, i) => `<option value="${i}" ${s.weekday === i ? "selected" : ""}>${dc("週" + n, "Day " + i)}</option>`).join("")}</select></div>
      <div><label>${dc("開賽時間（HH:MM）", "Start (HH:MM)")}</label><input type="text" id="tn-gm-time" value="${Iu(s.startTime)}" style="width:80px;"/></div></div>
    <div class="form-row"><div><label>${dc("公布名單到開戰的等待（分鐘）", "Wait before each stage (min)")}</label><input type="number" id="tn-gm-wait" min="0" step="1" value="${s.waitMin}" style="width:90px;"/></div>
      <div><label>${dc("每階段對戰預留（分鐘）", "Time reserved per stage (min)")}</label><input type="number" id="tn-gm-fight" min="1" step="1" value="${s.fightMin}" style="width:90px;"/></div>
      <div><label>${dc("最少競技場戰績場數", "Min. arena fights")}</label><input type="number" id="tn-gm-min" min="0" step="1" value="${s.minMatches}" style="width:90px;"/></div></div>
    <div class="who" style="color:var(--muted);font-size:12px;margin:4px 0;">${dc("三戰兩勝一輪最長約 1.5 分鐘，預留時間建議至少 2 分鐘。整場約 = 等待×3 + 預留×2 + 決賽。", "A best-of-3 round plays up to ~1.5 min; reserve at least 2 min. Whole event ≈ wait×3 + reserve×2 + final.")}</div>
    <div class="who" style="margin:10px 0 4px;"><b>🎫 ${dc("下注", "Betting")}</b></div>
    <div class="form-row"><label style="display:flex;gap:6px;align-items:center;"><input type="checkbox" id="tn-gm-bet" ${s.betEnabled ? "checked" : ""}/> ${dc("開放下注", "Betting on")}</label>
      <div><label>${dc("最低下注", "Min bet")}</label><input type="number" id="tn-gm-minbet" min="1" step="100" value="${s.minBet}" style="width:100px;"/></div>
      <div><label>${dc("最高下注", "Max bet")}</label><input type="number" id="tn-gm-maxbet" min="1" step="1000" value="${s.maxBet}" style="width:110px;"/></div>
      <div><label>${dc("每場每邊最高賠付", "Max payout per side")}</label><input type="number" id="tn-gm-exp" min="1" step="100000" value="${s.maxExposure}" style="width:130px;"/></div>
      <div><label>${dc("莊家抽成 %", "House edge %")}</label><input type="number" id="tn-gm-edge" min="0" max="40" step="1" value="${s.edgePct}" style="width:80px;"/></div></div>
    <div class="who" style="color:var(--muted);font-size:12px;margin:4px 0;">${dc("賠率＝模擬對戰算出的整輪（三戰兩勝）勝率，扣掉抽成；一邊勝率超過 92% 的比賽不開放下注。每人每場一注，開戰後截止。賠率一旦公布就不變。", "Odds come from the simulated best-of-3 series win probability minus the edge; matches where one side is above 92% are not open for betting. One bet per player per match, closed at the start. Odds are fixed once published.")}</div>
    <div class="form-row"><button class="btn small" id="tn-gm-save">${dc("儲存設定", "Save")}</button>
      <button class="btn small secondary" id="tn-gm-test">🧪 ${dc("立即開一場測試賽（等待縮短、不發獎勵、不換稱號）", "Start a test tournament now (short waits, no rewards / title)")}</button>
      <button class="btn small secondary" id="tn-gm-cancel" style="border-color:var(--danger);color:#ff8080;">${dc("取消目前這一屆", "Cancel current")}</button></div></div>`;
}
function tourneyWireGm(){
  const $ = id => document.getElementById(id), save = $("tn-gm-save");
  if (!save) return;
  save.onclick = async () => {
    const s = tourneySettings, t = tourneyTimeOf($("tn-gm-time").value);
    s.enabled = $("tn-gm-enabled").checked; s.weekday = parseInt($("tn-gm-weekday").value, 10) || 0; s.startTime = String(t.h).padStart(2, "0") + ":" + String(t.mi).padStart(2, "0");
    s.waitMin = Math.max(0, parseFloat($("tn-gm-wait").value) || 0); s.fightMin = Math.max(1, parseFloat($("tn-gm-fight").value) || 2); s.minMatches = Math.max(0, parseInt($("tn-gm-min").value, 10) || 0);
    s.betEnabled = $("tn-gm-bet").checked; s.minBet = Math.max(1, parseInt($("tn-gm-minbet").value, 10) || 1000); s.maxBet = Math.max(s.minBet, parseInt($("tn-gm-maxbet").value, 10) || 1000000); s.maxExposure = Math.max(s.maxBet, parseInt($("tn-gm-exp").value, 10) || 10000000); s.edgePct = Math.min(40, Math.max(0, parseFloat($("tn-gm-edge").value) || 0));
    try { await tourneySaveSettings(); ac(dc("✅ 擂臺賽設定已儲存", "✅ Tournament settings saved")); } catch (err) { ac(dc("儲存失敗", "Save failed")); }
    Bu();
  };
  $("tn-gm-test").onclick = async () => {
    if (!window.confirm(dc("要現在開一場測試賽嗎？會用目前競技場前 8 名，等待縮短為 1 分鐘，不發獎勵。", "Start a test tournament now? Uses the current top 8, 1-minute waits, no rewards."))) return;
    const st = await tourneyCreate(Date.now(), { test: true, waitMs: 6e4, fightMs: 6e4 });
    ac(st && st.status === "announced" ? dc("🧪 測試賽已建立", "🧪 Test tournament created") : dc("沒有建立成功：" + (st && st.status === "skipped" ? `有效選手不足（${st.have}/8）` : "已有進行中的賽事"), "Not created: " + (st && st.status === "skipped" ? `not enough players (${st.have}/8)` : "one is already running")));
    Bu();
  };
  $("tn-gm-cancel").onclick = async () => {
    if (!window.confirm(dc("確定要取消目前這一屆嗎？（不發獎勵）", "Cancel the current tournament? (no rewards)"))) return;
    await Vl(TOURNEY_CUR_KEY, cur => { const st = cur ? JSON.parse(cur) : null; if (!st || ["finished", "cancelled", "skipped"].includes(st.status)) return cur; st.status = "cancelled"; return JSON.stringify(st); }, "null");
    ac(dc("已取消", "Cancelled")); tourneyState = null; Bu();
  };
}
if (typeof document !== "undefined") setInterval(() => { if (zl.nickname && zl.player) tourneyTick().catch(() => {}); }, 10000);

// 競技場分成兩頁（跟賽馬場／輪盤一樣，頂部切換）：第一頁＝競技場，第二頁＝擂臺賽
function tourneyIsLive(){ const st = tourneyState; return !!(st && st.matches && ["announced", "running"].includes(st.status) && Date.now() >= st.startAt); }
function tourneyBannerHtml(){
  const st = tourneyState, now = Date.now(), s = tourneySettings, occ = tourneyOccurrence(now, s);
  let text;
  if (tourneyIsLive()) text = `<b style="color:#ff8080;">🔴 ${now < st.matches.QF1.at ? dc(`即將開戰（${tourneyClock(st.matches.QF1.at)} 8強）`, `starting soon (QF at ${tourneyClock(st.matches.QF1.at)})`) : dc("進行中，可以觀戰、下注", "in progress — watch and bet")}</b>`;
  else if (st && st.status === "finished" && now - (st.finishedAt || 0) < 6 * 36e5 && now >= tourneyFinalRevealAt(st)) text = dc(`上一屆冠軍 <b style="color:var(--gold-bright);">${Iu(st.champion)}</b>`, `last champion <b style="color:var(--gold-bright);">${Iu(st.champion)}</b>`);
  else text = s.enabled ? dc(`下一屆 ${tourneyDay(occ.next)} ${tourneyClock(occ.next)}`, `next: ${tourneyDay(occ.next)} ${tourneyClock(occ.next)}`) : dc("目前關閉", "currently off");
  return `<div class="who" style="margin:8px 0;padding:8px 10px;border:1px solid var(--gold-bright);border-radius:10px;display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap;"><span>🏆 ${dc("擂臺賽", "Tournament")}：${text}</span><button class="btn small" data-arn-view="tournament">${dc("前往", "Open")} ▶</button></div>`;
}
let arnSubviewFor = null;
async function arnRenderTab(e){
  zl.arnView || (zl.arnView = "arena");
  const view = zl.arnView;
  const navHtml = `<div class="tabs" style="margin:0 0 14px;"><div class="tab ${"arena" === view ? "active" : ""}" data-arn-view="arena">⚔️ ${dc("競技場", "Arena")}</div><div class="tab ${"tournament" === view ? "active" : ""}" data-arn-view="tournament">🏆 ${dc("擂臺賽", "Tournament")}${tourneyIsLive() ? " 🔴" : ""}</div><div class="tab ${"loadout" === view ? "active" : ""}" data-arn-view="loadout">🧭 ${dc("佈陣", "Lineups")}</div><div class="tab ${"gear" === view ? "active" : ""}" data-arn-view="gear">🛡️ ${dc("魔法裝備", "Magic Gear")}</div><div class="tab ${"dice" === view ? "active" : ""}" data-arn-view="dice">🎲 ${dc("骰子", "Dice")}</div></div>`;
  const wireNav = () => { e.querySelectorAll("[data-arn-view]").forEach(btn => { btn.onclick = () => { if (zl.arnView !== btn.dataset.arnView) { zl.arnView = btn.dataset.arnView; Bu(); } }; }); };
  const ready = !!document.getElementById("arn-subview") && arnSubviewFor === view && e.contains(document.getElementById("arn-subview"));
  if (!ready) { e.innerHTML = `${navHtml}<div id="arn-subview"></div>`; arnSubviewFor = view; }
  wireNav();   // 不管有沒有重畫都重新綁：Eu() 會用舊 HTML 字串還原頁面，元素還在但點擊事件沒了，導致魔法裝備／擂臺賽／骰子頁的上方切換鈕失效
  const sub = document.getElementById("arn-subview");
  try {
    if ("tournament" === view) {
      if (!ready || !document.getElementById("tourney-root")) { sub.innerHTML = `<div id="tourney-root">${tourneyPanelHtml()}</div>`; tourneyWire(document.getElementById("tourney-root")); tourneyMount(); }
      else tourneyRefreshUi();   // 已經在這一頁：只更新內容，不重畫（正在看的重播不會被洗掉）
    } else if ("loadout" === view) {
      sub.innerHTML = pvpLoadoutPanelHtml(); pvpLoadoutWire(sub);
    } else if ("gear" === view) {
      sub.innerHTML = robeGearPanelHtml(); robeGearWire(sub);
    } else if ("dice" === view) {
      Yo(sub); pvpGotoWire(sub);
    } else { await pyrRenderTabCore(sub); wireNav(); }
  } finally {
    ("tournament" === view ? gmDockSync(e, "tn", tourneyGmPanelHtml, tourneyWireGm) : "gear" === view ? gmDockSync(e, "rg", robeGmPanelHtml, robeGmWirePanel) : gmDockSync(e, "arn", pyrGmPanelHtml, pyrWireGmPanel)).catch(() => {});
  }
}
async function arnRenderTabCore(e){arnSubviewEntered||(e.innerHTML=`<div class="panel"><p class="sub">${dc("讀取競技場資料中…","Loading Arena…")}</p></div>`,arnSubviewEntered=!0);await arnLoadSettings();const season=await arnGetSeason(),myNick=zl.nickname;let me=zl.player;if(!me)return;if(kt(me),me.arenaSeasonId!==season.seasonId){const updated=await arnEnsurePlayerSeason(myNick,season.seasonId);updated&&(zl.player=updated,me=updated)}const attacksLeft=Math.max(0,(arnSettings.dailyFreeAttacks||0)-(me.arenaAttacksUsedToday||0)),slotsSet=(me.arenaDiceSlots||[]).some(id=>id&&me.dice&&me.dice[id]),attackReady=(me.diceSlots||[]).some(id=>id&&me.dice&&me.dice[id]),daysLeft=Math.max(0,Math.ceil((season.endAt-Date.now())/864e5));arnOpponents||(arnOpponents=await arnFindOpponents(season.seasonId,myNick,me.arenaRating||1e3),await arnAttachOpponentAvatars(arnOpponents));let board=[];try{board=await arnGetLeaderboard(season.seasonId,10)}catch(err){}let html=`<div class="panel"><h2>⚔️ ${dc("競技場","Arena")}</h2><p class="sub">${dc("非同步 PvP，不需要對手在線。選一位對手，立即出結果。","Asynchronous PvP — no need for your opponent to be online. Pick a target and get an instant result.")}</p>${tourneyBannerHtml()}<div class="who" style="margin:8px 0;">${dc("目前積分","Current rating")}：<b style="color:var(--gold-bright);">${me.arenaRating||1e3}</b> ・ ${dc("戰績","Record")} ${me.arenaWins||0}${dc("勝","W")} / ${me.arenaLosses||0}${dc("敗","L")}</div><div class="who">${dc("距離每週一重置","Weekly reset in")}：${daysLeft} ${dc("天","day(s)")}</div><div class="who">${dc("今日剩餘出手次數","Attacks left today")}：${ku()?dc("無限（GM）","Unlimited (GM)"):`${attacksLeft} / ${arnSettings.dailyFreeAttacks||0}`}</div>`;html+=arnBattleReportHtml(arnLastBattleResult),slotsSet||(html+=`<div class="farm-upgrade-box" style="border-color:var(--danger);"><div class="farm-upgrade-line" style="color:var(--danger);">${dc("尚未設定競技場防守佈陣，被其他玩家挑戰時將沒有骰子可用，請先到下方選擇一組防守用的裝備組合","You haven't set your Arena defense loadout yet — you'll have no dice when challenged, please pick a defense loadout below first")}</div></div>`),html+=arnDiceSlotPickerHtml(me),html+=`<div class="who" style="margin:14px 0 6px;">🎯 ${dc("候選對手","Candidate Opponents")}</div>`,html+=arnOpponents.length?arnOpponents.map(op=>{const label=op.isBot?op.displayName||op.nickname:op.nickname,nameHtml=op.isBot?`<div>${Iu(label)}</div>`:`<div data-view-profile="${Iu(op.nickname)}" style="cursor:pointer;text-decoration:underline dotted;">${Iu(label)}</div>`;return `<div class="listing"><div class="left"><div class="icon-box">${op.isBot?"🤖":E(op.avatarId)}</div><div class="meta">${nameHtml}<div class="who">${dc("積分","Rating")} ${op.rating} · ${op.wins||0}${dc("勝","W")}/${op.losses||0}${dc("敗","L")}${op.isBot?" · "+dc("練習對手","Practice bot"):""}</div></div></div><div class="right"><button class="btn small" data-arn-attack="${Iu(op.nickname)}" ${attackReady&&(attacksLeft>0||ku())?"":"disabled"}>${dc("挑戰","Attack")}</button></div></div>`}).join(""):`<p class="sub">${dc("暫時找不到適合的對手，稍後再試","No suitable opponents found right now — try again later")}</p>`,html+=ku()?`<div class="farm-upgrade-box" style="margin-top:10px;border-color:var(--gold-bright);"><div class="farm-upgrade-line" style="color:var(--gold-bright);">⚡ GM: ${dc("指定對手挑戰","Challenge specific player")}</div><div class="form-row" style="margin-top:6px;"><input type="text" id="arn-gm-target-input" placeholder="${dc("輸入玩家暱稱","Enter player nickname")}" style="flex:1;min-width:140px;" /><button class="btn small" id="arn-gm-target-btn">${dc("挑戰","Attack")}</button></div></div>`:"",html+=`<button class="btn small secondary" id="arn-reroll-btn" style="margin-top:8px;">${dc("🔄 換一批對手","🔄 New Opponents")}</button>`,html+=`<div class="who" style="margin:14px 0 6px;">🏆 ${dc("本週排行榜","Weekly Leaderboard")}</div>`,html+=arnLeaderboardHtml(board,myNick),html+="</div>",e.innerHTML=html,arnWireTab(e)}
function arnWireTab(e){e.querySelectorAll("[data-arn-attack]").forEach(btn=>{btn.onclick=async()=>{btn.disabled=!0;try{const res=await arnAttack(btn.dataset.arnAttack);if(res.error){const msgMap={noattacks:dc("今日出手次數已用完","No attacks left today"),nodefender:dc("找不到這位對手","Opponent not found"),badtarget:dc("無效的目標","Invalid target"),gmimmune:dc("GM 無法被玩家挑戰","GM cannot be challenged by players"),noseason:dc("競技場賽季尚未開放","Arena season not available"),player:dc("讀取角色資料失敗，請重新整理","Failed to load your character, please refresh"),noloadout:dc("請先到「骰子」分頁裝備至少 1 顆骰子再出手挑戰","Please equip at least 1 die in the Dice tab before attacking"),ratingindex:dc("讀取積分資料失敗，請再試一次","Failed to load rating data, please try again")};ac(msgMap[res.error]||dc("挑戰失敗，請再試一次","Attack failed, please try again"))}else{arnLastBattleResult=res;await arnPlayBattleAnimation(res,e);const won="attacker"===res.winner;ac(dc(`${won?"🎉 勝利！":"💔 落敗"} 對戰 ${res.defenderNickname}：積分 ${res.ratingChange.attacker>=0?"+":""}${res.ratingChange.attacker}`,`${won?"🎉 Victory!":"💔 Defeat"} vs ${res.defenderNickname}: rating ${res.ratingChange.attacker>=0?"+":""}${res.ratingChange.attacker}`),{legendary:won}),arnOpponents=null}}catch(err){ac(dc("挑戰失敗，請再試一次","Attack failed, please try again"))}Bu()}});const rerollBtn=document.getElementById("arn-reroll-btn");rerollBtn&&(rerollBtn.onclick=()=>{arnOpponents=null,Bu()});const gmTargetBtn=document.getElementById("arn-gm-target-btn");gmTargetBtn&&(gmTargetBtn.onclick=async()=>{const inputEl=document.getElementById("arn-gm-target-input"),target=inputEl&&inputEl.value&&inputEl.value.trim();if(!target)return void ac(dc("請輸入玩家暱稱","Please enter a player nickname"));gmTargetBtn.disabled=!0;try{const res=await arnAttack(target);if(res.error){const msgMap={noattacks:dc("今日出手次數已用完","No attacks left today"),nodefender:dc("找不到這位對手","Opponent not found"),badtarget:dc("無效的目標","Invalid target"),gmimmune:dc("GM 無法被玩家挑戰","GM cannot be challenged by players"),noseason:dc("競技場賽季尚未開放","Arena season not available"),player:dc("讀取角色資料失敗，請重新整理","Failed to load your character, please refresh"),noloadout:dc("請先到「骰子」分頁裝備至少 1 顆骰子再出手挑戰","Please equip at least 1 die in the Dice tab before attacking"),ratingindex:dc("讀取積分資料失敗，請再試一次","Failed to load rating data, please try again")};ac(msgMap[res.error]||dc("挑戰失敗，請再試一次","Attack failed, please try again"))}else{arnLastBattleResult=res;await arnPlayBattleAnimation(res,e);const won="attacker"===res.winner;ac(dc(`${won?"🎉 勝利！":"💔 落敗"} 對戰 ${res.defenderNickname}：積分 ${res.ratingChange.attacker>=0?"+":""}${res.ratingChange.attacker}`,`${won?"🎉 Victory!":"💔 Defeat"} vs ${res.defenderNickname}: rating ${res.ratingChange.attacker>=0?"+":""}${res.ratingChange.attacker}`),{legendary:won}),arnOpponents=null}}catch(err){ac(dc("挑戰失敗，請再試一次","Attack failed, please try again"))}Bu()});const copyBossLoadoutBtn=document.getElementById("arn-copy-boss-loadout-btn");copyBossLoadoutBtn&&(copyBossLoadoutBtn.onclick=async()=>{if(!zl.nickname||!zl.player)return;copyBossLoadoutBtn.disabled=!0;try{let err=null;const updated=await Wl(zl.nickname,p=>{const bossSlots=(p.diceSlots||[null,null,null]).map(id=>id&&p.dice[id]?id:null);if(!bossSlots.some(id=>id))return void(err="empty");p.arenaDiceSlots=bossSlots.slice(0,3);while(p.arenaDiceSlots.length<3)p.arenaDiceSlots.push(null)});if(!updated)return void ac(dc("套用失敗，請重新整理後再試","Failed to apply, refresh and try again"));if(err)return void ac(dc("你目前身上沒有裝備任何骰子","You don't have any dice equipped right now"));zl.player=updated,ac(dc("已套用目前裝備到競技場防守佈陣","Currently equipped dice applied to your Arena defense loadout")),Bu()}finally{copyBossLoadoutBtn.disabled=!1}}),e.querySelectorAll("[data-arn-load-combo]").forEach(btn=>{btn.onclick=async()=>{if(!zl.nickname||!zl.player)return;btn.disabled=!0;try{const idx=parseInt(btn.dataset.arnLoadCombo,10);let err=null,label="";const updated=await Wl(zl.nickname,p=>{const loadouts=Array.isArray(p.diceLoadouts)?p.diceLoadouts:[];const lo=loadouts[idx];const combo=lo&&typeof lo==="object"&&!Array.isArray(lo)?lo:{name:"",dice:Array.isArray(lo)?lo:[null,null,null]};const comboDice=(combo.dice||[null,null,null]).map(id=>id&&p.dice[id]?id:null);if(!comboDice.some(id=>id))return void(err="empty");label=combo.name&&combo.name.trim()?combo.name.trim():dc(`組合 ${idx+1}`,`Combo ${idx+1}`);p.arenaDiceSlots=comboDice.slice(0,3);while(p.arenaDiceSlots.length<3)p.arenaDiceSlots.push(null)});if(!updated)return void ac(dc("套用失敗，請重新整理後再試","Failed to apply, refresh and try again"));if(err)return void ac(dc("這組裝備組合是空的","This loadout is empty"));zl.player=updated,ac(dc(`已將「${label}」設為競技場防守佈陣`,`"${label}" is now your Arena defense loadout`)),Bu()}finally{btn.disabled=!1}}}),e.querySelectorAll("[data-arn-equip-dice]").forEach(btn=>{btn.onclick=async()=>{if(!zl.nickname||!zl.player)return;const id=btn.dataset.arnEquipDice,slotIdx=parseInt(btn.dataset.arnEquipSlot,10);let err=null;const updated=await Wl(zl.nickname,p=>{if(!p.dice[id])return void(err="missing");p.arenaDiceSlots=(p.arenaDiceSlots||[null,null,null]).map((s,i)=>i===slotIdx?id:s===id?null:s)});updated&&!err&&(zl.player=updated),Bu()}}),e.querySelectorAll("[data-arn-unequip-slot]").forEach(btn=>{btn.onclick=async()=>{if(!zl.nickname||!zl.player)return;const idx=parseInt(btn.dataset.arnUnequipSlot,10);if(!(idx>=0&&idx<3))return;const updated=await Wl(zl.nickname,p=>{Array.isArray(p.arenaDiceSlots)&&3===p.arenaDiceSlots.length||(p.arenaDiceSlots=[null,null,null]),p.arenaDiceSlots[idx]=null});updated&&(zl.player=updated),Bu()}})}