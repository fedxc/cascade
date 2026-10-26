import type { Contraption } from '../engine/types';
import { progress, lamp, emit, poke, Runner } from '../engine/kit';

// Hourglass: a slow fuse. Columns of progress bars drain at the top while their twins fill below; each column,
// 40 % drained, starts the next. Ignores tempo (it is always slow).
export const hourglass: Contraption = {
  kind: 'hourglass', tags: ['slow'], nominal: 9000, weight: 1.0,
  build(c) {
    const R = new Runner(c.scope);
    const { rng, u, r } = c;
    const n = rng.int(7, 11), sp = (r * 1.2) / n, H = r * 0.62;
    const hs = (i: number) => H * (0.28 + 0.72 * (1 - Math.abs(i - (n - 1) / 2) / (n / 2 + 0.5)));
    const topY = (i: number) => -r * 0.06 - hs(i) / 2, botY = (i: number) => r * 0.06 + hs(i) / 2;
    const tops = Array.from({ length: n }, (_, i) => progress(c.host, { x: (i - (n - 1) / 2) * sp, y: topY(i), w: hs(i), h: Math.max(4, sp * 0.62), rot: -Math.PI / 2, value: 1, hue: c.hue }));
    const bots = Array.from({ length: n }, (_, i) => progress(c.host, { x: (i - (n - 1) / 2) * sp, y: botY(i), w: hs(i), h: Math.max(4, sp * 0.62), rot: -Math.PI / 2, value: 0, hue: c.hue2 }));
    const entry = lamp(c.host, -r * 0.95, -H * 0.5, 11 * u, c.hue);
    const out = lamp(c.host, r * 0.95, H * 0.5, 11 * u, c.hue2);
    const drain = (i: number) => {
      let kicked = false;
      R.s.tween(2300 + hs(i) * 4, (t) => {
        tops[i].value = 1 - t; bots[i].value = t;
        if (!kicked && t > 0.4) { kicked = true; emit(tops[i], 'input'); }
      }, () => emit(bots[i], 'change'), undefined, true);
    };
    tops.forEach((t, i) => c.scope.on(t, 'input', () => { if (i < n - 1) drain(i + 1); }));
    bots.forEach((b, i) => c.scope.on(b, 'change', () => { c.hit((i - (n - 1) / 2) * sp, botY(i) + hs(i) / 2, 0.16, i); if (i === n - 1) R.s.after(200, () => poke(out), true); }));
    c.scope.on(entry, 'change', () => { if (entry.checked) drain(0); });
    return {
      entries: [entry], exit: { el: out, type: 'change' }, entryPts: [{ x: -r * 0.95, y: -H * 0.5 }], exitPt: { x: r * 0.95, y: H * 0.5 }, budgetMs: n * 1100 + 4000, slow: true,
      reset() { R.reset(); entry.checked = false; out.checked = false; tops.forEach((t) => (t.value = 1)); bots.forEach((b) => (b.value = 0)); },
      flourish() { tops.forEach((t, i) => R.s.tween(700, (x) => { t.value = 1 - x; bots[i].value = x; }, undefined, undefined, true)); },
    };
  },
};
