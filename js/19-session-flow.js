let zl={nickname:null,player:null,tab:"home",drawResults:null,drawSource:null,flipped:[!1,!1,!1],filter:"all",toastTimer:null,farmVisiting:null,farmUpgradeMode:!1,farmUpgradeSelections:null,gmPlayersPage:1,gmAuctionsPage:1,auctionListType:"card"};async function Zl(e){const t=await a.get(Hl(e));if(!t)return null;const n=JSON.parse(t.value);return le(n),il(n),kt(n),bnV2(n),zo(n),bnRobeGear(n),bnRelic(n),flowSetKnown(n),dropExpeditionChests(n),n}function gmFlowLabel(k){const i=k.indexOf(":"),pre=i<0?k:k.slice(0,i),id=i<0?"":k.slice(i+1);if("coins"===k)return"💰 "+dc("金幣","Coins");if("feathers"===k)return"🪶 "+dc("羽毛","Feathers");const nm=gmItemNameOf(id),ic={mat:"📦",pmat:"🌿",pitem:"🧪",item:"🧪"}[pre]||"";return ic+" "+(nm?dc(nm[0],nm[1])+" ("+id+")":id)}
function gmFlowPanelHtml(){const cat=zl.gmFlowCat||"all",rng=["24h","48h"].includes(zl.gmFlowRng)?zl.gmFlowRng:"48h",opt=(v,t,c)=>`<option value="${v}"${v===c?" selected":""}>${t}</option>`;return`<div class="panel"><h2>📒 ${dc("玩家資產流水","Player Asset Flow")}</h2><p class="sub">${dc("查詢目標玩家（同上方暱稱欄位）目前持有的金幣、材料、成品與藥水、卡牌、骰子、寵物，以及金幣、材料、成品與藥水的變動紀錄。流水從此功能上線後才開始記錄，玩家需重新整理頁面載入新版才會產生紀錄。流水只保留最近 48 小時，更早的紀錄會自動刪除。","Look up the target player's (same nickname field above) current coins, materials, products & potions, cards, dice and pets, plus the change log for coins / materials / products / potions. Logging starts once this feature is live, and players must reload the page to run the new version. Only the most recent 48 hours are kept; older entries are deleted automatically.")}</p><div class="form-row"><div style="flex:1;min-width:120px;"><label>${dc("項目","Category")}</label><select id="gm-flow-cat">${opt("all",dc("全部","All"),cat)}${opt("coins","💰 "+dc("金幣","Coins"),cat)}${opt("items","🧪 "+dc("成品與藥水","Products & potions"),cat)}${opt("shard","🧩 "+dc("神秘碎片","Mystery Shards"),cat)}${opt("mats","📦 "+dc("材料","Materials"),cat)}${opt("feathers","🪶 "+dc("羽毛","Feathers"),cat)}</select></div><div style="flex:1;min-width:120px;"><label>${dc("時間範圍","Range")}</label><select id="gm-flow-range">${opt("24h",dc("24 小時","24 hours"),rng)}${opt("48h",dc("48 小時（上限）","48 hours (max)"),rng)}</select></div></div><div class="form-row"><button class="btn full" id="gm-flow-btn">${dc("🔍 查詢持有與流水","🔍 Query Holdings & Flow")}</button></div><div class="form-row"><button class="btn small secondary" id="gm-flow-prune-btn">${dc("🧹 立刻清理所有玩家超過 48 小時的舊流水","🧹 Delete flow entries older than 48h (all players)")}</button></div><div id="gm-flow-result" style="overflow-x:auto;">${zl.gmFlowHtml||""}</div></div>`}
// ===== GM 玩家資產流水：物品名稱字典 + 「目前持有」區塊 =====
const GM_ITEM_NAMES = {
  mysteryShard: ["神秘碎片", "Mystery Shard"], diceEssence: ["骰子精華", "Dice Essence"], ghostDiceTalisman: ["幽冥骰符", "Ghost Dice Talisman"],
  contrib: ["貢獻點", "Contribution"], dicePunchTool: ["打孔工具", "Dice Punch Tool"],
  herb: ["草藥", "Herb"], ore: ["礦石", "Ore"], lumber: ["木材", "Lumber"],
  potion_small: ["小藥水", "Small Potion"], potion_medium: ["中藥水", "Medium Potion"],
  weapon_common: ["小武器", "Small Weapon"], weapon_uncommon: ["中武器", "Medium Weapon"],
  accessory_common: ["小飾品", "Small Accessory"], accessory_uncommon: ["中飾品", "Medium Accessory"],
  furniture_common: ["小家具", "Small Furniture"], furniture_uncommon: ["中家具", "Medium Furniture"],
  revivePotion: ["復活藥水", "Revive Potion"]
};
function gmItemNameOf(id){
  if (GM_ITEM_NAMES[id]) return GM_ITEM_NAMES[id];
  const m = /^gem(Red|Blue|Crit)Lv(\d+)$/.exec(String(id));
  if (m) { const d = { Red: ["攻擊", "Attack"], Blue: ["血量", "HP"], Crit: ["暴擊", "Crit"] }[m[1]]; return ["💎" + d[0] + "寶石 Lv" + m[2], "💎 " + d[1] + " Gem Lv" + m[2]]; }
  return null;
}
function gmHoldingsHtml(p, cat){
  cat = cat || "all";
  const esc = Iu, fmtN = n => Number(n || 0).toLocaleString();
  const bd = "border-bottom:1px solid rgba(128,128,128,.25);";
  const td = `style="padding:3px 8px;${bd}white-space:nowrap;"`;
  const tdMuted = `style="padding:3px 8px;${bd}white-space:nowrap;color:var(--muted);font-size:11px;"`;
  const tdNum = `style="padding:3px 8px;${bd}text-align:right;font-weight:600;"`;
  const showAll = cat === "all";
  const nameKeys = Object.keys(GM_ITEM_NAMES);
  const entriesOf = obj => Object.keys(obj || {}).filter(k => typeof obj[k] === "number" && isFinite(obj[k])).map(k => {
    const nm = gmItemNameOf(k);
    return { id: k, name: nm ? dc(nm[0], nm[1]) : k, qty: obj[k], known: !!nm };
  }).sort((a, b) => (b.qty > 0) - (a.qty > 0) || (b.known - a.known) || a.id.localeCompare(b.id));
  const section = (icon, title, entries) => {
    if (!entries.length) return "";
    const owned = entries.filter(r => r.qty > 0).length;
    const rows = entries.map(r => `<tr class="${r.qty > 0 ? "" : "gm-hold-zero"}"><td ${td}>${esc(r.name)}</td><td ${tdMuted}>${esc(r.id)}</td><td ${tdNum}>${fmtN(r.qty)}</td></tr>`).join("");
    return `<div style="margin:10px 0 4px;"><div class="who" style="color:var(--gold-bright);">${icon} ${esc(title)} <span style="color:var(--muted);font-size:12px;">（${owned}/${entries.length}）</span></div><table style="border-collapse:collapse;font-size:12px;min-width:300px;"><tbody>${rows}</tbody></table></div>`;
  };
  const chips = list => list.map(x => `<span class="dice-slot-chip" style="margin:2px;">${esc(x.name)} ×${fmtN(x.qty)}</span>`).join("");
  const qName = { common: dc("普通", "Common"), rare: dc("稀有", "Rare"), epic: dc("史詩", "Epic"), legend: dc("傳說", "Legend"), uncommon: dc("優良", "Uncommon") };
  const qOrder = ["legend", "epic", "rare", "uncommon", "common"];
  let h = `<style>.gm-hold-zero{display:none}.gm-hold-zerotoggle:checked~.gm-hold-body .gm-hold-zero{display:table-row}</style>`;
  h += `<div class="gm-hold" style="margin:12px 0;padding:10px 12px;border:1px solid var(--line);border-radius:10px;">`;
  h += `<div class="who" style="font-size:15px;">📋 ${dc("目前持有（即時讀取）", "Current holdings (live)")}</div>`;
  h += `<input type="checkbox" id="gm-hold-showzero" class="gm-hold-zerotoggle" style="vertical-align:middle;"> <label for="gm-hold-showzero" style="font-size:12px;color:var(--muted);cursor:pointer;">${dc("同時顯示數量為 0 的項目", "Also show items with 0")}</label>`;
  h += `<div class="gm-hold-body">`;
  // 貨幣
  const cur = [];
  if (showAll || cat === "coins") cur.push({ id: "coins", name: "💰 " + dc("金幣", "Coins"), qty: p.coins || 0 });
  if (showAll || cat === "feathers") cur.push({ id: "feathers", name: "🪶 " + dc("羽毛", "Feathers"), qty: p.feathers || 0 });
  h += section("💰", dc("貨幣", "Currency"), cur);
  if (showAll || cat === "mats") {
    h += section("📦", dc("材料（含寶石、精華、符、工具）", "Materials (gems, essence, talismans, tools)"), entriesOf(p.materials));
    h += section("🌿", dc("職業材料", "Profession materials"), entriesOf(p.professionMaterials));
  }
  if (showAll || cat === "items") {
    h += section("🧪", dc("成品與藥水（職業產出）", "Products & potions"), entriesOf(p.professionItems));
    h += section("🎒", dc("道具", "Items"), entriesOf(p.items));
  }
  if (showAll) {
    // 卡牌
    try {
      const cards = p.cards || {}, owned = [], seen = new Set();
      (typeof f !== "undefined" ? f : []).forEach(c => { const q = cards[c.id]; if (q > 0) { owned.push({ name: c.name, qty: q }); seen.add(c.id); } });
      Object.keys(cards).forEach(k => { if (!seen.has(k) && cards[k] > 0) owned.push({ name: k, qty: cards[k] }); });
      const total = owned.reduce((n, x) => n + x.qty, 0);
      h += `<div style="margin:10px 0 4px;"><div class="who" style="color:var(--gold-bright);">🃏 ${dc("卡牌", "Cards")} <span style="color:var(--muted);font-size:12px;">（${dc(`${owned.length} 種 / 共 ${fmtN(total)} 張`, `${owned.length} kinds / ${fmtN(total)} total`)}）</span></div>${owned.length ? chips(owned) : `<span class="sub">${dc("沒有卡牌", "No cards")}</span>`}</div>`;
    } catch (err) {}
    try {
      const sc = p.seasonCards || {}, ids = Object.keys(sc).filter(k => sc[k] > 0);
      if (ids.length) {
        const nameOf = id => { try { const t = (typeof U !== "undefined" ? U : []).find(x => x.id === id); return t ? (t.name || id) : id; } catch (e) { return id; } };
        h += `<div style="margin:10px 0 4px;"><div class="who" style="color:var(--gold-bright);">✦ ${dc("賽季卡牌", "Season cards")} <span style="color:var(--muted);font-size:12px;">（${ids.length}）</span></div>${chips(ids.map(id => ({ name: nameOf(id), qty: sc[id] })))}</div>`;
      }
    } catch (err) {}
    // 骰子
    try {
      const dice = Object.values(p.dice || {}), slots = new Set((p.diceSlots || []).filter(Boolean)), arena = new Set((p.arenaDiceSlots || []).filter(Boolean));
      const byQ = {}; dice.forEach(d => { byQ[d.quality] = (byQ[d.quality] || 0) + 1; });
      const sum = qOrder.filter(q => byQ[q]).map(q => `${qName[q] || q} ${byQ[q]}`).join(" · ") || dc("無", "none");
      const favs = dice.filter(d => d.favorite).length;
      const gemTxt = d => (d.gemSockets || []).filter(Boolean).map(g => { const nm = { red: dc("攻", "A"), blue: dc("血", "H"), crit: dc("暴", "C") }[g.color] || g.color; return `💎${nm}${g.level}`; }).join(" ") || "-";
      const bonus = d => { try { return getDiceGemBonus(d); } catch (e) { return { atk: 0, hp: 0 }; } };
      const sorted = dice.slice().sort((a, b) => qOrder.indexOf(a.quality) - qOrder.indexOf(b.quality) || (b.level || 1) - (a.level || 1) || (b.baseAttack || 0) - (a.baseAttack || 0));
      const rows = sorted.slice(0, 300).map(d => { const gb = bonus(d); return `<tr><td ${td}>${qName[d.quality] || esc(d.quality)}</td><td ${td}>Lv.${d.level || 1}</td><td ${td}>${d.baseAttack || 0}${gb.atk ? ` (+${gb.atk})` : ""}</td><td ${td}>${d.baseHp || 0}${gb.hp ? ` (+${gb.hp})` : ""}</td><td ${td}>${gemTxt(d)}</td><td ${td}>${d.favorite ? "⭐ " : ""}${slots.has(d.id) ? dc("裝備中", "equipped") + " " : ""}${arena.has(d.id) ? dc("競技場", "arena") : ""}</td><td ${tdMuted}>${esc(d.id)}</td></tr>`; }).join("");
      h += `<div style="margin:10px 0 4px;"><div class="who" style="color:var(--gold-bright);">🎲 ${dc("骰子", "Dice")} <span style="color:var(--muted);font-size:12px;">（${dc(`共 ${dice.length} 顆，裝備中 ${slots.size}，最愛 ${favs}`, `${dice.length} total, ${slots.size} equipped, ${favs} favorite`)}）</span></div><div class="countdown">${sum}</div>${dice.length ? `<details style="margin-top:4px;"><summary style="cursor:pointer;font-size:12px;">${dc("展開骰子明細", "Show dice details")}</summary><div style="overflow-x:auto;"><table style="border-collapse:collapse;font-size:12px;min-width:520px;"><thead><tr style="text-align:left;"><th ${td}>${dc("品質", "Quality")}</th><th ${td}>${dc("等級", "Lv")}</th><th ${td}>${dc("基礎攻擊", "ATK")}</th><th ${td}>${dc("基礎血量", "HP")}</th><th ${td}>${dc("寶石", "Gems")}</th><th ${td}>${dc("狀態", "Status")}</th><th ${td}>ID</th></tr></thead><tbody>${rows}</tbody></table></div></details>` : ""}</div>`;
    } catch (err) {}
    // 寵物
    try {
      const pets = Array.isArray(p.petsV2) ? p.petsV2 : [];
      const byQ = {}; pets.forEach(x => { byQ[x.quality] = (byQ[x.quality] || 0) + 1; });
      const sum = qOrder.filter(q => byQ[q]).map(q => `${qName[q] || q} ${byQ[q]}`).join(" · ") || dc("無", "none");
      const rows = pets.slice(0, 300).map(x => `<tr><td ${td}>${qName[x.quality] || esc(x.quality)}</td><td ${td}>Lv.${x.level || 1}</td><td ${td}>${esc(x.element || "-")}</td><td ${td}>${(x.affixes || []).length} ${dc("詞綴", "affixes")}</td><td ${td}>${x.favorite ? "⭐" : ""}</td><td ${tdMuted}>${esc(x.id)}</td></tr>`).join("");
      h += `<div style="margin:10px 0 4px;"><div class="who" style="color:var(--gold-bright);">🐾 ${dc("寵物", "Pets")} <span style="color:var(--muted);font-size:12px;">（${dc(`共 ${pets.length} 隻`, `${pets.length} total`)}）</span></div><div class="countdown">${sum}</div>${pets.length ? `<details style="margin-top:4px;"><summary style="cursor:pointer;font-size:12px;">${dc("展開寵物明細", "Show pet details")}</summary><div style="overflow-x:auto;"><table style="border-collapse:collapse;font-size:12px;min-width:420px;"><tbody>${rows}</tbody></table></div></details>` : ""}</div>`;
    } catch (err) {}
  }
  h += `</div></div>`;
  return h;
}
function gmGuardHtml(entries, rng){
  const g = (entries || []).filter(x => x && x.g);
  const esc = Iu, td = 'style="padding:3px 6px;border-bottom:1px solid rgba(128,128,128,.25);white-space:nowrap;"';
  const cut = { "24h": 864e5, "7d": 6048e5, "30d": 2592e6 }[rng], since = cut ? Date.now() - cut : 0;
  const total = g.reduce((n, x) => n + (x.n || 1), 0);
  if (!g.length) return `<p class="sub" style="margin:8px 0;">🛡️ ${dc("防回檔攔截紀錄：目前沒有（沒有偵測到舊資料想蓋掉新資料）", "Rollback guard: none recorded")}</p>`;
  const fmt = t => { try { return new Date(t).toLocaleString(); } catch (e) { return ""; } };
  const ageTxt = sec => sec == null ? "-" : sec >= 3600 ? (sec / 3600).toFixed(1) + " " + dc("小時", "h") : sec >= 60 ? Math.round(sec / 60) + " " + dc("分鐘", "min") : sec + " " + dc("秒", "s");
  const rows = g.filter(x => (x.t || 0) >= since).slice(-15).reverse().map(x => `<tr><td ${td}>${esc(fmt(x.t))}</td><td ${td}>${esc(x.s || "?")}${x.n > 1 ? " ×" + x.n : ""}</td><td ${td}>#${esc(x.d || "?")}</td><td ${td}>${esc(ageTxt(x.o))}</td><td style="padding:3px 6px;border-bottom:1px solid rgba(128,128,128,.25);">${esc((x.x || []).join("、"))}</td></tr>`).join("");
  return `<div style="background:rgba(70,160,255,.12);padding:8px 10px;border-radius:6px;margin:8px 0;font-size:13px;"><b>🛡️ ${dc("防回檔攔截紀錄", "Rollback guard log")}（${dc("共", "total")} ${total} ${dc("次", "")}）</b><div style="font-size:12px;color:var(--muted);margin:4px 0;">${dc("每一筆＝某個頁面拿著舊資料想存檔，系統發現會蓋掉別處剛做的變更，已自動保住。裝置代碼不同＝不同的頁面／分頁／裝置。舊資料年齡＝那份資料在該頁面放了多久沒更新（很久＝多半是放在背景或另一台裝置）。", "Each row: a page tried to save an old copy that would have wiped newer changes made elsewhere; it was merged instead. Different device codes = different pages/tabs/devices. Age = how long that page had been holding the old copy.")}</div><div style="overflow-x:auto;"><table style="border-collapse:collapse;font-size:12px;min-width:520px;"><thead><tr style="text-align:left;"><th ${td}>${dc("時間", "Time")}</th><th ${td}>${dc("來源", "Source")}</th><th ${td}>${dc("裝置", "Device")}</th><th ${td}>${dc("舊資料年齡", "Age")}</th><th ${td}>${dc("被保住的變更", "Preserved")}</th></tr></thead><tbody>${rows || `<tr><td ${td} colspan="5">${dc("這個時間範圍內沒有。", "None in this range.")}</td></tr>`}</tbody></table></div></div>`;
}
function gmFlowRender(p,entries,cat,rng){entries=flowPruneArr(entries);const target=p.nickname,cur=flowSnap(p),catOf=k=>"coins"===k?"coins":"feathers"===k?"feathers":/^(pitem|item):/.test(k)?"items":"mats",catOk=k=>"all"===cat||("shard"===cat?"mat:mysteryShard"===k:catOf(k)===cat),cut={"24h":864e5,"48h":FLOW_KEEP_MS}[rng]||FLOW_KEEP_MS,since=Date.now()-cut,prev={},rows=[];entries.forEach(e=>{if(!e||!e.k||"number"!=typeof e.b||"number"!=typeof e.a)return;const pv=prev[e.k];void 0!==pv&&pv!==e.b&&rows.push({gap:!0,k:e.k,from:pv,to:e.b,t:e.t}),rows.push(e),prev[e.k]=e.a});const mism=Object.keys(prev).filter(k=>catOk(k)&&(cur[k]||0)!==prev[k]),shown=rows.filter(r=>catOk(r.k)&&(r.t||0)>=since).reverse(),list=shown.slice(0,300),shardSum=(()=>{if("shard"!==cat)return"";let g=0,s=0;shown.forEach(r=>{if(r.gap)return;const d=r.a-r.b;d>0?g+=d:s+=-d});return`<p class="sub" style="margin:6px 0;">🧩 ${dc("此範圍內合計","Total in range")}：<b style="color:#2e9e5b;">+${g}</b> / <b style="color:#d64545;">-${s}</b>（${dc("淨變動","net")} ${g-s>0?"+":""}${g-s}）</p>`})(),esc=Iu,sgn=n=>(n>0?"+":"")+n,col=n=>n>0?"#2e9e5b":"#d64545",fmt=t=>{try{return new Date(t).toLocaleString()}catch(e){return""}},td='style="padding:3px 6px;border-bottom:1px solid rgba(128,128,128,.25);white-space:nowrap;"';let h=`<p class="sub" style="margin-top:10px;">${dc("玩家","Player")}：<b>${esc(target)}</b>　${"shard"===cat?dc("目前神秘碎片","Mystery Shards now")+"："+(cur["mat:mysteryShard"]||0):dc("目前金幣","Coins now")+"："+(cur.coins||0)}　${dc("流水筆數","Entries")}：${entries.length}${entries.length&&entries[0].t?"　"+dc("最早記錄","Since")+"："+esc(fmt(entries[0].t)):""}</p>`;h+=shardSum+gmGuardHtml(entries,rng);h+=gmHoldingsHtml(p,cat);if(mism.length&&(h+=`<div style="background:rgba(255,160,0,.22);padding:8px;border-radius:6px;margin-bottom:8px;font-size:13px;">⚠ ${dc("目前數值與最後一筆流水不符（代表最後一筆記錄之後，有未被記錄的變動）","Current values differ from the last logged value (an unlogged change happened after the last entry)")}：<br>${mism.slice(0,20).map(k=>`${esc(gmFlowLabel(k))}：${dc("目前","now")} ${cur[k]||0} / ${dc("記錄","logged")} ${prev[k]}（${sgn((cur[k]||0)-prev[k])}）`).join("<br>")}</div>`),!list.length)return h+`<p class="sub">${dc("這個範圍內沒有流水記錄。","No flow entries in this range.")}</p>`;h+=`<table style="border-collapse:collapse;font-size:12px;min-width:640px;"><thead><tr style="text-align:left;"><th ${td}>${dc("時間","Time")}</th><th ${td}>${dc("項目","Item")}</th><th ${td}>${dc("變動","Change")}</th><th ${td}>${dc("前 → 後","Before → After")}</th><th ${td}>${dc("來源","Source")}</th><th ${td}>${dc("操作者 / 裝置","By / Device")}</th></tr></thead><tbody>`;return list.forEach(r=>{if(r.gap){h+=`<tr style="background:rgba(255,160,0,.22);"><td ${td}>${esc(fmt(r.t))}</td><td ${td}>${esc(gmFlowLabel(r.k))}</td><td ${td} colspan="4" style="padding:3px 6px;border-bottom:1px solid rgba(128,128,128,.25);">⚠ ${dc("缺口","Gap")} ${sgn(r.to-r.from)}：${dc("上一筆記錄後是","after the previous entry it was")} ${r.from}，${dc("下一筆開始前卻是","but before this next entry it was")} ${r.to} — ${dc("期間有未被記錄的變動（可能是舊資料覆寫，或舊版客戶端所致）","an unlogged change happened in between (possibly a stale overwrite or an old-version client)")}</td></tr>`;return}const d=r.a-r.b,other=r.w&&String(r.w).toLowerCase()!==String(target).toLowerCase();h+=`<tr${r.u&&d<0?' style="background:rgba(214,69,69,.12);"':""}><td ${td}>${esc(fmt(r.t))}</td><td ${td}>${esc(gmFlowLabel(r.k))}</td><td ${td}><b style="color:${col(d)};">${sgn(d)}</b></td><td ${td}>${r.b} → ${r.a}</td><td ${td}>${r.u?`<span title="${esc(dc("無版本檢查的直接覆寫存檔，可能蓋掉其他來源的變動","Unconditional overwrite save - may clobber changes made elsewhere"))}">⚠${esc(dc("覆寫","overwrite"))}</span> `:""}${esc(r.s||"?")}${r.n>1?" ×"+r.n:""}</td><td ${td}>${other?`<b>${esc(r.w)}</b>`:esc(r.w||"-")}${r.d?" #"+esc(r.d):""}</td></tr>`}),h+="</tbody></table>",shown.length>list.length&&(h+=`<p class="sub">${dc("僅顯示最新 300 筆，共 "+shown.length+" 筆。請縮小時間範圍或項目。","Showing the latest 300 of "+shown.length+" entries. Narrow the range or category.")}</p>`),h}
async function flowPruneKey(key){return Vl(key,raw=>{let a=[];try{const j=raw?JSON.parse(raw):[];Array.isArray(j)&&(a=j)}catch(e){}return JSON.stringify(flowPruneArr(a))},"[]")}
async function gmFlowPruneAll(){
  if(!ku())return;
  if(!window.confirm(dc("要刪除所有玩家超過 48 小時的舊流水嗎？刪除後無法復原。","Delete every player's flow entries older than 48 hours? This cannot be undone.")))return;
  const btn=document.getElementById("gm-flow-prune-btn");btn&&(btn.disabled=!0);
  try{
    const rows=await listAllValuesPaginated("flow:");let players=0,removed=0,freed=0;
    for(const r of rows){try{
      const arr=JSON.parse(r.value);if(!Array.isArray(arr))continue;
      const kept=flowPruneArr(arr);if(kept.length===arr.length)continue;
      await flowPruneKey(r.key);players++,removed+=arr.length-kept.length,freed+=Math.max(0,String(r.value).length-JSON.stringify(kept).length)
    }catch(e){}}
    ac(dc(`🧹 已清理 ${players} 位玩家，刪除 ${removed} 筆舊流水，釋出約 ${Math.round(freed/1024)} KB`,`🧹 Cleaned ${players} player(s): ${removed} old entries removed, ~${Math.round(freed/1024)} KB freed`))
  }catch(e){ac(dc("清理失敗，請稍後再試","Cleanup failed, please try again"))}finally{btn&&(btn.disabled=!1)}
}
async function gmFlowQuery(){if(!ku())return;const nick=(document.getElementById("gm-target-input").value||"").trim();if(!nick)return void ac(dc("請輸入目標玩家暱稱","Please enter the target player nickname"));const cat=document.getElementById("gm-flow-cat").value,rng=document.getElementById("gm-flow-range").value,btn=document.getElementById("gm-flow-btn");btn&&(btn.disabled=!0);try{const p=await Zl(nick);if(!p)return void ac(dc("找不到此玩家","Player not found"));let entries=[];try{const raw=(await Kl(flowKey(p.nickname))).value,j=raw?JSON.parse(raw):[];Array.isArray(j)&&(entries=j)}catch(e){}entries.some(e=>e&&(e.t2||e.t||0)<Date.now()-FLOW_KEEP_MS)&&flowPruneKey(flowKey(p.nickname)).catch(()=>{});zl.gmFlowCat=cat,zl.gmFlowRng=rng,zl.gmFlowHtml=gmFlowRender(p,entries,cat,rng);const box=document.getElementById("gm-flow-result");box&&(box.innerHTML=zl.gmFlowHtml)}catch(e){ac(dc("讀取流水失敗","Failed to load flow"))}finally{btn&&(btn.disabled=!1)}}
const FLOW_MAX=500,flowKnown={},flowQueue={},flowFail={};const FLOW_KEEP_MS=48*36e5;function flowPruneArr(arr){const cut=Date.now()-FLOW_KEEP_MS;return(Array.isArray(arr)?arr:[]).filter(e=>e&&(e.t2||e.t||0)>=cut)}let flowTimer=null;const flowDev=Math.random().toString(36).slice(2,6);
function flowKey(n){return"flow:"+String(n||"").trim().toLowerCase()}
function flowIsSelf(n){try{return!!(zl&&zl.nickname&&n&&String(n).trim().toLowerCase()===String(zl.nickname).trim().toLowerCase())}catch(e){return!1}}
function flowSnap(p){const o={};if(!p||"object"!=typeof p)return o;const put=(k,v)=>{"number"==typeof v&&isFinite(v)&&(o[k]=v)};put("coins",p.coins),put("feathers",p.feathers);[["materials","mat"],["professionMaterials","pmat"],["professionItems","pitem"],["items","item"]].forEach(([f,pre])=>{const m=p[f];m&&"object"==typeof m&&Object.keys(m).forEach(k=>put(pre+":"+k,m[k]))});return o}
function flowCaller(){try{const names=[],skip=/^(Wl|Ul|xd|flowCaller|flowFlush|Error|Object|Array|Promise|anonymous)$/;String((new Error).stack||"").split("\n").forEach(line=>{if(names.length>=2)return;const m=line.match(/^\s*at (?:async )?(?:new )?([^\s(]+)(?: \(|$)/)||line.match(/^\s*([^@\s]*)@/);if(!m)return;const raw=m[1];if(!raw||/[\/:]/.test(raw))return;const n=raw.split(".").pop();n&&!skip.test(n)&&!names.includes(n)&&names.push(n)});return names.join("←")||"?"}catch(e){return"?"}}
function flowSetKnown(p){try{p&&flowIsSelf(p.nickname)&&(flowKnown[flowKey(p.nickname)]=flowSnap(p))}catch(e){}try{p&&"object"==typeof p&&p.nickname&&(PLAYER_BASE.set(p,Zo(p)),PLAYER_TS.set(p,Date.now()))}catch(e){}}
function flowMergeInto(arr,it){for(let i=arr.length-1;i>=0&&i>=arr.length-12;i--){const l=arr[i];if(l&&l.k===it.k){if(l.s===it.s&&l.w===it.w&&l.d===it.d&&(l.u||0)===(it.u||0)&&l.a===it.b&&it.t-(l.t2||l.t)<=8e3){l.a=it.a,l.n=(l.n||1)+(it.n||1),l.t2=it.t2||it.t;return}break}}arr.push(it)}
function flowSchedule(ms){flowTimer||(flowTimer=setTimeout(()=>{flowTimer=null,flowFlush()},ms||2e3))}
function flowEmit(nick,before,after,src,ul){try{const key=flowKey(nick),b0=before||{},a0=after||{},q=flowQueue[key]||(flowQueue[key]=[]),now=Date.now(),w=zl&&zl.nickname||"?";let any=!1;new Set([...Object.keys(b0),...Object.keys(a0)]).forEach(k=>{const bv=b0[k]||0,av=a0[k]||0;if(bv===av)return;const it={t:now,k:k,b:bv,a:av,s:src,w:w,d:flowDev};ul&&(it.u=1),flowMergeInto(q,it),any=!0});any&&flowSchedule()}catch(e){}}
function flowRecord(nick,before,after,src,ul){try{flowEmit(nick,before,after,src,ul),flowIsSelf(nick)&&(flowKnown[flowKey(nick)]=after)}catch(e){}}
function flowRecordUl(nick,after,src,pre){try{const key=flowKey(nick),before=pre||flowKnown[key];if(!before)return void(flowIsSelf(nick)&&(flowKnown[key]=after));flowEmit(nick,before,after,src,1),flowIsSelf(nick)&&(flowKnown[key]=after)}catch(e){}}
async function flowFlush(){const keys=Object.keys(flowQueue);for(const key of keys){const items=flowQueue[key];if(delete flowQueue[key],items&&items.length)try{await Vl(key,raw=>{let arr=[];try{const j=raw?JSON.parse(raw):[];Array.isArray(j)&&(arr=j)}catch(e){}return items.forEach(it=>flowMergeInto(arr,{...it})),arr=flowPruneArr(arr),arr.length>FLOW_MAX&&arr.splice(0,arr.length-FLOW_MAX),JSON.stringify(arr)},"[]"),flowFail[key]=0}catch(e){if(flowFail[key]=(flowFail[key]||0)+1,flowFail[key]<=3){const q=flowQueue[key]||(flowQueue[key]=[]);q.unshift(...items),flowSchedule(8e3*flowFail[key])}else console.warn("[flow] dropped entries for",key,e)}}}
"undefined"!=typeof document&&document.addEventListener("visibilitychange",()=>{"hidden"===document.visibilityState&&Object.keys(flowQueue).length&&flowFlush()});
// ===== 玩家存檔防回檔：Ul() 改成「衝突時合併」（不再用舊資料整份蓋掉新資料）=====
// 背景：Ul(e) 以前是無條件整份覆寫。任何分頁／裝置手上只要有一份舊的 zl.player，做一件小事（標記聊天已讀、切換骰子最愛、
// Boss 擲骰動畫結束後存檔…）就會把整份存檔倒回舊版本，別處做過的事（例如今天的 VIP 領取記錄）全部消失。
// 現在：每個從伺服器讀進來的玩家物件都記住「讀進來時的樣子」(PLAYER_BASE)；Ul 存檔前先讀伺服器最新版，
// 只把「這個物件相對於它讀進來時真正改過的地方」套用到最新版上，再用版本檢查(updated_at)寫回。
// 沒有衝突時，寫入的內容跟以前完全一樣。
// ===== 單一裝置登入：同一帳號只允許最後登入的那一個頁面，其他頁面會被強制登出 =====
// 做法：登入／自動還原時，在伺服器寫一筆很小的紀錄 session:<暱稱> = { t: 這次的工作階段代碼 }。
// 每個開著的頁面每 20 秒、切回前景、網路恢復時去看這筆紀錄；發現代碼不是自己的，就知道有別處登入了 → 登出自己。
// 被踢出的頁面不能再寫入這個帳號的存檔（Ul／Jl 會拒絕），避免它臨走前又用舊資料蓋掉新資料。
const SESSION_SINGLE_DEVICE = true;   // 想關掉這個功能：改成 false
const SESSION_GM_EXEMPT = true;       // GM 帳號不受限制（GM 常同時開管理頁和遊戲頁）；想連 GM 也限制：改成 false
let SESSION_MY_TOKEN = null, SESSION_KICKED_NICK = null, sessionLastCheckAt = 0, sessionCheckBusy = false;
const sessionKey = nick => "session:" + String(nick || "").trim().toLowerCase();
const sessionNick = nick => String(nick || "").trim().toLowerCase();
async function sessionClaim(nick, token){
  SESSION_MY_TOKEN = token || null; SESSION_KICKED_NICK = null; sessionLastCheckAt = Date.now();
  if (!SESSION_SINGLE_DEVICE || !token || !nick) return;
  try { await a.set(sessionKey(nick), JSON.stringify({ t: token, at: Date.now(), d: flowDev })); } catch (e) {}
}
function sessionRelease(nick){
  const tok = SESSION_MY_TOKEN; SESSION_MY_TOKEN = null; SESSION_KICKED_NICK = null;
  if (!tok || !nick) return;
  (async () => { try { const r = await a.get(sessionKey(nick)), v = r && JSON.parse(r.value); if (v && v.t === tok) await a.delete(sessionKey(nick)); } catch (e) {} })();
}
function sessionShowKicked(){
  try {
    if (document.getElementById("session-kicked-overlay")) return;
    const el = document.createElement("div");
    el.id = "session-kicked-overlay";
    el.style.cssText = "position:fixed;inset:0;z-index:99999;background:rgba(10,6,20,.94);display:flex;align-items:center;justify-content:center;padding:24px;";
    el.innerHTML = `<div style="max-width:360px;text-align:center;border:1px solid var(--gold,#c9a24a);border-radius:14px;padding:22px;background:var(--bg-panel,#1c1230);color:var(--cream,#f3e9d2);"><div style="font-size:34px;margin-bottom:8px;">🔒</div><h2 style="margin:0 0 10px;font-size:18px;">${window.__KICK_REASON==="bot"?dc("偵測到自動連點","Auto-clicking detected"):window.__KICK_REASON==="gm"?dc("已被管理員登出","Signed out by an admin"):dc("帳號已在其他地方登入", "Signed in elsewhere")}</h2><p style="margin:0 0 16px;line-height:1.7;font-size:14px;">${window.__KICK_REASON==="bot"?dc("系統偵測到職業生產有自動連點的跡象，已將你登出。請重新登入並手動遊玩。","The system detected signs of auto-clicking in profession production and signed you out. Please sign in again and play manually."):window.__KICK_REASON==="gm"?dc("管理員已將你登出，請重新登入。","An admin has signed you out. Please sign in again."):dc("這個帳號剛剛在另一個裝置或分頁登入，為了保護你的存檔，這裡已被登出。如果不是你本人操作，請盡快更改密碼。", "This account was just signed in on another device or tab, so this page has been signed out to protect your save data. If that wasn't you, please change your password.")}</p><button class="btn" id="session-kicked-reload">${dc("重新登入", "Sign in again")}</button></div>`;
    document.body.appendChild(el);
    const b = document.getElementById("session-kicked-reload"); b && (b.onclick = () => location.reload());
  } catch (e) {}
}
function sessionKicked(){
  if (SESSION_KICKED_NICK) return;
  SESSION_KICKED_NICK = sessionNick(zl.nickname);
  try { const st = JSON.parse(localStorage.getItem("my-session") || "null"); st && st.token === SESSION_MY_TOKEN && localStorage.removeItem("my-session"); } catch (e) {}   // 同一個瀏覽器的另一個分頁可能正拿著有效代碼，只清自己的
  try { pd && (clearInterval(pd), pd = null), ur && (clearInterval(ur), ur = null), mr && (clearInterval(mr), mr = null), pr && (clearInterval(pr), pr = null), bmTimer && (clearInterval(bmTimer), bmTimer = null), bmCountdownTimer && (clearInterval(bmCountdownTimer), bmCountdownTimer = null), bmChatTimer && (clearInterval(bmChatTimer), bmChatTimer = null); } catch (e) {}
  zl.player = null; zl.nickname = null; zl.tab = "home";
  try { Eu(); } catch (e) {}
  sessionShowKicked();
}
// 回傳 true = 這個頁面仍是有效登入；false = 已被踢出
async function sessionCheck(force){
  if (!SESSION_SINGLE_DEVICE || !SESSION_MY_TOKEN || !zl.nickname || SESSION_KICKED_NICK) return !SESSION_KICKED_NICK;
  if (SESSION_GM_EXEMPT) { try { if (ku()) return true; } catch (e) {} }
  if (!force && Date.now() - sessionLastCheckAt < 5000) return true;
  if (sessionCheckBusy) return true;
  sessionCheckBusy = true;
  try {
    const r = await a.get(sessionKey(zl.nickname));
    sessionLastCheckAt = Date.now();
    if (!r) { await a.set(sessionKey(zl.nickname), JSON.stringify({ t: SESSION_MY_TOKEN, at: Date.now(), d: flowDev })); return true; }   // 紀錄不見了（沒有別人接手）→ 補回
    const v = JSON.parse(r.value);
    if (v && v.t && v.t !== SESSION_MY_TOKEN) { window.__KICK_REASON = String(v.t).startsWith("gmkick-") ? "gm" : ""; sessionKicked(); return false; }
  } catch (e) { /* 網路問題：不誤踢 */ } finally { sessionCheckBusy = false; }
  return true;
}
// 寫入自己的存檔前呼叫：被踢出的頁面一律拒絕；一般頁面順便（最多每 5 秒一次）確認自己還是有效登入
async function sessionGuard(nick){
  if (window.__STALE_CLIENT) throw new Error("client outdated");
  if (!SESSION_SINGLE_DEVICE) return;
  const n = sessionNick(nick);
  if (SESSION_KICKED_NICK && n === SESSION_KICKED_NICK) throw new Error("session kicked");
  if (SESSION_MY_TOKEN && zl.nickname && n === sessionNick(zl.nickname) && !(await sessionCheck())) throw new Error("session kicked");
}
setInterval(() => { document.visibilityState === "visible" && sessionCheck(true); }, 30000 + Math.floor(Math.random() * 5000));
document.addEventListener("visibilitychange", () => { document.visibilityState === "visible" && sessionCheck(true); });
window.addEventListener("focus", () => { sessionCheck(true); });

/* ===== GM：一次踢全部非 GM 玩家下線 =====
   做法：把每個玩家的 session:暱稱 換成一組新代碼。玩家頁面下次檢查（每 30 秒，或存檔前）發現代碼不是自己的，
   就會停掉計時器、清掉自動登入、顯示「已被登出」，之後必須重新輸入密碼。不會刪除任何存檔資料。 */
function gmKickAllPanelHtml(){
  return `<div class="panel">
    <h2>🚪 ${dc("踢全部玩家下線","Kick All Players Offline")}</h2>
    <p class="sub">${dc("把所有非 GM 玩家的登入代碼換掉。正在掛機（包含用連點器）的頁面約 30 秒內會被登出，自動登入也會被清除，要重新輸入密碼才能回來。不會影響任何存檔資料，也不會封鎖帳號。","Replaces every non-GM player's login token. Open pages (including auto-clicker idlers) are logged out within about 30 seconds and their auto-login is cleared, so they must re-enter the password. No save data is touched and no account is banned.")}</p>
    <div class="form-row">
      <button class="btn small" id="gm-kick-all-btn" style="border-color:var(--danger);color:var(--danger);">${dc("🚪 踢全部非 GM 玩家","🚪 Kick All Non-GM Players")}</button>
    </div>
    <div class="who" id="gm-kick-all-progress" style="margin-top:6px;"></div>
  </div>`;
}
document.addEventListener("click", async (ev) => {
  const btn = ev.target && ev.target.closest && ev.target.closest("#gm-kick-all-btn");
  if (!btn || btn.disabled) return;
  if (!ku()) return;
  if (!confirm(dc("確定要把所有非 GM 玩家踢下線嗎？他們需要重新輸入密碼才能再進遊戲。","Kick every non-GM player offline? They will have to re-enter their password to get back in."))) return;
  btn.disabled = true;
  const prog = document.getElementById("gm-kick-all-progress");
  const say = t => { const el = document.getElementById("gm-kick-all-progress"); el && (el.textContent = t); };
  let done = 0, failed = 0;
  try {
    const players = (await Fd()).filter(p => p && p.nickname && p.nickname.toLowerCase() !== wu.toLowerCase());
    say(dc(`共 ${players.length} 位玩家，處理中...`, `${players.length} players, working...`));
    for (const p of players) {
      try {
        const tok = "gmkick-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
        await a.set(sessionKey(p.nickname), JSON.stringify({ t: tok, at: Date.now(), d: "gm-kick" }));
        done++;
      } catch (e) { failed++; }
      if ((done + failed) % 10 === 0) say(dc(`處理中... ${done + failed}/${players.length}`, `Working... ${done + failed}/${players.length}`));
    }
    say(dc(`完成：已處理 ${done} 位${failed ? `，失敗 ${failed} 位` : ""}。掛機頁面約 30 秒內會被登出。`, `Done: ${done} processed${failed ? `, ${failed} failed` : ""}. Open pages will be logged out within ~30 seconds.`));
    ac(dc(`已踢出 ${done} 位玩家 🚪`, `Kicked ${done} players 🚪`));
  } catch (e) {
    say(dc("執行失敗，請檢查網路後再試一次", "Failed - check your connection and try again"));
  } finally { btn.disabled = false; }
});

/* ===== 職業生產「自動連點」偵測 =====
   偵測條件（任一成立就標記）：
   1) 生產按鈕的點擊事件不是真實使用者操作（isTrusted=false，常見於腳本／主控台／部分擴充功能）累計 >= BOT_UNTRUSTED 次
   2) 連續 >= BOT_MIN_CLICKS 次生產點擊，且超過 BOT_STILL_MS 期間游標／手指沒離開生產按鈕附近（容許隨機偏移）、沒有滾輪、鍵盤、觸控滑動，
      也沒有點過別的地方（真人操作遊戲幾乎不可能這麼久完全不動）
   標記後：寫入 botflag:暱稱 給 GM 看；若 GM 設定啟用，過 graceMin 分鐘後把該頁面登出。 */
const BOT_MIN_CLICKS = 100, BOT_STILL_MS = 5 * 60 * 1000, BOT_UNTRUSTED = 5, BOT_DEFAULT_GRACE_MIN = 5;
const BOT = { clicks: 0, untrusted: 0, since: Date.now(), flagged: false, timer: null };
const botReset = () => { BOT.clicks = 0; BOT.untrusted = 0; BOT.since = Date.now(); };
const botFlagKey = nick => "botflag:" + String(nick || "").trim().toLowerCase();
async function botLoadCfg(){
  try { const r = await a.get("config:botkick"); const v = r ? JSON.parse(r.value) : null;
    return { enabled: !v || v.enabled !== false, graceMin: (v && v.graceMin >= 0) ? +v.graceMin : BOT_DEFAULT_GRACE_MIN };
  } catch (e) { return { enabled: true, graceMin: BOT_DEFAULT_GRACE_MIN }; }
}
async function botFlag(reason){
  if (BOT.flagged || !zl.nickname || ku()) return;
  BOT.flagged = true;
  const nick = zl.nickname, mins = Math.round((Date.now() - BOT.since) / 6e4);
  try { await a.set(botFlagKey(nick), JSON.stringify({ n: nick, at: Date.now(), why: reason, clicks: BOT.clicks, untrusted: BOT.untrusted, mins, ua: (navigator.userAgent || "").slice(0, 120) })); } catch (e) {}
  const cfg = await botLoadCfg();
  if (!cfg.enabled) return;
  BOT.timer = setTimeout(() => {
    if (!zl.nickname || zl.nickname !== nick) return;
    window.__KICK_REASON = "bot";
    try { sessionRelease(nick); } catch (e) {}
    sessionKicked();
  }, Math.max(0, cfg.graceMin) * 60 * 1000);
}
(function botInit(){
  /* 生產按鈕範圍：只要游標／手指還在上一次點的生產按鈕附近（外擴 BOT_PAD px），就不算「離開」，
     所以連點器的隨機偏移不會歸零計數。 */
  const PROD_SEL = "[data-produce-item],[data-quick-produce]", BOT_PAD = 12;
  let zone = null;
  const setZone = el => { try { const r = el.getBoundingClientRect(); zone = { l: r.left - BOT_PAD, t: r.top - BOT_PAD, r: r.right + BOT_PAD, b: r.bottom + BOT_PAD }; } catch (err) {} };
  const inZone = (x, y) => !!zone && x >= zone.l && x <= zone.r && y >= zone.t && y <= zone.b;
  const onProd = t => !!(t && t.closest && t.closest(PROD_SEL));
  document.addEventListener("mousemove", e => {
    /* 手機點一下時瀏覽器附帶產生的滑鼠移動事件：忽略，不當成「滑鼠有動」 */
    if (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
    if (onProd(e.target) || inZone(e.clientX, e.clientY)) return;
    botReset();
  }, { capture: true, passive: true });
  ["wheel", "keydown", "touchmove"].forEach(t => document.addEventListener(t, botReset, { capture: true, passive: true }));
  document.addEventListener("click", e => {
    if (BOT.flagged || !zl.nickname || ku()) return;
    const btn = e.target && e.target.closest ? e.target.closest(PROD_SEL) : null;
    if (!btn) { botReset(); zone = null; return; }
    setZone(btn);
    BOT.clicks++;
    if (!e.isTrusted) BOT.untrusted++;
    if (BOT.untrusted >= BOT_UNTRUSTED) botFlag("untrusted");
    else if (BOT.clicks >= BOT_MIN_CLICKS && Date.now() - BOT.since >= BOT_STILL_MS) botFlag("static");
  }, true);
})();