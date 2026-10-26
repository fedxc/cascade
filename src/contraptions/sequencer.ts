import type { Contraption } from '../engine/types';
import { checkbox, radio, lamp, mv, poke, Runner } from '../engine/kit';
import { TAU } from '../engine/geometry';

// Drum machine: a circular step sequencer. A radio playhead sweeps the steps; each checked cell in the column plays.
let uid = 0;
export const sequencer: Contraption = {
  kind: 'sequencer', tags: ['big', 'fast'], nominal: 5000, weight: 1.25,
  build(c) {
    const R = new Runner(c.scope);
    const { rng, u, r } = c;
    const steps = 16, rows = 4, name = 'ph' + uid++;
    const ro = (k: number) => r * (0.36 + 0.14 * k);
    const cells: HTMLInputElement[][] = [];
    const ang = (s: number) => (s / steps) * TAU - Math.PI / 2;
    for (let k = 0; k < rows; k++) {
      cells.push([]);
      for (let s = 0; s < steps; s++) cells[k].push(checkbox(c.host, { x: Math.cos(ang(s)) * ro(k), y: Math.sin(ang(s)) * ro(k), w: Math.max(6 * u, r * 0.055), h: Math.max(6 * u, r * 0.055), rot: ang(s), cls: 'dom keep', hue: c.hue + k * 28 }));
    }
    const pattern = () => cells.forEach((row, k) => row.forEach((e, s) => { e.checked = k === 0 ? s % 4 === 0 : k === 1 ? s % 8 === 4 : rng.chance(k === 2 ? 0.35 : 0.2); }));
    pattern();
    const head = Array.from({ length: steps }, (_, s) => radio(c.host, { x: Math.cos(ang(s)) * r * 0.96, y: Math.sin(ang(s)) * r * 0.96, w: Math.max(8 * u, r * 0.07), h: Math.max(8 * u, r * 0.07), name, hue: c.hue2 }));
    const entry = lamp(c.host, 0, -r * 1.02 - 8 * u, 11 * u, c.hue);
    const out = lamp(c.host, 0, r * 1.02 + 8 * u, 11 * u, c.hue2);
    let loops = 0;
    head.forEach((h, s) => c.scope.on(h, 'change', () => {
      if (!h.checked) return;
      cells.forEach((row, k) => { const e = row[s]; if (e.checked) {
        const x = Math.cos(ang(s)) * ro(k), y = Math.sin(ang(s)) * ro(k);
        mv(e, undefined, undefined, undefined, 2); R.s.after(130, () => mv(e, undefined, undefined, undefined, 1), true);
        c.hit(x, y, 0.1 + 0.04 * k, 4 - k * 2 + (s % 3)); } });
      if (s < steps - 1) R.s.after(82, () => poke(head[s + 1]));
      else if (++loops < 2) R.s.after(82, () => { head.forEach((x) => (x.checked = false)); poke(head[0]); });
      else R.s.after(260, () => poke(out));
    }));
    c.scope.on(entry, 'change', () => { if (entry.checked) poke(head[0]); });
    return {
      entries: [entry], exit: { el: out, type: 'change' }, entryPts: [{ x: 0, y: -r * 1.02 - 8 * u }], exitPt: { x: 0, y: r * 1.02 + 8 * u }, budgetMs: 3600,
      reset() { R.reset(); loops = 0; entry.checked = false; out.checked = false; head.forEach((h) => (h.checked = false)); pattern(); },
      flourish() { cells.forEach((row) => row.forEach((e, s) => R.s.after(s * 25, () => { mv(e, undefined, undefined, undefined, 1.8); R.s.after(300, () => mv(e, undefined, undefined, undefined, 1), true); }, true))); },
    };
  },
};
