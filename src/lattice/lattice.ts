// The background field: a few thousand tiny checkboxes and radios on a jittered hex lattice,
// culled by a density field so there is negative space. Every `ping` is a real click on the nearest
// checkbox; a single delegated `change` listener turns it into an expanding ring of light.
import type { Clock } from '../engine/clock';
import { Rng } from '../engine/prng';
import { densityField, hexLattice, skeleton, clamp } from '../engine/geometry';
import { hsl } from '../engine/color';

interface Cell { el: HTMLInputElement; x: number; y: number; rank: number; kind: 0 | 1; exp: number }
interface Wave { x: number; y: number; hue: number; born: number; speed: number; maxR: number; k: number; last: number; spin: number; big?: boolean }

const BUCKET = 48;

export class Lattice {
  host: HTMLElement;
  cells: Cell[] = [];
  private buckets = new Map<number, Cell[]>();
  private waves: Wave[] = [];
  private queue: Cell[] = [];
  private qExp: number[] = [];
  private qHead = 0;
  private pending = new Map<HTMLInputElement, { hue: number; k: number }>();
  private cellOf = new WeakMap<HTMLInputElement, Cell>();
  level = 0; // 0 = everything, higher = fewer cells
  private slow = 0; private fast = 0;
  private onChange: (e: Event) => void;
  private lightBudget = 0;
  hue = 250;
  frameLights = 0;

  constructor(private parent: HTMLElement, private clock: Clock, private rng: Rng, public W: number, public H: number) {
    this.host = document.createElement('div');
    this.host.className = 'layer';
    parent.appendChild(this.host);
    this.build();
    this.onChange = (e: Event) => {
      const t = e.target as HTMLInputElement;
      const p = this.pending.get(t);
      if (!p || !t.checked) return;
      this.pending.delete(t);
      const c = this.cellOf.get(t)!;
      this.startWave(c.x, c.y, p.hue, p.k);
      this.enqueue(c, p.hue, 1);
    };
    this.host.addEventListener('change', this.onChange);
    clock.onFrame.push(this.frameFn);
  }

  private frameFn = (_dt: number, now: number) => this.frame(now);

  private build() {
    const { W, H } = this;
    const rng = this.rng.fork('lattice');
    const target = clamp((W * H) / 460, 650, 3300);
    const spacing = Math.sqrt((W * H * 0.8) / (0.866 * target));
    const sk = skeleton(W, H, rng.fork('sk'));
    const dens = densityField(W, H, rng.fork('dens'), sk);
    const pts = hexLattice(W, H, spacing, 0.28, rng);
    const frag = document.createDocumentFragment();
    let ri = 0;
    const kinds: boolean[] = [];
    for (const p of pts) {
      if (rng.next() > dens(p.x, p.y)) continue;
      const radio = rng.chance(0.3);
      const el = document.createElement('input');
      el.type = radio ? 'radio' : 'checkbox';
      el.tabIndex = -1;
      el.className = 'lt' + (radio ? ' r' : rng.chance(0.5) ? ' d' : '');
      if (radio) el.name = 'L' + (ri++ >> 2);
      el.style.transform = `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px)`;
      const cell: Cell = { el, x: p.x, y: p.y, rank: rng.next(), kind: radio ? 1 : 0, exp: 0 };
      this.cells.push(cell);
      this.cellOf.set(el, cell);
      frag.appendChild(el);
      kinds.push(radio);
      const key = this.key(p.x, p.y);
      let b = this.buckets.get(key);
      if (!b) this.buckets.set(key, (b = []));
      b.push(cell);
    }
    this.host.appendChild(frag);
    this.setHue(this.hue);
  }

  private key(x: number, y: number) { return Math.floor(x / BUCKET) * 4096 + Math.floor(y / BUCKET); }

  setHue(h: number) { this.hue = h; this.host.style.setProperty('--lh', h.toFixed(0)); }

  /** adaptive density: 0 = all, 1 = 70 %, 2 = 50 %, 3 = 33 % */
  setLevel(l: number) {
    l = clamp(l, 0, 3);
    if (l === this.level) return;
    this.level = l;
    const keep = [1, 0.7, 0.5, 0.33][l];
    for (const c of this.cells) c.el.classList.toggle('h', c.rank > keep);
  }

  /** report frame cost; the governor lowers density when we're slow and restores it when we're not */
  governor(frameMs: number) {
    if (frameMs > 24) { this.slow++; this.fast = 0; } else if (frameMs < 15.5) { this.fast++; this.slow = 0; } else { this.slow = 0; this.fast = 0; }
    if (this.slow > 90 && this.level < 3) { this.setLevel(this.level + 1); this.slow = 0; }
    if (this.fast > 900 && this.level > 0) { this.setLevel(this.level - 1); this.fast = 0; }
  }

