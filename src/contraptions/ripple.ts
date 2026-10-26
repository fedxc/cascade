import type { Contraption } from '../engine/types';
import { checkbox, lamp, poke, Runner } from '../engine/kit';
import { TAU } from '../engine/geometry';

// Ripple tank: two wave sources on concentric rings of checkboxes. Wave A crosses the tank; when it reaches the centre it
// triggers wave B. Cells hit by both waves flare (interference).
export const ripple: Contraption = {
  kind: 'ripple', tags: ['big'], nominal: 4200, weight: 1.2,
  build(c) {
    const R = new Runner(c.scope);
    const { rng, u, r } = c;
    const rings = Math.max(4, Math.min(8, Math.floor((r * 0.9) / (13 * u))));
    const sp = (r * 0.92) / rings;
    const cells: { x: number; y: number; e: HTMLInputElement; nb: number[]; hit: [number, number]; ring: number }[] = [];
    cells.push({ x: 0, y: 0, e: null as any, nb: [], hit: [0, 0], ring: 0 });
    for (let k = 1; k <= rings; k++) {
      const m = 6 * k, off = rng.range(0, TAU);
      for (let i = 0; i < m; i++) { const a = off * (k % 2) + (i / m) * TAU; cells.push({ x: Math.cos(a) * sp * k, y: Math.sin(a) * sp * k, e: null as any, nb: [], hit: [0, 0], ring: k }); }
    }
    cells.forEach((cl) => { cl.e = checkbox(c.host, { x: cl.x, y: cl.y, w: Math.max(5, sp * 0.5), h: Math.max(5, sp * 0.5), cls: 'rnd', hue: c.hue + cl.ring * 9 }); });
    cells.forEach((a, i) => cells.forEach((b, j) => { if (i !== j && Math.hypot(a.x - b.x, a.y - b.y) < sp * 1.2) a.nb.push(j); }));
    let left = 0, right = 0;
    cells.forEach((cl, i) => { if (cl.x < cells[left].x) left = i; if (cl.x > cells[right].x) right = i; });
    const entry = lamp(c.host, cells[left].x - sp * 1.3, cells[left].y, 11 * u, c.hue);
    const out = lamp(c.host, cells[right].x + sp * 1.3, cells[right].y, 11 * u, c.hue2);
    let wave = new Map<HTMLInputElement, number>();
    let seen: [Set<number>, Set<number>] = [new Set(), new Set()], bStarted = false;
    const fire = (i: number, w: number) => { cells[i].e.checked = false; wave.set(cells[i].e, w); poke(cells[i].e); };
    cells.forEach((cl, i) => c.scope.on(cl.e, 'change', () => {
      if (!cl.e.checked) return;
      const w = wave.get(cl.e) ?? 0;
      cl.hit[w]++;
      const dbl = cl.hit[0] && cl.hit[1];
      if (dbl) { cl.e.classList.add('on'); R.s.after(500, () => cl.e.classList.remove('on'), true); }
      if (i % 3 === 0 || dbl) c.hit(cl.x, cl.y, dbl ? 0.4 : 0.06, cl.ring + w * 3);
      R.s.after(dbl ? 520 : 300, () => { cl.e.checked = false; }, true);
      for (const j of cl.nb) if (!seen[w].has(j)) { seen[w].add(j); R.s.after(sp * 2.6 + rng.range(0, 14), () => fire(j, w)); }
      if (w === 0 && i === 0 && !bStarted) { bStarted = true; seen[1].add(0); R.s.after(60, () => fire(cells.length - 1 - rng.int(0, 5), 1)); }
      if (w === 0 && i === right) R.s.after(300, () => poke(out));
    }));
    c.scope.on(entry, 'change', () => { if (entry.checked) { seen[0].add(left); fire(left, 0); } });
    return {
      entries: [entry], exit: { el: out, type: 'change' }, entryPts: [{ x: cells[left].x - sp * 1.3, y: cells[left].y }], exitPt: { x: cells[right].x + sp * 1.3, y: cells[right].y }, budgetMs: 4800,
      reset() { R.reset(); wave = new Map(); seen = [new Set(), new Set()]; bStarted = false; entry.checked = false; out.checked = false; cells.forEach((cl) => { cl.e.checked = false; cl.hit = [0, 0]; cl.e.classList.remove('on'); }); },
      flourish() { cells.forEach((cl) => R.s.after(cl.ring * 70, () => { cl.e.classList.add('on'); R.s.after(400, () => cl.e.classList.remove('on'), true); }, true)); },
    };
  },
};
