import type { Contraption } from '../engine/types';
import { checkbox, lamp, poke, Runner } from '../engine/kit';

// Marble run: one lit checkbox falls down staggered columns with gravity, bounces at the bottom, and hops to the next column.
export const marble: Contraption = {
  kind: 'marble', tags: ['tall', 'fast'], nominal: 3800, weight: 1.1,
  build(c) {
    const R = new Runner(c.scope);
    const { rng, u, r } = c;
    const cols = rng.int(3, 5), k = Math.max(6, Math.min(12, Math.floor((r * 1.5) / (12 * u))));
    const sp = (r * 1.5) / k;
    const dx = (r * 1.55) / (cols - 0.4), dy = (r * 0.55) / cols;
    const grid: HTMLInputElement[][] = [], pos: { x: number; y: number }[][] = [];
    for (let j = 0; j < cols; j++) {
      grid.push([]); pos.push([]);
      for (let i = 0; i < k; i++) {
        const x = (j - (cols - 1) / 2) * dx + Math.sin(i * 0.4 + j) * 1.5, y = -r * 0.75 + j * dy + i * sp * 0.8 - ((cols - 1) * dy) / 2 + r * 0.2;
        pos[j].push({ x, y });
        grid[j].push(checkbox(c.host, { x, y, w: Math.max(9 * u, sp * 0.55), h: Math.max(9 * u, sp * 0.55), cls: 'ball keep', hue: c.hue + j * 14 + i * 2 }));
      }
    }
    // the marble's full route, as [col,row,delay]
    const seq: [number, number, number][] = [];
    for (let j = 0; j < cols; j++) {
      for (let i = 0; i < k; i++) seq.push([j, i, Math.max(26, 95 * Math.pow(0.86, i))]);
      for (const h of [3, 1]) { for (let i = k - 2; i >= k - 1 - h; i--) seq.push([j, i, 40 + (k - 2 - i) * 22]); for (let i = k - h; i < k; i++) seq.push([j, i, 60 - (k - i) * 6]); }
    }
    const entry = lamp(c.host, pos[0][0].x - 18 * u, pos[0][0].y - 8 * u, 11 * u, c.hue);
    const out = lamp(c.host, pos[cols - 1][k - 1].x + 18 * u, pos[cols - 1][k - 1].y, 11 * u, c.hue2);
    let at = -1;
    const go = () => {
      at++;
      if (at >= seq.length) { R.s.after(150, () => poke(out)); return; }
      const [j, i] = seq[at], e = grid[j][i];
      e.checked = false;
      poke(e);
    };
    grid.forEach((col, j) => col.forEach((e, i) => c.scope.on(e, 'change', () => {
      if (!e.checked || at < 0) return;
      c.hit(pos[j][i].x, pos[j][i].y, i === k - 1 ? 0.3 : 0.05, j * 3 + (i % 3));
      R.s.after(150, () => { e.checked = false; }, true);
      R.s.after(seq[at][2], go);
    })));
    c.scope.on(entry, 'change', () => { if (entry.checked) { at = -1; go(); } });
    return {
      entries: [entry], exit: { el: out, type: 'change' }, entryPts: [{ x: pos[0][0].x - 18 * u, y: pos[0][0].y - 8 * u }], exitPt: { x: pos[cols - 1][k - 1].x + 18 * u, y: pos[cols - 1][k - 1].y }, budgetMs: seq.length * 60 + 800,
      reset() { R.reset(); at = -1; entry.checked = false; out.checked = false; grid.forEach((col) => col.forEach((e) => (e.checked = false))); },
      flourish() { grid.forEach((col, j) => col.forEach((e, i) => R.s.after(j * 90 + i * 20, () => { e.classList.add('on'); R.s.after(300, () => e.classList.remove('on'), true); }, true))); },
    };
  },
};
