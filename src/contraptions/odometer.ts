import type { Contraption } from '../engine/types';
import { num, lamp, emit, poke, Runner } from '../engine/kit';

// Odometer: number inputs that carry into the next digit like a mechanical counter.
export const odometer: Contraption = {
  kind: 'odometer', tags: ['start', 'fast'], nominal: 3000, weight: 0.95,
  build(c) {
    const R = new Runner(c.scope);
    const { rng, u, r } = c;
    const n = r > 100 ? 6 : 5;
    const w = Math.min(r * 0.3, (r * 1.8) / n - 3), h = w * 1.6;
    const ds: HTMLInputElement[] = [], pos: { x: number; y: number }[] = [];
    const tilt = rng.range(-0.25, 0.25);
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * (w + 4);
      pos.push({ x, y: (i - (n - 1) / 2) * tilt * 8 });
      const d = num(c.host, { x, y: pos[i].y, w, h, value: rng.int(0, 9), hue: c.hue + i * 7 });
      d.style.fontSize = `${Math.round(h * 0.7)}px`;
      ds.push(d);
    }
    // digits[n-1] is the units digit. Start high in the number so carries are likely.
    ds.forEach((d, i) => { if (i >= 1 && i < n - 2) d.value = '9'; });
    const entry = lamp(c.host, pos[n - 1].x + w * 0.9 + 12 * u, pos[n - 1].y, 11 * u, c.hue);
    const out = lamp(c.host, pos[0].x - w * 0.9 - 12 * u, pos[0].y, 11 * u, c.hue2);
    let left = 0;
    const bump = (i: number) => {
      const d = ds[i];
      d.value = String((+d.value + 1) % 10);
      d.classList.add('on');
      R.s.after(220, () => d.classList.remove('on'), true);
      emit(d, 'input');
    };
    ds.forEach((d, i) => c.scope.on(d, 'input', () => {
      c.hit(pos[i].x, pos[i].y, i === n - 1 ? 0.03 : 0.2, +d.value);
      if (+d.value === 0 && i > 0) bump(i - 1);             // carry
      if (i === n - 1) {                                     // units digit drives the ticking
        if (left-- > 0) R.s.after(38, () => bump(n - 1));
        else R.s.after(240, () => poke(out));
      }
    }));
    c.scope.on(entry, 'change', () => { if (entry.checked) { left = rng.int(26, 62); bump(n - 1); } });
    return {
      entries: [entry], exit: { el: out, type: 'change' }, entryPts: [{ x: pos[n - 1].x + w * 0.9 + 12 * u, y: pos[n - 1].y }], exitPt: { x: pos[0].x - w * 0.9 - 12 * u, y: pos[0].y }, budgetMs: 3200,
      reset() { R.reset(); entry.checked = false; out.checked = false; left = 0; ds.forEach((d, i) => { d.value = i >= 1 && i < n - 2 ? '9' : String((i * 3 + c.rng.int(0, 9)) % 10); d.classList.remove('on'); }); },
      flourish() { ds.forEach((d, i) => R.s.after(i * 70, () => { d.classList.add('on'); R.s.after(500, () => d.classList.remove('on'), true); }, true)); },
    };
  },
};
