'use strict';
/* ===== 內嵌模式 / GM 開關門檻 ===== 一定要第一個載入
 * 主遊戲用 iframe 開本頁：backpack/index.html?embed=1&lang=zh|en[&gm=1]
 * 單獨開啟（不帶參數）也能玩。GM 關閉小遊戲時，一般玩家看到的是鎖定畫面（GM 帶 gm=1 不受影響）。
 * 這只是畫面層的門檻（和主遊戲小遊戲開關一樣）；真正的限制要靠伺服器（排行榜 RPC）。 */
const BP_Q = new URLSearchParams(location.search);
const BP_EMBED = BP_Q.get("embed") === "1";
const BP_GM = BP_Q.get("gm") === "1";
const BP_LANG = (() => { const l = BP_Q.get("lang"); if (l === "zh" || l === "en") return l; try { return localStorage.getItem("app-lang") === "en" ? "en" : "zh"; } catch (e) { return "zh"; } })();
if (BP_EMBED) document.documentElement.classList.add("embed");
let __bpLocked = false;
// 回傳 true＝可以玩。網路失敗時放行（跟主遊戲 mgLoad 一樣：讀不到就當開啟）
async function bpGate() {
  if (BP_GM) return true;
  try {
    const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 4000);
    const r = await fetch("https://hmkpwrefecwjxnyggcej.supabase.co/rest/v1/kv_store?key=eq." + encodeURIComponent("config:minigame_switches") + "&select=value",
      { headers: { apikey: "sb_publishable_vs1K1Ao4Gjl2JK5xrK-GpQ_aXsHyty7", Authorization: "Bearer sb_publishable_vs1K1Ao4Gjl2JK5xrK-GpQ_aXsHyty7" }, cache: "no-store", signal: ctl.signal });
    clearTimeout(tm);
    if (!r.ok) return true;
    const rows = await r.json();
    if (!rows || !rows.length) return true;
    const sw = JSON.parse(rows[0].value) || {};
    return sw.backpack !== false;
  } catch (e) { return true; }
}
function bpLockScreen() {
  __bpLocked = true;
  const app = document.getElementById("app"); if (app) app.hidden = true;
  const d = document.createElement("div");
  d.style.cssText = "position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:#120a1e;color:#e8c468;font:600 15px/1.6 'Noto Sans TC',sans-serif;text-align:center;padding:24px";
  d.innerHTML = "<div style='font-size:42px'>🔒</div><div>" + (BP_LANG === "en" ? "Backpack Brawl is temporarily closed by the GM." : "塔羅背包亂鬥目前由 GM 暫時關閉") + "</div><div style='color:#9a8ca8;font-weight:400;font-size:13px'>" + (BP_LANG === "en" ? "Please check back later." : "請晚點再來") + "</div>";
  document.body.appendChild(d);
}
// 讓上層（主遊戲）知道載入完成／要求關閉
function bpTellParent(type) { try { if (BP_EMBED && parent !== window) parent.postMessage({ src: "backpack", type }, location.origin); } catch (e) { } }
