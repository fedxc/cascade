// ?debug overlay: seed, cycle, phase, active contraptions, graph text, fps. Invisible without the flag.
import type { Director } from './director';
import { live } from './scope';
import { stats } from './node';

export class DebugOverlay {
  el: HTMLPreElement;
  private frames = 0; private last = performance.now(); private fps = 0;
  constructor(private d: Director) {
    this.el = document.createElement('pre');
    this.el.style.cssText = 'position:fixed;left:6px;top:6px;margin:0;padding:6px 8px;background:rgba(0,0,0,.72);color:#9fe;font:11px/1.25 ui-monospace,monospace;z-index:99;pointer-events:none;max-width:48vw;white-space:pre-wrap;max-height:96vh;overflow:hidden';
    document.body.appendChild(this.el);
    const tick = () => { this.frames++; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    setInterval(() => this.update(), 250);
  }
  update() {
    const now = performance.now();
    this.fps = (this.frames * 1000) / (now - this.last); this.frames = 0; this.last = now;
    const d = this.d, plan = d.plan;
    if (!plan) return;
    const g = plan.graph;
    const rows = g.nodes.map((n) => {
      const rn = d.nodes[n.id];
      const outs = g.edges.filter((e) => e.from === n.id).map((e) => (e.back ? '↺' : '→') + e.to).join(' ');
      const mark = rn?.state === 'running' ? '▶' : rn?.state === 'done' ? '✓' : '·';
      return `${mark}${String(n.id).padStart(2)} ${(plan.nodes[n.id].kind).padEnd(11)} ${n.type === 'machine' ? '' : n.type.padEnd(7)} ${outs}`;
    });
    this.el.textContent = [
      `seed ${d.p.seed}  cycle ${d.cycle}  ${d.phaseName}  p=${d.progress.toFixed(2)}  tempo ${d.tempo().toFixed(2)}`,
      `fps ${this.fps.toFixed(0)}  frame ${d.clock.frameMs.toFixed(1)}ms  lattice L${d.lattice.level} (${d.lattice.cells.length})  ${plan.mode} h${plan.baseHue.toFixed(0)}`,
      `active: ${d.active().join(', ') || '-'}`,
      `forced ${stats.forced}  runs ${stats.runs}  listeners ${live.listeners} timers ${live.timers} tweens ${live.tweens}`,
      '', ...rows, '', ...d.logLines.slice(-8),
    ].join('\n');
  }
}
