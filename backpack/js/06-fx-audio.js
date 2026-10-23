'use strict';
/* ===== 打擊特效 (canvas) + 音效 (WebAudio) ===== */
const SPR_SRC = { flame: "img/fx-flame.webp", slash: "img/fx-slash.webp" };
Object.assign(SPR_SRC, {"burn": "img/fx-burn.webp", "heal": "img/fx-heal.webp", "hit": "img/fx-hit.webp", "orb": "img/fx-orb.webp", "pierce": "img/fx-pierce.webp", "poison": "img/fx-poison.webp", "shield": "img/fx-shield.webp", "slash": "img/fx-slash-2.webp", "slow": "img/fx-slow.webp", "vuln": "img/fx-vuln.webp"});
const FX = (function () {
  let cv, cx, W = 0, H = 0, dpr = 1, parts = [], projs = [], rings = [], marks = [], sprs = [], looping = false, last = 0;
  const rnd = (a, b) => a + Math.random() * (b - a);
  function init() { cv = document.getElementById("fx"); cx = cv.getContext("2d"); resize(); window.addEventListener("resize", resize); }
  function resize() { dpr = Math.min(2, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  function kick() { if (!looping) { looping = true; last = performance.now(); requestAnimationFrame(loop); } }
  function burst(x, y, col, n, pw, o) {
    o = o || {};
    for (let i = 0; i < n; i++) {
      const a = o.dir != null ? o.dir + rnd(-(o.spread || 1), o.spread || 1) : rnd(0, Math.PI * 2), s = rnd(0.3, 1) * pw;
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: o.g == null ? 260 : o.g, life: 0, max: rnd(0.3, 0.7) * (o.life || 1), col: o.cols ? o.cols[i % o.cols.length] : col, sz: rnd(1.5, 3.6) * (o.sz || 1), sh: o.sh || "c" });
    }
    kick();
  }
  function ring(x, y, col, r, w, dur) { rings.push({ x, y, col, r, w: w || 3, t: 0, dur: dur || 0.32 }); kick(); }
  function mark(x, y, col, ang, len) { marks.push({ x, y, col, ang, len, t: 0, dur: 0.22 }); kick(); }
  function proj(kind, x0, y0, x1, y1, dur, col, cb) { projs.push({ kind, x0, y0, x1, y1, dur, col, cb, t: 0, arc: rnd(-1, 1) * 36, ph: Math.random() * 6 }); kick(); }
  const IMG = {}; Object.keys(SPR_SRC).forEach(k => { const im = new Image(); im.src = SPR_SRC[k]; IMG[k] = im; });
  /* 圖片特效：key=flame|slash；o={w,dur,r0,r1,s0,s1,rise,flip,fade} */
  function sprite(key, x, y, o) {
    const im = IMG[key]; if (!im || !im.complete || !im.naturalWidth) return; o = o || {};
    if (sprs.length > 24) sprs.shift();
    sprs.push({ im, x, y, w: o.w || 60, dur: o.dur || 0.4, r0: o.r0 || 0, r1: o.r1 || 0, s0: o.s0 == null ? 0.6 : o.s0, s1: o.s1 == null ? 1 : o.s1, rise: o.rise || 0, flip: o.flip ? -1 : 1, fade: o.fade == null ? 0.5 : o.fade, t: 0 }); kick();
  }
  function clear() { parts.length = projs.length = rings.length = marks.length = sprs.length = 0; }
  function busy() { return projs.length > 0; }
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    cx.clearRect(0, 0, W, H); cx.globalCompositeOperation = "lighter";
    // projectiles
    for (let i = projs.length - 1; i >= 0; i--) {
      const p = projs[i]; p.t += dt; const k = Math.min(1, p.t / p.dur), e = k * k * (3 - 2 * k) * 0.35 + k * 0.65;
      const x = p.x0 + (p.x1 - p.x0) * e, y = p.y0 + (p.y1 - p.y0) * e + Math.sin(k * Math.PI) * p.arc;
      p.x = x; p.y = y;
      if (p.kind === "slash") {
        const ang = Math.atan2(p.y1 - p.y0, p.x1 - p.x0), len = 46;
        cx.strokeStyle = p.col; cx.lineCap = "round"; cx.lineWidth = 3.5; cx.globalAlpha = 1;
        cx.beginPath(); cx.moveTo(x - Math.cos(ang) * len, y - Math.sin(ang) * len); cx.lineTo(x, y); cx.stroke();
        cx.strokeStyle = "#fff"; cx.lineWidth = 1.5; cx.beginPath(); cx.moveTo(x - Math.cos(ang) * len * .6, y - Math.sin(ang) * len * .6); cx.lineTo(x, y); cx.stroke();
      } else {
        const r = p.kind === "star" ? 8 : p.kind === "link" ? 4.5 : 7;
        const g = cx.createRadialGradient(x, y, 0, x, y, r * 2.4); g.addColorStop(0, "#fff"); g.addColorStop(.3, p.col); g.addColorStop(1, "rgba(0,0,0,0)");
        cx.fillStyle = g; cx.globalAlpha = 1; cx.beginPath(); cx.arc(x, y, r * 2.4, 0, 7); cx.fill();
        if ((p.kind === "orb" || p.kind === "fire") && IMG.orb && IMG.orb.complete && IMG.orb.naturalWidth) { const ow = 40, oh = ow * IMG.orb.naturalHeight / IMG.orb.naturalWidth; cx.save(); cx.globalCompositeOperation = "source-over"; cx.translate(x, y); cx.rotate(Math.atan2(p.y1 - p.y0, p.x1 - p.x0)); cx.drawImage(IMG.orb, -ow * 0.7, -oh / 2, ow, oh); cx.restore(); }
        if (p.kind === "coin") { cx.fillStyle = "#ffe27a"; cx.beginPath(); cx.ellipse(x, y, 7 * Math.abs(Math.cos(p.t * 22 + p.ph)) + 1.5, 7, 0, 0, 7); cx.fill(); }
        if (p.kind === "star") { cx.fillStyle = "#fff"; cx.save(); cx.translate(x, y); cx.rotate(p.t * 12); cx.fillRect(-1.5, -11, 3, 22); cx.fillRect(-11, -1.5, 22, 3); cx.restore(); }
        if (Math.random() < 0.9) parts.push({ x: x + rnd(-3, 3), y: y + rnd(-3, 3), vx: rnd(-30, 30), vy: p.kind === "fire" ? rnd(-60, -10) : rnd(-20, 40), g: p.kind === "fire" ? -60 : 40, life: 0, max: rnd(.18, .38), col: p.col, sz: rnd(2, 4.2), sh: "c" });
      }
      if (k >= 1) { projs.splice(i, 1); p.cb && p.cb(p.x1, p.y1); }
    }
    // marks (slash scar)
    for (let i = marks.length - 1; i >= 0; i--) {
      const m = marks[i]; m.t += dt; const k = m.t / m.dur; if (k >= 1) { marks.splice(i, 1); continue; }
      cx.globalAlpha = 1 - k; cx.strokeStyle = "#fff"; cx.lineCap = "round"; cx.lineWidth = 5 * (1 - k) + 1;
      const l = m.len * (0.4 + k * 0.8); cx.beginPath(); cx.moveTo(m.x - Math.cos(m.ang) * l, m.y - Math.sin(m.ang) * l); cx.lineTo(m.x + Math.cos(m.ang) * l, m.y + Math.sin(m.ang) * l); cx.stroke();
      cx.strokeStyle = m.col; cx.lineWidth = 2 * (1 - k) + .5; cx.stroke();
    }
    // rings
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]; r.t += dt; const k = r.t / r.dur; if (k >= 1) { rings.splice(i, 1); continue; }
      cx.globalAlpha = (1 - k) * .9; cx.strokeStyle = r.col; cx.lineWidth = r.w * (1 - k) + .5; cx.beginPath(); cx.arc(r.x, r.y, r.r * (0.3 + k * 0.9), 0, 7); cx.stroke();
    }
    // particles
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life += dt; if (p.life >= p.max) { parts.splice(i, 1); continue; }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      const a = 1 - p.life / p.max; cx.globalAlpha = a; cx.fillStyle = p.col;
      if (p.sh === "s") { cx.save(); cx.translate(p.x, p.y); cx.rotate(p.life * 10); cx.fillRect(-p.sz, -p.sz * .3, p.sz * 2, p.sz * .6); cx.fillRect(-p.sz * .3, -p.sz, p.sz * .6, p.sz * 2); cx.restore(); }
      else { cx.beginPath(); cx.arc(p.x, p.y, p.sz * (0.5 + a * .6), 0, 7); cx.fill(); }
    }
    // sprites (圖片特效)
    cx.globalCompositeOperation = "source-over";
    for (let i = sprs.length - 1; i >= 0; i--) {
      const s = sprs[i]; s.t += dt; const k = s.t / s.dur; if (k >= 1) { sprs.splice(i, 1); continue; }
      const e = 1 - (1 - k) * (1 - k), sc = s.s0 + (s.s1 - s.s0) * e, a = k < 1 - s.fade ? 1 : (1 - k) / s.fade, w = s.w * sc, h = w * s.im.naturalHeight / s.im.naturalWidth;
      cx.save(); cx.globalAlpha = Math.max(0, a); cx.translate(s.x, s.y - s.rise * e); cx.rotate(s.r0 + (s.r1 - s.r0) * e); cx.scale(s.flip, 1); cx.drawImage(s.im, -w / 2, -h / 2, w, h); cx.restore();
    }
    cx.globalAlpha = 1; cx.globalCompositeOperation = "source-over";
    if (parts.length || projs.length || rings.length || marks.length || sprs.length) requestAnimationFrame(loop); else { looping = false; cx.clearRect(0, 0, W, H); }
  }
  return { init, burst, ring, mark, proj, sprite, clear, busy };
})();

