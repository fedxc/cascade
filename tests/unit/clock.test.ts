import { test, expect } from 'bun:test';
import { Clock } from '../../src/engine/clock';
import { Scope, live } from '../../src/engine/scope';

// the clock must not touch the DOM when only stepped
test('event order is independent of frame size (virtual time determinism)', () => {
  const run = (dt: number) => {
    const c = new Clock(); const log: string[] = [];
    const chain = (name: string, n: number, gap: number) => { if (n) c.after(gap, () => { log.push(`${name}${n}@${c.now}`); chain(name, n - 1, gap); }); };
    chain('a', 6, 70); chain('b', 4, 110);
    for (let t = 0; t < 600; t += dt) c.step(dt);
    return log.map((s) => s.split('@')[0]).join(',');
  };
  expect(run(16)).toBe(run(33));
  expect(run(16)).toBe(run(5));
});
test('tween reaches exactly 1 and calls done once', () => {
  const c = new Clock(); let last = -1, done = 0;
  c.tween(100, (t) => (last = t), () => done++);
  for (let i = 0; i < 20; i++) c.step(16);
  expect(last).toBe(1); expect(done).toBe(1);
});
test('scope.dispose cancels timers and tweens (no leaks, no late callbacks)', () => {
  const c = new Clock(); const s = new Scope(c); let fired = 0;
  for (let i = 0; i < 50; i++) { s.after(100 + i, () => fired++); s.tween(200, () => fired++); }
  s.dispose();
  for (let i = 0; i < 40; i++) c.step(16);
  expect(fired).toBe(0);
  expect(live.timers).toBe(0); expect(live.tweens).toBe(0);
});
test('tempo scales delays', () => {
  const c = new Clock(); let tempo = 2; const s = new Scope(c, () => tempo); let at = 0;
  s.after(200, () => (at = c.now));
  for (let i = 0; i < 20; i++) c.step(10);
  expect(at).toBeGreaterThanOrEqual(100); expect(at).toBeLessThan(120);
});
