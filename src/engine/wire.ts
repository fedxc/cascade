// Wires: visible carriers that walk a pulse from one contraption's exit event to the next one's entry.
// Every hop of the pulse is a DOM event on a real control, handled by a listener that pokes the next one.
import type { Scope } from './scope';
import type { Rng } from './prng';
import { sampleByArc, bezier, type Pt, type PtA, lerp } from './geometry';
import { checkbox, radio, progress, range, poke, emit, setRange, mk, setHue } from './kit';
import { ease } from './clock';

export type WireStyle = 'pips' | 'rail' | 'slider';

export interface WireOpts {
  host: HTMLElement; scope: Scope; rng: Rng; from: Pt; to: Pt; dirOut: Pt; dirIn: Pt;
  hueA: number; hueB: number; style: WireStyle; u: number; back?: boolean;
  ping: (x: number, y: number, hue: number, k: number) => void;
  voice: (x: number, y: number) => void;
}

export const hueLerp = (a: number, b: number, t: number) => {
  let d = ((b - a + 540) % 360) - 180;
  return a + d * t;
};

export class Wire {
  el: HTMLElement;
  elems: HTMLElement[] = [];
  path: PtA[] = [];
  busy = false;
  sends = 0;
  dropped = 0;
  private arrive: (() => void) | null = null;
  onArrive: (() => void) | null = null;
  style: WireStyle;
  length = 0;
  private sc: Scope;

  constructor(private o: WireOpts) {
    this.sc = o.scope;
    this.style = o.style;
    this.el = document.createElement('div');
    this.el.className = 'w' + (o.back ? ' back' : '');
    o.host.appendChild(this.el);
    const L = Math.hypot(o.to.x - o.from.x, o.to.y - o.from.y);
    const k = Math.max(30, L * 0.38);
    const swerve = o.rng.range(-0.28, 0.28) * L;
    const nrm = { x: -(o.to.y - o.from.y) / (L || 1), y: (o.to.x - o.from.x) / (L || 1) };
    const p1 = { x: o.from.x + o.dirOut.x * k + nrm.x * swerve, y: o.from.y + o.dirOut.y * k + nrm.y * swerve };
    const p2 = { x: o.to.x - o.dirIn.x * k + nrm.x * swerve * 0.6, y: o.to.y - o.dirIn.y * k + nrm.y * swerve * 0.6 };
    const f = (t: number) => bezier(o.from, p1, p2, o.to, t);
    const spacing = (o.style === 'pips' ? 10 : o.style === 'rail' ? 42 : 34) * o.u * (o.back ? 0.9 : 1);
    this.path = sampleByArc(f, spacing, { max: 220 });
    this.length = L;
    this.build();
  }

  private build() {
    const o = this.o, pts = this.path, n = pts.length;
    const hueAt = (i: number) => hueLerp(o.hueA, o.hueB, i / Math.max(1, n - 1));
    if (this.style === 'pips') {
      const s = Math.max(5, Math.round(6.5 * o.u));
      const round = o.rng.chance(0.35); // some wires are strings of radios (beads) instead of checkbox diamonds
      for (let i = 0; i < n; i++) {
        const e = round
          ? radio(this.el, { x: pts[i].x, y: pts[i].y, w: s + 1, h: s + 1, hue: hueAt(i), cls: 'soft' })
          : checkbox(this.el, { x: pts[i].x, y: pts[i].y, w: s, h: s, hue: hueAt(i), cls: 'soft', rot: pts[i].a + Math.PI / 4 });
        this.elems.push(e);
      }
      for (let i = 0; i < n; i++) {
        const e = this.elems[i] as HTMLInputElement;
        this.sc.on(e, 'change', () => {
          if (!e.checked) return;
          if (i % 9 === 4) o.ping(pts[i].x, pts[i].y, hueAt(i), 0.07);
          if (i % 23 === 11) o.voice(pts[i].x, pts[i].y);
          this.sc.after(380, () => { e.checked = false; }, true);
          if (i < n - 1) this.sc.after(this.hop(), () => { if (this.busy) poke(this.elems[i + 1]); });
          else this.land();
        });
      }
    } else {
      // segment carriers: progress rails or sliders laid along tangents; each segment's 'change' starts the next
      const segs = n - 1;
      for (let i = 0; i < segs; i++) {
        const a = pts[i], b = pts[i + 1];
        const len = Math.hypot(b.x - a.x, b.y - a.y) + 2;
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const hue = hueAt(i);
        const e = this.style === 'rail'
          ? progress(this.el, { x: mx, y: my, w: len, h: Math.max(3, 4 * o.u), rot: ang, hue, value: 0 })
          : range(this.el, { x: mx, y: my, w: len, h: 14, rot: ang, hue, value: 0, min: 0, max: 100, cls: 'dim' });
        this.elems.push(e);
      }
      this.elems.forEach((e, i) => {
        this.sc.on(e, 'change', () => {
          if (i % 5 === 2) o.ping(pts[i].x, pts[i].y, hueAt(i), 0.07);
          if (i < segs - 1) poke2(this.elems[i + 1]);
          else this.land();
        });
        this.sc.on(e, 'wire:go', () => this.fill(i, e));
      });
    }
  }