const AU = (function () {
  let ctx = null, master = null, muted = false, lastT = {}, cnt = 0, cntT = 0;
  try { muted = localStorage.getItem("bb_mute") === "1"; } catch (e) { }
  function ensure() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return ctx; }
    try { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; ctx = new A(); master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination); } catch (e) { ctx = null; }
    return ctx;
  }
  function ok(name, gap) { if (muted || !ensure()) return false; const n = performance.now(); if (n - cntT > 60) { cntT = n; cnt = 0; } if (cnt >= 4) return false; if (lastT[name] && n - lastT[name] < (gap || 0)) return false; lastT[name] = n; cnt++; return true; }
  function tone(f, d, type, vol, slide, delay) {
    const t = ctx.currentTime + (delay || 0), o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || "sine"; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + d);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + d); o.connect(g); g.connect(master); o.start(t); o.stop(t + d + .02);
  }
  function noise(d, vol, f0, f1, q, type, delay) {
    const t = ctx.currentTime + (delay || 0), n = Math.floor(ctx.sampleRate * d), buf = ctx.createBuffer(1, n, ctx.sampleRate), ch = buf.getChannelData(0);
    for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ctx.createBufferSource(); s.buffer = buf; const fl = ctx.createBiquadFilter(); fl.type = type || "bandpass"; fl.Q.value = q || 1; fl.frequency.setValueAtTime(f0, t); if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + d);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + d); s.connect(fl); fl.connect(g); g.connect(master); s.start(t);
  }
  const S = {
    shoot(suit) {
      if (!ok("shoot", 40)) return;
      if (suit === "wands") { noise(.22, .35, 500, 1800, 1.2); tone(180, .2, "sawtooth", .08, 420); }
      else if (suit === "swords") { noise(.14, .4, 3000, 7000, 2, "bandpass"); tone(900, .1, "triangle", .06, 1800); }
      else if (suit === "cups") { tone(420, .22, "sine", .22, 760); tone(630, .2, "sine", .1, 950); }
      else if (suit === "pents") { tone(1300, .08, "triangle", .12); tone(1750, .12, "triangle", .1, null, .05); }
      else { tone(300, .3, "sawtooth", .08, 900); tone(600, .3, "sine", .12, 1200); }
    },
    hit(v) {
      if (!ok("hit", 30)) return; const k = Math.min(1, v / 22), vol = .25 + k * .5;
      tone(150 - k * 50, .18 + k * .14, "sine", vol, 45); noise(.09 + k * .12, vol * .8, 1500 - k * 900, 200, .8, "lowpass");
      if (k > .55) tone(80, .3, "square", .12, 35);
    },
    heal() { if (!ok("heal", 90)) return; tone(660, .16, "sine", .17); tone(990, .22, "sine", .15, null, .08); },
    shield() { if (!ok("shield", 90)) return; tone(820, .16, "square", .06); tone(1230, .22, "triangle", .13, 1100); noise(.08, .15, 5000, 3000, 3); },
    block() { if (!ok("block", 40)) return; tone(1000, .1, "square", .08, 700); noise(.06, .2, 4000, 2500, 4); },
    dot() { if (!ok("dot", 200)) return; tone(260, .12, "triangle", .1, 160); },
    ko() { if (muted || !ensure()) return; bgmDuck(2.5); tone(110, .8, "sawtooth", .35, 30); noise(.7, .6, 1200, 80, .6, "lowpass"); tone(55, 1, "sine", .5, 25); },
    win() { if (muted || !ensure()) return; bgmDuck(2.2);[523, 659, 784, 1046].forEach((f, i) => tone(f, .34, "triangle", .2, null, i * .11)); },
    lose() { if (muted || !ensure()) return; bgmDuck(2.2);[392, 330, 262, 196].forEach((f, i) => tone(f, .4, "triangle", .2, null, i * .15)); },
    buy() { if (muted || !ensure()) return; tone(900, .08, "triangle", .12); tone(1350, .12, "triangle", .1, null, .06); },
    link() { if (!ok("link", 80)) return; tone(1100, .09, "sine", .09); tone(1650, .12, "sine", .08, null, .05); },
    vs() { if (muted || !ensure()) return; tone(130, .5, "sawtooth", .2, 60); noise(.4, .3, 400, 2500, 1.2); },
    merge() { if (muted || !ensure()) return;[523, 784, 1046].forEach((f, i) => tone(f, .25, "sine", .18, null, i * .07)); },
    tick() { if (muted || !ensure()) return; tone(500, .05, "triangle", .08); },
    drop() { if (muted || !ensure()) return; tone(220, .08, "sine", .18, 140); }
  };

  /* ===== BGM（程式合成，無外部音檔）===== */
  const mf = m => 440 * Math.pow(2, (m - 69) / 12);
  const BG = { g: null, mode: null, timer: null, step: 0, nextT: 0, nbuf: null, vol: 0.2 };
  // 每小節：[低音根音, 和弦音]
  const TRACKS = {
    calm:   { bpm: 68,  div: 2, bars: [[45, [57, 60, 64, 69]], [41, [53, 57, 60, 65]], [38, [50, 53, 57, 62]], [40, [52, 56, 59, 64]]] },
    battle: { bpm: 132, div: 4, bars: [[38, [62, 65, 69, 74]], [34, [58, 62, 65, 70]], [36, [60, 64, 67, 72]], [33, [57, 61, 64, 69]]] },
    boss:   { bpm: 148, div: 4, bars: [[38, [62, 65, 69, 74]], [34, [58, 62, 65, 70]], [43, [55, 58, 62, 67]], [33, [57, 61, 64, 69]]] }
  };
  function bt(f, t, d, type, vol, att, lp) {
    const o = ctx.createOscillator(), gg = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    gg.gain.setValueAtTime(0.0001, t); gg.gain.linearRampToValueAtTime(vol, t + (att || 0.01)); gg.gain.exponentialRampToValueAtTime(0.0003, t + d);
    o.connect(gg); let out = gg;
    if (lp) { const fl = ctx.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = lp; gg.connect(fl); out = fl; }
    out.connect(BG.g); o.start(t); o.stop(t + d + 0.05);
  }
  function bn(t, d, vol, f, type) {
    if (!BG.nbuf) { const n = ctx.sampleRate; BG.nbuf = ctx.createBuffer(1, n, ctx.sampleRate); const ch = BG.nbuf.getChannelData(0); for (let i = 0; i < n; i++) ch[i] = Math.random() * 2 - 1; }
    const src = ctx.createBufferSource(); src.buffer = BG.nbuf; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f;
    const gg = ctx.createGain(); gg.gain.setValueAtTime(vol, t); gg.gain.exponentialRampToValueAtTime(0.001, t + d);
    src.connect(fl); fl.connect(gg); gg.connect(BG.g); src.start(t, Math.random() * 0.5, d + 0.02);
  }
  function kick(t, v) {
    const o = ctx.createOscillator(), gg = ctx.createGain(); o.type = "sine"; o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.13);
    gg.gain.setValueAtTime(v, t); gg.gain.exponentialRampToValueAtTime(0.001, t + 0.2); o.connect(gg); gg.connect(BG.g); o.start(t); o.stop(t + 0.22);
  }
  const ARP_C = [0, 1, 2, 3, 2, 1, 2, 1], ARP_B = [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 2, 1, 3, 2];
  function bgmTick(mode, tr, st, t) {
    const sd = 60 / tr.bpm / tr.div, per = tr.div * 4, bar = Math.floor(st / per) % tr.bars.length, k = st % per, root = tr.bars[bar][0], ch = tr.bars[bar][1];
    if (mode === "calm") {
      if (k === 0) {
        ch.slice(0, 3).forEach(n => bt(mf(n), t, sd * 8.4, "triangle", 0.03, 1.1, 1400));
        bt(mf(root), t, sd * 7, "sine", 0.16, 0.05);
      }
      if (Math.random() > 0.2) { const n = ch[ARP_C[k]] + 12; bt(mf(n), t, 1.1, "sine", 0.055, 0.01); bt(mf(n + 12), t, 0.5, "sine", 0.014, 0.005); }
      if (k === 4 && Math.random() < 0.35) bt(mf(ch[3] + 24), t, 1.6, "sine", 0.03, 0.01);
    } else {
      const boss = mode === "boss";
      if (k % 4 === 0) kick(t, boss ? 0.55 : 0.45);
      if (k === 4 || k === 12) bn(t, 0.14, boss ? 0.26 : 0.2, 1800, "bandpass");
      if (k % 2 === 0) bn(t, 0.04, k % 4 === 2 ? 0.08 : 0.04, 7000, "highpass");
      if (k === 0) ch.slice(0, 3).forEach(n => bt(mf(n - 12), t, sd * 15, "sawtooth", 0.018, 0.3, 900));
      if (k % 2 === 0) { const n = (k === 6 || k === 14) ? root + 12 : root; bt(mf(n), t, sd * 1.8, "sawtooth", boss ? 0.16 : 0.13, 0.005, boss ? 900 : 560); }
      bt(mf(ch[ARP_B[k]]), t, sd * 0.9, boss ? "square" : "triangle", boss ? 0.032 : 0.05, 0.005, 3200);
      if (boss && k === 0 && bar % 2 === 1) bt(mf(ch[3] + 12), t, sd * 3, "sawtooth", 0.03, 0.01, 2200);
    }
  }
  function bgmPump() {
    if (!ctx || !BG.mode) return; const tr = TRACKS[BG.mode], sd = 60 / tr.bpm / tr.div;
    while (BG.nextT < ctx.currentTime + 0.25) { bgmTick(BG.mode, tr, BG.step, BG.nextT); BG.step++; BG.nextT += sd; }
  }
  function bgmSet(mode) {
    if (muted || !TRACKS[mode] || !ensure()) return;
    if (!BG.g) { BG.g = ctx.createGain(); BG.g.gain.value = 0; BG.g.connect(ctx.destination); }
    if (BG.mode === mode && BG.timer) return;
    const now = ctx.currentTime, had = !!BG.timer; BG.g.gain.cancelScheduledValues(now); BG.g.gain.setValueAtTime(BG.g.gain.value, now);
    if (had) BG.g.gain.linearRampToValueAtTime(0, now + 0.12);
    const start = now + (had ? 0.2 : 0.05); BG.g.gain.setValueAtTime(0, start); BG.g.gain.linearRampToValueAtTime(BG.vol, start + (mode === "calm" ? 1.2 : 0.4));
    BG.mode = mode; BG.step = 0; BG.nextT = start; if (!BG.timer) BG.timer = setInterval(bgmPump, 60);
  }
  function bgmStop() {
    if (BG.timer) { clearInterval(BG.timer); BG.timer = null; } BG.mode = null;
    if (BG.g && ctx) { const n = ctx.currentTime; BG.g.gain.cancelScheduledValues(n); BG.g.gain.setValueAtTime(BG.g.gain.value, n); BG.g.gain.linearRampToValueAtTime(0, n + 0.15); }
  }
  function bgmDuck(sec) {
    if (!BG.g || !BG.timer || !ctx) return; const n = ctx.currentTime, lo = BG.vol * 0.25;
    BG.g.gain.cancelScheduledValues(n); BG.g.gain.setValueAtTime(BG.g.gain.value, n); BG.g.gain.linearRampToValueAtTime(lo, n + 0.1); BG.g.gain.setValueAtTime(lo, n + sec); BG.g.gain.linearRampToValueAtTime(BG.vol, n + sec + 1.2);
  }
  try { document.addEventListener("visibilitychange", () => { if (!ctx) return; if (document.hidden) ctx.suspend(); else if (!muted) ctx.resume(); }); } catch (e) { }
  return Object.assign({ ensure, bgm: bgmSet, auto: null, toggle() { muted = !muted; try { localStorage.setItem("bb_mute", muted ? "1" : "0"); } catch (e) { } if (muted) bgmStop(); else { ensure(); if (AU.auto) AU.auto(); } return muted; }, isMuted: () => muted }, S);
})();

