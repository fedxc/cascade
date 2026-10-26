// The cycle loop: plan → build → ignite → run → finale → stillness → rebirth. Owns the tempo, the veil and the fx bridge.
import { Clock } from './clock';
import { Scope, live } from './scope';
import { createRng, type Rng } from './prng';
import { planCycle, type Plan, type KindInfo } from './plan';
import { RNode, stats } from './node';
import { Wire, type WireOpts } from './wire';
import { tempoAt, dimAt, phaseAt } from './pacing';
import type { Contraption, Ctx, Fx, Machine } from './types';
import { Lattice } from '../lattice/lattice';
import { AudioEngine } from '../audio/audio';
import { REGISTRY, BY_KIND } from '../contraptions';
import { hsl } from './color';
import { clamp } from './geometry';
import { unitScale } from './plan';

export interface Params { seed: number; debug: boolean; ts: number; solo: string | null; nowd: boolean }

export class Director {
  clock = new Clock();
  audio = new AudioEngine();
  W = 0; H = 0;
  lattice!: Lattice;
  wiresHost!: HTMLElement;
  machinesHost!: HTMLElement;
  veil!: HTMLElement;
  flash!: HTMLElement;
  cycle = 0;
  plan: Plan | null = null;
  nodes: RNode[] = [];
  wires: Wire[] = [];
  private cscope: Scope | null = null;
  private tempoNow = 1;
  private tempoTarget = 1;
  progress = 0;
  private maxDone = 0;
  watchdog = true;
  logLines: string[] = [];
  carryHue = 0;
  igniteAt = 0;
  cycleStart = 0;
  phase = 'rebirth';
  cyclesDone = 0;
  finaleFired = false;
  private veilDim = 0;
  private resizeT: ReturnType<typeof setTimeout> | null = null;
  private kinds: KindInfo[];
  private fxo: Fx;
  onCycle?: (n: number) => void;

  constructor(readonly stage: HTMLElement, readonly p: Params) {
    this.clock.timeScale = p.ts;
    this.kinds = REGISTRY.map((c) => ({ kind: c.kind, tags: c.tags ?? [], weight: c.weight ?? 1, nominal: c.nominal, role: c.role ?? 'machine' }));
    this.fxo = {
      ping: (x, y, h, k) => this.lattice?.ping(x, y, h, k),
      voice: (kind, note, x, _y, vel) => this.audio.voice(kind, note, x / this.W, vel),
      boom: (x, y, h) => this.boom(x, y, h),
      shake: (x, y, h) => { this.lattice?.ping(x, y, h, 0.55); this.audio.voice('arbiter', 2, x / this.W, 1); },
    };
  }

  log = (s: string) => { this.logLines.push(`${(this.clock.now / 1000).toFixed(1)} ${s}`); if (this.logLines.length > 40) this.logLines.shift(); };

  tempo = () => this.tempoNow;

  boot() {
    this.measure();
    this.makeLayers();
    this.clock.onFrame.push(this.onFrame);
    this.clock.start();
    window.addEventListener('resize', this.onResize);
    if (this.p.solo) this.runSolo(this.p.solo, true);
    else this.startCycle(0);
  }

  private measure() { this.W = this.stage.clientWidth || window.innerWidth; this.H = this.stage.clientHeight || window.innerHeight; }

  private makeLayers() {
    const rng = createRng(this.p.seed);
    this.lattice?.dispose();
    this.lattice = new Lattice(this.stage, this.clock, rng.fork('lat'), this.W, this.H);
    this.wiresHost = document.createElement('div'); this.wiresHost.className = 'layer';
    this.machinesHost = document.createElement('div'); this.machinesHost.className = 'layer';
    this.stage.appendChild(this.wiresHost);
    this.stage.appendChild(this.machinesHost);
    if (!this.veil) {
      this.veil = document.createElement('div'); this.veil.id = 'veil';
      const vig = document.createElement('div'); vig.id = 'vig';
      this.flash = document.createElement('div'); this.flash.id = 'flash';
      this.stage.appendChild(this.veil); this.stage.appendChild(vig); this.stage.appendChild(this.flash);
    } else this.stage.appendChild(this.veil);
  }

