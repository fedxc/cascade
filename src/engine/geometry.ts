// PURE geometry: curves, arc-length sampling, hex lattices, circle-packing force layout.
import type { Rng } from './prng';

export interface Pt { x: number; y: number }
export interface PtA extends Pt { a: number } // a = tangent angle (radians)

export const TAU = Math.PI * 2;
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => t * t * (3 - 2 * t);
export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
export const rotPt = (x: number, y: number, a: number): Pt => {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: x * c - y * s, y: x * s + y * c };
};

export function bezier(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y };
}

/** sample a parametric curve f(t), t∈[0,1], at ~equal arc-length spacing. Returns points with tangent angle. */
export function sampleByArc(f: (t: number) => Pt, spacing: number, opts: { max?: number; fine?: number } = {}): PtA[] {
  const fine = opts.fine ?? Math.min(6000, Math.max(400, Math.ceil((curveLength(f, 120) / spacing) * 8)));
  const pts: Pt[] = [];
  const cum: number[] = [0];
  for (let i = 0; i <= fine; i++) {
    const p = f(i / fine);
    pts.push(p);
    if (i) cum.push(cum[i - 1] + dist(pts[i - 1], p));
  }
  const total = cum[fine];
  let n = Math.max(2, Math.round(total / spacing) + 1);
  if (opts.max) n = Math.min(n, opts.max);
  const out: PtA[] = [];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const target = (total * k) / (n - 1);
    while (j < fine - 1 && cum[j + 1] < target) j++;
    const seg = cum[j + 1] - cum[j] || 1;
    const u = clamp((target - cum[j]) / seg, 0, 1);
    const p = { x: lerp(pts[j].x, pts[j + 1].x, u), y: lerp(pts[j].y, pts[j + 1].y, u) };
    const a = Math.atan2(pts[j + 1].y - pts[j].y, pts[j + 1].x - pts[j].x);
    out.push({ ...p, a });
  }
  return out;
}

export function curveLength(f: (t: number) => Pt, steps = 200): number {
  let L = 0, prev = f(0);
  for (let i = 1; i <= steps; i++) { const p = f(i / steps); L += dist(prev, p); prev = p; }
  return L;
}

// ---- named shapes (all return f(t) with t in [0,1]) ----
export const spiralFn = (r0: number, r1: number, turns: number, a0 = 0) => (t: number): Pt => {
  const r = lerp(r0, r1, t), a = a0 + t * turns * TAU;
  return { x: Math.cos(a) * r, y: Math.sin(a) * r };
};
export const lissajousFn = (rx: number, ry: number, fa: number, fb: number, ph: number) => (t: number): Pt => ({
  x: Math.sin(t * TAU * fa + ph) * rx, y: Math.sin(t * TAU * fb) * ry,
});
export const eightFn = (rx: number, ry: number) => (t: number): Pt => ({ x: Math.sin(t * TAU) * rx, y: Math.sin(t * TAU) * Math.cos(t * TAU) * ry * 1.6 });
export const arcFn = (r: number, a0: number, a1: number) => (t: number): Pt => {
  const a = lerp(a0, a1, t);
  return { x: Math.cos(a) * r, y: Math.sin(a) * r };
};
export const waveFn = (len: number, amp: number, cycles: number) => (t: number): Pt => ({
  x: (t - 0.5) * len, y: Math.sin(t * TAU * cycles) * amp,
});
export const lineFn = (len: number) => (t: number): Pt => ({ x: (t - 0.5) * len, y: 0 });

/** jittered hex lattice covering [0,W]x[0,H] */
export function hexLattice(W: number, H: number, spacing: number, jitter: number, rng: Rng): Pt[] {
  const pts: Pt[] = [];
  const dy = spacing * 0.866;
  let row = 0;
  for (let y = -dy; y < H + dy; y += dy, row++) {
    const off = row % 2 ? spacing / 2 : 0;
    for (let x = -spacing + off; x < W + spacing; x += spacing) {
      pts.push({ x: x + rng.range(-jitter, jitter) * spacing, y: y + rng.range(-jitter, jitter) * spacing });
    }
  }
  return pts.filter((p) => p.x >= 0 && p.x <= W && p.y >= 0 && p.y <= H);
}

// ---- flow skeleton + layout ----

/** a gently S-curved path across the long axis; f∈[0,1] */
export function skeleton(W: number, H: number, rng: Rng): { at: (f: number) => Pt; normal: (f: number) => Pt; kind: string } {
  const landscape = W >= H;
  const m = Math.min(W, H) * 0.12;
  const waves = rng.pick([0.75, 1, 1.25, 1.5]);
  const ph = rng.range(0, TAU);
  const amp = (landscape ? H : W) * rng.range(0.16, 0.3);
  const raw = (f: number): Pt => {
    const along = lerp(m, (landscape ? W : H) - m, f);
    const side = Math.sin(f * TAU * waves + ph) * amp * (0.35 + 0.65 * Math.sin(Math.PI * clamp(f, 0.0, 1))) + ((landscape ? H : W) / 2);
    return landscape ? { x: along, y: side } : { x: side, y: along };
  };
  const normal = (f: number): Pt => {
    const a = raw(clamp(f - 0.01, 0, 1)), b = raw(clamp(f + 0.01, 0, 1));
    const tx = b.x - a.x, ty = b.y - a.y, l = Math.hypot(tx, ty) || 1;
    return { x: -ty / l, y: tx / l };
  };
  return { at: raw, normal, kind: landscape ? 'landscape' : 'portrait' };
}

