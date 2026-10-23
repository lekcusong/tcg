'use strict';
/* ===== 戰鬥 ===== */
class Battle {
  constructor(pItems, pHp, eItems, eHp, mods, boss) {
    mods = mods || {}; this.mods = mods;
    const pb = buildUnits(pItems, mods), eb = buildUnits(eItems, {}); this.fx = pb.fx || {}; this.rg = (mods.regenAll || 0) + (this.fx.regen || 0);
    const mk = (b, hp) => ({ hp, max: hp, shield: 0, burn: 0, poison: 0, regen: 0, thorns: 0, slow: 0, vuln: 0, units: b.units, tk: 0, pt: 0 });
    this.s = [mk(pb, pHp), mk(eb, eHp)]; this.t = 0; this.over = false; this.winner = -1; this.ev = []; this.stat = [{}, {}]; this.boss = boss || null; this.bt = 0; this.phoenix = !!mods.phoenix; this.phoenixUsed = false;
    this.s.forEach(s => s.units.forEach(u => { if (u.vals.open) s.shield += Math.round(u.vals.open); if (u.vals.thorns) s.thorns += Math.round(u.vals.thorns); }));
    this.s[0].shield += (mods.open || 0) + (this.fx.open || 0); this.s[0].thorns += (mods.thorns || 0) + (this.fx.thorns || 0);
    if (boss && boss.type === "armor") this.s[1].shield += 12;
  }
  st(si, idx, k, v) { if (idx == null) return; const o = this.stat[si][idx] || (this.stat[si][idx] = { d: 0, s: 0 }); o[k] += v; }
  hit(si, v, pierce) {
    const s = this.s[si]; let ab = 0; if (s.vuln > 0 && !this._dot) v *= 1.25; const tot = v;
    if (!pierce && s.shield > 0) { ab = Math.min(s.shield, v); s.shield -= ab; v -= ab; }
    s.hp -= v; this.ev.push({ k: "dmg", si, v: Math.round(v), ab: Math.round(ab), src: this._src, dot: this._dot, pr: pierce ? 1 : 0 });
    if (this._src != null) {
      this.st(1 - si, this._src, "d", Math.round(tot));
      if (s.thorns > 0 && !this._thorn) { const keep = this._src; this._thorn = true; this._src = undefined; this._dot = "thorn"; this.hit(1 - si, s.thorns, true); this._dot = undefined; this._thorn = false; this._src = keep; }
    }
  }
  fire(si, u) {
    const me = this.s[si], foe = this.s[1 - si], v = u.vals, a = u.d.act; this._src = u.idx;
    if (v.dmg) {
      let d = v.dmg; if (v.ramp) { d += Math.min(12, v.ramp * u.cnt); u.cnt++; }
      if (v.exec && foe.hp < foe.max * 0.35) d *= 1.6;
      this.hit(1 - si, Math.round(d), a.pierce);
    }
    if (v.detonate && foe.burn > 0) { const d = Math.round(foe.burn * 2.5 * u.pw); foe.burn = 0; this.hit(1 - si, d, false); this.ev.push({ k: "boom", si: 1 - si }); }
    if (v.pct) this.hit(1 - si, Math.max(8, Math.round(v.pct * foe.max)), a.pierce);
    if (v.burn) foe.burn += Math.round(v.burn);
    if (v.poison) foe.poison += Math.round(v.poison);
    if (v.regen) me.regen += Math.round(v.regen);
    if (v.heal) { const h = Math.round(v.heal); me.hp = Math.min(me.max, me.hp + h); this.ev.push({ k: "heal", si, v: h, src: this._src }); this.st(si, u.idx, "s", h); }
    if (v.shield) { me.shield += Math.round(v.shield); this.ev.push({ k: "shield", si, v: Math.round(v.shield), src: this._src }); this.st(si, u.idx, "s", Math.round(v.shield)); }
    if (v.cleanse) { me.burn = Math.max(0, me.burn - Math.round(v.cleanse)); me.poison = Math.max(0, me.poison - Math.round(v.cleanse)); me.slow = Math.max(0, me.slow - v.cleanse * 0.5); me.vuln = Math.max(0, me.vuln - v.cleanse * 0.5); }
    if (v.slow) { foe.slow = Math.min(8, foe.slow + v.slow); this.ev.push({ k: "status", si: 1 - si, st: "slow" }); }
    if (v.vuln) { foe.vuln = Math.min(8, foe.vuln + v.vuln); this.ev.push({ k: "status", si: 1 - si, st: "vuln" }); }
    if (v.self) { me.hp -= Math.round(v.self); this.ev.push({ k: "dmg", si, v: Math.round(v.self), ab: 0 }); }
    if (v.delay) { const t = foe.units.filter(o => o.cd > 0); if (t.length) { const o = t[Math.floor(Math.random() * t.length)]; o.timer -= v.delay; this.ev.push({ k: "delay", si: 1 - si, idx: o.idx }); } }
    if (a.recharge) { const c = me.units.filter(o => o !== u && o.cd > 0); for (let n = 0; n < a.recharge && c.length; n++) { const o = c.splice(Math.floor(Math.random() * c.length), 1)[0]; o.timer = o.cd; this.ev.push({ k: "charge", si, idx: o.idx }); } }
    if (a.wheel) {
      const p = u.pw, r = Math.floor(Math.random() * 4);
      if (r === 0) this.hit(1 - si, Math.round(22 * p), false);
      else if (r === 1) { const h = Math.round(18 * p); me.hp = Math.min(me.max, me.hp + h); this.ev.push({ k: "heal", si, v: h }); }
      else if (r === 2) { me.shield += Math.round(24 * p); this.ev.push({ k: "shield", si, v: Math.round(24 * p) }); }
      else foe.burn += Math.round(8 * p);
    }
    this.ev.push({ k: "fire", si, idx: u.idx }); this._src = undefined;
  }
  bossAct() {
    const t = this.boss.type, p = this.s[0], e = this.s[1];
    if (t === "armor") { e.shield += 5; this.ev.push({ k: "shield", si: 1, v: 5 }); }
    else if (t === "reap") { p.shield = 0; const d = Math.round(p.max * 0.1); p.hp -= d; this.ev.push({ k: "boss", type: t }); this.ev.push({ k: "dmg", si: 0, v: d, ab: 0, dot: "boss" }); }
    else if (t === "chaos") {
      const r = Math.floor(Math.random() * 4); this.ev.push({ k: "boss", type: t });
      if (r === 0) { const h = Math.round(e.max * 0.06); e.hp = Math.min(e.max, e.hp + h); this.ev.push({ k: "heal", si: 1, v: h }); }
      else if (r === 1) { p.burn += 4; this.ev.push({ k: "dmg", si: 0, v: 0, ab: 0, dot: "boss" }); }
      else if (r === 2) { const c = p.units.filter(o => o.cd > 0); if (c.length) { const o = c[Math.floor(Math.random() * c.length)]; o.timer -= 1.2; this.ev.push({ k: "delay", si: 0, idx: o.idx }); } }
      else { e.shield += 10; this.ev.push({ k: "shield", si: 1, v: 10 }); }
    }
  }
  step(dt) {
    if (this.over) return;
    this.t += dt;
    for (let si = 0; si < 2; si++) { const sp = this.s[si].slow > 0 ? 0.7 : 1; this.s[si].units.forEach(u => { if (!u.cd) return; u.timer += dt * sp; if (u.timer >= u.cd) { u.timer -= u.cd; this.fire(si, u); } }); this.s[si].slow = Math.max(0, this.s[si].slow - dt); this.s[si].vuln = Math.max(0, this.s[si].vuln - dt); }
    if (this.boss) { const iv = this.boss.type === "reap" ? 6 : 5; this.bt += dt; while (this.bt >= iv) { this.bt -= iv; this.bossAct(); } }
    for (let si = 0; si < 2; si++) {
      const s = this.s[si]; s.tk += dt;
      while (s.tk >= 1) {
        s.tk -= 1; s.pt++;
        if (s.burn > 0) { this._dot = "burn"; this.hit(si, s.burn, false); this._dot = undefined; s.burn = Math.max(0, s.burn - 1); }
        if (s.poison > 0) { s.hp -= s.poison; this.ev.push({ k: "dmg", si, v: s.poison, ab: 0, p: 1 }); if (s.pt % 3 === 0) s.poison--; }
        if (s.regen > 0) { const h = s.regen; s.hp = Math.min(s.max, s.hp + h); this.ev.push({ k: "heal", si, v: h }); s.regen--; }
        if (si === 0 && this.rg) { s.hp = Math.min(s.max, s.hp + this.rg); this.ev.push({ k: "heal", si, v: this.rg }); }
        if (si === 0 && this.mods.pulse && s.pt % 5 === 0) { s.shield += this.mods.pulse; this.ev.push({ k: "shield", si, v: this.mods.pulse }); }
        if (this.t > 20) { const f = Math.floor((this.t - 20) / 2) + 1; s.hp -= f; this.ev.push({ k: "dmg", si, v: f, ab: 0, p: 1 }); }
      }
    }
    const [p, e] = this.s;
    if (p.hp <= 0 && this.phoenix && !this.phoenixUsed && e.hp > 0) { this.phoenixUsed = true; p.hp = Math.round(p.max * 0.3); p.burn = p.poison = 0; this.ev.push({ k: "phoenix", si: 0 }); }
    if (p.hp <= 0 || e.hp <= 0) { this.over = true; this.winner = (p.hp > 0 && e.hp <= 0) ? 0 : (e.hp > 0 && p.hp <= 0) ? 1 : (p.hp > e.hp ? 0 : 1); }
  }
}

