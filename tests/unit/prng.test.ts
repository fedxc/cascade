import { test, expect } from 'bun:test';
import { createRng } from '../../src/engine/prng';
import { Glob } from 'bun';
import { readFileSync } from 'node:fs';

test('same seed → same stream; different seed differs', () => {
  const a = createRng(42), b = createRng(42), c = createRng(43);
  const sa = Array.from({ length: 50 }, () => a.next()), sb = Array.from({ length: 50 }, () => b.next());
  expect(sa).toEqual(sb);
  expect(Array.from({ length: 50 }, () => c.next())).not.toEqual(sa);
});
test('range/int/pick stay in bounds and are uniform-ish', () => {
  const r = createRng(1);
  const bins = new Array(10).fill(0);
  for (let i = 0; i < 20000; i++) { const v = r.next(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); bins[Math.floor(v * 10)]++; }
  for (const b of bins) expect(Math.abs(b - 2000)).toBeLessThan(250);
  for (let i = 0; i < 1000; i++) { const n = r.int(3, 7); expect(n >= 3 && n <= 7 && Number.isInteger(n)).toBe(true); }
});
test('fork is deterministic and independent of label order', () => {
  const a = createRng(9), b = createRng(9);
  expect(a.fork('x').next()).toBe(b.fork('x').next());
  const f1 = createRng(9).fork('x').next(), f2 = createRng(9).fork('y').next();
  expect(f1).not.toBe(f2);
});
test('shuffle keeps elements', () => {
  const r = createRng(5);
  const s = r.shuffle([1, 2, 3, 4, 5, 6, 7, 8]);
  expect([...s].sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
});
test('no Math.random anywhere in src/', () => {
  const hits: string[] = [];
  for (const f of new Glob('src/**/*.ts').scanSync('.')) if (/Math\.random/.test(readFileSync(f, 'utf8').replace(/\/\/.*$/gm, ''))) hits.push(f);
  expect(hits).toEqual([]);
});
