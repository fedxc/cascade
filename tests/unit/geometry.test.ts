import { test, expect } from 'bun:test';
import { createRng } from '../../src/engine/prng';
import { sampleByArc, spiralFn, lissajousFn, eightFn, fitShape, hexLattice, layoutCircles, maxOverlap, dist, skeleton, bezier } from '../../src/engine/geometry';

test('arc-length sampling is evenly spaced', () => {
  for (const f of [spiralFn(50, 160, 2, 0), eightFn(100, 60)]) {
    const pts = sampleByArc(f, 4);
    const d = pts.slice(1).map((p, i) => dist(p, pts[i]));
    const mean = d.reduce((a, b) => a + b, 0) / d.length;
    for (const x of d) expect(Math.abs(x - mean) / mean).toBeLessThan(0.2); // chord vs arc on curvature
  }
});
test('fitShape fits inside radius', () => {
  const f = fitShape(lissajousFn(5, 9, 3, 2, 0.3), 80);
  for (let i = 0; i <= 100; i++) expect(Math.hypot(f(i / 100).x, f(i / 100).y)).toBeLessThanOrEqual(80.001);
});
test('hex lattice covers the box with near-uniform density', () => {
  const pts = hexLattice(800, 600, 20, 0.2, createRng(3));
  expect(pts.length).toBeGreaterThan(800 * 600 / (20 * 20 * 0.866) * 0.9);
  for (const p of pts) { expect(p.x >= 0 && p.x <= 800 && p.y >= 0 && p.y <= 600).toBe(true); }
});
test('layout keeps circles in view with little overlap, for three screen shapes', () => {
  for (const [W, H] of [[390, 844], [1440, 900], [2560, 1080]]) {
    for (let seed = 1; seed <= 25; seed++) {
      const rng = createRng(seed);
      const n = Math.round(Math.sqrt(W * H) / 64) + 4;
      const cell = Math.sqrt((W * H) / n);
      const r = Array.from({ length: n }, () => cell * 0.46 * rng.range(0.8, 1.2));
      const f = Array.from({ length: n }, (_, i) => i / (n - 1));
      const lane = Array.from({ length: n }, (_, i) => (i % 3 === 0 ? 0 : rng.range(-0.8, 0.8)));
      const edges = Array.from({ length: n - 1 }, (_, i) => [i, i + 1] as [number, number]);
      const pos = layoutCircles({ W, H, f, lane, r, edges, rng });
      for (let i = 0; i < n; i++) {
        expect(pos[i].x).toBeGreaterThan(0); expect(pos[i].x).toBeLessThan(W);
        expect(pos[i].y).toBeGreaterThan(0); expect(pos[i].y).toBeLessThan(H);
      }
      expect(maxOverlap(pos, r)).toBeLessThan(0.45);
    }
  }
});
test('layout is deterministic', () => {
  const run = () => { const rng = createRng(11); return layoutCircles({ W: 1000, H: 700, f: [0, .5, 1], lane: [0, .3, -.2], r: [60, 60, 60], edges: [[0, 1], [1, 2]], rng }); };
  expect(run()).toEqual(run());
});
test('skeleton stays on screen; bezier endpoints', () => {
  const sk = skeleton(1440, 900, createRng(2));
  for (let i = 0; i <= 20; i++) { const p = sk.at(i / 20); expect(p.x).toBeGreaterThan(0); expect(p.x).toBeLessThan(1440); expect(p.y).toBeGreaterThan(0); expect(p.y).toBeLessThan(900); }
  expect(bezier({ x: 0, y: 0 }, { x: 1, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 0 }, 1)).toEqual({ x: 4, y: 0 });
});
