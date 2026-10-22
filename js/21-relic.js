
function relicValidateCfg(c){if(c.sessionsFrom&&!/^\d{4}-\d{1,2}-\d{1,2}$/.test(c.sessionsFrom))return{ok:!1,msg:dc("生效日格式必須是 YYYY-MM-DD","Sessions date must be YYYY-MM-DD")};const ss=(Array.isArray(c.sessions)?c.sessions:[]).filter(x=>x&&x.start),list=[];for(const x of ss){if(null==relicParseTime(x.start))return{ok:!1,msg:dc("開拍時間格式必須是 HH:MM（不用的時間點請留空）","Start time must be HH:MM (leave blank to skip)")}}const SS=relicSessionsFor(ys(),Object.assign({},c,{sessionsFrom:""}));if(!SS.length)return{ok:!1,msg:dc("至少要設定一個拍賣時間點","Set at least one auction time")};for(let k=1;k<SS.length;k++)if(SS[k].dm<SS[k-1].em)return{ok:!1,msg:dc(`時間點太近：${relicTimeStr(SS[k-1].dm)} 這場要到約 ${relicTimeStr(SS[k-1].em)} 才結束，請錯開`,"Times are too close — a session needs 3×(cap+gap) to finish")};if(SS[SS.length-1].em>1440)return{ok:!1,msg:dc("最後一場會跨過午夜，請提早開拍","The last session would run past midnight")};return{ok:!0,warn:""}}

/* ---------- 金額 ---------- */
function fmtCoinShort(n){n=Number(n);if(!isFinite(n))return"0";const sg=n<0?"-":"";n=Math.abs(n);const f=(v,u)=>Math.round(100*v)/100+u;return n>=1e9?sg+f(n/1e9,"B"):n>=1e6?sg+f(n/1e6,"M"):n>=1e3?sg+f(n/1e3,"K"):sg+String(Math.round(n))}
function parseCoinInput(v){if("number"==typeof v)return isFinite(v)?Math.floor(v):0;const s=String(null==v?"":v).trim().replace(/^✦/,"").replace(/[,\s_]/g,""),m=/^(\d+(?:\.\d+)?)([kKmMbB]?)$/.exec(s);if(!m)return 0;return m[2]?Math.round(parseFloat(m[1])*{k:1e3,m:1e6,b:1e9}[m[2].toLowerCase()]):Math.floor(parseFloat(m[1]))}
function relicMinPrice(itemId){const it=RELIC_BY_ID[itemId];return it?RELIC_CFG.minPrice[it.tier]:1/0}
function aucMinBid(a2){if(!(a2.currentBid>0))return a2.startBid;const inc=a2.minIncPct?Math.max(a2.minIncFloor||1,Math.ceil(a2.currentBid*a2.minIncPct/100)):1;return a2.currentBid+inc}
function relicSellerLabel(a2){return a2.isSystem?dc("🏛️ 拍賣行","🏛️ Auction House"):Iu(a2.seller)}
function relicApplyAntiSnipe(rec){if(!rec.antiSnipe)return null;const c=RELIC_CFG.antiSnipe,left=rec.endsAt-Date.now();if(left<6e4*c.windowMin&&(rec.extendCount||0)<c.maxExtend){const prev={endsAt:rec.endsAt,extendCount:rec.extendCount||0};rec.endsAt+=6e4*c.extendMin;rec.extendCount=prev.extendCount+1;return prev}return null}
function relicAuctionExtras(itemId){const it=RELIC_BY_ID[itemId];return it?{minIncPct:RELIC_CFG.minIncPct[it.tier],minIncFloor:RELIC_CFG.minIncFloor,relicTier:it.tier}:{}}

/* ---------- 玩家資料 ---------- */
function bnRelic(p){if(!p)return;p.relics&&"object"==typeof p.relics&&!Array.isArray(p.relics)||(p.relics={});for(const k of Object.keys(p.relics)){const v=Math.floor(Number(p.relics[k]));v>0?p.relics[k]=v:delete p.relics[k]}"boolean"!=typeof p.relicHidden&&(p.relicHidden=!1);p.relicEver&&"object"==typeof p.relicEver&&!Array.isArray(p.relicEver)||(p.relicEver={});for(const k of Object.keys(p.relics))p.relics[k]>0&&(p.relicEver[k]=1)}
function relicItemsOf(p){const o={};if(p&&p.relics)for(const k of Object.keys(p.relics)){const v=Math.floor(Number(p.relics[k])||0);v>0&&(o[k]=v)}return o}

/* ---------- 持有登記 relic_owner（每位玩家自己維護快照） ---------- */
const RELIC_SIG=new Map(),RELIC_SYNC_T=new Map();
function relicOwnerKey(nick){return"relic_owner:"+String(nick||"").toLowerCase()}
function relicSig(items,hidden){return JSON.stringify(Object.keys(items).sort().map(k=>[k,items[k]]))+"|"+(hidden?1:0)}
async function relicOwnerWrite(nick,items,hidden){try{if(0===Object.keys(items).length){const cur=await RKV.get(relicOwnerKey(nick));cur&&await RKV.delete(relicOwnerKey(nick))}else await RKV.set(relicOwnerKey(nick),JSON.stringify({nick,hidden:!!hidden,items,at:Date.now()}));RELIC_SIG.set(nick,relicSig(items,hidden));return!0}catch(_){return!1}}
function relicSyncSoon(p){try{if(!p||!p.nickname||!p.relics)return;const nick=p.nickname,items=relicItemsOf(p),hidden=!!p.relicHidden;if(RELIC_SIG.get(nick)===relicSig(items,hidden))return;clearTimeout(RELIC_SYNC_T.get(nick));RELIC_SYNC_T.set(nick,setTimeout(()=>{relicOwnerWrite(nick,items,hidden).catch(()=>{})},300))}catch(_){}}
async function relicOwnerRepair(){try{const p=zl.player;if(!p||!zl.nickname)return;bnRelic(p);const items=relicItemsOf(p),hidden=!!p.relicHidden,row=await RKV.get(relicOwnerKey(zl.nickname));let snap=null;try{snap=row?JSON.parse(row.value):null}catch(_){}const sn=snap&&snap.items||{};const same=0===Object.keys(items).length?0===Object.keys(sn).length:relicSig(sn,!!(snap&&snap.hidden))===relicSig(items,hidden);if(same){RELIC_SIG.set(zl.nickname,relicSig(items,hidden));return}await relicOwnerWrite(zl.nickname,items,hidden)}catch(_){}}

/* ---------- KV 小工具 ---------- */
function relicCreateIfAbsent(key,value){return createPlayerIfAbsent(key,value)}
async function relicListRows(prefix){try{return await listAllValuesPaginated(prefix)}catch(_){return[]}}
async function relicSupplyLoad(){const out={};for(const r of await relicListRows("relic_supply:"))try{const v=JSON.parse(r.value);out[r.key.slice("relic_supply:".length)]=Math.max(0,0|v.sold)}catch(_){}return out}
function relicLegendLeft(id,supply){const cap=RELIC_CFG.legendarySupply&&RELIC_CFG.legendarySupply[id];return null==cap?1/0:Math.max(0,cap-(supply&&supply[id]||0))}
async function relicOnSystemSold(rec){if(rec.isTest||rec.hallExtra)return;const cap=RELIC_CFG.legendarySupply&&RELIC_CFG.legendarySupply[rec.itemId];if(null==cap)return;await Vl("relic_supply:"+rec.itemId,raw=>{const s=raw?JSON.parse(raw):{sold:0,auctions:[]};Array.isArray(s.auctions)||(s.auctions=[]);s.auctions.includes(rec.id)||s.auctions.push(rec.id);s.sold=s.auctions.length;return JSON.stringify(s)},JSON.stringify({sold:0,auctions:[]}))}

/* ---------- 抽選：名額 / 候選池 / 計票（純函式，方便測試） ---------- */
function relicSlot2TypeRaw(day,cfg){cfg=cfg||RELIC_CFG;const r=wbMulberry32(wbHashSeed("relictier:"+day))(),L=Math.max(0,+cfg.legendaryChancePct||0),E=Math.max(0,+cfg.epicChancePct||0),tot=L+E;return tot>0&&r<L/tot?"legendary":"epic"}
function relicSlot2Type(day,supply,cfg){const t=relicSlot2TypeRaw(day,cfg);return"legendary"===t&&!RELIC_POOL.legendary.some(it=>relicLegendLeft(it.id,supply)>0)?"epic":t}
function relicBasePool(slot,type,supply){if(0===slot)return RELIC_POOL.common.slice();if(1===slot)return RELIC_POOL.rare.slice();return"legendary"===type?RELIC_POOL.legendary.filter(it=>relicLegendLeft(it.id,supply)>0):RELIC_POOL.epic.slice()}
function relicPickFrom(day,slot,pool,cfg){const sorted=pool.slice().sort((x,y)=>x.id<y.id?-1:1);if(!sorted.length)return null;const rng=wbMulberry32(wbHashSeed("relic:"+day+":"+slot)),ws=sorted.map(it=>cfg.weight[it.tier]||1),tot=ws.reduce((x,y)=>x+y,0);let r=rng()*tot;for(let k=0;k<sorted.length;k++){r-=ws[k];if(r<0)return{it:sorted[k],src:"random"}}return{it:sorted[sorted.length-1],src:"random"}}
function relicComputeDraw(day,supply,cfg,sess){cfg=cfg||RELIC_CFG;const sd=sess?day+"#s"+sess:day,type=relicSlot2Type(sd,supply,cfg),ids=[],tiers=[],src={};for(let s=0;s<3;s++){let pool=relicBasePool(s,type,supply);const pk=relicPickFrom(sd,s,pool,cfg);if(!pk)continue;ids[s]=pk.it.id;tiers[s]=pk.it.tier;src[pk.it.id]=pk.src}return{day,sess:sess||0,ids,tiers,src,type}}

