// PURE chain-graph generation and validation.
import type { Rng } from './prng';

export type NodeType = 'source' | 'machine' | 'and' | 'arbiter' | 'finale';
export interface GNode { id: number; type: NodeType; ports: number; depth: number; lane: number }
export interface GEdge { from: number; to: number; port: number; back: boolean; passes: number }
export interface Graph { nodes: GNode[]; edges: GEdge[]; source: number; finale: number }

export interface GenOpts { machines: number; splits: number; races: number; loops: number }

export const fwd = (g: Graph) => g.edges.filter((e) => !e.back);
export const outs = (g: Graph, id: number, back?: boolean) => g.edges.filter((e) => e.from === id && (back === undefined || e.back === back));
export const ins = (g: Graph, id: number, back?: boolean) => g.edges.filter((e) => e.to === id && (back === undefined || e.back === back));

export function generateGraph(rng: Rng, o: GenOpts): Graph {
  const nodes: GNode[] = [];
  const edges: GEdge[] = [];
  const mk = (type: NodeType, lane: number, ports = 1): number => {
    nodes.push({ id: nodes.length, type, ports, depth: 0, lane });
    return nodes.length - 1;
  };
  const source = mk('source', 0);
  let prev = source;
  const chain = Math.max(2, o.machines - o.splits * 3);
  for (let i = 0; i < chain; i++) {
    const m = mk('machine', 0);
    edges.push({ from: prev, to: m, port: 0, back: false, passes: 0 });
    prev = m;
  }
  const finale = mk('finale', 0);
  edges.push({ from: prev, to: finale, port: 0, back: false, passes: 0 });

  let budget = o.machines - chain;
  let races = o.races;
  for (let s = 0; s < o.splits && budget >= 2; s++) {
    // choose a forward edge whose source is not the source node's very first hop into gates
    const cands = edges.filter((e) => !e.back);
    if (!cands.length) break;
    const e = rng.pick(cands);
    const u = e.from, v = e.to, vport = e.port;
    const k = budget >= 6 && rng.chance(0.25) ? 3 : 2;
    const isRace = races > 0 && rng.chance(0.6);
    if (isRace) races--;
    const J = mk(isRace ? 'arbiter' : 'and', (nodes[u].lane + nodes[v].lane) / 2, k);
    // remove edge u->v, add J->v
    edges.splice(edges.indexOf(e), 1);
    edges.push({ from: J, to: v, port: vport, back: false, passes: 0 });
    for (let b = 0; b < k && budget > 0; b++) {
      const len = Math.min(budget - (k - 1 - b), rng.int(1, 3));
      const off = (b - (k - 1) / 2) * 0.75 / (1 + Math.abs(nodes[u].lane));
      let p = u;
      const L = Math.max(1, len);
      for (let i = 0; i < L; i++) {
        const m = mk('machine', nodes[u].lane + off);
        edges.push({ from: p, to: m, port: 0, back: false, passes: 0 });
        p = m;
        budget--;
      }
      edges.push({ from: p, to: J, port: b, back: false, passes: 0 });
    }
    // if budget ran out before every port got a branch, fill remaining ports with a single machine
    const have = new Set(edges.filter((x) => x.to === J).map((x) => x.port));
    for (let b = 0; b < k; b++) {
      if (have.has(b)) continue;
      const m = mk('machine', nodes[u].lane + (b - (k - 1) / 2) * 0.75);
      edges.push({ from: u, to: m, port: 0, back: false, passes: 0 });
      edges.push({ from: m, to: J, port: b, back: false, passes: 0 });
    }
  }

  // loops: back-edge b -> a over a linear run of plain machines
  const g0: Graph = { nodes, edges, source, finale };
  for (let l = 0; l < o.loops; l++) {
    const runs = findLinearRuns(g0);
    if (!runs.length) break;
    const run = rng.pick(runs);
    const a = run[0], b = run[run.length - 1];
    edges.push({ from: b, to: a, port: 0, back: true, passes: rng.int(1, 2) });
  }

  computeDepth(g0);
  return g0;
}

/** linear runs (length ≥ 2) of machines that are safe to loop: a has indeg 1 (non-back), mids indeg=outdeg=1, b outdeg 1 fwd */
export function findLinearRuns(g: Graph): number[][] {
  const runs: number[][] = [];
  const hasBack = new Set(g.edges.filter((e) => e.back).flatMap((e) => [e.from, e.to]));
  const plain = (id: number) => g.nodes[id].type === 'machine' && !hasBack.has(id);
  for (const n of g.nodes) {
    if (!plain(n.id)) continue;
    const i = ins(g, n.id, false), o = outs(g, n.id, false);
    if (i.length !== 1 || o.length !== 1) continue;
    const run = [n.id];
    let cur = o[0].to;
    while (plain(cur) && ins(g, cur, false).length === 1 && outs(g, cur, false).length === 1 && run.length < 4) {
      run.push(cur);
      cur = outs(g, cur, false)[0].to;
    }
    if (run.length >= 2) runs.push(run);
  }
  return runs;
}

