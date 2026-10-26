import type { Contraption } from '../engine/types';
import { checkbox, lamp, poke, Runner } from '../engine/kit';

// Conway's Game of Life on a checkbox disc, seeded by the cascade. Each generation is applied through real clicks;
// the last change event of a generation starts the next.
export const life: Contraption = {
  kind: 'life', tags: ['big'], nominal: 5200, weight: 1.15,
  build(c) {
    const R = new Runner(c.scope);
    const { rng, u, r } = c;
    const g = Math.max(9, Math.min(17, Math.floor((r * 1.7) / (11 * u))));
    const s = (r * 1.7) / g;
    const alive: boolean[] = new Array(g * g).fill(false);
    const els: (HTMLInputElement | null)[] = [];
    for (let y = 0; y < g; y++) for (let x = 0; x < g; x++) {
      const px = (x - (g - 1) / 2) * s, py = (y - (g - 1) / 2) * s;
      els.push(Math.hypot(px, py) > r * 0.9 ? null : checkbox(c.host, { x: px, y: py, w: s * 0.68, h: s * 0.68, hue: c.hue + (x / g) * 30, cls: 'keep' }));
    }
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= g || y >= g || !els[y * g + x] ? 0 : alive[y * g + x] ? 1 : 0);
    const entry = lamp(c.host, -r * 0.98, 0, 11 * u, c.hue);
    const out = lamp(c.host, r * 0.98, 0, 11 * u, c.hue2);
    let gen = 0, pending = 0, maxGen = 0;
    const apply = (changes: number[]) => {
      pending = changes.length;
      if (!pending) { next(); return; }
      changes.forEach((i, k) => R.s.after(k * 6, () => { alive[i] = !alive[i]; els[i]!.checked = !alive[i]; poke(els[i]); }));
    };
    const next = () => {
      if (gen >= maxGen) { R.s.after(250, () => poke(out)); return; }
      gen++;
      const ch: number[] = [];
      for (let y = 0; y < g; y++) for (let x = 0; x < g; x++) {
        const i = y * g + x; if (!els[i]) continue;
        let n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) n += at(x + dx, y + dy);
        const nv = alive[i] ? n === 2 || n === 3 : n === 3;
        if (nv !== alive[i]) ch.push(i);
      }
      if (ch.length === 0) { gen = maxGen; }
      apply(ch);
    };
    els.forEach((e, i) => { if (!e) return; c.scope.on(e, 'change', () => {
      if (--pending > 0) return;
      if (pending === 0) R.s.after(210, next);
      const px = (i % g - (g - 1) / 2) * s, py = (Math.floor(i / g) - (g - 1) / 2) * s;
      if (e.checked) c.hit(px, py, 0.05, i);
    }); });
    c.scope.on(entry, 'change', () => {
      if (!entry.checked) return;
      gen = 0; maxGen = rng.int(9, 15);
      const seedCells: number[] = [];
      els.forEach((e, i) => { if (e && rng.chance(0.38)) seedCells.push(i); });
      pending = seedCells.length;
      seedCells.forEach((i, k) => R.s.after(k * 7, () => { alive[i] = true; els[i]!.checked = false; poke(els[i]); }));
    });
    return {
      entries: [entry], exit: { el: out, type: 'change' }, entryPts: [{ x: -r * 0.98, y: 0 }], exitPt: { x: r * 0.98, y: 0 }, budgetMs: 5200,
      reset() { R.reset(); alive.fill(false); gen = 0; pending = 0; entry.checked = false; out.checked = false; els.forEach((e) => { if (e) e.checked = false; }); },
      flourish() { els.forEach((e, i) => { if (e) R.s.after((i % g) * 30, () => { e.classList.add('on'); R.s.after(300, () => e.classList.remove('on'), true); }, true); }); },
    };
  },
};