/* ---------- 每日流程（冪等，玩家端觸發） ---------- */
function relicDrawKey(day,sess){return"relic_draw:"+day+(sess?"#s"+sess:"")}
async function relicDrawGet(day,sess){try{const row=await RKV.get(relicDrawKey(day,sess));return row?JSON.parse(row.value):null}catch(_){return null}}
let RELIC_ACTIVE_ENDS=[],RELIC_TEST_UNTIL=0;
async function relicSettleSystemAuctions(){let n=0,rows=[];try{rows=await RKV.listValues("auction:relic-")}catch(_){return 0}const recs=RPARSE(rows).map(ru),pending=[];for(const r of recs){if("active"!==r.status)continue;if(r.endsAt+(r.live?1500:0)<=relicSrvNow()){try{await fu(r);n++}catch(err){console.error("[relicSettle] failed",r.id,err);pending.push(r.endsAt)}}else pending.push(r.endsAt)}RELIC_ACTIVE_ENDS=pending;return n}
async function relicEnsureDraw(day,sess){let draw=await relicDrawGet(day,sess);if(draw)return draw;await relicSettleSystemAuctions();const supply=await relicSupplyLoad(),c=relicComputeDraw(day,supply,RELIC_CFG,sess),rec={day,sess:sess||0,ids:c.ids,tiers:c.tiers,src:c.src,type:c.type,at:Date.now()};if(await relicCreateIfAbsent(relicDrawKey(day,sess),JSON.stringify(rec)))return rec;return await relicDrawGet(day,sess)||rec}
function relicBuildAuction(day,slot,itemId,opts){opts=opts||{};const it=RELIC_BY_ID[itemId],cfg=RELIC_CFG,endsAt=opts.endsAt||relicDayTs(day,null!=opts.endMin?opts.endMin:1440);return{id:opts.id||"relic-"+day+(opts.sess?"-s"+opts.sess:"")+"-"+slot,seller:"__system__",isSystem:!0,itemType:"relic",itemId,qty:1,startBid:cfg.minPrice[it.tier],buyoutPrice:null,currentBid:0,currentBidder:null,createdAt:Date.now(),endsAt,status:"active",bidHistory:[],antiSnipe:!0,minIncPct:cfg.minIncPct[it.tier],minIncFloor:cfg.minIncFloor,extendCount:0,relicDay:day,relicSess:opts.sess||0,slot,relicTier:it.tier,...opts.isTest?{isTest:!0}:{},...(opts.extra||{})}}
async function relicCreateSystemAuctions(draw,S){let created=0;const T=relicLiveTimeline(draw.day,S);for(let s=0;s<3;s++){const id=draw.ids&&draw.ids[s];if(!id||!RELIC_BY_ID[id])continue;const opensAt=T.dm+s*T.span,hardEnd=opensAt+T.cap;if(hardEnd<=relicSrvNow())continue;const rec=relicBuildAuction(draw.day,s,id,{sess:S.idx,endMin:S.em,endsAt:opensAt+Math.min(T.V.openMs,T.cap),extra:{live:!0,antiSnipe:!1,opensAt,hardEnd,nBids:0,bset:{}}});if(await relicCreateIfAbsent("auction:"+rec.id,JSON.stringify(rec))){created++;RELIC_ACTIVE_ENDS.push(rec.endsAt)}}created+=await relicCreateExtras(draw.day,S);return created}
let RELIC_DONE_DAY=null,RELIC_DONE_KEYS={},RELIC_LOCK_DAY=null,RELIC_TICK_BUSY=!1,RELIC_TICK_AT=0;
async function relicDailyTick(){if(RELIC_TICK_BUSY)return{created:0};RELIC_TICK_BUSY=!0;let created=0;try{const cfg=await relicEnsureConfig();if(!cfg.enabled)return{created:0};const day=ys(),min=fs(),sessions=relicSessionsFor(day,cfg);if(!sessions.length){RELIC_LOCK_DAY=day;return{created:0}}await relicSettleSystemAuctions();let draw0=null;for(let k=0;k<sessions.length;k++){const S=sessions[k];if(k>0&&min<sessions[k-1].em)break;const draw=await relicEnsureDraw(day,S.idx);0===k&&(draw0=draw,RELIC_LOCK_DAY=day);if(min<S.dm-5||min>=S.em)continue;const dk=day+"#"+S.idx;if(RELIC_DONE_KEYS[dk])continue;created+=await relicCreateSystemAuctions(draw,S);RELIC_DONE_KEYS[dk]=1}return{created,draw:draw0}}catch(err){console.error("[relicDailyTick] failed",err);return{created:0,error:err}}finally{RELIC_TICK_BUSY=!1,RELIC_TICK_AT=Date.now()}}
function relicTickThrottled(){if(Date.now()-RELIC_TICK_AT<3e4||RELIC_TICK_BUSY)return;RELIC_TICK_AT=Date.now();relicDailyTick().then(r=>{r&&r.created>0&&("auction"===zl.tab||"collection"===zl.tab)&&Bu()}).catch(()=>{})}
function relicPollNeeded(){const c=RELIC_CFG;if(!RELIC_CFG_LOADED||!c.enabled)return!1;const day=ys(),min=fs();return RELIC_LOCK_DAY!==day||relicSessionsFor(day,c).some(S=>!RELIC_DONE_KEYS[day+"#"+S.idx]&&min>=S.dm-5&&min<S.em)||RELIC_ACTIVE_ENDS.some(t=>t<=Date.now())}
async function relicPoll(){if("visible"!==document.visibilityState||!zl.nickname)return;if(Date.now()-RELIC_CFG_AT>3e5)try{await relicEnsureConfig(!0)}catch(_){}if(relicPollNeeded()){const r=await relicDailyTick();r&&r.created>0&&("auction"===zl.tab||"collection"===zl.tab)&&Bu()}}
function relicOnLogin(){(async()=>{try{await relicEnsureConfig(!0);await relicOwnerRepair();relicTitleRefresh(!0).catch(()=>{});RELIC_TICK_AT=0;relicTickThrottled()}catch(_){}})()}

/* ====================================================================
   🔨 拍賣大廳（即時喊價）— 取代原本「整場掛著慢慢競標」的系統拍賣
   · 每天 3 個時間點（沿用 GM 設定的 sessions），每場依序即時喊價 3 件：普通位 → 稀有位 → 高階位
   · 沿用原本的 auction:relic-* 紀錄、結算 fu()、限量、榜單、成交紀錄；只換「怎麼競標」
   · 每次有人出價，倒數重置為 resetSec 秒；倒數歸零無人加價即落槌；每件有硬性上限 capSec
   ==================================================================== */
const RELIC_URL=e,RELIC_HDR=n;
let RELIC_SKEW=0,RELIC_SKEW_AT=0;
function relicSrvNow(){return Date.now()+RELIC_SKEW}
/* 以 HTTP Date 標頭校正本機時鐘（讀不到標頭就維持 0，不影響功能） */
async function relicSyncClock(force){
  if(!force&&Date.now()-RELIC_SKEW_AT<9e4)return;RELIC_SKEW_AT=Date.now();
  try{
    const t0=Date.now(),r=await fetch(RELIC_URL+"/rest/v1/kv_store?key=eq.config%3Arelic_settings&select=key",{headers:RELIC_HDR,cache:"no-store"}),t1=Date.now(),d=r.headers.get("Date"),srv=d?new Date(d).getTime():NaN;
    if(isFinite(srv)){const off=srv+500-(t0+t1)/2;RELIC_SKEW=Math.abs(off)<1500?0:Math.round(off)}
  }catch(_){}
}
/* 落槌喊價：一、二、三次各 RELIC_GO_STEP 毫秒（共 RELIC_GO_MS）。出價後的倒數至少要比喊價段多 3 秒，才看得到「某某出價」那句 */
const RELIC_GO_STEP=3e3,RELIC_GO_MS=3*RELIC_GO_STEP;
/* !1＝只擋「連續自己加價自己」（要等別人出價後才能再出價）；!0＝每人每件只能出價一次 */
const RELIC_ONE_BID_PER_LOT=!1;
function relicHallIsLast(rec,me){if(!rec||!me)return!1;const m=me.toLowerCase(),c=rec.currentBidder;if(c&&String(c).toLowerCase()===m)return!0;const h=Array.isArray(rec.bidHistory)?rec.bidHistory:[],l=h[h.length-1];return!!(rec.currentBid>0&&l&&l.bidder&&String(l.bidder).toLowerCase()===m)}
function relicHallBidded(rec,me){return!!(rec&&me&&((rec.bset&&rec.bset[me.toLowerCase()])||(rec.bidHistory||[]).some(h=>h&&h.bidder===me)))}
function relicLive(){
  const L=RELIC_CFG.live||{};
  return{openMs:1e3*Math.max(10,+L.openSec||60),capMs:1e3*Math.max(30,+L.capSec||180),gapMs:1e3*Math.max(5,+L.gapSec||20),resetMs:Math.max(1e3*Math.min(30,Math.max(2,+L.resetSec||5)),RELIC_GO_MS+3e3)}
}
/* 一場的時間表：第 s 件的預定開拍 = 場次開始 + s × span；每件硬性上限 cap */
function relicLiveTimeline(day,S){
  const V=relicLive(),dm=relicDayTs(day,S.dm),em=relicDayTs(day,S.em),n=3+relicExtrasFor(day,S.idx).length,span=Math.max(6e4,Math.min(V.capMs+V.gapMs,Math.floor((em-dm)/n))),cap=Math.max(3e4,span-V.gapMs);
  return{dm,em,span,cap,V,n}
}
function relicPubName(rec){return(rec&&rec.currentBidder)||""}
function relicLotTimer(a2){return a2&&a2.live?dc("即時拍賣","Live"):relicFmtTimer(a2.endsAt)}
function relicNiceUp(n){n=Math.ceil(n);if(n<1e3)return n;const g=Math.pow(10,Math.floor(Math.log10(n))-2);return Math.ceil(n/g)*g}

/* ---------- 大廳狀態 ---------- */
const RELIC_HALL={open:!1,P:null,S:null,lots:[],preview:null,cur:null,shown:null,raise:0,busy:!1,polling:!1,pollT:0,uiT:0,tickAt:0,settleAt:{},advAt:{},seen:{},tickN:{},wonDone:{},muted:(()=>{try{return"1"===localStorage.getItem("relic-hall-mute")}catch(_){return!1}})(),ac:null};
function relicHallTone(f,d,type,v,s){
  if(RELIC_HALL.muted)return;
  try{const c=RELIC_HALL.ac||(RELIC_HALL.ac=new(window.AudioContext||window.webkitAudioContext)),o=c.createOscillator(),g=c.createGain(),t0=c.currentTime+(s||0);o.type=type||"sine";o.frequency.setValueAtTime(f,t0);g.gain.setValueAtTime(v||.1,t0);g.gain.exponentialRampToValueAtTime(1e-4,t0+d);o.connect(g);g.connect(c.destination);o.start(t0);o.stop(t0+d)}catch(_){}
}

/* ===== 特別拍品（GM 加進拍賣大廳的羽毛／神秘碎片／材料／成品／卡片）===== */
function relicExtrasFor(day,sessIdx,cfg){cfg=cfg||RELIC_CFG;const a=Array.isArray(cfg.extras)?cfg.extras:[],ss=Array.isArray(cfg.sessions)?cfg.sessions:[],key=+sessIdx||0;return a.filter(x=>{if(!x||x.day!==day)return!1;if(x.tk)return(+x.sess||0)===key;const sx=ss[+x.sess||0],d=sx?relicParseTime(sx.start):null;return null!=d&&d===key}).slice(0,8)}
function relicExtraTypeLabel(t){return{feather:dc("🕊️ 羽毛","🕊️ Feather"),shard:dc("🧩 神秘碎片","🧩 Mystery Shard"),material:dc("🌿 材料","🌿 Material"),professionItem:dc("🛠️ 成品","🛠️ Crafted item"),card:dc("🎴 卡片","🎴 Card"),relic:dc("🏺 遺物／古董","🏺 Relic / Antique")}[t]||t}
function relicExtraMeta(type,id,qty){ let relItem=null,icon="🎁",label=String(id),color="#c9a24a",lore="",kind=dc("特別拍品","Special lot");
  if("feather"===type){icon="🕊️";label=dc("羽毛","Feather");color="#e07bd0";lore=dc("一根閃著微光的羽毛。","A softly glowing feather.")}
  else if("shard"===type){icon="🧩";label=dc("神秘碎片","Mystery Shard");color="#8f78ff";lore=dc("凝聚著神秘力量的碎片。","A shard brimming with mysterious power.")}
  else if("material"===type){const m=Mt.find(p=>p.materialId===id);m&&(icon=m.materialIcon,label=At(m));color="#7fc98f";lore=dc("職業採集所得的材料。","Gathered profession material.")}
  else if("professionItem"===type){const r=Lt(id);r&&(icon=r.icon,label=Bt(r));color="#6fb4ff";lore=dc("職業工坊打造的成品。","A crafted profession item.")}
  else if("card"===type){const c=v[id];c&&(icon="🎴",label=c.name);lore=dc("一張卡片。","A card.")}
  else if("relic"===type){const r=RELIC_BY_ID[id];if(r){icon=r.icon||"🏺";label=relicName(r);const tm=RELIC_TIERS[r.tier];tm&&(color=tm.color);lore=dc(r.loreZh,r.loreEn);kind=relicKindLabel(r.kind);relItem=r}}
  const q=+qty||1;return{icon,label:q>1?label+" × "+q:label,color,lore,kind,it:relItem}
}
/* 大廳用的統一資訊：遺物走原本樣式，其他走特別拍品樣式 */
function relicHallInfo(rec){
  if(!rec)return null;
  if("relic"===rec.itemType||!rec.itemType){
    const it=RELIC_BY_ID[rec.itemId];if(!it)return null;const m=RELIC_TIERS[it.tier];
    return{name:relicName(it)+((+rec.qty||1)>1?" × "+(+rec.qty):""),color:m.color,tags:relicTagHtml(it),lore:dc(it.loreZh,it.loreEn),art:px=>relicIconBox(it,px)}
  }
  const x=relicExtraMeta(rec.itemType,rec.itemId,rec.qty);
  return{name:x.label,color:x.color,tags:`<span class="rh-spectag">${Iu(x.kind)}</span>`,lore:x.lore,art:px=>`<div class="icon-box" style="width:${px}px;height:${px}px;border:1px solid ${x.color};display:flex;align-items:center;justify-content:center;font-size:${Math.round(.55*px)}px;">${x.icon}</div>`}
}
function relicHallSlotName(slot){const s=RELIC_SLOT_NAMES[slot||0];return s?dc(s.zh,s.en):dc("特別位","Special")}
function P0day(){return ys(relicSrvNow())}

