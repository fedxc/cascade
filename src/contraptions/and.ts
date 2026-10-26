import type { Contraption } from '../engine/types';
import { checkbox, range, setRange, emit, poke, Runner } from '../engine/kit';
import { ease } from '../engine/clock';

// MERGE: waits for a token on every port (latch checkboxes). When all are latched a bar slams shut.
export const andGate: Contraption = {
  kind: 'and', role: 'and', nominal: 1500, weight: 0.7,
  build(c) {
    const R = new Runner(c.scope);
    const { u, r, ports } = c;
    const latches = Array.from({ length: ports }, (_, p) => {
      const y = (p - (ports - 1) / 2) * r * 0.62;
      return checkbox(c.host, { x: -r * 0.72, y, w: 13 * u, h: 13 * u, hue: c.hue + p * 14 });
    });
    const bar = range(c.host, { x: 0, y: 0, w: r * 1.15, h: 16, rot: -Math.PI / 2, cls: 'fat', hue: c.hue, value: 0, min: 0, max: 100 });
    const out = checkbox(c.host, { x: r * 0.72, y: 0, w: 14 * u, h: 14 * u, hue: c.hue2 });
    let got = 0, closing = false;
    latches.forEach((l, p) => {
      c.scope.on(l, 'change', () => {
        if (!l.checked) return;
        got++;
        c.hit(-r * 0.72, (p - (ports - 1) / 2) * r * 0.62, 0.25, p);
        setRange(bar, got * (60 / ports), null);
        if (got === ports && !closing) {
          closing = true;
          R.s.after(260, () => R.s.tween(420, (t) => { setRange(bar, 60 + 40 * t, 'input'); }, () => { setRange(bar, 100, null); emit(bar, 'change'); }, ease.in));
        }
      });
    });
    c.scope.on(bar, 'change', () => { c.hit(0, 0, 0.7, 0); poke(out); });
    return {
      entries: latches, exit: { el: out, type: 'change' },
      entryPts: latches.map((_, p) => ({ x: -r * 0.72, y: (p - (ports - 1) / 2) * r * 0.62 })), exitPt: { x: r * 0.72, y: 0 }, budgetMs: 1200,
      reset() { R.reset(); got = 0; closing = false; latches.forEach((l) => (l.checked = false)); out.checked = false; setRange(bar, 0, null); },
      flourish() { bar.classList.add('on'); },
    };
  },
};

