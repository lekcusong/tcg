# 塔羅背包亂鬥（正式版結構）

由單檔 backpack_demo.html（約 2.4MB，其中 2.28MB 是內嵌 base64 圖片）拆分而來。

```
index.html          HTML 骨架 + <link>/<script> 引用（約 4KB）
css/                base（變數／版面）／ui（背包、商店、地圖等介面）／battle（戰鬥舞台、卡框）
js/01…12-*.js       原本那一整包程式，依功能切開（載入順序＝檔名編號）
js/99-bootstrap.js  一定要最後載入（開始畫面）
js/auto-update.js   偵測到新版本倒數 10 秒自動重新整理（檢查的是同資料夾的 index.html）
img/                135 張 webp（icon-*、enemy-*、relic-*、event-*、node-*、fx-*、player-*、bg-*）
tools/build.js      stamp：更新 index.html 裡的 ?v= 雜湊
```

## 改完檔案後
1. `node tools/build.js stamp`
2. 上傳順序：**先傳 js/css/img，最後才傳 index.html**（避免玩家抓到新 HTML 配舊 JS）。

## 規則
- 所有 js 檔共用同一個全域範圍，頂層的 const/let/function 名稱全專案不能重複。
- 載入順序不能亂換；新增檔案請用 `NN-xxx.js`，插在 99-bootstrap.js 之前。
- 圖片在 JS 裡是路徑字串（例如 `img/icon-w2.webp`），在 CSS 裡是 `../img/…`。換圖＝直接覆蓋同名檔案，再跑 stamp 無需動程式（想讓玩家立刻看到新圖，改檔名或在引用處加 ?v=）。
- 回滾：保留原本的 backpack_demo.html 即可。
