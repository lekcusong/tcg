
/* ===== ⚗️ 煉金藥水排序 — end ===== */

/* ===== 🎱 塔羅彈珠 Ball Pit — 把「塔羅彈珠專用的」卡牌當彈珠打怪（Ball x Pit 風格）=====
   【獨立經濟】彈珠有自己的一套：💠彈珠幣、📦材料、27 張彈珠專屬卡牌（player.bpCards / bpCardLv）、永久強化（bpMeta）。
   這些跟正式版的金幣、真實卡牌收藏、成品完全分開，彈珠幣不能兌換成正式金幣。
   【對外獎勵（保守）】每天依「當日新達成的最高層數」發一份有上限的正式版金幣＋成品（OUT_*），GM 可調。
   【防作弊】開局用 Wl（CAS）寫入 player.bpRun.startedAt 並「開局就扣次數」；結算時時間以伺服器存的 startedAt 為準
   （不信客戶端回報的秒數），層數受「每層最短秒數」夾住，彈珠幣受「每秒上限」夾住，里程碑金幣有層數上限。
   平衡數值集中在下面的常數與 GM 面板（config:ballpit_settings）。 */
const BP = (function () {
"use strict";
const CARD_DEFS = [
  ["c1", "common", "🍃", "權杖二"], ["c2", "common", "💧", "聖杯三"], ["c3", "common", "🔥", "寶劍四"], ["c4", "common", "🌊", "錢幣五"],
  ["u1", "uncommon", "🌙", "女祭司"], ["u2", "uncommon", "👑", "皇后"], ["u3", "uncommon", "🏛️", "皇帝"],
  ["r1", "rare", "🐎", "戰車"], ["r2", "rare", "🦁", "力量"], ["r3", "rare", "🏮", "隱者"],
  ["e1", "epic", "🎩", "魔術師"], ["e2", "epic", "☀️", "太陽"], ["e3", "epic", "🌍", "世界"], ["e4", "epic", "⭐", "星星"],
  ["c5", "common", "🔱", "權杖王牌"], ["c6", "common", "🍷", "聖杯七"], ["c7", "common", "🗡️", "寶劍九"], ["c8", "common", "🏅", "錢幣十"],
  ["u4", "uncommon", "📜", "教皇"], ["u5", "uncommon", "💞", "戀人"], ["u6", "uncommon", "⚖️", "正義"],
  ["r4", "rare", "🙃", "吊人"], ["r5", "rare", "🍶", "節制"], ["r6", "rare", "😈", "惡魔"],
  ["e5", "epic", "💀", "死神"], ["e6", "epic", "🗼", "高塔"], ["e7", "epic", "🌕", "月亮"]
];
const v = Object.fromEntries(CARD_DEFS.map(([id, rarity, icon, name]) => [id, { id, rarity, icon, name }]));
const W = 360, H = 540, CEIL = 34, COLS = 6, CW = W / COLS, RH = 34, GRID_TOP = CEIL + 4, PIT_ROW = 11, PIT_MAX = 13, SHOOT_Y = H - 26, BALL_R = 7;
const LOADOUT_BASE = 3, DRAW_COST = 400, CARD_MAX = 15, BASE_SPEED = 520, FIRE_GAP = 0.085;
// 難度：前 HARD_FROM 層維持原本的 1.07 成長；之後每層血量再乘 HARD_RATE（GM 可調）。60 層上限內要拉到原本約 100+ 層的強度
let HARD_FROM = 20, HARD_RATE = 1.16;
const MAX_FLOOR = 60, GOLD_PER_KILL = 5, GOLD_PER_FLOOR = 20, WIN_BONUS = 250;
// 下面這些 GM 可在面板調整（config:ballpit_settings）
let RANK_SHARDS = [3, 2, 1];   // 每日排行榜第 1／2／3 名的神秘碎片數（GM 可調）
let DAILY_PLAYS = 3, MAX_GOLD_PER_SEC = 40, GOLD_PER_ITEM_ROLL = 400, ITEM_MEDIUM_CHANCE = 0.18, MAX_RUN_SEC = 3600, MIN_SEC_PER_FLOOR = 1.0, LB_MIN_SEC_PER_FLOOR = 2.0, MILESTONE_FLOOR_CAP = 100, OUT_COIN_PER_FLOOR = 20, OUT_FLOOR_CAP = 40, OUT_FLOORS_PER_ITEM = 10, START_COINS = 600, AFFIX_ON = true;
const RC = { common: "#8a94a6", uncommon: "#4fb286", rare: "#4a90e2", epic: "#b98cf0", legendary: "#e8c468" };
const RK = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
const EN_ICONS = ["👻", "💀", "👹", "👾", "👿"];
const TYPE_INFO = {
  common:   { zh: "基礎", en: "Plain",  dz: "穩定的單體傷害", de: "Steady single-target hits" },
  uncommon: { zh: "穿透", en: "Pierce", dz: "穿過第一個敵人再反彈", de: "Passes through the first enemy" },
  rare:     { zh: "爆裂", en: "Burst",  dz: "同時波及周圍敵人", de: "Splashes adjacent enemies" },
  epic:     { zh: "連鎖", en: "Chain",  dz: "電弧彈到附近敵人", de: "Lightning arcs to nearby enemies" }
};
const TYPE_FX = { common: { pierce: 0, splash: 0, chain: 0 }, uncommon: { pierce: 1, splash: 0, chain: 0 }, rare: { pierce: 0, splash: 1, chain: 0 }, epic: { pierce: 0, splash: 0, chain: 1 } };
const SP = {
  bounce:   ["動能", "Momentum", "每撞牆 2 次，傷害 +1", "+1 dmg per 2 wall bounces"],
  frost:    ["脆化", "Brittle", "命中使敵人脆化，下一次受到雙倍傷害", "Hit makes the enemy brittle: next hit deals double"],
  burn:     ["灼燒", "Burn", "命中使敵人燃燒 3 輪，每輪結束受傷", "Sets enemy ablaze for 3 volleys"],
  gold:     ["財運", "Fortune", "命中有 20% 機率額外掉金幣", "20% chance for bonus gold on hit"],
  homing:   ["追蹤", "Homing", "靠近敵人時會自動轉向", "Curves toward nearby enemies"],
  knock:    ["擊退", "Knockback", "命中把敵人往上推一排（上方有空位時）", "Pushes the enemy up a row if free"],
  execute:  ["斬殺", "Execute", "命中血量 30% 以下的敵人直接擊殺（BOSS 除外）", "Kills non-boss enemies below 30% HP"],
  split:    ["分裂", "Split", "命中有 30% 機率分出一顆半傷害的分身", "30% chance to spawn a half-damage clone"],
  beam:     ["烈日", "Sunbeam", "命中有 20% 機率射出橫向光束，傷害同排所有敵人", "20% chance for a beam hitting the whole row"],
  "return": ["迴響", "Echo", "掉出底部時會彈回一次", "Bounces back once when it falls out"],
  starfall: ["星墜", "Starfall", "擊殺時引星光砸向 2 個隨機敵人", "On kill, stars hit 2 random enemies"],
  crit:     ["威權", "Authority", "這顆彈珠暴擊率 +30%", "+30% crit chance for this ball"],
  poison:   ["劇毒", "Venom", "命中使敵人中毒（可疊 5 層），每輪結束受傷後層數 -1", "Poisons on hit (up to 5 stacks); hurts each volley, then loses a stack"],
  vamp:     ["汲取", "Siphon", "命中有 10% 機率回復少量血量", "10% chance to heal a little on hit"],
  grow:     ["成長", "Growth", "本輪每命中一次，這顆彈珠傷害 +8%（上限 15 次）", "+8% damage per hit this volley (max 15 hits)"],
  stun:     ["暈眩", "Stun", "命中有 25% 機率讓敵人下一次攻擊落空（BOSS 除外）", "25% chance to make an enemy miss its next attack (not bosses)"],
  mercy:    ["慈悲", "Mercy", "擊殺敵人時回復血量", "Heal when this ball kills an enemy"],
  lance:    ["貫雷", "Lance", "命中有 15% 機率射出直線光束，傷害同欄所有敵人", "15% chance for a vertical beam hitting the whole column"],
  swift:    ["疾風", "Swift", "這顆彈珠速度 +25%", "This ball flies 25% faster"]
};
const SP_OLD = Object.keys(SP);   // 舊的 19 個特效：第 2、3 特效的輪轉仍以此為準，避免改動玩家既有卡牌的效果
Object.assign(SP, {
  magnet:    ["磁吸", "Magnet", "命中有 35% 機率把同排其他敵人往這隻拉近一格（有空位時）", "35% chance to pull same-row enemies one column toward the target"],
  ice:       ["冰封", "Freeze", "命中使敵人下一輪不前進，後面的怪會被擋住（BOSS 與最上兩排除外）", "Hit enemy skips its next advance and blocks those behind (not bosses / top 2 rows)"],
  blast:     ["爆魂", "Soulburst", "擊殺敵人時爆炸，對周圍 8 格敵人造成該次傷害 60%", "Kills explode for 60% damage to adjacent enemies"],
  prey:      ["獵殺", "Hunter", "命中越靠近深坑的敵人傷害越高（每排 +7%）", "+7% damage per row the target is closer to the pit"],
  mark:      ["標記", "Mark", "命中使敵人被標記 2 輪，期間所有彈珠對它傷害 +40%", "Marked for 2 volleys: all balls deal +40% to it"],
  charge:    ["蓄能", "Charge", "彈珠飛得越久傷害越高（飛 4 秒達 +100%）", "Damage grows the longer the ball flies (+100% at 4s)"],
  desperate: ["背水", "Last Stand", "你的血量越低，這顆彈珠傷害越高（最多 +60%）", "The lower your HP, the more damage (up to +60%)"],
  exploit:   ["破綻", "Exploit", "對燃燒／中毒／脆化／標記狀態的敵人傷害 ×1.5", "×1.5 damage to burning, poisoned, brittle or marked enemies"]
});
const SP_CARD = { c1: "bounce", c2: "frost", c3: "burn", c4: "gold", u1: "return", u2: "magnet", u3: "crit", r1: "homing", r2: "knock", r3: "execute", e1: "split", e2: "beam", e3: "exploit", e4: "starfall", c5: "swift", c6: "vamp", c7: "poison", c8: "grow", u4: "stun", u5: "mercy", u6: "lance", r4: "ice", r5: "charge", r6: "desperate", e5: "blast", e6: "prey", e7: "mark" };
function spOf(id) { const ks = SP_OLD; return SP_CARD[id] || ks[[...String(id)].reduce((a, ch) => a + ch.charCodeAt(0), 0) % ks.length]; }
const FX_CAP = 3, FUSE_MULT_BONUS = 0.25;
/* ===== 階段解鎖：由 player.bestFloor 推算（擊敗第 1/2/3 隻 BOSS = 到第 11/21/31 層），不另存欄位；GM 可用 player.bpAll 全開 ===== */
const STAGE_AT = [0, 11, 21, 31], STAGE_ZH = ["月光", "熔岩", "深海", "虛空"], STAGE_EN = ["Moonlit", "Magma", "Abyssal Sea", "The Void"];
const UP_TIER = { regen: 0, shield: 1, pierceUp: 1, splashUp: 1, combo: 1, chainUp: 2, venom: 2, bounty: 2, heal: 0, vit: 0, rage: 0, ball: 0, dmg: 0, spd: 0, freeze: 1, sweep: 1, wall: 1, crit: 1, gold: 1, fuse: 2, imbue: 2, storm: 2, meteor: 2 };
const META_TIER = { hp: 0, regen: 1, head: 1, ward: 2, pen: 3, dmg: 0, spd: 0, gold: 0, balls: 1, crit: 1, xp: 1, reroll: 2, pit: 2, revive: 3, slots: 3 };
const RAR_TIER = { common: 0, uncommon: 0, rare: 1, epic: 2, legendary: 2 };
const STAGE_GAIN = [null,
  ["爆裂珠（稀有卡）、升級：暴擊／貪婪／時間靜止／清掃／護欄／護盾／貫穿／衝擊波／連擊、強化：額外彈珠／暴擊率／經驗／再生／起始經驗", "Burst balls (rare cards), upgrades: Crit/Greed/Time Stop/Sweep/Barrier/Shield/Pierce/Shockwave/Combo, Forge: balls/crit/XP/regen/head start"],
  ["連鎖珠（史詩卡）、升級：融合／附魔／落雷／隕石術／導電／毒霧／懸賞、強化：重抽／深坑護欄／開局護盾", "Chain balls (epic cards), upgrades: Fuse/Imbue/Storm/Meteor/Conduct/Venom/Bounty, Forge: reroll/pit barrier/starting ward"],
  ["卡牌第 2、3 特效、強化：復活／出戰欄位／起始穿透", "Card 2nd/3rd effects, Forge: revive / card slots / starting pierce"]];
function stageOf(p) { if (p && p.bpAll && ku()) return 3; const b = (p && p.bpBestFloor) || 0; let s = 0; STAGE_AT.forEach((f, i) => { if (b >= f) s = i; }); return s; }
const upOpen = (u, p) => (UP_TIER[u.id] || 0) <= stageOf(p);
const cardOpen = (p, id) => (RAR_TIER[v[id].rarity] || 0) <= stageOf(p);
function stageHint(p) {
  const s = stageOf(p); if (s >= 3) return "";
  const n = s + 1, boss = (STAGE_AT[n] - 1) / 10;
  return `<br>🔓 ${dc(`擊敗第 ${boss} 隻 BOSS 進入「${STAGE_ZH[n]}」階段：${STAGE_GAIN[n][0]}`, `Beat boss #${boss} to enter "${STAGE_EN[n]}": ${STAGE_GAIN[n][1]}`)}`;
}
const FX_ZH = { pierce: "穿透", splash: "爆裂", chain: "連鎖" }, FX_EN = { pierce: "Pierce", splash: "Burst", chain: "Chain" };
const FX_NAMES = { pierce: [["穿透珠", "Piercer"], ["貫穿珠", "Impaler"], ["穿雲珠", "Skybreaker"]], splash: [["爆裂珠", "Burster"], ["轟爆珠", "Blaster"], ["核爆珠", "Nova"]], chain: [["連鎖珠", "Arc"], ["雷暴珠", "Stormcaller"], ["天雷珠", "Thunderlord"]] };
const COMBO_NAMES = { "pierce+splash": ["穿甲榴彈", "Shrapnel Shell"], "pierce+chain": ["雷槍", "Lightning Lance"], "splash+chain": ["風暴珠", "Tempest"], "pierce+splash+chain": ["元素奇點", "Elemental Singularity"] };
const UPGRADES = [
  { id: "heal", zh: "💖 治癒", en: "💖 Heal", dz: "立刻回復 40% 最大血量", de: "Restore 40% max HP", ap: g => { g.hp = Math.min(g.maxHp, g.hp + Math.round(g.maxHp * 0.4)); }, ok: g => g.hp < g.maxHp * 0.9 },
  { id: "vit", zh: "🛡 體魄", en: "🛡 Vitality", dz: "最大血量 +30，並回復 30 點", de: "+30 max HP and heal 30", ap: g => { g.maxHp += 30; g.hp = Math.min(g.maxHp, g.hp + 30); } },
  { id: "rage", zh: "🔥 狂暴", en: "🔥 Rage", dz: "所有傷害 ×1.25（可疊加）", de: "All damage ×1.25 (stacks)", ap: g => { g.dmgMul *= 1.25; } },
  { id: "ball",   zh: "＋1 彈珠",   en: "+1 Ball",       dz: "每輪多射一顆（從你帶的卡牌隨機）", de: "Fire one more ball per volley (random from your cards)", ap: g => { g.loadout.push(g.base[Math.floor(Math.random() * g.base.length)]); } },
  { id: "dmg",    zh: "＋1 傷害",   en: "+1 Damage",     dz: "所有彈珠每次命中多 1 點傷害", de: "Every ball hits for 1 more damage", ap: g => { g.dmgBonus++; } },
  { id: "spd",    zh: "彈珠加速",   en: "Faster Balls",  dz: "彈珠速度 +15%，一輪更快打完", de: "Ball speed +15%", ap: g => { g.spd = Math.min(900, g.spd * 1.15); } },
  { id: "freeze", zh: "時間靜止",   en: "Time Stop",     dz: "下一輪敵人不前進也不新增", de: "Enemies skip their next advance", ap: g => { g.skip++; } },
  { id: "fuse",   zh: "🔗 融合",   en: "🔗 Fuse",       dz: "選兩顆彈珠合成一顆：同效果進化、不同效果合併，傷害相加", de: "Merge two balls into one: same effects evolve, different effects combine, damage adds up", pick: true, ok: g => g.loadout.length >= 2, ap: () => {} },
  { id: "sweep",  zh: "清掃最底排", en: "Sweep",         dz: "立刻消滅最靠近深坑的那一排", de: "Destroy the row closest to the pit", ap: g => { const live = g.enemies.filter(e => !e.dead); if (!live.length) return; const mr = Math.max(...live.map(e => e.r)); live.filter(e => e.r === mr).forEach(e => damage(g, e, 99999)); g.enemies = g.enemies.filter(e => !e.dead); } },
  { id: "wall",   zh: "加高護欄",   en: "Raise Barrier", dz: "深坑線往下移 1 排（最多 2 次）", de: "Pit line moves down 1 row (max twice)", ap: g => { g.pit = Math.min(PIT_MAX, g.pit + 1); }, ok: g => g.pit < PIT_MAX },
  { id: "crit",   zh: "💥 暴擊",     en: "💥 Crit",       dz: "命中有 15% 機率造成雙倍傷害（可疊加，上限 75%）", de: "+15% chance to deal double damage (stacks, max 75%)", ap: g => { g.crit = Math.min(0.75, g.crit + 0.15); }, ok: g => g.crit < 0.75 },
  { id: "gold",   zh: "💰 貪婪",     en: "💰 Greed",      dz: "本局擊殺金幣 +25%", de: "+25% kill gold this run", ap: g => { g.goldMul += 0.25; } },
  { id: "storm",  zh: "⚡ 落雷",     en: "⚡ Storm",      dz: "每次發射時，天降 2 道雷擊隨機敵人", de: "Each volley, 2 lightning bolts strike random enemies", ap: g => { g.storm++; } },
  { id: "meteor", zh: "☄ 隕石術",   en: "☄ Meteor",      dz: "立刻對全場敵人造成傷害（隨層數成長）", de: "Instantly damage every enemy (scales with floor)", ap: g => { const d = 2 + Math.ceil(g.floor * 0.5); g.enemies.forEach(e => damage(g, e, d)); g.shake = 16; sfx(70, 0.4, "sawtooth", 0.09); g.enemies = g.enemies.filter(e => !e.dead); } },
  { id: "imbue",  zh: "✧ 附魔",     en: "✧ Imbue",       dz: "隨機一顆彈珠獲得一個新的卡牌特效（最多 3 個）", de: "A random ball gains a new card effect (max 3)", ap: g => { const d = g.loadout[Math.floor(Math.random() * g.loadout.length)], have = d.sp || [], ks = Object.keys(SP).filter(k => !have.includes(k)); if (ks.length && have.length < 3) { const k = ks[Math.floor(Math.random() * ks.length)]; d.sp = have.concat(k); ac(`✧ ${d.name} → ${dc(SP[k][0], SP[k][1])}`); } else g.dmgBonus++; } },
  { id: "regen",    zh: "🌿 再生",     en: "🌿 Regen",       dz: "每輪結束回復 3 點血量（可疊加）", de: "Heal 3 HP at the end of every volley (stacks)", ap: g => { g.regen = (g.regen || 0) + 3; }, ok: g => (g.regen || 0) < 12 },
  { id: "shield",   zh: "🛡 護盾",     en: "🛡 Ward",        dz: "抵擋下一次受到的傷害（最多存 3 層）", de: "Block the next hit you take (max 3 charges)", ap: g => { g.shield = (g.shield || 0) + 1; }, ok: g => (g.shield || 0) < 3 },
  { id: "pierceUp", zh: "🏹 貫穿",     en: "🏹 Skewer",      dz: "所有彈珠穿透 +1（最多 +3）", de: "All balls pierce +1 (max +3)", ap: g => { g.pierceB = (g.pierceB || 0) + 1; }, ok: g => (g.pierceB || 0) < 3 },
  { id: "splashUp", zh: "💣 衝擊波",   en: "💣 Shockwave",   dz: "所有彈珠爆裂 +1（最多 +2）", de: "All balls splash +1 (max +2)", ap: g => { g.splashB = (g.splashB || 0) + 1; }, ok: g => (g.splashB || 0) < 2 },
  { id: "chainUp",  zh: "⚡ 導電",     en: "⚡ Conduct",     dz: "所有彈珠連鎖 +1（最多 +2）", de: "All balls chain +1 (max +2)", ap: g => { g.chainB = (g.chainB || 0) + 1; }, ok: g => (g.chainB || 0) < 2 },
  { id: "combo",    zh: "🔥 連擊",     en: "🔥 Combo",       dz: "連擊傷害加成更快出現：每 15 次連擊 +1 傷害，改成 12、9、6 次", de: "Combo damage bonus comes sooner: every 15 hits → 12 → 9 → 6", ap: g => { g.cmb = Math.max(6, (g.cmb || 15) - 3); }, ok: g => (g.cmb || 15) > 6 },
  { id: "venom",    zh: "☠ 毒霧",     en: "☠ Miasma",       dz: "所有彈珠命中都附帶 1 層劇毒", de: "Every ball poisons on hit", ap: g => { g.venom = true; }, ok: g => !g.venom },
  { id: "bounty",   zh: "🏴 懸賞",     en: "🏴 Bounty",      dz: "擊殺經驗 +25%（可疊加）", de: "+25% kill XP (stacks)", ap: g => { g.xpMul *= 1.25; } }
];

/* ===== 🎲 每局詞綴：開局三選一（有好處也有代價）。只改本局的數值，不碰任何結算／防作弊上限 ===== */
const AFFIXES = [
  { id: "glass",    ic: "🔮", zh: "玻璃砲",   en: "Glass Cannon", dz: "彈珠 −1 顆，所有傷害 ×1.5",                 de: "−1 ball, all damage ×1.5",                      ok: g => g.loadout.length >= 3, ap: g => { g.loadout.pop(); g.dmgMul *= 1.5; } },
  { id: "hard",     ic: "⛰️", zh: "硬化",     en: "Hardened",     dz: "怪物血量 +20%，擊殺金幣與經驗 +40%",         de: "Enemy HP +20%, kill gold and XP +40%",          ap: g => { g.enemyHpMul *= 1.2; g.goldMul *= 1.4; g.xpMul *= 1.4; } },
  { id: "swarm",    ic: "🐜", zh: "蟲群",     en: "Swarm",        dz: "每排多 1 隻怪（最多 6 隻），怪物血量 −25%，經驗 +25%", de: "+1 enemy per row (max 6), enemy HP −25%, XP +25%", ap: g => { g.extraEnemy += 1; g.enemyHpMul *= 0.75; g.xpMul *= 1.25; } },
  { id: "fragile",  ic: "🥀", zh: "薄命",     en: "Fragile",      dz: "最大血量 −30%，暴擊率 +25%",                 de: "Max HP −30%, crit chance +25%",                 ap: g => { g.maxHp = Math.max(10, Math.round(g.maxHp * 0.7)); g.hp = g.maxHp; g.hpShow = g.hp; g.crit = Math.min(0.75, g.crit + 0.25); } },
  { id: "haste",    ic: "💨", zh: "急行",     en: "Haste",        dz: "彈珠速度 +30%，敵人攻擊力 +30%",             de: "Ball speed +30%, enemy attack +30%",            ap: g => { g.spd = Math.min(900, g.spd * 1.3); g.enemyAtkMul *= 1.3; } },
  { id: "plague",   ic: "☠",  zh: "瘟疫",     en: "Plague",       dz: "所有彈珠命中附帶 1 層劇毒，最大血量 −15%",   de: "Every ball poisons on hit, max HP −15%",        ok: g => !g.venom, ap: g => { g.venom = true; g.maxHp = Math.max(10, Math.round(g.maxHp * 0.85)); g.hp = g.maxHp; g.hpShow = g.hp; } },
  { id: "fort",     ic: "🏰", zh: "堡壘",     en: "Fortress",     dz: "深坑線下移 1 排，BOSS 血量 +35%",            de: "Pit line 1 row lower, boss HP +35%",            ok: g => g.pit < PIT_MAX, ap: g => { g.pit = Math.min(PIT_MAX, g.pit + 1); g.bossHpMul *= 1.35; } },
  { id: "scholar",  ic: "📖", zh: "學者",     en: "Scholar",      dz: "經驗 +50%（升級更快），所有傷害 ×0.85",      de: "XP +50% (level up faster), all damage ×0.85",   ap: g => { g.xpMul *= 1.5; g.dmgMul *= 0.85; } }
];
const AFFIX_BY = Object.fromEntries(AFFIXES.map(a => [a.id, a]));
const st = { running: false, settling: false, sel: [], selTouched: false, g: null, canvas: null, ctx: null, wrap: null, ov: null, raf: 0, last: 0, host: null, lastResult: null, mute: (function () { try { return localStorage.getItem("tarot_ballpit_sfx_on") !== "1"; } catch (e) { return true; } })(), musicOff: (function () { try { return localStorage.getItem("tarot_ballpit_music_off") !== "0"; } catch (e) { return true; } })(), tab: "play", drawMsg: "", loaded: false, starting: false, busy: false, standings: null, standingsFor: null, settledFor: "" };
(function () { let o = {}; try { o = JSON.parse(localStorage.getItem("tarot_ballpit_vol") || "{}"); } catch (e) {} const ok = x => typeof x === "number" && x >= 0 && x <= 1; st.sfxVol = ok(o.s) ? o.s : 1; st.musVol = ok(o.m) ? o.m : 0.5; })();
function saveVol() { try { localStorage.setItem("tarot_ballpit_vol", JSON.stringify({ s: st.sfxVol, m: st.musVol })); } catch (e) {} }

/* ===== 玩法設定（GM 可調）===== */
function settingsKey() { return "config:ballpit_settings"; }
async function loadSettings() {
  try {
    const r = await a.get(settingsKey());
    if (r) {
      const t = JSON.parse(r.value), num = (k, lo) => typeof t[k] === "number" && t[k] >= lo;
      if (num("dailyPlays", 1)) DAILY_PLAYS = Math.round(t.dailyPlays);
      if (num("maxGoldPerSec", 1)) MAX_GOLD_PER_SEC = t.maxGoldPerSec;
      if (num("goldPerItemRoll", 20)) GOLD_PER_ITEM_ROLL = t.goldPerItemRoll;
      if (typeof t.itemMediumChance === "number" && t.itemMediumChance >= 0 && t.itemMediumChance <= 1) ITEM_MEDIUM_CHANCE = t.itemMediumChance;
      if (num("maxRunSec", 60)) MAX_RUN_SEC = t.maxRunSec;
      if (num("minSecPerFloor", 0.5)) MIN_SEC_PER_FLOOR = t.minSecPerFloor;
      if (num("lbMinSecPerFloor", 0.5)) LB_MIN_SEC_PER_FLOOR = t.lbMinSecPerFloor;
      if (num("milestoneFloorCap", 0)) MILESTONE_FLOOR_CAP = Math.round(t.milestoneFloorCap);
      if (num("outCoinPerFloor", 0)) OUT_COIN_PER_FLOOR = t.outCoinPerFloor;
      if (num("outFloorCap", 0)) OUT_FLOOR_CAP = Math.round(t.outFloorCap);
      if (num("outFloorsPerItem", 1)) OUT_FLOORS_PER_ITEM = Math.round(t.outFloorsPerItem);
      if (num("startCoins", 0)) START_COINS = Math.round(t.startCoins);
      if (num("hardRate", 1)) HARD_RATE = Math.min(1.5, t.hardRate);
      if (num("hardFrom", 1)) HARD_FROM = Math.round(t.hardFrom);
      if (typeof t.affixOn === "boolean") AFFIX_ON = t.affixOn;
      if (t.rankShards) RANK_SHARDS = rankShardParse(t.rankShards, RANK_SHARDS);
    }
  } catch (e) {}
}
async function saveSettings() {
  await a.set(settingsKey(), JSON.stringify({ dailyPlays: DAILY_PLAYS, maxGoldPerSec: MAX_GOLD_PER_SEC, goldPerItemRoll: GOLD_PER_ITEM_ROLL, itemMediumChance: ITEM_MEDIUM_CHANCE, maxRunSec: MAX_RUN_SEC, minSecPerFloor: MIN_SEC_PER_FLOOR, lbMinSecPerFloor: LB_MIN_SEC_PER_FLOOR, milestoneFloorCap: MILESTONE_FLOOR_CAP, outCoinPerFloor: OUT_COIN_PER_FLOOR, outFloorCap: OUT_FLOOR_CAP, outFloorsPerItem: OUT_FLOORS_PER_ITEM, startCoins: START_COINS, hardRate: HARD_RATE, hardFrom: HARD_FROM, affixOn: AFFIX_ON, rankShards: RANK_SHARDS }));
}

/* ===== 每日次數（跟三消同一套：GMT+8 重置、固定 5 次、GM 不受限）===== */
function playsCapFor(p) { return 5; }  // 所有人每天固定 5 次
function playsRemaining(p) {
  const cap = playsCapFor(p);
  if (!p) return cap;
  return p.bpPlaysDate === ys() ? Math.max(0, typeof p.bpPlaysLeft === "number" ? p.bpPlaysLeft : cap) : cap;
}

/* ===== 彈珠專屬存檔欄位（全部 bp 前綴，跟正式版金幣／卡牌／成品完全分開）===== */
function bpNorm(p) {
  if (!p) return p;
  if (!p.bpCards || typeof p.bpCards !== "object") p.bpCards = {};
  if (!p.bpCardLv || typeof p.bpCardLv !== "object") p.bpCardLv = {};
  if (!p.bpMeta || typeof p.bpMeta !== "object") p.bpMeta = {};
  ["bpCoins", "bpMats", "bpBestFloor", "bpFloorClaimed", "bpRuns"].forEach(k => { if (typeof p[k] !== "number" || isNaN(p[k]) || p[k] < 0) p[k] = 0; });
  return p;
}
// 第一次進來：發一次起始資源（3 張基礎彈珠卡＋起始彈珠幣），之後不再補
async function ensureInit() {
  const p = zl.player;
  if (!p || p.bpInit || !zl.nickname) return;
  const fresh = await Wl(zl.nickname, q => {
    bpNorm(q);
    if (!q.bpInit) { q.bpInit = 1; q.bpCoins += START_COINS; q.bpCards = { c1: 1, c2: 1, c3: 1 }; }
  });
  if (fresh) zl.player = fresh;
}

/* ===== 掉落：彈珠材料（自己的）＋ 對外的正式版成品（只在「對外獎勵」時用）===== */
const ITEM_SMALL = ["potion_small", "weapon_common", "accessory_common", "furniture_common"];
const ITEM_MEDIUM = ["potion_medium", "weapon_uncommon", "accessory_uncommon", "furniture_uncommon"];
function rollMats(gold) { return gold > 0 ? Math.max(1, Math.round(gold / GOLD_PER_ITEM_ROLL)) : 0; }
function rollRealItems(n) {
  const bag = {};
  for (let i = 0; i < n; i++) {
    const pool = Math.random() < ITEM_MEDIUM_CHANCE ? ITEM_MEDIUM : ITEM_SMALL;
    const id = pool[Math.floor(Math.random() * pool.length)];
    bag[id] = (bag[id] || 0) + 1;
  }
  return bag;
}
function itemLabel(itemId) {
  const def = typeof Lt === "function" ? Lt(itemId) : null;
  return def ? { icon: def.icon, name: dc(def.labelZh, def.labelEn) } : { icon: "📦", name: itemId };
}

/* ===== 每日排行榜（每人每天一筆：比「分數」，同分比用時短，再比誰先達成；每天地圖固定，上限 60 層）===== */
function scoreKey(dateKey, nick) { return `ballpit_daily_score:${dateKey}:${(nick || "").toLowerCase()}`; }
async function submitDailyScore(nick, score, fl, ms) {
  if (!nick || !(score > 0)) return null;
  const empty = JSON.stringify({ score: 0, floor: 0, ms: 0, lastAt: 0, nick: "" });
  const raw = await Vl(scoreKey(ys(), nick), t => {
    const s0 = t ? JSON.parse(t) : { score: 0, floor: 0, ms: 0, lastAt: 0, nick: "" };
    const old = s0.score != null ? s0.score : (s0.floor || 0) * 100;   // 舊格式只有層數
    if (score > old || (score === old && ms < (s0.ms || 1e12))) { s0.score = score; s0.floor = fl; s0.ms = ms; s0.lastAt = Date.now(); s0.nick = nick; }
    return JSON.stringify(s0);
  }, empty);
  return raw ? JSON.parse(raw) : null;
}
async function getStandings(dateKey) {
  let entries = [];
  const prefix = `ballpit_daily_score:${dateKey}:`;
  try { entries = await a.listValues(prefix); } catch (e) { entries = []; }
  return entries.map(e => {
    let d = null; try { d = JSON.parse(e.value); } catch (err) {}
    if (!d) return null;
    return { nick: d.nick || e.key.slice(prefix.length), floor: d.floor || 0, score: d.score != null ? d.score : (d.floor || 0) * 100, ms: d.ms || 0, lastAt: d.lastAt || 0 };
  }).filter(Boolean).filter(x => x.score > 0).sort((x, y) => y.score - x.score || x.ms - y.ms || x.lastAt - y.lastAt);
}
async function refreshStandings() {
  const key = ys();
  if (st.standingsFor === key && st.standings) return;
  st.standings = await getStandings(key);
  st.standingsFor = key;
}
/* ===== 封號「彈珠大師」：每天結算一次（等進入新的一天再結算昨天，第一名＝最高層數）===== */
function settledKey(dateKey) { return `config:ballpit_round_settle:${dateKey}`; }
async function tryClaimSettlement(dateKey) {
  let claimed = false;
  await Vl(settledKey(dateKey), v0 => { claimed = false; if (v0) return v0; claimed = true; return JSON.stringify({ settledAt: Date.now() }); }, "");
  return claimed;
}
async function settleRound(dateKey) {
  if (!(await tryClaimSettlement(dateKey))) return null;
  try {
    const list = await getStandings(dateKey);
    await loadSettings();
    try { await rankShardPayout("ballpit", dateKey, list, RANK_SHARDS); } catch (e) {}   // 前三名發神秘碎片
    if (list.length) { await setTitleHolder("ballpitChampion", list[0].nick); return list[0].nick; }
  } catch (e) {}
  return null;
}
async function ensureYesterdaySettled() {
  const today = ys();
  if (st.settledFor === today) return;
  st.settledFor = today;
  try { await settleRound(ys(Date.now() - 864e5)); } catch (e) {}
}
function fmtTime(ms) { const s0 = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s0 / 60)}:${String(s0 % 60).padStart(2, "0")}`; }
function standingsHtml() {
  const list = st.standings;
  if (list === null || list === undefined) return `<p class="sub">${dc("讀取排行榜中…", "Loading leaderboard…")}</p>`;
  if (!list.length) return `<p class="sub">${dc("今天還沒有人上榜，快來搶頭香！", "No one on today's board yet — be the first!")}</p>`;
  const me = (zl.nickname || "").toLowerCase();
  return list.slice(0, 10).map((x, i) => `<div class="listing"><div class="left"><div class="icon-box">${i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "#" + (i + 1)}</div><div class="meta"><div>${Iu(x.nick)}${x.nick.toLowerCase() === me ? ` <span style="color:var(--gold-bright);">(${dc("你", "you")})</span>` : ""}</div><div class="sub">${x.floor > MAX_FLOOR ? dc("🏆 通關", "🏆 Cleared") : dc(`第 ${x.floor} 層`, `Floor ${x.floor}`)} · ⏱ ${fmtTime(x.ms)}</div></div></div><div class="right"><span class="price">${dc(`${x.score.toLocaleString()} 分`, `${x.score.toLocaleString()} pts`)}</span></div></div>`).join("");
}

/* ===== 開局：CAS 寫 bpRun（伺服器記下開局時間）並「開局就扣次數」，避免開了又放棄、只挑好的一局結算 ===== */
async function claimStart() {
  if (!zl.nickname) return null;
  await loadSettings();
  let err = null;
  const fresh = await Wl(zl.nickname, p => {
    err = null;
    bpNorm(p);
    const today = ys();
    (p.bpPlaysDate === today && typeof p.bpPlaysLeft === "number") || (p.bpPlaysDate = today, p.bpPlaysLeft = playsCapFor(p));
    if (p.bpPlaysLeft <= 0 && !ku()) { err = "noplays"; return; }
    ku() || (p.bpPlaysLeft -= 1);
    p.bpRun = { dateKey: today, startedAt: Date.now() };
  });
  if (!fresh) return null;
  if (err) return { ok: false, reason: err };
  zl.player = fresh;
  return { ok: true };
}
function abandonRun() { if (zl.nickname) Wl(zl.nickname, p => { p.bpRun = null; }).then(f => { if (f) zl.player = f; }).catch(() => {}); }

/* ===== 結算：時間以伺服器存的 startedAt 為準；層數、彈珠幣、里程碑、對外獎勵都在這裡夾住 ===== */
async function claimReward(raw) {
  if (!zl.nickname) return null;
  await loadSettings();
  const goldIn = Math.max(0, Math.floor(Number(raw && raw.gold) || 0));
  const floorIn = Math.max(0, Math.floor(Number(raw && raw.floor) || 0));
  const hpIn = Math.max(0, Math.min(100, Math.floor(Number(raw && raw.hpPct) || 0)));
  let err = null, granted = null;
  const fresh = await Wl(zl.nickname, p => {
    err = null; granted = null;
    bpNorm(p);
    const run = p.bpRun;
    if (!run || typeof run.startedAt !== "number") { err = "norun"; return; }
    p.bpRun = null;
    const elapsed = (Date.now() - run.startedAt) / 1000;
    if (elapsed > MAX_RUN_SEC + 60) { err = "expired"; return; }
    if (elapsed < 2) { err = "toofast"; return; }
    // 層數：每層至少要花 MIN_SEC_PER_FLOOR 秒（夾住，不直接判無效，避免誤傷）
    const maxFloor = Math.floor(elapsed / MIN_SEC_PER_FLOOR) + 1;
    const fl = Math.min(floorIn, maxFloor), floorCapped = floorIn > maxFloor;
    // 彈珠幣：每秒上限
    const cap = Math.floor(elapsed * MAX_GOLD_PER_SEC), goldCapped = goldIn > cap;
    const gold = Math.min(goldIn, cap);
    // 首次到達里程碑（每 10 層一次，只算到 MILESTONE_FLOOR_CAP 層）
    let ms = 0;
    for (let m = p.bpFloorClaimed + 10; m <= Math.min(fl, MILESTONE_FLOOR_CAP); m += 10) { ms += m * 60; p.bpFloorClaimed = m; }
    const mats = rollMats(gold + ms);
    const prevBest = p.bpBestFloor;
    p.bpCoins += gold + ms; p.bpMats += mats; p.bpRuns += 1; p.bpBestFloor = Math.max(p.bpBestFloor, fl);
    // 首殺 BOSS 一次性獎勵：第 k 隻 BOSS 在「到達第 10k+1 層」時算擊敗；每隻只領一次（以歷史最高層數判定）
    const bossFirst = [];
    for (let k = Math.floor((Math.max(1, prevBest) - 1) / 10) + 1; k <= Math.min(Math.floor((fl - 1) / 10), 12); k++) {
      const rar = k === 1 ? "rare" : "epic", pool = Object.keys(v).filter(id => v[id].rarity === rar), id = pool[Math.floor(Math.random() * pool.length)], cd = v[id];
      const bc = 300 * k, bm = 3 + k;
      p.bpCoins += bc; p.bpMats += bm;
      let msg;
      if ((p.bpCards[id] || 0) > 0) {
        if (cardLv(p, id) < CARD_MAX) { p.bpCardLv[id] = cardLv(p, id) + 1; msg = dc(`${cd.icon} ${cd.name} 升到 Lv${p.bpCardLv[id]}`, `${cd.icon} ${cd.name} → Lv${p.bpCardLv[id]}`); }
        else { p.bpCoins += 300; msg = dc(`${cd.icon} ${cd.name} 已滿級，改發 300 彈珠幣`, `${cd.icon} ${cd.name} maxed, +300 coins instead`); }
      } else { p.bpCards[id] = 1; msg = dc(`新卡牌 ${cd.icon} ${cd.name}`, `New card ${cd.icon} ${cd.name}`); }
      bossFirst.push({ k, coins: bc, mats: bm, msg });
    }
    // 對外獎勵：當日新達成的最高層數（有上限），每天重置
    const today = ys();
    if (p.bpOutDate !== today) { p.bpOutDate = today; p.bpOutFloor = 0; }
    const eff = Math.min(fl, OUT_FLOOR_CAP), prev = Math.min(p.bpOutFloor || 0, OUT_FLOOR_CAP);
    const outCoins = Math.max(0, eff - prev) * OUT_COIN_PER_FLOOR;
    const outRolls = Math.max(0, Math.floor(eff / OUT_FLOORS_PER_ITEM) - Math.floor(prev / OUT_FLOORS_PER_ITEM));
    p.bpOutFloor = Math.max(p.bpOutFloor || 0, eff);
    let outBag = {};
    if (outCoins > 0 || outRolls > 0) {
      if (typeof kt === "function") kt(p);
      p.coins = (p.coins || 0) + outCoins;
      outBag = rollRealItems(outRolls);
      p.professionItems = p.professionItems || {};
      for (const k of Object.keys(outBag)) p.professionItems[k] = (p.professionItems[k] || 0) + outBag[k];
    }
    const lbFloor = Math.min(fl, Math.floor(elapsed / LB_MIN_SEC_PER_FLOOR) + 1);
    // 排行榜分數：每清 1 層 100 分；60 層全清再加 1000 通關分＋剩餘血量（最多 500）＋速度分（900 秒內每快 1 秒 +1）
    const lbWin = lbFloor > MAX_FLOOR, lbCleared = Math.min(Math.max(0, lbFloor - 1), MAX_FLOOR);
    const score = lbCleared * 100 + (lbWin ? 1000 + hpIn * 5 + Math.max(0, 900 - Math.round(elapsed)) : 0);
    granted = { bossFirst, gold, milestone: ms, mats, floorCapped, goldCapped, outCoins, outBag, floor: fl, lbFloor, score, lbWin, hpPct: hpIn, elapsedMs: Math.round(elapsed * 1000), playsLeft: playsRemaining(p) };
  });
  if (!fresh) return null;
  if (err) return { ok: false, reason: err };
  zl.player = fresh;
  { const c = document.getElementById("player-coin"); if (c) c.textContent = "✦ " + fmtCoin(fresh.coins); } // 只更新金幣顯示，不整頁重畫（整頁重畫會洗掉結算畫面與事件）
  try { await submitDailyScore(zl.nickname, granted.score, granted.lbFloor, granted.elapsedMs); st.standingsFor = null; } catch (e) {}
  return { ok: true, ...granted };
}

/* ===== 花彈珠幣的動作：全部走 CAS（Wl），在 callback 裡重新檢查餘額 ===== */
async function cardUpgrade(id) {
  let err = null, lvNew = 0;
  const fresh = await Wl(zl.nickname, p => {
    err = null; lvNew = 0; bpNorm(p);
    const lv = cardLv(p, id), cc = cardCost(id, lv), mat = Math.ceil(lv / 2);
    if (!(p.bpCards[id] > 0)) { err = "notowned"; return; }
    if (lv >= CARD_MAX) { err = "max"; return; }
    if (p.bpCoins < cc || p.bpMats < mat) { err = "poor"; return; }
    p.bpCoins -= cc; p.bpMats -= mat; p.bpCardLv[id] = lv + 1; lvNew = lv + 1;
  });
  if (!fresh) return null;
  zl.player = fresh;
  return { err, lvNew };
}
async function metaUpgrade(k) {
  const m = META.find(x => x.k === k);
  let err = null;
  const fresh = await Wl(zl.nickname, p => {
    err = null; bpNorm(p);
    const lv = p.bpMeta[k] || 0, cc = metaCost(m, lv);
    if ((META_TIER[k] || 0) > stageOf(p)) { err = "locked"; return; }
    if (lv >= m.max) { err = "max"; return; }
    if (p.bpCoins < cc) { err = "poor"; return; }
    p.bpCoins -= cc; p.bpMeta[k] = lv + 1;
  });
  if (!fresh) return null;
  zl.player = fresh;
  return { err };
}
async function drawCard() {
  let err = null, msg = "";
  const fresh = await Wl(zl.nickname, p => {
    err = null; msg = ""; bpNorm(p);
    if (p.bpCoins < DRAW_COST) { err = "poor"; return; }
    p.bpCoins -= DRAW_COST;
    const r = Math.random() * 100, rar = r < 60 ? "common" : r < 88 ? "uncommon" : r < 98 ? "rare" : "epic";
    let pool = Object.keys(v).filter(id => v[id].rarity === rar); if (!pool.length) pool = Object.keys(v);
    const id = pool[Math.floor(Math.random() * pool.length)], c = v[id];
    if ((p.bpCards[id] || 0) > 0) {
      if (cardLv(p, id) < CARD_MAX) { p.bpCardLv[id] = cardLv(p, id) + 1; msg = dc(`重複！${c.icon} ${c.name} 升到 Lv${p.bpCardLv[id]}`, `Duplicate! ${c.icon} ${c.name} → Lv${p.bpCardLv[id]}`); }
      else { p.bpCoins += 150; msg = dc(`${c.icon} ${c.name} 已滿級，退還 150 彈珠幣`, `${c.icon} ${c.name} maxed, refunded 150`); }
    } else { p.bpCards[id] = 1; msg = dc(`✨ 新卡牌：${c.icon} ${c.name}`, `✨ New card: ${c.icon} ${c.name}`); }
  });
  if (!fresh) return null;
  zl.player = fresh;
  return { err, msg };
}

/* ===== 卡牌 → 彈珠 ===== */
function ownedIds(p) {
  const c = (p && p.bpCards) || {};
  return Object.keys(c).filter(id => c[id] > 0 && v[id]).sort((a, b) => (RK[v[b].rarity] || 0) - (RK[v[a].rarity] || 0) || String(v[a].name).localeCompare(String(v[b].name)));
}
function ballType(rarity) { return "legendary" === rarity ? "epic" : (TYPE_INFO[rarity] ? rarity : "common"); }
function selKey() { return "tarot_ballpit_sel_" + String((zl && zl.nickname) || "").toLowerCase(); }
function loadSel() {
  if (st.selLoadedFor === selKey()) return;
  st.selLoadedFor = selKey();
  try {
    const raw = localStorage.getItem(selKey());
    if (raw != null) { const a = JSON.parse(raw); if (Array.isArray(a)) { st.sel = a.filter(x => typeof x === "string" && v[x]); st.selTouched = true; } }
  } catch (e) {}
}
function saveSel() { try { localStorage.setItem(selKey(), JSON.stringify(st.sel)); } catch (e) {} }
function selectedIds(p) {
  loadSel();
  const own = ownedIds(p).filter(id => cardOpen(p, id)), set = new Set(own);
  let ids = st.sel.filter(id => set.has(id)).slice(0, LM());
  if (!ids.length && !st.selTouched) ids = own.slice(0, LM());
  return ids;
}
function LM() { return LOADOUT_BASE + ((zl.player.bpMeta || {}).slots || 0); }
function cardLv(p, id) { return Math.min(CARD_MAX, Math.max(1, (p.bpCardLv && p.bpCardLv[id]) || 1)); }
function spOf3(id) { const ks = SP_OLD, i0 = ks.indexOf(spOf(id)); return ks[((i0 >= 0 ? i0 : [...String(id)].reduce((q, ch) => q * 31 + ch.charCodeAt(0), 7)) + 9) % ks.length]; }
function spOf2(id) { const ks = SP_OLD, i0 = ks.indexOf(spOf(id)); return ks[((i0 >= 0 ? i0 : [...String(id)].reduce((q, ch) => q * 31 + ch.charCodeAt(0), 7)) + 5) % ks.length]; }
function cardCost(id, lv) { return Math.round((80 + 40 * (RK[v[id].rarity] || 0)) * lv * lv); }
function itemTotal(p) { return Math.max(0, Math.floor((p && p.bpMats) || 0)); }
function cardDef(p, id) {
  const c = v[id], lv = cardLv(p, id), fx = Object.assign({}, TYPE_FX[ballType(c.rarity)]);
  for (const t of [5, 12]) if (lv >= t) { const k = ["pierce", "splash", "chain"].find(k2 => fx[k2] > 0) || "pierce"; fx[k] = Math.min(FX_CAP, fx[k] + 1); }
  return { id, rarity: c.rarity, name: c.name + (lv > 1 ? " Lv" + lv : ""), icon: c.icon || "🃏", fx, mult: 1 + 0.15 * (lv - 1), tier: 0, lv, sp: stageOf(p) < 3 ? [spOf(id)] : lv >= 12 ? [spOf(id), spOf2(id), spOf3(id)] : lv >= 8 ? [spOf(id), spOf2(id)] : [spOf(id)] };
}
function buildBase(p) {
  const defs = selectedIds(p).map(id => cardDef(p, id));
  while (defs.length < LM()) defs.push({ id: null, rarity: "common", name: dc("學徒彈珠", "Apprentice"), icon: "⚪", fx: Object.assign({}, TYPE_FX.common), mult: 1, tier: 0, sp: [] });
  return defs;
}
const META = [
  { k: "hp",    ic: "❤️", zh: "生命上限", en: "Max HP", dz: "每級開局最大血量 +15", de: "+15 max HP at start per level", max: 10, base: 160, gr: 1.4 },
  { k: "regen", ic: "🌿", zh: "初始再生", en: "Starting Regen", dz: "每級開局每輪結束回復 1 點血", de: "Heal 1 HP per volley from the start, per level", max: 5, base: 500, gr: 1.6 },
  { k: "head",  ic: "📗", zh: "起始經驗", en: "Head Start", dz: "每級開局先有 1 點經驗", de: "Start each run with 1 XP per level", max: 5, base: 350, gr: 1.5 },
  { k: "ward",  ic: "🛡️", zh: "開局護盾", en: "Starting Ward", dz: "每級開局帶 1 層護盾（擋 1 次傷害）", de: "Start with 1 Ward charge per level", max: 3, base: 800, gr: 1.9 },
  { k: "pen",   ic: "🏹", zh: "起始穿透", en: "Starting Pierce", dz: "每級所有彈珠穿透 +1", de: "All balls pierce +1 per level", max: 2, base: 2000, gr: 2.5 },
  { k: "dmg",   ic: "⚔️", zh: "基礎傷害", en: "Base Damage", dz: "每級開局 +1 傷害", de: "+1 damage at start per level", max: 15, base: 150, gr: 1.4 },
  { k: "balls", ic: "🎱", zh: "額外彈珠", en: "Extra Balls", dz: "每級開局多 1 顆彈珠", de: "+1 ball at start per level", max: 8, base: 300, gr: 1.7 },
  { k: "spd",   ic: "💨", zh: "彈珠速度", en: "Ball Speed", dz: "每級速度 +6%", de: "+6% ball speed per level", max: 8, base: 120, gr: 1.4 },
  { k: "crit",  ic: "💥", zh: "暴擊率", en: "Crit Chance", dz: "每級暴擊率 +4%", de: "+4% crit chance per level", max: 8, base: 200, gr: 1.45 },
  { k: "gold",  ic: "💰", zh: "金幣加成", en: "Gold Bonus", dz: "每級金幣 +10%", de: "+10% gold per level", max: 15, base: 180, gr: 1.35 },
  { k: "xp",    ic: "📘", zh: "經驗加成", en: "XP Bonus", dz: "每級擊殺經驗 +8%，升級更快", de: "+8% XP per level", max: 10, base: 250, gr: 1.4 },
  { k: "reroll",ic: "🎲", zh: "升級重抽", en: "Upgrade Reroll", dz: "每級每局可重抽 1 次升級選項", de: "+1 upgrade reroll per run per level", max: 5, base: 600, gr: 1.8 },
  { k: "revive",ic: "💫", zh: "復活", en: "Revive", dz: "每級每局被逼進深坑時復活 1 次（清最底 4 排）；血量歸零時復活也會回復一半血量", de: "+1 revive per run per level (clears bottom 4 rows)", max: 3, base: 2500, gr: 2.2 },
  { k: "pit",   ic: "🛡️", zh: "深坑護欄", en: "Pit Barrier", dz: "每級深坑線下移 1 排", de: "Pit line 1 row lower per level", max: 2, base: 400, gr: 1.8 },
  { k: "slots", ic: "🃏", zh: "出戰欄位", en: "Card Slot", dz: "每級可多帶 1 張出戰卡牌", de: "Bring 1 more card per level", max: 3, base: 1500, gr: 3 }
];
const metaCost = (m, lv) => Math.round(m.base * Math.pow(m.gr || 1.8, lv));

/* ===== 遊戲核心 ===== */
// 每日種子：同一天、同一層、同一排，所有玩家抽到的怪物排列一致（用日期＋層數當種子，與玩家的操作順序無關）
function hashSeed(str) { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^ (h >>> 16)) >>> 0; }
function mulberry32(seed) { let s0 = seed | 0; return function () { s0 = (s0 + 1831565813) | 0; let t = Math.imul(s0 ^ (s0 >>> 15), 1 | s0); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function seedRng(g, tag) { return mulberry32(hashSeed("bp|" + ((g && g.seedKey) || "") + "|" + tag)); }
function shuffle(a, rnd) { const R = rnd || Math.random; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
/* BOSS 難度曲線：hp/atk 為倍率、cd 為幾輪出手一次。第 4 隻起回到 1 倍並沿用原本隨層數成長的公式 */
const BOSS_TIER = [{ hp: 0.5, atk: 0.5, cd: 2 }, { hp: 0.8, atk: 0.75, cd: 1 }, { hp: 1, atk: 0.9, cd: 1 }, { hp: 1, atk: 1, cd: 1 }];
const hpMul = f => Math.pow(1.07, Math.max(0, Math.min(f, HARD_FROM) - 4)) * Math.pow(HARD_RATE, Math.max(0, f - HARD_FROM));

/* ===== 階段怪物能力與 BOSS 招式 =====
   熔岩(第 11–20 層)：熔岩怪、自爆怪　深海(21–30)：治療怪、護盾怪、召喚怪　虛空(31+)：瞬移怪、分裂怪（也會混入前面各種）。
   BOSS 依「第幾隻」輪替招式：1 召喚 → 2 護盾階段 → 3 潮汐(推深坑線) → 4 正面護甲 → 之後循環。 */
const BOSS_ARMOR = 0.6, BOSS_AB = ["bsummon", "bshield", "btide", "barmor", "bcloud", "bice", "bstar"], AB_CAP = 34;
const AB = {
  magma:    { ic: "🌋", zh: "熔岩怪", en: "Magma", dz: "死亡時點燃周圍 8 格的敵人，適合搭配連鎖", de: "Ignites adjacent enemies when it dies" },
  fuse:     { ic: "💥", zh: "自爆怪", en: "Bomber", dz: "徽章數字歸零就自爆傷害你，優先擊殺！", de: "Explodes and hurts you when the badge counts down to 0 — kill it first!" },
  healer:   { ic: "💧", zh: "治療怪", en: "Healer", dz: "每輪為周圍敵人回復 15% 血量，先清掉它", de: "Heals adjacent enemies 15% each volley — remove it first" },
  shield:   { ic: "🛡", zh: "護盾怪", en: "Shielded", dz: "有一層護盾，要先打破；斬殺對護盾無效", de: "Has a shield to break first; Execute can't skip it" },
  summoner: { ic: "🔮", zh: "召喚怪", en: "Summoner", dz: "每 3 輪在附近召喚小怪，優先擊殺", de: "Summons minions every 3 volleys — kill it first" },
  blink:    { ic: "🌀", zh: "瞬移怪", en: "Blinker", dz: "每輪可能瞬移到同排的空位", de: "May teleport to a free spot in its row each volley" },
  splitter: { ic: "🧬", zh: "分裂怪", en: "Splitter", dz: "死亡時分裂成 2 隻小怪", de: "Splits into 2 minions when it dies" },
  gust:     { ic: "💨", zh: "疾風怪", en: "Gale", dz: "每輪多前進 1 排，來得很快，先處理它", de: "Advances an extra row each volley — handle it early" },
  aegis:    { ic: "☁️", zh: "庇護怪", en: "Aegis", dz: "周圍 8 格的敵人受到的傷害 -30%，先打掉它", de: "Adjacent enemies take 30% less damage — remove it first" },
  icearmor: { ic: "🧊", zh: "冰甲怪", en: "Ice Armor", dz: "單次傷害最多只能扣它最大血量的 25%，要多段命中", de: "A single hit can't deal more than 25% of its max HP" },
  chill:    { ic: "❄️", zh: "寒霜怪", en: "Frostling", dz: "活著時你的彈珠變慢（每隻 -10%，最多 -40%）", de: "While alive your balls fly slower (-10% each, max -40%)" },
  prism:    { ic: "🔷", zh: "稜鏡怪", en: "Prism", dz: "被命中時有 30% 機率反傷你（無視護盾）", de: "30% chance to reflect damage to you when hit (ignores Ward)" },
  phoenix:  { ic: "🔥", zh: "轉生怪", en: "Phoenix", dz: "死亡後下一輪以 50% 血量重生一次", de: "Is reborn once with 50% HP next volley" },
  bcloud:   { ic: "☁️", zh: "BOSS 招式：雲幕", en: "BOSS: Cloud Veil", dz: "周圍每有 1 隻敵人，BOSS 受到的傷害 -10%（最多 -40%），先清掉護衛", de: "-10% damage per nearby enemy (max -40%) — clear its escorts" },
  bice:     { ic: "🧊", zh: "BOSS 招式：永凍冰甲", en: "BOSS: Permafrost", dz: "單次傷害最多只能扣最大血量的 8%，並讓你的彈珠 -10% 速度", de: "A single hit deals at most 8% of its max HP; your balls fly 10% slower" },
  bstar:    { ic: "🌟", zh: "BOSS 招式：星核重生", en: "BOSS: Star Core", dz: "被擊倒時以 40% 血量與護盾重生一次；被打時有 20% 機率反傷你", de: "Revives once at 40% HP with a shield; 20% chance to reflect damage when hit" },
  bsummon:  { ic: "🔮", zh: "BOSS 招式：召喚", en: "BOSS: Summon", dz: "每 3 輪在身旁召喚小怪", de: "Summons minions beside it every 3 volleys" },
  bshield:  { ic: "🛡", zh: "BOSS 招式：護盾階段", en: "BOSS: Shield Phases", dz: "血量降到 66%／33% 時展開護盾，必須先打破", de: "Raises a shield at 66% / 33% HP — break it first" },
  btide:    { ic: "🌊", zh: "BOSS 招式：潮汐", en: "BOSS: Tide", dz: "每 4 輪把深坑線往上推 1 排（維持 3 輪），小心被逼進深坑", de: "Every 4 volleys pushes the pit line up 1 row for 3 volleys" },
  barmor:   { ic: "🔰", zh: "BOSS 招式：正面護甲", en: "BOSS: Front Armor", dz: `從下方正面直接命中只有 ${Math.round(BOSS_ARMOR * 100)}% 傷害，改用側面／上方（或爆裂、連鎖）`, de: `Direct hits from below deal only ${Math.round(BOSS_ARMOR * 100)}% — hit from the side/top, or use splash/chain` }
};
function tellAb(g, key, force) {
  g.seenAb = g.seenAb || {};
  if (!force && g.seenAb[key]) return;
  g.seenAb[key] = 1;
  const a = AB[key]; if (!a) return;
  try { ac(dc(`${a.ic} ${key[0] === "b" && a.zh.startsWith("BOSS") ? "" : "新怪物「"}${a.zh}${key[0] === "b" && a.zh.startsWith("BOSS") ? "" : "」"}：${a.dz}`, `${a.ic} ${a.en} — ${a.de}`)); } catch (e) {}
}
function pickAb(g) {
  const zi = zoneIdx(g.floor);
  if (zi < 1) return null;
  const p = [0, 0.22, 0.28, 0.32, 0.34, 0.36, 0.38][zi] || 0.42;
  const R = g.rnd || Math.random;
  if (R() >= p) return null;
  const pools = {
    1: ["magma", "magma", "fuse"],
    2: ["healer", "shield", "summoner"],
    3: ["blink", "blink", "splitter", "splitter", "summoner", "healer", "shield", "fuse", "magma"],
    4: ["gust", "gust", "aegis", "aegis", "healer", "blink", "fuse"],
    5: ["icearmor", "icearmor", "chill", "chill", "shield", "splitter", "summoner"],
    6: ["prism", "prism", "phoenix", "phoenix", "blink", "summoner", "splitter", "aegis"]
  };
  const pool = pools[zi] || ["blink", "splitter", "summoner", "healer", "shield", "fuse", "magma", "gust", "aegis", "icearmor", "chill", "prism", "phoenix"];
  return pool[Math.floor(R() * pool.length)];
}
function setupAb(g, en, ab) {
  en.ab = ab;
  if (ab === "fuse") { en.fuse = 4; en.atkF = Math.round(4 + g.floor * 0.8); }
  else if (ab === "shield") { en.sh = Math.max(1, Math.ceil(en.hp * 0.6)); en.shMax = en.sh; }
  else if (ab === "summoner") en.sc = 0;
  tellAb(g, ab);
}
function cellFree(g, c, r, span, ig) {
  if (c < 0 || c + span > COLS || r < 0) return false;
  for (const o of g.enemies) { if (o.dead || o === ig) continue; if (o.r === r && o.c < c + span && o.c + (o.span || 1) > c) return false; }
  return true;
}
function spawnMinion(g, c, r, hpBase) {
  const hp = Math.max(1, Math.round(hpBase));
  const en = { id: g.nextId++, c, r, kind: "n", hp, max: hp, elite: false, minion: true, z: zoneIdx(g.floor), look: (c + g.floor) % 5, ico: EN_ICONS[(c + g.floor) % EN_ICONS.length], flash: 0, kick: 0, dead: false, intro: 0.5 };
  g.enemies.push(en);
  const ct = enCenter(en); burst(g, ct.x, ct.y, "#b98cf0", 8, 130); ring(g, ct.x, ct.y, 24, "#b98cf0", 2, 0.3);
  return en;
}
const minionHp = g => (2 + g.floor * 1.3) * hpMul(g.floor) * (g.enemyHpMul || 1) * 0.5;
function trySummon(g, src, n) {
  if (g.enemies.filter(e => !e.dead).length >= AB_CAP) return 0;
  const cells = [];
  [src.r, src.r - 1, src.r + 1].forEach(r => { if (r < 0 || r > g.pit - 5) return; shuffle([0, 1, 2, 3, 4, 5]).forEach(c => { if (cellFree(g, c, r, 1)) cells.push([c, r]); }); });
  let made = 0;
  for (const [c, r] of cells) { if (made >= n) break; if (!cellFree(g, c, r, 1)) continue; spawnMinion(g, c, r, minionHp(g)); made++; }
  if (made) { const ct = enCenter(src); pop(g, ct.x, ct.y - 14, dc("召喚！", "Summon!"), "#d6b3ff", true); sfx(300, 0.15, "triangle", 0.05); }
  return made;
}
function splitSpawn(g, en) {
  const cells = shuffle([[en.c - 1, en.r], [en.c + 1, en.r], [en.c, en.r - 1], [en.c - 1, en.r - 1], [en.c + 1, en.r - 1]]);
  let made = 0;
  for (const [c, r] of cells) { if (made >= 2) break; if (r > g.pit - 3 || !cellFree(g, c, r, 1, en)) continue; spawnMinion(g, c, r, Math.max(1, en.max * 0.35)); made++; }
}
function deathHook(g, en) {
  if (en.ab === "magma") {
    const c = enCenter(en); burst(g, c.x, c.y, "#ff7a2a", 22, 260); ring(g, c.x, c.y, 70, "#ff7a2a", 3, 0.5);
    g.enemies.forEach(o => { if (!o.dead && o !== en && Math.abs(o.c - en.c) <= 1 && Math.abs(o.r - en.r) <= 1) o.burn = Math.max(o.burn || 0, 4); });
  }
  if (en.ab === "splitter" && !en.minion) splitSpawn(g, en);
  if (en.ab === "phoenix" && !en.reborn) (g.rebirths = g.rebirths || []).push({ c: en.c, r: en.r, max: en.max });
  if (en.ab === "btide") restorePit(g);
}
function restorePit(g) {
  if (!g.pitPush) return;
  g.pit = Math.min(PIT_MAX, g.pit + g.pitPush); g.pitPush = 0; g.pitT = 0;
  pop(g, W / 2, g.pit * RH + GRID_TOP - 10, dc("潮汐退去", "Tide recedes"), "#8fd3ff", true);
}
function bossPhase(g, en) {
  if (en.ab !== "bshield") return;
  const ph = en.hp <= en.max * 0.33 ? 2 : en.hp <= en.max * 0.66 ? 1 : 0;
  if (ph > (en.phase || 0)) {
    en.phase = ph; en.sh = Math.ceil(en.max * 0.15); en.shMax = en.sh;
    const c = enCenter(en); ring(g, c.x, c.y, 110, "#8fd3ff", 4, 0.7); pop(g, c.x, c.y - 16, dc("護盾展開！", "SHIELD UP!"), "#8fd3ff", true); g.shake = Math.max(g.shake, 10); sfx(440, 0.3, "triangle", 0.07);
  }
}
function tide(g) {
  if ((g.pitPush || 0) >= 2) return;
  const live = g.enemies.filter(e => !e.dead), maxR = live.length ? Math.max(...live.map(e => e.r)) : 0;
  if (maxR > g.pit - 5) return;   // 場面太逼近時不推，避免瞬間暴斃
  g.pit--; g.pitPush = (g.pitPush || 0) + 1; g.pitT = 3; g.shake = Math.max(g.shake, 10);
  ring(g, W / 2, GRID_TOP + g.pit * RH, 200, "#4fd1c5", 4, 0.7); pop(g, W / 2, GRID_TOP + g.pit * RH - 14, dc("🌊 潮汐湧動！深坑線上移", "🌊 Tide! Pit line rises"), "#8fd3ff", true); sfx(120, 0.4, "sine", 0.08);
}
function abilityTick(g) {
  if (g.rebirths && g.rebirths.length) {
    g.rebirths.forEach(rb => {
      const cs = [rb.c, rb.c - 1, rb.c + 1].filter(c => cellFree(g, c, rb.r, 1));
      if (!cs.length) return;
      const ne = spawnMinion(g, cs[0], rb.r, Math.max(1, rb.max * 0.5)); ne.ab = "phoenix"; ne.reborn = true;
      const ct = enCenter(ne); pop(g, ct.x, ct.y - 12, dc("重生！", "Reborn!"), "#ffb35a", true); ring(g, ct.x, ct.y, 40, "#ffb35a", 2, 0.4);
    });
    g.rebirths = [];
  }
  if (g.pitPush > 0) { g.pitT--; if (g.pitT <= 0) restorePit(g); }
  g.enemies.filter(e => !e.dead).forEach(e => {
    if (e.dead) return;
    const ct = enCenter(e);
    if (e.ab === "healer") {
      g.enemies.forEach(o => { if (!o.dead && o !== e && !o.boss && o.hp < o.max && Math.abs(o.c - e.c) <= 1 && Math.abs(o.r - e.r) <= 1) { const h = Math.max(1, Math.ceil(o.max * 0.15)); o.hp = Math.min(o.max, o.hp + h); const oc = enCenter(o); pop(g, oc.x, oc.y - 14, "+" + fmtN(h), "#6fcf8a", false); } });
      ring(g, ct.x, ct.y, 40, "#6fcf8a", 1.5, 0.35);
    } else if (e.ab === "fuse") {
      e.fuse--;
      if (e.fuse <= 0) {
        e.dead = true; (g.ghosts = g.ghosts || []).push({ ...eRect(e), col: "#ff8a4a", boss: false, t: 0.3, m: 0.3 });
        burst(g, ct.x, ct.y, "#ff8a4a", 28, 300); ring(g, ct.x, ct.y, 80, "#ff8a4a", 3, 0.5);
        pop(g, ct.x, ct.y - 10, dc("自爆！", "BOOM!"), "#ff8a4a", true); hurtPlayer(g, e.atkF, true);
      } else if (e.fuse === 1) pop(g, ct.x, ct.y - 14, "⚠", "#ff6b5a", true);
    } else if (e.ab === "summoner") {
      e.sc = (e.sc || 0) + 1;
      if (e.sc >= 3) { e.sc = 0; trySummon(g, e, 1); }
    } else if (e.ab === "blink" && Math.random() < 0.6) {
      const free = [0, 1, 2, 3, 4, 5].filter(c => c !== e.c && cellFree(g, c, e.r, 1, e));
      if (free.length) { burst(g, ct.x, ct.y, "#d08cff", 8, 160); e.c = free[Math.floor(Math.random() * free.length)]; const c2 = enCenter(e); burst(g, c2.x, c2.y, "#d08cff", 8, 160); ring(g, c2.x, c2.y, 26, "#d08cff", 2, 0.3); sfx(900, 0.08, "sine", 0.04); }
    }
    if (e.boss) {
      e.bt = (e.bt || 0) + 1;
      if (e.ab === "bsummon" && e.bt % 3 === 0) trySummon(g, e, 2 + Math.floor(((e.bk || 1) - 1) / 4));
      if (e.ab === "btide" && e.bt % 4 === 0) tide(g);
    }
  });
  g.enemies = g.enemies.filter(e => !e.dead);
}
// 前進一輪：由下往上處理；被冰封的怪不動，並擋住它後面的怪。BOSS 層一律全體前進（確保第 0 排空出來）
function advance(g, stp) {
  const all = g.floor % 10 === 0;
  g.enemies.filter(e => !e.dead).sort((a, b) => b.r - a.r).forEach(e => {
    if (e.frz > 0) { e.frz--; if (!all) return; }
    const steps = stp + (e.ab === "gust" && !all ? 1 : 0);
    for (let k = 0; k < steps; k++) { if (all || cellFree(g, e.c, e.r + 1, e.span || 1, e)) e.r++; else break; }
  });
}
function magnetPull(g, en) {
  const row = g.enemies.filter(o => !o.dead && o !== en && !o.boss && o.r === en.r && (o.span || 1) === 1).sort((a, b) => Math.abs(a.c - en.c) - Math.abs(b.c - en.c));
  let moved = 0;
  row.forEach(o => { const dir = Math.sign(en.c - o.c); if (Math.abs(en.c - o.c) > 1 && cellFree(g, o.c + dir, o.r, 1, o)) { o.c += dir; moved++; } });
  if (moved) { const c = enCenter(en); ring(g, c.x, c.y, 60, "#9fb4ff", 2, 0.3); sfx(260, 0.08, "sine", 0.04); }
}
function spawnRowInner(g, row) {
  const R = g.rnd || Math.random;
  if (g.floor % 10 === 0 && row === 0) {
    // 第 1 隻 BOSS 簡單、之後逐隻變難：k = 第幾隻 BOSS（第10層=1、第20層=2…）
    const bk = Math.floor(g.floor / 10), bt = BOSS_TIER[Math.min(bk, BOSS_TIER.length) - 1], bab = BOSS_AB[(bk - 1) % BOSS_AB.length];
    const hp = Math.max(1, Math.round((40 + g.floor * 11) * hpMul(g.floor) * bt.hp * (g.bossHpMul || 1)));
    g.enemies.push({ id: g.nextId++, c: 2, r: 0, span: 2, boss: true, kind: "boss", ab: bab, bk, hp, max: hp, elite: false, ico: "👑", z: zoneIdx(g.floor), look: 0, intro: 1.3, atk: Math.max(1, Math.round((9 + g.floor * 2) * bt.atk)), cd: bt.cd, t: -1, cnt: 0, flash: 0, kick: 0, dead: false });
    tellAb(g, bab, true);
    return;
  }
  const n = Math.min(6, (g.extraEnemy || 0) + 4 + (R() < 0.5 ? 1 : 0) + (g.floor > 8 && R() < 0.4 ? 1 : 0) + (g.floor > 25 && R() < 0.5 ? 1 : 0));
  shuffle([0, 1, 2, 3, 4, 5], R).filter(c => cellFree(g, c, row, 1)).slice(0, n).forEach(c => {
    const rd = R(), kind = g.floor >= 3 && rd < 0.1 ? "bomb" : rd > 0.93 ? "gold" : "n";
    const elite = kind === "n" && g.floor >= 4 && R() < 0.16 + Math.min(0.3, g.floor * 0.006);
    let hp = Math.round((2 + Math.floor(g.floor * 1.3) + Math.floor(R() * (2 + Math.floor(g.floor / 5)))) * hpMul(g.floor));
    if (elite) hp *= 2;
    hp = Math.max(1, Math.round(hp * (g.enemyHpMul || 1)));
    if (kind === "gold") hp = Math.max(2, Math.ceil(hp * 0.6));
    const en = { id: g.nextId++, c, r: row, kind, hp, max: hp, elite, z: zoneIdx(g.floor), look: (c + g.floor) % 5, ico: kind === "bomb" ? "💣" : kind === "gold" ? "💰" : EN_ICONS[(c + g.floor) % EN_ICONS.length], flash: 0, kick: 0, dead: false };
    if (kind === "n") { const ab = pickAb(g); if (ab) setupAb(g, en, ab); }
    g.enemies.push(en);
    armEnemy(g, en);
  });
}
function spawnRow(g, row) {
  const prev = g.rnd;
  g.rnd = seedRng(g, "s" + g.floor + ":" + row);
  try { spawnRowInner(g, row); } finally { g.rnd = prev || Math.random; }
}
function newGame(p) {
  const base = buildBase(p);
  const g = { base, loadout: base.slice(), balls: [], queue: [], enemies: [], bolts: [], floor: 1, kills: 0, goldW: 0, xp: 0, level: 1, pending: 0, dmgBonus: 0, spd: BASE_SPEED, skip: 0, pit: PIT_ROW, aim: Math.PI / 2, aiming: false, firing: false, fireAngle: Math.PI / 2, fireT: 0, volleyT: 0, over: false, upgrading: false, nextId: 1, startedAt: Date.now(), parts: [], pops: [], shake: 0, combo: 0, maxCombo: 0, comboT: 0, crit: 0, goldMul: 1, storm: 0, hitstop: 0, zone: 0, zPrev: 0, zF: 1, rings: [], banner: null, bossT: 0, lvT: 0, hp: HP_BASE, maxHp: HP_BASE, hpShow: HP_BASE, hurt: 0, shots: [] };
  const M = (p && p.bpMeta) || {};
  g.dmgMul = 1; g.xpMul = 1 + 0.08 * (M.xp || 0); g.enemyHpMul = 1; g.bossHpMul = 1; g.enemyAtkMul = 1; g.extraEnemy = 0; g.affix = null; g.revives = M.revive || 0; g.rerolls = M.reroll || 0;
  g.dmgBonus = M.dmg || 0; g.crit = 0.04 * (M.crit || 0); g.goldMul = 1 + 0.1 * (M.gold || 0); g.spd = Math.min(900, BASE_SPEED * (1 + 0.06 * (M.spd || 0))); g.pit = Math.min(PIT_MAX, PIT_ROW + (M.pit || 0));
  for (let i = 0; i < (M.balls || 0); i++) g.loadout.push(base[Math.floor(Math.random() * base.length)]);
  g.maxHp += 15 * (M.hp || 0); g.hp = g.maxHp; g.hpShow = g.hp; g.regen = M.regen || 0; g.xp = M.head || 0; g.shield = M.ward || 0; g.pierceB = M.pen || 0;
  g.seedKey = ys(); g.rnd = Math.random; g.upN = 0;   // 每日種子：以「開局當天」的日期為準
  for (let r = 0; r < 4; r++) spawnRow(g, r);
  return g;
}
const needXp = lv => 2 + 2 * lv + Math.floor(lv * lv / 12);
function eRect(en) { return { x: en.c * CW + 3, y: GRID_TOP + en.r * RH + 2, w: CW * (en.span || 1) - 6, h: RH - 4 }; }
function circleRect(b, en) {
  const r = eRect(en), cx = Math.max(r.x, Math.min(b.x, r.x + r.w)), cy = Math.max(r.y, Math.min(b.y, r.y + r.h));
  const dx = b.x - cx, dy = b.y - cy;
  return dx * dx + dy * dy < BALL_R * BALL_R ? { dx, dy, inside: dx === 0 && dy === 0 } : null;
}
/* ===== 打擊感：音效、粒子、傷害數字、震屏、停頓 ===== */
const KC = { n: "#c9b3ff", bomb: "#ff8a4a", gold: "#ffd36b", boss: "#e8c468" };
const EC = { n: ["#33204f", "#1d1030", "#7b5cc4"], bomb: ["#5a2418", "#2c120c", "#ff8a4a"], gold: ["#5a4614", "#2e230a", "#ffd36b"], boss: ["#5a3a14", "#2a160a", "#e8c468"], elite: ["#4a2a18", "#241008", "#e8c468"] };
const HP_BASE = 100, HP_PER_LV = 10, LV_HEAL = 0.3, BOSS_HEAL = 0.25;
function armEnemy(g, en) {
  if (en.kind !== "n" || g.floor < 4) return;
  if (en.elite) { en.atk = Math.round((3 + g.floor * 0.8) * 1.5); en.cd = 2; }
  else if ((g.rnd || Math.random)() < Math.min(0.45, 0.14 + g.floor * 0.006)) { en.atk = Math.round(3 + g.floor * 0.65); en.cd = 3; }
  else return;
  en.t = Math.floor((g.rnd || Math.random)() * en.cd) - 1; en.cnt = 0;
}
function hurtPlayer(g, d, heavy) {
  if (g.shield > 0) { g.shield--; pop(g, W / 2, SHOOT_Y - 26, dc("擋下", "Blocked"), "#8fd3ff", true); ring(g, W / 2, SHOOT_Y, 50, "#8fd3ff", 3, 0.4); sfx(600, 0.12, "sine", 0.05); return; }
  g.hp = Math.max(0, g.hp - d); g.hurt = heavy ? 0.7 : 0.45; g.shake = Math.max(g.shake, heavy ? 12 : 6);
  pop(g, W / 2, SHOOT_Y - 26, "-" + fmtN(d), "#ff6b5a", true); ring(g, W / 2, SHOOT_Y, heavy ? 80 : 50, "#ff6b5a", 3, 0.4);
  sfx(heavy ? 80 : 130, 0.25, "sawtooth", 0.08); try { navigator.vibrate && navigator.vibrate(heavy ? 40 : 20); } catch (e) {}
}
function enemiesAttack(g) {
  let total = 0, heavy = false;
  g.enemies.forEach(e => {
    if (e.dead || !e.atk) return;
    if (e.stun) { e.stun = false; return; }
    e.t++; if (e.t < e.cd) return;
    e.t = 0; e.cnt++;
    const big = !!e.boss && e.cnt % 3 === 0, c = enCenter(e);
    total += Math.round(e.atk * (big ? 2 : 1) * (g.enemyAtkMul || 1)); heavy = heavy || big; e.kick = 1;
    g.shots.push({ x1: c.x, y1: c.y, x2: W / 2, y2: SHOOT_Y, t: 0.3, m: 0.3, big });
  });
  if (total > 0) hurtPlayer(g, total, heavy);
}
const ZONES = [
  { zh: "月光", en: "Moonlit", bg: ["#1a1438", "#0a0720"], acc: "#b9c8ff", star: "#dfe8ff", pal: ["#2b3166", "#141a3c", "#9fb4ff"], glow: "rgba(130,150,255,.16)" },
  { zh: "熔岩", en: "Magma", bg: ["#2c1010", "#12060a"], acc: "#ff8a4a", star: "#ffd0a0", pal: ["#5f2616", "#2a0e0c", "#ff7a3a"], glow: "rgba(255,110,50,.16)" },
  { zh: "深海", en: "Abyssal Sea", bg: ["#08203a", "#040b18"], acc: "#4fd1c5", star: "#aef5ee", pal: ["#124560", "#081e30", "#4fd1c5"], glow: "rgba(60,200,190,.14)" },
  { zh: "虛空", en: "The Void", bg: ["#190c2c", "#04020a"], acc: "#d08cff", star: "#f0d6ff", pal: ["#3c2160", "#1b0f33", "#c77dff"], glow: "rgba(190,100,255,.16)" },
  { zh: "雲端", en: "Cloud Realm", bg: ["#2b2b5e", "#14123a"], acc: "#ffc9a0", star: "#fff1e0", pal: ["#4a4a8c", "#22204e", "#ffc9a0"], glow: "rgba(255,190,150,.16)" },
  { zh: "冰原", en: "Frozen Plains", bg: ["#0c2a3a", "#04101a"], acc: "#bfefff", star: "#e6fbff", pal: ["#2a6a8a", "#0e2a3c", "#bfefff"], glow: "rgba(150,230,255,.16)" },
  { zh: "星界", en: "Starfield", bg: ["#0b0b26", "#010109"], acc: "#ffe36b", star: "#fff6c0", pal: ["#2a2a6a", "#10103a", "#ffe36b"], glow: "rgba(255,230,120,.14)" }
];
const zoneIdx = f => Math.floor((Math.max(1, f) - 1) / 10);
const zoneOf = f => ZONES[zoneIdx(f) % ZONES.length];
function hexRgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
function mixHex(a, b, t) { const A = hexRgb(a), B = hexRgb(b); return `rgb(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)})`; }
function fmtN(n) {
  n = Math.max(0, Math.ceil(n)); if (n < 1000) return String(n);
  for (const [v, s] of [[1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]]) if (n >= v) { const x = n / v; let o = (x >= 10 ? String(Math.round(x)) : String(Math.floor(x * 10) / 10)) + s; return { "1000K": "1M", "1000M": "1B", "1000B": "1T" }[o] || o; }
  return String(n);
}
const kcol = en => en.kind === "n" ? ZONES[(en.z || 0) % ZONES.length].acc : (KC[en.kind] || KC.n);
function ring(g, x, y, r1, col, w, dur) { if (g.rings.length > 24) g.rings.shift(); const d = dur || 0.45; g.rings.push({ x, y, r1, t: d, m: d, col, w: w || 2 }); }
function announceFloor(g) {
  const zi = zoneIdx(g.floor);
  if (zi !== g.zone) { g.zPrev = g.zone; g.zone = zi; g.zF = 0; }
  const boss = g.floor % 10 === 0, newZ = (g.floor - 1) % 10 === 0 && g.floor > 1, d = boss ? 2 : newZ ? 2.2 : 0.9;
  g.banner = { t: d, m: d, floor: g.floor, boss, newZ };
  if (boss) { g.zoom = 0.05; g.bossT = 1.8; g.shake = Math.max(g.shake, 12); sfx(70, 0.6, "sawtooth", 0.09); try { navigator.vibrate && navigator.vibrate(30); } catch (e) {} }
  else if (newZ) sfx(520, 0.35, "sine", 0.05);
}
const STARS = Array.from({ length: 36 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.2 + 0.3, p: Math.random() * 6 }));
let AUD = null, lastSfx = 0, SFXBUS = null;
const SFX_BOOST = 2.6; /* 音效整體增益；要再大聲改這裡，或用遊戲中的音效滑桿 */
function sfxOut() {
  AUD = AUD || new (window.AudioContext || window.webkitAudioContext)();
  if (!SFXBUS || SFXBUS.ctx !== AUD) { const g = AUD.createGain(), cp = AUD.createDynamicsCompressor(); cp.threshold.value = -10; cp.knee.value = 12; cp.ratio.value = 6; cp.attack.value = 0.002; cp.release.value = 0.12; g.connect(cp); cp.connect(AUD.destination); SFXBUS = { ctx: AUD, g }; }
  SFXBUS.g.gain.value = SFX_BOOST * st.sfxVol;
  return SFXBUS.g;
}
function tone(f, d, ty, vol, f2) {
  if (st.mute || st.sfxVol <= 0) return;
  try { const out = sfxOut(), t = AUD.currentTime, o = AUD.createOscillator(), gn = AUD.createGain(); o.type = ty; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d); gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(gn); gn.connect(out); o.start(t); o.stop(t + d + 0.02); } catch (e) {}
}
let lastHit = 0;
function hitSnd(cmb, crit) {
  const now = performance.now(); if (now - lastHit < 28) return; lastHit = now;
  const k = Math.min(cmb, 40);
  tone(190 + k * 4, 0.08, "sine", 0.3, 70);
  tone(520 + k * 18, 0.05, "triangle", 0.16);
  sfxNoise(0.05, 0.2, 6500, true);
  if (crit) tone(1500, 0.11, "square", 0.07, 900);
}
function sfx(f, d, ty, vol) {
  const now = performance.now(); if (st.mute || st.sfxVol <= 0 || now - lastSfx < 22) return; lastSfx = now;
  try { sfxOut(); const o = AUD.createOscillator(), gn = AUD.createGain(), t = AUD.currentTime; o.type = ty || "square"; o.frequency.value = f; gn.gain.setValueAtTime(vol || 0.05, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(gn); gn.connect(sfxOut()); o.start(); o.stop(t + d); } catch (e) {}
}
let NZ = null, lastNz = 0;
function sfxNoise(d, vol, f, force) {
  const now = performance.now(); if (st.mute || st.sfxVol <= 0 || (!force && now - lastNz < 30)) return; if (!force) lastNz = now;
  try {
    AUD = AUD || new (window.AudioContext || window.webkitAudioContext)();
    if (!NZ) { NZ = AUD.createBuffer(1, Math.floor(AUD.sampleRate * 0.6), AUD.sampleRate); const a = NZ.getChannelData(0); for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1; }
    const sr = AUD.createBufferSource(), fl = AUD.createBiquadFilter(), gn = AUD.createGain(), t = AUD.currentTime;
    sr.buffer = NZ; fl.type = "lowpass"; fl.frequency.setValueAtTime(f, t); fl.frequency.exponentialRampToValueAtTime(100, t + d);
    gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
    sr.connect(fl); fl.connect(gn); gn.connect(sfxOut()); sr.start(); sr.stop(t + d);
  } catch (e) {}
}
function stopHit(g, t) { if ((g.hsCd || 0) > 0) return; g.hitstop = Math.max(g.hitstop, t); g.hsCd = 0.18; }
function impact(g, x, y, nx, ny, col, big) {
  const n = big ? 10 : 5, base = Math.atan2(ny, nx);
  for (let i = 0; i < n; i++) { const a = base + (Math.random() - 0.5) * 1.5, s2 = (160 + Math.random() * 260) * (big ? 1.25 : 1), t = 0.18 + Math.random() * 0.22; g.parts.push({ x, y, vx: Math.cos(a) * s2, vy: Math.sin(a) * s2, t, m: t, col: Math.random() < 0.5 ? "#fff3c4" : col, sz: 1.6 + Math.random() * 1.6, ln: true }); }
  g.stars = g.stars || [];
  if (g.rings.length < 24) ring(g, x, y, big ? 30 : 17, big ? "#fff3c4" : col, big ? 3 : 2, 0.2);
  if (g.stars.length < 30) g.stars.push({ x, y, t: 0.14, m: 0.14, r: big ? 18 : 10, col: big ? "#fff3c4" : "#ffffff", a: Math.random() * 1.57 });
}
function wallFx(g, b) { burst(g, b.x, b.y, "#f0e6d6", 3, 70); if (g.rings.length < 20) ring(g, b.x, b.y, 13, "#cdbbff", 1.5, 0.22); sfx(190 + Math.random() * 40, 0.04, "triangle", 0.05); }
/* ===== 🎵 背景音樂（純 WebAudio 即時合成，不需要任何音檔）=====
   四個區域各有自己的調式、速度與音色；依戰況切換強度：瞄準時安靜（鐘琴＋低音＋心跳）、發射時加入鼓點、
   危險或 BOSS 時全力（十六分音符、軍鼓、合唱和弦）。選升級時音樂會悶住，BOSS 倒下有慶祝音。音量改 VOL 即可。 */
const Music = (function () {
  const VOL = 0.34;
  let ctx = null, lp = null, master = null, dryBus = null, rvIn = null, padBus = null, padFilter = null, noiseBuf = null, timer = 0;
  let started = false, lastSync = 0, step = 0, nextT = 0, stepDur = 0.2, barIdx = 0, tr = null, chord = null, zoneCur = -1, curVol = -1;
  let zoneWant = 0, bossWant = false, dangerWant = false, muffleWant = false, holdUntil = 0, inten = 1;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const Ch = (r, iv) => ({ r, iv });
  const TR = [
    { bpm: 76, pad: { type: "triangle", det: 6, lp: 1100, g: 0.05 }, bell: "bell", perc: 0.55, saw: false,
      prog: [Ch(57, [0, 3, 7, 10]), Ch(53, [0, 4, 7, 11]), Ch(60, [0, 4, 7, 11]), Ch(55, [0, 4, 7, 9]), Ch(57, [0, 3, 7, 10]), Ch(53, [0, 4, 7, 11]), Ch(50, [0, 3, 7, 10]), Ch(52, [0, 4, 7, 10])] },
    { bpm: 100, pad: { type: "sawtooth", det: 9, lp: 900, g: 0.03 }, bell: "pluck", perc: 1, saw: true,
      prog: [Ch(50, [0, 3, 7]), Ch(50, [0, 3, 7]), Ch(46, [0, 4, 7]), Ch(45, [0, 4, 7, 10]), Ch(50, [0, 3, 7]), Ch(43, [0, 3, 7]), Ch(46, [0, 4, 7]), Ch(45, [0, 4, 7, 10])] },
    { bpm: 68, pad: { type: "sine", det: 5, lp: 800, g: 0.07 }, bell: "bell", perc: 0.45, saw: false,
      prog: [Ch(52, [0, 3, 7, 10, 14]), Ch(48, [0, 4, 7, 11]), Ch(50, [0, 4, 7, 9]), Ch(47, [0, 3, 7, 10]), Ch(52, [0, 3, 7, 10, 14]), Ch(45, [0, 4, 7, 10]), Ch(47, [0, 3, 7, 10]), Ch(52, [0, 3, 7, 10, 14])] },
    { bpm: 86, pad: { type: "sawtooth", det: 16, lp: 1000, g: 0.028 }, bell: "bell", perc: 0.9, saw: true,
      prog: [Ch(49, [0, 3, 7]), Ch(57, [0, 4, 7, 11]), Ch(54, [0, 3, 7, 10]), Ch(56, [0, 4, 7, 10]), Ch(49, [0, 3, 7]), Ch(53, [0, 3, 6, 9]), Ch(57, [0, 4, 7, 11]), Ch(56, [0, 4, 7, 10])] },
    // 雲端：明亮、飄浮的大調
    { bpm: 84, pad: { type: "sine", det: 7, lp: 1500, g: 0.055 }, bell: "bell", perc: 0.5, saw: false,
      prog: [Ch(53, [0, 4, 7, 11]), Ch(55, [0, 4, 7, 14]), Ch(60, [0, 4, 7, 11]), Ch(57, [0, 3, 7, 10]), Ch(53, [0, 4, 7, 11]), Ch(55, [0, 4, 7, 14]), Ch(62, [0, 4, 7, 9]), Ch(60, [0, 4, 7, 11])] },
    // 冰原：緩慢、稀疏、冷冽
    { bpm: 62, pad: { type: "triangle", det: 4, lp: 700, g: 0.06 }, bell: "bell", perc: 0.35, saw: false,
      prog: [Ch(50, [0, 3, 7, 10, 14]), Ch(46, [0, 4, 7, 11]), Ch(53, [0, 4, 7, 11]), Ch(48, [0, 3, 7, 10]), Ch(50, [0, 3, 7, 10, 14]), Ch(45, [0, 3, 7, 10]), Ch(46, [0, 4, 7, 11]), Ch(48, [0, 3, 7, 10])] },
    // 星界：神祕、不穩定的和弦
    { bpm: 92, pad: { type: "sawtooth", det: 12, lp: 1300, g: 0.026 }, bell: "pluck", perc: 0.8, saw: true,
      prog: [Ch(52, [0, 3, 7, 14]), Ch(51, [0, 3, 6, 9]), Ch(56, [0, 4, 8, 11]), Ch(54, [0, 3, 6, 10]), Ch(52, [0, 3, 7, 14]), Ch(48, [0, 4, 7, 11]), Ch(55, [0, 4, 8, 10]), Ch(54, [0, 3, 6, 10])] }
  ];
  function fit(n, lo) { while (n < lo) n += 12; while (n >= lo + 24) n -= 12; return n; }
  function prep(c) {
    let b = c.r; while (b > 45) b -= 12; while (b < 33) b += 12;
    return { b, pad: c.iv.map(i => fit(c.r + i, 52)), arp: c.iv.map(i => fit(c.r + i, 67)) };
  }
  function setup() {
    AUD = AUD || new (window.AudioContext || window.webkitAudioContext)();
    ctx = AUD;
    master = ctx.createGain(); master.gain.value = 0;
    lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 18000;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
    dryBus = ctx.createGain(); dryBus.connect(lp);
    const conv = ctx.createConvolver(), len = Math.floor(ctx.sampleRate * 2.6), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4); }
    conv.buffer = ir; rvIn = ctx.createGain(); const wet = ctx.createGain(); wet.gain.value = 0.7; rvIn.connect(conv); conv.connect(wet); wet.connect(lp);
    lp.connect(master); master.connect(comp); comp.connect(ctx.destination);
    padBus = ctx.createGain(); padFilter = ctx.createBiquadFilter(); padFilter.type = "lowpass"; padFilter.frequency.value = 1000; padBus.connect(padFilter);
    padFilter.connect(dryBus); const ps = ctx.createGain(); ps.gain.value = 0.55; padFilter.connect(ps); ps.connect(rvIn);
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.12; lg.gain.value = 350; lfo.connect(lg); lg.connect(padFilter.frequency); lfo.start();
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    document.addEventListener("visibilitychange", () => { if (!ctx) return; if (document.hidden) ctx.suspend(); else if (started) ctx.resume(); });
  }
  function toBus(n, send) { n.connect(dryBus); if (send > 0) { const g = ctx.createGain(); g.gain.value = send; n.connect(g); g.connect(rvIn); } }
  function padNote(t, midi, dur, p) {
    [-p.det, p.det].forEach(dt => {
      const o = ctx.createOscillator(), g = ctx.createGain(), a = Math.min(1.1, dur * 0.3);
      o.type = p.type; o.frequency.value = mtof(midi); o.detune.value = dt;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(p.g, t + a); g.gain.setValueAtTime(p.g, t + Math.max(a, dur - 0.4)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.7);
      o.connect(g); g.connect(padBus); o.start(t); o.stop(t + dur + 0.8);
    });
  }
  function bell(t, midi, vel, kind) {
    const f = mtof(midi);
    if (kind === "pluck") {
      const o = ctx.createOscillator(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = "triangle"; o.frequency.value = f; fl.type = "lowpass"; fl.frequency.value = 2600;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.075 * vel, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(fl); fl.connect(g); toBus(g, 0.35); o.start(t); o.stop(t + 0.35); return;
    }
    [[1, 1, 1.3], [2.005, 0.35, 0.7], [3.01, 0.16, 0.4], [4.2, 0.07, 0.22]].forEach(([r, a, d]) => {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine"; o.frequency.value = f * r;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.06 * vel * a, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); toBus(g, 0.6); o.start(t); o.stop(t + d + 0.05);
    });
  }
  function bassNote(t, midi, dur, saw, vel) {
    const f = mtof(midi), o = ctx.createOscillator(), o2 = ctx.createOscillator(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = saw ? "sawtooth" : "triangle"; o2.type = "sine"; o.frequency.value = f; o2.frequency.value = f; fl.type = "lowpass"; fl.frequency.value = saw ? 420 : 280;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.15 * vel, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(fl); o2.connect(fl); fl.connect(g); toBus(g, 0.05); o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }
  function kick(t, v) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine"; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24); o.connect(g); g.connect(dryBus); o.start(t); o.stop(t + 0.26);
  }
  function noiseHit(t, type, freq, dur, v, send) {
    const src = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); src.buffer = noiseBuf; fl.type = type; fl.frequency.value = freq;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); src.connect(fl); fl.connect(g); toBus(g, send); src.start(t, Math.random() * 0.5, dur + 0.02);
  }
  function snare(t, v) { noiseHit(t, "bandpass", 1900, 0.16, 0.2 * v, 0.25); const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "triangle"; o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(110, t + 0.08); g.gain.setValueAtTime(0.1 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1); o.connect(g); g.connect(dryBus); o.start(t); o.stop(t + 0.12); }
  function stab(t, notes, dur) {
    notes.forEach(m => [-8, 8].forEach(dt => {
      const o = ctx.createOscillator(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = "sawtooth"; o.frequency.value = mtof(m); o.detune.value = dt; fl.type = "lowpass"; fl.frequency.value = 1500;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.028, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(fl); fl.connect(g); toBus(g, 0.35); o.start(t); o.stop(t + dur + 0.05);
    }));
  }
  function sched(t) {
    const s = step % 16;
    if (s === 0) {
      if (zoneWant !== zoneCur) { zoneCur = zoneWant; barIdx = 0; }
      tr = TR[zoneCur % TR.length];
      stepDur = 60 / (tr.bpm * (bossWant ? 1.28 : dangerWant ? 1.08 : 1)) / 4;
      chord = prep(tr.prog[barIdx % tr.prog.length]); barIdx++;
      padFilter.frequency.setTargetAtTime(tr.pad.lp, t, 1);
      chord.pad.forEach(n => padNote(t, n, stepDur * 16, tr.pad));
      if (bossWant) stab(t, chord.pad.slice(0, 3), stepDur * 6);
    }
    inten = bossWant || dangerWant ? 3 : performance.now() < holdUntil ? 2 : 1;
    const I = inten, ct = chord.arp, bn = barIdx, b = chord.b, pv = tr.perc;
    // 鐘琴／撥弦
    if (I === 1) { if (s === 0 || s === 6 || s === 10 || (s === 14 && bn % 2 === 0)) bell(t, ct[(s / 2 + bn) % ct.length | 0], s === 0 ? 0.9 : 0.65, tr.bell); }
    else if (I === 2) { if (s % 2 === 0) bell(t, ct[(s / 2 + bn) % ct.length | 0], s % 4 === 0 ? 0.85 : 0.6, tr.bell); }
    else { bell(t, ct[(s + bn) % ct.length] + (s % 8 >= 4 ? 12 : 0), s % 4 === 0 ? 0.85 : 0.45, tr.bell); }
    // 低音
    if (I === 1) { if (s === 0) bassNote(t, b, stepDur * 7.5, false, 0.9); else if (s === 8) bassNote(t, b, stepDur * 7.5, false, 0.6); }
    else if (I === 2) { const m = { 0: b, 3: b, 6: b + 7, 8: b, 11: b, 14: b + 12 }; if (m[s] != null) bassNote(t, m[s], stepDur * 2, tr.saw, 0.85); }
    else bassNote(t, s % 8 === 7 ? b + 12 : b, stepDur * 0.9, true, s % 4 === 0 ? 1 : 0.7);
    // 打擊
    if (I === 1) { if (s === 0) kick(t, 0.3 * pv); else if (s === 8) kick(t, 0.17 * pv); }
    else if (I === 2) {
      if (s === 0 || s === 8 || (s === 10 && pv >= 0.9)) kick(t, 0.34 * pv);
      if ((s === 4 || s === 12) && pv > 0.5) snare(t, 0.7 * pv);
      if (s % 4 === 2) noiseHit(t, "highpass", 7500, 0.04, 0.06 * pv, 0);
    } else {
      if (s % 4 === 0 || s === 14) kick(t, 0.36);
      if (s === 4 || s === 12) snare(t, 1); else if (s === 15) snare(t, 0.35);
      noiseHit(t, "highpass", 7500, 0.035, s % 2 === 0 ? 0.08 : 0.04, 0);
    }
  }
  function setVol(v) { if (v === curVol) return; curVol = v; master.gain.setTargetAtTime(v, ctx.currentTime, 0.3); }
  function tick() {
    if (!ctx) return;
    const off = st.mute || st.musicOff || performance.now() - lastSync > 700;
    if (off) { setVol(0); nextT = Math.max(nextT, ctx.currentTime + 0.1); return; }
    setVol(VOL * st.musVol);
    lp.frequency.setTargetAtTime(muffleWant ? 520 : 18000, ctx.currentTime, 0.12);
    if (ctx.state === "suspended" && !document.hidden) ctx.resume();
    while (nextT < ctx.currentTime + 0.2) { sched(nextT); nextT += stepDur; step++; }
  }
  return {
    start() {
      try {
        if (!ctx) setup();
        if (ctx.state === "suspended") ctx.resume();
        started = true; lastSync = performance.now(); step = 0; barIdx = 0; zoneCur = -1; nextT = ctx.currentTime + 0.15; holdUntil = 0; curVol = -1;
        if (!timer) timer = setInterval(tick, 40);
      } catch (e) {}
    },
    stop() { started = false; if (timer) { clearInterval(timer); timer = 0; } try { if (ctx) { curVol = -1; master.gain.setTargetAtTime(0, ctx.currentTime, 0.4); } } catch (e) {} },
    sync(g) {
      if (!started) return;
      lastSync = performance.now();
      zoneWant = g.zone || 0;
      bossWant = g.enemies.some(e => e.boss && !e.dead);
      dangerWant = g.hp < g.maxHp * 0.3 || g.enemies.some(e => !e.dead && !e.boss && e.r >= g.pit - 2);
      muffleWant = !!g.upgrading;
      if (g.firing) holdUntil = performance.now() + 1800;
    },
    stinger(kind) {
      if (!started || !ctx || st.mute || st.musicOff) return;
      try {
        const t = ctx.currentTime + 0.02;
        if (kind === "boss") { [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => bell(t + i * 0.07, m, 1, "bell")); stab(t, [60, 64, 67, 72], 1.1); }
        else if (kind === "over") { [72, 68, 65, 60, 53].forEach((m, i) => bell(t + i * 0.28, m, 0.9, "bell")); }
      } catch (e) {}
    }
  };
})();
function enCenter(en) { const r = eRect(en); return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; }
function burst(g, x, y, col, n, sp) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s2 = (0.3 + Math.random()) * sp, t = 0.4 + Math.random() * 0.3; g.parts.push({ x, y, vx: Math.cos(a) * s2, vy: Math.sin(a) * s2, t, m: t, col, sz: 1.5 + Math.random() * 2.5, ln: Math.random() < 0.55 }); } }
function pop(g, x, y, txt, col, big) { g.pops.push({ x: x + Math.random() * 14 - 7, y, t: 0.8, m: 0.8, txt, col, big, vx: (Math.random() - 0.5) * 34 }); }
function stepFx(g, dt) {
  g.enemies.forEach(e => { if (e.flash > 0) e.flash -= dt; if (e.kick > 0) e.kick = Math.max(0, e.kick - dt * 7); if (e.intro > 0) e.intro = Math.max(0, e.intro - dt); if (e.hs == null) e.hs = e.max; if (e.hs > e.hp) e.hs = Math.max(e.hp, e.hs - Math.max(e.max * dt * 0.9, (e.hs - e.hp) * dt * 5)); if (e.hx || e.hy) { const dk = Math.exp(-dt * 16); e.hx *= dk; e.hy *= dk; if (Math.abs(e.hx) < 0.05) e.hx = 0; if (Math.abs(e.hy) < 0.05) e.hy = 0; } });
  g.rings.forEach(r => { r.t -= dt; }); g.rings = g.rings.filter(r => r.t > 0);
  if (!g.upgrading) { if (g.banner) { g.banner.t -= dt; if (g.banner.t <= 0) g.banner = null; } if (g.bossT > 0) g.bossT -= dt; }
  if (g.lvT > 0) g.lvT = Math.max(0, g.lvT - dt * 1.3);
  g.shots.forEach(s => { s.t -= dt; }); g.shots = g.shots.filter(s => s.t > 0);
  if (g.hurt > 0) g.hurt = Math.max(0, g.hurt - dt);
  g.hpShow += (g.hp - g.hpShow) * Math.min(1, dt * 4);
  if (g.zF < 1) g.zF = Math.min(1, g.zF + dt / 1.5);
  g.bolts.forEach(b => { b.t -= dt; }); g.bolts = g.bolts.filter(b => b.t > 0);
  g.parts.forEach(p => { p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 380 * dt; }); g.parts = g.parts.filter(p => p.t > 0);
  const pcap = PERF_LITE ? 160 : 400; if (g.parts.length > pcap) g.parts.splice(0, g.parts.length - pcap);
  g.pops.forEach(p => { p.t -= dt; p.y -= (22 + 70 * Math.max(0, p.t / p.m - 0.4)) * dt; p.x += (p.vx || 0) * dt; }); g.pops = g.pops.filter(p => p.t > 0);
  if (g.comboT > 0) g.comboT -= dt;
  g.zoom = (g.zoom || 0) * Math.exp(-dt * 9); g.cp = Math.max(0, (g.cp || 0) - dt * 5);  g.xpPulse = Math.max(0, (g.xpPulse || 0) - dt * 3); g.hsCd = (g.hsCd || 0) - dt;
  g.ghosts = (g.ghosts || []).filter(o => (o.t -= dt) > 0); g.stars = (g.stars || []).filter(o => (o.t -= dt) > 0);
  g.orbs = g.orbs || [];
  g.orbs.forEach(o => { o.age += dt; if (o.age < o.dl) return; const k = o.age - o.dl; if (k < 0.22) { o.x += o.vx * dt; o.y += o.vy * dt; o.vx *= 0.9; o.vy *= 0.9; } else { const dx = o.tx - o.x, dy = o.ty - o.y, d = Math.hypot(dx, dy) || 1, sp = 200 + 1400 * (k - 0.22), mv = Math.min(d, sp * dt); o.x += dx / d * mv; o.y += dy / d * mv; if (d < 9) { o.done = true; g.xpPulse = 1; } } });
  g.orbs = g.orbs.filter(o => !o.done);
  g.shake = Math.max(0, g.shake - dt * 40);
  g.balls.forEach(b => {
    b.tr.push({ x: b.x, y: b.y }); if (b.tr.length > 12) b.tr.shift();
    if (b.fx.splash > 0 && Math.random() < 0.6) g.parts.push({ x: b.x + (Math.random() - 0.5) * 4, y: b.y + (Math.random() - 0.5) * 4, vx: (Math.random() - 0.5) * 50 - b.vx * 0.08, vy: (Math.random() - 0.5) * 50 - b.vy * 0.08, t: 0.35, m: 0.35, col: Math.random() < 0.5 ? "#ffb35a" : "#ff7a2a", sz: 1.5 + Math.random() * 1.5 });
  });
}
function damage(g, en, d, crit) {
  if (en.dead) return;
  if (d < 9999) {
    if (en.ab !== "aegis" && g.enemies.some(o => !o.dead && o.ab === "aegis" && o !== en && Math.abs(o.c - en.c) <= 1 && Math.abs(o.r - en.r) <= 1)) d = Math.max(1, Math.ceil(d * 0.7));
    if (en.ab === "bcloud") { const n = Math.min(4, g.enemies.filter(o => !o.dead && !o.boss && Math.abs(o.c - en.c - 0.5) <= 2.5 && Math.abs(o.r - en.r) <= 1).length); if (n) d = Math.max(1, Math.ceil(d * (1 - 0.1 * n))); }
    const cap = en.ab === "icearmor" ? 0.25 : en.ab === "bice" ? 0.08 : 0;
    if (cap) d = Math.min(d, Math.max(1, Math.ceil(en.max * cap)));
  }
  if (en.sh > 0) {
    const ab = Math.min(en.sh, d), c0 = enCenter(en); en.sh -= ab; d -= ab; en.flash = 0.08; en.kick = 1;
    if (d <= 0) { pop(g, c0.x, c0.y - 8, "🛡" + fmtN(ab), "#8fd3ff", false); burst(g, c0.x, c0.y, "#8fd3ff", 3, 110); sfx(520, 0.05, "triangle", 0.03); return; }
    ring(g, c0.x, c0.y, 34, "#8fd3ff", 2, 0.3); pop(g, c0.x, c0.y - 20, dc("盾破", "Broken"), "#8fd3ff", true); sfx(680, 0.1, "triangle", 0.05);
  }
  en.hp -= d; en.flash = 0.1; en.kick = 1;
  const c = enCenter(en);
  pop(g, c.x, c.y - 8, d >= 9999 ? "☠" : crit ? fmtN(d) + "!" : fmtN(d), crit ? "#ffd36b" : "#fff", crit || d >= 6);
  burst(g, c.x, c.y, kcol(en), crit ? 10 : 4, 150);
  if (crit) ring(g, c.x, c.y, 24, "#ffd36b", 2, 0.3);
  if (crit) { g.shake = Math.max(g.shake, 5); g.hitstop = 0.04; }
  if (en.hp > 0) { bossPhase(g, en); if (en.boss && !en.enraged && en.hp <= en.max * 0.5) { en.enraged = true; en.atk = Math.round(en.atk * 1.4); g.shake = Math.max(g.shake, 14); ring(g, c.x, c.y, 120, "#ff4a3a", 4, 0.8); pop(g, c.x, c.y - 16, dc("狂暴！", "ENRAGED!"), "#ff6b5a", true); sfx(90, 0.5, "sawtooth", 0.09); } return; }
  if (en.ab === "bstar" && !en.reborn) {
    en.reborn = true; en.hp = Math.ceil(en.max * 0.4); en.sh = Math.ceil(en.max * 0.1); en.shMax = en.sh; en.enraged = true;
    ring(g, c.x, c.y, 180, "#ffe36b", 4, 0.9); burst(g, c.x, c.y, "#ffe36b", 40, 320); pop(g, c.x, c.y - 16, dc("星核重生！", "REBORN!"), "#ffe36b", true); g.shake = Math.max(g.shake, 16); g.flashW = 0.8; sfx(330, 0.5, "triangle", 0.09);
    return;
  }
  en.dead = true; g.kills++; deathHook(g, en);
  (g.ghosts = g.ghosts || []).push({ ...eRect(en), col: kcol(en), boss: !!en.boss, t: en.boss ? 0.6 : 0.3, m: en.boss ? 0.6 : 0.3 });
  g.orbs = g.orbs || [];
  for (let i = 0, no = en.boss ? 9 : en.elite ? 4 : 2; i < no && g.orbs.length < 60; i++) { const a = Math.random() * 6.283, sp3 = 120 + Math.random() * 160; g.orbs.push({ x: c.x, y: c.y, vx: Math.cos(a) * sp3, vy: Math.sin(a) * sp3, tx: W - 60, ty: CEIL / 2, age: 0, dl: i * 0.03, col: "#b98cf0" }); }
  if (!en.boss) stopHit(g, en.elite ? 0.05 : 0.022);
  g.zoom = Math.max(g.zoom || 0, en.boss ? 0.05 : en.elite ? 0.02 : 0.006);
  sfxNoise(en.boss ? 0.5 : en.elite ? 0.2 : 0.12, en.boss ? 0.22 : 0.14, en.boss ? 500 : 2400, true); tone(en.boss ? 90 : 140, en.boss ? 0.4 : 0.16, "sine", en.boss ? 0.3 : 0.22, 45);
  if (en.boss) { g.flashW = 1; g.slowT = 0.7; Music.stinger("boss"); }
  g.goldW += en.kind === "gold" ? 5 : en.boss ? 12 : en.elite ? 3 : 1;
  g.xp += (en.boss ? 6 : en.elite ? 2 : 1) * g.xpMul;
  const lv0 = g.level;
  while (g.xp >= needXp(g.level)) { g.xp -= needXp(g.level); g.level++; g.pending++; g.maxHp += HP_PER_LV; g.hp = Math.min(g.maxHp, g.hp + Math.round(g.maxHp * LV_HEAL)); }
  if (g.level > lv0) { g.lvT = 1; pop(g, W / 2 + 40, SHOOT_Y - 30, "HP+", "#6fcf8a", true); ring(g, W / 2, SHOOT_Y, 110, "#e8c468", 3, 0.7); sfx(880, 0.15, "sine", 0.05); }
  burst(g, c.x, c.y, kcol(en), en.boss ? 50 : 16, en.boss ? 320 : 220);
  ring(g, c.x, c.y, en.boss ? 130 : en.elite ? 48 : 30, kcol(en), en.boss ? 4 : 2, en.boss ? 0.7 : 0.45);
  if (en.boss) ring(g, c.x, c.y, 200, "#fff7d6", 2, 0.9);
  g.shake = Math.max(g.shake, en.boss ? 14 : en.elite ? 6 : 3);
  if (en.boss) { const bh = Math.round(g.maxHp * BOSS_HEAL); g.hp = Math.min(g.maxHp, g.hp + bh); pop(g, W / 2 + 40, SHOOT_Y - 30, "+" + fmtN(bh), "#6fcf8a", true); g.hitstop = 0.12; sfx(110, 0.5, "sawtooth", 0.09); try { navigator.vibrate && navigator.vibrate(40); } catch (e) {} }
  if (en.kind === "gold") { pop(g, c.x, c.y - 20, "💰", "#ffd36b", true); sfx(1100, 0.12, "sine", 0.06); }
  if (en.kind === "bomb") {
    const bd = 3 + Math.floor(g.floor / 2);
    burst(g, c.x, c.y, "#ff8a4a", 30, 300); ring(g, c.x, c.y, 76, "#ff8a4a", 3, 0.5); g.shake = Math.max(g.shake, 9); sfx(90, 0.25, "sawtooth", 0.08);
    g.enemies.forEach(o => { if (!o.dead && Math.abs(o.c - en.c) <= 1 && Math.abs(o.r - en.r) <= 1) damage(g, o, bd); });
  }
}
function thorn(g) {
  const d = Math.max(1, 1 + Math.floor(g.floor / 15));
  g.hp = Math.max(0, g.hp - d); g.hurt = Math.max(g.hurt || 0, 0.3);
  pop(g, W / 2, SHOOT_Y - 26, "-" + d + "↯", "#ff9ad5", false); sfx(160, 0.1, "square", 0.04);
}
function heal(g, n, c) { if (g.hp >= g.maxHp) return; g.hp = Math.min(g.maxHp, g.hp + n); pop(g, c.x, c.y - 18, "+" + n, "#6fcf8a", false); }
function onHit(g, b, en) {
  g.combo++; g.maxCombo = Math.max(g.maxCombo, g.combo); g.comboT = 1.2;
  const sp = b.sp || [], fx = b.fx, crit = Math.random() < g.crit + (sp.includes("crit") ? 0.3 : 0);
  let d = Math.max(1, Math.round((1 + g.dmgBonus + Math.floor(g.combo / (g.cmb || 15)) + (sp.includes("bounce") ? Math.floor(b.bn / 2) : 0)) * b.mult * g.dmgMul)); if (crit) d *= 2;
  if (sp.includes("prey")) d = Math.max(1, Math.round(d * (1 + 0.07 * en.r)));
  if (sp.includes("charge")) d = Math.max(1, Math.round(d * (1 + Math.min(1, (b.age || 0) / 4))));
  if (sp.includes("desperate")) d = Math.max(1, Math.round(d * (1 + 0.6 * (1 - Math.max(0, g.hp) / g.maxHp))));
  if (sp.includes("exploit") && (en.burn > 0 || en.pois > 0 || en.brittle || en.mark > 0)) d = Math.round(d * 1.5);
  if (en.mark > 0) d = Math.round(d * 1.4);
  if (en.ab === "barmor" && b.front) { d = Math.max(1, Math.round(d * BOSS_ARMOR)); if (Math.random() < 0.3) { const bc = enCenter(en); pop(g, bc.x, bc.y - 22, "🔰", "#9fd0ff", false); } }
  const exe = sp.includes("execute") && !en.boss && !(en.sh > 0) && en.hp <= en.max * 0.3; if (exe) d = Math.max(d, en.hp);
  if (en.brittle) { d *= 2; en.brittle = false; }
  hitSnd(g.combo, false);
  damage(g, en, d, crit || exe);
  { const sp0 = Math.hypot(b.vx, b.vy) || 1, nx = b.vx / sp0, ny = b.vy / sp0, rk = en.boss ? 0.35 : 1;
    en.hx = Math.max(-6, Math.min(6, (en.hx || 0) + nx * 4.5 * rk)); en.hy = Math.max(-6, Math.min(6, (en.hy || 0) + ny * 4.5 * rk));
    impact(g, b.x, b.y, -nx, -ny, RC[b.rarity] || "#ffffff", crit || exe);
    g.cp = 1;
    if (crit || exe) { g.zoom = Math.max(g.zoom || 0, 0.012); hitSnd(g.combo + 10, true); } }
  const ec0 = enCenter(en);
  if ((en.ab === "prism" && Math.random() < 0.3) || (en.ab === "bstar" && Math.random() < 0.2)) thorn(g);
  if (sp.includes("frost") && !en.dead) en.brittle = true;
  if (sp.includes("mark") && !en.dead) en.mark = 2;
  if (sp.includes("ice") && !en.dead && !en.boss && en.r >= 2 && !(en.frz > 0)) { en.frz = 1; pop(g, ec0.x, ec0.y - 18, "❄", "#bfeaff", false); }
  if (sp.includes("magnet") && !en.dead && Math.random() < 0.35) magnetPull(g, en);
  if (sp.includes("blast") && en.dead) { const bd = Math.max(1, Math.round(d * 0.6)); burst(g, ec0.x, ec0.y, "#ff9a60", 14, 240); ring(g, ec0.x, ec0.y, 64, "#ff9a60", 3, 0.4); sfx(110, 0.2, "sawtooth", 0.06); g.enemies.forEach(o => { if (!o.dead && o !== en && Math.abs(o.c - en.c) <= 1 && Math.abs(o.r - en.r) <= 1) damage(g, o, bd); }); }
  if (sp.includes("burn") && !en.dead) en.burn = 3;
  if ((sp.includes("poison") || g.venom) && !en.dead) en.pois = Math.min(5, (en.pois || 0) + 1);
  if (sp.includes("stun") && !en.dead && !en.boss && Math.random() < 0.25) { en.stun = true; pop(g, ec0.x, ec0.y - 18, "💫", "#ffe08a", false); }
  if (sp.includes("vamp") && Math.random() < 0.1) heal(g, 1 + Math.floor(g.floor / 10), ec0);
  if (sp.includes("mercy") && en.dead) heal(g, 3 + Math.floor(g.floor / 10), ec0);
  if (sp.includes("grow") && (b.gr || 0) < 15) { b.gr = (b.gr || 0) + 1; b.mult *= 1.08; }
  if (sp.includes("lance") && Math.random() < 0.15) { g.enemies.forEach(o => { if (!o.dead && o !== en && o.c < en.c + (en.span || 1) && o.c + (o.span || 1) > en.c) damage(g, o, d); }); g.bolts.push({ x1: ec0.x, y1: CEIL, x2: ec0.x, y2: H, t: 0.2 }); g.shake = Math.max(g.shake, 3); sfx(620, 0.1, "sawtooth", 0.04); }
  if (sp.includes("gold") && Math.random() < 0.2) { g.goldW += 1; pop(g, ec0.x, ec0.y - 18, "+💰", "#ffd36b", false); }
  if (sp.includes("knock") && !en.dead && en.r > 0 && !g.enemies.some(o => !o.dead && o !== en && o.r === en.r - 1 && o.c < en.c + (en.span || 1) && o.c + (o.span || 1) > en.c)) en.r--;
  if (sp.includes("split") && !b.clone && g.balls.length < 40 && Math.random() < 0.3) { g.balls.push({ ...b, vx: -b.vx, tr: [], thru: [], mult: b.mult * 0.5, clone: true, sp: sp.filter(k => k !== "split") }); burst(g, b.x, b.y, "#b98cf0", 6, 120); }
  if (sp.includes("beam") && Math.random() < 0.2) { g.enemies.forEach(o => { if (!o.dead && o !== en && o.r === en.r) damage(g, o, d); }); g.bolts.push({ x1: 0, y1: ec0.y, x2: W, y2: ec0.y, t: 0.2 }); g.shake = Math.max(g.shake, 4); sfx(500, 0.12, "sawtooth", 0.05); }
  if (sp.includes("starfall") && en.dead) shuffle(g.enemies.filter(o => !o.dead)).slice(0, 2).forEach(o => { const c2 = enCenter(o); g.bolts.push({ x1: c2.x + Math.random() * 60 - 30, y1: CEIL, x2: c2.x, y2: c2.y, t: 0.25 }); damage(g, o, Math.max(1, Math.round(d * 0.6))); });
  if (fx.splash > 0) {
    const reach = fx.splash >= 3 ? 2 : 1, sd = Math.max(1, Math.round(d * (fx.splash >= 2 ? 1 : 0.6))), ec = enCenter(en);
    burst(g, ec.x, ec.y, "#ffb35a", 10, 200); ring(g, ec.x, ec.y, 26 + reach * 22, "#ffb35a", 2, 0.35);
    g.enemies.forEach(o => { if (o !== en && !o.dead && Math.abs(o.c - en.c) <= reach && Math.abs(o.r - en.r) <= reach) damage(g, o, sd); });
  }
  if (fx.chain > 0) {
    const er = eRect(en), ex = er.x + er.w / 2, ey = er.y + er.h / 2, range = 150 + 25 * (fx.chain - 1), cd = Math.max(1, Math.round(d * (fx.chain >= 2 ? 1 : 0.7)));
    g.enemies.filter(o => o !== en && !o.dead).map(o => { const r = eRect(o); return { o, d: Math.hypot(r.x + r.w / 2 - ex, r.y + r.h / 2 - ey), x: r.x + r.w / 2, y: r.y + r.h / 2 }; })
      .filter(t => t.d <= range).sort((a, b2) => a.d - b2.d).slice(0, 2 * fx.chain).forEach(t => { damage(g, t.o, cd); g.bolts.push({ x1: ex, y1: ey, x2: t.x, y2: t.y, t: 0.15 }); sfx(900, 0.05, "sawtooth", 0.03); });
  }
}
function chillMul(g) {
  let n = 0; g.enemies.forEach(o => { if (!o.dead) { if (o.ab === "chill") n++; else if (o.ab === "bice") n++; } });
  return Math.max(0.6, 1 - 0.1 * n);
}
function spawnBall(g, def) {
  const fx = { ...def.fx }, sp = def.sp || [], sw = (sp.includes("swift") ? 1.25 : 1) * chillMul(g);
  if (g.pierceB) fx.pierce = Math.min(FX_CAP, (fx.pierce || 0) + g.pierceB);
  if (g.splashB) fx.splash = Math.min(FX_CAP, (fx.splash || 0) + g.splashB);
  if (g.chainB) fx.chain = Math.min(FX_CAP, (fx.chain || 0) + g.chainB);
  g.balls.push({ x: W / 2, y: SHOOT_Y, vx: Math.cos(g.fireAngle) * g.spd * sw, vy: -Math.sin(g.fireAngle) * g.spd * sw, rarity: def.rarity, fx, mult: def.mult || 1, tier: def.tier || 0, pierce: fx.pierce || 0, thru: [], tr: [], sp, bn: 0, rb: false, age: 0 });
}
const FF_START = 4, FF_MAX = 5, FF_RAMP = 0.8; // 自動快進設定：幾秒後開始、最高倍數、加速斜率
function stepBalls(g, h) {
  for (let i = g.balls.length - 1; i >= 0; i--) {
    const b = g.balls[i];
    b.x += b.vx * h; b.y += b.vy * h; b.age = (b.age || 0) + h;
    // 保險：一輪拖超過 8 秒還沒回來，所有彈珠開始受重力往下掉（避免任何形式的無限繞圈／來回彈）
    if (g.volleyT > 8) b.vy += 900 * h;
    // 追蹤珠：轉彎速度隨距離加大（越近轉越快，才不會繞著目標打轉打不到），而且每顆珠子最多只追 2.5 秒
    if (b.sp.includes("homing") && !(b.hmT > 2.5) && g.volleyT < 8) {
      let best = null, bd = 1e9;
      for (const o of g.enemies) { if (o.dead) continue; const c2 = enCenter(o), dd = Math.hypot(c2.x - b.x, c2.y - b.y); if (dd < bd) { bd = dd; best = c2; } }
      if (best && bd < 170) { b.hmT = (b.hmT || 0) + h; const s0 = Math.hypot(b.vx, b.vy), a0 = Math.atan2(b.vy, b.vx); let da = Math.atan2(best.y - b.y, best.x - b.x) - a0; while (da > Math.PI) da -= 6.283; while (da < -Math.PI) da += 6.283; const turn = Math.max(4, Math.min(14, 2.2 * s0 / Math.max(bd, 30))), na = a0 + Math.max(-turn * h, Math.min(turn * h, da)); b.vx = Math.cos(na) * s0; b.vy = Math.sin(na) * s0; }
    }
    if (b.x < BALL_R) { b.x = BALL_R; b.vx = Math.abs(b.vx); wallFx(g, b); b.bn++; } else if (b.x > W - BALL_R) { b.x = W - BALL_R; b.vx = -Math.abs(b.vx); wallFx(g, b); b.bn++; }
    if (b.y < CEIL + BALL_R) { b.y = CEIL + BALL_R; b.vy = Math.abs(b.vy); wallFx(g, b); b.bn++; }
    if (b.y > H - 10) { if (b.sp.includes("return") && !b.rb) { b.rb = true; b.y = H - 11; b.vy = -Math.abs(b.vy); burst(g, b.x, H - 12, "#e8c468", 8, 120); sfx(700, 0.08, "sine", 0.05); continue; } g.balls.splice(i, 1); continue; }
    if (b.thru.length) b.thru = b.thru.filter(t => !t.dead && circleRect(b, t));
    for (const en of g.enemies) {
      if (en.dead || b.thru.includes(en)) continue;
      const r = circleRect(b, en);
      if (!r) continue;
      b.front = !r.inside && Math.abs(r.dy) >= Math.abs(r.dx) && r.dy > 0;
      onHit(g, b, en);
      if (b.pierce > 0) { b.pierce--; b.thru.push(en); continue; }
      if (r.inside) b.vy = -b.vy;
      else if (Math.abs(r.dx) > Math.abs(r.dy)) { const s = r.dx > 0 ? 1 : -1; b.vx = Math.abs(b.vx) * s; b.x += s * (BALL_R - Math.abs(r.dx) + 0.5); }
      else { const s = r.dy > 0 ? 1 : -1; b.vy = Math.abs(b.vy) * s; b.y += s * (BALL_R - Math.abs(r.dy) + 0.5); }
      const sp = Math.hypot(b.vx, b.vy), mv = sp * 0.18;
      if (Math.abs(b.vy) < mv) { b.vy = (b.vy < 0 ? -1 : 1) * mv; b.vx = (b.vx < 0 ? -1 : 1) * Math.sqrt(Math.max(0, sp * sp - mv * mv)); }
      break;
    }
  }
}
// 清場：怪全死了就先放一小段特效（約 0.5 秒）再進下一層，避免切換太突然
function startClear(g) {
  if (g.clearing) return;
  g.clearing = true; g.clearT = 0.5; g.ff = 1; g.balls.length = 0; g.queue.length = 0;
  const cx = W / 2, cy = H / 2 - 30;
  ring(g, cx, cy, 40, "#ffd36b", 4, 0.6); ring(g, cx, cy, 120, "#fff7d6", 2, 0.8); ring(g, cx, cy, 200, "#b98cf0", 2, 0.9);
  burst(g, cx, cy, "#ffd36b", 36, 300);
  pop(g, cx, cy - 10, dc("✨ 清場！", "✨ Cleared!"), "#ffd36b", true);
  g.zoom = Math.max(g.zoom || 0, 0.03); g.flashW = Math.max(g.flashW || 0, 0.35);
  sfx(880, 0.18, "sine", 0.06); setTimeout(() => sfx(1320, 0.22, "sine", 0.05), 110);
}
function endVolley(g) {
  g.volleyT = 0; g.ff = 1;
  g.enemies.forEach(e => { if (!e.dead && e.burn > 0) { e.burn--; damage(g, e, 2 + Math.floor(g.floor / 8)); } });
  g.enemies.forEach(e => { if (!e.dead && e.pois > 0) { damage(g, e, e.pois); e.pois--; } });
  g.enemies.forEach(e => { if (e.mark > 0) e.mark--; });
  if (g.regen > 0 && g.hp > 0) g.hp = Math.min(g.maxHp, g.hp + g.regen);
  g.enemies = g.enemies.filter(e => !e.dead);
  if (g.skip > 0) g.skip--;
  else { abilityTick(g); g.floor++; const stp = g.floor >= 25 && g.floor % 5 === 0 ? 2 : 1; advance(g, stp); spawnRow(g, 0); if (stp === 2) spawnRow(g, 1); announceFloor(g); enemiesAttack(g); }
  if (g.hp <= 0) { if (g.revives > 0) { g.revives--; g.hp = Math.round(g.maxHp * 0.5); g.shake = 18; sfx(520, 0.3, "sine", 0.08); ac(dc("💫 復活！回復一半血量", "💫 Revived! Half HP restored")); } else return finish(false); }
  if (g.enemies.some(e => e.r >= g.pit)) { if (g.revives > 0) { g.revives--; g.enemies.filter(e => e.r >= g.pit - 3).forEach(e => { e.dead = true; }); g.enemies = g.enemies.filter(e => !e.dead); g.shake = 18; sfx(520, 0.3, "sine", 0.08); ac(dc("💫 復活！清除最底 4 排", "💫 Revived! Bottom 4 rows cleared")); } else return finish(false); }
  if (g.floor > MAX_FLOOR) return finish(true);
  if (g.pending > 0) showUpgrade();
}
function update(dt) {
  const g = st.g;
  if (!g || g.over || g.paused) return;
  if (g.slowT > 0) { g.slowT -= dt; dt *= 0.3; }
  stepFx(g, dt);
  if (g.upgrading) return;
  if (g.hitstop > 0) { g.hitstop -= dt; return; }
  if (g.firing) {
    if (g.clearing) { g.clearT -= dt; if (g.clearT <= 0) { g.clearing = false; g.firing = false; endVolley(g); } return; }
    g.fireT -= dt;
    while (g.queue.length && g.fireT <= 0) { spawnBall(g, g.queue.shift()); g.fireT += FIRE_GAP; }
    if (g.balls.length || g.queue.length) {
      g.volleyT += dt;
      // 自動快進：發射完畢且這一輪拖太久（> FF_START 秒）就逐漸加速，最高 FF_MAX 倍；物理仍以固定小步長推進，不會穿牆
      g.ff = !g.queue.length && g.volleyT > FF_START ? Math.min(FF_MAX, 1 + (g.volleyT - FF_START) * FF_RAMP) : 1;
      const bdt = dt * g.ff, sub = Math.max(1, Math.ceil(bdt * g.spd / 7)), h = bdt / sub;
      for (let s = 0; s < sub; s++) stepBalls(g, h);
      // 場上的怪全清了：不用等剩下的彈珠飛完，先放清場特效再進下一層
      if (!g.clearing && !g.enemies.some(e => !e.dead)) startClear(g);
      if (g.volleyT > 30) { g.balls.length = 0; g.queue.length = 0; }
    }
    if (!g.balls.length && !g.queue.length && !g.clearing) { g.firing = false; endVolley(g); }
  }
}

/* ===== 升級三選一 ===== */
function fuseDefs(a, b) {
  const fx = {};
  for (const k of ["pierce", "splash", "chain"]) fx[k] = a.fx[k] > 0 && b.fx[k] > 0 ? Math.min(FX_CAP, Math.max(a.fx[k], b.fx[k]) + 1) : Math.max(a.fx[k], b.fx[k]);
  const keys = Object.keys(fx).filter(k => fx[k] > 0), mult = (a.mult || 1) + (b.mult || 1) + FUSE_MULT_BONUS, tier = Math.max(a.tier || 0, b.tier || 0) + 1;
  const top = Math.max(0, ...keys.map(k => fx[k])), roman = top >= 3 ? " III" : top === 2 ? " II" : "";
  let nm;
  if (!keys.length) nm = ["強化珠", "Empowered"];
  else if (keys.length === 1) nm = FX_NAMES[keys[0]][fx[keys[0]] - 1];
  else nm = COMBO_NAMES[keys.join("+")] || ["融合珠", "Fused"];
  const rarity = (RK[a.rarity] || 0) >= (RK[b.rarity] || 0) ? a.rarity : b.rarity;
  return { id: null, rarity, name: dc(nm[0], nm[1]) + (keys.length > 1 ? roman : ""), icon: "🔗", fx, mult, tier, sp: [...new Set([...(a.sp || []), ...(b.sp || [])])].slice(0, 3) };
}
function fxText(d) {
  const parts = ["pierce", "splash", "chain"].filter(k => d.fx[k] > 0).map(k => `${dc(FX_ZH[k], FX_EN[k])}${d.fx[k]}`).concat((d.sp || []).map(k => "✧" + dc(SP[k][0], SP[k][1])));
  return `${parts.join(" · ") || dc("無特效", "No effect")} · ${dc("傷害", "Dmg")}×${(Math.round(d.mult * 100) / 100)}`;
}
function loadoutHtml() {
  const g = st.g;
  if (!g) return "";
  return g.loadout.map(d => `<span class="bp-chip" style="border-color:${RC[d.rarity] || RC.common};" title="${fxText(d)}">${d.icon || "🃏"} ${d.name}${d.tier ? " ✦" + d.tier : ""}</span>`).join("");
}
function updateLoadoutBar() { const el = document.getElementById("bp-loadout"); if (el) el.innerHTML = loadoutHtml(); }
function pickAffix(a) {
  const g = st.g;
  if (!g) return;
  if (a) { a.ap(g); g.affix = a.id; ac(dc(`🎲 本局詞綴：${a.ic} ${a.zh} — ${a.dz}`, `🎲 Run affix: ${a.ic} ${a.en} — ${a.de}`)); }
  g.upgrading = false;
  if (st.ov) { st.ov.style.display = "none"; st.ov.innerHTML = ""; }
  updateLoadoutBar();
}
function showAffixPicker() {
  const g = st.g;
  if (!AFFIX_ON || !g || !st.ov) return;
  const pool = shuffle(AFFIXES.filter(a => !a.ok || a.ok(g)), seedRng(g, "affix")).slice(0, 3);
  if (!pool.length) return;
  g.upgrading = true;
  st.ov.style.display = "flex";
  st.ov.innerHTML = `<div style="text-align:center;font-weight:700;color:var(--gold-bright);margin-bottom:4px;">🎲 ${dc("選擇本局詞綴", "Choose a run affix")}</div>` +
    pool.map((a, i) => `<button class="btn" data-bp-aff="${i}" style="text-align:left;flex:0 0 auto;height:auto;min-height:0;white-space:normal;line-height:1.4;"><b>${a.ic} ${dc(a.zh, a.en)}</b><br><span style="font-size:12px;opacity:.8;">${dc(a.dz, a.de)}</span></button>`).join("") +
    `<button class="btn small secondary" id="bp-aff-none">${dc("不選詞綴（標準規則）", "No affix (standard rules)")}</button>`;
  st.ov.querySelectorAll("[data-bp-aff]").forEach(btn => { btn.onclick = () => pickAffix(pool[+btn.dataset.bpAff]); });
  st.ov.querySelector("#bp-aff-none").onclick = () => pickAffix(null);
}
function closeUpgrade() { const g = st.g; g.upgrading = false; if (st.ov) { st.ov.style.display = "none"; st.ov.innerHTML = ""; } updateLoadoutBar(); }
function showFusePicker(pool) {
  const g = st.g;
  if (!g || !st.ov) return;
  const sel = [];
  const render = () => {
    const ready = sel.length === 2, prev = ready ? fuseDefs(g.loadout[sel[0]], g.loadout[sel[1]]) : null;
    st.ov.innerHTML = `<div style="text-align:center;font-weight:700;color:var(--gold-bright);">🔗 ${dc("選兩顆彈珠融合", "Pick two balls to fuse")}</div>` +
      `<div style="display:flex;flex-direction:column;gap:6px;max-height:210px;overflow:auto;">` +
      g.loadout.map((d, i) => `<button class="btn small" data-bp-fuse="${i}" style="text-align:left;flex:0 0 auto;height:auto;min-height:0;white-space:normal;line-height:1.4;padding-bottom:8px;${sel.includes(i) ? "outline:2px solid var(--gold-bright);" : ""}border-color:${RC[d.rarity] || RC.common};"><b>${d.icon || "🃏"} ${d.name}${d.tier ? " ✦" + d.tier : ""}</b><br><span style="font-size:11px;opacity:.8;">${fxText(d)}</span></button>`).join("") + `</div>` +
      `<div style="font-size:12px;text-align:center;min-height:34px;">${prev ? `→ <b style="color:var(--gold-bright);">${prev.name}</b><br>${fxText(prev)}` : `<span style="opacity:.7;">${dc("同效果會進化（等級 +1），不同效果會合併", "Matching effects evolve (+1 level); different effects combine")}</span>`}</div>` +
      `<div style="display:flex;gap:8px;"><button class="btn small secondary" id="bp-fuse-back" style="flex:1;">${dc("返回", "Back")}</button><button class="btn small" id="bp-fuse-ok" style="flex:2;" ${ready ? "" : "disabled"}>${dc("確認融合", "Fuse")}</button></div>`;
    st.ov.querySelectorAll("[data-bp-fuse]").forEach(btn => {
      btn.onclick = () => {
        const i = +btn.dataset.bpFuse, at = sel.indexOf(i);
        if (at >= 0) sel.splice(at, 1); else { if (sel.length >= 2) sel.shift(); sel.push(i); }
        render();
      };
    });
    const back = st.ov.querySelector("#bp-fuse-back"); if (back) back.onclick = () => renderUpgradeChoices(pool);
    const ok = st.ov.querySelector("#bp-fuse-ok");
    if (ok) ok.onclick = () => {
      if (sel.length !== 2) return;
      const a = g.loadout[sel[0]], b = g.loadout[sel[1]], fused = fuseDefs(a, b);
      g.loadout = g.loadout.filter((_, i) => !sel.includes(i)); g.loadout.push(fused);
      g.pending--;
      ac(dc(`🔗 融合成「${fused.name}」`, `🔗 Fused into "${fused.name}"`));
      if (g.pending > 0) showUpgrade(); else closeUpgrade();
    };
  };
  render();
}
function renderUpgradeChoices(pool) {
  const g = st.g;
  st.ov.style.display = "flex";
  st.ov.innerHTML = `<div style="text-align:center;font-weight:700;color:var(--gold-bright);margin-bottom:4px;">⬆ Lv ${g.level} — ${dc("選一個強化", "Pick an upgrade")}</div>` +
    pool.map((u, i) => `<button class="btn" data-bp-upg="${i}" style="text-align:left;"><b>${dc(u.zh, u.en)}</b><br><span style="font-size:12px;opacity:.8;">${dc(u.dz, u.de)}</span></button>`).join("");
  if (g.rerolls > 0) { st.ov.insertAdjacentHTML("beforeend", `<button class="btn small secondary" id="bp-reroll">🎲 ${dc("重抽選項", "Reroll")} (${g.rerolls})</button>`); st.ov.querySelector("#bp-reroll").onclick = () => { g.rerolls--; showUpgrade(); }; }
  st.ov.querySelectorAll("[data-bp-upg]").forEach(btn => {
    btn.onclick = () => {
      const u = pool[+btn.dataset.bpUpg];
      if (u.pick) return void showFusePicker(pool);
      u.ap(g); g.pending--;
      if (g.pending > 0) showUpgrade(); else closeUpgrade();
    };
  });
}
function showUpgrade() {
  const g = st.g;
  if (!g || !st.ov) return;
  g.upgrading = true;
  const avail = UPGRADES.filter(u => upOpen(u, zl.player) && (!u.ok || u.ok(g))), fuse = avail.find(u => u.id === "fuse");
  g.upN = (g.upN || 0) + 1; const UR = seedRng(g, "u" + g.upN);
  let pool = shuffle(avail.filter(u => u !== fuse), UR).slice(0, 3);
  if (fuse && (g.level % 2 === 0 || UR() < 0.35)) pool = [fuse].concat(pool.slice(0, 2));
  else if (fuse && pool.length < 3) pool.push(fuse);
  const heal = avail.find(u => u.id === "heal"), k = pool.findIndex(u => u !== fuse);
  if (heal && g.hp < g.maxHp * 0.4 && !pool.includes(heal) && k >= 0) pool[k] = heal;
  renderUpgradeChoices(shuffle(pool, UR));
}

/* ===== 結束與結算 ===== */
function liveHost() {
  const sv = document.getElementById("bm-subview");
  return sv && sv.isConnected && zl.tab === "ballpit" ? sv : null;
}
async function finish(win) {
  const g = st.g;
  if (!g || g.over) return;
  g.over = true;
  stopLoop(); Music.stop(); if (!win) Music.stinger("over");
  const floorsCleared = Math.max(0, g.floor - 1);
  const raw = { gold: Math.round(g.goldW * GOLD_PER_KILL * g.goldMul) + floorsCleared * GOLD_PER_FLOOR + (win ? WIN_BONUS : 0), elapsedSeconds: Math.max(1, Math.round((Date.now() - g.startedAt) / 1000)), floor: Math.min(g.floor, MAX_FLOOR + 1), hpPct: Math.max(0, Math.min(100, Math.round(100 * (g.hp || 0) / (g.maxHp || 1)))) };
  const summary = { floor: Math.min(g.floor, MAX_FLOOR), kills: g.kills, win, combo: g.maxCombo, slain: !win && g.hp <= 0 };
  st.running = false; st.settling = true; st.canvas = null; st.wrap = null; st.ov = null;
  const h0 = liveHost(); if (h0) renderTab(h0);
  let res = null;
  const s0 = stageOf(zl.player);
  try { res = await claimReward(raw); } catch (e) { res = null; }
  st.settling = false;
  if (res && res.ok !== false && stageOf(zl.player) > s0) { const s1 = stageOf(zl.player); setTimeout(() => ac(dc(`🔓 進入第 ${s1 + 1} 階段「${STAGE_ZH[s1]}」！${STAGE_GAIN[s1][0]}`, `🔓 Stage ${s1 + 1} "${STAGE_EN[s1]}" unlocked! ${STAGE_GAIN[s1][1]}`)), 2800); }
  st.lastResult = res ? { ...res, ...summary } : { ok: false, reason: "error", ...summary };
  if (res && res.ok !== false && (res.bossFirst || []).length) res.bossFirst.forEach((b, i) => setTimeout(() => ac(dc(`👑 首殺第 ${b.k} 隻 BOSS！+${b.coins} 彈珠幣、+${b.mats} 材料、${b.msg}`, `👑 First kill of boss #${b.k}! +${b.coins} coins, +${b.mats} mats, ${b.msg}`)), 1200 + i * 900));
  if (res && res.ok !== false) {
    const nOut = Object.values(res.outBag || {}).reduce((x, y) => x + y, 0);
    ac(dc(`🎱 結算：+${(res.gold + res.milestone).toLocaleString()} 彈珠幣，+${res.mats} 材料${res.outCoins ? `；正式版 +${res.outCoins} 金幣${nOut ? `、${nOut} 件成品` : ""}` : ""}`, `🎱 Settled: +${(res.gold + res.milestone).toLocaleString()} pit coins, +${res.mats} mats${res.outCoins ? `; main game +${res.outCoins} coins${nOut ? `, ${nOut} item(s)` : ""}` : ""}`));
  } else if (res && (res.reason === "expired" || res.reason === "norun" || res.reason === "toofast")) ac(dc("這局無法結算（超時或紀錄遺失），沒有獎勵", "This run could not be settled (timed out or record lost), no reward"));
  else ac(dc("塔羅彈珠結算失敗，請稍後再試", "Ball Pit settlement failed, please try again"));
  const h1 = liveHost(); if (h1) renderTab(h1);
}

