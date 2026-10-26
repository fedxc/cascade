// PURE: a cycle plan = graph + layout + kinds + hues + wire styles. mutate(prev) → next keeps the identity and drifts the rest.
import { createRng, mix32, type Rng } from './prng';
import { generateGraph, validateGraph, computeDepth, type Graph } from './graph';
import { layoutCircles, clamp } from './geometry';
import { nodeHue, pickMode, type PaletteMode, wrapHue } from './color';
import type { WireStyle } from './wire';

export interface KindInfo { kind: string; tags: string[]; weight: number; nominal: number; role: 'machine' | 'and' | 'arbiter' | 'finale' }

export interface PlanNode { id: number; type: string; kind: string; cx: number; cy: number; r: number; rot: number; hue: number; hue2: number; depth: number; ports: number }
export interface PlanWire { from: number; to: number; port: number; back: boolean; style: WireStyle }
export interface Plan {
  cycle: number; seed: number; W: number; H: number;
  graph: Graph; nodes: PlanNode[]; wires: PlanWire[];
  mode: PaletteMode; baseHue: number; wobble: number; maxDepth: number; u: number; mutated: number;
}

export const unitScale = (W: number, H: number) => clamp(Math.min(W, H) / 820, 0.62, 1.5);

export function machineCountFor(W: number, H: number, cycle: number): number {
  const base = Math.sqrt(W * H) / 64;
  return clamp(Math.round(base * (cycle === 0 ? 0.9 : 1)), 8, 26);
}

export function planCycle(a: { seed: number; cycle: number; W: number; H: number; kinds: KindInfo[]; prev?: Plan | null; finalHue?: number }): Plan {
  const { seed, cycle, W, H, kinds, prev } = a;
  const rng = createRng(mix32(mix32(seed, cycle * 7919 + 17), Math.floor((a.finalHue ?? 0) * 100)));
  const machines = machineCountFor(W, H, cycle);

  let graph: Graph | null = null;
  for (let tries = 0; tries < 20 && !graph; tries++) {
    const g = generateGraph(rng.fork('graph' + tries), {
      machines,
      splits: clamp(Math.round(machines / 4.6) + rng.int(-1, 1), 2, 6),
      races: rng.int(0, 2),
      loops: cycle === 0 ? 1 : rng.int(1, 3),
    });
    if (!validateGraph(g).length) graph = g;
  }
  if (!graph) throw new Error('could not generate a valid graph');
  computeDepth(graph);
  const maxDepth = Math.max(...graph.nodes.map((n) => n.depth));

  // ---- palette ----
  const baseHue = cycle === 0 || !prev ? rng.range(0, 360) : wrapHue(prev.baseHue + rng.range(28, 92));
  const mode = pickMode(rng, prev?.mode);

  // ---- kinds ----
  const machineKinds = kinds.filter((k) => k.role === 'machine');
  const ands = kinds.filter((k) => k.role === 'and');
  const arbs = kinds.filter((k) => k.role === 'arbiter');
  const fin = kinds.find((k) => k.role === 'finale')!;
  const used = new Map<string, number>();
  const kindOf: string[] = new Array(graph.nodes.length);
  // topological-ish order for assignment: by depth then id
  const order = [...graph.nodes].sort((x, y) => x.depth - y.depth || x.id - y.id);
  const prevByRank = prev ? [...prev.nodes].filter((n) => n.type === 'machine' || n.type === 'source').sort((x, y) => x.depth - y.depth || x.id - y.id) : [];
  let rank = 0, mutated = 0;
  const pickFor = (pool: KindInfo[], want: string[], frac: number, prevKind?: string): KindInfo => {
    const cands = pool.filter((k) => (used.get(k.kind) ?? 0) < 2);
    const pref = cands.filter((k) => want.some((t) => k.tags.includes(t)));
    const bag = pref.length && rng.chance(0.8) ? pref : cands.length ? cands : pool;
    let k = rng.pick(bag);
    if (k.kind === prevKind) k = rng.pick(bag);
    return k;
  };
  let lastKind = '';
  for (const n of order) {
    const frac = maxDepth ? n.depth / maxDepth : 0;
    let k: KindInfo;
    if (n.type === 'finale') k = fin;
    else if (n.type === 'and') k = rng.pick(ands);
    else if (n.type === 'arbiter') k = rng.pick(arbs);
    else {
      const pk = prevByRank[rank++];
      const keep = pk && rng.chance(0.55) && machineKinds.some((m) => m.kind === pk.kind) && (used.get(pk.kind) ?? 0) < 2;
      if (keep) k = machineKinds.find((m) => m.kind === pk.kind)!;
      else {
        mutated++;
        const want = n.type === 'source' ? ['start'] : frac < 0.14 ? ['slow', 'start'] : frac > 0.66 && frac < 0.85 ? ['slow'] : frac > 0.85 ? ['fast', 'big'] : [];
        k = pickFor(machineKinds, want, frac, lastKind);
      }
      lastKind = k.kind;
    }
    kindOf[n.id] = k.kind;
    used.set(k.kind, (used.get(k.kind) ?? 0) + 1);
  }
  const info = new Map(kinds.map((k) => [k.kind, k]));

  // ---- radii + layout ----
  const N = graph.nodes.length;
  const cell = Math.sqrt((W * H) / N);
  const u = unitScale(W, H);
  const r: number[] = graph.nodes.map((n) => {
    const w = info.get(kindOf[n.id])!.weight;
    let base = cell * 0.46 * Math.sqrt(w) * rng.range(0.82, 1.18);
    if (n.type === 'finale') base = cell * 0.62;
    if (n.type === 'and' || n.type === 'arbiter') base *= 0.72;
    return clamp(base, 38, Math.min(W, H) * 0.34);
  });
  const f = graph.nodes.map((n) => (maxDepth ? n.depth / maxDepth : 0));
  const lane = graph.nodes.map((n) => n.lane);
  const edges = graph.edges.filter((e) => !e.back).map((e) => [e.from, e.to] as [number, number]);
  const pos = layoutCircles({ W, H, f, lane, r, edges, rng: rng.fork('layout'), margin: Math.min(W, H) * 0.015 });

  // ---- hues, wires ----
  const hues = graph.nodes.map((n) => nodeHue(mode, baseHue, f[n.id], rng));
  const nodes: PlanNode[] = graph.nodes.map((n) => {
    const succ = graph.edges.find((e) => e.from === n.id && !e.back);
    return {
      id: n.id, type: n.type, kind: kindOf[n.id], cx: pos[n.id].x, cy: pos[n.id].y, r: r[n.id],
      rot: rng.range(-0.5, 0.5) + (rng.chance(0.18) ? Math.PI / 2 : 0), hue: hues[n.id], hue2: succ ? hues[succ.to] : hues[n.id] + 30,
      depth: n.depth, ports: n.ports,
    };
  });
  const wires: PlanWire[] = graph.edges.map((e) => ({
    from: e.from, to: e.to, port: e.port, back: e.back,
    style: e.back ? 'rail' : rng.pick<WireStyle>(['pips', 'pips', 'pips', 'rail', 'slider']),
  }));
  return { cycle, seed, W, H, graph, nodes, wires, mode, baseHue, wobble: rng.range(0, 6.28), maxDepth, u, mutated };
}