  private onResize = () => {
    if (this.resizeT) clearTimeout(this.resizeT);
    this.resizeT = setTimeout(() => this.restart(), 350);
  };

  restart() {
    this.teardown();
    this.measure();
    this.stage.innerHTML = '';
    this.veil = undefined as any;
    this.flash = undefined as any;
    this.makeLayers();
    this.startCycle(this.cycle, true);
  }

  // ---------------------------------------------------------------- cycle
  startCycle(n: number, again = false) {
    this.teardown();
    this.cycle = n;
    const prev = again ? this.prevPlan : this.plan;
    if (!again) this.prevPlan = this.plan;
    const plan = planCycle({ seed: this.p.seed, cycle: n, W: this.W, H: this.H, kinds: this.kinds, prev: again ? this.prevPlan : prev, finalHue: this.carryHue });
    this.plan = plan;
    this.cscope = new Scope(this.clock, this.tempo);
    this.nodes = []; this.wires = [];
    this.progress = 0; this.maxDone = 0; this.tempoNow = 1; this.tempoTarget = 1;
    this.finaleFired = false; this.phase = 'rebirth';
    this.cycleStart = this.clock.now;
    this.lattice.setHue(plan.baseHue);
    this.audio.setKey(plan.baseHue, n);
    this.buildPlan(plan);
    this.log(`cycle ${n}: ${plan.nodes.length} nodes, mode ${plan.mode}, mutated ${plan.mutated}`);
    this.onCycle?.(n);
  }
  private prevPlan: Plan | null = null;

  private buildPlan(plan: Plan) {
    const cs = this.cscope!;
    const hooks = {
      tempo: this.tempo,
      watchdogOn: () => this.watchdog,
      onStart: (n: RNode) => { this.log(`▶ #${n.g.id} ${n.kind}`); },
      onDone: (n: RNode, forced: boolean) => this.nodeDone(n, forced),
      log: this.log,
    };
    const rngBase = createRng(this.p.seed ^ (plan.cycle * 2654435761));
    // machines
    for (const pn of plan.nodes) this.nodes.push(this.makeNode(pn, plan.graph.nodes[pn.id], plan.u, cs, hooks, rngBase));
    // wires
    for (let i = 0; i < plan.wires.length; i++) {
      const pw = plan.wires[i];
      const a = this.nodes[pw.from], b = this.nodes[pw.to];
      const from = a.toWorld(a.machine.exitPt);
      const to = b.toWorld(b.machine.entryPts[Math.min(pw.port, b.machine.entryPts.length - 1)]);
      const dir = (n: RNode, p: { x: number; y: number }) => {
        const dx = p.x - n.cx, dy = p.y - n.cy, l = Math.hypot(dx, dy) || 1;
        return { x: dx / l, y: dy / l };
      };
      const o: WireOpts = {
        host: this.wiresHost, scope: cs.child(), rng: rngBase.fork('w' + i), from, to,
        dirOut: dir(a, from), dirIn: dir(b, to), hueA: a.hue, hueB: b.hue, style: pw.style, u: plan.u, back: pw.back,
        ping: (x, y, h, k) => this.fxo.ping(x, y, h, k),
        voice: (x, y) => this.fxo.voice('wire', Math.floor(x / 40), x, y, 0.25),
      };
      const w = new Wire(o);
      this.wires.push(w);
      const edge = plan.graph.edges[i];
      a.outs.push({ wire: w, edge });
      a.link(edge, b);
    }
    // ambient life: idle machines breathe (CSS) and shed faint sparkles into the lattice now and then
    const ra = createRng(this.p.seed ^ 0x9e3779b9 ^ plan.cycle);
    for (const n of this.nodes) {
      const host = n.machine.entries[0].closest('.m') as HTMLElement;
      host.style.setProperty('--bd', `${(-ra.range(0, 7)).toFixed(2)}s`);
      const amb = () => cs.after(ra.range(4000, 11000), () => {
        if (this.phase === 'run' && n.state !== 'running') {
          const rr = this.plan!.nodes[n.g.id].r * 0.7;
          const p = n.toWorld({ x: ra.range(-rr, rr), y: ra.range(-rr, rr) });
          this.fxo.ping(p.x, p.y, n.hue, 0.05 + ra.next() * 0.05);
        }
        amb();
      }, true);
      amb();
    }
    // rebirth: fade in staggered, then ignite on the source's transitionend
    const src = this.nodes[plan.graph.source];
    this.nodes.forEach((n, i) => {
      cs.after(300 + i * 70, () => (n.machine.entries[0].closest('.m') as HTMLElement | null)?.classList.add('in'), true);
    });
    this.wires.forEach((w, i) => cs.after(500 + i * 60, () => w.el.classList.add('in'), true));
    const sh = src.machine.entries[0].closest('.m') as HTMLElement;
    let ignited = false;
    const go = () => {
      if (ignited) return;
      ignited = true;
      this.phase = 'run';
      this.igniteAt = this.clock.now;
      this.log('IGNITE');
      src.receive(0);
    };
    cs.on(sh, 'transitionend', (e: TransitionEvent) => { if (e.propertyName === 'opacity' && sh.classList.contains('in')) cs.after(plan.nodes.length * 70 + 1100, go, true); });
    cs.after(this.nodes.length * 70 + 4200, go, true); // fallback if transitions are suppressed (hidden tab)
  }