/* ===== GM：特別拍品管理 ===== */
function relicBuildExtraAuction(day,S,slot,x,o){const sb=Math.max(1,Math.floor(+x.startBid)||1);return{id:"relic-"+day+(S.idx?"-s"+S.idx:"")+"-"+slot,seller:"__system__",isSystem:!0,itemType:x.itemType,itemId:x.itemId,qty:Math.max(1,Math.floor(+x.qty)||1),startBid:sb,buyoutPrice:null,currentBid:0,currentBidder:null,createdAt:Date.now(),endsAt:o.endsAt,status:"active",bidHistory:[],antiSnipe:!1,minIncPct:+x.incPct||5,minIncFloor:Math.max(1,Math.round(.01*sb)),extendCount:0,relicDay:day,relicSess:S.idx,slot,relicTier:"special",hallExtra:!0,live:!0,opensAt:o.opensAt,hardEnd:o.hardEnd,nBids:0,bset:{}}}
async function relicCreateExtras(day,S){let created=0;try{const T=relicLiveTimeline(day,S),exs=relicExtrasFor(day,S.idx);for(let k=0;k<exs.length;k++){const slot=3+k,opensAt=T.dm+slot*T.span,hardEnd=opensAt+T.cap;if(hardEnd<=relicSrvNow())continue;const rec=relicBuildExtraAuction(day,S,slot,exs[k],{opensAt,hardEnd,endsAt:opensAt+Math.min(T.V.openMs,T.cap)});if(await relicCreateIfAbsent("auction:"+rec.id,JSON.stringify(rec))){created++;RELIC_ACTIVE_ENDS.push(rec.endsAt)}}}catch(err){console.error("[relicCreateExtras]",err)}return created}
async function relicExtrasUpdate(fn){await Vl("config:relic_settings",raw=>{let c={};try{c=raw?JSON.parse(raw):{}}catch(_){c={}}c.extras=fn(Array.isArray(c.extras)?c.extras:[]);return JSON.stringify(c)},"{}");await relicEnsureConfig(!0)}
function relicGmExtraItems(type){
  if("material"===type)return Mt.map(p=>({id:p.materialId,label:`${p.materialIcon||""} ${At(p)}`}));
  if("professionItem"===type){const out=[];Mt.forEach(p=>p.recipes.forEach(r=>out.push({id:r.itemId,label:`${r.icon||""} ${Bt(r)}`})));return out}
  if("card"===type)return Object.keys(v).sort().map(id=>({id,label:`${id} ${v[id].name||""}`}));
  if("relic"===type)return RELIC_CATALOG.map(r=>({id:r.id,label:`${r.icon||""} ${relicName(r)}（${relicKindLabel(r.kind)}・${relicTierLabel(r.tier)}）`}));
  return[]
}
function relicGmExtrasHtml(){
  const opt=(a,b)=>`<option value="${Iu(a)}">${Iu(b)}</option>`;
  return`<div style="margin:14px 0 6px;"><b>🔨 ${dc("特別拍品（加進下一場拍賣大廳）","Special lots (add to the next hall session)")}</b></div>
    <p class="sub" id="gm-rl-ex-info" style="margin:0 0 6px;"></p>
    <div class="form-row"><div><label>${dc("類型","Type")}</label><select id="gm-rl-ex-type">${["feather","shard","material","professionItem","card","relic"].map(t=>opt(t,relicExtraTypeLabel(t))).join("")}</select></div><div id="gm-rl-ex-itemwrap" style="display:none;"><label>${dc("物品","Item")}</label><select id="gm-rl-ex-item"></select></div><div><label>${dc("數量","Qty")}</label><input type="text" id="gm-rl-ex-qty" value="1" style="width:60px;" /></div><div><label>${dc("起標價","Start bid")}</label><input type="text" id="gm-rl-ex-price" value="1m" style="width:90px;" placeholder="1k / 1m / 1b" /></div><div><label>${dc("加價%","Inc %")}</label><input type="text" id="gm-rl-ex-inc" value="5" style="width:50px;" /></div><button class="btn small" id="gm-rl-ex-add">${dc("加入下一場","Add")}</button></div>
    <div id="gm-rl-ex-list"></div>
    <p class="sub" style="margin:4px 0 4px;">${dc("💡 價格可以直接輸入 1k、10k、100k、1m、10m、100m、1b（k＝千、m＝百萬、b＝十億），也可以輸入一般數字，最低 1；欄位點一下有快捷選單。","💡 Prices accept 1k, 10k, 100k, 1m, 10m, 100m, 1b (k=thousand, m=million, b=billion) or a plain number, minimum 1; click the field for presets.")}</p><p class="sub" style="margin:4px 0 8px;">${dc("特別拍品排在三件遺物之後（特別位），玩法一樣：金幣喊價；得標後物品自動放進背包，金幣由系統回收。每場最多 8 件，場次會依件數自動拉長。開拍前 5 分鐘系統會建立拍品；已經開拍的場次不能再加。","Special lots follow the three relics (Special slot) and work the same: bid with coins; the item goes straight into the winner's inventory and coins are removed from the economy. Up to 8 per session; the session lengthens automatically. Lots are created 5 minutes before the session; started sessions cannot be added to.")}</p>`
}
async function relicGmExtrasRender(){
  const info=document.getElementById("gm-rl-ex-info"),list=document.getElementById("gm-rl-ex-list");if(!info||!list)return;
  try{
    const nx=await relicNextSession();
    if(!nx){info.textContent=dc("目前沒有尚未開拍的場次","No upcoming session");list.innerHTML="";return}
    const{day,S}=nx,exs=relicExtrasFor(day,S.idx);
    info.innerHTML=`${dc("加入對象：","Target: ")}<b>${day} ${relicTimeStr(S.dm)}</b>`;
    list.innerHTML=exs.length?exs.map(x=>{const m=relicExtraMeta(x.itemType,x.itemId,x.qty);return`<div class="listing"><div class="left">${m.it?relicIconBox(m.it,44):`<div class="icon-box" style="display:flex;align-items:center;justify-content:center;font-size:22px;border-color:${m.color};">${m.icon}</div>`}<div class="meta"><div style="font-weight:600;">${Iu(m.label)}</div><div class="who">${dc("起標","Start")} ✦${fmtCoinShort(x.startBid)} · ${dc("加價","Inc")} ${+x.incPct||5}%</div></div></div><div class="right"><button class="btn small secondary" data-gm-ex-del="${Iu(x.id)}">${dc("移除","Remove")}</button></div></div>`}).join(""):`<div class="who" style="margin:4px 0;">${dc("這一場還沒有特別拍品","No special lots in this session yet")}</div>`;
    list.querySelectorAll("[data-gm-ex-del]").forEach(b=>b.onclick=async()=>{const id=b.dataset.gmExDel;b.disabled=!0;try{const cur=relicExtrasFor(day,S.idx);if(await relicSessStartedAny(day,S.idx)){ac(dc("這一場已經建立拍品，不能再移除","This session's lots are already created"));return}await relicExtrasUpdate(a=>a.filter(x=>x&&x.id!==id));ac(dc("已移除","Removed"))}finally{await relicGmExtrasRender()}})
  }catch(_){info.textContent=dc("讀取失敗，請稍後再試","Load failed, try again later")}
}
async function relicSessStartedAny(day,idx){for(let s=0;s<12;s++){try{if(await RKV.get("auction:relic-"+day+(idx?"-s"+idx:"")+"-"+s))return!0}catch(_){}}return!1}
function relicGmExtrasBind(){
  const ty=document.getElementById("gm-rl-ex-type"),it=document.getElementById("gm-rl-ex-item"),wrap=document.getElementById("gm-rl-ex-itemwrap"),add=document.getElementById("gm-rl-ex-add");if(!ty||!add)return;
  const fill=()=>{const t=ty.value,items=relicGmExtraItems(t);wrap.style.display=items.length?"":"none";it.innerHTML=items.map(x=>`<option value="${Iu(x.id)}">${Iu(x.label)}</option>`).join("")};
  ty.onchange=fill;fill();relicGmExtrasRender();relicPricePresetAttach();
  add.onclick=async()=>{
    add.disabled=!0;
    try{
      const nx=await relicNextSession();if(!nx)return void ac(dc("目前沒有尚未開拍的場次","No upcoming session"));
      const{day,S}=nx,type=ty.value,itemId="feather"===type||"shard"===type?type:it.value,qty=Math.floor(parseCoinInput(document.getElementById("gm-rl-ex-qty").value)),price=parseCoinInput(document.getElementById("gm-rl-ex-price").value),inc=parseFloat(document.getElementById("gm-rl-ex-inc").value);
      if(!itemId)return void ac(dc("請選擇物品","Choose an item"));
      if(!(qty>=1&&qty<=99999))return void ac(dc("數量要在 1～99999","Quantity must be 1–99999"));
      if(!(price>=1))return void ac(dc("起標價要大於 0","Start bid must be above 0"));
      if(!(inc>=1&&inc<=100))return void ac(dc("加價% 要在 1～100","Increment % must be 1–100"));
      if(await relicSessStartedAny(day,S.idx))return void ac(dc("這一場已經建立拍品，請改加下一場","This session's lots are already created"));
      if(relicExtrasFor(day,S.idx).length>=8)return void ac(dc("每場最多 8 件特別拍品","Up to 8 special lots per session"));
      const today=ys(),entry={id:"x"+Date.now().toString(36)+Math.random().toString(36).slice(2,5),day,sess:S.idx,tk:1,itemType:type,itemId,qty,startBid:price,incPct:inc};
      await relicExtrasUpdate(a=>a.filter(x=>x&&x.day>=today).concat([entry]));
      ac(dc("已加入下一場拍賣大廳","Added to the next hall session"))
    }catch(err){console.error(err);ac(dc("加入失敗，請稍後再試","Failed, try again later"))}
    finally{add.disabled=!1;await relicGmExtrasRender()}
  }
}


/* ===== 價格輸入：可寫 1k / 10k / 100k / 1m / 10m / 100m / 1b，也可寫一般數字 ===== */
function relicCoinStr(n){n=Math.floor(Number(n));if(!isFinite(n)||n<=0)return String(isFinite(n)?n:"");for(const[u,d]of[["b",1e9],["m",1e6],["k",1e3]])if(n>=d&&n%d===0)return n/d+u;return String(n)}
function relicPricePresetAttach(){
  try{
    if(!document.getElementById("rl-price-presets")){const dl=document.createElement("datalist");dl.id="rl-price-presets";dl.innerHTML=["1k","10k","100k","1m","10m","100m","1b"].map(x=>`<option value="${x}"></option>`).join("");document.body.appendChild(dl)}
    ["gm-rl-minp-common","gm-rl-minp-rare","gm-rl-minp-epic","gm-rl-minp-legendary","gm-rl-incf","gm-rl-ex-price","ant-gm-bp-common","ant-gm-bp-rare","ant-gm-bp-epic","ant-gm-bp-legendary","ant-gm-minrank"].forEach(id=>{const el=document.getElementById(id);el&&el.setAttribute("list","rl-price-presets")})
  }catch(_){}
}


