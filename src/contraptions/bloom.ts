import type { Contraption } from '../engine/types';
import { colorIn, lamp, emit, poke, Runner } from '../engine/kit';
import { hex } from '../engine/color';

// Bloom: colour pickers on a phyllotaxis spiral open one after another like a flower. (A picker cannot be
// clicked without opening its popup, so each petal's value is set and a real `input` event emitted.)
export const bloom: Contraption = {
  kind: 'bloom', tags: ['slow'], nominal: 3600, weight: 1.1,
  build(c) {
    const R = new Runner(c.scope);
    const { rng, u, r } = c;
    const n = rng.int(26, 42);
    const sp = (r * 0.9) / Math.sqrt(n);
    const GA = 2.399963 + rng.range(-0.02, 0.02);
    const petals = Array.from({ length: n }, (_, i) => {
      const rad = sp * Math.sqrt(i + 0.5), a = i * GA;
      const s = Math.max(9 * u, sp * (0.62 + 0.45 * (i / n)));
      return { x: Math.cos(a) * rad, y: Math.sin(a) * rad, e: colorIn(c.host, { x: Math.cos(a) * rad, y: Math.sin(a) * rad, w: s, h: s, hue: c.hue, value: hex(c.hue, 30, 14) }) };
    });
    const entry = lamp(c.host, petals[0].x - sp * 1.8, petals[0].y, 11 * u, c.hue);
    const out = lamp(c.host, petals[n - 1].x + sp * 1.6, petals[n - 1].y, 11 * u, c.hue2);
    const open = (i: number) => {
      const p = petals[i];
      p.e.value = hex(c.hue + (i / n) * 140 + (c.hue2 - c.hue) * 0.3, 90, 62);
      p.e.classList.add('on');
      emit(p.e, 'input');
    };
    petals.forEach((p, i) => c.scope.on(p.e, 'input', () => {
      c.hit(p.x, p.y, 0.05 + 0.1 * (i % 5 === 0 ? 1 : 0), i);
      if (i < n - 1) R.s.after(60 + 60 * (1 - i / n), () => open(i + 1)); else R.s.after(300, () => poke(out));
    }));
    c.scope.on(entry, 'change', () => { if (entry.checked) open(0); });
    return {
      entries: [entry], exit: { el: out, type: 'change' }, entryPts: [{ x: petals[0].x - sp * 1.8, y: petals[0].y }], exitPt: { x: petals[n - 1].x + sp * 1.6, y: petals[n - 1].y }, budgetMs: n * 110 + 1200,
      reset() { R.reset(); entry.checked = false; out.checked = false; petals.forEach((p) => { p.e.value = hex(c.hue, 30, 14); p.e.classList.remove('on'); }); },
      flourish() { petals.forEach((p, i) => R.s.after(i * 20, () => { p.e.value = hex(c.hue + i * 12, 95, 65); p.e.classList.add('on'); }, true)); },
    };
  },
};
