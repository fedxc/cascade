import type { Contraption } from '../engine/types';
import { checkbox, group, mv, poke, Runner } from '../engine/kit';
import { fitShape, sampleByArc, waveFn, spiralFn, arcFn, lissajousFn, TAU, type Pt } from '../engine/geometry';

// A line of upright checkbox "dominoes" along a curve. Each check tips the domino and pokes the next.
export const domino: Contraption = {
  kind: 'domino', tags: ['start', 'fast'], nominal: 3200,
  build(c) {
    const R = new Runner(c.scope);
    const { rng, u, r } = c;
    const shapes = [
      () => waveFn(2, rng.range(0.35, 0.7), rng.pick([1, 1.5, 2])),
      () => spiralFn(0.15, 1, rng.range(1.2, 2), rng.range(0, TAU)),
      () => arcFn(1, rng.range(0, TAU), rng.range(0, TAU) + rng.pick([-1, 1]) * rng.range(3.4, 5)),
      () => lissajousFn(1, 0.6, 1, 2, rng.range(0, 1)),
    ];
    const raw = rng.pick(shapes)();
    const f = fitShape(raw, r * 0.86);
    const pts = sampleByArc(f, 12.5 * u, { max: 60 });
    const doms = pts.map((p, i) => checkbox(c.host, {
      x: p.x, y: p.y, w: 5 * u, h: 17 * u, rot: p.a, cls: 'dom', hue: c.hue + (i / pts.length) * (c.hue2 - c.hue) * 0.4,
    }));
    const n = doms.length;
    doms.forEach((d, i) => {
      c.scope.on(d, 'change', () => {
        if (!d.checked) return;
        const p = pts[i];
        mv(d, p.x + Math.cos(p.a) * 5 * u, p.y + Math.sin(p.a) * 5 * u, p.a + 0.55);
        c.hit(p.x, p.y, 0.1 + 0.2 * (i % 6 === 0 ? 1 : 0), i);
        if (i < n - 1) R.s.after(78 - 36 * (i / n), () => poke(doms[i + 1]));
      });
    });
    return {
      entries: [doms[0]], exit: { el: doms[n - 1], type: 'change' },
      entryPts: [{ x: pts[0].x, y: pts[0].y }], exitPt: { x: pts[n - 1].x, y: pts[n - 1].y }, budgetMs: n * 75 + 800,
      reset() {
        R.reset();
        doms.forEach((d, i) => { d.checked = false; mv(d, pts[i].x, pts[i].y, pts[i].a); });
      },
      flourish() { doms.forEach((d, i) => R.s.after(i * 12, () => { d.classList.add('on'); R.s.after(220, () => d.classList.remove('on'), true); }, true)); },
    };
  },
};
void group; type _P = Pt;
