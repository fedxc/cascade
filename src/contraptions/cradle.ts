import type { Contraption } from '../engine/types';
import { checkbox, range, group, mv, lamp, poke, Runner } from '../engine/kit';
import { ease } from '../engine/clock';

// Newton's cradle: momentum travels through five hanging checkbox balls (each check pokes its neighbour) and the end ball swings out.
export const cradle: Contraption = {
  kind: 'cradle', tags: ['tall'], nominal: 5200, weight: 1.05,
  build(c) {
    const R = new Runner(c.scope);
    const { u, r } = c;
    const n = 5, d = Math.min(r * 0.36, 26 * u + r * 0.1), L = r * 0.9, top = -r * 0.62;
    const ox = (i: number) => (i - (n - 1) / 2) * d;
    const gs = Array.from({ length: n }, (_, i) => group(c.host, { x: ox(i), y: top }));
    gs.forEach((g, i) => { range(g, { x: L / 2, y: 0, w: L, h: 14, cls: 'arm', hue: c.hue + i * 6, value: 100, min: 0, max: 100 }); mv(g, ox(i), top, Math.PI / 2); });
    const balls = gs.map((g, i) => checkbox(g, { x: L, y: 0, w: d * 0.9, h: d * 0.9, cls: 'ball', hue: c.hue + i * 8 }));
    const entry = lamp(c.host, ox(0) - d * 1.8, top, 11 * u, c.hue);
    const out = lamp(c.host, ox(n - 1) + d * 1.8, top, 11 * u, c.hue2);
    const A = 0.85;
    const swing = (i: number, sign: number, done: () => void) => {
      R.s.tween(520, (t) => mv(gs[i], undefined, undefined, Math.PI / 2 + sign * A * ease.out(t)), () => {
        R.s.tween(520, (t) => mv(gs[i], undefined, undefined, Math.PI / 2 + sign * A * (1 - ease.in(t))), done);
      });
    };
    let pass = 0;
    balls.forEach((b, i) => c.scope.on(b, 'change', () => {
      if (!b.checked) return;
      c.hit(ox(i), top + L, 0.28, i * 2);
      const dir = pass === 0 ? 1 : -1, nx = i + dir;
      if (nx >= 0 && nx < n) { R.s.after(34, () => poke(balls[nx])); return; }
      // end of the line: this ball swings out and back
      balls.forEach((x) => (x.checked = false));
      swing(i, pass === 0 ? 1 : -1, () => {
        if (pass === 0) { pass = 1; poke(balls[n - 1]); } else R.s.after(100, () => poke(out));
      });
    }));
    c.scope.on(entry, 'change', () => {
      if (!entry.checked) return;
      R.s.tween(460, (t) => mv(gs[0], undefined, undefined, Math.PI / 2 - A * (1 - ease.in(t))), () => poke(balls[0]));
    });
    return {
      entries: [entry], exit: { el: out, type: 'change' }, entryPts: [{ x: ox(0) - d * 1.8, y: top }], exitPt: { x: ox(n - 1) + d * 1.8, y: top }, budgetMs: 3600,
      reset() { R.reset(); pass = 0; entry.checked = false; out.checked = false; balls.forEach((b) => (b.checked = false)); gs.forEach((g, i) => mv(g, ox(i), top, Math.PI / 2)); mv(gs[0], undefined, undefined, Math.PI / 2 - A); },
      flourish() { gs.forEach((g, i) => R.s.tween(800, (t) => mv(g, undefined, undefined, Math.PI / 2 + 0.3 * Math.sin(t * 6.28 + i)), undefined, undefined, true)); },
    };
  },
};
void rangeUnused;
function rangeUnused() {}