  private nearest(x: number, y: number, kind: 0 | 1 | -1 = -1): Cell | null {
    const bx = Math.floor(x / BUCKET), by = Math.floor(y / BUCKET);
    let best: Cell | null = null, bd = Infinity;
    for (let r = 0; r < 4 && !best; r++) {
      for (let i = bx - r; i <= bx + r; i++)
        for (let j = by - r; j <= by + r; j++) {
          const b = this.buckets.get(i * 4096 + j);
          if (!b) continue;
          for (const c of b) {
            if ((kind >= 0 && c.kind !== kind) || c.rank > [1, 0.7, 0.5, 0.33][this.level]) continue;
            const d = (c.x - x) ** 2 + (c.y - y) ** 2;
            if (d < bd) { bd = d; best = c; }
          }
        }
    }
    return best;
  }

  /** the entry point for all activity: a real click on the nearest checkbox cell */
  ping(x: number, y: number, hue: number, k: number) {
    if (this.waves.length > 16 && k < 0.5) return;
    const c = this.nearest(x, y, 0);
    if (!c) return;
    if (c.el.checked) c.el.checked = false;
    this.pending.set(c.el, { hue, k: clamp(k, 0.05, 1) });
    c.el.click();
  }

  private startWave(x: number, y: number, hue: number, k: number) {
    const tiny = k < 0.16;
    this.waves.push({
      x, y, hue, born: this.clock.now,
      speed: tiny ? 120 : 160 + k * 480,
      maxR: tiny ? 34 : 50 + k * 320,
      k, last: 0, spin: (k > 0.7 ? 0.09 : 0.03),
    });
    if (this.waves.length > 22) this.waves.shift();
  }

  /** screen-wide detonation: concentric multi-hue rings from (x,y) and echoes from the corners */
  boom(x: number, y: number, hue: number) {
    const R = Math.hypot(this.W, this.H);
    for (let i = 0; i < 6; i++) {
      this.waves.push({
        x, y, hue: hue + i * 52, born: this.clock.now + i * 170, speed: 620 + i * 70, maxR: R, k: 1, last: 0, spin: 0.14, big: true,
      });
    }
    for (const [cx, cy] of [[0, 0], [this.W, 0], [0, this.H], [this.W, this.H]]) {
      this.waves.push({ x: cx, y: cy, hue: hue + 180, born: this.clock.now + 650, speed: 760, maxR: R, k: 0.9, last: 0, spin: 0.1, big: true });
    }
  }

  private enqueue(c: Cell, hue: number, k: number, big = false) {
    c.exp = this.clock.now + (big ? 650 + k * 500 : 200 + k * 300);
    c.el.style.scale = big ? String(2.2 + k * 1.6) : '';
    c.el.style.setProperty('--lc', hsl(hue, 90, 66));
    c.el.checked = true;
    this.queue.push(c);
    this.qExp.push(c.exp);
  }

  private frame(now: number) {
    this.lightBudget = this.waves.some((w) => w.big) ? 650 : 420;
    this.frameLights = 0;
    const lv = [1, 0.7, 0.5, 0.33][this.level];
    for (let wi = this.waves.length - 1; wi >= 0; wi--) {
      const w = this.waves[wi];
      const age = now - w.born;
      if (age < 0) continue;
      const r = (w.speed * age) / 1000;
      if (r - w.last > 0) {
        const lo = w.last, hi = r;
        const mx = w.maxR;
        for (const c of this.cells) {
          if (c.rank > lv) continue;
          const dx = c.x - w.x, dy = c.y - w.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < lo * lo || d2 > hi * hi) continue;
          if (this.lightBudget <= 0) break;
          const d = Math.sqrt(d2);
          const fall = 1 - d / mx;
          if (fall <= 0) continue;
          const keep = w.k * fall;
          if (w.k < 0.95 && ((c.rank * 977) % 1) > 0.25 + keep * 0.6) continue; // thin the ring so it reads as sparkle, not fill
          this.lightBudget--;
          this.frameLights++;
          this.enqueue(c, w.hue + d * w.spin, keep, w.big);
        }
        w.last = r;
      }
      if (w.last >= w.maxR) this.waves.splice(wi, 1);
    }
    // decay: FIFO, entries carry their own expiry; stale entries (cell re-lit later) are skipped
    while (this.qHead < this.queue.length && this.qExp[this.qHead] <= now) {
      const c = this.queue[this.qHead++];
      if (c.exp <= now) { c.el.checked = false; c.el.style.scale = ''; }
    }
    if (this.qHead > 512) { this.queue = this.queue.slice(this.qHead); this.qExp = this.qExp.slice(this.qHead); this.qHead = 0; }
  }

  dispose() {
    this.clock.onFrame = this.clock.onFrame.filter((f) => f !== this.frameFn);
    this.host.removeEventListener('change', this.onChange);
    this.host.remove();
    this.cells = [];
    this.buckets.clear();
    this.waves = [];
    this.queue = [];
    this.qExp = [];
    this.pending.clear();
  }
}