/* ===== 全站數字欄位：輸入數字後按 k / m / b 就自動展開（5 + m → 5000000；1.5 + k → 1500） =====
   只作用在數字欄位（type=number 或 inputmode=numeric/decimal），聊天、暱稱等文字欄位不受影響。
   觸控裝置沒有字母鍵，所以欄位被點選時會在下方浮出 ×k ×m ×b 三顆小按鈕。 */
const RELIC_SHORT_MULT={k:1e3,K:1e3,m:1e6,M:1e6,b:1e9,B:1e9};
function relicIsNumField(el){return!!(el&&"INPUT"===el.tagName&&!el.readOnly&&!el.disabled&&!el.hasAttribute("data-no-short")&&("number"===el.type||/^(numeric|decimal)$/.test(el.getAttribute("inputmode")||"")))}
function relicExpandShort(el,mult){
  const raw=String(el.value||"").replace(/[,_\s]/g,"");
  if(!/^\d+(\.\d+)?$/.test(raw))return!1;
  const n=Math.round(parseFloat(raw)*mult);if(!isFinite(n)||n>9e15)return!1;
  el.value=String(n);el.dispatchEvent(new Event("input",{bubbles:!0}));el.dispatchEvent(new Event("change",{bubbles:!0}));return!0
}
;(function(){try{
  document.addEventListener("keydown",ev=>{
    const el=ev.target;if(!relicIsNumField(el)||ev.ctrlKey||ev.metaKey||ev.altKey)return;
    const m=RELIC_SHORT_MULT[ev.key];if(!m)return;
    if(relicExpandShort(el,m))ev.preventDefault()
  },!0);
  /* 觸控裝置：浮動小按鈕 */
  let bar=null,cur=null;
  const hide=()=>{bar&&(bar.style.display="none");cur=null};
  const show=el=>{
    if(!bar){bar=document.createElement("div");bar.id="rl-short-bar";bar.style.cssText="position:absolute;z-index:3000;display:none;gap:6px;padding:4px 6px;background:#241446;border:1px solid var(--gold,#c9a24a);border-radius:10px;box-shadow:0 4px 14px rgba(0,0,0,.5)";
      bar.innerHTML=[["k",1e3],["m",1e6],["b",1e9]].map(([t,mu])=>`<button type="button" data-mu="${mu}" style="min-width:44px;padding:6px 10px;border:1px solid rgba(201,162,74,.5);border-radius:8px;background:#34215f;color:#f0d78c;font-weight:700;font-size:14px;">×${t.toUpperCase()}</button>`).join("");
      bar.addEventListener("mousedown",e=>e.preventDefault());bar.addEventListener("touchstart",e=>{e.preventDefault();const b=e.target.closest("button");b&&cur&&relicExpandShort(cur,+b.dataset.mu)},{passive:!1});
      bar.addEventListener("click",e=>{const b=e.target.closest("button");b&&cur&&relicExpandShort(cur,+b.dataset.mu)});
      document.body.appendChild(bar)}
    const r=el.getBoundingClientRect();cur=el;bar.style.display="flex";bar.style.left=Math.max(4,Math.min(window.scrollX+r.left,window.scrollX+document.documentElement.clientWidth-150))+"px";bar.style.top=(window.scrollY+r.bottom+4)+"px"
  };
  document.addEventListener("focusin",ev=>{if(window.matchMedia&&window.matchMedia("(pointer:coarse)").matches&&relicIsNumField(ev.target))show(ev.target);else if(!(bar&&bar.contains(ev.target)))hide()});
  document.addEventListener("focusout",()=>setTimeout(()=>{const a=document.activeElement;if(!relicIsNumField(a))hide()},150))
}catch(_){}})();

function relicHallSfx(k,n){
  if("bid"===k){relicHallTone(660,.08,"square",.06);relicHallTone(990,.1,"square",.05,.06)}
  else if("tick"===k)relicHallTone(380+90*(n||1),.12,"triangle",.09);
  else if("sold"===k){relicHallTone(110,.25,"sine",.3);relicHallTone(80,.3,"sine",.25,.04)}
  else if("win"===k)[523,659,784,1046].forEach((f,i)=>relicHallTone(f,.25,"triangle",.1,.1*i));
  else if("lose"===k)[330,262].forEach((f,i)=>relicHallTone(f,.3,"sawtooth",.06,.14*i))
}

/* 選場次：最近一場「已開始（或 5 分鐘內將開始）」的；沒有就取下一場 */
function relicHallPickSession(){
  const now=relicSrvNow(),day=ys(now),min=fs(now),SS=relicSessionsFor(day,RELIC_CFG);let cur=null,next=null;
  for(const S of SS){if(min>=S.dm-5)cur=S;else if(!next)next=S}
  return{day,min,SS,cur,next}
}
async function relicHallPoll(){
  const H=RELIC_HALL;if(!H.open||H.polling||"visible"!==document.visibilityState)return;H.polling=!0;
  try{
    await relicSyncClock();
    const P=relicHallPickSession();H.P=P;let S=P.cur||P.next,lots=[],preview=null;
    /* GM 測試場優先（立即上架今日拍賣（測試））*/
    let testLots=[];
    if(Yg()){try{const rows=RPARSE(await RKV.listValues("auction:relic-test-")).map(ru).filter(r=>r.isTest&&r.live).sort((x,y)=>y.createdAt-x.createdAt).slice(0,3).sort((x,y)=>(x.slot||0)-(y.slot||0));if(rows.length&&relicSrvNow()<Math.max(...rows.map(r=>r.endsAt))+6e4)testLots=rows}catch(_){}}
    if(testLots.length){S={idx:-1,dm:0,em:0,test:!0};lots=testLots}
    else if(S){
      const rows=await RKV.listValues("auction:relic-"+P.day+"-");
      lots=RPARSE(rows).map(ru).filter(r=>r.isSystem&&!r.isTest&&r.relicDay===P.day&&(r.relicSess||0)===S.idx).sort((x,y)=>(x.slot||0)-(y.slot||0));
      if(!lots.length){const t=Date.now();if(t-H.tickAt>8e3){H.tickAt=t;relicDailyTick().catch(()=>{})}preview=await relicDrawGet(P.day,S.idx)}
    }
    H.S=S;H.lots=lots;H.preview=preview;
    relicHallMaintain();
  }catch(err){console.warn("[relicHall] poll",err)}
  finally{H.polling=!1}
  relicHallUpdate()
}
/* 落槌結算 + 上一件結束後把下一件提早開拍（冪等，任何在線玩家都可以做） */
function relicHallMaintain(){
  const H=RELIC_HALL,now=relicSrvNow(),V=relicLive(),L=H.lots;
  L.forEach((r,k)=>{
    const ended="active"!==r.status||now>=r.endsAt;
    if("active"===r.status&&now>=r.endsAt+(r.live?1500:0)&&!(H.settleAt[r.id]>Date.now()-4e3)){H.settleAt[r.id]=Date.now();fu(r).then(()=>{}).catch(()=>{})}
    if(ended&&k+1<L.length){
      const nx=L[k+1];
      if("active"===nx.status&&nx.live&&!nx.currentBidder&&!nx.advanced&&now<nx.opensAt){
        const tgt=Math.max(r.endsAt+V.gapMs,now+2e3);
        if(tgt<nx.opensAt-1500&&!(H.advAt[nx.id]>Date.now()-6e3)){
          H.advAt[nx.id]=Date.now();const cap=nx.hardEnd-nx.opensAt;
          yu(nx.id,x=>{if("active"!==x.status||x.currentBidder||x.advanced||x.opensAt<=tgt)return;x.advanced=!0;x.opensAt=tgt;x.hardEnd=tgt+cap;x.endsAt=tgt+Math.min(V.openMs,cap)}).catch(()=>{})
        }
      }
    }
  })
}

/* ---------- 出價 ---------- */
function relicHallAmt(rec){
  const mn=aucMinBid(rec),cu=document.getElementById("rh-cust"),c=cu?parseCoinInput(cu.value):0;
  if(c>0)return Math.max(mn,c);
  const r=[0,.1,.25,.5][RELIC_HALL.raise||0],base=rec.currentBid>0?rec.currentBid:rec.startBid;
  return r?Math.max(mn,relicNiceUp(base*(1+r))):mn
}
async function relicHallBid(rec0,amount){
  const H=RELIC_HALL,me=zl.nickname,V=relicLive();
  if(H.busy||!me)return;if(relicHallIsLast(rec0,me)){ac(dc("你已經是最高出價者，要等別人出價後才能再出價","You are the top bidder — wait for someone else to bid"));return}H.busy=!0;relicHallUpdate();
  try{
    const ml=me.toLowerCase(),fee=0;
    if(zl.player&&zl.player.coins<amount+fee){try{await qc()}catch(_){}}
    let err=null;
    const fresh=await Wl(me,p=>{err=null;if(amount+fee>p.coins){err="short";return}p.coins-=amount+fee;Fs(p,"auction",1)});
    if(!fresh)return;
    if("short"===err){ac(dc("金幣不足","Not enough coins"));return}
    zl.player=fresh;Au();
    let bidErr=null,prevBidder=null,prevAmt=0,need=0,claimed=null;
    try{
      claimed=await yu(rec0.id,i=>{
        bidErr=null;const now=relicSrvNow();
        if("active"!==i.status||now>=i.endsAt||(i.hardEnd&&now>=i.hardEnd)){bidErr="ended";return}
        if(now<i.opensAt){bidErr="early";return}
        if(relicHallIsLast(i,me)){bidErr="lead";return}
        if(RELIC_ONE_BID_PER_LOT&&relicHallBidded(i,me)){bidErr="dup";return}
        need=aucMinBid(i);if(amount<need){bidErr="low";return}
        prevBidder=i.currentBidder;prevAmt=i.currentBid;
        i.currentBid=amount;i.currentBidder=me;
        Array.isArray(i.bidHistory)||(i.bidHistory=[]);i.bidHistory.push({bidder:me,amount,at:now});i.bidHistory.length>20&&(i.bidHistory=i.bidHistory.slice(-20));
        i.nBids=(i.nBids||0)+1;i.bset=i.bset||{};i.bset[ml]=1;
        i.lastBidAt=now;i.endsAt=Math.min(now+V.resetMs,i.hardEnd||1/0)
      })
    }catch(x){console.error("[relicHall] bid update failed",x);bidErr="error"}
    if(!claimed||bidErr){
      /* 失敗：把預扣的金幣全數退回 */
      try{const f=await Wl(me,p=>{p.coins+=amount+fee});f?zl.player=f:await kd(me,"coins",{amount:amount+fee})}catch(_){await kd(me,"coins",{amount:amount+fee})}
      Au();
      ac("ended"===bidErr?dc("這一件已經落槌了","This lot has closed"):"early"===bidErr?dc("還沒開拍","Not open yet"):"lead"===bidErr?dc("你已經是最高出價者","You are already the top bidder"):"dup"===bidErr?dc("你已經在這一件出過價了，每人每件只能出價一次","You already bid on this lot — one bid per person per lot"):"low"===bidErr?dc(`出價至少要 ✦${fmtCoin(need)}`,`Bid at least ✦${fmtCoin(need)}`):dc("出價失敗，金幣已退回，請再試一次","Bid failed, coins refunded — try again"));
      relicHallPoll();return
    }
    /* 成功：退款給被超過的人（對方上線後會自動入帳；大廳內的人會即時同步） */
    if(prevBidder&&prevBidder!==me)await kd(prevBidder,"coins",{amount:prevAmt,id:"bidrefund:"+claimed.id+":"+(claimed.nBids||0)});
    const k=H.lots.findIndex(r=>r.id===claimed.id);k>=0&&(H.lots[k]=claimed);
    relicHallSfx("bid");
  }finally{H.busy=!1;relicHallUpdate()}
}
/* 被超過後，把退款領回來（退款是由對方的畫面寫入的，可能慢一兩秒，所以多試幾次） */
function relicHallSyncCoins(){
  [1200,3500,7000].forEach(ms=>setTimeout(()=>{if(!RELIC_HALL.open)return;qc().then(()=>{Au();relicHallUpdate()}).catch(()=>{})},ms))
}

