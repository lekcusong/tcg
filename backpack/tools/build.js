#!/usr/bin/env node
/*
 * 用法（在 backpack 資料夾根目錄執行）：
 *   node tools/build.js stamp   改完 css/ 或 js/ 之後執行：重新計算 index.html 裡每個檔案的 ?v=雜湊
 *                               （玩家瀏覽器才不會吃到舊快取，auto-update.js 也靠這個偵測新版）
 */
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const root = path.join(__dirname, "..");
const h8 = s => crypto.createHash("sha1").update(s).digest("hex").slice(0, 8);
const read = p => fs.readFileSync(path.join(root, p), "utf8");
if (process.argv[2] !== "stamp") { console.log("usage: node tools/build.js stamp"); process.exit(0); }
let html = read("index.html");
html = html.replace(/<link rel="stylesheet" href="(css\/[^"?]+)(?:\?v=[0-9a-f]+)?">/g, (_, f) => `<link rel="stylesheet" href="${f}?v=${h8(read(f))}">`)
           .replace(/<script src="(js\/[^"?]+)(?:\?v=[0-9a-f]+)?"><\/script>/g, (_, f) => `<script src="${f}?v=${h8(read(f))}"></script>`);
fs.writeFileSync(path.join(root, "index.html"), html);
console.log("stamped index.html");
