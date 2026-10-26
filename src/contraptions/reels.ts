import type { Contraption } from '../engine/types';
import { select, lamp, emit, poke, GLYPHS, Runner } from '../engine/kit';
import { ease } from '../engine/clock';

// Slot reels: listbox selects spun by scrolling (native `scroll` events fire). Each reel's stop (a `change`) lets the next one brake.
export const reels: Contraption = {
  kind: 'reels', tags: ['fast'], nominal: 4200, weight: 1.0,
  build(c) {
    const R = new Runner(c.scope);
    const { rng, u, r } = c;
    const n = rng.int(3, 5), L = 9;
    const w = Math.min(r * 0.38, (r * 1.7) / n - 4), h = w * 2.1;
    const syms = rng.shuffle([...GLYPHS]).slice(0, L);
    const opts = [...syms, ...syms, ...syms];
    const sels = Array.from({ length: n }, (_, i) => {
      const s = select(c.host, { x: (i - (n - 1) / 2) * (w + 6), y: 0, w, h, options: opts, size: 3, cls: 'flap', hue: c.hue + i * 22 });
      s.style.fontSize = Math.round(w * 0.5) + 'px'; s.style.lineHeight = h / 3 + 'px'; s.style.textAlign = 'center';
      return s;
    });
    const entry = lamp(c.host, -r * 1.0, 0, 11 * u, c.hue);
    const out = lamp(c.host, r * 1.0, 0, 11 * u, c.hue2);
    const rowH = h / 3, cyc = L * rowH;
    let spinH: ({ cancelled: boolean } | null)[] = [], which = 0;
    const spin = (i: number) => {
      const t0 = sels[i].scrollTop;
      spinH[i] = R.s.tween(120000, (t) => { sels[i].scrollTop = (t0 + t * 120000 * 0.9 * (1 + i * 0.07)) % cyc; }, undefined, undefined, true);
    };
    const brake = (i: number) => {
      const h0 = spinH[i]; if (h0) R.s.cancel(h0 as any);
      const target = rng.int(0, L - 1), cur = sels[i].scrollTop % cyc;
      const finalTop = (L + target - 1) * rowH;
      const delta = ((finalTop % cyc) - cur + cyc) % cyc + cyc;
      R.s.tween(700 + i * 120, (t) => { sels[i].scrollTop = cur + delta * t; }, () => {
        sels[i].selectedIndex = L + target; sels[i].classList.add('on'); sels[i].scrollTop = finalTop;
        emit(sels[i], 'change');
      }, ease.out);
    };
    let sc = 0;
    sels.forEach((s, i) => {
      c.scope.on(s, 'scroll', () => { if (++sc % 9 === 0) c.hit((i - (n - 1) / 2) * (w + 6), 0, 0.03, sc); });
      c.scope.on(s, 'change', () => {
        c.hit((i - (n - 1) / 2) * (w + 6), 0, 0.3, i * 2);
        if (i < n - 1) R.s.after(160, () => brake(i + 1)); else R.s.after(300, () => poke(out));
      });
    });
    c.scope.on(entry, 'change', () => { if (entry.checked) { sels.forEach((_, i) => spin(i)); R.s.after(700, () => brake(0)); } });
    void which;
    return {
      entries: [entry], exit: { el: out, type: 'change' }, entryPts: [{ x: -r * 1.0, y: 0 }], exitPt: { x: r * 1.0, y: 0 }, budgetMs: n * 1000 + 2000,
      reset() { R.reset(); spinH = []; entry.checked = false; out.checked = false; sels.forEach((s) => { s.classList.remove('on'); s.scrollTop = 0; }); },
      flourish() { sels.forEach((s, i) => R.s.after(i * 70, () => { s.classList.add('on'); R.s.after(500, () => s.classList.remove('on'), true); }, true)); },
    };
  },
};