/* ---------- 畫面 ---------- */
const RELIC_HALL_RES_MS=8e3;
function relicHallWho(rec,nick){
  const me=zl.nickname===nick;
  return me?dc("你","You"):Iu(nick)
}
function relicHallShell(){
  return`<div class="rh-modal" id="rh-modal"><div class="rh-curtain l"></div><div class="rh-curtain r"></div><div class="rh-dust" id="rh-dust"></div><div class="rh-top"><b>🔨 ${dc("拍賣大廳","Auction Hall")}</b><span class="rh-live" id="rh-live"></span><span class="rh-sess" id="rh-sess"></span><span class="rh-coin" id="rh-coin"></span><button class="rh-mute" id="rh-mute" title="sound"></button><span class="rm-x" id="rh-x">✕</span></div><div class="rh-lots" id="rh-lots"></div><div id="rh-body"></div></div>`
}
/* 目前拍品：自己擁有的數量 */
function relicHallOwnedQty(rec){
  const p=zl.player;if(!p||!rec)return 0;
  const t=rec.itemType||"relic",id=rec.itemId,n=v=>Math.max(0,Math.floor(Number(v)||0));
  if("relic"===t)return n(p.relics&&p.relics[id]);
  if("feather"===t)return n(p.feathers);
  if("shard"===t)return n(p.materials&&p.materials.mysteryShard);
  if("material"===t)return n(p.professionMaterials&&p.professionMaterials[id]);
  if("professionItem"===t)return n(p.professionItems&&p.professionItems[id]);
  if("card"===t)return n(p.cards&&p.cards[id]);
  return 0
}
function relicHallOwnHtml(rec){
  const q=relicHallOwnedQty(rec);
  return q>0?dc(`📦 你目前持有 <b>×${q.toLocaleString()}</b>`,`📦 You own <b>×${q.toLocaleString()}</b>`):dc("📦 你目前沒有這件物品","📦 You don't own this item yet")
}
function relicHallBuildLot(rec){
  const info=relicHallInfo(rec);
  return`<div class="rh-stage" id="rh-stage" style="--tc:${info.color};"><div class="rh-spot"></div><div class="rh-lotno" id="rh-lotno"></div><div class="rh-art"><div class="rh-aura"></div><div class="rh-frame">${info.art(112)}</div><div class="rh-ped"></div></div><div class="rh-nm" style="color:${info.color};">${Iu(info.name)}</div><div class="rh-tags">${info.tags}</div><div class="rh-own" id="rh-own"></div><div class="rh-lore">${Iu(info.lore)}</div><div class="rh-price"><small id="rh-plbl"></small><div class="n" id="rh-price"></div></div><div class="rh-lead" id="rh-lead"></div><div class="rh-timer"><i id="rh-tbar"></i></div><div class="rh-auc" id="rh-auc"></div><div class="rh-stamp" id="rh-stamp"></div><div class="rh-gavel" id="rh-gavel">🔨</div><div class="rh-fx" id="rh-fx"></div></div>
  <div class="rh-acts"><button class="btn rh-paddle" id="rh-paddle"></button><div class="rh-chips" id="rh-chips">${[dc("最低","Min"),"+10%","+25%","+50%"].map((z,i)=>`<button data-i="${i}">${z}</button>`).join("")}</div><div class="rh-custom"><span>${dc("自訂","Custom")}</span><input id="rh-cust" type="text" inputmode="text" placeholder="${dc("輸入金額，可用 5m、1.2b","Amount, e.g. 5m, 1.2b")}" autocomplete="off"><button class="btn small secondary" id="rh-custx">${dc("清除","Clear")}</button></div></div>
  <div class="rh-logh">${dc("喊價紀錄","Bid ledger")}</div><div class="rh-log" id="rh-log"></div>
  <p class="rh-rules">${dc("規則：每次有人出價，倒數重置；倒數歸零就落槌。不能連續出價兩次，要等別人出價後才能再出價。出價金額會先扣，被超過後自動退回。成交價公開。成交金幣由系統回收。","Rules: every bid resets the countdown; at zero the gavel falls. You can't bid twice in a row — someone else must bid first. Your bid is held until you are outbid, then refunded. Final prices are public. Coins paid are removed from the economy.")}</p>`
}
function relicHallResultLine(rec){
  return rec.currentBidder
    ?dc(`「${relicHallWho(rec,rec.currentBidder)}」以 ✦${fmtCoin(rec.currentBid)} 得標`,`“${relicHallWho(rec,rec.currentBidder)}” won at ✦${fmtCoin(rec.currentBid)}`)
    :dc("無人出價，流標","No bids — unsold")
}
function relicHallSummary(){
  const H=RELIC_HALL,P=H.P||{},rows=H.lots.map(r=>{const it=relicHallInfo(r);return it?`<div class="listing"><div class="left">${it.art(42)}<div class="meta"><div><span style="color:${it.color};font-weight:600;">${Iu(it.name)}</span> ${it.tags}</div><div class="who">${relicHallResultLine(r)}</div></div></div></div>`:""}).join("");
  let nx="";if(P.next&&P.cur!==P.next)nx=dc(`下一場：今天 ${relicTimeStr(P.next.dm)}`,`Next session: today ${relicTimeStr(P.next.dm)}`);else{const t=relicHallNextDayStart();t&&(nx=dc(`下一場：${t}`,`Next session: ${t}`))}
  return`<div class="rh-sum"><h3>${dc("本場拍賣結束","Session finished")}</h3>${rows}<p class="who" style="margin-top:8px;">${nx||""}</p></div>`
}
function relicHallNextDayStart(){
  try{const d=relicAddDays(ys(relicSrvNow()),1),SS=relicSessionsFor(d,RELIC_CFG);return SS.length?`${d} ${relicTimeStr(SS[0].dm)}`:""}catch(_){return""}
}
function relicHallPreviewHtml(){
  const H=RELIC_HALL,S=H.S;if(!S)return`<div class="empty-note">${dc("今天沒有拍賣場次","No auction sessions today")}</div>`;
  const ids=H.preview&&H.preview.ids||[];
  const exs=relicExtrasFor(P0day(),S.idx).map(x=>{const mt=relicExtraMeta(x.itemType,x.itemId,x.qty);return`<div class="listing"><div class="left">${mt.it?relicIconBox(mt.it,48):`<div class="icon-box" style="display:flex;align-items:center;justify-content:center;font-size:24px;border-color:${mt.color};">${mt.icon}</div>`}<div class="meta"><div><span style="color:${mt.color};font-weight:600;">${Iu(mt.label)}</span></div><div class="who">${dc("特別位","Special")} · ${dc("起標","Start")} ✦${fmtCoinShort(x.startBid)}</div></div></div></div>`}).join("");
  const cards=[0,1,2].map(s=>{const it=RELIC_BY_ID[ids[s]];return it?`<div class="listing"><div class="left">${relicIconBox(it,42)}<div class="meta"><div><span style="color:${RELIC_TIERS[it.tier].color};font-weight:600;">${Iu(relicName(it))}</span> ${relicTagHtml(it)}</div><div class="who">${Iu(dc(RELIC_SLOT_NAMES[s].zh,RELIC_SLOT_NAMES[s].en))} · ${dc("起標","Start")} ✦${fmtCoinShort(RELIC_CFG.minPrice[it.tier])}</div></div></div></div>`:""}).join("");
  return`<div class="rh-sum"><h3>${dc(`${relicTimeStr(S.dm)} 場即將開始`,`${relicTimeStr(S.dm)} session starting soon`)}</h3><p class="who">${dc("拍賣行正在準備拍品…","The auction house is preparing the lots…")}</p>${cards||`<div class="empty-note">${dc("今日名單尚未公布","Today's list has not been announced yet")}</div>`}${exs}</div>`
}
function relicHallSet(el,h){if(el&&el._h!==h){el.innerHTML=h;el._h=h}}

