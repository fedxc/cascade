import type { Contraption } from '../engine/types';
import { select, lamp, emit, poke, GLYPHS, Runner } from '../engine/kit';

// Flip-board: split-flap selects stepping through glyphs. A flap landing on its target starts the next one.
export const flip: Contraption = {
  kind: 'flip', tags: ['start'], nominal: 3800, weight: 1.0,
  build(c) {
    const R = new Runner(c.scope);
    const { rng, u, r } = c;
    const n = rng.int(5, 8), cols = n > 5 && r > 90 ? 2 : 1;
    const per = Math.ceil(n / cols);
    const w = Math.min(r * 0.34, (r * 1.7) / per - 4), h = w * 1.35;
    const set = rng.shuffle([...GLYPHS]).slice(0, 12);
    const flaps: HTMLSelectElement[] = [], pos: { x: number; y: number }[] = [];
    for (let i = 0; i < n; i++) {
      const col = Math.floor(i / per), k = i % per;
      const x = (k - (per - 1) / 2) * (w + 5) + (col ? w * 0.4 : 0), y = (col - (cols - 1) / 2) * (h + 12) + Math.sin(k) * 3;
      pos.push({ x, y });
      const f = select(c.host, { x, y, w, h, options: set, cls: 'flap', hue: c.hue + i * 9, rot: rng.range(-0.04, 0.04) });
      f.style.fontSize = `${Math.round(h * 0.6)}px`;
      f.selectedIndex = rng.int(0, set.length - 1);
      flaps.push(f);
    }
    const targets = flaps.map(() => 0);
    const entry = lamp(c.host, pos[0].x - w * 0.9 - 10 * u, pos[0].y, 11 * u, c.hue);
    const out = lamp(c.host, pos[n - 1].x + w * 0.9 + 10 * u, pos[n - 1].y, 11 * u, c.hue2);
    const step = (i: number) => {
      const f = flaps[i];
      f.selectedIndex = (f.selectedIndex + 1) % set.length;
      f.classList.add('on');
      emit(f, 'change');
    };
    const begin = (i: number) => {
      targets[i] = (flaps[i].selectedIndex + rng.int(4, set.length + 3)) % set.length;
      step(i);
    };
    flaps.forEach((f, i) => c.scope.on(f, 'change', () => {
      c.hit(pos[i].x, pos[i].y, 0.04, f.selectedIndex);
      if (f.selectedIndex !== targets[i]) R.s.after(40 + (i % 3) * 8, () => step(i));
      else {
        R.s.after(200, () => f.classList.remove('on'));
        if (i < n - 1) R.s.after(90, () => begin(i + 1)); else R.s.after(200, () => poke(out));
      }
    }));
    c.scope.on(entry, 'change', () => { if (entry.checked) begin(0); });
    return {
      entries: [entry], exit: { el: out, type: 'change' }, entryPts: [{ x: pos[0].x - w * 0.9 - 10 * u, y: pos[0].y }], exitPt: { x: pos[n - 1].x + w * 0.9 + 10 * u, y: pos[n - 1].y }, budgetMs: n * 800 + 800,
      reset() { R.reset(); entry.checked = false; out.checked = false; flaps.forEach((f) => f.classList.remove('on')); },
      flourish() { flaps.forEach((f, i) => R.s.after(i * 60, () => { f.classList.add('on'); R.s.after(500, () => f.classList.remove('on'), true); }, true)); },
    };
  },
};