  private makeNode(pn: import('./plan').PlanNode, gn: import('./graph').GNode, u: number, cs: Scope, hooks: import('./node').NodeHooks, rngBase: Rng): RNode {
    const spec: Contraption = BY_KIND.get(pn.kind)!;
    const host = document.createElement('div');
    host.className = 'm idle';
    host.style.transform = `translate(${pn.cx.toFixed(1)}px,${pn.cy.toFixed(1)}px) rotate(${pn.rot.toFixed(4)}rad)`;
    host.style.setProperty('--h', pn.hue.toFixed(1));
    this.machinesHost.appendChild(host);
    const scope = cs.child();
    const c = Math.cos(pn.rot), s = Math.sin(pn.rot);
    const ctx: Ctx = {
      host, r: pn.r, u, rng: rngBase.fork('n' + pn.id), hue: pn.hue, hue2: pn.hue2, scope,
      tempo: this.tempo, ports: pn.ports, kind: pn.kind, fx: this.fxo, ts: this.clock.timeScale,
      world: { W: this.W, H: this.H, cx: pn.cx, cy: pn.cy, rot: pn.rot },
      hit: (x, y, k = 0.3, note = 0) => {
        const wx = pn.cx + x * c - y * s, wy = pn.cy + x * s + y * c;
        this.fxo.ping(wx, wy, pn.hue, k);
        this.fxo.voice(pn.kind, note, wx, wy, clamp(0.35 + k, 0, 1));
      },
    };
    let m: Machine;
    try { m = spec.build(ctx); } catch (e) { console.error('build failed', pn.kind, e); throw e; }
    m.ready?.();
    return new RNode(gn, m, scope, this.clock, hooks, pn.cx, pn.cy, pn.rot, pn.hue, pn.kind);
  }