/* 氛圍特效：出價時金幣噴發、得標時彩紙 */
function relicHallBurst(mine){
  const fx=document.getElementById("rh-fx"),st=document.getElementById("rh-stage");if(!fx)return;
  st&&(st.classList.remove("flash"),void st.offsetWidth,st.classList.add("flash"));
  let s="";const n=mine?14:8;for(let k=0;k<n;k++){const dx=Math.round((Math.random()-.5)*180),dy=70+Math.round(Math.random()*70);s+=`<b style="--dx:${dx}px;--dy:-${dy}px;animation-delay:${(Math.random()*.15).toFixed(2)}s">${mine&&k%3==0?"🪙":"✦"}</b>`}
  const w=document.createElement("div");w.className="rh-burst";w.innerHTML=s;fx.appendChild(w);setTimeout(()=>w.remove(),1300)
}
function relicHallConfetti(){
  const fx=document.getElementById("rh-fx");if(!fx)return;
  const cols=["#e8c468","#6fcf8a","#c15b5b","#7fb6ff","#d98cff"];let s="";
  for(let k=0;k<36;k++)s+=`<i style="left:${Math.round(Math.random()*100)}%;background:${cols[k%5]};animation-delay:${(Math.random()*.6).toFixed(2)}s;animation-duration:${(1.8+Math.random()*1.4).toFixed(1)}s;--r:${Math.round(Math.random()*720-360)}deg"></i>`;
  const w=document.createElement("div");w.className="rh-confetti";w.innerHTML=s;fx.appendChild(w);setTimeout(()=>w.remove(),4200)
}
function relicHallUpdate(){
  const H=RELIC_HALL;if(!H.open)return;
  const body=document.getElementById("rh-body");if(!body)return;
  const now=relicSrvNow(),V=relicLive(),L=H.lots,me=zl.nickname||"";
  const coin=document.getElementById("rh-coin");coin&&zl.player&&(coin.textContent="✦ "+fmtCoin(zl.player.coins));
  const mu=document.getElementById("rh-mute");mu&&(mu.textContent=H.muted?"🔇":"🔊");
  const lvb=document.getElementById("rh-live");if(lvb){const anyLive=L.some(r=>"active"===r.status&&now>=r.opensAt&&now<r.endsAt);lvb.className="rh-live"+(anyLive?" on":"");lvb.textContent=anyLive?"● LIVE":""}
  const sess=document.getElementById("rh-sess");if(sess)sess.textContent=H.S?H.S.test?dc("測試場","Test"):relicTimeStr(H.S.dm)+dc(" 場"," session"):"";
  /* 決定要顯示哪一件 */
  let mode="none",rec=null,vi=-1;
  if(H.S&&!L.length)mode="preview";
  else if(L.length){
    let k=L.findIndex(r=>!("active"!==r.status||now>=r.endsAt));
    if(-1===k){const last=L[L.length-1];vi=L.length-1;rec=last;mode=now<last.endsAt+RELIC_HALL_RES_MS?"lot":"summary"}
    else{vi=k;rec=L[k];mode="lot";if(k>0&&now<rec.opensAt){const pv=L[k-1];if(now<pv.endsAt+RELIC_HALL_RES_MS){rec=pv;vi=k-1}}}
  }
  /* 上方三件的進度列 */
  const strip=document.getElementById("rh-lots");
  if(strip)relicHallSet(strip,L.map((r,k)=>{const it=relicHallInfo(r),ended="active"!==r.status||now>=r.endsAt,live=!ended&&now>=r.opensAt,st=ended?(r.currentBidder?"✔":"—"):live?"●":"…";return`<div class="rh-lt ${k===vi?"cur":""} ${ended?"done":live?"live":""}"><span>${st}</span><b>${Iu(relicHallSlotName(r.slot))}</b><small>${it?Iu(it.name):""}</small></div>`}).join(""));
  const key=mode+":"+(rec?rec.id:"");
  if("none"===mode){if(H.shown!==key){H.shown=key;body.innerHTML=relicHallPreviewHtml();body._h=null}return}
  if("preview"===mode){H.shown="preview";relicHallSet(body,relicHallPreviewHtml());return}
  if("summary"===mode){if(H.shown!==key){H.shown=key;body.innerHTML=relicHallSummary();body._h=null}return}
  /* ---- lot 模式 ---- */
  const it=relicHallInfo(rec);if(!it)return;
  H.cur=rec;
  if(H.shown!==key){
    H.shown=key;H.raise=0;body.innerHTML=relicHallBuildLot(rec);body._h=null;
    body.querySelectorAll("#rh-chips button").forEach(b=>b.onclick=()=>{H.raise=+b.dataset.i;const c=document.getElementById("rh-cust");c&&(c.value="");relicHallUpdate()});
    document.getElementById("rh-paddle").onclick=()=>{const r=H.cur;if(!r)return;relicHallBid(r,relicHallAmt(r))};
    document.getElementById("rh-cust").oninput=()=>{H.raise=0;relicHallUpdate()};
    document.getElementById("rh-custx").onclick=()=>{document.getElementById("rh-cust").value="";relicHallUpdate()};
  }
  const ended="active"!==rec.status||now>=rec.endsAt,upcoming=!ended&&now<rec.opensAt,mine=rec.currentBidder===me,sold=!!rec.currentBidder;
  const set=(id,h)=>relicHallSet(document.getElementById(id),h);
  const nBidders=Object.keys(rec.bset||{}).length;
  set("rh-lotno",dc(`第 ${vi+1} / ${L.length} 件 · ${Iu(relicHallSlotName(rec.slot))} · ${nBidders} 人出價 · ${rec.nBids||0} 次`,`Lot ${vi+1}/${L.length} · ${Iu(relicHallSlotName(rec.slot))} · ${nBidders} bidders · ${rec.nBids||0} bids`));
  set("rh-own",relicHallOwnHtml(rec));
  set("rh-plbl",rec.currentBid>0?dc("目前價","Current bid"):dc("起標價","Starting bid"));
  const pe=document.getElementById("rh-price"),ptxt="✦ "+fmtCoin(rec.currentBid>0?rec.currentBid:rec.startBid);
  if(pe&&pe.textContent!==ptxt){pe.textContent=ptxt;pe.classList.remove("pop");void pe.offsetWidth;pe.classList.add("pop")}
  set("rh-lead",rec.currentBidder?(ended?dc("得標：","Winner: "):dc("領先：","Leading: "))+`「${relicHallWho(rec,rec.currentBidder)}」`:"—");
  const ld=document.getElementById("rh-lead");ld&&ld.classList.toggle("me",!!mine);
  const stage=document.getElementById("rh-stage");stage&&stage.classList.toggle("hot",(rec.nBids||0)>=6&&!ended);
  /* 倒數條 + 拍賣師台詞 */
  const left=rec.endsAt-now,tbar=document.getElementById("rh-tbar");let auc="",warn=!1;
  if(ended){tbar&&(tbar.style.transform="scaleX(0)");auc=sold?relicHallResultLine(rec):dc("無人出價，流標","No bids — unsold");
    const nx=L[vi+1];if(nx&&"active"===nx.status&&now<nx.opensAt+V.openMs)auc+=` · ${dc("下一件","Next lot")} ${Math.max(0,Math.ceil((nx.opensAt-now)/1e3))} s`}
  else if(upcoming){tbar&&(tbar.style.transform="scaleX(1)");auc=dc(`拍賣師正在介紹拍品… ${Math.max(0,Math.ceil((rec.opensAt-now)/1e3))} 秒後開拍`,`The auctioneer is introducing the lot… starts in ${Math.max(0,Math.ceil((rec.opensAt-now)/1e3))}s`)}
  else{
    const total=rec.nBids?V.resetMs:Math.max(1e3,rec.endsAt-rec.opensAt);tbar&&(tbar.style.transform=`scaleX(${Math.max(0,Math.min(1,left/total))})`);
    if(rec.nBids&&left<RELIC_GO_MS){const s=Math.max(1,Math.ceil(left/RELIC_GO_STEP)),n=[0,"三","二","一"][s]||"一";auc=dc(`✦${fmtCoinShort(rec.currentBid)} 第${n}次……`,`✦${fmtCoinShort(rec.currentBid)} going ${["","thrice","twice","once"][s]||"once"}…`);warn=1===s}
    else if(rec.nBids)auc=dc(`「${relicHallWho(rec,rec.currentBidder)}」出價 ✦${fmtCoinShort(rec.currentBid)}！`,`“${relicHallWho(rec,rec.currentBidder)}” bids ✦${fmtCoinShort(rec.currentBid)}!`);
    else auc=dc(`起標價 ✦${fmtCoinShort(rec.startBid)}，有人要出價嗎？（${Math.max(0,Math.ceil(left/1e3))} 秒）`,`Starting at ✦${fmtCoinShort(rec.startBid)} — any bids? (${Math.max(0,Math.ceil(left/1e3))}s)`)
  }
  const ae=document.getElementById("rh-auc");if(ae){ae.textContent=auc;ae.classList.toggle("warn",warn)}
  const mdl=document.getElementById("rh-modal");mdl&&mdl.classList.toggle("urgent",warn);
  const sp=document.getElementById("rh-stamp");if(sp){const t=ended?(sold?(mine?dc("得標","WON"):dc("成交","SOLD")):dc("流標","UNSOLD")):"";sp.textContent=t;sp.className="rh-stamp"+(t?" show":"")+(mine&&ended&&sold?" win":"");const gv=document.getElementById("rh-gavel");gv&&(gv.className="rh-gavel"+(t?" slam":""))}
  /* 出價紀錄 */
  set("rh-log",(rec.bidHistory||[]).slice(-8).reverse().map(h=>`<div class="${h.bidder===me?"me":""}"><span>${relicHallWho(rec,h.bidder)}</span><b>✦${fmtCoinShort(h.amount)}</b></div>`).join("")||`<div class="who">${dc("還沒有人出價","No bids yet")}</div>`);
  /* 操作區 */
  const amt=relicHallAmt(rec),fee=0,coins=zl.player?zl.player.coins:0,pad=document.getElementById("rh-paddle");
  const dup=RELIC_ONE_BID_PER_LOT&&!mine&&relicHallBidded(rec,me),can=!ended&&!upcoming&&!mine&&!relicHallIsLast(rec,me)&&!dup&&!H.busy&&!!me;
  if(pad){pad.disabled=!can;relicHallSet(pad,ended?dc("拍賣結束","Closed"):upcoming?dc("尚未開拍","Not open yet"):mine?dc("你正領先，等對手出價","You lead — waiting"):dup?dc("你已出過價，這件不能再出價","You already bid on this lot"):H.busy?dc("出價中…","Bidding…"):coins<amt+fee?dc(`金幣不足（需 ✦${fmtCoinShort(amt+fee)}）`,`Not enough coins (need ✦${fmtCoinShort(amt+fee)})`):`🔨 ${dc("舉牌","Bid")} ✦${fmtCoinShort(amt)}`)}
  document.querySelectorAll("#rh-chips button").forEach(b=>b.classList.toggle("on",+b.dataset.i===(H.raise||0)&&!(document.getElementById("rh-cust")&&document.getElementById("rh-cust").value)));
  /* 音效與提示（只在狀態變化時觸發一次）*/
  const sn=H.seen[rec.id]||(H.seen[rec.id]={n:rec.nBids||0,lead:rec.currentBidder,end:!1});
  if((rec.nBids||0)>sn.n){
    relicHallBurst(rec.currentBidder===me);
    if(rec.currentBidder!==me)relicHallSfx("bid");
    if(sn.lead===me&&rec.currentBidder!==me){ac(dc("你被超過了！退款會自動回到你的金幣","You were outbid — your refund is on its way"));relicHallSyncCoins()}
    sn.n=rec.nBids||0;sn.lead=rec.currentBidder
  }
  if(!ended&&rec.nBids&&left<RELIC_GO_MS&&left>0){const s=Math.ceil(left/RELIC_GO_STEP);if(H.tickN[rec.id]!==s){H.tickN[rec.id]=s;relicHallSfx("tick",s)}}
  if(ended&&!sn.end){
    sn.end=!0;relicHallSfx("sold");
    if(sold&&mine&&!H.wonDone[rec.id]){H.wonDone[rec.id]=1;relicHallConfetti();setTimeout(()=>relicHallSfx("win"),250);ac(dc(`🎉 你拍得了「${it.name}」！`,`🎉 You won ${it.name}!`),{legendary:!0});[2500,6000].forEach(ms=>setTimeout(()=>{qc().then(()=>{Au();relicHallUpdate()}).catch(()=>{})},ms))}
    else if(sold&&!mine&&rec.bset&&rec.bset[me.toLowerCase()])relicHallSfx("lose")
  }
}
function relicHallOpen(){
  if(!relicVisible()){ac(dc("拍賣大廳尚未開放","The Auction Hall is not open yet"));return}
  if(!zl.nickname||!zl.player)return;
  const H=RELIC_HALL;if(H.open)return;H.open=!0;try{const pp=document.getElementById("rh-pop");pp&&pp.remove()}catch(_){}H.shown=null;H.cur=null;
  const ov=document.createElement("div");ov.className="relic-overlay";ov.id="relic-hall";ov.innerHTML=relicHallShell();document.body.appendChild(ov);
  document.getElementById("rh-x").onclick=relicHallClose;
  try{const du=document.getElementById("rh-dust");let s="";for(let k=0;k<18;k++)s+=`<i style="left:${Math.round(Math.random()*100)}%;animation-delay:${(Math.random()*9).toFixed(1)}s;animation-duration:${(7+Math.random()*7).toFixed(1)}s;width:${1+Math.round(Math.random()*2)}px;height:${1+Math.round(Math.random()*2)}px"></i>`;du.innerHTML=s}catch(_){}
  document.getElementById("rh-mute").onclick=()=>{H.muted=!H.muted;try{localStorage.setItem("relic-hall-mute",H.muted?"1":"0")}catch(_){}relicHallUpdate()};
  relicEnsureConfig(!0).catch(()=>{}).then(()=>{relicHallPoll()});
  {const gen=H.pollGen=(H.pollGen||0)+1;const sched=()=>{if(!H.open||H.pollGen!==gen)return;const nw=relicSrvNow(),hot=(H.lots||[]).some(r=>"active"===r.status&&r.endsAt-nw<9e3&&r.endsAt-nw>-3e3&&nw>=r.opensAt-2e3);H.pollT=setTimeout(()=>{Promise.resolve(relicHallPoll()).catch(()=>{}).then(sched)},(hot?1e3:2200)+Math.random()*500)};sched()}
  H.uiT=setInterval(relicHallUpdate,250);
  relicHallFabTick()
}
function relicHallClose(){
  const H=RELIC_HALL;H.open=!1;clearTimeout(H.pollT);clearInterval(H.pollT);clearInterval(H.uiT);
  const el=document.getElementById("relic-hall");el&&el.remove();
  Bu&&"auction"===zl.tab&&Bu();relicHallFabTick()
}
/* 浮動入口：拍賣會開始前 5 分鐘到結束，在任何頁面都看得到 */