export function computeDepth(g: Graph) {
  const order = topo(g);
  for (const n of g.nodes) n.depth = 0;
  for (const id of order) {
    for (const e of outs(g, id, false)) g.nodes[e.to].depth = Math.max(g.nodes[e.to].depth, g.nodes[id].depth + 1);
  }
}

export function topo(g: Graph): number[] {
  const indeg = new Map<number, number>();
  for (const n of g.nodes) indeg.set(n.id, 0);
  for (const e of g.edges) if (!e.back) indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
  const q = g.nodes.filter((n) => indeg.get(n.id) === 0).map((n) => n.id);
  const out: number[] = [];
  while (q.length) {
    const id = q.shift()!;
    out.push(id);
    for (const e of outs(g, id, false)) {
      indeg.set(e.to, indeg.get(e.to)! - 1);
      if (indeg.get(e.to) === 0) q.push(e.to);
    }
  }
  return out;
}

export function validateGraph(g: Graph): string[] {
  const err: string[] = [];
  const N = g.nodes.length;
  for (const e of g.edges) {
    if (e.from < 0 || e.from >= N || e.to < 0 || e.to >= N) err.push(`edge out of range ${e.from}->${e.to}`);
  }
  if (err.length) return err;
  if (g.nodes[g.source].type !== 'source') err.push('source type');
  if (g.nodes[g.finale].type !== 'finale') err.push('finale type');
  if (ins(g, g.source, false).length) err.push('source has inputs');
  if (outs(g, g.finale, false).length) err.push('finale has outputs');
  if (topo(g).length !== N) err.push('cycle in forward edges');
  // reachability both ways
  const reach = new Set<number>([g.source]);
  const stack = [g.source];
  while (stack.length) for (const e of outs(g, stack.pop()!, false)) if (!reach.has(e.to)) { reach.add(e.to); stack.push(e.to); }
  for (const n of g.nodes) if (!reach.has(n.id)) err.push(`node ${n.id} unreachable`);
  const co = new Set<number>([g.finale]);
  const st2 = [g.finale];
  while (st2.length) for (const e of ins(g, st2.pop()!, false)) if (!co.has(e.from)) { co.add(e.from); st2.push(e.from); }
  for (const n of g.nodes) if (!co.has(n.id)) err.push(`node ${n.id} dead end (cannot reach finale)`);
  for (const n of g.nodes) {
    const i = ins(g, n.id, false), o = outs(g, n.id, false);
    if (n.type !== 'finale' && o.length === 0) err.push(`node ${n.id} has no output`);
    if (n.type === 'and' || n.type === 'arbiter') {
      const ports = new Set(i.map((e) => e.port));
      if (i.length !== n.ports || ports.size !== n.ports) err.push(`merge ${n.id}: ${i.length} inputs for ${n.ports} ports`);
      for (let p = 0; p < n.ports; p++) if (!ports.has(p)) err.push(`merge ${n.id}: port ${p} unfed`);
      if (n.ports < 2) err.push(`merge ${n.id}: <2 ports`);
    } else if (n.type !== 'source' && i.length !== 1) err.push(`node ${n.id} (${n.type}) has ${i.length} forward inputs`);
  }
  // back edges: target must be a linear-run ancestor of the source
  for (const b of g.edges.filter((e) => e.back)) {
    if (b.passes < 1 || b.passes > 3) err.push(`back edge passes ${b.passes}`);
    let cur = b.to, ok = false;
    for (let k = 0; k < 8; k++) {
      if (cur === b.from) { ok = true; break; }
      const o = outs(g, cur, false);
      if (o.length !== 1) break;
      cur = o[0].to;
    }
    if (!ok) err.push(`back edge ${b.from}->${b.to} not on a linear run`);
    if (g.nodes[b.to].type !== 'machine' || g.nodes[b.from].type !== 'machine') err.push('back edge touches non-machine');
  }
  return err;
}

/** all forward paths source→finale (capped) — used by tests to prove "every path reaches the end" */
export function allPaths(g: Graph, cap = 5000): number[][] {
  const res: number[][] = [];
  const dfs = (id: number, path: number[]) => {
    if (res.length >= cap) return;
    path.push(id);
    if (id === g.finale) res.push([...path]);
    else for (const e of outs(g, id, false)) dfs(e.to, path);
    path.pop();
  };
  dfs(g.source, []);
  return res;
}
