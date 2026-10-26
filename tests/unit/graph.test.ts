import { test, expect } from 'bun:test';
import { createRng } from '../../src/engine/prng';
import { generateGraph, validateGraph, allPaths, outs, ins, type Graph } from '../../src/engine/graph';

const gen = (seed: number, machines = 14, splits = 3, races = 1, loops = 1) => generateGraph(createRng(seed), { machines, splits, races, loops });

test('2000 random graphs are valid: no dead ends, merges fed on every port, every path reaches the finale', () => {
  for (let s = 1; s <= 2000; s++) {
    const g = gen(s, 6 + (s % 21), 1 + (s % 5), s % 3, s % 3);
    expect(validateGraph(g)).toEqual([]);
    const paths = allPaths(g);
    expect(paths.length).toBeGreaterThan(0);
    for (const p of paths) { expect(p[0]).toBe(g.source); expect(p[p.length - 1]).toBe(g.finale); }
    // every node lies on at least one source→finale path
    const on = new Set(paths.flat());
    expect(on.size).toBe(g.nodes.length);
  }
});
test('merges wait for ALL inputs: AND/arbiter in-degree equals ports', () => {
  for (let s = 1; s <= 300; s++) {
    const g = gen(s);
    for (const n of g.nodes.filter((n) => n.type === 'and' || n.type === 'arbiter')) {
      expect(ins(g, n.id, false).length).toBe(n.ports);
      expect(n.ports).toBeGreaterThanOrEqual(2);
    }
  }
});
test('splits exist (an out-degree ≥ 2) and loops are bounded', () => {
  let splits = 0, loops = 0;
  for (let s = 1; s <= 200; s++) {
    const g = gen(s);
    if (g.nodes.some((n) => outs(g, n.id, false).length >= 2)) splits++;
    for (const e of g.edges.filter((e) => e.back)) { loops++; expect(e.passes).toBeLessThanOrEqual(3); }
  }
  expect(splits).toBeGreaterThan(150);
  expect(loops).toBeGreaterThan(20);
});
test('validator catches broken graphs', () => {
  const g = gen(1);
  const dead: Graph = { ...g, edges: g.edges.filter((e) => e.to !== g.finale) };
  expect(validateGraph(dead).length).toBeGreaterThan(0);
  const bad: Graph = { ...g, edges: [...g.edges, { from: g.finale, to: g.source, port: 0, back: false, passes: 0 }] };
  expect(validateGraph(bad).length).toBeGreaterThan(0);
});
