import type { Contraption } from '../engine/types';
import { range, setRange, emit, lamp, poke, Runner } from '../engine/kit';

// Sorter: vertical sliders that bubble-sort themselves. Every swap ends in a real `change` event that triggers the next step.
export const sorter: Contraption = {
  kind: 'sorter', tags: ['tall'], nominal: 4200, weight: 1.1,
  build(c) {
    const R = new Runner(c.scope);
    const { rng, u, r } = c;
    const n = Math.max(14, Math.min(30, Math.floor((r * 1.9) / (9 * u))));
    const sp = (r * 1.9) / n, hgt = r * 1.25;
    const bars = Array.from({ length: n }, (_, i) => range(c.host, { x: (i - (n - 1) / 2) * sp, y: 0, w: hgt, h: 14, rot: -Math.PI / 2, cls: 'fat', hue: c.hue, value: 0, min: 0, max: 100 }));
    const vals: number[] = [];
    const paint = () => bars.forEach((b, i) => { b.style.setProperty('--h', (c.hue + (vals[i] / 100) * (c.hue2 - c.hue + 80)).toFixed(0)); setRange(b, vals[i], null); });
    const shuffle = () => {
      vals.length = 0; for (let i = 0; i < n; i++) vals.push(8 + (i / (n - 1)) * 90);
      for (let k = 0; k < rng.int(6, 10); k++) { const i = rng.int(0, n - 2), j = Math.min(n - 1, i + rng.int(1, 4)); [vals[i], vals[j]] = [vals[j], vals[i]]; }
      paint();
    };
    shuffle();
    const entry = lamp(c.host, -r * 0.98, hgt / 2, 11 * u, c.hue);
    const out = lamp(c.host, r * 0.98, hgt / 2, 11 * u, c.hue2);
    let pos = 0, swapped = false, sorting = false, sweep = -1;
    const step = () => {
      for (; pos < n - 1; pos++) {
        if (vals[pos] > vals[pos + 1]) { swap(pos); pos++; return; }
      }
      if (swapped) { pos = 0; swapped = false; step(); return; }
      sorting = false; sweep = 0; emit(bars[0], 'input');
    };
    const swap = (i: number) => {
      swapped = true;
      const a = vals[i], b = vals[i + 1];
      R.s.tween(120, (t) => { setRange(bars[i], a + (b - a) * t, null); setRange(bars[i + 1], b + (a - b) * t, null); }, () => {
        vals[i] = b; vals[i + 1] = a; paint();
        bars[i].classList.add('on'); bars[i + 1].classList.add('on');
        R.s.after(180, () => { bars[i].classList.remove('on'); bars[i + 1].classList.remove('on'); }, true);
        emit(bars[i + 1], 'change');
      });
    };
    bars.forEach((b, i) => {
      c.scope.on(b, 'change', () => { if (sorting) { c.hit((i - (n - 1) / 2) * sp, 0, 0.1, i); R.s.after(30, step); } });
      c.scope.on(b, 'input', () => {   // victory sweep
        if (sweep !== i) return;
        b.classList.add('on'); R.s.after(500, () => b.classList.remove('on'), true);
        c.hit((i - (n - 1) / 2) * sp, 0, 0.12, i);
        if (i < n - 1) { sweep = i + 1; R.s.after(26, () => emit(bars[i + 1], 'input')); } else R.s.after(200, () => poke(out));
      });
    });
    c.scope.on(entry, 'change', () => { if (entry.checked) { sorting = true; pos = 0; swapped = false; step(); } });
    return {
      entries: [entry], exit: { el: out, type: 'change' }, entryPts: [{ x: -r * 0.98, y: hgt / 2 }], exitPt: { x: r * 0.98, y: hgt / 2 }, budgetMs: 5000,
      reset() { R.reset(); entry.checked = false; out.checked = false; sorting = false; sweep = -1; shuffle(); bars.forEach((b) => b.classList.remove('on')); },
      flourish() { bars.forEach((b, i) => R.s.after(i * 22, () => { b.classList.add('on'); R.s.after(500, () => b.classList.remove('on'), true); }, true)); },
    };
  },
};