  /** dev/test: run one contraption alone, in the centre. Resolves after the first completion. */
  runSolo(kind: string, loop = false): Promise<{ ms: number; forced: boolean; elements: number }> {
    this.teardown();
    this.solo = true;
    this.phase = 'solo';
    const spec = BY_KIND.get(kind);
    if (!spec) throw new Error('unknown kind ' + kind);
    const role = spec.role ?? 'machine';
    const ports = role === 'and' || role === 'arbiter' ? 2 : 1;
    const cs = (this.cscope = new Scope(this.clock, this.tempo));
    const r = Math.min(this.W, this.H) * 0.4;
    const pn = { id: 0, type: role === 'machine' ? 'source' : role, kind, cx: this.W / 2, cy: this.H / 2, r, rot: 0, hue: 190, hue2: 280, depth: 0, ports };
    const gn = { id: 0, type: pn.type as any, ports, depth: 0, lane: 0 };
    return new Promise((resolve) => {
      let t0 = 0;
      const hooks = {
        tempo: this.tempo, watchdogOn: () => this.watchdog, onStart: () => { t0 = this.clock.now; }, log: this.log,
        onDone: (_n: RNode, forced: boolean) => {
          resolve({ ms: this.clock.now - t0, forced, elements: this.machinesHost.querySelectorAll('*').length });
          if (loop) cs.after(1800, () => run(), true);
        },
      };
      const node = this.makeNode(pn, gn, this.plan?.u ?? unitScale(this.W, this.H), cs, hooks, createRng(this.p.seed));
      this.nodes = [node];
      const host = node.machine.entries[0].closest('.m') as HTMLElement;
      host.classList.add('in');
      const run = () => { for (let p = 0; p < ports; p++) cs.after(p * 400, () => node.receive(p), true); };
      cs.after(900, run, true);
    });
  }
  solo = false;

  private nodeDone(n: RNode, forced: boolean) {
    this.maxDone = Math.max(this.maxDone, n.g.depth + 1);
    const md = this.plan!.maxDepth;
    this.progress = clamp(this.maxDone / (md + 1), 0, 1);
    n.machine.entries[0].closest('.m')?.classList.remove('idle');
    if (n.g.type === 'finale') { this.afterFinale(); }
    if (forced) this.log(`forced exit #${n.g.id}`);
  }

  // ------------------------------------------------------------- finale
  private boom(x: number, y: number, hue: number) {
    if (this.finaleFired) return;
    this.finaleFired = true;
    this.phase = 'finale';
    this.log('BOOM');
    const cs = this.cscope!;
    this.lattice.boom(x, y, hue);
    this.audio.chord(0, 1);
    const f = this.flash;
    f.style.setProperty('--fx', x + 'px'); f.style.setProperty('--fy', y + 'px'); f.style.setProperty('--fh', String(Math.round(hue)));
    f.style.transition = 'none'; f.style.opacity = '1'; void f.offsetWidth; f.style.transition = 'opacity 2.2s ease-out'; f.style.opacity = '0';
    this.tempoTarget = 1;
    this.veilTo(0);
    for (const n of this.nodes) {
      if (n.g.type === 'finale') continue;
      const d = Math.hypot(n.cx - x, n.cy - y);
      const delay = d / 0.85;
      cs.after(delay, () => {
        const h = n.machine.entries[0].closest('.m') as HTMLElement;
        h.classList.remove('burst'); void h.offsetWidth; h.classList.add('burst');
        n.machine.flourish?.(0);
        this.fxo.voice(n.kind, 3 + (n.g.id % 5), n.cx, n.cy, 0.5);
      }, true);
    }
    for (const w of this.wires) {
      const m = w.mid();
      w.flashAll(Math.hypot(m.x - x, m.y - y) / 0.85);
    }
    // aftershocks: a second flare of every machine, and a rain of sparks over the whole screen
    const rr = createRng(this.p.seed ^ 0x51ed ^ this.cycle);
    cs.after(1900, () => {
      for (const n of this.nodes) {
        if (n.g.type === 'finale') continue;
        const h = n.machine.entries[0].closest('.m') as HTMLElement;
        cs.after(Math.hypot(n.cx - x, n.cy - y) / 1.3, () => { h.classList.remove('burst'); void h.offsetWidth; h.classList.add('burst'); n.machine.flourish?.(0); this.fxo.voice(n.kind, 5 + (n.g.id % 4), n.cx, n.cy, 0.35); }, true);
      }
      this.lattice.boom(x, y, hue + 140);
    }, true);
    for (let i = 0; i < 70; i++) {
      cs.after(500 + i * 65, () => {
        const px = rr.range(0, this.W), py = rr.range(0, this.H);
        this.fxo.ping(px, py, hue + i * 9, 0.12 + rr.next() * 0.3);
        if (i % 6 === 0) this.audio.voice('finale', 2 + (i % 9), px / this.W, 0.4);
      }, true);
    }
  }

