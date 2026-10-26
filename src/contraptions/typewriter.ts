import type { Contraption } from '../engine/types';
import { textarea, button, lamp, emit, poke, focusEvent, WORDS, Runner } from '../engine/kit';

// Typewriter: textareas type themselves; finishing a line hits a carriage-return button whose click focuses the next one.
export const typewriter: Contraption = {
  kind: 'typewriter', tags: ['start'], nominal: 4200, weight: 1.15,
  build(c) {
    const R = new Runner(c.scope);
    const { rng, u, r } = c;
    const n = rng.int(4, 7);
    const cols = rng.int(9, 13);
    const fs = Math.max(8 * u, r * 0.085), w = Math.min(r * 1.6, cols * fs * 0.62 + 12), h = fs * 1.8;
    const gap = Math.min(h + 12 * u, (r * 1.5) / n);
    const lines: string[] = Array.from({ length: n }, () => { let s = ''; while (s.length < cols - 6) s += rng.pick(WORDS) + ' '; return s.trimEnd().slice(0, cols); });
    const tas = lines.map((_, i) => {
      const t = textarea(c.host, { x: (i % 2 ? 6 : -6) * u, y: (i - (n - 1) / 2) * gap, w, h, rows: 1, cols, hue: c.hue + i * 10 });
      t.style.fontSize = Math.round(fs) + 'px'; t.style.lineHeight = h - 4 + 'px'; t.style.whiteSpace = 'nowrap';
      return t;
    });
    const crs = tas.map((_, i) => button(c.host, { x: (i % 2 ? 6 : -6) * u + w / 2 + 10 * u, y: (i - (n - 1) / 2) * gap, w: 12 * u, h: 12 * u, cls: 'sq', hue: c.hue + i * 10, text: '' }));
    const entry = lamp(c.host, tas[0].offsetLeft ? 0 : -w / 2 - 20 * u - 6 * u, -(n - 1) / 2 * gap, 11 * u, c.hue);
    const out = lamp(c.host, w / 2 + 28 * u, (n - 1) / 2 * gap, 11 * u, c.hue2);
    const type = (i: number) => {
      const t = tas[i]; let k = 0;
      t.classList.add('on');
      const tick = () => {
        t.value = lines[i].slice(0, ++k);
        emit(t, 'input');
        if (k % 3 === 0) c.hit(0, (i - (n - 1) / 2) * gap, 0.04, k);
        if (k < lines[i].length) R.s.after(rng.range(28, 70), tick);
        else R.s.after(140, () => poke(crs[i]));
      };
      tick();
    };
    tas.forEach((t, i) => c.scope.on(t, 'focus', () => { if (t.value === '') type(i); }));
    crs.forEach((b, i) => c.scope.on(b, 'click', () => {
      b.classList.add('on'); R.s.after(300, () => b.classList.remove('on'), true);
      c.hit(w / 2, (i - (n - 1) / 2) * gap, 0.2, 2);
      tas[i].classList.remove('on');
      if (i < n - 1) focusEvent(tas[i + 1]); else R.s.after(200, () => poke(out));
    }));
    c.scope.on(entry, 'change', () => { if (entry.checked) focusEvent(tas[0]); });
    return {
      entries: [entry], exit: { el: out, type: 'change' }, entryPts: [{ x: -w / 2 - 26 * u, y: -(n - 1) / 2 * gap }], exitPt: { x: w / 2 + 28 * u, y: (n - 1) / 2 * gap }, budgetMs: n * 900 + 1000,
      reset() { R.reset(); entry.checked = false; out.checked = false; tas.forEach((t) => { t.value = ''; t.classList.remove('on'); t.blur(); }); },
      flourish() { tas.forEach((t, i) => { R.s.after(i * 80, () => { t.classList.add('on'); R.s.after(600, () => t.classList.remove('on'), true); }, true); }); },
    };
  },
};