export interface LayoutIn {
  W: number; H: number;
  f: number[];        // 0..1 progress along skeleton per node
  lane: number[];     // lateral offset in [-1,1]-ish per node
  r: number[];        // radii
  edges: [number, number][];
  rng: Rng;
  margin?: number;
}

/** relaxes circles along the skeleton; returns centres. Deterministic for a given rng. */
export function layoutCircles(inp: LayoutIn): Pt[] {
  const { W, H, f, lane, r, edges, rng } = inp;
  const n = f.length;
  const sk = skeleton(W, H, rng);
  const landscape = W >= H;
  const spread = (landscape ? H : W) * 0.34;
  const pos: Pt[] = [];
  const home: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const p = sk.at(f[i]), nrm = sk.normal(f[i]);
    const h = { x: p.x + nrm.x * lane[i] * spread, y: p.y + nrm.y * lane[i] * spread };
    home.push(h);
    pos.push({ x: h.x + rng.range(-8, 8), y: h.y + rng.range(-8, 8) });
  }
  const gap = Math.min(W, H) * 0.012;
  const mg = inp.margin ?? 0;
  const bound = (i: number) => {
    const lo = r[i] * 0.78 + mg;
    pos[i].x = clamp(pos[i].x, lo, W - lo);
    pos[i].y = clamp(pos[i].y, lo, H - lo);
  };
  const relax = (iters: number, spring: number, homeK: number) => {
    for (let it = 0; it < iters; it++) {
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const dx = pos[j].x - pos[i].x, dy = pos[j].y - pos[i].y;
          const d = Math.hypot(dx, dy) || 0.001;
          const want = (r[i] + r[j]) * 0.92 + gap;
          if (d < want) {
            const push = (want - d) * 0.5, ux = dx / d, uy = dy / d;
            pos[i].x -= ux * push; pos[i].y -= uy * push;
            pos[j].x += ux * push; pos[j].y += uy * push;
          }
        }
      }
      for (const [a, b] of edges) {
        const dx = pos[b].x - pos[a].x, dy = pos[b].y - pos[a].y;
        const d = Math.hypot(dx, dy) || 0.001;
        const rest = (r[a] + r[b]) * 1.25 + gap * 3;
        const k = (d - rest) * spring;
        pos[a].x += (dx / d) * k; pos[a].y += (dy / d) * k;
        pos[b].x -= (dx / d) * k; pos[b].y -= (dy / d) * k;
      }
      for (let i = 0; i < n; i++) {
        pos[i].x += (home[i].x - pos[i].x) * homeK;
        pos[i].y += (home[i].y - pos[i].y) * homeK;
        bound(i);
      }
    }
  };
  relax(260, 0.02, 0.02);
  // stretch bounding box to fill the viewport, then settle again
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    minX = Math.min(minX, pos[i].x - r[i]); maxX = Math.max(maxX, pos[i].x + r[i]);
    minY = Math.min(minY, pos[i].y - r[i]); maxY = Math.max(maxY, pos[i].y + r[i]);
  }
  const sx = clamp((W - 2 * mg) / Math.max(1, maxX - minX), 0.8, 1.7);
  const sy = clamp((H - 2 * mg) / Math.max(1, maxY - minY), 0.8, 1.7);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  for (let i = 0; i < n; i++) {
    pos[i].x = W / 2 + (pos[i].x - cx) * sx;
    pos[i].y = H / 2 + (pos[i].y - cy) * sy;
    home[i] = { ...pos[i] };
    bound(i);
  }
  relax(160, 0.012, 0.01);
  return pos;
}

/** density field in [0,1] used to cull the lattice: blobs + skeleton falloff + deliberate voids */
export function densityField(W: number, H: number, rng: Rng, sk: ReturnType<typeof skeleton>) {
  const blobs = Array.from({ length: 5 }, () => ({
    x: rng.range(0, W), y: rng.range(0, H), r: rng.range(0.16, 0.34) * Math.min(W, H) * 1.5, k: rng.range(-0.55, 0.9),
  }));
  const samples: Pt[] = Array.from({ length: 24 }, (_, i) => sk.at(i / 23));
  return (x: number, y: number): number => {
    let v = 0.62;
    for (const b of blobs) {
      const d = Math.hypot(x - b.x, y - b.y) / b.r;
      v += b.k * Math.exp(-d * d);
    }
    let md = Infinity;
    for (const s of samples) md = Math.min(md, Math.hypot(x - s.x, y - s.y));
    v += 0.35 * Math.exp(-Math.pow(md / (Math.min(W, H) * 0.3), 2));
    return clamp(v, 0.06, 1);
  };
}

/** overlap measure for tests: max over pairs of (r_i + r_j - d) / min(r_i, r_j) */
export function maxOverlap(pos: Pt[], r: number[]): number {
  let m = 0;
  for (let i = 0; i < pos.length; i++)
    for (let j = i + 1; j < pos.length; j++) {
      const d = dist(pos[i], pos[j]);
      m = Math.max(m, (r[i] + r[j] - d) / Math.min(r[i], r[j]));
    }
  return m;
}

/** fit a parametric curve inside a circle of radius R (centred on the origin) */
export function fitShape(f: (t: number) => Pt, R: number): (t: number) => Pt {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i <= 200; i++) {
    const p = f(i / 200);
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  let mr = 1e-6;
  for (let i = 0; i <= 200; i++) { const p = f(i / 200); mr = Math.max(mr, Math.hypot(p.x - cx, p.y - cy)); }
  const k = R / mr;
  return (t) => { const p = f(t); return { x: (p.x - cx) * k, y: (p.y - cy) * k }; };
}
