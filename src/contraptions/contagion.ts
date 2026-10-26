import type { Contraption } from '../engine/types';
import { button, lamp, poke, Runner } from '../engine/kit';

// Contagion: a hex grid of buttons; every click clicks its neighbours after a random delay — an organic flood fill.
export const contagion: Contraption = {
  kind: 'contagion', tags: ['fast', 'start'], nominal: 3500, weight: 1.1,
  build(c) {
    const R = new Runner(c.scope);
    const { rng, u, r } = c;
    const s = 17 * u * (r > 140 ? 1.1 : 1);
    const cells: { x: number; y: number; b: HTMLButtonElement; nb: number[] }[] = [];
    const rad = r * 0.86;
    const squash = rng.range(0.7, 1);
    for (let row = -12; row <= 12; row++) {
      for (let col = -12; col <= 12; col++) {
        const x = col * s + (row & 1 ? s / 2 : 0), y = row * s * 0.866 * squash;
        if (Math.hypot(x, y) > rad) continue;
        cells.push({ x, y, b: null as any, nb: [] });
      }
    }
    cells.forEach((cl, i) => {
      cl.b = button(c.host, { x: cl.x, y: cl.y, w: s * 0.62, h: s * 0.62, cls: 'leaf', hue: c.hue + (cl.x / rad) * 28 + (cl.y / rad) * 14, rot: rng.range(-0.3, 0.3) });
    });
    cells.forEach((a, i) => cells.forEach((b, j) => { if (i !== j && Math.hypot(a.x - b.x, a.y - b.y) < s * 1.05) a.nb.push(j); }));
    let seed = 0, far = 0;
    cells.forEach((cl, i) => { if (cl.x < cells[seed].x) seed = i; if (cl.x > cells[far].x) far = i; });
    const entry = lamp(c.host, cells[seed].x - s * 1.4, cells[seed].y, 11 * u, c.hue);
    const out = lamp(c.host, cells[far].x + s * 1.4, cells[far].y, 11 * u, c.hue2);
    let sched: boolean[] = [], clicked = 0;
    cells.forEach((cl, i) => {
      c.scope.on(cl.b, 'click', () => {
        cl.b.classList.add('on');
        R.s.after(rng.range(260, 520), () => cl.b.classList.remove('on'), true);
        clicked++;
        if (clicked % 4 === 1) c.hit(cl.x, cl.y, 0.09, clicked);
        for (const j of cl.nb) {
          if (sched[j]) continue;
          sched[j] = true;
          R.s.after(rng.range(40, 230), () => poke(cells[j].b));
        }
        if (clicked === cells.length) R.s.after(160, () => poke(out));
      });
    });
    c.scope.on(entry, 'change', () => { if (entry.checked) { sched[seed] = true; poke(cells[seed].b); } });
    return {
      entries: [entry], exit: { el: out, type: 'change' }, entryPts: [{ x: cells[seed].x - s * 1.4, y: cells[seed].y }], exitPt: { x: cells[far].x + s * 1.4, y: cells[far].y }, budgetMs: 3600,
      reset() { R.reset(); sched = []; clicked = 0; entry.checked = false; out.checked = false; cells.forEach((cl) => cl.b.classList.remove('on')); },
      flourish() { cells.forEach((cl, i) => { R.s.after((cl.x + rad) * 0.8, () => { cl.b.classList.add('on'); R.s.after(300, () => cl.b.classList.remove('on'), true); }, true); }); },
    };
  },
};
