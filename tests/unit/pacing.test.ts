import { test, expect } from 'bun:test';
import { tempoAt, dimAt, phaseAt, PACE } from '../../src/engine/pacing';

test('arc: slow wind-up, hush is the slowest stretch, crescendo is the fastest', () => {
  const at = (p: number) => tempoAt(p, 0, 0);
  expect(at(0)).toBeLessThan(0.6);
  const hush = (PACE.buildEnd + PACE.hushEnd) / 2 + 0.03;
  expect(at(hush)).toBeLessThan(0.45);
  expect(at(0.999)).toBeGreaterThan(2.4);
  expect(at(0.999)).toBeGreaterThan(at(0.4));
  expect(at(0.4)).toBeGreaterThan(at(0.02));
});
test('tempo is bounded and finite over the whole domain', () => {
  for (let p = 0; p <= 1; p += 0.01) for (let t = 0; t < 120; t += 0.7) {
    const v = tempoAt(p, t, 1.3);
    expect(Number.isFinite(v)).toBe(true); expect(v).toBeGreaterThanOrEqual(0.18); expect(v).toBeLessThanOrEqual(4.2);
  }
});
test('phases are ordered and the lights dim in the hush then return', () => {
  expect([0, 0.2, 0.5, 0.75, 0.95, 1].map(phaseAt)).toEqual(['windup', 'rolling', 'building', 'hush', 'crescendo', 'finale']);
  expect(dimAt(0.1)).toBe(0);
  expect(dimAt(0.8)).toBeGreaterThan(0.3);
  expect(dimAt(1)).toBeLessThan(0.05);
});
test('bursts exist: tempo varies over time in the rolling phase', () => {
  const vals = Array.from({ length: 200 }, (_, i) => tempoAt(0.3, i * 0.2, 0));
  expect(Math.max(...vals) / Math.min(...vals)).toBeGreaterThan(1.4);
});