/* 開拍通知窗：每個時間點每位玩家只彈一次（localStorage + 記憶體），點「進入拍賣大廳」直接開啟 */
const RELIC_POP_SEEN={};
function relicHallPopup(key,timeStr,n,opts){const tt=!!(opts&&opts.test);
  if(RELIC_POP_SEEN[key]||document.getElementById("rh-pop"))return;
  const lk="relic-hall-pop:"+(zl.nickname||"")+":"+key;
  try{if(localStorage.getItem(lk)){RELIC_POP_SEEN[key]=1;return}}catch(_){}
  RELIC_POP_SEEN[key]=1;try{localStorage.setItem(lk,"1")}catch(_){}
  if(!document.getElementById("rh-pop-css")){const st=document.createElement("style");st.id="rh-pop-css";st.textContent=".rh-pop{position:fixed;left:0;right:0;top:0;bottom:0;z-index:2000;display:flex;align-items:center;justify-content:center;background:rgba(8,4,20,.72);padding:16px}.rh-pop-box{max-width:360px;width:100%;border:1px solid var(--gold);border-radius:16px;background:linear-gradient(180deg,#2b1c52,#1a0f33);padding:20px 18px;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,.6);animation:rhPopIn .35s ease-out}.rh-pop-box h3{margin:0 0 6px;font-family:Cinzel,serif;color:var(--gold-bright);font-size:20px}.rh-pop-box p{margin:6px 0 14px;font-size:13px;color:var(--muted);line-height:1.6}.rh-pop-ic{font-size:44px;line-height:1.1}.rh-pop-btns{display:flex;gap:8px;justify-content:center}@keyframes rhPopIn{from{transform:scale(.9);opacity:0}to{transform:none;opacity:1}}";document.head.appendChild(st)}
  const el=document.createElement("div");el.id="rh-pop";el.className="rh-pop";
  el.innerHTML=`<div class="rh-pop-box"><div class="rh-pop-ic">🔨</div><h3>${tt?dc("測試拍賣開始了！","Test auction is live!"):dc("古董拍賣開始了！","The auction has begun!")}</h3><p>${tt?dc(`測試場：15 秒後開拍，依序拍賣 ${n||3} 件（不佔用正式名單、不計限量）。進去試試出價吧！`,`Test session: starts in 15s, ${n||3} lots (no official draw, no supply count). Try bidding!`):dc(`${timeStr} 場次現正喊價：依序拍賣 普通位 → 稀有位 → 高階位${n>3?` → 特別位`:""}，共 ${n||3} 件。拿起你的牌，出價吧！`,`The ${timeStr} session is live: ${n||3} lots in order — Common, Rare, Top${n>3?", Special":""}. Raise your paddle!`)}</p><div class="rh-pop-btns"><button class="btn" id="rh-pop-go">${dc("進入拍賣大廳","Enter the Hall")}</button><button class="btn secondary" id="rh-pop-x">${dc("稍後","Later")}</button></div></div>`;
  document.body.appendChild(el);
  const close=()=>{el.remove()};
  el.querySelector("#rh-pop-go").onclick=()=>{close();try{relicHallOpen()}catch(_){}};
  el.querySelector("#rh-pop-x").onclick=close;
  el.onclick=ev=>{ev.target===el&&close()};
  try{relicHallSfx("sold")}catch(_){}
}
function relicHallFabTick(){
  let f=document.getElementById("relic-hall-fab"),on=!1,txt="";
  try{
    if(relicVisible()&&zl.nickname&&zl.player&&!RELIC_HALL.open&&RELIC_CFG_LOADED){
      const now=relicSrvNow(),day=ys(now);
      if(Date.now()<RELIC_TEST_UNTIL&&Yg()){on=!0;txt=dc("🔨 測試拍賣進行中","🔨 Test auction live")}
      for(const S of relicSessionsFor(day,RELIC_CFG)){const T=relicLiveTimeline(day,S);if(now>=T.dm-3e5&&now<T.dm+T.n*T.span+12e3){on=!0;txt=now<T.dm?dc("🔨 拍賣會即將開始","🔨 Auction starting soon"):dc("🔨 拍賣進行中","🔨 Auction live");now>=T.dm&&now<T.dm+T.n*T.span-1e4&&relicHallPopup(day+"#"+S.idx,relicTimeStr(S.dm),T.n);break}}
    }
  }catch(_){}
  if(!on){f&&f.remove();return}
  if(!f){f=document.createElement("button");f.id="relic-hall-fab";f.className="rh-fab";f.onclick=relicHallOpen;document.body.appendChild(f)}
  f.textContent!==txt&&(f.textContent=txt)
}
/* 拍賣頁頂端的入口卡 */
function relicHallEntryHtml(){
  if(!relicVisible())return"";
  const P=relicHallPickSession(),list=P.SS.map(S=>relicTimeStr(S.dm)).join("、");
  return`<div class="panel"><h2>🔨 ${dc("拍賣大廳","Auction Hall")}</h2><p class="sub">${dc(`每天 ${P.SS.length} 個時間點（${list}，UTC+8）即時喊價，每場依序拍賣 3 件：普通位、稀有位、高階位。每次有人出價倒數重置，沒人加價就落槌。成交價公開。`,`Live bidding ${P.SS.length}× a day (${P.SS.map(S=>relicTimeStr(S.dm)).join(", ")} UTC+8), 3 lots per session: Common, Rare, Premium. Every bid resets the countdown; no new bid and the gavel falls. Final prices are public.`)}</p><div class="form-row" style="margin:6px 0 0;"><button class="btn" data-relic-hall="1">${dc("進入拍賣大廳","Enter the Hall")}</button></div></div>`
}
;(function(){try{
  if(!document.getElementById("relic-hall-style")){
    const st=document.createElement("style");st.id="relic-hall-style";
    st.textContent=".rh-fab{position:fixed;right:12px;bottom:18px;z-index:800;border:1px solid var(--gold);background:linear-gradient(180deg,#3a2a66,#251540);color:var(--gold-bright);border-radius:999px;padding:10px 16px;font-family:Cinzel,serif;font-size:14px;box-shadow:0 4px 18px rgba(0,0,0,.5);cursor:pointer;animation:rhpulse 1.6s infinite}@keyframes rhpulse{0%,100%{box-shadow:0 4px 18px rgba(0,0,0,.5),0 0 0 0 rgba(232,196,104,.5)}50%{box-shadow:0 4px 18px rgba(0,0,0,.5),0 0 0 8px rgba(232,196,104,0)}}"
    +".rh-modal{width:100%;max-width:460px;background:var(--bg-panel);border:1px solid var(--gold);border-radius:16px;padding:14px;position:relative;margin:auto}.rh-top{display:flex;align-items:center;gap:8px;margin-bottom:10px;padding-right:26px}.rh-top b{font-family:Cinzel,serif;color:var(--gold-bright)}.rh-sess{font-size:12px;color:var(--muted)}.rh-coin{margin-left:auto;font-family:'Space Mono',monospace;font-size:13px;color:var(--gold-bright)}.rh-mute{background:none;border:0;font-size:15px;cursor:pointer;color:var(--muted)}"
    +".rh-lots{display:flex;gap:6px;margin-bottom:10px}.rh-lt{flex:1;border:1px solid var(--line);border-radius:10px;padding:6px 4px;text-align:center;font-size:11px;color:var(--muted);background:var(--bg-panel-raised);display:flex;flex-direction:column;gap:1px;min-width:0}.rh-lt b{font-weight:600;color:var(--cream)}.rh-lt small{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rh-lt.cur{border-color:var(--gold)}.rh-lt.live span{color:var(--danger)}.rh-lt.done{opacity:.7}"
    +".rh-stage{position:relative;overflow:hidden;background:linear-gradient(170deg,var(--bg-panel-raised),var(--bg-panel));border:1px solid var(--line);border-radius:14px;padding:14px;text-align:center}.rh-stage.hot{box-shadow:0 0 0 2px rgba(193,91,91,.45),0 0 26px rgba(193,91,91,.25)}.rh-lotno{font-size:11px;color:var(--muted)}.rh-art{display:flex;justify-content:center;margin:8px 0 4px}.rh-nm{font-family:Cinzel,serif;font-size:19px;font-weight:700}.rh-tags{margin:4px 0}.rh-lore{font-size:12px;color:var(--muted);margin:4px 8px;font-style:italic}"
    +".rh-price small{display:block;font-size:11px;color:var(--muted);margin-top:6px}.rh-price .n{font-family:'Space Mono',monospace;font-size:30px;font-weight:700;color:var(--gold-bright);transition:transform .15s}.rh-price .n.pop{animation:rhpop .22s}@keyframes rhpop{0%{transform:scale(1.2)}100%{transform:scale(1)}}.rh-lead{font-size:13px;min-height:20px;margin-top:2px}.rh-lead.me{color:#6fcf8a;font-weight:700}"
    +".rh-timer{height:8px;border-radius:5px;background:rgba(255,255,255,.08);overflow:hidden;margin-top:10px}.rh-timer i{display:block;height:100%;width:100%;background:linear-gradient(90deg,#6fcf8a,#e8c468,#c15b5b);transform-origin:left}.rh-auc{font-size:15px;font-weight:700;min-height:24px;margin-top:8px}.rh-auc.warn{color:var(--danger);animation:rhshake .3s infinite}@keyframes rhshake{0%,100%{transform:translateX(0)}25%{transform:translateX(-2px)}75%{transform:translateX(2px)}}"
    +".rh-stamp{position:absolute;left:50%;top:46%;transform:translate(-50%,-50%) rotate(-12deg);font-family:Cinzel,serif;font-size:38px;font-weight:900;color:var(--danger);border:5px solid var(--danger);border-radius:10px;padding:2px 14px;opacity:0;pointer-events:none;letter-spacing:3px}.rh-stamp.show{animation:rhstamp .45s forwards}.rh-stamp.win{color:#6fcf8a;border-color:#6fcf8a}@keyframes rhstamp{0%{opacity:0;transform:translate(-50%,-50%) rotate(-12deg) scale(2.4)}60%{opacity:1;transform:translate(-50%,-50%) rotate(-12deg) scale(.95)}100%{opacity:.92;transform:translate(-50%,-50%) rotate(-12deg) scale(1)}}"
    +".rh-acts{display:flex;flex-direction:column;gap:8px;margin-top:10px}.rh-paddle{padding:14px;font-size:17px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap}.rh-paddle small{font-size:11px;opacity:.8;font-weight:500}.rh-chips{display:flex;gap:6px}.rh-chips button{flex:1;border:1px solid var(--line);background:var(--bg-panel-raised);color:var(--cream);border-radius:10px;padding:8px 2px;font-size:13px;font-weight:700;cursor:pointer}.rh-chips button.on{border-color:var(--gold);color:var(--gold-bright);background:rgba(201,162,74,.15)}"
    +".rh-custom{display:flex;gap:8px;align-items:center;font-size:12px;color:var(--muted)}.rh-custom input{flex:1;min-width:0}"
    +".rh-log{margin-top:10px;background:var(--bg-panel-raised);border:1px solid var(--line);border-radius:10px;padding:8px 10px;font-size:12px;display:flex;flex-direction:column;gap:3px;min-height:60px}.rh-log div{display:flex;justify-content:space-between;color:var(--muted)}.rh-log div b{color:var(--cream);font-family:'Space Mono',monospace}.rh-log div.me b{color:#6fcf8a}.rh-rules{font-size:11px;color:var(--muted);line-height:1.6;margin:10px 2px 0}.rh-sum h3{font-family:Cinzel,serif;margin:6px 0 10px;text-align:center}.rh-spectag{display:inline-block;font-size:11px;padding:1px 9px;border-radius:999px;border:1px solid rgba(201,162,74,.5);color:var(--gold-bright)}"
    +".rh-modal{overflow:hidden;padding:14px 26px;background:radial-gradient(120% 70% at 50% 0%,#2c1d55 0%,#170d2e 55%,#0d0719 100%);border:1px solid var(--gold);box-shadow:0 0 0 3px rgba(201,162,74,.12),0 0 60px rgba(120,70,200,.28),inset 0 0 50px rgba(0,0,0,.45)}.rh-modal>*{position:relative;z-index:2}.rh-modal>.rh-curtain,.rh-modal>.rh-dust{position:absolute;z-index:1}.rh-curtain{top:0;bottom:0;width:20px;pointer-events:none;background:repeating-linear-gradient(90deg,#5a1020 0 4px,#7c1a30 4px 8px,#4a0c1a 8px 12px);box-shadow:inset 0 0 12px rgba(0,0,0,.6)}.rh-curtain.l{left:0;border-right:2px solid rgba(201,162,74,.55)}.rh-curtain.r{right:0;border-left:2px solid rgba(201,162,74,.55)}.rh-dust{inset:0;pointer-events:none;overflow:hidden}.rh-dust i{position:absolute;bottom:-6px;border-radius:50%;background:rgba(255,226,150,.8);box-shadow:0 0 6px rgba(255,226,150,.8);opacity:0;animation:rhdust linear infinite}@keyframes rhdust{0%{transform:translateY(0);opacity:0}15%{opacity:.8}100%{transform:translateY(-620px);opacity:0}}"
    +".rh-top b{font-size:17px;letter-spacing:2px;text-shadow:0 0 14px rgba(232,196,104,.5)}.rh-live{display:none;font-size:10px;font-weight:800;letter-spacing:1px;color:#fff;background:#c0392b;border-radius:999px;padding:2px 8px;animation:rhlive 1.2s infinite}.rh-live.on{display:inline-block}@keyframes rhlive{0%,100%{box-shadow:0 0 0 0 rgba(192,57,43,.7)}50%{box-shadow:0 0 0 6px rgba(192,57,43,0)}}"
    +".rh-lt{background:linear-gradient(180deg,#2a1d4d,#1a1033);border-color:rgba(201,162,74,.28);border-radius:8px}.rh-lt.cur{border-color:var(--gold-bright);box-shadow:0 0 14px rgba(232,196,104,.35);background:linear-gradient(180deg,#3b2a6b,#241446)}.rh-lt.live span{color:#ff6b5e;text-shadow:0 0 8px #ff6b5e}.rh-top{flex-wrap:nowrap;gap:6px}.rh-top b,.rh-sess{white-space:nowrap}.rh-top b{font-size:15px;letter-spacing:1px}.rh-live{align-self:center;line-height:1.4;white-space:nowrap}.rh-coin{font-size:12px;white-space:nowrap}"
    +".rh-stage{background:radial-gradient(90% 70% at 50% 0%,rgba(255,236,170,.10),transparent 70%),linear-gradient(180deg,#22153f,#140b29);border:1px solid rgba(201,162,74,.45);border-radius:16px;box-shadow:inset 0 0 40px rgba(0,0,0,.5)}.rh-stage::before{content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;box-shadow:inset 0 0 0 1px rgba(255,255,255,.04)}.rh-spot{position:absolute;left:50%;top:-10px;width:260px;height:230px;transform:translateX(-50%);background:conic-gradient(from 180deg at 50% 0,transparent 160deg,rgba(255,240,190,.22) 180deg,transparent 200deg);filter:blur(5px);pointer-events:none;animation:rhspot 5s ease-in-out infinite}@keyframes rhspot{0%,100%{opacity:.75}50%{opacity:1}}.rh-stage.hot{box-shadow:inset 0 0 40px rgba(0,0,0,.5),0 0 0 2px rgba(193,91,91,.5),0 0 28px rgba(193,91,91,.3)}.rh-stage.flash{animation:rhflash .35s}@keyframes rhflash{0%{box-shadow:inset 0 0 60px rgba(232,196,104,.55)}100%{box-shadow:inset 0 0 40px rgba(0,0,0,.5)}}"
    +".rh-lotno{letter-spacing:2px;font-family:Cinzel,serif;position:relative}.rh-art{position:relative;width:150px;height:150px;margin:6px auto 10px;display:flex;align-items:center;justify-content:center}.rh-aura{position:absolute;inset:-4px;border-radius:50%;background:conic-gradient(from 0deg,transparent,var(--tc),transparent 35%,var(--tc),transparent 70%,var(--tc),transparent);opacity:.5;filter:blur(14px);animation:rhspin 7s linear infinite}@keyframes rhspin{to{transform:rotate(360deg)}}.rh-frame{position:relative;border-radius:14px;padding:3px;background:linear-gradient(135deg,var(--tc),#fff6d2 45%,var(--tc));box-shadow:0 0 30px var(--tc),0 8px 20px rgba(0,0,0,.6);animation:rhfloat 3.4s ease-in-out infinite}.rh-frame .icon-box{border-radius:11px!important;background:#120a24}@keyframes rhfloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}.rh-ped{position:absolute;left:50%;bottom:-8px;width:130px;height:16px;transform:translateX(-50%);border-radius:50%;background:radial-gradient(ellipse,rgba(232,196,104,.55),transparent 70%)}"
    +".rh-nm{text-shadow:0 0 16px currentColor;letter-spacing:1px}.rh-lore{max-width:300px;margin:6px auto}.rh-own{display:inline-block;margin:6px auto 0;padding:3px 12px;border-radius:999px;font-size:12px;color:var(--muted);background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);position:relative}.rh-own b{color:var(--gold-bright);font-size:14px}"
    +".rh-price .n{font-size:36px;letter-spacing:1px;background:linear-gradient(180deg,#fff3c4,#e8c468 55%,#b58a2e);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;filter:drop-shadow(0 2px 8px rgba(232,196,104,.35))}.rh-lead{display:inline-block;padding:3px 14px;border-radius:999px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08)}.rh-lead.me{background:rgba(111,207,138,.14);border-color:rgba(111,207,138,.45)}"
    +".rh-timer{height:10px;border-radius:6px;background:rgba(0,0,0,.45);border:1px solid rgba(201,162,74,.3);position:relative}.rh-timer::after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(90deg,transparent 0 11px,rgba(0,0,0,.35) 11px 12px)}.rh-timer i{box-shadow:0 0 12px rgba(232,196,104,.6);transition:transform .15s linear}.rh-auc{font-family:Cinzel,serif;letter-spacing:.5px}"
    +".rh-gavel{position:absolute;right:16px;top:12px;font-size:44px;opacity:0;pointer-events:none;transform-origin:85% 90%;filter:drop-shadow(0 4px 8px rgba(0,0,0,.6))}.rh-gavel.slam{animation:rhgavel .7s ease-in forwards}@keyframes rhgavel{0%{opacity:0;transform:rotate(-70deg) translateY(-10px)}35%{opacity:1;transform:rotate(-70deg)}60%{opacity:1;transform:rotate(10deg)}75%{opacity:1;transform:rotate(-8deg)}100%{opacity:.0;transform:rotate(0)}}"
    +".rh-fx{position:absolute;inset:0;pointer-events:none;overflow:hidden}.rh-burst{position:absolute;left:50%;top:46%}.rh-burst b{position:absolute;font-size:16px;color:#ffe08a;text-shadow:0 0 8px #ffbf3c;animation:rhbursta 1.1s ease-out forwards;opacity:0}@keyframes rhbursta{0%{opacity:1;transform:translate(0,0) scale(.6)}100%{opacity:0;transform:translate(var(--dx),var(--dy)) scale(1.3)}}.rh-confetti i{position:absolute;top:-10px;width:7px;height:12px;opacity:0;animation:rhconf linear forwards}@keyframes rhconf{0%{opacity:1;transform:translateY(0) rotate(0)}100%{opacity:1;transform:translateY(330px) rotate(var(--r))}}"
    +".rh-modal.urgent::after{content:'';position:absolute;inset:0;z-index:3;pointer-events:none;border-radius:inherit;box-shadow:inset 0 0 70px rgba(192,57,43,.55);animation:rhurg .5s infinite alternate}@keyframes rhurg{from{opacity:.25}to{opacity:1}}"
    +".rh-acts .rh-paddle{background:linear-gradient(180deg,#f6d77a,#d0a037 55%,#a6761b)!important;color:#2a1a05!important;border:1px solid #fff0b0!important;border-radius:14px;font-family:Cinzel,serif;font-size:18px;letter-spacing:1px;box-shadow:0 6px 0 #6d4a0c,0 10px 22px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.6);transition:transform .08s,box-shadow .08s}.rh-acts .rh-paddle:active:not(:disabled){transform:translateY(4px);box-shadow:0 2px 0 #6d4a0c,0 4px 10px rgba(0,0,0,.5)}.rh-acts .rh-paddle:disabled{background:linear-gradient(180deg,#4a3e66,#33294d)!important;color:#a99cc8!important;border-color:rgba(255,255,255,.1)!important;box-shadow:0 4px 0 #1c1430;filter:none}"
    +".rh-chips button{background:linear-gradient(180deg,#2d2052,#1c1236);border-color:rgba(201,162,74,.3)}.rh-chips button.on{box-shadow:0 0 12px rgba(232,196,104,.35)}"
    +".rh-logh{margin-top:12px;font-family:Cinzel,serif;font-size:11px;letter-spacing:2px;color:var(--gold);text-align:center;opacity:.85}.rh-log{margin-top:4px;background:rgba(0,0,0,.28);border-color:rgba(201,162,74,.2)}.rh-log div{border-left:2px solid rgba(201,162,74,.35);padding-left:8px}.rh-log div:first-child{border-left-color:var(--gold-bright);color:var(--cream)}.rh-log div.me{border-left-color:#6fcf8a}"
    +".rh-stamp{text-shadow:0 0 18px currentColor;background:rgba(10,5,20,.35)}";
    document.head.appendChild(st)
  }
  document.addEventListener("click",ev=>{const t=ev.target&&ev.target.closest?ev.target.closest("[data-relic-hall]"):null;t&&relicHallOpen()});
  setInterval(relicHallFabTick,5e3)
}catch(_){}})();

