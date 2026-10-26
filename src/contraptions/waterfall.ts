import type { Contraption } from '../engine/types';
import { textarea, lamp, emit, poke, WORDS, Runner } from '../engine/kit';

// Waterfall: a stair of tiny textareas. Characters are poured from the top one and spill step to step, each arrival
// (an `input` event) sending the character on to the next.
export const waterfall: Contraption = {
  kind: 'waterfall', tags: ['tall'], nominal: 4000, weight: 1.05,
  build(c) {
    const R = new Runner(c.scope);
    const { rng, u, r } = c;
    const m = rng.int(6, 9), dx = (r * 1.5) / m, dy = (r * 1.4) / m * rng.pick([1, 1, -1]);
    const N = rng.int(10, 16);
    const bw = Math.max(40 * u, dx * 2.1), bh = Math.max(15 * u, r * 0.13);
    const fs = Math.round(bh * 0.72);
    const tas = Array.from({ length: m }, (_, i) => {
      const t = textarea(c.host, { x: (i - (m - 1) / 2) * dx, y: (i - (m - 1) / 2) * dy, w: bw, h: bh, rows: 1, cols: 12, rot: 0.12, hue: c.hue + (i / m) * (c.hue2 - c.hue) });
      t.style.fontSize = fs + 'px'; t.style.lineHeight = bh - 4 + 'px'; t.style.whiteSpace = 'nowrap'; t.readOnly = true; return t;
    });
    let text = '';
    const fresh = () => { text = ''; while (text.length < N) text += rng.pick(WORDS) + ' '; text = text.slice(0, N); };
    fresh(); tas[0].value = text;
    const p0 = { x: -(m - 1) / 2 * dx - bw / 2 - 12 * u, y: -(m - 1) / 2 * dy }, p1 = { x: (m - 1) / 2 * dx + bw / 2 + 12 * u, y: (m - 1) / 2 * dy };
    const entry = lamp(c.host, p0.x, p0.y, 11 * u, c.hue);
    const out = lamp(c.host, p1.x, p1.y, 11 * u, c.hue2);
    const move = (i: number) => {
      const t = tas[i], ch = t.value[0]; if (ch === undefined) return;
      t.value = t.value.slice(1);
      const nx = tas[i + 1]; nx.value += ch; nx.classList.add('on'); R.s.after(200, () => nx.classList.remove('on'), true);
      emit(nx, 'input');
    };
    let poured = 0;
    const pour = () => { if (poured++ < N) { move(0); R.s.after(rng.range(45, 85), pour); } };
    tas.forEach((t, i) => c.scope.on(t, 'input', () => {
      if (i === 0) return;
      if (i % 2 === 0) c.hit((i - (m - 1) / 2) * dx, (i - (m - 1) / 2) * dy, 0.05, i + t.value.length);
      if (i < m - 1) R.s.after(80, () => move(i)); else if (t.value.length >= N) R.s.after(250, () => poke(out));
    }));
    c.scope.on(entry, 'change', () => { if (entry.checked) { poured = 0; pour(); } });
    return {
      entries: [entry], exit: { el: out, type: 'change' }, entryPts: [p0], exitPt: p1, budgetMs: N * 160 + m * 100 + 1000,
      reset() { R.reset(); poured = 0; entry.checked = false; out.checked = false; tas.forEach((t) => { t.value = ''; t.classList.remove('on'); }); fresh(); tas[0].value = text; },
      flourish() { tas.forEach((t, i) => R.s.after(i * 60, () => { t.classList.add('on'); R.s.after(500, () => t.classList.remove('on'), true); }, true)); },
    };
  },
};
