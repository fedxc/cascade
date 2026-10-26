import type { Contraption } from '../engine/types';
import { meter, radio, lamp, poke, setProgress, Runner } from '../engine/kit';
import { TAU } from '../engine/geometry';
import { ease } from '../engine/clock';

// Clock escapement: a meter winds up (red → amber → colour), snaps, and ticks a ring of radios; a slower inner ring is geared to it.
let uid = 0;
export const escapement: Contraption = {
  kind: 'escapement', tags: ['slow'], nominal: 6000, weight: 1.1,
  build(c) {
    const R = new Runner(c.scope);
    const { u, r } = c;
    const id = uid++;
    const N = 12, M = 4, ro = r * 0.82, ri = r * 0.5;
    const ringO = Array.from({ length: N }, (_, i) => { const a = (i / N) * TAU - Math.PI / 2; return radio(c.host, { x: Math.cos(a) * ro, y: Math.sin(a) * ro, w: Math.max(10 * u, r * 0.07), h: Math.max(10 * u, r * 0.07), name: 'eo' + id, hue: c.hue + i * 4 }); });
    const ringI = Array.from({ length: M }, (_, i) => { const a = (i / M) * TAU - Math.PI / 2; return radio(c.host, { x: Math.cos(a) * ri, y: Math.sin(a) * ri, w: Math.max(13 * u, r * 0.1), h: Math.max(13 * u, r * 0.1), name: 'ei' + id, hue: c.hue2 + i * 10 }); });
    const m = meter(c.host, { x: 0, y: 0, w: r * 0.55, h: Math.max(9 * u, r * 0.05), value: 0, min: 0, max: 1, low: 0.34, high: 0.67, optimum: 1, hue: c.hue });
    const entry = lamp(c.host, 0, -r * 1.0, 11 * u, c.hue);
    const out = lamp(c.host, 0, r * 1.0, 11 * u, c.hue2);
    let k = -1, running = false;
    const wind = () => {
      R.s.tween(300, (t) => { m.value = t; }, () => { setProgress(m, 1, 'change'); }, ease.in);
    };
    c.scope.on(m, 'change', () => {
      if (!running) return;
      k++;
      poke(ringO[k % N]);
      if (k % 3 === 2) poke(ringI[Math.floor(k / 3) % M]);
      R.s.tween(120, (t) => { m.value = 1 - t; });
      if (k < N - 1) R.s.after(260, wind); else R.s.after(320, () => poke(out));
    });
    ringO.forEach((e, i) => c.scope.on(e, 'change', () => { if (e.checked) c.hit(Math.cos((i / N) * TAU - Math.PI / 2) * ro, Math.sin((i / N) * TAU - Math.PI / 2) * ro, 0.18, i); }));
    c.scope.on(entry, 'change', () => { if (entry.checked) { running = true; k = -1; wind(); } });
    return {
      entries: [entry], exit: { el: out, type: 'change' }, entryPts: [{ x: 0, y: -r }], exitPt: { x: 0, y: r }, budgetMs: N * 480 + 800, slow: true,
      reset() { R.reset(); running = false; k = -1; entry.checked = false; out.checked = false; m.value = 0; ringO.forEach((e) => (e.checked = false)); ringI.forEach((e) => (e.checked = false)); },
      flourish() { m.value = 1; },
    };
  },
};
