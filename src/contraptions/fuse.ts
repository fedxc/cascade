import type { Contraption } from '../engine/types';
import { meter, lamp, emit, poke, Runner } from '../engine/kit';
import { fitShape, sampleByArc, spiralFn, TAU } from '../engine/geometry';

// Fuse: a spiral of meters burning inward, slowly (ignores tempo). A meter's low / high zones make the flame go colour → amber → red.
export const fuse: Contraption = {
  kind: 'fuse', tags: ['slow'], nominal: 8000, weight: 1.1,
  build(c) {
    const R = new Runner(c.scope);
    const { rng, u, r } = c;
    const f = fitShape(spiralFn(1, 0.12, rng.range(1.6, 2.4), rng.range(0, TAU)), r * 0.92);
    const pts = sampleByArc(f, Math.max(14 * u, r * 0.1), { max: 48 });
    const n = pts.length - 1;
    const ms = Array.from({ length: n }, (_, i) => {
      const a = pts[i], b = pts[i + 1], L = Math.hypot(b.x - a.x, b.y - a.y);
      return meter(c.host, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, w: L + 1, h: Math.max(5, r * 0.04), rot: Math.atan2(b.y - a.y, b.x - a.x), value: 0, min: 0, max: 1, low: 0.33, high: 0.66, optimum: 0, hue: c.hue + (i / n) * 40 });
    });
    const entry = lamp(c.host, pts[0].x - 12 * u, pts[0].y - 10 * u, 11 * u, c.hue);
    const out = lamp(c.host, pts[n].x, pts[n].y, 11 * u, c.hue2);
    const burn = (i: number) => {
      let sent = false;
      R.s.tween(360 + (i % 4) * 30, (t) => {
        ms[i].value = t;
        if (!sent && t > 0.7) { sent = true; emit(ms[i], 'input'); }
      }, () => { R.s.tween(2600, (t) => { ms[i].value = 1 - t; }, undefined, undefined, true); }, undefined, true);
    };
    ms.forEach((m, i) => c.scope.on(m, 'input', () => {
      c.hit((pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2, 0.1, i);
      if (i < n - 1) burn(i + 1); else R.s.after(250, () => poke(out), true);
    }));
    c.scope.on(entry, 'change', () => { if (entry.checked) burn(0); });
    return {
      entries: [entry], exit: { el: out, type: 'change' }, entryPts: [{ x: pts[0].x - 12 * u, y: pts[0].y - 10 * u }], exitPt: { x: pts[n].x, y: pts[n].y }, budgetMs: n * 400 + 3000, slow: true,
      reset() { R.reset(); entry.checked = false; out.checked = false; ms.forEach((m) => (m.value = 0)); },
      flourish() { ms.forEach((m, i) => R.s.tween(900, (t) => { m.value = Math.sin(t * Math.PI); }, undefined, undefined, true)); },
    };
  },
};
