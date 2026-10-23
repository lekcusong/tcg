'use strict';
/* ===== player pose / duel helpers ===== */
const PLAYER_FACE = "img/player-face.webp";
let _poseT = 0, _poseLock = false;
function setPose(p, ms, force) {
  const w = document.getElementById("pChar"); if (!w) return;
  if (_poseLock && !force) return;
  if (p === "cast" && w.dataset.pose === "hurt" && !force) return;
  w.querySelectorAll("img").forEach(i => i.classList.toggle("on", i.dataset.p === p));
  w.dataset.pose = p; clearTimeout(_poseT);
  if (ms) _poseT = setTimeout(() => setPose("idle"), ms / Math.sqrt((typeof BT !== "undefined" && BT && BT.speed) || 1));
}
function setupDuel() {
  _poseLock = false; setPose("idle", 0, true);
  const pc = document.getElementById("pChar"); pc.classList.remove("down");
  const ec = document.getElementById("eChar"); ec.classList.remove("down", "hit");
  ec.innerHTML = eImg(G.enemy, "full", "ec" + eTag(G.enemy));
}
function koPose(win) {
  _poseLock = false;
  if (win) { setPose("win", 0, true); document.getElementById("eChar").classList.add("down"); }
  else { setPose("hurt", 0, true); document.getElementById("pChar").classList.add("down"); }
  _poseLock = true;
}
new MutationObserver(() => document.body.classList.toggle("inBattle", !document.getElementById("vBattle").hidden)).observe(document.getElementById("vBattle"), { attributes: true, attributeFilter: ["hidden"] });
/* BGM：地圖／商店／擺牌＝塔羅氛圍；戰鬥＝快節奏；Boss 戰＝更緊張 */
AU.auto = function () { if (__bpLocked || AU.isMuted()) return; const inB = document.body.classList.contains("inBattle"); AU.bgm(inB ? ((G.enemy && G.enemy.boss) ? "boss" : "battle") : "calm"); };
["pointerdown", "keydown", "touchend"].forEach(ev => document.addEventListener(ev, () => AU.auto(), { passive: true }));
new MutationObserver(() => AU.auto()).observe(document.body, { attributes: true, attributeFilter: ["class"] });