/* ---------- 全服持有統計 ---------- */
function relicCensusBuild(ownerRows,aucRecs){const items={};RELIC_CATALOG.forEach(it=>{items[it.id]={held:0,holders:[],hiddenCount:0,hiddenQty:0,aucQty:0,aucList:[],sysList:[],total:0}});for(const o of ownerRows){if(!o||!o.items)continue;for(const id of Object.keys(o.items)){const q=Math.floor(Number(o.items[id])||0),t=items[id];if(!t||q<=0)continue;t.held+=q;o.hidden?(t.hiddenCount++,t.hiddenQty+=q):t.holders.push({nick:o.nick,qty:q})}}for(const r of aucRecs){if("relic"!==r.itemType||"active"!==r.status)continue;const t=items[r.itemId];if(!t)continue;r.isSystem?t.sysList.push({id:r.id,endsAt:r.endsAt,currentBid:r.currentBid||0,startBid:r.startBid}):(t.aucQty+=r.qty||1,t.aucList.push({id:r.id,seller:r.seller,qty:r.qty||1,currentBid:r.currentBid||0,startBid:r.startBid,endsAt:r.endsAt}))}for(const id of Object.keys(items)){const t=items[id];t.holders.sort((x,y)=>y.qty-x.qty||(x.nick||"").toLowerCase().localeCompare((y.nick||"").toLowerCase()));t.total=t.held+t.aucQty}return items}
const RELIC_PANEL={census:null,supply:{},draw:null,draws:[],todayAucs:[],votes:[],myVote:null,at:0,loading:!1,lastManual:0};
async function relicPanelLoad(){const cfg=await relicEnsureConfig(),day=ys();const [aucRows,supply,draw]=await Promise.all([relicListRows("auction:"),relicSupplyLoad(),relicDrawGet(day)]);const owRecs=[];const aucRecs=[];for(const r of aucRows)try{aucRecs.push(ru(JSON.parse(r.value)))}catch(_){}RELIC_PANEL.census={items:relicCensusBuild(owRecs,aucRecs)};RELIC_PANEL.supply=supply;RELIC_PANEL.draw=draw;RELIC_PANEL.draws=await Promise.all(relicSessionsFor(day,cfg).map(S=>0===S.idx?draw:relicDrawGet(day,S.idx)));RELIC_PANEL.todayAucs=aucRecs.filter(r=>r.isSystem&&r.relicDay===day&&!r.isTest).sort(relicSessSorter(day,cfg));RELIC_PANEL.at=Date.now()}
function relicPanelEnsure(force){const ttl=1e3*(RELIC_CFG.census&&RELIC_CFG.census.cacheSec||60);if(RELIC_PANEL.loading)return;if(!force&&RELIC_PANEL.at&&Date.now()-RELIC_PANEL.at<ttl)return;RELIC_PANEL.loading=!0;relicPanelLoad().catch(err=>{console.error("[relicPanelLoad]",err);RELIC_PANEL.at=Date.now()}).finally(()=>{RELIC_PANEL.loading=!1;"auction"===zl.tab&&"relic"===zl.auctionSubTab&&Bu()})}