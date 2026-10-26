import type { Contraption } from '../engine/types';
import { progress, lamp, emit, poke, Runner } from '../engine/kit';
import { fitShape, sampleByArc, arcFn, waveFn, TAU } from '../engine/geometry';

// Organ pipes: progress bars rising in overlapping waves. At ~40% a pipe emits `input` and kicks the next one.
export const organ: Contraption = {
  kind: 'organ', tags: ['slow'], nominal: 4200, weight: 1.15,
  build(c) {
    const R = new Runner(c.scope);
    const { rng, u, r } = c;
    const n = rng.int(9, 15);
    const sun = rng.chance(0.55);
    const a0 = rng.range(0, TAU), span = sun ? rng.range(2.6, TAU * 0.95) : 0;
    const curve = sun ? fitShape(arcFn(1, a0, a0 + span), r * 0.42) : fitShape(waveFn(2, rng.range(0, 0.5), 1), r * 0.9);
    const base = sampleByArc(curve, 1, { max: n });
    const pipes: HTMLProgressElement[] = [], dirs: { x: number; y: number }[] = [], Ls: number[] = [];
    const bases = Array.from({ length: n }, (_, i) => curve(i / (n - 1)));
    bases.forEach((b, i) => {
      const ang = sun ? Math.atan2(b.y, b.x) : -Math.PI / 2 + rng.range(-0.05, 0.05);
      const hump = 0.55 + 0.45 * Math.sin((i / (n - 1)) * Math.PI);
      const len = (sun ? r * 0.55 : r * 0.9) * (0.55 + 0.45 * hump) * rng.range(0.85, 1.05);
      const d = { x: Math.cos(ang), y: Math.sin(ang) };
      dirs.push(d); Ls.push(len);
      pipes.push(progress(c.host, { x: b.x + d.x * len / 2, y: b.y + d.y * len / 2, w: len, h: 8 * u, rot: ang, hue: c.hue + (i / n) * (c.hue2 - c.hue) * 0.7, value: 0 }));
    });
    const entry = lamp(c.host, bases[0].x - dirs[0].x * 14 * u, bases[0].y - dirs[0].y * 14 * u + (sun ? 0 : 12 * u), 11 * u, c.hue);
    const out = lamp(c.host, bases[n - 1].x - dirs[n - 1].x * 14 * u, bases[n - 1].y - dirs[n - 1].y * 14 * u + (sun ? 0 : 12 * u), 11 * u, c.hue2);
    void base;
    const fill = (i: number) => {
      const p = pipes[i];
      let sent = false;
      const dur = 520 + (i % 3) * 90;
      R.s.tween(dur, (t) => {
        p.value = t;
        if (!sent && t > 0.42) { sent = true; emit(p, 'input'); }
      }, () => {
        emit(p, 'change');
        c.hit(bases[i].x + dirs[i].x * Ls[i], bases[i].y + dirs[i].y * Ls[i], 0.2, i);
        R.s.tween(900, (t) => { p.value = 1 - t * t; }, undefined, undefined);
      });
    };
    pipes.forEach((p, i) => {
      c.scope.on(p, 'input', () => { if (i < n - 1) fill(i + 1); });
    });
    c.scope.on(pipes[n - 1], 'change', () => { /* exit */ });
    c.scope.on(entry, 'change', () => { if (entry.checked) fill(0); });
    c.scope.on(out, 'change', () => {});
    return {
      entries: [entry], exit: { el: pipes[n - 1], type: 'change' },
      entryPts: [{ x: bases[0].x - dirs[0].x * 14 * u, y: bases[0].y - dirs[0].y * 14 * u }],
      exitPt: { x: bases[n - 1].x + dirs[n - 1].x * Ls[n - 1] * 0.5, y: bases[n - 1].y + dirs[n - 1].y * Ls[n - 1] * 0.5 },
      budgetMs: n * 330 + 1500,
      reset() { R.reset(); entry.checked = false; out.checked = false; pipes.forEach((p) => (p.value = 0)); },
      flourish() { pipes.forEach((p, i) => R.s.tween(500, (t) => { p.value = Math.sin(t * Math.PI); }, undefined, undefined, true)); },
    };
  },
};
void poke;