/* ===== 繪圖 ===== */
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function enemyPal(en) { return en.elite ? EC.elite : en.kind === "n" ? ZONES[(en.z || 0) % ZONES.length].pal : EC[en.kind] || EC.n; }
function silPath(c, look, cx, cy, s, T) {
  c.beginPath();
  if (look === 0) {
    const w = Math.sin(T * 4 + cx) * 1.3 * s;
    c.moveTo(cx - 9 * s, cy + 9 * s); c.lineTo(cx - 9 * s, cy - s); c.arc(cx, cy - s, 9 * s, Math.PI, 0); c.lineTo(cx + 9 * s, cy + 9 * s);
    c.lineTo(cx + 6 * s, cy + 5.5 * s + w); c.lineTo(cx + 3 * s, cy + 9 * s); c.lineTo(cx, cy + 5.5 * s - w); c.lineTo(cx - 3 * s, cy + 9 * s); c.lineTo(cx - 6 * s, cy + 5.5 * s + w); c.closePath();
  } else if (look === 1) {
    c.arc(cx, cy - 2 * s, 8.5 * s, 0, 6.283); c.rect(cx - 5 * s, cy + 4 * s, 10 * s, 6 * s);
  } else if (look === 2) {
    c.arc(cx, cy + s, 8 * s, 0, 6.283);
    c.moveTo(cx - 7 * s, cy - 3 * s); c.lineTo(cx - 10.5 * s, cy - 11 * s); c.lineTo(cx - 2.5 * s, cy - 6 * s); c.closePath();
    c.moveTo(cx + 7 * s, cy - 3 * s); c.lineTo(cx + 10.5 * s, cy - 11 * s); c.lineTo(cx + 2.5 * s, cy - 6 * s); c.closePath();
  } else if (look === 3) {
    const w = Math.sin(T * 5 + cx) * 1.5 * s;
    c.moveTo(cx - 9 * s, cy + 2 * s); c.arc(cx, cy + 2 * s, 9 * s, Math.PI, 0);
    c.quadraticCurveTo(cx + 9 * s, cy + 9 * s, cx + 6 * s + w, cy + 11 * s); c.quadraticCurveTo(cx + 3 * s, cy + 5 * s, cx, cy + 11 * s - w);
    c.quadraticCurveTo(cx - 3 * s, cy + 5 * s, cx - 6 * s - w, cy + 11 * s); c.quadraticCurveTo(cx - 9 * s, cy + 9 * s, cx - 9 * s, cy + 2 * s); c.closePath();
  } else {
    const f = Math.sin(T * 9 + cx) * 2 * s;
    c.ellipse(cx, cy + s, 4.5 * s, 7 * s, 0, 0, 6.283);
    [-1, 1].forEach(m => { c.moveTo(cx + m * 3 * s, cy - 2 * s); c.lineTo(cx + m * 13 * s, cy - 8 * s + f); c.lineTo(cx + m * 10 * s, cy - s); c.lineTo(cx + m * 12 * s, cy + 4 * s + f * 0.5); c.lineTo(cx + m * 3 * s, cy + 3 * s); c.closePath(); });
  }
}
const SIL_EYES = [[[-3.5, -2.5], [3.5, -2.5], 1.8], [[-3.5, -2.5], [3.5, -2.5], 2], [[-3.5, 0], [3.5, 0], 1.7], [[0, 2], null, 2.6], [[-1.8, -1], [1.8, -1], 1.3]];
function drawEye(c, x, y, r, col) { c.globalAlpha = 0.3; c.fillStyle = col; c.beginPath(); c.arc(x, y, r * 2.2, 0, 6.283); c.fill(); c.globalAlpha = 1; c.fillStyle = "#fffbe8"; c.beginPath(); c.arc(x, y, r, 0, 6.283); c.fill(); }
function monFx(c, en, ax, ay, s, T, acc, hit) {
  if (hit) return;
  const z = (en.z || 0) % ZONES.length;
  c.save(); c.strokeStyle = acc; c.fillStyle = acc; c.lineWidth = 1;
  if (z === 0) { c.globalAlpha = 0.6; c.beginPath(); c.arc(ax + 7 * s, ay - 9 * s, 3.4 * s, 1.2, 5.1); c.stroke(); c.globalAlpha = 0.22; c.beginPath(); c.arc(ax, ay, 13 * s, 0, 6.283); c.stroke(); }
  else if (z === 1) { for (let i = 0; i < 3; i++) { const p = (T * 1.4 + i / 3) % 1; c.globalAlpha = 1 - p; c.beginPath(); c.arc(ax + (i - 1) * 5 * s + Math.sin(T * 3 + i) * 2, ay - 6 * s - p * 12 * s, 1.1 * s, 0, 6.283); c.fill(); } c.globalAlpha = 0.75; c.beginPath(); c.moveTo(ax - 4 * s, ay + s); c.lineTo(ax - s, ay + 4 * s); c.lineTo(ax - 3 * s, ay + 7 * s); c.moveTo(ax + 4 * s, ay); c.lineTo(ax + 2 * s, ay + 3 * s); c.stroke(); }
  else if (z === 2) { for (let i = 0; i < 3; i++) { const p = (T * 0.8 + i / 3) % 1; c.globalAlpha = 0.7 * (1 - p); c.beginPath(); c.arc(ax + (i - 1) * 6 * s, ay + 8 * s - p * 20 * s, 1.3 * s, 0, 6.283); c.stroke(); } c.globalAlpha = 0.5; const w = Math.sin(T * 4) * 2; c.beginPath(); c.moveTo(ax - 9 * s, ay); c.lineTo(ax - 14 * s, ay - 4 * s + w); c.lineTo(ax - 10 * s, ay + 4 * s); c.moveTo(ax + 9 * s, ay); c.lineTo(ax + 14 * s, ay - 4 * s - w); c.lineTo(ax + 10 * s, ay + 4 * s); c.stroke(); }
  else if (z === 3) { for (let i = 0; i < 3; i++) { const a = T * 1.5 + i * 2.094; c.globalAlpha = 0.85; c.save(); c.translate(ax + Math.cos(a) * 13 * s, ay + Math.sin(a) * 8 * s); c.rotate(a * 2); c.fillRect(-1.6 * s, -1.6 * s, 3.2 * s, 3.2 * s); c.restore(); } c.globalAlpha = 0.9; c.beginPath(); c.arc(ax, ay - 6 * s, 1.2 * s, 0, 6.283); c.fill(); }
  else if (z === 4) { c.globalAlpha = 0.55; for (let i = 0; i < 3; i++) { const p = (T * 0.5 + i / 3) % 1; c.beginPath(); c.arc(ax - 12 * s + p * 24 * s, ay + 9 * s + Math.sin(T * 2 + i) * 1.5, (2 + i) * 0.9 * s, 0, 6.283); c.fill(); } c.globalAlpha = 0.9; c.beginPath(); c.moveTo(ax + 2 * s, ay - 12 * s); c.lineTo(ax - s, ay - 7 * s); c.lineTo(ax + s, ay - 7 * s); c.lineTo(ax - 2 * s, ay - 2 * s); c.stroke(); }
  else if (z === 5) { for (let i = 0; i < 4; i++) { const p = (T * 0.7 + i / 4) % 1; c.globalAlpha = 0.8 * (1 - p); c.fillRect(ax - 11 * s + i * 7 * s + Math.sin(T * 2 + i) * 2, ay - 12 * s + p * 24 * s, 1.5 * s, 1.5 * s); } c.globalAlpha = 0.7; c.beginPath(); c.moveTo(ax - 8 * s, ay + 8 * s); c.lineTo(ax - 5 * s, ay + 4 * s); c.lineTo(ax - 2 * s, ay + 8 * s); c.moveTo(ax + 3 * s, ay + 8 * s); c.lineTo(ax + 6 * s, ay + 3 * s); c.lineTo(ax + 9 * s, ay + 8 * s); c.stroke(); }
  else { for (let i = 0; i < 4; i++) { const a = T * 0.9 + i * 1.571, rx = Math.cos(a) * 14 * s, ry = Math.sin(a) * 9 * s; c.globalAlpha = 0.5 + 0.5 * Math.sin(T * 4 + i); c.beginPath(); c.moveTo(ax + rx - 2 * s, ay + ry); c.lineTo(ax + rx + 2 * s, ay + ry); c.moveTo(ax + rx, ay + ry - 2 * s); c.lineTo(ax + rx, ay + ry + 2 * s); c.stroke(); } }
  if (en.elite) { c.globalAlpha = 1; c.fillStyle = "#e8c468"; c.beginPath(); c.moveTo(ax - 6 * s, ay - 9 * s); c.lineTo(ax - 5 * s, ay - 14 * s); c.lineTo(ax - 2 * s, ay - 10 * s); c.lineTo(ax, ay - 15 * s); c.lineTo(ax + 2 * s, ay - 10 * s); c.lineTo(ax + 5 * s, ay - 14 * s); c.lineTo(ax + 6 * s, ay - 9 * s); c.closePath(); c.fill(); }
  c.restore();
}
function drawBoss(c, en, ax, ay, T, hit) {
  const z = (en.z || 0) % ZONES.length, Z = ZONES[z], P = Z.pal, A = Z.acc, ra = !!en.enraged, AC = ra ? "#ff5a4a" : A;
  const fl = (p, q) => { if (hit) return "#fff"; const g = c.createLinearGradient(0, -14, 0, 14); g.addColorStop(0, p); g.addColorStop(1, q); return g; };
  const eye = (x, y, r, col) => drawEye(c, x, y, r, hit ? "#fff" : (ra ? "#ff4a3a" : col));
  c.save(); c.translate(ax + 8, ay + 1);
  const au = c.createRadialGradient(0, 0, 4, 0, 0, 34); au.addColorStop(0, AC + "88"); au.addColorStop(1, AC + "00"); c.fillStyle = au; c.beginPath(); c.arc(0, 0, 34, 0, 6.283); c.fill();
  c.save(); c.rotate(T * (ra ? 1.2 : 0.5)); c.setLineDash([2, 5]); c.globalAlpha = 0.8; c.strokeStyle = "#e8c468"; c.lineWidth = 1; c.beginPath(); c.arc(0, 0, 22, 0, 6.283); c.stroke(); c.restore();
  c.scale(1.45, 1.45); c.translate(0, Math.sin(T * 2.2) * 1.2); c.lineWidth = 1.1; c.strokeStyle = AC; c.fillStyle = fl(P[0], P[1]);
  if (z === 0) {
    c.beginPath(); c.moveTo(-11, 11); c.quadraticCurveTo(-12, -4, -4, -9); c.quadraticCurveTo(0, -12, 4, -9); c.quadraticCurveTo(12, -4, 11, 11); c.quadraticCurveTo(5, 8, 0, 11); c.quadraticCurveTo(-5, 8, -11, 11); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = hit ? "#fff" : "#07030f"; c.beginPath(); c.ellipse(0, -3, 4.5, 5.5, 0, 0, 6.283); c.fill();
    c.strokeStyle = "#e8c468"; c.lineWidth = 1.6; c.beginPath(); c.arc(0, -10, 6, 3.46, 5.96); c.stroke(); c.beginPath(); c.arc(0, -12, 2.2, 0, 6.283); c.stroke();
    eye(-2, -3, 1.2, A); eye(2, -3, 1.2, A);
    for (let i = 0; i < 3; i++) { const a = T * 1.2 + i * 2.094; c.fillStyle = hit ? "#fff" : A; c.beginPath(); c.arc(Math.cos(a) * 15, Math.sin(a) * 6 + 2, 1.6, 0, 6.283); c.fill(); }
  } else if (z === 1) {
    c.fillStyle = hit ? "#fff" : P[2]; [-1, 1].forEach(m => { c.beginPath(); c.moveTo(m * 5, -6); c.quadraticCurveTo(m * 15, -7, m * 13, -17); c.quadraticCurveTo(m * 9, -10, m * 3, -9); c.closePath(); c.fill(); });
    c.fillStyle = fl(P[0], P[1]); c.beginPath(); c.ellipse(0, 2, 11, 10, 0, 0, 6.283); c.fill(); c.stroke();
    for (let i = -2; i <= 2; i++) { c.fillStyle = hit ? "#fff" : (i % 2 ? "#ffd36b" : "#ff7a3a"); const h = 6 + Math.sin(T * 8 + i) * 2; c.beginPath(); c.moveTo(i * 4 - 2, -6); c.quadraticCurveTo(i * 4, -6 - h, i * 4 + 2, -6); c.fill(); }
    c.strokeStyle = "#ffb35a"; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-3, 4); c.lineTo(0, 7); c.lineTo(-1, 10); c.moveTo(3, 3); c.lineTo(1, 7); c.stroke();
    eye(-4, 0, 1.8, "#ffd36b"); eye(4, 0, 1.8, "#ffd36b");
  } else if (z === 2) {
    c.lineCap = "round"; c.lineWidth = 2.4; c.strokeStyle = hit ? "#fff" : P[2];
    for (let i = 0; i < 5; i++) { const x = -8 + i * 4; c.beginPath(); c.moveTo(x, 4); c.quadraticCurveTo(x + Math.sin(T * 3 + i) * 5, 10, x + Math.sin(T * 3 + i + 1) * 4, 16); c.stroke(); }
    c.lineWidth = 1.1; c.strokeStyle = AC; c.fillStyle = fl(P[0], P[1]); c.beginPath(); c.arc(0, 0, 11, Math.PI, 0); c.quadraticCurveTo(11, 6, 0, 6); c.quadraticCurveTo(-11, 6, -11, 0); c.fill(); c.stroke();
    c.fillStyle = hit ? "#fff" : "#fffbe8"; c.beginPath(); c.ellipse(0, -1, 5.5, 4.2, 0, 0, 6.283); c.fill();
    c.fillStyle = hit ? "#ddd" : (ra ? "#c4202c" : "#07030f"); c.beginPath(); c.ellipse(0, -1, 1.3, 3.8, 0, 0, 6.283); c.fill();
  } else if (z === 4) {
    c.beginPath(); c.arc(-7, 3, 6.5, 0, 6.283); c.arc(-1, -3, 8.5, 0, 6.283); c.arc(7, 3, 6.5, 0, 6.283); c.rect(-12, 3, 24, 6.5); c.fill(); c.stroke();
    c.fillStyle = hit ? "#fff" : "#ffe36b"; c.beginPath(); c.moveTo(2, -8); c.lineTo(-3, 1); c.lineTo(0, 1); c.lineTo(-2, 9); c.lineTo(4, -1); c.lineTo(1, -1); c.closePath(); c.fill();
    eye(-6, -2, 1.5, A); eye(6, -2, 1.5, A);
    for (let i = 0; i < 3; i++) { const a = T * 1.6 + i * 2.094; c.fillStyle = hit ? "#fff" : A; c.beginPath(); c.arc(Math.cos(a) * 16, Math.sin(a) * 6 + 6, 1.5, 0, 6.283); c.fill(); }
  } else if (z === 5) {
    c.beginPath(); c.moveTo(0, -13); c.lineTo(9, -6); c.lineTo(9, 7); c.lineTo(0, 13); c.lineTo(-9, 7); c.lineTo(-9, -6); c.closePath(); c.fill(); c.stroke();
    c.globalAlpha = 0.5; c.lineWidth = 0.8; c.beginPath(); c.moveTo(0, -13); c.lineTo(0, 13); c.moveTo(-9, -6); c.lineTo(9, 7); c.moveTo(9, -6); c.lineTo(-9, 7); c.stroke(); c.globalAlpha = 1; c.lineWidth = 1.1;
    c.fillStyle = hit ? "#fff" : P[2]; [-6, 0, 6].forEach((x, i) => { c.beginPath(); c.moveTo(x - 2.5, -12 + Math.abs(x) * 0.3); c.lineTo(x, -19 + (i === 1 ? -3 : 0)); c.lineTo(x + 2.5, -12 + Math.abs(x) * 0.3); c.closePath(); c.fill(); });
    eye(-3.5, -1, 1.7, A); eye(3.5, -1, 1.7, A);
  } else if (z === 6) {
    c.save(); c.rotate(T * 0.4); c.fillStyle = hit ? "#fff" : A; for (let i = 0; i < 8; i++) { c.rotate(0.7854); c.beginPath(); c.moveTo(-1.6, -11); c.lineTo(0, i % 2 ? -16 : -19); c.lineTo(1.6, -11); c.closePath(); c.fill(); } c.restore();
    c.fillStyle = fl(P[0], P[1]); c.beginPath(); c.arc(0, 0, 11, 0, 6.283); c.fill(); c.stroke();
    c.fillStyle = hit ? "#ddd" : "#05030f"; c.beginPath(); c.ellipse(0, 0, 6, 4, 0, 0, 6.283); c.fill(); c.fillStyle = hit ? "#fff" : (ra ? "#ff4a3a" : A); c.beginPath(); c.arc(0, 0, 2.4, 0, 6.283); c.fill();
    for (let i = 0; i < 5; i++) { const a = T * 1.1 + i * 1.2566; c.fillStyle = hit ? "#fff" : A; c.fillRect(Math.cos(a) * 15 - 1.2, Math.sin(a) * 15 - 1.2, 2.4, 2.4); }
  } else {
    c.beginPath(); c.moveTo(0, -14); c.lineTo(9, 0); c.lineTo(0, 14); c.lineTo(-9, 0); c.closePath(); c.fill(); c.stroke();
    c.lineWidth = 1.8; [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, y]) => { c.beginPath(); c.moveTo(x * 6, y * 6); c.lineTo(x * 14, y * 11); c.stroke(); });
    c.fillStyle = hit ? "#fff" : "#fffbe8"; c.beginPath(); c.moveTo(-6, 0); c.quadraticCurveTo(0, -6, 6, 0); c.quadraticCurveTo(0, 6, -6, 0); c.fill();
    c.fillStyle = hit ? "#ddd" : (ra ? "#c4202c" : A); c.beginPath(); c.arc(0, 0, 2.3, 0, 6.283); c.fill();
    for (let i = 0; i < 4; i++) { const a = T * 1.3 + i * 1.571; c.fillStyle = hit ? "#fff" : A; c.fillRect(Math.cos(a) * 16 - 1.5, Math.sin(a) * 9 - 1.5, 3, 3); }
  }
  c.restore();
}
function drawEnemy(c, en, T) {
  const r = eRect(en), cx = r.x + r.w / 2, cy = r.y + r.h / 2, pal = enemyPal(en), acc = pal[2], hit = en.flash > 0;
  let sc = 1 + 0.14 * (en.kick || 0); if (en.intro > 0) sc *= 1 + 0.6 * Math.pow(en.intro / 1.3, 2);
  c.save(); c.translate(cx, cy); c.scale(sc, sc); c.translate(-cx, -cy); c.translate(en.hx || 0, (en.hy || 0) + (en.boss ? 0 : Math.sin(T * 2.2 + en.c * 1.7 + en.r) * 0.7));
  if (en.elite || en.boss || en.kind === "bomb") { c.shadowColor = acc; c.shadowBlur = en.kind === "bomb" ? 7 + 6 * Math.sin(T * 8) : en.boss ? 14 + 4 * Math.sin(T * 3) : 10; } else { c.shadowColor = "rgba(0,0,0,.5)"; c.shadowBlur = 6; c.shadowOffsetY = 2; }
  rr(c, r.x, r.y, r.w, r.h, 6);
  const eg = c.createLinearGradient(0, r.y, 0, r.y + r.h); eg.addColorStop(0, pal[0]); eg.addColorStop(1, pal[1]);
  c.fillStyle = hit ? "#ffffff" : eg; c.fill(); c.shadowBlur = 0; c.shadowOffsetY = 0;
  c.lineWidth = en.elite || en.boss ? 1.8 : 1.4; c.strokeStyle = acc; c.stroke();
  if (en.brittle) { c.lineWidth = 2.6; c.strokeStyle = "#7fd6ff"; c.stroke(); }
  if (en.frz > 0) { c.save(); c.fillStyle = "rgba(160,225,255,.28)"; rr(c, r.x, r.y, r.w, r.h, 6); c.fill(); c.lineWidth = 2; c.strokeStyle = "#bfeaff"; c.stroke(); c.restore(); }
  if (en.mark > 0) { c.save(); c.setLineDash([3, 3]); c.lineWidth = 2; c.strokeStyle = "#ffd36b"; rr(c, r.x - 1, r.y - 1, r.w + 2, r.h + 2, 7); c.stroke(); c.restore(); }
  if (en.sh > 0) { c.save(); c.lineWidth = 2; c.globalAlpha = 0.6 + 0.3 * Math.sin(T * 5); c.strokeStyle = "#8fd3ff"; rr(c, r.x - 1.5, r.y - 1.5, r.w + 3, r.h + 3, 8); c.stroke(); c.restore(); }
  if (en.ab === "aegis") { c.save(); c.globalAlpha = 0.18 + 0.08 * Math.sin(T * 3); c.fillStyle = "#ffc9a0"; c.beginPath(); c.arc(cx, cy, 52, 0, 6.283); c.fill(); c.restore(); }
  if (en.ab === "barmor") { c.save(); c.lineCap = "round"; c.lineWidth = 3.5; c.strokeStyle = "#9fd0ff"; c.shadowColor = "#9fd0ff"; c.shadowBlur = 6; c.beginPath(); c.moveTo(r.x + 5, r.y + r.h - 0.5); c.lineTo(r.x + r.w - 5, r.y + r.h - 0.5); c.stroke(); c.restore(); }
  if (!hit) { const gl = c.createLinearGradient(0, r.y, 0, r.y + r.h * 0.55); gl.addColorStop(0, "rgba(255,255,255,.22)"); gl.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = gl; rr(c, r.x + 1, r.y + 1, r.w - 2, r.h * 0.55, 5); c.fill(); }
  if (!hit) { c.globalAlpha = 0.28; c.lineWidth = 0.8; c.strokeStyle = acc; rr(c, r.x + 2.5, r.y + 2.5, r.w - 5, r.h - 5, 4); c.stroke(); c.globalAlpha = 1; }
  if (en.elite || en.boss) { c.fillStyle = "#e8c468"; c.beginPath(); c.moveTo(cx, r.y - 2.5); c.lineTo(cx + 3, r.y + 0.5); c.lineTo(cx, r.y + 3.5); c.lineTo(cx - 3, r.y + 0.5); c.closePath(); c.fill(); }
  const ax = en.boss ? r.x + 24 : r.x + 15.5, ay = r.y + (en.boss ? 13 : 12), dark = hit ? "#ffffff" : "#07030f";
  if (!hit) { const rg = c.createRadialGradient(ax, ay, 1, ax, ay, 12); rg.addColorStop(0, acc + "66"); rg.addColorStop(1, acc + "00"); c.fillStyle = rg; c.beginPath(); c.arc(ax, ay, 12, 0, 6.283); c.fill(); }
  if (en.kind === "bomb") {
    const bg = c.createRadialGradient(ax - 2, ay - 2, 1, ax, ay + 1, 9); bg.addColorStop(0, "#5a2a1c"); bg.addColorStop(1, "#140806");
    c.fillStyle = hit ? "#fff" : bg; c.beginPath(); c.arc(ax, ay + 1, 8, 0, 6.283); c.fill(); c.lineWidth = 1; c.strokeStyle = acc; c.stroke();
    c.strokeStyle = "#c9a24a"; c.lineWidth = 1.4; c.beginPath(); c.moveTo(ax + 3, ay - 6); c.quadraticCurveTo(ax + 7, ay - 11, ax + 10, ay - 9); c.stroke();
    c.fillStyle = "#ffd36b"; c.beginPath(); c.arc(ax + 10, ay - 9, 1.6 + Math.sin(T * 20) * 0.7, 0, 6.283); c.fill();
  } else if (en.kind === "gold") {
    const cg = c.createLinearGradient(ax - 8, ay - 8, ax + 8, ay + 8); cg.addColorStop(0, "#fff0a8"); cg.addColorStop(1, "#b8862a");
    c.fillStyle = hit ? "#fff" : cg; c.beginPath(); c.arc(ax, ay, 8, 0, 6.283); c.fill(); c.lineWidth = 1; c.strokeStyle = "#7a5410"; c.stroke();
    c.beginPath(); c.arc(ax, ay, 5.2, 0, 6.283); c.stroke(); c.fillStyle = "#7a5410"; c.beginPath(); c.moveTo(ax, ay - 3.8); c.lineTo(ax + 1.2, ay - 1.2); c.lineTo(ax + 3.8, ay); c.lineTo(ax + 1.2, ay + 1.2); c.lineTo(ax, ay + 3.8); c.lineTo(ax - 1.2, ay + 1.2); c.lineTo(ax - 3.8, ay); c.lineTo(ax - 1.2, ay - 1.2); c.closePath(); c.fill();
  } else if (en.boss) {
    drawBoss(c, en, ax, ay, T, hit);
  } else {
    const s = 1.1, look = en.look || 0, E = SIL_EYES[look];
    const mg = c.createRadialGradient(ax - 3 * s, ay - 5 * s, 1, ax, ay, 14 * s); mg.addColorStop(0, pal[0]); mg.addColorStop(1, dark);
    silPath(c, look, ax, ay, s, T); c.fillStyle = hit ? "#fff" : mg; c.fill(); c.globalAlpha = 0.95; c.lineWidth = 1.3; c.strokeStyle = acc; c.stroke(); c.globalAlpha = 1;
    drawEye(c, ax + E[0][0] * s, ay + E[0][1] * s, E[2] * s, acc); if (E[1]) drawEye(c, ax + E[1][0] * s, ay + E[1][1] * s, E[2] * s, acc);
    monFx(c, en, ax, ay, s, T, acc, hit);
  }
  if (en.burn > 0) {
    c.fillStyle = "#ffb35a"; c.beginPath(); c.moveTo(r.x + 6, r.y + 2); c.quadraticCurveTo(r.x + 10.5, r.y + 7, r.x + 6, r.y + 11); c.quadraticCurveTo(r.x + 1.5, r.y + 7, r.x + 6, r.y + 2); c.fill();
    c.textAlign = "left"; c.textBaseline = "middle"; c.font = "bold 9px sans-serif"; c.fillStyle = "#fff"; c.fillText(String(en.burn), r.x + 11, r.y + 8);
  }
  if (en.ab && AB[en.ab]) {
    const fz = en.ab === "fuse", bx2 = en.boss ? r.x + 9 : r.x + r.w - 24, by2 = r.y + 7, hot = fz && en.fuse <= 1;
    c.fillStyle = fz ? (hot ? "#c4202c" : "#7a2a1a") : "rgba(10,4,20,.88)"; c.strokeStyle = fz ? "#ff8a4a" : acc; c.lineWidth = 1; c.beginPath(); c.arc(bx2, by2, 6.5, 0, 6.283); c.fill(); c.stroke();
    c.fillStyle = "#fff"; c.textAlign = "center"; c.textBaseline = "middle"; c.font = fz ? "bold 9px sans-serif" : "9px sans-serif"; c.fillText(fz ? String(Math.max(0, en.fuse)) : AB[en.ab].ic, bx2, by2 + 0.5);
  }
  if (en.atk) {
    const imm = en.t + 1 >= en.cd, at = fmtN(en.atk), br = Math.max(en.boss ? 7 : 5.5, at.length * 3 + 2.5), bx = en.boss ? r.x + 54 : r.x + r.w - 2, by = en.boss ? r.y + 12 : r.y + 2;
    if (imm && !hit) { c.globalAlpha = 0.5 + 0.5 * Math.sin(T * 10); c.lineWidth = 2; c.strokeStyle = "#ff5a4a"; rr(c, r.x, r.y, r.w, r.h, 6); c.stroke(); c.globalAlpha = 1; }
    c.fillStyle = imm ? "#c4202c" : "#5a1a28"; c.strokeStyle = "#ff6b5a"; c.lineWidth = 1; c.beginPath(); c.arc(bx, by, br, 0, 6.283); c.fill(); c.stroke();
    c.fillStyle = "#fff"; c.textAlign = "center"; c.textBaseline = "middle"; c.font = `bold ${en.boss ? 9 : 8}px sans-serif`; c.fillText(at, bx, by + 0.5);
  }
  c.fillStyle = "rgba(255,255,255,.12)"; rr(c, r.x + 4, r.y + r.h - 7, r.w - 8, 4, 2); c.fill();
  if (en.hs > en.hp) { c.fillStyle = "rgba(255,255,255,.75)"; rr(c, r.x + 4, r.y + r.h - 7, Math.max(3, (r.w - 8) * Math.max(0, en.hs / en.max)), 4, 2); c.fill(); }
  c.fillStyle = en.elite || en.boss ? "#e8c468" : en.kind === "bomb" ? "#ff8a4a" : "#c15b5b"; rr(c, r.x + 4, r.y + r.h - 7, Math.max(3, (r.w - 8) * Math.max(0, en.hp / en.max)), 4, 2); c.fill();
  if (en.sh > 0) { c.fillStyle = "#8fd3ff"; rr(c, r.x + 4, r.y + r.h - 10, Math.max(2, (r.w - 8) * Math.min(1, en.sh / (en.shMax || en.max))), 2.5, 1.2); c.fill(); }
  const txt = fmtN(en.hp), ty = r.y + (r.h - 6) / 2;
  c.textAlign = "right"; c.textBaseline = "middle"; c.font = `bold ${en.boss ? 17 : txt.length > 3 ? 12 : 14}px sans-serif`;
  c.lineJoin = "round"; c.lineWidth = 3; c.strokeStyle = "rgba(8,3,16,.9)"; c.strokeText(txt, r.x + r.w - (en.boss ? 8 : 5), ty);
  c.fillStyle = hit ? "#c15b5b" : "#f7efe0"; c.fillText(txt, r.x + r.w - (en.boss ? 8 : 5), ty);
  c.restore();
}
function drawGlyph(c, b, col) {
  const f = b.fx || {}, n = (f.pierce > 0 ? 1 : 0) + (f.splash > 0 ? 1 : 0) + (f.chain > 0 ? 1 : 0);
  c.fillStyle = "#f7efe0"; c.strokeStyle = "#f7efe0"; c.lineWidth = 1; c.beginPath();
  if (n > 1) { c.moveTo(0, -4.5); c.lineTo(1, -1); c.lineTo(4, 0); c.lineTo(1, 1); c.lineTo(0, 4.5); c.lineTo(-1, 1); c.lineTo(-4, 0); c.lineTo(-1, -1); c.closePath(); c.fill(); }
  else if (f.pierce > 0) { c.moveTo(0, -4.2); c.lineTo(1.6, 0); c.lineTo(0, 4.2); c.lineTo(-1.6, 0); c.closePath(); c.fill(); }
  else if (f.splash > 0) { for (let i = 0; i < 8; i++) { const a = i * 0.7854, r2 = i % 2 ? 2.6 : 4; c.moveTo(Math.cos(a) * 1, Math.sin(a) * 1); c.lineTo(Math.cos(a) * r2, Math.sin(a) * r2); } c.stroke(); }
  else if (f.chain > 0) { c.moveTo(1.2, -4); c.lineTo(-1.8, 0.4); c.lineTo(0.2, 0.4); c.lineTo(-1.2, 4); c.lineTo(2, -0.6); c.lineTo(0, -0.6); c.closePath(); c.fill(); }
  else { c.arc(0, 0, 1.8, 0, 6.283); c.fillStyle = col; c.fill(); }
}
function drawTrail(c, b, col) {
  const tr = b.tr, n = tr.length, f = b.fx || {}; if (n < 2) return;
  c.save(); c.lineCap = "round"; c.lineJoin = "round"; c.globalCompositeOperation = "lighter";
  const tc = f.splash ? "#ff9a40" : col;
  for (let i = PERF_LITE ? Math.max(1, n - 5) : 1; i < n; i++) { const k = i / n; c.globalAlpha = k * (f.splash ? 0.6 : 0.42); c.strokeStyle = tc; c.lineWidth = (f.pierce ? 0.8 : 1) + (f.pierce ? 1.5 : 4.5) * k; c.beginPath(); c.moveTo(tr[i - 1].x, tr[i - 1].y); c.lineTo(tr[i].x, tr[i].y); c.stroke(); }
  if (f.pierce) {
    const sp = Math.hypot(b.vx, b.vy) || 1, ex = b.x - b.vx / sp * 52, ey = b.y - b.vy / sp * 52, gr = c.createLinearGradient(b.x, b.y, ex, ey);
    gr.addColorStop(0, "rgba(200,255,230,.95)"); gr.addColorStop(1, "rgba(200,255,230,0)");
    c.globalAlpha = 1; c.strokeStyle = gr; c.lineWidth = 1.6; c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(ex, ey); c.stroke();
  }
  if (f.chain) {
    c.globalAlpha = 0.9; c.strokeStyle = "#d6b3ff"; c.lineWidth = 1.3; c.shadowColor = "#a070ff"; c.shadowBlur = 6; c.beginPath(); c.moveTo(tr[0].x, tr[0].y);
    for (let i = 1; i < n; i++) c.lineTo(tr[i].x + (Math.random() - 0.5) * 6, tr[i].y + (Math.random() - 0.5) * 6);
    c.lineTo(b.x, b.y); c.stroke();
  }
  c.restore();
}
const AMB = Array.from({ length: 38 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: 0.4 + Math.random(), p: Math.random() * 6, r: 0.8 + Math.random() * 1.8 }));
function drawAmb(c, T, zi, col) {
  c.save(); c.globalCompositeOperation = "lighter"; c.fillStyle = col; c.strokeStyle = col;
  AMB.forEach(a => {
    if (zi === 4) { const x = ((((a.x + T * (6 + a.s * 10)) % (W + 80)) + W + 80) % (W + 80)) - 40; c.globalAlpha = 0.08 + 0.06 * Math.sin(T * 0.6 + a.p); c.beginPath(); c.ellipse(x, a.y, 16 + a.r * 8, 4 + a.r * 2, 0, 0, 6.283); c.fill(); }
    else if (zi === 5) { const y = (a.y + T * (14 + a.s * 18)) % H, x = (a.x + Math.sin(T * 0.9 + a.p) * 14 + W) % W; c.globalAlpha = 0.35; c.fillRect(x, y, a.r * 0.9, a.r * 0.9); }
    else if (zi === 6) { const y = (((a.y - T * (2 + a.s * 3)) % H) + H) % H; c.globalAlpha = 0.15 + 0.5 * Math.abs(Math.sin(T * 1.8 + a.p)); c.lineWidth = 0.8; c.beginPath(); c.moveTo(a.x - a.r * 2, y); c.lineTo(a.x + a.r * 2, y); c.moveTo(a.x, y - a.r * 2); c.lineTo(a.x, y + a.r * 2); c.stroke(); }
    else if (zi === 1) { const y = (((a.y - T * (18 + a.s * 24)) % H) + H) % H; c.globalAlpha = 0.22 + 0.3 * Math.abs(Math.sin(T * 3 + a.p)); c.fillRect(a.x + Math.sin(T * 1.5 + a.p) * 10, y, a.r * 0.9, a.r * 0.9); }
    else if (zi === 2) { const y = (((a.y - T * (8 + a.s * 12)) % H) + H) % H; c.globalAlpha = 0.28; c.lineWidth = 0.8; c.beginPath(); c.arc(a.x + Math.sin(T * 0.9 + a.p) * 8, y, a.r * 1.7, 0, 6.283); c.stroke(); }
    else if (zi === 3) { const y = (a.y + T * (5 + a.s * 6)) % H; c.globalAlpha = 0.2 + 0.25 * Math.abs(Math.sin(T * 1.4 + a.p)); c.save(); c.translate(a.x + Math.cos(T * 0.4 + a.p) * 20, y); c.rotate(T * 0.6 + a.p); c.fillRect(-a.r, -a.r, a.r * 2, a.r * 2); c.restore(); }
    else { const y = (((a.y - T * (3 + a.s * 4)) % H) + H) % H; c.globalAlpha = 0.18 + 0.22 * Math.abs(Math.sin(T * 1.1 + a.p)); c.beginPath(); c.arc(a.x + Math.sin(T * 0.5 + a.p) * 12, y, a.r * 0.8, 0, 6.283); c.fill(); }
  });
  c.restore();
}
function drawArena(c, T, col) {
  c.save(); c.globalCompositeOperation = "lighter"; c.translate(W / 2, H * 0.56); c.strokeStyle = col; c.lineWidth = 1;
  [[150, 0.09, 0.15, 36], [108, 0.07, -0.22, 24], [64, 0.06, 0.3, 12]].forEach(([r, a, sp, n]) => {
    c.globalAlpha = a; c.beginPath(); c.arc(0, 0, r, 0, 6.283); c.stroke();
    c.save(); c.rotate(T * sp); for (let i = 0; i < n; i++) { c.rotate(6.283 / n); c.beginPath(); c.moveTo(r, 0); c.lineTo(r + (i % 3 === 0 ? 9 : 4), 0); c.stroke(); } c.restore();
  });
  c.restore();
  c.save(); c.globalCompositeOperation = "lighter";
  [[0, 1], [W, -1]].forEach(([x, d]) => { const g2 = c.createLinearGradient(x, 0, x + d * 16, 0); g2.addColorStop(0, col + "55"); g2.addColorStop(1, col + "00"); c.fillStyle = g2; c.fillRect(d > 0 ? 0 : W - 16, CEIL, 16, H - CEIL); });
  c.restore();
}
function drawBall(c, b, T) {
  const col = RC[b.rarity] || RC.common, ang = Math.atan2(b.vy, b.vx) + Math.PI / 2, k = 1 + 0.1 * Math.min(2, b.tier || 0);
  drawTrail(c, b, col);
  if (PERF_LITE) { c.save(); c.globalAlpha = 0.22; c.fillStyle = col; c.beginPath(); c.arc(b.x, b.y, 11, 0, 6.283); c.fill(); c.restore(); }
  else { c.save(); c.globalCompositeOperation = "lighter"; const hg = c.createRadialGradient(b.x, b.y, 1, b.x, b.y, 24); hg.addColorStop(0, col + "bb"); hg.addColorStop(0.5, col + "33"); hg.addColorStop(1, col + "00"); c.fillStyle = hg; c.beginPath(); c.arc(b.x, b.y, 24, 0, 6.283); c.fill(); c.restore(); }
  c.save(); c.translate(b.x, b.y); c.rotate(ang + Math.sin(T * 14 + b.x * 0.05) * 0.12); c.scale(k, k);
  if (!PERF_LITE) { c.shadowColor = col; c.shadowBlur = 10; } rr(c, -4.5, -6.5, 9, 13, 2);
  const cg = c.createLinearGradient(0, -6.5, 0, 6.5); cg.addColorStop(0, "#2a1646"); cg.addColorStop(1, "#150a26"); c.fillStyle = cg; c.fill();
  c.shadowBlur = 0; c.lineWidth = b.tier ? 2 : 1.4; c.strokeStyle = b.tier ? "#e8c468" : col; c.stroke();
  c.globalAlpha = 0.3; c.fillStyle = col; rr(c, -3, -5, 6, 10, 1.2); c.fill(); c.globalAlpha = 1;
  drawGlyph(c, b, col);
  c.restore();
}
function draw() {
  const g = st.g, c = st.ctx;
  if (!g || !c) return;
  const T = performance.now() / 1000;
  c.clearRect(0, 0, W, H);
  c.save();
  if (g.shake > 0) c.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
  if (g.zoom > 0.001) { const zm = 1 + g.zoom; c.translate(W / 2, H / 2); c.scale(zm, zm); c.translate(-W / 2, -H / 2); }
  const zc = ZONES[g.zone % ZONES.length], zp = ZONES[g.zPrev % ZONES.length], zf = g.zF;
  const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, mixHex(zp.bg[0], zc.bg[0], zf)); bg.addColorStop(1, mixHex(zp.bg[1], zc.bg[1], zf));
  c.fillStyle = bg; c.fillRect(-20, -20, W + 40, H + 40);
  [[zp, 1 - zf], [zc, zf]].forEach(([z, a]) => { if (a <= 0) return; c.globalAlpha = a; const gl = c.createRadialGradient(W / 2, 140, 10, W / 2, 140, 320); gl.addColorStop(0, z.glow); gl.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = gl; c.fillRect(-20, -20, W + 40, H + 40); }); c.globalAlpha = 1;
  const starCol = mixHex(zp.star, zc.star, zf); STARS.forEach(s2 => { c.globalAlpha = 0.25 + 0.25 * Math.sin(T * 1.5 + s2.p); c.fillStyle = starCol; c.fillRect(s2.x, s2.y, s2.r, s2.r); }); c.globalAlpha = 1;
  drawAmb(c, T, g.zone % ZONES.length, zc.acc);
  drawArena(c, T, zc.acc);
  // HUD
  { const hb = c.createLinearGradient(0, 0, 0, CEIL); hb.addColorStop(0, "rgba(18,8,32,.9)"); hb.addColorStop(1, "rgba(44,22,76,.6)"); c.fillStyle = hb; c.fillRect(0, 0, W, CEIL); c.fillStyle = "rgba(232,196,104,.4)"; c.fillRect(0, CEIL - 1, W, 1); }
  c.textBaseline = "middle"; c.textAlign = "left"; c.font = "bold 13px sans-serif"; c.fillStyle = "#e8c468";
  c.fillText(`${dc("第", "Floor ")}${Math.min(g.floor, MAX_FLOOR)}/${MAX_FLOOR}${dc(" 層", "")}  ·  ⚔ ${g.kills}  ·  Lv${g.level}`, 10, CEIL / 2);
  if (g.affix && AFFIX_BY[g.affix]) { const af = AFFIX_BY[g.affix]; c.font = "bold 11px sans-serif"; c.fillStyle = "rgba(255,255,255,.75)"; c.fillText(`${af.ic} ${dc(af.zh, af.en)}`, 10, CEIL + 12); c.font = "bold 13px sans-serif"; }
  c.fillStyle = "rgba(255,255,255,.14)"; rr(c, W - 110, CEIL / 2 - 3, 100, 6, 3); c.fill();
  if (g.xpPulse > 0) { c.save(); c.shadowColor = "#b98cf0"; c.shadowBlur = 12 * g.xpPulse; }
  c.fillStyle = g.xpPulse > 0 ? "#c9a8ff" : "#8b6bd1"; rr(c, W - 110, CEIL / 2 - 3, Math.max(6, 100 * Math.min(1, g.xp / needXp(g.level))), 6, 3); c.fill();
  if (g.xpPulse > 0) c.restore();
  if (g.ff > 1.05 && g.firing) { c.textAlign = "right"; c.font = "bold 12px sans-serif"; c.fillStyle = "rgba(255,230,150,.9)"; c.fillText("⏩ ×" + g.ff.toFixed(1), W - 8, CEIL + 14); }
  { const cm = chillMul(g); if (cm < 1) { c.textAlign = "left"; c.font = "bold 11px sans-serif"; c.fillStyle = "#bfefff"; c.fillText(dc(`❄ 彈珠減速 ${Math.round((1 - cm) * 100)}%`, `❄ Balls slowed ${Math.round((1 - cm) * 100)}%`), 10, CEIL + 38); } }
  if (g.pitPush > 0) { c.textAlign = "left"; c.font = "bold 11px sans-serif"; c.fillStyle = "#8fd3ff"; c.fillText(dc(`🌊 潮汐 ×${g.pitPush}（${g.pitT} 輪）`, `🌊 Tide ×${g.pitPush} (${g.pitT})`), 10, CEIL + 26); }
  if (g.floor % 10 === 9) { c.textAlign = "center"; c.font = "bold 12px sans-serif"; c.fillStyle = `rgba(255,120,100,${0.6 + 0.4 * Math.sin(T * 6)})`; c.fillText(dc("⚠ 下一層 BOSS 出現", "⚠ BOSS next floor"), W / 2, CEIL + 14); }
  // 深坑線
  const py = GRID_TOP + g.pit * RH, danger = g.enemies.some(e => !e.dead && e.r >= g.pit - 2);
  if (danger) { const dg = c.createLinearGradient(0, py - 90, 0, py); dg.addColorStop(0, "rgba(193,91,91,0)"); dg.addColorStop(1, `rgba(193,91,91,${0.22 + 0.15 * Math.sin(T * 7)})`); c.fillStyle = dg; c.fillRect(0, py - 90, W, 90); }
  c.save(); c.setLineDash([6, 6]); c.strokeStyle = "rgba(193,91,91,.85)"; c.lineWidth = 2; c.beginPath(); c.moveTo(0, py); c.lineTo(W, py); c.stroke(); c.restore();
  c.fillStyle = "rgba(193,91,91,.12)"; c.fillRect(0, py, W, H - py);
  { const vg2 = c.createRadialGradient(W / 2, H / 2, H * 0.38, W / 2, H / 2, H * 0.78); vg2.addColorStop(0, "rgba(0,0,0,0)"); vg2.addColorStop(1, "rgba(4,1,10,.45)"); c.fillStyle = vg2; c.fillRect(-20, -20, W + 40, H + 40); }
  // 敵人
  g.enemies.forEach(en => { if (!en.dead) drawEnemy(c, en, T); });
  // 衝擊波圈
  g.rings.forEach(rg => { const k = 1 - rg.t / rg.m, e = 1 - Math.pow(1 - k, 3); c.globalAlpha = (1 - k) * 0.9; c.strokeStyle = rg.col; c.lineWidth = rg.w * (1 - k) + 0.5; c.beginPath(); c.arc(rg.x, rg.y, 4 + (rg.r1 - 4) * e, 0, 6.283); c.stroke(); }); c.globalAlpha = 1;
  // 電弧
  g.bolts.forEach(b => { const al = Math.min(1, b.t / 0.15), pts = [[b.x1, b.y1]]; for (let i = 1; i < 6; i++) { const f = i / 6; pts.push([b.x1 + (b.x2 - b.x1) * f + (Math.random() - 0.5) * 16, b.y1 + (b.y2 - b.y1) * f + (Math.random() - 0.5) * 16]); } pts.push([b.x2, b.y2]); c.save(); c.globalCompositeOperation = "lighter"; c.lineJoin = "round"; [[7, `rgba(150,90,255,${0.35 * al})`], [3.2, `rgba(205,170,255,${0.8 * al})`], [1.2, `rgba(255,255,255,${al})`]].forEach(([w, col]) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke(); }); c.restore(); });
  // 敵方攻擊彈
  g.shots.forEach(s => { const k = 1 - s.t / s.m, e = k * k, e0 = Math.max(0, e - 0.25); c.save(); c.lineCap = "round"; c.strokeStyle = s.big ? "#ff3b3b" : "#ff8a7a"; c.shadowColor = "#ff3b3b"; c.shadowBlur = 10; c.lineWidth = s.big ? 4 : 2.5; c.beginPath(); c.moveTo(s.x1 + (s.x2 - s.x1) * e0, s.y1 + (s.y2 - s.y1) * e0); c.lineTo(s.x1 + (s.x2 - s.x1) * e, s.y1 + (s.y2 - s.y1) * e); c.stroke(); c.restore(); });
  // 瞄準線（含牆壁反彈預測）
  if (!g.firing && !g.upgrading && !g.over) {
    let x = W / 2, y = SHOOT_Y, dx = Math.cos(g.aim), dy = -Math.sin(g.aim), left = 300;
    c.save(); c.setLineDash([3, 7]); c.lineWidth = 2; c.lineCap = "round";
    for (let seg = 0; seg < 3 && left > 0; seg++) {
      const tx = dx > 0 ? (W - BALL_R - x) / dx : dx < 0 ? (BALL_R - x) / dx : 1e9, ty = dy < 0 ? (CEIL + BALL_R - y) / dy : 1e9, t = Math.min(tx, ty, left);
      c.strokeStyle = `rgba(240,230,214,${0.7 - seg * 0.22})`; c.beginPath(); c.moveTo(x, y); c.lineTo(x + dx * t, y + dy * t); c.stroke();
      x += dx * t; y += dy * t; left -= t;
      if (t === tx) dx = -dx; else if (t === ty) dy = -dy; else break;
    }
    c.restore();
  }
  // 彈珠（牌型＋依效果的拖尾）
  g.balls.forEach(b => drawBall(c, b, T));
  // 粒子與傷害數字
  c.save(); c.globalCompositeOperation = "lighter";
  (g.ghosts || []).forEach(o => { const k = 1 - o.t / o.m, cx2 = o.x + o.w / 2, cy2 = o.y + o.h / 2, s3 = 1 + (o.boss ? 0.5 : 0.35) * k; c.globalAlpha = (1 - k) * 0.85; c.fillStyle = k < 0.35 ? "#ffffff" : o.col; c.save(); c.translate(cx2, cy2); c.scale(s3, s3 * (1 - 0.25 * k)); rr(c, -o.w / 2, -o.h / 2, o.w, o.h, 6); c.fill(); c.restore(); });
  g.parts.forEach(p => { const k = Math.max(0, p.t / p.m); c.globalAlpha = k; if (p.ln) { c.strokeStyle = p.col; c.lineWidth = Math.max(0.8, p.sz * 0.7 * k + 0.4); c.lineCap = "round"; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035); c.stroke(); } else { c.fillStyle = p.col; const s3 = p.sz * (0.5 + 0.5 * k); c.fillRect(p.x - s3 / 2, p.y - s3 / 2, s3, s3); } });
  (g.stars || []).forEach(o => { const k = 1 - o.t / o.m, r = o.r * (0.5 + k); c.globalAlpha = 1 - k; c.fillStyle = o.col; c.save(); c.translate(o.x, o.y); c.rotate(o.a); c.beginPath(); for (let i = 0; i < 4; i++) { c.rotate(1.5708); c.moveTo(0, 0); c.lineTo(r * 0.16, r * 0.16); c.lineTo(0, r); c.lineTo(-r * 0.16, r * 0.16); c.closePath(); } c.fill(); c.restore(); });
  (g.orbs || []).forEach(o => { if (o.age < o.dl) return; c.globalAlpha = 0.9; const og = c.createRadialGradient(o.x, o.y, 0, o.x, o.y, 7); og.addColorStop(0, "#fff"); og.addColorStop(0.35, o.col); og.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = og; c.beginPath(); c.arc(o.x, o.y, 7, 0, 6.283); c.fill(); });
  c.restore(); c.globalAlpha = 1;
  c.textAlign = "center"; c.textBaseline = "middle";
  g.pops.forEach(p => { const k = 1 - p.t / p.m, sc = k < 0.1 ? 0.5 + k * 11 : k < 0.22 ? 1.6 - (k - 0.1) * 5 : 1; c.save(); c.translate(p.x, p.y); c.scale(sc, sc); c.globalAlpha = Math.min(1, p.t / 0.25); c.font = `bold ${p.big ? 19 : 12}px sans-serif`; c.lineJoin = "round"; c.lineWidth = 3.5; c.strokeStyle = "rgba(20,6,30,.85)"; c.strokeText(p.txt, 0, 0); c.fillStyle = p.col; c.fillText(p.txt, 0, 0); c.restore(); }); c.globalAlpha = 1;
  // 連擊
  if (g.combo >= 3 && g.comboT > 0) {
    c.textAlign = "right"; c.globalAlpha = Math.min(1, g.comboT / 0.4); c.fillStyle = g.combo >= 40 ? "#ff8a4a" : g.combo >= (g.cmb || 15) ? "#ffd36b" : "#f0e6d6";
    const cp = 1 + 0.35 * (g.cp || 0); c.save(); c.translate(W - 12, CEIL + 34); c.scale(cp, cp); c.font = `bold ${Math.min(44, 24 + g.combo / 3)}px sans-serif`; c.lineJoin = "round"; c.lineWidth = 3; c.strokeStyle = "rgba(8,3,16,.8)"; c.strokeText(String(g.combo), 0, 0); c.fillText(String(g.combo), 0, 0); c.restore();
    c.font = "bold 11px sans-serif"; c.fillText("COMBO" + (g.combo >= (g.cmb || 15) ? " · +" + Math.floor(g.combo / (g.cmb || 15)) + dc(" 傷害", " dmg") : ""), W - 12, CEIL + 58); c.globalAlpha = 1;
  }
  // 發射點
  const first = (g.queue[0] || g.loadout[0] || g.base[0]);
  { const lc = RC[(first && first.rarity) || "common"]; c.save(); c.globalCompositeOperation = "lighter"; const lg2 = c.createRadialGradient(W / 2, SHOOT_Y, 2, W / 2, SHOOT_Y, 30 + 3 * Math.sin(T * 3)); lg2.addColorStop(0, lc + "99"); lg2.addColorStop(1, lc + "00"); c.fillStyle = lg2; c.beginPath(); c.arc(W / 2, SHOOT_Y, 34, 0, 6.283); c.fill(); c.restore();
    c.save(); c.translate(W / 2, SHOOT_Y); c.rotate(T * 0.8); c.setLineDash([4, 6]); c.strokeStyle = lc; c.globalAlpha = 0.7; c.lineWidth = 1.2; c.beginPath(); c.arc(0, 0, 15, 0, 6.283); c.stroke(); c.restore();
    const og2 = c.createRadialGradient(W / 2 - 2, SHOOT_Y - 3, 1, W / 2, SHOOT_Y, BALL_R + 3); og2.addColorStop(0, "#fff"); og2.addColorStop(0.4, lc); og2.addColorStop(1, "#150a26"); c.beginPath(); c.arc(W / 2, SHOOT_Y, BALL_R + 2, 0, Math.PI * 2); c.fillStyle = og2; c.fill(); c.lineWidth = 1.6; c.strokeStyle = "#f0e6d6"; c.stroke(); }
  c.textAlign = "center"; c.font = "11px sans-serif"; c.fillStyle = "rgba(240,230,214,.7)";
  c.fillText(`${g.loadout.length}${dc(" 顆", " balls")}`, W / 2, H - 8);
  // 玩家血條
  {
    const bx = 10, by = H - 28, bw = 112, bh = 13, sx = g.hurt > 0 ? (Math.random() - 0.5) * 5 : 0, ratio = Math.max(0, g.hp / g.maxHp), gr = Math.max(ratio, Math.max(0, g.hpShow / g.maxHp));
    const hc = ratio > 0.5 ? "#6fcf8a" : ratio > 0.25 ? "#e8c468" : "#e05a5a", ht = `HP ${fmtN(g.hp)}/${fmtN(g.maxHp)}`;
    c.save(); c.translate(sx, 0);
    c.fillStyle = "rgba(8,3,16,.7)"; rr(c, bx - 1.5, by - 1.5, bw + 3, bh + 3, 6); c.fill();
    c.fillStyle = "rgba(255,255,255,.1)"; rr(c, bx, by, bw, bh, 5); c.fill();
    if (gr > ratio) { c.fillStyle = "rgba(255,255,255,.55)"; rr(c, bx, by, Math.max(4, bw * gr), bh, 5); c.fill(); }
    if (ratio > 0) { c.fillStyle = hc; if (ratio <= 0.25) c.globalAlpha = 0.7 + 0.3 * Math.sin(T * 8); rr(c, bx, by, Math.max(5, bw * ratio), bh, 5); c.fill(); c.globalAlpha = 1; }
    c.lineWidth = 1; c.strokeStyle = "rgba(201,162,74,.55)"; rr(c, bx, by, bw, bh, 5); c.stroke();
    c.textAlign = "center"; c.textBaseline = "middle"; c.font = "bold 9px sans-serif"; c.lineWidth = 2.5; c.lineJoin = "round"; c.strokeStyle = "rgba(8,3,16,.85)"; c.strokeText(ht, bx + bw / 2, by + bh / 2 + 0.5); c.fillStyle = "#fff"; c.fillText(ht, bx + bw / 2, by + bh / 2 + 0.5);
    c.restore();
  }
  if (g.hurt > 0) { const k = g.hurt / 0.45, vg = c.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75); vg.addColorStop(0, "rgba(220,30,40,0)"); vg.addColorStop(1, `rgba(220,30,40,${Math.min(0.55, 0.4 * k)})`); c.fillStyle = vg; c.fillRect(-20, -20, W + 40, H + 40); }
  if (g.flashW > 0) { c.fillStyle = `rgba(255,248,220,${Math.min(0.5, g.flashW * 0.6)})`; c.fillRect(-20, -20, W + 40, H + 40); }
  // BOSS 暗角、升級光效、過場橫幅
  if (g.bossT > 0) { const k = Math.min(1, g.bossT / 1.8), vg = c.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.75); vg.addColorStop(0, "rgba(120,10,20,0)"); vg.addColorStop(1, `rgba(150,20,30,${0.5 * k * (0.7 + 0.3 * Math.sin(T * 10))})`); c.fillStyle = vg; c.fillRect(-20, -20, W + 40, H + 40); }
  if (g.lvT > 0) {
    const k = g.lvT, lg = c.createLinearGradient(0, H, 0, H * 0.3); lg.addColorStop(0, `rgba(232,196,104,${0.35 * k})`); lg.addColorStop(1, "rgba(232,196,104,0)"); c.fillStyle = lg; c.fillRect(0, 0, W, H);
    c.globalAlpha = Math.min(1, k * 1.5); c.textAlign = "center"; c.textBaseline = "middle"; c.font = "bold 16px sans-serif"; c.lineWidth = 3; c.strokeStyle = "rgba(8,3,16,.8)"; c.fillStyle = "#ffe9a8";
    const ly = H - 70 - (1 - k) * 60; c.strokeText("LEVEL UP!", W / 2, ly); c.fillText("LEVEL UP!", W / 2, ly); c.globalAlpha = 1;
  }
  if (g.banner) {
    const b = g.banner, p = 1 - b.t / b.m, a = Math.max(0, Math.min(1, p / 0.12, b.t / 0.35)), ez = 1 - Math.pow(1 - Math.min(1, p / 0.18), 3), z = zoneOf(b.floor);
    c.save(); c.globalAlpha = a; c.textAlign = "center"; c.textBaseline = "middle"; c.lineJoin = "round";
    if (b.boss || b.newZ) {
      const y = H * 0.42, col = b.boss ? "#ff6b5a" : z.acc, sg = c.createLinearGradient(0, 0, W, 0);
      sg.addColorStop(0, "rgba(8,3,16,0)"); sg.addColorStop(0.2, "rgba(8,3,16,.82)"); sg.addColorStop(0.8, "rgba(8,3,16,.82)"); sg.addColorStop(1, "rgba(8,3,16,0)");
      c.fillStyle = sg; c.fillRect(0, y - 30, W, 60);
      c.globalAlpha = a * 0.7; c.strokeStyle = col; c.lineWidth = 1; c.beginPath(); c.moveTo(W * (0.5 - 0.4 * ez), y - 30); c.lineTo(W * (0.5 + 0.4 * ez), y - 30); c.moveTo(W * (0.5 - 0.4 * ez), y + 30); c.lineTo(W * (0.5 + 0.4 * ez), y + 30); c.stroke(); c.globalAlpha = a;
      const ox = (1 - ez) * 80, t1 = b.boss ? "BOSS" : dc(`${z.zh}之域`, `The ${z.en}`), t2 = dc(`第 ${b.floor} 層`, `Floor ${b.floor}`) + (b.boss ? ` · ${dc(z.zh, z.en)}` : "");
      c.font = "bold 24px Georgia,serif"; c.lineWidth = 4; c.strokeStyle = "rgba(8,3,16,.9)"; c.strokeText(t1, W / 2 + ox, y - 8); c.fillStyle = col; c.fillText(t1, W / 2 + ox, y - 8);
      c.font = "bold 12px sans-serif"; c.fillStyle = "#f0e6d6"; c.fillText(t2, W / 2 - ox, y + 16);
    } else {
      const t = dc(`第 ${b.floor} 層`, `Floor ${b.floor}`);
      c.font = "bold 15px sans-serif"; c.lineWidth = 3; c.strokeStyle = "rgba(8,3,16,.85)"; c.strokeText(t, W / 2 + (1 - ez) * 40, H - 58); c.fillStyle = "rgba(240,230,214,.92)"; c.fillText(t, W / 2 + (1 - ez) * 40, H - 58);
    }
    c.restore();
  }
  c.restore();
}