  private afterFinale() {
    const cs = this.cscope!;
    this.cyclesDone++;
    const fin = this.plan!.nodes[this.plan!.graph.finale];
    this.carryHue = fin.hue;
    this.phase = 'stillness';
    this.log('stillness');
    // a dim heartbeat in the dark
    const beat = (i: number) => {
      if (i > 3) return;
      cs.after(900, () => { this.fxo.ping(this.W / 2, this.H / 2, fin.hue, 0.22); this.audio.voice('finale', -4, 0.5, 0.35); beat(i + 1); }, true);
    };
    beat(0);
    cs.after(3600, () => {
      for (const n of this.nodes) (n.machine.entries[0].closest('.m') as HTMLElement | null)?.classList.add('out');
      for (const w of this.wires) w.el.classList.add('out');
      const sh = this.nodes[this.plan!.graph.source].machine.entries[0].closest('.m') as HTMLElement;
      let went = false;
      const next = () => { if (went) return; went = true; this.startCycle(this.cycle + 1); };
      cs.on(sh, 'transitionend', (e: TransitionEvent) => { if (e.propertyName === 'opacity') cs.after(500, next, true); });
      cs.after(3600, next, true);
    }, true);
  }

  private teardown() {
    for (const n of this.nodes) n.dispose();
    this.cscope?.dispose();
    this.cscope = null;
    this.machinesHost?.replaceChildren();
    this.wiresHost?.replaceChildren();
    this.nodes = []; this.wires = [];
  }

  // -------------------------------------------------------- per frame
  private veilTo(v: number) {
    if (Math.abs(v - this.veilDim) < 0.02) return;
    this.veilDim = v;
    this.veil.style.opacity = v.toFixed(2);
    this.lattice.host.style.opacity = (1 - v * 0.8).toFixed(2);
  }

  private onFrame = (_dt: number, now: number) => {
    this.lattice.governor(this.clock.frameMs);
    if (this.phase === 'run') {
      const t = (now - this.igniteAt) / 1000;
      this.tempoTarget = tempoAt(this.progress, t, this.plan!.wobble) * (this.nodesRunningBoost());
      this.veilTo(dimAt(this.progress));
      // cycle-level watchdog
      if (this.watchdog && now - this.igniteAt > 420000 && !this.finaleFired) {
        this.log('CYCLE WATCHDOG');
        this.nodes[this.plan!.graph.finale].receive(0);
      }
    } else if (this.phase === 'finale' || this.phase === 'stillness' || this.phase === 'solo') this.tempoTarget = 1;
    this.tempoNow += (this.tempoTarget - this.tempoNow) * 0.06;
  };
  private nodesRunningBoost() { return 1; }

  get phaseName() { return this.phase === 'run' ? phaseAt(this.progress) : this.phase; }
  active(): string[] { return this.nodes.filter((n) => n.state === 'running').map((n) => `${n.g.id}:${n.kind}`); }

  api() {
    const self = this;
    return {
      seed: this.p.seed,
      director: this,
      get plan() { return self.plan; },
      get nodes() { return self.nodes; },
      stats, live,
      setWatchdog(v: boolean) { self.watchdog = v; },
      /** sabotage: disable an element so poke() refuses it, and detach it */
      kill(el: HTMLElement) { (el as HTMLInputElement).disabled = true; el.remove(); },
      info() {
        return self.nodes.map((n) => ({ id: n.g.id, type: n.g.type, kind: n.kind, state: n.state, runs: n.runs, forced: n.forced, depth: n.g.depth }));
      },
      clock: this.clock,
      runSolo: (k: string, loop = false) => self.runSolo(k, loop),
      kinds: () => REGISTRY.map((c) => c.kind),
    };
  }
}
void hsl;
