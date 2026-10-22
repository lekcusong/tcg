(function () {
  var deferred = null;
  function ua() { return navigator.userAgent || ""; }
  function isStandalone() {
    try { return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true; } catch (e) { return false; }
  }
  function isIOS() {
    return /iPad|iPhone|iPod/.test(ua()) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }
  function isSafari() { return isIOS() && !/(CriOS|FxiOS|EdgiOS|OPiOS|FBAN|FBAV|FB_IAB|Line\/|Instagram|MicroMessenger)/.test(ua()); }
  function lang() { try { return localStorage.getItem("app-lang") === "en" ? "en" : "zh"; } catch (e) { return "zh"; } }

  // 遊戲每次重畫標題列時會呼叫這個，決定 📲 按鈕要不要顯示
  window.__pwaShow = function () { return !isStandalone() && (!!deferred || isIOS()); };
  function refresh() {
    var b = document.getElementById("pwa-install-btn");
    if (b) b.style.display = window.__pwaShow() ? "inline-block" : "none";
  }

  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferred = e; refresh(); });
  window.addEventListener("appinstalled", function () { deferred = null; refresh(); });

  var SHARE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px"><path d="M12 15V3"/><path d="M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>';
  var PLUS = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/></svg>';

  function showIOSGuide() {
    if (document.getElementById("pwa-ios-guide")) return;
    var en = lang() === "en";
    var T = en ? {
      title: "📲 Install on your iPhone",
      warn: "⚠️ This doesn't look like Safari. Open this page in Safari first, or you may not find “Add to Home Screen”.",
      s1: "Open this page in <b>Safari</b> (not the in-app browser of LINE, Facebook, etc.)",
      s2: "Tap the <b>Share</b> button " + SHARE + " at the bottom. If you only see <b>⋯</b>, tap it first, then choose Share.",
      s3: "Scroll down and tap <b>Add to Home Screen</b> " + PLUS,
      s4: "Tap <b>Add</b> at the top right. The game icon will appear on your home screen.",
      ok: "Got it"
    } : {
      title: "📲 安裝到 iPhone",
      warn: "⚠️ 你現在好像不是在 Safari 裡，可能找不到「加入主畫面」，請先改用 Safari 開啟這個網頁。",
      s1: "用 <b>Safari</b> 開啟這個網頁（不要用 LINE、Facebook 等 app 內建的瀏覽器）",
      s2: "點下方的<b>「分享」</b>按鈕 " + SHARE + "。如果只看到 <b>⋯</b>，先點 ⋯ 再選分享。",
      s3: "往下滑，點<b>「加入主畫面」</b> " + PLUS,
      s4: "點右上角<b>「加入」</b>，桌面就會出現遊戲圖示。",
      ok: "知道了"
    };
    var ov = document.createElement("div");
    ov.id = "pwa-ios-guide";
    ov.style.cssText = "position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(10,5,18,.78);";
    var steps = [T.s1, T.s2, T.s3, T.s4].map(function (s, i) {
      return '<li style="display:flex;gap:10px;margin:0 0 12px;line-height:1.5;"><span style="flex:none;width:24px;height:24px;border-radius:50%;background:var(--gold,#c9a24a);color:#241608;font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center;margin-top:1px;">' + (i + 1) + '</span><span>' + s + '</span></li>';
    }).join("");
    ov.innerHTML =
      '<div role="dialog" aria-modal="true" style="width:100%;max-width:340px;max-height:90vh;overflow:auto;background:var(--bg-panel-raised,#251540);border:1px solid var(--line,rgba(201,162,74,.25));border-radius:16px;padding:18px 18px 16px;color:var(--cream,#f0e6d6);font-family:\'EB Garamond\',serif;font-size:16px;box-shadow:0 12px 40px rgba(0,0,0,.5);">' +
        '<div style="font-family:\'Cinzel\',serif;font-size:18px;color:var(--gold-bright,#e8c468);margin-bottom:12px;">' + T.title + '</div>' +
        (isSafari() ? "" : '<div style="background:rgba(193,91,91,.16);border:1px solid rgba(193,91,91,.5);border-radius:10px;padding:8px 10px;margin-bottom:12px;font-size:14px;line-height:1.45;">' + T.warn + '</div>') +
        '<ol style="list-style:none;margin:0;padding:0;">' + steps + '</ol>' +
        '<button id="pwa-ios-ok" style="width:100%;margin-top:4px;padding:10px;border:0;border-radius:999px;background:linear-gradient(90deg,var(--gold,#c9a24a),var(--violet,#8b6bd1));color:#241608;font-weight:700;font-size:15px;cursor:pointer;">' + T.ok + '</button>' +
      '</div>';
    function close() { ov.remove(); document.removeEventListener("keydown", onKey); }
    function onKey(e) { if (e.key === "Escape") close(); }
    ov.addEventListener("click", function (e) { if (e.target === ov || e.target.id === "pwa-ios-ok") close(); });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(ov);
  }

  // 標題列會被遊戲整個重畫，所以用事件委派，不綁在按鈕本身
  document.addEventListener("click", function (e) {
    var b = e.target && e.target.closest && e.target.closest("#pwa-install-btn");
    if (!b) return;
    e.preventDefault();
    if (deferred) {
      var d = deferred; deferred = null;
      try { d.prompt(); var p = d.userChoice; if (p && p.then) p.then(refresh, refresh); } catch (err) {}
      refresh();
    } else if (isIOS()) {
      showIOSGuide();
    }
  });
})();