/* ===== 主迴圈與輸入 ===== */
let PERF_LITE = false;
function loop(ts) {
  const g = st.g;
  if (!st.running || !g || g.over) { st.raf = 0; return; }
  if (!st.canvas || !st.canvas.isConnected) { st.raf = 0; return; }
  if (g.paused) { st.raf = 0; return; }   // 暫停：停止迴圈（繼續時 setPaused(false) 會重新 startLoop）
  const raw = Math.min(0.25, (ts - st.last) / 1000 || 0.016), dt = Math.min(0.033, raw);
  st.last = ts;
  // 閃光用真實時間消退（不受 dt 上限與慢動作影響），掉幀時也不會把畫面蓋住好幾秒
  if (g.flashW > 0) g.flashW = Math.max(0, g.flashW - raw * 2.2);
  // 效能偵測：連續偏慢就切換省效能繪製，恢復順暢後再切回來
  st.fpsEma = (st.fpsEma || 0.016) * 0.92 + raw * 0.08; PERF_LITE = st.fpsEma > 0.026 || (g.balls && g.balls.length > 24);
  update(dt); draw(); Music.sync(g);
  st.raf = requestAnimationFrame(loop);
}
function startLoop() { if (st.raf) return; st.last = performance.now(); st.raf = requestAnimationFrame(loop); }
function stopLoop() { if (st.raf) cancelAnimationFrame(st.raf); st.raf = 0; }
function setAim(p) {
  const a = Math.atan2(SHOOT_Y - p.y, p.x - W / 2), lo = 12 * Math.PI / 180, hi = 168 * Math.PI / 180;
  st.g.aim = Math.max(lo, Math.min(hi, a));
}
function fire() {
  const g = st.g;
  if (!g || g.firing || g.upgrading || g.over || g.paused) return;
  g.firing = true; g.fireAngle = g.aim; g.queue = g.loadout.slice(); g.fireT = 0; g.volleyT = 0; g.combo = 0; sfx(180, 0.08, "sine", 0.06);
  for (let i = 0; i < g.storm * 2; i++) { const live = g.enemies.filter(e => !e.dead); if (!live.length) break; const t = live[Math.floor(Math.random() * live.length)], c = enCenter(t); g.bolts.push({ x1: c.x + Math.random() * 40 - 20, y1: CEIL, x2: c.x, y2: c.y, t: 0.25 }); damage(g, t, 2 + Math.floor(g.level / 2)); }
}
/* ===== 📋 目前效果與技能面板（局內）===== */
function fxDesc(k, n) {
  if (k === "pierce") return dc(`穿透 ${n}：穿過 ${n} 個敵人才會反彈`, `Pierce ${n}: passes through ${n} enemies before bouncing`);
  if (k === "splash") return dc(`爆裂 ${n}：波及周圍 ${n >= 3 ? 2 : 1} 格，${n >= 2 ? "100%" : "60%"} 傷害`, `Burst ${n}: hits enemies within ${n >= 3 ? 2 : 1} cell(s), ${n >= 2 ? "100%" : "60%"} damage`);
  return dc(`連鎖 ${n}：電弧最多彈 ${2 * n} 個敵人（範圍 ${150 + 25 * (n - 1)}），${n >= 2 ? "100%" : "70%"} 傷害`, `Chain ${n}: arcs to up to ${2 * n} enemies (range ${150 + 25 * (n - 1)}), ${n >= 2 ? "100%" : "70%"} damage`);
}
function infoHtml(g) {
  const sec = t => `<div style="font-weight:700;color:var(--gold-bright);margin:8px 0 4px;">${t}</div>`;
  const rows = [], grp = new Map();
  g.loadout.forEach(d => { const key = d.name + "|" + fxText(d); const o = grp.get(key); if (o) o.n++; else grp.set(key, { d, n: 1 }); });
  grp.forEach(({ d, n }) => {
    const lines = [];
    for (const k of ["pierce", "splash", "chain"]) {
      const base = (d.fx && d.fx[k]) || 0, bonus = g[k + "B"] || 0, eff = Math.min(FX_CAP, base + bonus);
      if (eff > 0) lines.push(`<div>${fxDesc(k, eff)}${bonus > 0 && eff > base ? ` <span style="opacity:.65;">(${dc("含強化", "incl. upgrade")} +${eff - base})</span>` : ""}</div>`);
    }
    (d.sp || []).forEach(k => { if (SP[k]) lines.push(`<div>✧ <b>${dc(SP[k][0], SP[k][1])}</b>：${dc(SP[k][2], SP[k][3])}</div>`); });
    if (!lines.length) lines.push(`<div style="opacity:.7;">${dc("無特殊效果，穩定單體傷害", "No special effect — steady single-target hits")}</div>`);
    rows.push(`<div style="border:1px solid ${RC[d.rarity] || RC.common};border-radius:8px;padding:6px 8px;margin-bottom:6px;text-align:left;font-size:12px;line-height:1.55;"><b style="font-size:13px;">${d.icon || "🃏"} ${d.name}${d.tier ? " ✦" + d.tier : ""}${n > 1 ? " ×" + n : ""}</b> <span style="opacity:.75;">${dc("傷害", "Dmg")} ×${Math.round((d.mult || 1) * 100) / 100}</span>${lines.join("")}</div>`);
  });
  const f2 = x => Math.round(x * 100) / 100, b = [];
  if (g.dmgBonus > 0) b.push(dc(`＋${g.dmgBonus} 傷害：所有彈珠每次命中多 ${g.dmgBonus} 點`, `+${g.dmgBonus} damage on every hit`));
  if (g.dmgMul !== 1) b.push(dc(`🔥 狂暴：所有傷害 ×${f2(g.dmgMul)}`, `🔥 Rage: all damage ×${f2(g.dmgMul)}`));
  if (g.crit > 0) b.push(dc(`💥 暴擊率 ${Math.round(g.crit * 100)}%（雙倍傷害）`, `💥 Crit chance ${Math.round(g.crit * 100)}% (double damage)`));
  if (g.spd !== BASE_SPEED) b.push(dc(`💨 彈珠速度 ×${f2(g.spd / BASE_SPEED)}`, `💨 Ball speed ×${f2(g.spd / BASE_SPEED)}`));
  if (g.pierceB) b.push(dc(`🏹 貫穿：所有彈珠穿透 +${g.pierceB}`, `🏹 Skewer: all balls pierce +${g.pierceB}`));
  if (g.splashB) b.push(dc(`💣 衝擊波：所有彈珠爆裂 +${g.splashB}`, `💣 Shockwave: all balls burst +${g.splashB}`));
  if (g.chainB) b.push(dc(`⚡ 導電：所有彈珠連鎖 +${g.chainB}`, `⚡ Conduct: all balls chain +${g.chainB}`));
  if (g.venom) b.push(dc("☠ 毒霧：所有彈珠命中附帶 1 層劇毒", "☠ Miasma: every ball poisons on hit"));
  if (g.storm > 0) b.push(dc(`⚡ 落雷：每次發射天降 ${g.storm * 2} 道雷`, `⚡ Storm: ${g.storm * 2} lightning bolts per volley`));
  if ((g.cmb || 15) < 15) b.push(dc(`🔥 連擊：每 ${g.cmb} 次連擊 +1 傷害`, `🔥 Combo: +1 damage every ${g.cmb} hits`));
  if (g.regen > 0) b.push(dc(`🌿 再生：每輪結束回復 ${g.regen} 點血量`, `🌿 Regen: heal ${g.regen} HP each volley`));
  if (g.shield > 0) b.push(dc(`🛡 護盾：可抵擋 ${g.shield} 次傷害`, `🛡 Ward: blocks the next ${g.shield} hit(s)`));
  if (g.pit > PIT_ROW) b.push(dc(`加高護欄：深坑線下移 ${g.pit - PIT_ROW} 排`, `Barrier: pit line moved down ${g.pit - PIT_ROW} row(s)`));
  if (g.skip > 0) b.push(dc(`時間靜止：下 ${g.skip} 輪敵人不前進`, `Time Stop: enemies skip the next ${g.skip} advance(s)`));
  if (g.goldMul !== 1) b.push(dc(`💰 金幣 ×${f2(g.goldMul)}`, `💰 Gold ×${f2(g.goldMul)}`));
  if (g.xpMul !== 1) b.push(dc(`🏴 經驗 ×${f2(g.xpMul)}`, `🏴 XP ×${f2(g.xpMul)}`));
  if (g.revives > 0) b.push(dc(`💫 復活 ${g.revives} 次`, `💫 ${g.revives} revive(s)`));
  if (g.rerolls > 0) b.push(dc(`🎲 重抽選項 ${g.rerolls} 次`, `🎲 ${g.rerolls} reroll(s)`));
  if (g.affix && AFFIX_BY[g.affix]) { const af = AFFIX_BY[g.affix]; b.unshift(`${af.ic} <b>${dc(af.zh, af.en)}</b>：${dc(af.dz, af.de)}`); }
  const buffs = b.length ? b.map(t => `<div style="text-align:left;font-size:12px;line-height:1.6;">• ${t}</div>`).join("") : `<div style="font-size:12px;opacity:.7;">${dc("本局還沒有獲得任何強化技能", "No run upgrades yet")}</div>`;
  return `<div style="text-align:center;font-size:12px;opacity:.85;">${dc("第", "Floor ")} <b>${g.floor}</b> ${dc("層", "")} · Lv <b>${g.level}</b> · ❤ <b>${Math.round(g.hp)}/${Math.round(g.maxHp)}</b></div>` +
    sec(`🎱 ${dc("彈珠", "Balls")} (${g.loadout.length})`) + rows.join("") + sec(`✨ ${dc("本局技能／強化", "Run skills / upgrades")}`) + buffs;
}
function openInfo() {
  const g = st.g;
  if (!g || g.over || !st.running || !st.ov) return;
  if (g.upgrading) return void ac(dc("請先選好強化，再查看目前效果", "Pick your upgrade first, then check your effects"));
  const wasPaused = !!g.paused;
  if (!wasPaused) { g.paused = true; g.aiming = false; const pb = document.getElementById("bp-pause"); if (pb) pb.textContent = "▶"; }
  st.ov.style.display = "flex";
  st.ov.innerHTML = `<div style="text-align:center;font-size:18px;font-weight:700;color:var(--gold-bright);">📋 ${dc("目前效果與技能", "Current effects & skills")}</div>` +
    `<div style="flex:1;min-height:0;overflow:auto;">${infoHtml(g)}</div>` +
    `<button class="btn" id="bp-info-close">${wasPaused ? dc("返回", "Back") : "▶ " + dc("繼續遊戲", "Resume")}</button>`;
  const c = st.ov.querySelector("#bp-info-close");
  if (c) c.onclick = () => { if (wasPaused) showPauseUi(g); else setPaused(false); };
}
/* ===== ⏸ 暫停 ===== */
function showPauseUi(g) {
  if (!st.ov) return;
  const left = Math.max(0, Math.floor(MAX_RUN_SEC - (Date.now() - g.startedAt) / 1000)), lm = Math.floor(left / 60);
  st.ov.style.display = "flex";
  st.ov.innerHTML = `<div style="text-align:center;font-size:22px;font-weight:700;color:var(--gold-bright);">⏸ ${dc("遊戲暫停", "Paused")}</div>` +
    `<div style="text-align:center;font-size:13px;line-height:1.8;">${dc("第", "Floor ")} <b>${g.floor}</b> ${dc("層", "")} · Lv <b>${g.level}</b> · ❤ <b>${Math.round(g.hp)}/${Math.round(g.maxHp)}</b> · ${dc("擊殺", "Kills")} <b>${g.kills}</b></div>` +
    `<div style="text-align:center;font-size:11px;opacity:.7;line-height:1.6;">${dc(`暫停期間仍會計入單局時間，剩餘約 ${lm} 分鐘，超過這局會作廢。`, `Paused time still counts toward the run limit — about ${lm} min left, after that the run is void.`)}</div>` +
    `<button class="btn" id="bp-resume">▶ ${dc("繼續遊戲", "Resume")}</button>` +
    `<button class="btn small secondary" id="bp-pause-info">📋 ${dc("目前效果與技能", "Effects & skills")}</button>` +
    `<button class="btn small secondary" id="bp-pause-quit">${dc("放棄本局", "Abandon")}</button>`;
  const r = st.ov.querySelector("#bp-resume"); if (r) r.onclick = () => setPaused(false);
  const pi = st.ov.querySelector("#bp-pause-info"); if (pi) pi.onclick = openInfo;
  const q = st.ov.querySelector("#bp-pause-quit"); if (q) q.onclick = () => { const b = document.getElementById("bp-quit"); if (b) b.click(); };
}
function setPaused(on) {
  const g = st.g;
  if (!g || g.over || !st.running) return;
  on = !!on;
  if (on === !!g.paused) return;
  if (on && g.upgrading) return;   // 選強化時遊戲本來就是停住的
  g.paused = on; g.aiming = false;
  const b = document.getElementById("bp-pause"); if (b) b.textContent = on ? "▶" : "⏸";
  if (on) showPauseUi(g);
  else { if (st.ov) { st.ov.style.display = "none"; st.ov.innerHTML = ""; } startLoop(); }
}
function togglePause() {
  const g = st.g;
  if (!g || g.over || !st.running) return;
  if (g.upgrading) return void ac(dc("正在選強化，遊戲本來就是停住的", "Choosing an upgrade — the game is already frozen"));
  setPaused(!g.paused);
}
function buildStage() {
  const dpr = Math.min(2, Math.max(1.5, window.devicePixelRatio || 1)); // 手機 DPR=3 時像素量是 2 倍的 2.25 倍，填充率會爆；上限壓在 2
  const wrap = document.createElement("div");
  wrap.style.cssText = "position:relative;width:100%;max-width:420px;margin:0 auto;";
  const cv = document.createElement("canvas");
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  cv.style.cssText = `width:100%;display:block;aspect-ratio:${W}/${H};touch-action:none;border:1px solid rgba(201,162,74,.4);border-radius:12px;box-shadow:0 10px 36px rgba(0,0,0,.55),0 0 28px rgba(139,107,209,.18);`;
  const ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  const ov = document.createElement("div");
  ov.style.cssText = "position:absolute;inset:0;display:none;flex-direction:column;justify-content:center;gap:8px;padding:16px;background:rgba(10,5,20,.84);border-radius:10px;";
  wrap.appendChild(cv); wrap.appendChild(ov);
  const pos = ev => { const r = cv.getBoundingClientRect(); return { x: (ev.clientX - r.left) * W / r.width, y: (ev.clientY - r.top) * H / r.height }; };
  cv.addEventListener("pointerdown", ev => { const g = st.g; if (!g || g.firing || g.upgrading || g.over || g.paused) return; g.aiming = true; try { cv.setPointerCapture(ev.pointerId); } catch (e) {} setAim(pos(ev)); ev.preventDefault(); });
  cv.addEventListener("pointermove", ev => { const g = st.g; if (g && g.aiming) { setAim(pos(ev)); ev.preventDefault(); } });
  const up = ev => { const g = st.g; if (!g || !g.aiming) return; g.aiming = false; if (ev.type === "pointerup") fire(); };
  cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
  st.wrap = wrap; st.canvas = cv; st.ctx = ctx; st.ov = ov;
}
async function startRun(host) {
  const p = zl.player;
  if (!p || st.running || st.settling || st.starting) return;
  if (!(await mgFresh("ballpit"))) { ac(dc("塔羅彈珠目前由 GM 暫時關閉", "Tarot Ball Pit is temporarily closed by the GM")); Bu(); return; }
  if (playsRemaining(p) <= 0 && !ku()) { ac(dc("今天的塔羅彈珠次數已經用完了，明天再來吧！", "No Ball Pit plays left today, come back tomorrow!")); return; }
  st.starting = true;
  let r = null;
  try { r = await claimStart(); } catch (e) { r = null; }
  st.starting = false;
  if (!r || r.ok === false) {
    ac(r && r.reason === "noplays" ? dc("今天的塔羅彈珠次數已經用完了，明天再來吧！", "No Ball Pit plays left today, come back tomorrow!") : dc("開局失敗，請稍後再試", "Could not start the run, please try again"));
    renderTab(host); return;
  }
  st.g = newGame(zl.player); st.lastResult = null; st.running = true; Music.start();
  buildStage();
  showAffixPicker();
  renderTab(host);
}

