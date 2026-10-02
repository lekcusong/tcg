/* Mystic Tarot Collection — service worker
 * 策略：
 *  - 頁面（index.html）：網路優先，離線才用快取 → 你更新 index.html 後，玩家下次開啟就是新版
 *  - 圖片（塔羅牌、素材）：先出快取、背景更新 → 秒開又不會永遠卡舊圖
 *  - Google Fonts：先出快取、背景更新
 *  - Supabase 與所有非 GET 請求：完全不攔截（遊戲資料永遠走即時網路）
 * 想強制清掉所有玩家的舊快取，把下面的 VERSION 改一個字串即可。
 */
const VERSION = "v1";
const SHELL = "tcg-shell-" + VERSION;
const RUNTIME = "tcg-runtime-" + VERSION;
const MAX_RUNTIME_ENTRIES = 400;
const NAV_TIMEOUT_MS = 6000;
const SCOPE_URL = self.registration.scope;           // 例如 https://xxx.github.io/tcg/

const PRECACHE = ["manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    await Promise.all(PRECACHE.map((p) => cache.add(p).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL, RUNTIME]);
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith("tcg-") && !keep.has(n)).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

function cacheable(res) {
  return res && (res.ok || res.type === "opaque");
}

async function networkFirstPage(request) {
  const cache = await caches.open(SHELL);
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), NAV_TIMEOUT_MS);
    const res = await fetch(request, { signal: ctrl.signal });
    clearTimeout(timer);
    if (res && res.ok) cache.put(SCOPE_URL, res.clone());   // 不管網址帶什麼 ?_v=，都存成同一份
    return res;
  } catch (err) {
    const cached = await cache.match(SCOPE_URL);
    if (cached) return cached;
    return new Response(
      "<!doctype html><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>" +
      "<body style='background:#120a1e;color:#f0e6d6;font-family:sans-serif;text-align:center;padding:48px 20px'>" +
      "<h2>目前離線</h2><p>請連上網路後再重新開啟遊戲。</p>" +
      "<p><button onclick='location.reload()' style='padding:10px 18px;border-radius:999px;border:0;background:#e8c468;color:#241608'>重新整理</button></p></body>",
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME);
  const cached = await cache.match(request);
  const refresh = fetch(request).then((res) => {
    if (cacheable(res)) { cache.put(request, res.clone()).then(() => trim(RUNTIME, MAX_RUNTIME_ENTRIES)); }
    return res;
  }).catch(() => null);
  return cached || (await refresh) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (!/^https?:$/.test(url.protocol)) return;
  if (url.hostname.endsWith("supabase.co") || url.hostname.endsWith("supabase.in")) return;   // 遊戲資料不快取

  if (req.mode === "navigate") { event.respondWith(networkFirstPage(req)); return; }

  if (req.destination === "image" ||
      url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(staleWhileRevalidate(req));
  }
});
