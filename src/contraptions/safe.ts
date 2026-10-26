import type { Contraption } from '../engine/types';
import { num, details, lamp, emit, poke, Runner } from '../engine/kit';
import { TAU } from '../engine/geometry';

// Safe cracker: number dials spin one after another until each hits its code digit and locks; the last lock opens a <details> door.
export const safe: Contraption = {
  kind: 'safe', tags: ['start'], nominal: 4000, weight: 1.0,
  build(c) {
    const R = new Runner(c.scope);
    const { rng, u, r } = c;
    const n = rng.int(4, 6), ro = r * 0.66, dw = Math.max(20 * u, r * 0.25);
    const a0 = rng.range(0, TAU);
    const pos = (i: number) => { const a = a0 + (i / n) * TAU; return { x: Math.cos(a) * ro, y: Math.sin(a) * ro }; };
    const dials = Array.from({ length: n }, (_, i) => { const d = num(c.host, { ...pos(i), w: dw, h: dw * 1.35, value: rng.int(0, 9), hue: c.hue + i * 18 }); d.style.fontSize = Math.round(dw * 0.95) + 'px'; return d; });
    const door = details(c.host, { x: 0, y: 0, w: r * 0.5, h: r * 0.5, summary: '◆', body: '', cls: 'step', hue: c.hue2 });
    door.style.fontSize = Math.round(r * 0.3) + 'px';
    const entry = lamp(c.host, -r * 1.02, -r * 0.5, 11 * u, c.hue);
    const out = lamp(c.host, r * 1.02, r * 0.5, 11 * u, c.hue2);
    const code = dials.map(() => rng.int(0, 9));
    let cur = 0, left = 0;
    const bump = () => { const d = dials[cur]; d.value = String((+d.value + 1) % 10); d.classList.add('on'); emit(d, 'input'); };
    const startDial = () => { left = 10 + ((code[cur] - +dials[cur].value + 10) % 10); bump(); };
    dials.forEach((d, i) => c.scope.on(d, 'input', () => {
      if (i !== cur) return;
      c.hit(pos(i).x, pos(i).y, 0.04, +d.value);
      if (--left > 0) R.s.after(30 + (left < 6 ? (6 - left) * 20 : 0), bump);
      else {
        R.s.after(160, () => { c.hit(pos(i).x, pos(i).y, 0.4, 3); d.style.opacity = '1'; });
        cur++;
        if (cur < n) R.s.after(260, startDial); else R.s.after(420, () => { door.open = true; });
      }
    }));
    c.scope.on(door, 'toggle', () => { if (door.open) { c.hit(0, 0, 0.6, 0); R.s.after(300, () => poke(out)); } });
    c.scope.on(entry, 'change', () => { if (entry.checked) { cur = 0; startDial(); } });
    return {
      entries: [entry], exit: { el: out, type: 'change' }, entryPts: [{ x: -r * 1.02, y: -r * 0.5 }], exitPt: { x: r * 1.02, y: r * 0.5 }, budgetMs: n * 800 + 1500,
      reset() { R.reset(); cur = 0; entry.checked = false; out.checked = false; door.open = false; dials.forEach((d) => d.classList.remove('on')); },
      flourish() { dials.forEach((d, i) => R.s.after(i * 80, () => { d.classList.add('on'); R.s.after(500, () => d.classList.remove('on'), true); }, true)); },
    };
  },
};
