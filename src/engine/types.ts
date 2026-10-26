import type { Rng } from './prng';
import type { Scope } from './scope';
import type { Pt } from './geometry';

export interface Machine {
  /** poke(entries[i]) starts the contraption on port i (AND/arbiter have several) */
  entries: HTMLElement[];
  /** the event that means "done" — wires listen to it */
  exit: { el: HTMLElement; type: string };
  entryPts: Pt[];   // local coordinates (relative to the machine centre, before rotation)
  exitPt: Pt;
  /** silent state reset (property writes only — must not dispatch events) */
  reset(): void;
  /** finale flourish; delay in ms */
  flourish?(delay: number): void;
  /** nominal duration at tempo 1, ms — the watchdog is derived from it */
  budgetMs: number;
  /** slow fuses ignore tempo */
  slow?: boolean;
  /** arbiter loser */
  collide?(port: number): void;
  /** called after build once the host is attached (size-dependent measurement) */
  ready?(): void;
}

export interface Ctx {
  host: HTMLElement;
  r: number;            // footprint radius in px
  u: number;            // unit scale: 1 at ~900px screens
  rng: Rng;
  hue: number;          // node hue
  hue2: number;         // hue of the next stage (for gradients)
  scope: Scope;
  tempo: () => number;
  ports: number;
  /** clock time-scale (1 in normal runs); CSS-driven durations divide by it */
  ts: number;
  /** register a hit in local coordinates: feeds the lattice and the audio engine */
  hit(x: number, y: number, strength?: number, note?: number): void;
  /** world → used by finale */
  world: { W: number; H: number; cx: number; cy: number; rot: number };
  /** current palette hues for global effects */
  fx: Fx;
  kind: string;
}

export interface Fx {
  ping(wx: number, wy: number, hue: number, strength: number): void;
  voice(kind: string, note: number, wx: number, wy: number, vel: number): void;
  /** screen-wide detonation */
  boom(wx: number, wy: number, hue: number): void;
  shake(wx: number, wy: number, hue: number): void;
}

export interface Contraption {
  kind: string;
  role?: 'machine' | 'and' | 'arbiter' | 'finale';
  /** 'slow' kinds make good wind-up / hush fuses; 'start' kinds suit being the source; 'any' default */
  tags?: ('start' | 'slow' | 'fast' | 'big' | 'tall')[];
  /** relative footprint weight (default 1); `aspect` hints for layout */
  weight?: number;
  /** how many ms this typically takes at tempo 1 (planner uses it to balance) */
  nominal: number;
  build(c: Ctx): Machine;
}
