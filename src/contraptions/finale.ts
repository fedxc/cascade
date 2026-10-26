import type { Contraption } from '../engine/types';
import { checkbox, button, group, poke, mv, Runner } from '../engine/kit';
import { TAU } from '../engine/geometry';

// FINALE: concentric rings of checkboxes close in toward a detonator; its click fires the screen-wide boom.
export const finale: Contraption = {
  kind: 'finale', role: 'finale', nominal: 7000, weight: 1.6,
  build(c) {
    const R = new Runner(c.scope);
    const { u, r } = c;
    const radii = [0.9, 0.66, 0.43].map((k) => k * r);
    const counts = radii.map((rad) => Math.max(10, Math.round((TAU * rad) / (11 * u))));
    const rings = radii.map((rad, k) => Array.from({ length: counts[k] }, (_, i) => {
      const a = (i / counts[k]) * TAU * (k % 2 ? -1 : 1) - Math.PI / 2;
      return checkbox(c.host, { x: Math.cos(a) * rad, y: Math.sin(a) * rad, w: (7 - k) * u, h: (7 - k) * u, rot: a, hue: c.hue + k * 26 + (i / counts[k]) * 30 });
    }));
    const det = button(c.host, { x: 0, y: 0, w: 26 * u, h: 26 * u, cls: 'ro', hue: c.hue });
    const ash = checkbox(c.host, { x: 0, y: 0, w: 4, h: 4, hue: c.hue });
    ash.style.opacity = '0';
    const g = group(c.host, { x: 0, y: 0 });
    void g;
    rings.forEach((ring, k) => {
      ring.forEach((e, i) => {
        c.scope.on(e, 'change', () => {
          if (!e.checked) return;
          if (i % 3 === 0) c.hit(Math.cos((i / ring.length) * TAU * (k % 2 ? -1 : 1) - Math.PI / 2) * radii[k], Math.sin((i / ring.length) * TAU * (k % 2 ? -1 : 1) - Math.PI / 2) * radii[k], 0.12 + k * 0.05, i + k * 3);
          const next = ring[i + 1];
          if (next) R.s.after(Math.max(14, 54 - k * 12 - i * 0.8), () => poke(next));
          else if (rings[k + 1]) R.s.after(120, () => poke(rings[k + 1][0]));
          else R.s.after(500 + 200, () => poke(det));
        });
      });
    });
    c.scope.on(det, 'click', () => {
      det.classList.add('on');
      c.fx.boom(c.world.cx, c.world.cy, c.hue);
      rings.forEach((ring, k) => ring.forEach((e, i) => R.s.after(60 + k * 140 + i * 4, () => { mv(e, undefined, undefined, undefined, 1.9); e.classList.add('on'); }, true)));
      R.s.after(4300, () => poke(ash), true);
    });
    return {
      entries: [rings[0][0]], exit: { el: ash, type: 'change' }, entryPts: [{ x: radii[0], y: 0 }], exitPt: { x: 0, y: 0 }, budgetMs: 9000,
      reset() {
        R.reset();
        rings.forEach((ring) => ring.forEach((e) => { e.checked = false; e.classList.remove('on'); mv(e, undefined, undefined, undefined, 1); }));
        ash.checked = false; det.classList.remove('on');
      },
    };
  },
};
