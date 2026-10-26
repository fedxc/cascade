import type { Contraption } from '../engine/types';
import { range, radio, checkbox, group, mv, setRange, emit, poke, Runner } from '../engine/kit';
import { ease } from '../engine/clock';

// A slider swung from a pivot like a pendulum with damping. Each zero crossing emits `input` on the
// arm; a listener ticks the next radio of an arc below. When the swing dies, the last radio is the exit.
let uid = 0;
export const pendulum: Contraption = {
  kind: 'pendulum', tags: ['slow', 'tall'], nominal: 6500, weight: 1.15,
  build(c) {
    const R = new Runner(c.scope);
    const { rng, u, r } = c;
    const L = r * 0.95, px = 0, py = -r * 0.62;
    const piv = group(c.host, { x: px, y: py });
    const arm = range(piv, { x: L / 2, y: 0, w: L, h: 14, cls: 'arm', hue: c.hue, value: 100, min: 0, max: 100 });
    const bob = radio(piv, { x: L, y: 0, w: 15 * u, h: 15 * u, name: 'pend' + uid++, hue: c.hue });
    const ticks = Array.from({ length: 8 }, (_, i) => {
      const a = Math.PI / 2 + (i - 3.5) * 0.22;
      return radio(c.host, { x: px + Math.cos(a) * (L + 22 * u), y: py + Math.sin(a) * (L + 22 * u), w: 7 * u, h: 7 * u, name: 'pt' + uid, hue: c.hue + i * 4 });
    });
    uid++;
    const latch = checkbox(c.host, { x: px - 12 * u, y: py, w: 10 * u, h: 10 * u, hue: c.hue });
    const A = 0.75 * (rng.chance(0.5) ? 1 : -1);
    const rest = Math.PI / 2;
    const th = (a: number) => mv(piv, px, py, rest + a);
    th(A);
    let k = 0, last = A, swings = 0, running = false;
    const T = 1250;
    c.scope.on(latch, 'change', () => {
      if (!latch.checked) return;
      running = true; k = 0; last = A;
      const total = T * 8 * 0.95;
      R.s.tween(total, (t) => {
        const a = A * Math.exp(-2.4 * t) * Math.cos(t * Math.PI * 8);
        th(a);
        setRange(arm, 100 * Math.exp(-2.4 * t) + 8, null);
        if ((a > 0) !== (last > 0)) { last = a; emit(arm, 'input'); }
        last = a;
      }, () => { running = false; });
    });
    c.scope.on(arm, 'input', () => {
      if (!running) return;
      const t = ticks[k];
      if (t) { poke(t); c.hit(px + Math.sin(0) * L, py + L * 0.9, 0.3, k * 2); }
      k++;
      if (k >= ticks.length) { /* exit tick is the last */ }
    });
    ticks.forEach((t) => c.scope.on(t, 'change', () => { if (t.checked) { t.classList.add('on'); R.s.after(300, () => t.classList.remove('on'), true); } }));
    // the exit: after the final tick the swing has died. Poke the final radio from the tween end if ticks ran short.
    const last9 = ticks[ticks.length - 1];
    c.scope.on(bob, 'change', () => { /* bob is a radio in its own group: marks the end of the swing */ });
    void ease;
    return {
      entries: [latch], exit: { el: last9, type: 'change' }, entryPts: [{ x: px - 12 * u, y: py }], exitPt: { x: px + Math.cos(Math.PI / 2 + 0.8) * (L + 22 * u), y: py + Math.sin(Math.PI / 2 + 0.8) * (L + 22 * u) },
      budgetMs: T * 8 + 800,
      reset() { R.reset(); latch.checked = false; ticks.forEach((t) => (t.checked = false)); th(A); setRange(arm, 100, null); k = 0; running = false; },
      flourish() { th(A * 0.9); },
    };
  },
};
