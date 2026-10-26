import { test, expect } from 'bun:test';
import { planCycle, type KindInfo } from '../../src/engine/plan';
import { validateGraph } from '../../src/engine/graph';
import { maxOverlap } from '../../src/engine/geometry';

const kinds: KindInfo[] = [
  ...['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((k, i) => ({ kind: k, tags: i % 3 ? [] : ['slow', 'start'], weight: 1, nominal: 3000, role: 'machine' as const })),
  { kind: 'and', tags: [], weight: .7, nominal: 1000, role: 'and' }, { kind: 'arb', tags: [], weight: .7, nominal: 1000, role: 'arbiter' }, { kind: 'fin', tags: [], weight: 1.5, nominal: 5000, role: 'finale' },
];

test('plans are deterministic for (seed, cycle, carry)', () => {
  const a = planCycle({ seed: 5, cycle: 2, W: 1440, H: 900, kinds, finalHue: 120 });
  const b = planCycle({ seed: 5, cycle: 2, W: 1440, H: 900, kinds, finalHue: 120 });
  expect(a).toEqual(b);
  const c = planCycle({ seed: 5, cycle: 2, W: 1440, H: 900, kinds, finalHue: 121 });
  expect(c.nodes.map((n) => n.cx)).not.toEqual(a.nodes.map((n) => n.cx));
});
test('every plan across screens and cycles is valid and fits the screen', () => {
  for (const [W, H] of [[390, 844], [1440, 900], [2560, 1080]]) {
    let prev = null as any;
    for (let cycle = 0; cycle < 12; cycle++) {
      const p = planCycle({ seed: 77, cycle, W, H, kinds, prev, finalHue: cycle * 37 });
      expect(validateGraph(p.graph)).toEqual([]);
      for (const n of p.nodes) { expect(n.cx).toBeGreaterThan(0); expect(n.cx).toBeLessThan(W); expect(n.cy).toBeGreaterThan(0); expect(n.cy).toBeLessThan(H); }
      expect(maxOverlap(p.nodes.map((n) => ({ x: n.cx, y: n.cy })), p.nodes.map((n) => n.r))).toBeLessThan(0.5);
      expect(p.nodes[p.graph.finale].kind).toBe('fin');
      prev = p;
    }
  }
});
test('cycles evolve: later cycles differ from the first, but keep ~half the kinds', () => {
  const p0 = planCycle({ seed: 3, cycle: 0, W: 1440, H: 900, kinds });
  let prev = p0, same = 0, total = 0;
  for (let c = 1; c <= 9; c++) {
    const p = planCycle({ seed: 3, cycle: c, W: 1440, H: 900, kinds, prev, finalHue: c * 50 });
    const m = (x: typeof p) => x.nodes.filter((n) => n.type === 'machine' || n.type === 'source').sort((u, v) => u.depth - v.depth || u.id - v.id).map((n) => n.kind);
    const a = m(prev), b = m(p);
    for (let i = 0; i < Math.min(a.length, b.length); i++) { total++; if (a[i] === b[i]) same++; }
    prev = p;
  }
  expect(same / total).toBeGreaterThan(0.15); expect(same / total).toBeLessThan(0.9);
  expect(prev.baseHue).not.toBeCloseTo(p0.baseHue, 0);
});