/* ===== 畫面 ===== */
function ensureStyles() {
  if (document.getElementById("bp-css")) return;
  const s = document.createElement("style"); s.id = "bp-css";
  s.textContent = `.bp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:6px;max-height:230px;overflow:auto;margin:8px 0;padding:2px}
.bp-pick{display:flex;flex-direction:column;gap:2px;padding:6px 8px;border:1px solid var(--line);border-radius:8px;cursor:pointer;font-size:12px;background:rgba(255,255,255,.03);user-select:none}
.bp-pick.sel{outline:2px solid var(--gold-bright);background:rgba(232,196,104,.10)}
.bp-pick b{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bp-row{display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--line);border-radius:10px;margin:6px 0}
.bp-chip{display:inline-block;padding:3px 9px;margin:2px;border:1px solid var(--line);border-radius:999px;font-size:12px}
.vol{display:flex;gap:16px;align-items:center;margin-top:10px;padding:6px 10px;border:1px solid var(--line);border-radius:10px;background:rgba(0,0,0,.2);font-size:13px}
.vol label{display:flex;align-items:center;gap:8px;flex:1;min-width:0}
.vol input{flex:1;min-width:0;accent-color:var(--gold-bright)}`;
  document.head.appendChild(s);
}
function legendHtml() {
  return ["common", "uncommon", "rare", "epic"].map(k => `<span style="color:${RC[k]};">● ${dc(TYPE_INFO[k].zh, TYPE_INFO[k].en)}</span> <span style="opacity:.75;">${dc(TYPE_INFO[k].dz, TYPE_INFO[k].de)}</span>`).join("<br>") + `<br><span style="opacity:.75;">${dc("👑 每 10 層出 BOSS · 🔴 紅色徽章的怪會攻擊你（數字是傷害，閃紅框＝本輪結束就出手）· 💣 炸彈怪會連爆 · 💰 寶箱怪金幣豐厚 · 連擊每 15 下全彈珠 +1 傷害 · ✧ 每張卡牌有專屬特效，融合會合併", "👑 Boss every 10 floors · 🔴 Red-badge enemies attack you (number = damage, flashing = strikes after this volley) · 💣 Bombs chain-explode · 💰 Chests pay big · every 15 combo = +1 dmg · ✧ Each card has its own effect; fusing merges them")}</span>`;
}
function resultHtml() {
  const r = st.lastResult;
  if (st.settling) return `<p class="sub">${dc("結算中…", "Settling…")}</p>`;
  if (!r) return "";
  const head = `${r.win ? dc("🏆 通關！", "🏆 Cleared!") : (r.slain ? dc("☠ 被擊倒", "☠ Slain") : dc("☠ 被逼進深坑", "☠ Overrun"))} · ${dc(`第 ${r.floor} 層 · 擊殺 ${r.kills} · 最高連擊 ${r.combo || 0}`, `Floor ${r.floor} · ${r.kills} kills · best combo ${r.combo || 0}`)}`;
  if (r.ok === false) return `<div class="panel" style="margin:8px 0;"><b>${head}</b><p class="sub">${r.reason === "noplays" ? dc("今天次數已用完，這局沒有獎勵。", "No plays left today, no reward for this run.") : (r.reason === "expired" || r.reason === "norun" || r.reason === "toofast") ? dc("這局無法結算（超時或紀錄遺失），沒有獎勵。", "This run could not be settled (timed out or record lost), no reward.") : dc("結算失敗，請稍後再試。", "Settlement failed, please try again.")}</p></div>`;
  const chips = Object.keys(r.outBag || {}).map(k => { const l = itemLabel(k); return `<span class="bp-chip">${l.icon} ${l.name} ×${r.outBag[k]}</span>`; }).join("");
  const capNote = (r.floorCapped || r.goldCapped) ? `<div class="sub">${dc("（已套用防作弊上限）", "(anti-cheat cap applied)")}</div>` : "";
  const lbNote = r.lbFloor ? `<div class="sub" style="margin-top:4px;">🏆 ${dc(`排行榜成績：${(r.score || 0).toLocaleString()} 分（${r.lbWin ? "通關" : "第 " + r.lbFloor + " 層"}）· ${fmtTime(r.elapsedMs)}`, `Leaderboard entry: ${(r.score || 0).toLocaleString()} pts (${r.lbWin ? "cleared" : "floor " + r.lbFloor}) · ${fmtTime(r.elapsedMs)}`)}${r.lbFloor < r.floor ? dc("（受排行榜速度上限限制）", " (limited by the leaderboard speed cap)") : ""}</div>` : "";
  return `<div class="panel" style="margin:8px 0;"><b>${head}</b>
    <div style="margin:6px 0;">💠 <b style="color:var(--gold-bright);">+${(r.gold + (r.milestone || 0)).toLocaleString()}</b> ${dc("彈珠幣", "pit coins")}${r.milestone ? dc(`（含里程碑 ${r.milestone.toLocaleString()}）`, ` (incl. milestone ${r.milestone.toLocaleString()})`) : ""} · 📦 <b>+${r.mats}</b> ${dc("材料", "mats")}</div>
    <div style="margin:6px 0;">✦ ${r.outCoins ? `<b style="color:var(--gold-bright);">+${r.outCoins.toLocaleString()}</b> ${dc("正式版金幣（今日新達成層數）", "main-game coins (new floors today)")}` : `<span class="sub">${dc("今天沒有再創新高層數，沒有正式版獎勵", "No new best floor today, no main-game reward")}</span>`}</div>
    ${(r.bossFirst || []).map(b => `<div style="margin:6px 0;">👑 ${dc(`首殺第 ${b.k} 隻 BOSS`, `First kill: boss #${b.k}`)}：💠 +${b.coins} · 📦 +${b.mats} · ${b.msg}</div>`).join("")}
    <div>${chips}</div>${capNote}${lbNote}</div>`;
}
function tabsHtml() {
  const p = zl.player, T = [["play", "🎱 " + dc("出戰", "Play")], ["cards", "🃏 " + dc("卡牌", "Cards")], ["forge", "⚒ " + dc("強化", "Forge")]];
  return `<div style="display:flex;gap:6px;margin-bottom:8px;">${T.map(([k, l]) => `<button class="btn small${st.tab === k ? "" : " secondary"}" style="flex:1;" data-bp-tab="${k}">${l}</button>`).join("")}</div><div class="sub" style="margin:0 0 8px;">💠 <b style="color:var(--gold-bright);">${(p.bpCoins || 0).toLocaleString()}</b> ${dc("彈珠幣", "pit coins")} · 📦 ${itemTotal(p)} ${dc("材料", "mats")}<br>🌙 ${dc("階段", "Stage")} ${stageOf(p) + 1}/4 ${dc(STAGE_ZH[stageOf(p)], STAGE_EN[stageOf(p)])} · 🏆 ${dc("最高層數", "Best floor")} ${p.bpBestFloor || 0} · ${dc("出戰", "Runs")} ${p.bpRuns || 0}${stageHint(p)}</div>`;
}
function cardsHtml() {
  const p = zl.player, items = itemTotal(p), ids = Object.keys(v).sort((a, b) => (RK[v[b].rarity] || 0) - (RK[v[a].rarity] || 0) || String(v[a].name).localeCompare(String(v[b].name)));
  const rows = ids.map(id => {
    const c = v[id], own = (p.bpCards[id] || 0) > 0, lv = cardLv(p, id), col = RC[c.rarity] || RC.common;
    const sp = [spOf(id)].concat(lv >= 8 && stageOf(p) >= 3 ? [spOf2(id)] : []).map(k => dc(SP[k][0], SP[k][1])).join("·");
    const nxt = lv >= CARD_MAX ? dc("已滿級", "MAX") : lv + 1 === 5 ? dc("→ 類型特效 +1", "→ type effect +1") : lv + 1 === 8 ? dc("→ 解鎖第二特效", "→ unlocks 2nd effect") : lv + 1 === 12 ? dc("→ 第三特效＋類型再強化", "→ 3rd effect + type boost") : dc("→ 傷害 +15%", "→ +15% dmg");
    const cc = cardCost(id, lv), mat = Math.ceil(lv / 2), ok = p.bpCoins >= cc && items >= mat;
    return `<div class="bp-row" style="border-color:${col};${own ? "" : "opacity:.45;"}"><div style="flex:1;min-width:0;"><b style="color:${col};">${c.icon || "🃏"} ${c.name}</b> <span style="font-size:12px;">Lv${lv}/${CARD_MAX}</span><br><span style="font-size:11px;opacity:.8;">✧${sp} · ${dc("傷害", "Dmg")}×${(1 + 0.15 * (lv - 1)).toFixed(2)} · ${own ? (cardOpen(p, id) ? nxt : dc(`🔒 階段 ${RAR_TIER[c.rarity] + 1}（${STAGE_ZH[RAR_TIER[c.rarity]]}）解鎖出戰`, `🔒 Stage ${RAR_TIER[c.rarity] + 1} (${STAGE_EN[RAR_TIER[c.rarity]]}) to use`)) : dc("未擁有", "Locked")}</span></div>${own && lv < CARD_MAX ? `<button class="btn small" data-bp-up="${id}" ${ok ? "" : "disabled"}>💠${cc} · 📦${mat}</button>` : ""}</div>`;
  }).join("");
  return `<div id="bp-root" class="panel">${tabsHtml()}<p class="sub">${dc("升級需要彈珠幣＋材料（📦）。Lv5 強化類型特效，Lv8 解鎖第二個專屬特效，Lv12 解鎖第三個並再強化類型。抽到重複的卡牌會直接升 1 級（滿級退 150 彈珠幣）。這些卡牌是彈珠專用的，跟你的真實卡牌收藏無關。", "Upgrades cost pit coins + mats (📦). Lv5 boosts the type effect, Lv8 unlocks a 2nd card effect. Duplicate draws level the card up (refund 150 at max). These are Ball Pit-only cards, separate from your real collection.")}</p><button class="btn" id="bp-draw" style="width:100%;" ${p.bpCoins < DRAW_COST ? "disabled" : ""}>${dc("🎴 抽卡", "🎴 Draw")} 💠${DRAW_COST}</button>${st.drawMsg ? `<p class="sub" style="color:var(--gold-bright);">${st.drawMsg}</p>` : ""}<div style="margin-top:8px;">${rows}</div></div>`;
}
function forgeHtml() {
  const p = zl.player, M = p.bpMeta || {};
  const rows = META.map(m => {
    const lv = M[m.k] || 0, cc = metaCost(m, lv), lk = (META_TIER[m.k] || 0) > stageOf(p);
    return `<div class="bp-row"${lk ? ' style="opacity:.45;"' : ""}><div style="flex:1;min-width:0;"><b>${m.ic} ${dc(m.zh, m.en)}</b> <span style="font-size:12px;">Lv${lv}/${m.max}</span><br><span style="font-size:11px;opacity:.8;">${dc(m.dz, m.de)}</span></div>${lk ? `<span style="font-size:12px;color:var(--gold-bright);">🔒 ${dc(`階段 ${META_TIER[m.k] + 1}`, `Stage ${META_TIER[m.k] + 1}`)}</span>` : lv < m.max ? `<button class="btn small" data-bp-meta="${m.k}" ${p.bpCoins >= cc ? "" : "disabled"}>💠${cc}</button>` : `<span style="font-size:12px;color:var(--gold-bright);">MAX</span>`}</div>`;
  }).join("");
  return `<div id="bp-root" class="panel">${tabsHtml()}<p class="sub">${dc("永久強化：每局開始都會生效。", "Permanent upgrades applied at the start of every run.")}</p>${rows}</div>`;
}
function boardPanelHtml() {
  return `<div class="panel"><h2>🏆 ${dc("今日排行榜", "Today's Leaderboard")}</h2><p class="sub">${dc("每天地圖固定（全服同一張，上限 60 層）。每人取當天最高分：每清 1 層 100 分，60 層全清再加通關 1000 分、剩餘血量（最多 500）與速度分。同分比用時短；明天結算出「彈珠大師」封號。", "Same map for everyone today (60-floor cap). Best score of the day: 100 per floor cleared; clearing all 60 adds 1000 + remaining HP (up to 500) + a speed bonus. Ties: faster time. The \"Ball Pit Master\" title is settled tomorrow.")}</p><p class="sub">${rankShardHint(RANK_SHARDS)}</p><div id="bp-standings-body">${standingsHtml()}</div></div>`;
}
function panelHtml() {
  const showBoard = !st.running && st.tab === "play";
  return panelHtmlCore() + (showBoard ? boardPanelHtml() : "") + (ku() && !st.running ? gmCollapsibleWrap(gmPanelHtml()) : "");
}
/* ===== GM 面板（調整數值、測試工具）===== */
/* ===== GM 發彈珠幣給指定玩家（寫入對方存檔＋發一則通知；數量可為負數＝扣除，最低扣到 0）===== */
async function gmGrantCoins(nickRaw, amt) {
  const nick = String(nickRaw || "").trim();
  if (!nick) return { ok: 0, why: "nonick" };
  if (!Number.isInteger(amt) || amt === 0 || Math.abs(amt) > 1e6) return { ok: 0, why: "amount" };
  const { player } = await Gl(nick);
  if (!player) return { ok: 0, why: "nouser" };
  const real = player.nickname; let after = 0;
  const f = await Wl(real, p => { bpNorm(p); p.bpCoins = Math.max(0, Math.floor(p.bpCoins) + amt); after = p.bpCoins; });
  if (!f) return { ok: 0, why: "fail" };
  if (String(real).toLowerCase() === String(zl.nickname || "").toLowerCase()) zl.player = f;
  if (amt > 0) { try { await wd(real, zl.nickname, "gm_grant", { grantKind: "bpCoins", label: dc("彈珠幣", "Ball Pit coins"), qty: amt }); } catch (e) {} }
  return { ok: 1, real, after };
}
function gmPanelHtml() {
  const f = (id, label, val, extra) => `<div><label>${label}</label><input type="number" id="${id}" value="${val}" ${extra || ""} style="width:100px;" /></div>`;
  return `<div class="panel">
    <h2>🎱 ${dc("塔羅彈珠控制", "Tarot Ball Pit Control")}</h2>
    <p class="sub">${dc("調整彈珠的每日次數、防作弊上限，以及「對外獎勵」（每天依新達成層數發正式版金幣／成品）。", "Tune daily plays, anti-cheat caps and the main-game reward (coins/items for new best floors each day).")}</p>
    <div class="form-row">
      ${f("bp-gm-plays", dc("每日次數（已固定為 5，不再生效）", "Daily plays (fixed at 5)"), DAILY_PLAYS, 'min="1"')}
      ${f("bp-gm-maxrun", dc("單局最長秒數", "Max run (sec)"), MAX_RUN_SEC, 'min="60"')}
      ${f("bp-gm-minfloor", dc("每層最短秒數", "Min sec / floor"), MIN_SEC_PER_FLOOR, 'min="0.5" step="0.1"')}
      ${f("bp-gm-lbfloor", dc("排行榜每層最短秒數", "Leaderboard min sec / floor"), LB_MIN_SEC_PER_FLOOR, 'min="0.5" step="0.1"')}
      ${f("bp-gm-cap", dc("每秒彈珠幣上限", "Max pit coins / sec"), MAX_GOLD_PER_SEC, 'min="1"')}
      ${f("bp-gm-ms", dc("里程碑最高層數", "Milestone floor cap"), MILESTONE_FLOOR_CAP, 'min="0"')}
      ${f("bp-gm-hrate", dc("後段血量成長率（1.16＝每層 +16%）", "Late HP growth / floor"), HARD_RATE, 'min="1" max="1.5" step="0.01"')}
      ${f("bp-gm-hfrom", dc("從第幾層開始加速成長", "Hard ramp starts at floor"), HARD_FROM, 'min="1"')}
      ${f("bp-gm-itemroll", dc("每 N 彈珠幣 +1 材料", "Pit coins per mat"), GOLD_PER_ITEM_ROLL, 'min="20"')}
      ${f("bp-gm-startcoins", dc("起始彈珠幣", "Starting pit coins"), START_COINS, 'min="0"')}
      <div><label>${dc("每局詞綴", "Run affixes")}</label><select id="bp-gm-affix" style="width:100px;"><option value="1"${AFFIX_ON ? " selected" : ""}>${dc("開", "On")}</option><option value="0"${AFFIX_ON ? "" : " selected"}>${dc("關", "Off")}</option></select></div>
    </div>
    <div class="form-row">
      ${f("bp-gm-outcoin", dc("對外：每層正式金幣", "Main coins / new floor"), OUT_COIN_PER_FLOOR, 'min="0"')}
      ${f("bp-gm-outcap", dc("對外：每日層數上限", "Daily floor cap for reward"), OUT_FLOOR_CAP, 'min="0"')}
      ${f("bp-gm-outitem", dc("對外：每 N 層 1 件成品", "Floors per main item"), OUT_FLOORS_PER_ITEM, 'min="1"')}
      ${f("bp-gm-outmed", dc("中型成品機率（0~1）", "Medium item chance"), ITEM_MEDIUM_CHANCE, 'min="0" max="1" step="0.01"')}
      ${rankShardGmHtml("bp", RANK_SHARDS)}
    </div>
    <div class="form-row" style="align-items:flex-end;">
      <div><label>${dc("發彈珠幣：玩家暱稱", "Grant coins: player nickname")}</label><input type="text" id="bp-gm-gnick" style="width:160px;" /></div>
      <div><label>${dc("數量（負數＝扣除）", "Amount (negative = deduct)")}</label><input type="number" id="bp-gm-gamt" value="1000" step="1" style="width:110px;" /></div>
      <button class="btn small" id="bp-gm-gsend">${dc("發放彈珠幣", "Grant coins")}</button>
    </div>
    <div class="form-row" style="align-items:flex-end;">
      <div><label>${dc("移除今日排行榜紀錄（玩家暱稱）", "Remove a player's entry from today's board (nickname)")}</label><input type="text" id="bp-gm-rmnick" style="width:160px;" /></div>
      <button class="btn small secondary" id="bp-gm-rm">${dc("移除", "Remove")}</button>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;">
      <button class="btn small" id="bp-gm-save">${dc("儲存設定", "Save settings")}</button>
      <button class="btn small secondary" id="bp-gm-grant">${dc("+5000 彈珠幣（測試）", "+5000 pit coins (test)")}</button>
      <button class="btn small secondary" id="bp-gm-all">${zl.player.bpAll ? dc("取消全解鎖", "Undo unlock-all") : dc("全部解鎖（測試）", "Unlock all (test)")}</button>
      <button class="btn small secondary" id="bp-gm-reset">${dc("重置我的彈珠存檔", "Reset my Ball Pit save")}</button>
    </div>
  </div>`;
}
function wireGmPanel(e) {
  const q = id => e.querySelector(id);
  const save = q("#bp-gm-save");
  if (save) save.onclick = async () => {
    const n = (id, lo, hi) => { const x = parseFloat(q(id).value); return isNaN(x) || x < lo || (hi != null && x > hi) ? null : x; };
    const set = (v1, fn) => { if (v1 != null) fn(v1); };
    set(n("#bp-gm-plays", 1), x => { DAILY_PLAYS = Math.round(x); });
    set(n("#bp-gm-maxrun", 60), x => { MAX_RUN_SEC = x; });
    set(n("#bp-gm-minfloor", 0.5), x => { MIN_SEC_PER_FLOOR = x; });
    set(n("#bp-gm-lbfloor", 0.5), x => { LB_MIN_SEC_PER_FLOOR = x; });
    set(n("#bp-gm-cap", 1), x => { MAX_GOLD_PER_SEC = x; });
    set(n("#bp-gm-ms", 0), x => { MILESTONE_FLOOR_CAP = Math.round(x); });
    set(n("#bp-gm-hrate", 1), x => { HARD_RATE = Math.min(1.5, x); });
    set(n("#bp-gm-hfrom", 1), x => { HARD_FROM = Math.round(x); });
    set(n("#bp-gm-itemroll", 20), x => { GOLD_PER_ITEM_ROLL = x; });
    set(n("#bp-gm-startcoins", 0), x => { START_COINS = Math.round(x); });
    if (q("#bp-gm-affix")) AFFIX_ON = q("#bp-gm-affix").value !== "0";
    set(n("#bp-gm-outcoin", 0), x => { OUT_COIN_PER_FLOOR = x; });
    set(n("#bp-gm-outcap", 0), x => { OUT_FLOOR_CAP = Math.round(x); });
    set(n("#bp-gm-outitem", 1), x => { OUT_FLOORS_PER_ITEM = Math.round(x); });
    set(n("#bp-gm-outmed", 0, 1), x => { ITEM_MEDIUM_CHANCE = x; });
    RANK_SHARDS = rankShardGmRead(e, "bp", RANK_SHARDS);
    await saveSettings();
    ac(dc("塔羅彈珠設定已儲存", "Ball Pit settings saved"));
  };
  const gsend = q("#bp-gm-gsend");
  if (gsend) gsend.onclick = async () => {
    const nick = (q("#bp-gm-gnick").value || "").trim(), amt = parseInt(q("#bp-gm-gamt").value, 10);
    if (!nick) { ac(dc("請輸入玩家暱稱", "Enter a player nickname")); return; }
    if (!Number.isInteger(amt) || amt === 0 || Math.abs(amt) > 1e6) { ac(dc("數量要是不為 0 的整數，絕對值最多 1,000,000", "Amount must be a non-zero integer, at most 1,000,000 in absolute value")); return; }
    if (!(await ic(dc(`${amt > 0 ? "發放" : "扣除"} ${Math.abs(amt).toLocaleString()} 彈珠幣給 ${nick}？`, `${amt > 0 ? "Grant" : "Deduct"} ${Math.abs(amt).toLocaleString()} pit coins ${amt > 0 ? "to" : "from"} ${nick}?`)))) return;
    gsend.disabled = true;
    try {
      const r = await gmGrantCoins(nick, amt);
      if (r.ok) { ac(dc(`已${amt > 0 ? "發放" : "扣除"} ${Math.abs(amt).toLocaleString()} 彈珠幣（${r.real} 現有 ${r.after.toLocaleString()}）⚡`, `${amt > 0 ? "Granted" : "Deducted"} ${Math.abs(amt).toLocaleString()} pit coins (${r.real} now has ${r.after.toLocaleString()}) ⚡`)); if (String(r.real).toLowerCase() === String(zl.nickname || "").toLowerCase()) renderTab(e); }
      else ac(r.why === "nouser" ? dc("找不到這位玩家", "Player not found") : r.why === "amount" ? dc("數量不正確", "Invalid amount") : dc("發放失敗，請稍後再試", "Grant failed, please try again"));
    } catch (err) { ac(dc("發放失敗，請稍後再試", "Grant failed, please try again")); }
    gsend.disabled = false;
  };
  const rm = q("#bp-gm-rm");
  if (rm) rm.onclick = async () => {
    const nick = (q("#bp-gm-rmnick").value || "").trim();
    if (!nick) return;
    try { await a.delete(scoreKey(ys(), nick)); st.standingsFor = null; ac(dc("已移除（若該玩家今天沒有紀錄則無變化）", "Removed (no change if the player had no entry today)")); renderTab(e); }
    catch (err) { ac(dc("移除失敗", "Remove failed")); }
  };
  const grant = q("#bp-gm-grant");
  if (grant) grant.onclick = async () => { const f = await Wl(zl.nickname, p => { bpNorm(p); p.bpCoins += 5000; }); if (f) { zl.player = f; renderTab(e); } };
  const all = q("#bp-gm-all");
  if (all) all.onclick = async () => { const f = await Wl(zl.nickname, p => { p.bpAll = !p.bpAll; }); if (f) { zl.player = f; renderTab(e); } };
  const rs = q("#bp-gm-reset");
  if (rs) rs.onclick = async () => {
    if (!(await ic(dc("確定重置自己的塔羅彈珠存檔？彈珠幣、卡牌、強化、最高層數都會清空。", "Reset your own Ball Pit save? Coins, cards, upgrades and best floor are wiped.")))) return;
    const f = await Wl(zl.nickname, p => { ["bpInit", "bpCoins", "bpMats", "bpCards", "bpCardLv", "bpMeta", "bpBestFloor", "bpFloorClaimed", "bpRuns", "bpRun", "bpAll", "bpPlaysDate", "bpPlaysLeft", "bpOutDate", "bpOutFloor"].forEach(k => { delete p[k]; }); });
    if (f) { hardReset(); zl.player = f; renderTab(e); ac(dc("存檔已重置", "Save reset")); }
  };
}
function panelHtmlCore() {
  const p = zl.player;
  if (st.running) {
    return `<div class="panel" id="bp-root"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px;"><h2 style="margin-bottom:0;">🎱 ${dc("塔羅彈珠", "Tarot Ball Pit")}</h2><span><button class="btn small secondary" id="bp-info" title="${dc("目前彈珠效果與技能", "Current ball effects & skills")}">📋</button> <button class="btn small secondary" id="bp-pause" title="${dc("暫停 / 繼續（P）", "Pause / Resume (P)")}">${st.g && st.g.paused ? "▶" : "⏸"}</button> <button class="btn small secondary" id="bp-snd">${st.mute ? "🔇" : "🔊"}</button> <button class="btn small secondary" id="bp-mus" style="${st.musicOff ? "opacity:.5;" : ""}">🎵</button> <button class="btn small secondary" id="bp-quit">${dc("放棄本局", "Abandon")}</button></span></div><div class="vol"><label title="${dc("音效", "SFX")}">🔊<input type="range" id="bp-sv" min="0" max="100" value="${Math.round(st.sfxVol * 100)}" aria-label="${dc("音效音量", "SFX volume")}"></label><label title="${dc("音樂", "Music")}">🎵<input type="range" id="bp-mv" min="0" max="100" value="${Math.round(st.musVol * 100)}" aria-label="${dc("音樂音量", "Music volume")}"></label></div><div id="bp-stage-host" style="margin-top:10px;"></div><div id="bp-loadout" style="margin-top:8px;text-align:center;">${loadoutHtml()}</div><p class="sub" style="text-align:center;margin-top:8px;">${dc("按住拖曳瞄準，放開發射；每輪結束敵人往下逼近一排。", "Press & drag to aim, release to fire; enemies advance one row after each volley.")}</p></div>`;
  }
  if (st.tab === "cards") return cardsHtml();
  if (st.tab === "forge") return forgeHtml();
  const left = playsRemaining(p), cap = playsCapFor(p), own = ownedIds(p), sel = new Set(selectedIds(p));
  const picks = own.map(id => { const c = v[id], t = TYPE_INFO[ballType(c.rarity)]; return `<div class="bp-pick${sel.has(id) ? " sel" : ""}" ${cardOpen(p, id) ? `data-bp-pick="${id}"` : ""} style="border-color:${RC[c.rarity] || RC.common};${cardOpen(p, id) ? "" : "opacity:.4;"}"><b style="color:${RC[c.rarity] || RC.common};">${c.icon || "🃏"} ${c.name} Lv${cardLv(p, id)}</b><span style="opacity:.75;">${dc(t.zh, t.en)} · ×${p.bpCards[id]}</span>${cardOpen(p, id) ? "" : `<span style="color:var(--gold-bright);font-size:11px;">🔒 ${dc(`階段 ${RAR_TIER[c.rarity] + 1} 解鎖`, `Stage ${RAR_TIER[c.rarity] + 1}`)}</span>`}<span style="color:var(--gold-bright);font-size:11px;">✧${dc(SP[spOf(id)][0], SP[spOf(id)][1])}</span><span style="opacity:.65;font-size:10.5px;line-height:1.4;white-space:normal;">${dc(SP[spOf(id)][2], SP[spOf(id)][3])}</span></div>`; }).join("");
  return `<div class="panel" id="bp-root">
    ${tabsHtml()}
    <p class="sub">${dc(`把塔羅牌當彈珠：瞄準後一次射出整輪，彈珠在牆壁間反彈打怪，怪物每輪逼近一排，碰到深坑線就結束。擊殺升級可三選一強化，還能把兩顆彈珠「融合」成更強的一顆。每天的地圖固定（全服同一張、共 60 層），排行榜比分數。免費玩，每天 5 次（開局就扣次數）。賺到的彈珠幣和材料只能用在彈珠裡；另外每天依新達成的最高層數發少量正式版金幣。卡牌只當彈珠，不會被消耗。`, `Use tarot cards as balls: aim and fire a whole volley, balls bounce around smashing monsters that creep closer each volley; touch the pit line and it's over. Level up for 3-choice upgrades, including Fusion to merge two balls into a stronger one. The map is the same for everyone each day (60 floors) and the leaderboard ranks by score. Free to play, 5 runs a day, a run is spent when it starts. Pit coins and mats only work inside Ball Pit; you also get a small daily main-game coin reward for new best floors. Cards are never consumed.`)}</p>
    ${Js.ballpitChampion ? `<p class="who">${dc("今日封號", "Today's title")}: ${Ys("ballpitChampion", 13)} ${Iu(Js.ballpitChampion)}</p>` : ""}
    ${resultHtml()}
    <div style="font-size:13px;margin-top:8px;"><b>${dc("選擇出戰卡牌", "Choose your cards")}</b> <span id="bp-sel-count" style="color:var(--gold-bright);">${sel.size}/${LM()}</span> <span class="sub">${dc("（不足 3 張會補學徒彈珠）", "(padded with Apprentice balls)")}</span></div>
    ${own.length ? `<div class="bp-grid" id="bp-grid">${picks}</div>` : `<p class="sub">${dc("你還沒有任何卡牌，會用 3 顆學徒彈珠出戰。先到「卡牌」分頁抽卡吧！", "You own no cards yet — you'll go in with 3 Apprentice balls. Draw some in the Cards tab first!")}</p>`}
    <div style="font-size:12px;line-height:1.7;margin:6px 0;">${legendHtml()}</div>
    <button class="btn" id="bp-start" style="width:100%;margin-top:6px;" ${(left <= 0 && !ku()) || st.settling || st.starting ? "disabled" : ""}>${dc("🎱 開始遊戲", "🎱 Start")}</button>
    <p class="sub" style="text-align:center;margin-top:6px;">${dc(`今天剩餘次數：${left} / ${cap}`, `Plays left today: ${left} / ${cap}`)}</p>
  </div>`;
}
function wire(e) {
  const p = zl.player;
  const pz = e.querySelector("#bp-pause"); if (pz) pz.onclick = togglePause;
  const inf = e.querySelector("#bp-info"); if (inf) inf.onclick = openInfo;
  const lo = e.querySelector("#bp-loadout"); if (lo) { lo.style.cursor = "pointer"; lo.onclick = openInfo; }
  const quit = e.querySelector("#bp-quit");
  if (quit) quit.onclick = async () => {
    if (!(await ic(dc("確定放棄本局嗎？不會有獎勵，今天已扣的次數也不會退還。", "Abandon this run? No reward, and the play already spent is not refunded.")))) return;
    stopLoop(); try { Music.stop(); } catch (x) {} st.running = false; if (st.g) st.g.over = true; st.canvas = null; st.wrap = null; st.ov = null; abandonRun();
    const h = liveHost(); if (h) renderTab(h);
  };
  e.querySelectorAll("[data-bp-tab]").forEach(b => { b.onclick = () => { st.tab = b.dataset.bpTab; renderTab(e); }; });
  const lockRun = async fn => { if (st.busy) return; st.busy = true; try { await fn(); } catch (x) { ac(dc("操作失敗，請稍後再試", "Action failed, please try again")); } finally { st.busy = false; } };
  e.querySelectorAll("[data-bp-up]").forEach(b => { b.onclick = () => lockRun(async () => {
    const id = b.dataset.bpUp, r = await cardUpgrade(id);
    if (!r) return;
    if (r.err) ac(r.err === "poor" ? dc("彈珠幣或材料不足", "Not enough pit coins or mats") : dc("無法升級", "Cannot upgrade"));
    else ac(`⬆ ${v[id].name} → Lv${r.lvNew}`);
    renderTab(e);
  }); });
  e.querySelectorAll("[data-bp-meta]").forEach(b => { b.onclick = () => lockRun(async () => {
    const r = await metaUpgrade(b.dataset.bpMeta);
    if (!r) return;
    if (r.err === "poor") ac(dc("彈珠幣不足", "Not enough pit coins"));
    else if (r.err) ac(dc("無法強化", "Cannot upgrade"));
    renderTab(e);
  }); });
  const dr = e.querySelector("#bp-draw"); if (dr) dr.onclick = () => lockRun(async () => {
    const r = await drawCard();
    if (!r) return;
    st.drawMsg = r.err === "poor" ? dc("彈珠幣不足", "Not enough pit coins") : r.msg;
    renderTab(e);
  });
  const snd = e.querySelector("#bp-snd"); if (snd) snd.onclick = () => { st.mute = !st.mute; snd.textContent = st.mute ? "🔇" : "🔊"; try { localStorage.setItem("tarot_ballpit_sfx_on", st.mute ? "0" : "1"); } catch (x) {} };
  const sv = e.querySelector("#bp-sv"); if (sv) { sv.oninput = () => { st.sfxVol = sv.value / 100; saveVol(); if (st.sfxVol > 0 && st.mute) { st.mute = false; const b = e.querySelector("#bp-snd"); if (b) b.textContent = "🔊"; } }; sv.onchange = () => { hitSnd(12, false); }; }
  const mv = e.querySelector("#bp-mv"); if (mv) mv.oninput = () => { st.musVol = mv.value / 100; saveVol(); if (st.musVol > 0 && st.musicOff) { st.musicOff = false; try { localStorage.setItem("tarot_ballpit_music_off", "0"); } catch (x) {} const b = e.querySelector("#bp-mus"); if (b) b.style.opacity = ""; } };
  const mus = e.querySelector("#bp-mus"); if (mus) mus.onclick = () => { st.musicOff = !st.musicOff; mus.style.opacity = st.musicOff ? ".5" : ""; try { localStorage.setItem("tarot_ballpit_music_off", st.musicOff ? "1" : "0"); } catch (x) {} ac(st.musicOff ? dc("背景音樂：關", "Music: off") : dc("背景音樂：開", "Music: on")); };
  const start = e.querySelector("#bp-start");
  if (start) start.onclick = () => startRun(e);
  e.querySelectorAll("[data-bp-pick]").forEach(el => {
    el.onclick = () => {
      const id = el.dataset.bpPick, cur = selectedIds(p);
      st.selTouched = true;
      if (cur.includes(id)) st.sel = cur.filter(x => x !== id);
      else if (cur.length < LM()) st.sel = cur.concat(id);
      else return void ac(dc(`最多帶 ${LM()} 張卡牌`, `You can bring up to ${LM()} cards`));
      saveSel();
      const now = new Set(st.sel);
      e.querySelectorAll("[data-bp-pick]").forEach(x => x.classList.toggle("sel", now.has(x.dataset.bpPick)));
      const cnt = e.querySelector("#bp-sel-count"); if (cnt) cnt.textContent = `${now.size}/${LM()}`;
    };
  });
}
async function renderTab(e) {
  ensureStyles();
  st.host = e;
  if (!st.loaded) { await loadSettings(); st.loaded = true; }
  if (!st.running && zl.player && !zl.player.bpInit) { try { await ensureInit(); } catch (err) {} }
  bpNorm(zl.player);
  if (!st.running) { await ensureYesterdaySettled(); try { await refreshStandings(); } catch (err) { st.standings = st.standings || []; } }
  if (!e.isConnected || zl.tab !== "ballpit") return;
  e.innerHTML = panelHtml();
  wire(e);
  wireGmPanel(e);
  if (st.running && st.wrap) {
    const host = e.querySelector("#bp-stage-host");
    if (host) { host.appendChild(st.wrap); draw(); startLoop(); }
  }
}
function hardReset() { try { stopLoop(); Music.stop(); } catch (e) {} st.running = false; st.settling = false; st.g = null; st.canvas = null; st.ctx = null; st.wrap = null; st.ov = null; st.lastResult = null; try { localStorage.removeItem(selKey()); } catch (e) {} st.selLoadedFor = null; st.sel = []; st.selTouched = false; st.tab = "play"; st.drawMsg = ""; }
document.addEventListener("visibilitychange", () => { if (document.hidden && st.running && st.g && !st.g.over) setPaused(true); });
document.addEventListener("keydown", ev => {
  if ((ev.key !== "p" && ev.key !== "P") || ev.ctrlKey || ev.metaKey || ev.altKey) return;
  const t = ev.target, tag = t && t.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || (t && t.isContentEditable)) return;
  if (!st.running || zl.tab !== "ballpit") return;
  togglePause();
});
return { renderTab, hardReset };
})();
function ballpitRenderTab(e) { return BP.renderTab(e); }
/* ===== 🎱 塔羅彈珠 Ball Pit — end ===== */







async function bombRenderTab(e){
  srCaptureChatUiState();
  try { await srRefreshChatCache(); } catch (err) { /* ignore, chat will just show empty until next poll */ }
  if ("bomb" !== zl.tab) return;
  e.innerHTML = bombBuildHtml();
  if (bombState.dayEnd) { bombWireDayEnd(e); if (bombState.congratsPending) bombShowCongrats(); return; }
  bombWire(e);
  if (!bombState.mapId) bombAutoLoadSnapshot();
}