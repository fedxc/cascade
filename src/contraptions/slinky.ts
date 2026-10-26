import type { Contraption } from '../engine/types';
import { range, setRange, lamp, emit, poke, Runner } from '../engine/kit';

// Slinky: a pulse runs along a row of vertical sliders — each one's peak (`input`) kicks its neighbour — and reflects at the end.
export const slinky: Contraption = {
  kind: 'slinky', tags: ['fast'], nominal: 4200, weight: 1.15,
  build(c) {
    const R = new Runner(c.scope);
    const { rng, u, r } = c;
    const n = Math.max(16, Math.min(34, Math.floor((r * 2) / (8 * u))));
    const sp = (r * 1.9) / n, H = r * 0.9, bend = rng.range(0.1, 0.35);
    const px = (i: number) => (i - (n - 1) / 2) * sp, py = (i: number) => Math.sin((i / n) * Math.PI * 2 * rng.pick([1])) * r * bend;
    const ys = Array.from({ length: n }, (_, i) => Math.sin((i / (n - 1)) * Math.PI * 1.4) * r * bend);
    const ss = Array.from({ length: n }, (_, i) => range(c.host, { x: px(i), y: ys[i], w: H, h: 14, rot: -Math.PI / 2, hue: c.hue + (i / n) * (c.hue2 - c.hue), value: 0, min: 0, max: 100 }));
    const entry = lamp(c.host, px(0) - 14 * u, ys[0] + H / 2, 11 * u, c.hue);
    const out = lamp(c.host, px(0) - 14 * u, ys[0] - H / 2, 11 * u, c.hue2);
    let dir = 1, bounced = false;
    const kick = (i: number) => {
      let sent = false;
      R.s.tween(520, (t) => {
        setRange(ss[i], 100 * Math.sin(t * Math.PI) * (1 - 0.25 * t), null);
        if (!sent && t > 0.22) { sent = true; emit(ss[i], 'input'); }
      });
    };
    ss.forEach((s, i) => c.scope.on(s, 'input', () => {
      c.hit(px(i), ys[i] - H / 2, 0.07, i);
      const nx = i + dir;
      if (nx >= n) { dir = -1; bounced = true; c.hit(px(i), ys[i], 0.4, 2); R.s.after(20, () => kick(i - 1)); return; }
      if (nx < 0) { R.s.after(200, () => poke(out)); return; }
      R.s.after(26, () => kick(nx));
    }));
    c.scope.on(entry, 'change', () => { if (entry.checked) { dir = 1; bounced = false; kick(0); } });
    void bounced;
    return {
      entries: [entry], exit: { el: out, type: 'change' }, entryPts: [{ x: px(0) - 14 * u, y: ys[0] + H / 2 }], exitPt: { x: px(0) - 14 * u, y: ys[0] - H / 2 }, budgetMs: n * 140 + 1200,
      reset() { R.reset(); dir = 1; entry.checked = false; out.checked = false; ss.forEach((s) => setRange(s, 0, null)); },
      flourish() { ss.forEach((s, i) => R.s.tween(800, (t) => setRange(s, 100 * Math.sin(t * Math.PI) * Math.sin(i * 0.5 + t * 6) ** 2, null), undefined, undefined, true)); },
    };
  },
};
void py0;
function py0() {}
