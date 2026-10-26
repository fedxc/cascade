import type { Contraption } from '../engine/types';
import { range, num, setRange, lamp, emit, poke, Runner } from '../engine/kit';
import { ease } from '../engine/clock';

// Piston engine: four vertical sliders fire in order; each stroke's peak emits `input` and fires the next. A number input counts revolutions.
export const piston: Contraption = {
  kind: 'piston', tags: ['fast', 'tall'], nominal: 4000, weight: 1.0,
  build(c) {
    const R = new Runner(c.scope);
    const { rng, u, r } = c;
    const n = 4, sp = r * 0.38, H = r * 1.3;
    const order = [0, 2, 3, 1];
    const ps = Array.from({ length: n }, (_, i) => range(c.host, { x: (i - 1.5) * sp, y: -r * 0.12, w: H, h: 14, rot: -Math.PI / 2, cls: 'fat', hue: c.hue + i * 22, value: 0, min: 0, max: 100 }));
    const counter = num(c.host, { x: 0, y: r * 0.78, w: Math.max(26 * u, r * 0.3), h: Math.max(30 * u, r * 0.3), value: 0, min: 0, max: 99, hue: c.hue2 });
    counter.style.fontSize = Math.round(Math.max(26 * u, r * 0.3) * 0.7) + 'px';
    const entry = lamp(c.host, -r * 0.98, r * 0.7, 11 * u, c.hue);
    const out = lamp(c.host, r * 0.98, r * 0.7, 11 * u, c.hue2);
    const revs = rng.int(2, 3);
    let k = 0;
    const fire = () => {
      const i = order[k % n]; let sent = false;
      R.s.tween(300, (t) => { setRange(ps[i], 100 * t, null); }, () => { /* peak reached */ emit(ps[i], 'change'); R.s.tween(260, (t) => setRange(ps[i], 100 * (1 - t), null)); }, ease.out);
      void sent;
    };
    ps.forEach((p, i) => c.scope.on(p, 'change', () => {
      c.hit((i - 1.5) * sp, -r * 0.12 - H / 2, 0.3, i * 2);
      k++;
      if (k % n === 0) { counter.value = String(k / n); counter.classList.add('on'); R.s.after(300, () => counter.classList.remove('on'), true); emit(counter, 'input'); }
      if (k < revs * n) R.s.after(90, fire);
    }));
    c.scope.on(counter, 'input', () => { if (+counter.value >= revs) R.s.after(500, () => poke(out)); });
    c.scope.on(entry, 'change', () => { if (entry.checked) { k = 0; fire(); } });
    return {
      entries: [entry], exit: { el: out, type: 'change' }, entryPts: [{ x: -r * 0.98, y: r * 0.7 }], exitPt: { x: r * 0.98, y: r * 0.7 }, budgetMs: revs * n * 450 + 1200,
      reset() { R.reset(); k = 0; entry.checked = false; out.checked = false; counter.value = '0'; ps.forEach((p) => setRange(p, 0, null)); },
      flourish() { ps.forEach((p, i) => R.s.tween(600, (t) => setRange(p, 100 * Math.sin(t * Math.PI), null), undefined, undefined, true)); },
    };
  },
};
