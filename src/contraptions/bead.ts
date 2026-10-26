import type { Contraption } from '../engine/types';
import { radio, poke, Runner } from '../engine/kit';
import { fitShape, sampleByArc, spiralFn, eightFn, lissajousFn, TAU } from '../engine/geometry';

// One radio group; the single selection travels like a bead along a spiral / figure-eight / Lissajous path.
let uid = 0;
export const bead: Contraption = {
  kind: 'bead', tags: ['start', 'slow'], nominal: 3600, weight: 1.1,
  build(c) {
    const R = new Runner(c.scope);
    const { rng, u, r } = c;
    const name = 'bead' + uid++;
    const fn = rng.pick([
      () => spiralFn(0.12, 1, rng.range(2, 3.2), rng.range(0, TAU)),
      () => eightFn(1, 0.7),
      () => lissajousFn(1, 0.9, rng.pick([2, 3]), rng.pick([3, 4, 5]), rng.range(0, 1.5)),
    ])();
    const f = fitShape(fn, r * 0.88);
    const pts = sampleByArc(f, 9.5 * u, { max: 90 });
    const beads = pts.map((p, i) => radio(c.host, {
      x: p.x, y: p.y, w: (i % 8 === 0 ? 11 : 8) * u, h: (i % 8 === 0 ? 11 : 8) * u, name, hue: c.hue + (i / pts.length) * (c.hue2 - c.hue) * 0.5,
    }));
    const n = beads.length;
    beads.forEach((b, i) => {
      c.scope.on(b, 'change', () => {
        if (!b.checked) return;
        b.classList.add('on'); R.s.after(260, () => b.classList.remove('on'), true);
        if (i % 3 === 0) c.hit(pts[i].x, pts[i].y, i % 12 === 0 ? 0.22 : 0.07, i);
        if (i < n - 1) R.s.after(30 + 24 * Math.abs(Math.sin(i / 7)), () => poke(beads[i + 1]));
      });
    });
    return {
      entries: [beads[0]], exit: { el: beads[n - 1], type: 'change' },
      entryPts: [pts[0]], exitPt: pts[n - 1], budgetMs: n * 55 + 600,
      reset() { R.reset(); beads.forEach((b) => { b.checked = false; b.classList.remove('on'); }); },
      flourish() { beads.forEach((b, i) => R.s.after(i * 10, () => { b.classList.add('on'); R.s.after(300, () => b.classList.remove('on'), true); }, true)); },
    };
  },
};
