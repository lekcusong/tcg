/*
 * 自動更新：定時（及玩家切回分頁時）重新抓一次 index.html，
 * 如果裡面 css/、js/ 檔案的 ?v= 版本碼跟目前跑的不一樣，就顯示倒數提示並自動重新整理。
 * 獨立於遊戲程式，不依賴任何遊戲內部變數。
 */
(function () {
  var CHECK_EVERY = 5 * 60 * 1000;   // 畫面開著時每 5 分鐘檢查一次
  var MIN_GAP = 60 * 1000;           // 切回分頁時，距離上次檢查至少 1 分鐘才再查
  var COUNTDOWN = 10;                // 發現新版後幾秒自動更新
  var SNOOZE = 10 * 60 * 1000;       // 按「稍後」後，10 分鐘內不再提示
  var lastCheck = 0, snoozeUntil = 0, showing = false, timer = null;

  function signature(doc) {
    var out = [];
    var nodes = doc.querySelectorAll('link[rel="stylesheet"][href^="css/"], script[src^="js/"]');
    for (var i = 0; i < nodes.length; i++) out.push(nodes[i].getAttribute("href") || nodes[i].getAttribute("src"));
    return out.join("|");
  }
  var current = signature(document);

  function zh() { try { return localStorage.getItem("app-lang") !== "en"; } catch (e) { return true; } }

  function showBanner() {
    if (showing) return;
    showing = true;
    var left = COUNTDOWN, isZh = zh();
    var box = document.createElement("div");
    box.id = "auto-update-banner";
    box.style.cssText = "position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:2000;width:max-content;max-width:calc(100vw - 32px);" +
      "background:#251540;border:1px solid #e8c468;color:#e8c468;padding:10px 16px;border-radius:14px;font:600 13px/1.5 Cinzel,'Noto Sans TC',serif;" +
      "box-shadow:0 6px 28px rgba(0,0,0,.5);text-align:center";
    var msg = document.createElement("div");
    var row = document.createElement("div");
    row.style.cssText = "margin-top:8px;display:flex;gap:8px;justify-content:center";
    function btn(label, primary) {
      var b = document.createElement("button");
      b.textContent = label;
      b.style.cssText = "padding:5px 14px;border-radius:8px;cursor:pointer;font:inherit;border:1px solid #c9a24a;" +
        (primary ? "background:#c9a24a;color:#241608" : "background:transparent;color:#9a8ca8");
      return b;
    }
    var now = btn(isZh ? "立即更新" : "Update now", true);
    var later = btn(isZh ? "稍後" : "Later", false);
    function render() {
      msg.textContent = isZh ? "發現新版本，" + left + " 秒後自動更新 ✦" : "New version found - updating in " + left + "s ✦";
    }
    function reload() { clearInterval(timer); location.reload(); }
    now.onclick = reload;
    later.onclick = function () {
      clearInterval(timer); box.remove(); showing = false; snoozeUntil = Date.now() + SNOOZE;
    };
    row.appendChild(now); row.appendChild(later); box.appendChild(msg); box.appendChild(row);
    document.body.appendChild(box);
    render();
    timer = setInterval(function () { left--; if (left <= 0) reload(); else render(); }, 1000);
  }

  function check() {
    if (showing || Date.now() < snoozeUntil) return Promise.resolve(false);
    lastCheck = Date.now();
    // no-cache：每次都向伺服器確認（沒變動時只會回 304，流量很小）
    return fetch("index.html?_=" + Date.now(), { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.text() : null; })
      .then(function (text) {
        if (!text) return false;
        var latest = signature(new DOMParser().parseFromString(text, "text/html"));
        if (latest && latest !== current) { showBanner(); return true; }
        return false;
      })
      .catch(function () { return false; });
  }

  setInterval(function () { if (document.visibilityState === "visible") check(); }, CHECK_EVERY);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && Date.now() - lastCheck > MIN_GAP) check();
  });
  window.__checkForUpdate = check;   // 方便手動測試：在主控台輸入 __checkForUpdate()
})();
