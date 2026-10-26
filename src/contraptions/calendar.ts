import type { Contraption } from '../engine/types';
import { dateIn, lamp, emit, poke, mv, Runner } from '../engine/kit';
import { ease } from '../engine/clock';

// Calendar: a stack of date inputs. The top one flicks through days, then is torn away to reveal the next.
export const calendar: Contraption = {
  kind: 'calendar', tags: ['start'], nominal: 4300, weight: 1.0,
  build(c) {
    const R = new Runner(c.scope);
    const { rng, u, r } = c;
    const n = 4, w = r * 1.35, h = r * 0.34;
    const pages = Array.from({ length: n }, (_, i) => {
      const d = dateIn(c.host, 'date', { x: (n - 1 - i) * 3, y: (i - (n - 1) / 2) * 4 - (n - 1 - i) * 3, w, h, hue: c.hue + i * 12, z: n - i });
      d.style.fontSize = Math.round(h * 0.52) + 'px';
      d.value = `20${rng.int(26, 39)}-${String(rng.int(1, 12)).padStart(2, '0')}-${String(rng.int(1, 28)).padStart(2, '0')}`;
      return d;
    });
    const home = pages.map((_, i) => ({ x: (n - 1 - i) * 3, y: (i - (n - 1) / 2) * 4 - (n - 1 - i) * 3 }));
    const entry = lamp(c.host, -w / 2 - 14 * u, 0, 11 * u, c.hue);
    const out = lamp(c.host, w / 2 + 14 * u, 0, 11 * u, c.hue2);
    let cur = 0, left = 0;
    const flick = () => { const p = pages[cur]; p.stepUp(); p.classList.add('on'); emit(p, 'input'); };
    pages.forEach((p, i) => {
      c.scope.on(p, 'input', () => {
        if (i !== cur) return;
        c.hit(0, home[i].y, 0.05, left);
        if (left-- > 0) R.s.after(44, flick);
        else {
          R.s.after(120, () => R.s.tween(520, (t) => { mv(p, home[i].x + t * w * 0.9, home[i].y - t * h * 1.4, t * -0.9 * (i % 2 ? -1 : 1), 1 - t * 0.2); p.style.opacity = String(1 - t); }, () => { emit(p, 'change'); }, ease.in));
        }
      });
      c.scope.on(p, 'change', () => {
        if (i !== cur) return;
        c.hit(w / 2, home[i].y, 0.35, 2);
        cur++;
        if (cur < n) { left = rng.int(9, 17); R.s.after(120, flick); } else R.s.after(150, () => poke(out));
      });
    });
    c.scope.on(entry, 'change', () => { if (entry.checked) { cur = 0; left = rng.int(9, 17); flick(); } });
    return {
      entries: [entry], exit: { el: out, type: 'change' }, entryPts: [{ x: -w / 2 - 14 * u, y: 0 }], exitPt: { x: w / 2 + 14 * u, y: 0 }, budgetMs: n * 1200 + 1000,
      reset() { R.reset(); cur = 0; entry.checked = false; out.checked = false; pages.forEach((p, i) => { mv(p, home[i].x, home[i].y, 0, 1); p.style.opacity = '1'; p.classList.remove('on'); }); },
      flourish() { pages.forEach((p, i) => R.s.after(i * 90, () => { p.classList.add('on'); R.s.after(500, () => p.classList.remove('on'), true); }, true)); },
    };
  },
};
