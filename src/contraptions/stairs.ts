import type { Contraption } from '../engine/types';
import { details, lamp, poke, Runner } from '../engine/kit';
import { GLYPHS } from '../engine/kit';

// Staircase: details elements opening one after another. Each `toggle` (native, async) opens the next step.
export const stairs: Contraption = {
  kind: 'stairs', tags: ['start'], nominal: 3000, weight: 1.0,
  build(c) {
    const R = new Runner(c.scope);
    const { rng, u, r } = c;
    const n = rng.int(7, 12);
    const w = Math.min(46 * u, (r * 1.6) / n * 2.4), h = w * 0.5;
    const dx = (r * 1.5) / n, dy = (r * 1.2) / n * (rng.chance(0.5) ? -1 : 1);
    const ds = Array.from({ length: n }, (_, i) => {
      const d = details(c.host, { x: (i - (n - 1) / 2) * dx, y: (i - (n - 1) / 2) * dy, w, h, summary: rng.pick(GLYPHS), body: '', cls: 'step', hue: c.hue + (i / n) * (c.hue2 - c.hue) * 0.6 });
      d.style.fontSize = Math.round(h * 0.6) + 'px';
      return d;
    });
    const p0 = { x: ds.length ? -(n - 1) / 2 * dx - w * 0.8 : 0, y: -(n - 1) / 2 * dy };
    const p1 = { x: (n - 1) / 2 * dx + w * 0.8, y: (n - 1) / 2 * dy };
    const entry = lamp(c.host, p0.x, p0.y, 11 * u, c.hue);
    const out = lamp(c.host, p1.x, p1.y, 11 * u, c.hue2);
    ds.forEach((d, i) => c.scope.on(d, 'toggle', () => {
      if (!d.open) return;
      c.hit((i - (n - 1) / 2) * dx, (i - (n - 1) / 2) * dy, 0.14, i);
      if (i < n - 1) R.s.after(110 - 50 * (i / n), () => { ds[i + 1].open = true; }); else R.s.after(260, () => poke(out));
    }));
    c.scope.on(entry, 'change', () => { if (entry.checked) ds[0].open = true; });
    return {
      entries: [entry], exit: { el: out, type: 'change' }, entryPts: [p0], exitPt: p1, budgetMs: n * 150 + 1000,
      reset() { R.reset(); entry.checked = false; out.checked = false; ds.forEach((d) => (d.open = false)); },
      flourish() { ds.forEach((d, i) => { R.s.after(i * 50, () => { d.open = true; R.s.after(900, () => { d.open = false; }, true); }, true); }); },
    };
  },
};
