import type { Contraption } from '../engine/types';
import { range, setRange, lamp, emit, group, Runner } from '../engine/kit';
import { ease } from '../engine/clock';

// Peacock fan: sliders radiating from a pivot. Each passing halfway kicks the next; the last reaching the end is the exit.
export const fan: Contraption = {
  kind: 'fan', tags: ['fast'], nominal: 4000, weight: 1.2,
  build(c) {
    const R = new Runner(c.scope);
    const { rng, u, r } = c;
    const n = rng.int(11, 19);
    const span = rng.range(2.3, 3.5), mid = rng.range(0, Math.PI * 2);
    const px = -r * 0.45 * Math.cos(mid), py = -r * 0.45 * Math.sin(mid);
    const sl: HTMLInputElement[] = [], ang: number[] = [], len: number[] = [];
    for (let i = 0; i < n; i++) {
      const a = mid - span / 2 + (i / (n - 1)) * span;
      const L = r * (0.95 + 0.25 * Math.sin((i / (n - 1)) * Math.PI)) * 0.98;
      ang.push(a); len.push(L);
      sl.push(range(c.host, {
        x: px + Math.cos(a) * (L / 2 + 6 * u), y: py + Math.sin(a) * (L / 2 + 6 * u), w: L, h: 14, rot: a, hue: c.hue + (i / (n - 1)) * (c.hue2 - c.hue), value: 0, min: 0, max: 100,
      }));
    }
    const hub = lamp(c.host, px, py, 13 * u, c.hue);
    const start = (i: number) => {
      const e = sl[i]; let kicked = false;
      R.s.tween(430 + rng.range(0, 90), (t) => {
        setRange(e, 100 * t, null);
        if (!kicked && t > 0.5) { kicked = true; emit(e, 'input'); }
      }, () => {
        emit(e, 'change');
        c.hit(px + Math.cos(ang[i]) * (len[i] + 6 * u), py + Math.sin(ang[i]) * (len[i] + 6 * u), 0.18, i);
        R.s.tween(1100, (t) => setRange(e, 100 * (1 - ease.cubicOut(t)), null));
      }, ease.out);
    };
    sl.forEach((e, i) => c.scope.on(e, 'input', () => { if (i < n - 1) start(i + 1); }));
    c.scope.on(hub, 'change', () => { if (hub.checked) start(0); });
    const ex = Math.cos(ang[n - 1]) * (len[n - 1] + 6 * u), ey = Math.sin(ang[n - 1]) * (len[n - 1] + 6 * u);
    void group;
    return {
      entries: [hub], exit: { el: sl[n - 1], type: 'change' }, entryPts: [{ x: px, y: py }], exitPt: { x: px + ex, y: py + ey }, budgetMs: n * 260 + 1800,
      reset() { R.reset(); hub.checked = false; sl.forEach((e) => setRange(e, 0, null)); },
      flourish() { sl.forEach((e, i) => R.s.tween(700, (t) => setRange(e, 100 * Math.sin(t * Math.PI), null), undefined, undefined, true)); },
    };
  },
};
