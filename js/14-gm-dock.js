/* ===== GM Dock：把各玩法的 GM 控制面板放在各自頁面下方（僅 GM 可見） ===== */
var GM_PANEL_OPEN = {};  /* 摺疊面板標題 -> 是否展開；GM 分頁重繪後依此還原，不再全部收起來 */
function gmPanelId(txt){ return String(txt || "").replace(/[0-9]+/g, "").replace(/\s+/g, " ").trim(); }
document.addEventListener("toggle", function(ev){
  var d = ev.target;
  if (!d || d.tagName !== "DETAILS" || !d.classList || !d.classList.contains("gm-collapsible")) return;
  var sm = d.querySelector(":scope > summary");
  GM_PANEL_OPEN[gmPanelId(sm ? sm.textContent : "⚙️ GM")] = d.open;
}, true);
function gmCollapsibleWrap(html, defaultOpen){
  if(!html || typeof html !== "string") return html;
  var openTagRe = /<div class="panel"([^>]*)>/g;
  var scanRe = /<div\b[^>]*>|<\/div>/g;
  var result = "";
  var lastIndex = 0;
  var m;
  while((m = openTagRe.exec(html))){
    var openTagEnd = openTagRe.lastIndex;
    var depth = 1, closeStart = -1, closeEnd = -1, sm;
    scanRe.lastIndex = openTagEnd;
    while((sm = scanRe.exec(html))){
      if (sm[0].charAt(1) === "/") { depth--; if (depth === 0) { closeStart = sm.index; closeEnd = scanRe.lastIndex; break; } }
      else depth++;
    }
    if (closeStart === -1) continue;
    var inner = html.slice(openTagEnd, closeStart);
    var headMatch = inner.match(/^(\s*)<(h[23])([^>]*)>([\s\S]*?)<\/\2>/);
    var summaryHtml, bodyHtml;
    if (headMatch) {
      summaryHtml = headMatch[1] + '<summary class="gm-collapsible-summary"><' + headMatch[2] + headMatch[3] + ' style="display:inline;margin:0;">' + headMatch[4] + '</' + headMatch[2] + '></summary>';
      bodyHtml = inner.slice(headMatch[0].length);
    } else {
      summaryHtml = '<summary class="gm-collapsible-summary">⚙️ GM</summary>';
      bodyHtml = inner;
    }
    result += html.slice(lastIndex, m.index);
    var tmpT = document.createElement("div"); tmpT.innerHTML = headMatch ? headMatch[4] : "⚙️ GM";
    var wasOpen = defaultOpen || (GM_PANEL_OPEN && GM_PANEL_OPEN[gmPanelId(tmpT.textContent)]);
    result += '<details class="panel gm-collapsible"' + m[1] + (wasOpen ? ' open' : '') + '>' + summaryHtml + bodyHtml + '</details>';
    lastIndex = closeEnd;
    openTagRe.lastIndex = closeEnd;
  }
  result += html.slice(lastIndex);
  return result;
}
const GM_DOCK_REFRESH_MS = 20000;
const GM_DOCK_VALID = {
  wb: () => zl.tab === "boss" && zl.bossView === "world",
  sr: () => zl.tab === "starraceroulette" && (zl.srRltView || "starrace") === "starrace",
  rlt: () => zl.tab === "starraceroulette" && zl.srRltView === "roulette",
  arn: () => zl.tab === "arena" && (zl.arnView || "arena") === "arena",
  tn: () => zl.tab === "arena" && zl.arnView === "tournament",
  rg: () => zl.tab === "arena" && zl.arnView === "gear",
  pg: () => zl.tab === "farm" && zl.farmSubTab === "pet",
  af: () => zl.tab === "profession" && zl.profView === "furnace"
};
const GM_DOCK_OPEN = {};   /* dockKey -> { detailId: isOpen }，跨重繪保留每個摺疊窗的開合 */
const GM_DOCK_CACHE = {};  /* dockKey -> 上次渲染好的 HTML，dock 被整頁重繪砍掉重建時先畫舊內容，避免頁面變矮造成捲動跳動 */
function gmDockDetailIds(dock){
  const seen = {};
  return Array.from(dock.querySelectorAll("details")).map(d => {
    const sm = d.querySelector(":scope > summary");
    const t = (sm ? sm.textContent : "").replace(/[0-9]+/g, "").replace(/\s+/g, " ").trim();
    seen[t] = (seen[t] || 0) + 1;
    return [t + "|" + seen[t], d];
  });
}
function gmDockSaveOpen(dock){
  const st = GM_DOCK_OPEN[dock.dataset.key] || (GM_DOCK_OPEN[dock.dataset.key] = {});
  gmDockDetailIds(dock).forEach(([id, d]) => { st[id] = d.open; });
}
function gmDockRestoreOpen(dock){
  const st = GM_DOCK_OPEN[dock.dataset.key];
  if (!st) return;
  gmDockDetailIds(dock).forEach(([id, d]) => { if (st[id] === true) d.open = true; });
}
function gmDockIsDirty(dock){
  return Array.from(dock.querySelectorAll("input,select,textarea")).some(el =>
    (el.type === "checkbox" || el.type === "radio") ? el.checked !== el.defaultChecked : el.value !== el.defaultValue);
}
async function gmDockSync(rootEl, key, htmlFn, wireFn, force){
  if (!ku() || !rootEl || !rootEl.parentNode || !GM_DOCK_VALID[key] || !GM_DOCK_VALID[key]()) return;
  let dock = document.getElementById("gm-dock");
  if (dock && dock.dataset.key !== key) { dock.remove(); dock = null; }
  let created = false;
  if (!dock) {
    dock = document.createElement("div");
    dock.id = "gm-dock"; dock.dataset.key = key; dock.dataset.stamp = "0"; dock.style.marginTop = "14px";
    dock.addEventListener("click", ev => {
      const b = ev.target.closest && ev.target.closest("button");
      if (!b || b.id === "af-reset-defaults-btn") return;
      // 按下儲存／強制結算等動作後，稍等一下再重新讀取，讓「目前狀態」與輸入框回到實際值
      setTimeout(() => { if (dock.__root) gmDockSync(dock.__root, dock.dataset.key, dock.__htmlFn, dock.__wireFn, true).catch(() => {}); }, 1500);
    });
    dock.addEventListener("toggle", ev => { if (ev.target && ev.target.tagName === "DETAILS") gmDockSaveOpen(dock); }, true);
    created = true;
  }
  dock.__root = rootEl; dock.__htmlFn = htmlFn; dock.__wireFn = wireFn;
  if (dock.previousElementSibling !== rootEl) rootEl.insertAdjacentElement("afterend", dock);
  if (dock.__busy) return;
  const stale = Date.now() - Number(dock.dataset.stamp || 0) > GM_DOCK_REFRESH_MS;
  // 平常不重繪面板，避免洗掉正在輸入的設定；只有第一次、過了 20 秒、且沒有未儲存的修改／沒有聚焦時才更新
  if (!created && !force && (!stale || gmDockIsDirty(dock) || dock.contains(document.activeElement))) return;
  dock.__busy = true;
  let paintedCache = false;
  if (created && GM_DOCK_CACHE[key]) { dock.innerHTML = GM_DOCK_CACHE[key]; gmDockRestoreOpen(dock); paintedCache = true; }
  try {
    const html = await htmlFn();
    if (!dock.isConnected || !GM_DOCK_VALID[key]()) return;
    const y = window.scrollY;
    if (!created || paintedCache) gmDockSaveOpen(dock);
    const wrapped = gmCollapsibleWrap(html);
    if (dock.firstChild) { try { wbMorph(dock, wrapped); } catch (err) { dock.innerHTML = wrapped; } } else dock.innerHTML = wrapped; GM_DOCK_CACHE[key] = wrapped;
    gmDockRestoreOpen(dock);
    dock.dataset.stamp = String(Date.now()); wireFn();
    if (Math.abs(window.scrollY - y) > 1) window.scrollTo(0, y);
    requestAnimationFrame(() => { if (Math.abs(window.scrollY - y) > 1) window.scrollTo(0, y); });
  } catch (err) { if (paintedCache) { dock.innerHTML = ""; dock.dataset.stamp = "0"; } } finally { dock.__busy = false; }
}
setInterval(() => {
  const d = document.getElementById("gm-dock");
  if (!d) return;
  const valid = GM_DOCK_VALID[d.dataset.key];
  if (!ku() || !valid || !valid()) d.remove();
}, 500);