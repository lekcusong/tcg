'use strict';
/* ===== 向量圖示（不依賴 emoji 字型）===== */
const _ck = "var(--ck,#1a0f2c)", _c1 = "var(--c1,#c9a24a)", _c2 = "var(--c2,#fff3d0)";
const P_ = (d, f, w) => `<path d="${d}" fill="${f || "none"}" stroke="${_ck}" stroke-width="${w == null ? 1.1 : w}" stroke-linejoin="round" stroke-linecap="round"/>`;
const C_ = (x, y, r, f, w) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${f || "none"}" stroke="${w === 0 ? "none" : _ck}" stroke-width="${w == null ? 1.1 : w}"/>`;
const L_ = (a, b, c, d, w, col) => `<line x1="${a}" y1="${b}" x2="${c}" y2="${d}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`;
const stick_ = (a, b, c, d) => L_(a, b, c, d, 4.2, _ck) + L_(a, b, c, d, 2.5, "#b9894f");
const star_ = (cx, cy, r1, r2, n, f, w) => { let d = ""; for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / n, r = i % 2 ? r2 : r1; d += (i ? "L" : "M") + (cx + Math.cos(a) * r).toFixed(2) + " " + (cy + Math.sin(a) * r).toFixed(2); } return P_(d + "Z", f, w); };
const GOLD = "#e8c050", STEEL = "#dfe8f2";
const gob_ = (y, s) => `<g transform="translate(${12 - 12 * s},${y}) scale(${s})">` + P_("M5.5 3 H18.5 C18.5 10 15.5 13.5 12 13.5 C8.5 13.5 5.5 10 5.5 3Z", _c1) + `<path d="M7.6 4.6 C8 8 9.4 10.6 11 11.6" stroke="${_c2}" stroke-width="1.3" fill="none" stroke-linecap="round" opacity=".75"/>` + P_("M10.8 13.5 h2.4 v5.5 h-2.4z", "#d9c58c") + P_("M6.5 21 Q12 16.6 17.5 21Z", "#d9c58c") + "</g>";
const sword_ = (tr) => `<g transform="${tr || ""}">` + P_("M12 1.5 L14.3 13.5 H9.7Z", STEEL) + L_(12, 3.5, 12, 12.5, 0.9, "#9fb0c4") + P_("M6.2 13.5 H17.8 V16 H6.2Z", _c1) + P_("M10.9 16 h2.2 v4 h-2.2z", "#7a4a2a") + C_(12, 21.2, 1.5, _c1) + "</g>";
const snow_ = (cx, cy, r, w, col) => [0, 60, 120].map(a => { const t = a * Math.PI / 180, dx = Math.cos(t) * r, dy = Math.sin(t) * r; return L_((cx - dx).toFixed(2), (cy - dy).toFixed(2), (cx + dx).toFixed(2), (cy + dy).toFixed(2), w, col); }).join("");
const ICONS = {
  c4: () => gob_(1, 1) + snow_(12, 7.2, 3.6, 1.3, "#e6f6ff") + C_(12, 7.2, 0.9, "#ffffff", 0),
  c8: () => gob_(5.5, 0.78) + snow_(12, 6.2, 4.2, 1.4, "#e6f6ff") + C_(12, 6.2, 1, "#ffffff", 0),
  s5: () => sword_("rotate(-28 12 12) scale(.95) translate(.5 .5)") + P_("M15.5 15.5 L18 13 L17 17 L20.5 15.5 L18.2 20 L16.4 18.2Z", "#ff6b6b", 0.7),
  m12: () => L_(3, 3.2, 21, 3.2, 2.4, _ck) + L_(3, 3.2, 21, 3.2, 1.2, "#b9894f") + L_(12, 3.2, 12, 8.6, 1.4, _ck) + P_("M9.8 8.6 H14.2 L13.4 15.4 H10.6Z", "#c9a24a") + L_(10.4, 11, 7.2, 14.2, 1.8, _ck) + L_(13.6, 11, 16.8, 14.2, 1.8, _ck) + C_(12, 18, 2.8, "#eab45c") + C_(11, 18.4, 0.5, _ck, 0) + C_(13, 18.4, 0.5, _ck, 0) + star_(19, 19, 1.8, 0.8, 4, _c2, 0.4),
  w2: () => stick_(4.5, 20, 17, 8) + stick_(19.5, 20, 7, 8) + C_(17.8, 7.3, 2.8, _c1) + C_(6.2, 7.3, 2.8, _c1) + C_(17.2, 6.6, 0.9, _c2, 0) + C_(5.6, 6.6, 0.9, _c2, 0),
  w1: () => stick_(5.5, 20.5, 15, 9) + P_("M15 9 C15 4.5 18.5 2.5 21.5 2.5 C21.5 6.5 18.5 9 15 9Z", _c1) + P_("M11.5 12.5 C9 8.5 6 8.5 3.5 8.5 C4.5 12.5 8 13.5 11.5 12.5Z", _c1) + P_("M19.5 13 l1 2.4 2.4 1 -2.4 1 -1 2.4 -1 -2.4 -2.4 -1 2.4 -1z", _c2, 0.8),
  wk: () => L_(4, 21, 17.5, 4.5, 4, _ck) + L_(4, 21, 17.5, 4.5, 2.3, "#b9894f") + P_("M17.5 4.5 L19.5 1.5 L21 6Z", STEEL) + P_("M13.5 8 L22 9.5 L16 13.2Z", _c1) + P_("M15 10 L19.5 10.8", "none", 0.9) ,
  c3: () => gob_(1, 1),
  c1: () => gob_(5.5, 0.78) + P_("M12 .8 C10.2 3.5 9.7 4.8 12 6.2 C14.3 4.8 13.8 3.5 12 .8Z", _c2, 0.9),
  c7: () => P_("M9 2.5 H15 V8.5 L20.3 18.6 Q21.2 21 18.6 21 H5.4 Q2.8 21 3.7 18.6 L9 8.5Z", "rgba(220,235,255,.35)") + P_("M6.2 14.6 H17.8 L20.3 18.6 Q21.2 21 18.6 21 H5.4 Q2.8 21 3.7 18.6Z", _c1) + L_(9, 4, 15, 4, 1.6, _ck) + C_(10, 17.5, 1, _c2, 0) + C_(14, 16.2, 0.8, _c2, 0),
  c9: () => gob_(1, 1) + star_(12, 7, 2.6, 1.1, 4, _c2, 0.5),
  s4: () => sword_(),
  s9: () => sword_("rotate(-32 12 12) scale(.92) translate(1 1)") + sword_("rotate(32 12 12) scale(.92) translate(1 1)"),
  sp: () => L_(4, 20, 18, 6, 1.9, "#d8c48f") + P_("M18 6 L21.8 2.2 L21.2 8.2Z", STEEL) + P_("M4 20 L3 16 L7.6 19.6Z", _c1) + P_("M7 22 L3.2 21 L6.6 17.4Z", _c1),
  s2: () => L_(3.5, 21, 17, 7.5, 3.4, _ck) + L_(3.5, 21, 17, 7.5, 1.8, STEEL) + C_(18.3, 6.2, 3.6, "none", 1.3) + C_(18.3, 6.2, 2.4, _c1) + P_("M17 7.5 L21.8 2.7", "none", 1.6),
  p5: () => C_(12, 12, 9.4, GOLD) + C_(12, 12, 7, "none", 0.9) + P_("M12 6.2 L13.5 10.4 L18 10.5 L14.4 13.2 L15.8 17.5 L12 14.9 L8.2 17.5 L9.6 13.2 L6 10.5 L10.5 10.4Z", _c2, 0.7),
  p10: () => P_("M3.5 21.5 V9.5 H6.5 V6.5 H9 V9.5 H11 V6.5 H13 V9.5 H15 V6.5 H17.5 V9.5 H20.5 V21.5Z", "#c9a24a") + P_("M9.5 21.5 V15.6 Q12 12.4 14.5 15.6 V21.5Z", "#2a1a3a") + L_(5.5, 13, 8, 13, 1.2, _ck) + L_(16, 13, 18.5, 13, 1.2, _ck),
  p1: () => P_("M9 3.5 H15 L13.4 7.6 C18.2 9.6 19.4 15 17.4 19.2 C15.8 21.6 8.2 21.6 6.6 19.2 C4.6 15 5.8 9.6 10.6 7.6Z", GOLD) + L_(8.6, 4, 15.4, 4, 1.6, _ck) + P_("M12 11 V18 M10 12.4 H13.6 Q14.4 12.4 14.4 13.6 Q14.4 14.8 13.4 14.8 H10.6 Q9.6 14.8 9.6 16 Q9.6 17.2 10.6 17.2 H14", "none", 1.2),
  p8: () => L_(5, 20.5, 13.5, 12, 4, _ck) + L_(5, 20.5, 13.5, 12, 2.4, "#b9894f") + P_("M10.5 6.5 L18.5 3.5 L21.5 9.5 L13.5 12.5Z", "#aab6c6") + L_(12.5, 7, 17.5, 11, 1, _ck),
  pq: () => C_(12, 13, 7.2, GOLD) + C_(12, 13, 5.2, "none", 0.8) + P_("M12 8.6 L13.2 11.6 L16.4 11.8 L13.9 13.8 L14.8 16.9 L12 15.1 L9.2 16.9 L10.1 13.8 L7.6 11.8 L10.8 11.6Z", _c2, 0.5) + P_("M3 4 C5 3 8 4 9 7 C6 8 3.5 7 3 4Z", "#5aa66a") + P_("M21 4 C19 3 16 4 15 7 C18 8 20.5 7 21 4Z", "#5aa66a"),
  m16: () => P_("M7.5 21.5 L8.8 8 H15.2 L16.5 21.5Z", "#8a7aa4") + P_("M6.5 8.4 L7.4 3.8 H9.6 V6 H11 V3.8 H13 V6 H14.4 V3.8 H16.6 L17.5 8.4Z", "#a794c0") + P_("M13.8 1 L8.4 11.4 H11.8 L10.2 21 L16.4 9.4 H12.8Z", "#ffe36b", 0.9),
  m13: () => P_("M12 2.5 C7 2.5 4.4 6 4.4 10.4 C4.4 13 5.8 14.6 7.6 15.6 V19.5 H16.4 V15.6 C18.2 14.6 19.6 13 19.6 10.4 C19.6 6 17 2.5 12 2.5Z", "#ece4d2") + C_(9, 10.4, 2.3, _ck, 0) + C_(15, 10.4, 2.3, _ck, 0) + P_("M12 12.4 L10.9 14.8 H13.1Z", _ck, 0.6) + L_(10, 16.2, 10, 19.2, 1, _ck) + L_(12, 16.2, 12, 19.2, 1, _ck) + L_(14, 16.2, 14, 19.2, 1, _ck),
  m19: () => star_(12, 12, 11.2, 8.4, 12, "#ffb42e", 0.9) + C_(12, 12, 6.6, "#ffd84a") + C_(10, 11, 0.9, _ck, 0) + C_(14, 11, 0.9, _ck, 0) + `<path d="M9.4 14 Q12 16.4 14.6 14" stroke="${_ck}" stroke-width="1.1" fill="none" stroke-linecap="round"/>`,
  m8: () => star_(12, 12, 11, 8.2, 14, "#b5651d", 0.9) + C_(12, 12.3, 6, "#eab45c") + C_(10, 11.2, 0.9, _ck, 0) + C_(14, 11.2, 0.9, _ck, 0) + P_("M11 13.4 H13 L12 14.6Z", _ck, 0.6) + `<path d="M9.8 15.6 Q12 17.4 14.2 15.6" stroke="${_ck}" stroke-width="1" fill="none" stroke-linecap="round"/>`,
  m1: () => P_("M6.5 17 V7.5 Q6.5 3.6 12 3.6 Q17.5 3.6 17.5 7.5 V17Z", "#3a2860") + P_("M6.5 13.6 H17.5 V17 H6.5Z", _c1) + P_("M3.2 17.4 H20.8 Q20.8 20.4 12 20.4 Q3.2 20.4 3.2 17.4Z", "#3a2860") + P_("M19.5 4.5 l.9 2 2 .9 -2 .9 -.9 2 -.9 -2 -2 -.9 2 -.9z", _c2, 0.6),
  m10: () => C_(12, 12, 9.4, "rgba(60,40,100,.5)", 1.3) + C_(12, 12, 9.4, "none", 0.01) + [0, 1, 2, 3].map(i => `<g transform="rotate(${i * 45} 12 12)">${L_(12, 3, 12, 21, 1.6, _c2)}</g>`).join("") + C_(12, 12, 3, GOLD) + [0, 1, 2, 3, 4, 5, 6, 7].map(i => { const a = i * Math.PI / 4; return C_((12 + Math.cos(a) * 9.4).toFixed(2), (12 + Math.sin(a) * 9.4).toFixed(2), 1.4, _c1, 0.7); }).join(""),
  m15: () => P_("M5.2 10 C3.6 6.5 4.6 3.2 7.4 1.8 C7.2 4.6 8.2 6.8 9.8 8Z", "#d84a4a") + P_("M18.8 10 C20.4 6.5 19.4 3.2 16.6 1.8 C16.8 4.6 15.8 6.8 14.2 8Z", "#d84a4a") + C_(12, 14, 7.6, "#c43a3a") + P_("M7.6 11.6 L10.6 13 L8 14Z", "#ffe36b", 0.5) + P_("M16.4 11.6 L13.4 13 L16 14Z", "#ffe36b", 0.5) + P_("M8.6 17.2 Q12 20 15.4 17.2", "none", 1.1) + P_("M10 18.2 l.5 1.6 .5 -1.4 M13 18.2 l.5 1.4 .5 -1.6", "none", 0.8),
  m17: () => star_(12, 12, 10.6, 4.4, 8, "#ffe36b", 0.9) + star_(12, 12, 4.6, 2.4, 8, "#fff7c8", 0),
  m18: () => P_("M15.5 2.5 A9.6 9.6 0 1 0 21.4 15.6 A7.6 7.6 0 0 1 15.5 2.5Z", "#ebe4b4") + C_(10.2, 9, 1.2, "#cfc691", 0) + C_(8.6, 15, 1.6, "#cfc691", 0) + star_(19, 6.5, 2.3, 1, 4, _c2, 0.5),
  m3: () => P_("M3 18 L4.4 7 L9 12 L12 4.6 L15 12 L19.6 7 L21 18Z", GOLD) + P_("M3 18 H21 V21 H3Z", "#c9a24a") + C_(12, 9.2, 1.3, _c1) + C_(5, 9.4, 1, _c1, 0.6) + C_(19, 9.4, 1, _c1, 0.6) + C_(8, 19.5, 0.9, _c1, 0.5) + C_(16, 19.5, 0.9, _c1, 0.5)
};
const UI_ICONS = {
  slow: `<path d="M12 2.5 V21.5 M3.8 7.2 L20.2 16.8 M3.8 16.8 L20.2 7.2" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/><circle cx="12" cy="12" r="2.4" fill="currentColor"/>`,
  vuln: `<path d="M12 2.5 L20 5.4 V11.5 C20 16.2 16.6 19.8 12 21.5 C7.4 19.8 4 16.2 4 11.5 V5.4Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 4 L10.2 9.6 L14 12 L10.8 15.4 L12.4 20" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  heart: `<path d="M12 21 C5 15.5 2.5 12 2.5 8.5 C2.5 5.7 4.6 4 7 4 C9 4 10.8 5.2 12 7 C13.2 5.2 15 4 17 4 C19.4 4 21.5 5.7 21.5 8.5 C21.5 12 19 15.5 12 21Z" fill="currentColor"/>`,
  heart0: `<path d="M12 21 C5 15.5 2.5 12 2.5 8.5 C2.5 5.7 4.6 4 7 4 C9 4 10.8 5.2 12 7 C13.2 5.2 15 4 17 4 C19.4 4 21.5 5.7 21.5 8.5 C21.5 12 19 15.5 12 21Z" fill="none" stroke="currentColor" stroke-width="1.8"/>`,
  coin: `<circle cx="12" cy="12" r="9.5" fill="#e8c050" stroke="#8f6f2a" stroke-width="1.4"/><circle cx="12" cy="12" r="6.6" fill="none" stroke="#a8842f" stroke-width="1.2"/><path d="M12 7.5 V16.5 M9.6 9.6 H13.4 Q14.6 9.6 14.6 10.8 Q14.6 12 13.4 12 H10.6 Q9.4 12 9.4 13.2 Q9.4 14.4 10.6 14.4 H14.4" fill="none" stroke="#8f6f2a" stroke-width="1.5" stroke-linecap="round"/>`,
  trophy: `<path d="M7 3.5 H17 V9 C17 12 14.8 14 12 14 C9.2 14 7 12 7 9Z M7 5 H4 C4 8.6 5.4 10 7.4 10.4 M17 5 H20 C20 8.6 18.6 10 16.6 10.4 M12 14 V18 M8 20.5 H16 M9.5 18 H14.5 V20.5 H9.5Z" fill="currentColor" fill-opacity=".9" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>`,
  dice: `<rect x="3.5" y="3.5" width="17" height="17" rx="3.5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="8.6" cy="8.6" r="1.5" fill="currentColor"/><circle cx="15.4" cy="8.6" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="8.6" cy="15.4" r="1.5" fill="currentColor"/><circle cx="15.4" cy="15.4" r="1.5" fill="currentColor"/>`,
  auto: `<path d="M12 3 L13.8 9 L20 10.8 L13.8 12.6 L12 19 L10.2 12.6 L4 10.8 L10.2 9Z" fill="currentColor"/><path d="M19 3 L19.8 5.2 L22 6 L19.8 6.8 L19 9 L18.2 6.8 L16 6 L18.2 5.2Z" fill="currentColor"/>`,
  fight: `<path d="M4 20 L16 8 M20 20 L8 8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M14.5 3 L21 3 L21 9.5 L16.5 8Z M9.5 3 L3 3 L3 9.5 L7.5 8Z" fill="currentColor"/>`,
  trash: `<path d="M5 7 H19 M9 7 V4.5 H15 V7 M7 7 L8 20 H16 L17 7 M10.5 10.5 V16.5 M13.5 10.5 V16.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
  skip: `<path d="M5 5 L14 12 L5 19Z M14 5 L23 12 L14 19Z" fill="currentColor" transform="scale(.82) translate(2.5 2.5)"/>`,
  rot: `<path d="M19 12 A7 7 0 1 1 15.5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M13.5 3 L17.4 6.2 L13.4 8.8Z" fill="currentColor"/>`,
  down: `<path d="M12 4 V17 M6 12 L12 18 L18 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 21 H19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  merge: `<path d="M4 6 H8 C13 6 13 12 18 12 M4 18 H8 C13 18 13 12 18 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M16 8.5 L20.5 12 L16 15.5Z" fill="currentColor"/>`,
  cart: `<path d="M3 4 H6 L8.2 15 H18 L20 7.5 H7" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9.5" cy="19" r="1.7" fill="currentColor"/><circle cx="16.5" cy="19" r="1.7" fill="currentColor"/>`,
  vol: `<path d="M4 9.5 H8 L13 5.5 V18.5 L8 14.5 H4Z" fill="currentColor"/><path d="M16 9 Q18.4 12 16 15 M18.6 6.4 Q22.6 12 18.6 17.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,
  mute: `<path d="M4 9.5 H8 L13 5.5 V18.5 L8 14.5 H4Z" fill="currentColor"/><path d="M16 9.5 L21.5 15 M21.5 9.5 L16 15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>`,
  clock: `<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M12 7 V12 L15.4 14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>`,
  burn: `<path d="M12 2.5 C13 6 17.5 8 17.5 13.5 C17.5 17.4 15 20.5 12 20.5 C9 20.5 6.5 17.4 6.5 13.5 C6.5 11 8 9.5 9 8 C9.5 10 10.5 10.6 11 10.6 C10.4 7.6 10.6 5 12 2.5Z" fill="#ff8a3a"/><path d="M12 13 C13.2 14.4 14.2 15.4 14.2 17 C14.2 18.4 13.2 19.4 12 19.4 C10.8 19.4 9.8 18.4 9.8 17 C9.8 15.4 11 14.6 12 13Z" fill="#ffd36b"/>`,
  poison: `<path d="M12 2.5 C14.5 6.5 18.5 10 18.5 14.2 C18.5 18 15.6 21 12 21 C8.4 21 5.5 18 5.5 14.2 C5.5 10 9.5 6.5 12 2.5Z" fill="#a06bd0"/><circle cx="9.6" cy="14.2" r="1.7" fill="#2a1048"/><circle cx="14.4" cy="14.2" r="1.7" fill="#2a1048"/><path d="M10 18 H14" stroke="#2a1048" stroke-width="1.5" stroke-linecap="round"/>`,
  regen: `<path d="M12 3.5 C18.5 3.5 20.5 9 20.5 11.5 C14 11.5 12 8.5 12 3.5Z M12 21 C12 14 8 11 3.5 11.5 C4 17 8 21 12 21Z" fill="#6fcf8a"/><path d="M12 21 V10" stroke="#6fcf8a" stroke-width="1.8" stroke-linecap="round"/>`,
  shield: `<path d="M12 2.8 L20 5.6 V11.4 C20 16.4 16.6 19.8 12 21.4 C7.4 19.8 4 16.4 4 11.4 V5.6Z" fill="#7fc3f0" stroke="#d4eeff" stroke-width="1.3" stroke-linejoin="round"/><path d="M12 6 V18.6 C9 17.2 7 14.6 7 11.4 V7.8Z" fill="#5aa8df" opacity=".6"/>`,
  cup: `<path d="M5.5 3 H18.5 C18.5 10 15.5 13.5 12 13.5 C8.5 13.5 5.5 10 5.5 3Z M12 13.5 V19 M7 21 H17" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`,
  suit_wands: `<path d="M12 2.5 C13 6 17.5 8 17.5 13.5 C17.5 17.4 15 20.5 12 20.5 C9 20.5 6.5 17.4 6.5 13.5 C6.5 11 8 9.5 9 8 C9.5 10 10.5 10.6 11 10.6 C10.4 7.6 10.6 5 12 2.5Z" fill="currentColor"/>`,
  suit_cups: `<path d="M12 2.5 C14.5 6.5 18.5 10 18.5 14.2 C18.5 18 15.6 21 12 21 C8.4 21 5.5 18 5.5 14.2 C5.5 10 9.5 6.5 12 2.5Z" fill="currentColor"/>`,
  suit_swords: `<path d="M12 2 L14.5 12 H9.5Z M6 13.4 H18 V15.6 H6Z M11 15.6 H13 V21 H11Z" fill="currentColor"/>`,
  suit_pents: `<circle cx="12" cy="12" r="9" fill="currentColor"/><path d="M12 6.4 L13.4 10.4 L17.6 10.5 L14.3 13 L15.5 17 L12 14.6 L8.5 17 L9.7 13 L6.4 10.5 L10.6 10.4Z" fill="#1a0f2c" opacity=".55"/>`,
  suit_major: `<path d="M12 2 L14.4 9 L22 9.4 L16 14 L18 21.4 L12 17.2 L6 21.4 L8 14 L2 9.4 L9.6 9Z" fill="currentColor"/>`
};
/* ===== v4 擴充圖示 ===== */
const sc_ = (cx, cy, s, inner) => `<g transform="translate(${(cx - 12 * s).toFixed(2)} ${(cy - 12 * s).toFixed(2)}) scale(${s})">${inner}</g>`;
const FLAME = f => P_("M12 2.5 C13 6 17.5 8 17.5 13.5 C17.5 17.4 15 20.5 12 20.5 C9 20.5 6.5 17.4 6.5 13.5 C6.5 11 8 9.5 9 8 C9.5 10 10.5 10.6 11 10.6 C10.4 7.6 10.6 5 12 2.5Z", f || "#ff8a3a") + P_("M12 20.5 C10.2 20.5 9 19 9 17 C9 15.5 10 14.5 12 12.5 C14 14.5 15 15.5 15 17 C15 19 13.8 20.5 12 20.5Z", "#ffd84a", 0.6);
const HEART = f => P_("M12 21 C5 15.5 2.5 12 2.5 8.5 C2.5 5.7 4.6 4 7 4 C9 4 10.8 5.2 12 7 C13.2 5.2 15 4 17 4 C19.4 4 21.5 5.7 21.5 8.5 C21.5 12 19 15.5 12 21Z", f || "#ff6b8a") + `<path d="M6 8 C6.4 6.6 7.6 6 8.6 6.2" stroke="#fff" stroke-width="1.2" fill="none" opacity=".7" stroke-linecap="round"/>`;
const SHIELD = f => P_("M12 2.8 L20 5.6 V11.4 C20 16.4 16.6 19.8 12 21.4 C7.4 19.8 4 16.4 4 11.4 V5.6Z", f || "#7fc3f0") + `<path d="M12 5.5 V19 C9 17.6 6.6 15 6.6 11.4 V7.4Z" fill="#fff" opacity=".22"/>`;
const DROP = f => P_("M12 2.5 C14.5 6.5 18.5 10 18.5 14.2 C18.5 18 15.6 21 12 21 C8.4 21 5.5 18 5.5 14.2 C5.5 10 9.5 6.5 12 2.5Z", f || "#6fb4ff") + `<path d="M9 14 C9 16 10 17.4 11.4 17.8" stroke="#fff" stroke-width="1.3" fill="none" opacity=".7" stroke-linecap="round"/>`;
const GLASS = () => L_(6, 3, 18, 3, 1.8, _ck) + L_(6, 21, 18, 21, 1.8, _ck) + P_("M7.5 3 H16.5 C16.5 9 12 11 12 12 C12 13 16.5 15 16.5 21 H7.5 C7.5 15 12 13 12 12 C12 11 7.5 9 7.5 3Z", "rgba(220,235,255,.45)") + P_("M9 19.5 H15 C14.4 16.4 12.8 14.6 12 14 C11.2 14.6 9.6 16.4 9 19.5Z", "#e8c050", 0.6);
const CROWN = f => P_("M4 18.5 L5.2 7.5 L9.2 11.5 L12 5 L14.8 11.5 L18.8 7.5 L20 18.5Z", f || "#ffd84a") + P_("M4 18.5 H20 V21 H4Z", f || "#ffd84a") + C_(12, 9.4, 1.1, "#e04a4a", 0.5);
const HELM = () => P_("M5.5 21 V11 C5.5 6.2 8.4 3.5 12 3.5 C15.6 3.5 18.5 6.2 18.5 11 V21Z", STEEL) + P_("M5.5 11.5 H18.5 V14.6 H5.5Z", "#6a7a8e", 0.8) + L_(12, 3.5, 12, 11.5, 1, "#9fb0c4") + P_("M12 3.5 C14.5 0.5 18 1.5 18.5 4 C16 3.6 14 3.6 12 3.5Z", _c1, 0.8);
const CRESC = () => P_("M15 3 C9 4 6 9 6 13 C6 18 10 21 15 21 C11 19 9.5 16 9.5 12.5 C9.5 8.5 12 5 15 3Z", "#c9d4ff");
Object.assign(ICONS, {
  w3: () => sc_(6.5, 17.5, .44, FLAME()) + sc_(12, 12.5, .6, FLAME()) + sc_(17.5, 7.5, .78, FLAME()),
  w5: () => `<g transform="translate(2.4 2.4) scale(.8)">` + ICONS.w2() + `</g>` + sc_(12, 9.5, .62, FLAME()),
  w10: () => star_(12, 12, 11.4, 7, 9, "#ffb03a", .9) + sc_(12, 12.5, .72, FLAME("#ff5a2a")),
  wq: () => sc_(12, 8, .62, CROWN()) + sc_(12, 16.5, .62, FLAME()),
  c2: () => gob_(1, 1) + sc_(12, 7.2, .4, HEART()),
  ck: () => HELM() + sc_(12, 16.5, .42, DROP()),
  c10: () => sc_(12, 12, .98, HEART()) + star_(18.5, 5, 2.6, 1, 4, _c2, .4) + star_(5, 18.5, 2.2, .9, 4, _c2, .4),
  cq: () => sc_(12, 8, .62, CROWN()) + sc_(12, 16.5, .62, DROP()),
  s3: () => sc_(12, 12, .92, HEART("#d4506a")) + L_(4, 20.5, 20.5, 4.5, 3.6, _ck) + L_(4, 20.5, 20.5, 4.5, 2, STEEL) + P_("M3 17 L7 21", "none", 1.6),
  sk: () => HELM() + L_(1.5, 8, 4.5, 8, 1.4, _c2) + L_(1, 12, 4.5, 12, 1.4, _c2) + L_(19.5, 8, 22.5, 8, 1.4, _c2) + L_(19.5, 12, 23, 12, 1.4, _c2),
  s6: () => sc_(12, 12, .95, GLASS()) + L_(3, 21, 21, 3, 1.6, "rgba(223,232,242,.9)"),
  s7: () => C_(12, 12, 9.6, "rgba(20,10,40,.4)", 1.4) + C_(12, 12, 6.4, "none", 1.2) + C_(12, 12, 2.6, "#e05a5a", .8) + L_(1.5, 12, 6, 12, 1.6, _c1) + L_(18, 12, 22.5, 12, 1.6, _c1) + L_(12, 1.5, 12, 6, 1.6, _c1) + L_(12, 18, 12, 22.5, 1.6, _c1) + L_(21, 3, 13, 11, 2.8, _ck) + L_(21, 3, 13, 11, 1.4, STEEL),
  sq: () => sc_(12, 7.5, .6, CROWN()) + P_("M12 21.5 L14.4 11.5 H9.6Z", STEEL) + P_("M7.6 11.5 H16.4 V13.4 H7.6Z", _c1),
  s10: () => sword_("rotate(180 12 12) scale(.92) translate(1 1)") + sc_(18, 17.5, .48, DROP("#a06bd0")),
  p3: () => sc_(12, 12, .98, SHIELD("#7fc3f0")) + star_(12, 12, 4.4, 1.9, 5, _c2, .5),
  p4: () => P_("M2 9 L5.4 11 L2 13Z", "#cfd6e0", .8) + P_("M22 9 L18.6 11 L22 13Z", "#cfd6e0", .8) + P_("M2 15 L5.4 17 L2 19Z", "#cfd6e0", .8) + P_("M22 15 L18.6 17 L22 19Z", "#cfd6e0", .8) + sc_(12, 12, .84, SHIELD(GOLD)),
  p7: () => C_(8.5, 16.5, 5.4, GOLD) + C_(15.5, 16.5, 5.4, GOLD) + C_(12, 9.5, 5.8, GOLD) + C_(12, 9.5, 3.6, "none", .8) + C_(8.5, 16.5, 3.4, "none", .7) + C_(15.5, 16.5, 3.4, "none", .7),
  pk: () => HELM() + C_(12, 16.6, 3.6, GOLD, .8),
  m2: () => CRESC() + star_(17.5, 9, 3.2, 1.3, 4, _c2, .5) + star_(18.5, 17, 2, .8, 4, _c2, .4),
  m5: () => C_(12, 11, 9.4, "none", 1.2) + L_(12, 2.5, 12, 21.5, 3.6, _ck) + L_(12, 2.5, 12, 21.5, 2, _c2) + L_(6.5, 7.5, 17.5, 7.5, 3.6, _ck) + L_(6.5, 7.5, 17.5, 7.5, 2, _c2) + L_(8, 12.5, 16, 12.5, 3.6, _ck) + L_(8, 12.5, 16, 12.5, 2, _c2),
  m6: () => sc_(8.2, 13.5, .66, HEART("#ff6b8a")) + sc_(15.8, 10.5, .66, HEART("#ff9a5a")),
  m7: () => P_("M3 10 H17 L21 6 V16 H3Z", _c1) + L_(8, 10, 8, 16, 1, _ck) + C_(8, 18.5, 3.4, STEEL) + C_(17, 18.5, 3.4, STEEL) + C_(8, 18.5, 1, _ck, 0) + C_(17, 18.5, 1, _ck, 0) + L_(21, 6, 21, 1.5, 1.4, _ck) + P_("M21 1.5 L15.5 3.5 L21 5.5Z", "#e04a4a", .6),
  m14: () => sc_(8, 7.5, .52, DROP("#6fb4ff")) + sc_(16, 16.5, .52, DROP("#6fcf8a")) + `<path d="M9 11 C13 11 11 17 15 17" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".85"/>` + star_(18, 5, 2.4, 1, 4, _c2, .4)
});
Object.assign(UI_ICONS, {
  crown: `<path d="M3.5 18.5 L5 7.5 L9 11.5 L12 4.5 L15 11.5 L19 7.5 L20.5 18.5Z M3.5 20 H20.5 V22 H3.5Z" fill="currentColor"/>`,
  scroll: `<path d="M6 4 H17 C18.7 4 19.5 5 19.5 6.4 V18 C19.5 19.4 18.5 20 17.4 20 H7.5 C6 20 5 19 5 17.6 V8 M5 8 H9 M9 8 V6 C9 4.8 7.8 4 6.4 4 C5.4 4 4.6 4.8 4.6 5.8 C4.6 7 5.6 8 6.8 8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 11 H16 M10 14.5 H16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`,
  book: `<path d="M12 5.5 C9.6 4 6.5 3.8 3.8 4.4 V18.6 C6.5 18 9.6 18.2 12 19.8 C14.4 18.2 17.5 18 20.2 18.6 V4.4 C17.5 3.8 14.4 4 12 5.5Z M12 5.5 V19.8" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/>`,
  medal: `<circle cx="12" cy="14" r="6" fill="currentColor"/><path d="M8 2.5 L10.6 9 M16 2.5 L13.4 9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M12 10.8 L13 13.2 L15.6 13.4 L13.6 15.1 L14.3 17.6 L12 16.2 L9.7 17.6 L10.4 15.1 L8.4 13.4 L11 13.2Z" fill="#1a0f2c" opacity=".6"/>`,
  cal: `<rect x="3.5" y="5" width="17" height="15.5" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M3.5 10 H20.5 M8 3 V7 M16 3 V7" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M12 12.4 L13 14.6 L15.4 14.8 L13.6 16.3 L14.2 18.6 L12 17.3 L9.8 18.6 L10.4 16.3 L8.6 14.8 L11 14.6Z" fill="currentColor"/>`,
  play: `<path d="M7 4 L20 12 L7 20Z" fill="currentColor"/>`,
  gem: `<path d="M6 4 H18 L22 10 L12 21 L2 10Z" fill="currentColor"/><path d="M2 10 H22 M9 4 L7 10 L12 21 L17 10 L15 4" fill="none" stroke="#1a0f2c" stroke-width="1" opacity=".45" stroke-linejoin="round"/>`,
  skull: `<path d="M12 2.8 C7.4 2.8 4.8 6 4.8 10 C4.8 12.4 6 14 7.6 15 V19 H16.4 V15 C18 14 19.2 12.4 19.2 10 C19.2 6 16.6 2.8 12 2.8Z" fill="currentColor"/><circle cx="9" cy="10.4" r="2.1" fill="#1a0f2c"/><circle cx="15" cy="10.4" r="2.1" fill="#1a0f2c"/><path d="M10 16 V19 M12 16 V19 M14 16 V19" stroke="#1a0f2c" stroke-width="1.1"/>`,
  chart: `<path d="M4 20 V4 M4 20 H20" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" fill="none"/><rect x="7" y="12" width="3" height="6" fill="currentColor"/><rect x="12" y="8" width="3" height="10" fill="currentColor"/><rect x="17" y="5" width="3" height="13" fill="currentColor"/>`,
  help: `<circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M9.4 9.4 C9.6 7.6 10.8 6.8 12.2 6.8 C13.8 6.8 14.8 7.8 14.8 9.2 C14.8 11.2 12 11.4 12 13.6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><circle cx="12" cy="16.9" r="1.2" fill="currentColor"/>`,
  lock: `<rect x="5" y="10.5" width="14" height="10" rx="2.4" fill="currentColor"/><path d="M8 10.5 V7.8 C8 5.6 9.7 4 12 4 C14.3 4 16 5.6 16 7.8 V10.5" fill="none" stroke="currentColor" stroke-width="2"/>`,
  camp: `<path d="M12 2.5 C13 6.5 17 8 17 12.5 C17 15.6 14.8 17.6 12 17.6 C9.2 17.6 7 15.6 7 12.5 C7 10.2 8.4 9 9.2 7.6 C9.8 9.2 10.6 9.6 11 9.6 C10.4 7 10.8 4.8 12 2.5Z" fill="currentColor"/><path d="M3.5 21 L20.5 17 M3.5 17 L20.5 21" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>`,
  save: `<path d="M5 4 H16.5 L20 7.5 V20 H5Z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M8 4 V9 H15 V4 M8 20 V14 H16 V20" fill="none" stroke="currentColor" stroke-width="1.7"/>`
});
const RICONS = {
  hourglass: () => GLASS(),
  whet: () => P_("M2.5 14.5 L11 7 L21.5 14 L13 21.5Z", "#aab6c6") + L_(5, 14.6, 12.6, 8.4, 1.2, "#e8eef6") + L_(8, 17.6, 15.6, 11.6, 1, "#6a7a8e"),
  chain: () => `<rect x="2.6" y="8.2" width="12" height="7.6" rx="3.8" fill="none" stroke="${_ck}" stroke-width="4.2"/><rect x="2.6" y="8.2" width="12" height="7.6" rx="3.8" fill="none" stroke="#cfd6e0" stroke-width="2.2"/><rect x="9.4" y="8.2" width="12" height="7.6" rx="3.8" fill="none" stroke="${_ck}" stroke-width="4.2"/><rect x="9.4" y="8.2" width="12" height="7.6" rx="3.8" fill="none" stroke="#e8c050" stroke-width="2.2"/>`,
  buckler: () => C_(12, 12, 9.6, "#9fb4c8") + C_(12, 12, 6.6, "none", .9) + C_(12, 12, 3.2, GOLD) + star_(12, 12, 2, .9, 4, "#fff3d0", .3),
  pouch: () => ICONS.p1(),
  herb: () => P_("M12 21 C12 14 8 11 4 11.5 C4 17 8 21 12 21Z", "#4f9a5e") + P_("M12 21 C12 12 16 6 21 5 C21 12 17 19 12 21Z", "#6fcf8a") + L_(12, 21.5, 12, 12, 1.2, _ck),
  hearth: () => sc_(12, 12.5, .95, HEART("#ff6b8a")) + sc_(12, 13, .46, FLAME()),
  mirror: () => L_(12, 18, 12, 22.5, 3.4, _ck) + L_(12, 18, 12, 22.5, 1.8, "#b9894f") + C_(12, 10.5, 8, "#cdeaff") + C_(12, 10.5, 8, "none", 1.6) + L_(7.6, 6.8, 10.4, 5.2, 1.6, "#fff") + L_(7, 9.4, 8.4, 8.6, 1.2, "#fff"),
  fang: () => P_("M6.5 3.5 H17.5 C17.5 11 15.2 15 14 21 C13.2 18 12.4 15.4 12 14 C11.6 15.4 10.8 18 10 21 C8.8 15 6.5 11 6.5 3.5Z", "#f5f0e0") + sc_(12, 7.4, .34, DROP("#a06bd0")),
  ember: () => sc_(12, 12.5, 1, FLAME("#ff6a2a")) + star_(18.5, 5, 2.2, .9, 4, "#ffd84a", .3),
  scale: () => L_(12, 3.5, 12, 20.5, 2.2, _ck) + L_(12, 3.5, 12, 20.5, 1.1, GOLD) + L_(4, 7, 20, 7, 2.6, _ck) + L_(4, 7, 20, 7, 1.4, GOLD) + P_("M1.8 13.4 H8.2 C8 15.8 6.4 17 5 17 C3.6 17 2 15.8 1.8 13.4Z", GOLD, .9) + P_("M15.8 13.4 H22.2 C22 15.8 20.4 17 19 17 C17.6 17 16 15.8 15.8 13.4Z", GOLD, .9) + L_(4, 7, 5, 13.4, .8, _ck) + L_(20, 7, 19, 13.4, .8, _ck) + L_(8, 21, 16, 21, 2.2, GOLD),
  clover: () => C_(8.8, 8.8, 4.6, "#5fbf74") + C_(15.2, 8.8, 4.6, "#5fbf74") + C_(8.8, 15, 4.6, "#4fae64") + C_(15.2, 15, 4.6, "#4fae64") + C_(12, 12, 1.8, "#9ae6a8", .6) + P_("M12 15 Q13.4 19 16.5 21.5", "none", 1.5),
  coupon: () => P_("M2.5 6.5 H21.5 V10 C19.8 10 19.8 14 21.5 14 V17.5 H2.5 V14 C4.2 14 4.2 10 2.5 10Z", GOLD) + `<path d="M8.5 7 V17" stroke="${_ck}" stroke-width="1.2" stroke-dasharray="1.6 1.6"/>` + C_(15.4, 12, 2.6, "none", 1.2),
  phoenix: () => P_("M12 3 C14 6 17.4 8 17.4 13 C17.4 16.6 15 19.5 12 19.5 C9 19.5 6.6 16.6 6.6 13 C6.6 8 10 6 12 3Z", "#ff8a3a") + P_("M6.6 12 C3.6 10.4 2.4 12.6 1.8 15.6 C3.8 15.8 5.6 15.6 7 14.8Z", "#ffb03a", .8) + P_("M17.4 12 C20.4 10.4 21.6 12.6 22.2 15.6 C20.2 15.8 18.4 15.6 17 14.8Z", "#ffb03a", .8) + P_("M12 19.5 C10.8 21 10 22 9.4 23 C11 22.6 12 22 12 22 C12 22 13 22.6 14.6 23 C14 22 13.2 21 12 19.5Z", "#ffd84a", .6) + C_(10.4, 11.4, .9, _ck, 0),
  tide: () => `<path d="M1.5 12 C4 7 7 7 9.5 12 C12 17 15 17 17.5 12 C19 9 21 8.4 22.5 9.4" fill="none" stroke="${_ck}" stroke-width="4.4" stroke-linecap="round"/><path d="M1.5 12 C4 7 7 7 9.5 12 C12 17 15 17 17.5 12 C19 9 21 8.4 22.5 9.4" fill="none" stroke="#7fc3f0" stroke-width="2.4" stroke-linecap="round"/><path d="M3 18.4 C5 15.4 7 15.4 9 18.4 C11 21.4 13 21.4 15 18.4" fill="none" stroke="#bfe6ff" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>`
};
function relicIcon(id, sz) { if (id === "pouch" && IMG_ICON.p1) return itemIcon("p1", sz); if (RELIC_IMG[id]) return `<img class="ric" src="${RELIC_IMG[id]}" width="${sz}" height="${sz}" alt="" draggable="false">`; const f = RICONS[id]; return svgWrap(f ? f() : "", sz, "--c1:#e8c468;--c2:#fff3d0;--ck:#1a0f2c"); }
const svgWrap = (inner, sz, style) => `<svg class="sv" viewBox="0 0 24 24" width="${sz}" height="${sz}" style="${style || ""}" aria-hidden="true">${inner}</svg>`;
/* 繪製版道具圖標（id → 圖片）；沒有圖片的牌沿用原本的 SVG 圖示 */
const IMG_ICON = {"s4": "img/icon-s4.webp", "w1": "img/icon-w1.webp", "c7": "img/icon-c7.webp", "c4": "img/icon-c4.webp", "c8": "img/icon-c8.webp", "m8": "img/icon-m8.webp", "p10": "img/icon-p10.webp", "p5": "img/icon-p5.webp", "m18": "img/icon-m18.webp", "w3": "img/icon-w3.webp", "m12": "img/icon-m12.webp", "m10": "img/icon-m10.webp", "m19": "img/icon-m19.webp", "m2": "img/icon-m2.webp", "s9": "img/icon-s9.webp", "m15": "img/icon-m15.webp", "m6": "img/icon-m6.webp", "m7": "img/icon-m7.webp", "m17": "img/icon-m17.webp", "w2": "img/icon-w2.webp", "wk": "img/icon-wk.webp", "m13": "img/icon-m13.webp", "m3": "img/icon-m3.webp", "p8": "img/icon-p8.webp", "m16": "img/icon-m16.webp", "m1": "img/icon-m1.webp", "s7": "img/icon-s7.webp", "s3": "img/icon-s3.webp", "s2": "img/icon-s2.webp", "s5": "img/icon-s5.webp", "sp": "img/icon-sp.webp", "s6": "img/icon-s6.webp", "s10": "img/icon-s10.webp", "sq": "img/icon-sq.webp", "sk": "img/icon-sk.webp", "c9": "img/icon-c9.webp", "c2": "img/icon-c2.webp", "c10": "img/icon-c10.webp", "c1": "img/icon-c1.webp", "cq": "img/icon-cq.webp", "ck": "img/icon-ck.webp", "p3": "img/icon-p3.webp", "p4": "img/icon-p4.webp", "m5": "img/icon-m5.webp", "w5": "img/icon-w5.webp", "w10": "img/icon-w10.webp", "wq": "img/icon-wq.webp", "m14": "img/icon-m14.webp", "p7": "img/icon-p7.webp", "pq": "img/icon-pq.webp", "pk": "img/icon-pk.webp", "c3": "img/icon-c3.webp", "p1": "img/icon-p1.webp"};
function itemIcon(id, sz) {
  if (IMG_ICON[id]) return `<img class="sv" src="${IMG_ICON[id]}" width="${sz}" height="${sz}" draggable="false" alt="" style="object-fit:contain;pointer-events:none;-webkit-user-drag:none;user-select:none">`;
  const d = ID[id], S = SUITS[d.suit], f = ICONS[id];
  return svgWrap(f ? f() : "", sz, `--c1:${S.col};--c2:${S.lt || "#fff3d0"};--ck:#1a0f2c`);
}
/* 敵人／BOSS 立繪：full=288px 全圖，face=112px 臉部裁切 */
const ENEMY_ART = {"full": {"見習占卜師": "img/enemy-full-01.webp", "星象學徒": "img/enemy-full-02.webp", "月下術士": "img/enemy-full-03.webp", "吉普賽卡蜜拉": "img/enemy-full-04.webp", "沙漠先知": "img/enemy-full-05.webp", "塔羅老人": "img/enemy-full-06.webp", "午夜讀牌人": "img/enemy-full-07.webp", "霧中女巫": "img/enemy-full-08.webp", "命運編織者": "img/enemy-full-09.webp", "水晶球商人": "img/enemy-full-10.webp", "高塔守望者": "img/enemy-full-11.webp", "石像鬼守衛": "img/enemy-full-12.webp", "死神使者": "img/enemy-full-13.webp", "命運女神": "img/enemy-full-14.webp", "精英": "img/enemy-full-15.webp"}, "face": {"見習占卜師": "img/enemy-face-01.webp", "星象學徒": "img/enemy-face-02.webp", "月下術士": "img/enemy-face-03.webp", "吉普賽卡蜜拉": "img/enemy-face-04.webp", "沙漠先知": "img/enemy-face-05.webp", "塔羅老人": "img/enemy-face-06.webp", "午夜讀牌人": "img/enemy-face-07.webp", "霧中女巫": "img/enemy-face-08.webp", "命運編織者": "img/enemy-face-09.webp", "水晶球商人": "img/enemy-face-10.webp", "高塔守望者": "img/enemy-face-11.webp", "石像鬼守衛": "img/enemy-face-12.webp", "死神使者": "img/enemy-face-13.webp", "命運女神": "img/enemy-face-14.webp", "精英": "img/enemy-face-15.webp"}};
const eArtKey = e => e.boss ? e.boss.nm : e.elite ? "精英" : e.name;
function eImg(e, kind, cls) { const m = ENEMY_ART[kind], src = e && m[eArtKey(e)]; return src ? `<img class="${cls || ""}" src="${src}" alt="" draggable="false">` : ""; }
const eTag = e => e.boss ? " boss" : e.elite ? " elite" : "";
const uiIcon = (n, sz, col) => svgWrap(UI_ICONS[n] || "", sz || 16, col ? `color:${col}` : "");
const suitIcon = (suit, sz) => uiIcon("suit_" + suit, sz, SUITS[suit].col);

