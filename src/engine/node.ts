// Runtime node: wraps a Machine with token logic (AND / arbiter), a watchdog and forwarding to wires.
import type { Machine } from './types';
import type { Scope } from './scope';
import type { Clock, Handle } from './clock';
import type { GNode, GEdge } from './graph';
import type { Wire } from './wire';
import { poke } from './kit';
import type { Pt } from './geometry';

export interface NodeHooks {
  tempo: () => number;
  watchdogOn: () => boolean;
  onStart: (n: RNode) => void;
  onDone: (n: RNode, forced: boolean) => void;
  log: (s: string) => void;
}

export const stats = { forced: 0, runs: 0, dropped: 0, collisions: 0 };

export class RNode {
  state: 'idle' | 'running' | 'done' = 'idle';
  runs = 0;
  forced = 0;
  passes = 0;
  spent = false;
  arrived: boolean[];
  arrivedCount = 0;
  outs: { wire: Wire; edge: GEdge }[] = [];
  private wd: Handle | null = null;
  private wasForced = false;
  world: Pt;
  rot: number;
  lastEvent = 0;
  kind: string;

  constructor(
    readonly g: GNode, readonly machine: Machine, readonly scope: Scope, readonly clock: Clock,
    readonly hooks: NodeHooks, public cx: number, public cy: number, rot: number, public hue: number, kind: string,
  ) {
    this.world = { x: cx, y: cy };
    this.rot = rot;
    this.kind = kind;
    this.arrived = new Array(g.ports).fill(false);
    scope.on(machine.exit.el, machine.exit.type, this.onExit);
  }

  private onExit = () => {
    if (this.state !== 'running') return;
    this.state = 'done';
    this.clearWd();
    this.lastEvent = this.clock.now;
    if (this.g.type === 'arbiter') this.spent = true;
    if (this.g.type === 'and') { this.arrived.fill(false); this.arrivedCount = 0; }
    this.hooks.onDone(this, this.wasForced);
    this.wasForced = false;
    const back = this.outs.filter((o) => o.edge.back);
    const fwd = this.outs.filter((o) => !o.edge.back);
    if (back.length && this.passes < back[0].edge.passes) {
      this.passes++;
      this.hooks.log(`#${this.g.id} loop pass ${this.passes}`);
      for (const b of back) b.wire.send(() => b.edge && this.target(b.edge)?.receive(b.edge.port));
      return;
    }
    for (const f of fwd) f.wire.send(() => this.target(f.edge)?.receive(f.edge.port));
  };

  /** resolved by the director after all nodes exist */
  private targets = new Map<GEdge, RNode>();
  link(edge: GEdge, n: RNode) { this.targets.set(edge, n); }
  private target(e: GEdge) { return this.targets.get(e); }

  receive(port: number) {
    const t = this.g.type;
    this.lastEvent = this.clock.now;
    if (t === 'and') {
      if (this.arrived[port]) return;
      if (this.arrivedCount === 0) { this.machine.reset(); this.state = 'running'; this.runs++; stats.runs++; this.hooks.onStart(this); }
      this.arrived[port] = true;
      this.arrivedCount++;
      poke(this.machine.entries[port]);
      if (this.arrivedCount === this.g.ports) this.armWd();
      return;
    }
    if (t === 'arbiter') {
      if (this.spent || this.state === 'running') { stats.collisions++; this.machine.collide?.(port); return; }
      this.machine.reset();
      this.state = 'running'; this.runs++; stats.runs++;
      this.hooks.onStart(this);
      this.armWd();
      poke(this.machine.entries[port]);
      return;
    }
    if (this.state === 'running') return; // re-entry while running is ignored
    this.machine.reset();
    this.state = 'running';
    this.hooks.onStart(this);
    this.armWd();
    // a run only counts if the entry control actually took the poke (a disabled / detached entry never starts anything)
    if (poke(this.machine.entries[Math.min(port, this.machine.entries.length - 1)])) { this.runs++; stats.runs++; }
  }

  private armWd() {
    this.clearWd();
    const tempo = Math.max(0.3, this.hooks.tempo());
    const ms = this.machine.slow ? this.machine.budgetMs * 2.2 + 9000 : (this.machine.budgetMs * 3) / tempo + 9000;
    this.wd = this.clock.after(ms, () => {
      this.wd = null;
      if (this.state !== 'running' || !this.hooks.watchdogOn()) return;
      this.forced++; stats.forced++;
      this.wasForced = true;
      this.hooks.log(`WATCHDOG #${this.g.id} ${this.kind}`);
      this.machine.reset();
      this.state = 'running';
      this.machine.exit.el.dispatchEvent(new Event(this.machine.exit.type, { bubbles: true }));
    });
  }
  private clearWd() { if (this.wd) { this.wd.cancelled = true; this.wd = null; } }

  /** convert a local machine point to world coordinates */
  toWorld(p: Pt): Pt {
    const c = Math.cos(this.rot), s = Math.sin(this.rot);
    return { x: this.cx + p.x * c - p.y * s, y: this.cy + p.x * s + p.y * c };
  }
  dispose() { this.clearWd(); }
}
