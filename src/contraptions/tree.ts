import type { Contraption } from '../engine/types';
import { range, checkbox, setRange, lamp, emit, poke, Runner } from '../engine/kit';
import { ease } from '../engine/clock';

// Fractal tree: sliders grow like branches; each finished branch SPAWNS two new slider controls at its tip. Leaves blossom as checkboxes.
export const tree: Contraption = {
  kind: 'tree', tags: ['tall', 'big'], nominal: 4500, weight: 1.25,
  build(c) {
    const R = new Runner(c.scope);
    const { rng, u, r } = c;
    const maxD = r > 130 ? 6 : 5, L0 = r * 0.36;
    const base = { x: 0, y: r * 0.9 };
    let spawned: HTMLElement[] = [], leaves = 0, total = 1 << (maxD - 1);
    const entry = lamp(c.host, base.x - r * 0.45, base.y, 11 * u, c.hue);
    const out = lamp(c.host, base.x + r * 0.45, base.y, 11 * u, c.hue2);
    const grow = (x: number, y: number, ang: number, d: number) => {
      const len = L0 * Math.pow(0.74, d), hue = c.hue + (d / maxD) * (c.hue2 - c.hue + 60);
      const e = range(c.host, { x: x + Math.cos(ang) * len / 2, y: y + Math.sin(ang) * len / 2, w: len, h: 14, rot: ang, cls: 'arm', hue, value: 0, min: 0, max: 100 });
      spawned.push(e);
      const tx = x + Math.cos(ang) * len, ty = y + Math.sin(ang) * len;
      R.s.on(e, 'change', () => {
        c.hit(tx, ty, d === maxD - 1 ? 0.16 : 0.05, d * 2 + (leaves % 3));
        if (d < maxD - 1) {
          const sp = rng.range(0.32, 0.6);
          R.s.after(40, () => grow(tx, ty, ang - sp, d + 1)); R.s.after(70, () => grow(tx, ty, ang + sp * rng.range(0.8, 1.2), d + 1));
        } else {
          const b = checkbox(c.host, { x: tx, y: ty, w: Math.max(7 * u, r * 0.05), h: Math.max(7 * u, r * 0.05), cls: 'ball', hue: hue + 30 });
          spawned.push(b);
          R.s.on(b, 'change', () => { if (b.checked && ++leaves === total) R.s.after(300, () => poke(out)); });
          R.s.after(rng.range(20, 160), () => poke(b));
        }
      });
      R.s.tween(300 + 40 * (maxD - d), (t) => setRange(e, 100 * t, null), () => emit(e, 'change'), ease.out);
    };
    c.scope.on(entry, 'change', () => { if (entry.checked) grow(base.x, base.y, -Math.PI / 2, 0); });
    return {
      entries: [entry], exit: { el: out, type: 'change' }, entryPts: [{ x: base.x - r * 0.45, y: base.y }], exitPt: { x: base.x + r * 0.45, y: base.y }, budgetMs: 6000,
      reset() { R.reset(); spawned.forEach((e) => e.remove()); spawned = []; leaves = 0; entry.checked = false; out.checked = false; },
      flourish() { spawned.forEach((e, i) => R.s.after(i * 8, () => { e.classList.add('on'); R.s.after(500, () => e.classList.remove('on'), true); }, true)); },
    };
  },
};
