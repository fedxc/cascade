import type { Contraption } from '../engine/types';
import { radio, lamp, poke, Runner } from '../engine/kit';
import { TAU } from '../engine/geometry';

// Roulette: a ring of radios. The single selected one circles faster and faster, then decelerates and lands.
let uid = 0;
export const roulette: Contraption = {
  kind: 'roulette', tags: ['start', 'slow'], nominal: 4200, weight: 1.0,
  build(c) {
    const R = new Runner(c.scope);
    const { rng, u, r } = c;
    const N = 28, name = 'rl' + uid++, ro = r * 0.85;
    const a = (i: number) => (i / N) * TAU - Math.PI / 2;
    const slots = Array.from({ length: N }, (_, i) => radio(c.host, { x: Math.cos(a(i)) * ro, y: Math.sin(a(i)) * ro, w: Math.max(10 * u, r * 0.085), h: Math.max(10 * u, r * 0.085), name, hue: c.hue + (i % 2 ? 0 : 150) * 0.2 + i * 3 }));
    const inner = Array.from({ length: 7 }, (_, i) => radio(c.host, { x: Math.cos((i / 7) * TAU) * ro * 0.45, y: Math.sin((i / 7) * TAU) * ro * 0.45, w: Math.max(7 * u, r * 0.05), h: Math.max(7 * u, r * 0.05), name: name + 'i', hue: c.hue2 }));
    const entry = lamp(c.host, -r * 1.02, 0, 11 * u, c.hue);
    const out = lamp(c.host, r * 1.02, 0, 11 * u, c.hue2);
    let k = 0, S = 0, pos = 0;
    slots.forEach((s, i) => c.scope.on(s, 'change', () => {
      if (!s.checked) return;
      c.hit(Math.cos(a(i)) * ro, Math.sin(a(i)) * ro, 0.08 + (k > S - 6 ? 0.2 : 0), i);
      if (k % 4 === 0) poke(inner[(k >> 2) % 7]);
      k++;
      if (k <= S) { pos = (pos + 1) % N; R.s.after(12 * Math.pow(1.065, k), () => poke(slots[pos])); }
      else R.s.after(420, () => poke(out));
    }));
    c.scope.on(entry, 'change', () => { if (entry.checked) { k = 0; S = rng.int(40, 54); pos = rng.int(0, N - 1); poke(slots[pos]); } });
    return {
      entries: [entry], exit: { el: out, type: 'change' }, entryPts: [{ x: -r * 1.02, y: 0 }], exitPt: { x: r * 1.02, y: 0 }, budgetMs: 4200,
      reset() { R.reset(); k = 0; entry.checked = false; out.checked = false; slots.forEach((s) => (s.checked = false)); inner.forEach((s) => (s.checked = false)); },
      flourish() { slots.forEach((s, i) => R.s.after(i * 14, () => { s.classList.add('on'); R.s.after(300, () => s.classList.remove('on'), true); }, true)); },
    };
  },
};