  private hop() { return 13 + this.o.rng.next() * 8; }

  private fill(i: number, e: HTMLElement) {
    if (!e.isConnected) return;
    const dur = 130 + this.o.rng.next() * 60;
    const isRail = this.style === 'rail';
    let fired = false;
    this.sc.tween(dur, (t) => {
      if (isRail) (e as HTMLProgressElement).value = t; else setRange(e as HTMLInputElement, t * 100, null);
      if (!fired && t >= 0.62) { fired = true; emit(e, 'change'); }
    }, () => {
      this.sc.tween(520, (t) => {
        const v = 1 - ease.out(t);
        if (isRail) (e as HTMLProgressElement).value = v; else setRange(e as HTMLInputElement, v * 100, null);
      });
    });
  }

  /** a wire segment 'receives' the pulse via a real, bubbling custom event on that segment */
  private land() {
    const cb = this.arrive;
    this.arrive = null;
    this.busy = false;
    if (cb) cb();
    this.onArrive?.();
  }

  send(arrive?: () => void) {
    if (this.busy) { this.dropped++; return; }
    this.busy = true;
    this.sends++;
    this.arrive = arrive ?? null;
    this.el.classList.add('flash');
    this.sc.after(300, () => this.el.classList.remove('flash'), true);
    if (this.style === 'pips') {
      for (const e of this.elems) (e as HTMLInputElement).checked = false;
      if (!poke(this.elems[0])) { /* broken wire: pulse dies here; watchdog will deal with it */ }
    } else {
      for (const e of this.elems) { if (this.style === 'rail') (e as HTMLProgressElement).value = 0; else setRange(e as HTMLInputElement, 0, null); }
      if (this.elems[0] && this.elems[0].isConnected && !(this.elems[0] as any).disabled) emit(this.elems[0], 'wire:go');
    }
  }

  /** whole-wire flash used by the finale */
  flashAll(delay: number) {
    this.sc.after(delay, () => {
      this.el.classList.add('flash');
      for (let i = 0; i < this.elems.length; i += 1) {
        const e = this.elems[i];
        if (this.style === 'pips') {
          this.sc.after(i * 6, () => { (e as HTMLInputElement).checked = true; this.sc.after(500, () => { (e as HTMLInputElement).checked = false; }, true); }, true);
        } else {
          this.sc.after(i * 6, () => { if (this.style === 'rail') (e as HTMLProgressElement).value = 1; else setRange(e as HTMLInputElement, 100, null); this.sc.after(500, () => { if (this.style === 'rail') (e as HTMLProgressElement).value = 0; else setRange(e as HTMLInputElement, 0, null); }, true); }, true);
        }
      }
      this.sc.after(900, () => this.el.classList.remove('flash'), true);
    }, true);
  }

  /** midpoint for debug */
  mid(): Pt { return this.path[Math.floor(this.path.length / 2)]; }
}

function poke2(e: HTMLElement) {
  if (!e || !e.isConnected || (e as any).disabled) return;
  emit(e, 'wire:go');
}
void lerp; void mk; void setHue;
