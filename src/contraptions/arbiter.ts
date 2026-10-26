import type { Contraption } from '../engine/types';
import { checkbox, radio, poke, mv, Runner } from '../engine/kit';

// RACE: a radio group; the first token to arrive wins and continues, the loser collides.
let uid = 0;
export const arbiter: Contraption = {
  kind: 'arbiter', role: 'arbiter', nominal: 1000, weight: 0.7,
  build(c) {
    const R = new Runner(c.scope);
    const { u, r, ports } = c;
    const name = 'arb' + uid++;
    const pos = (p: number) => ({ x: -r * 0.7, y: (p - (ports - 1) / 2) * r * 0.62 });
    const pads = Array.from({ length: ports }, (_, p) => radio(c.host, { ...pos(p), w: 14 * u, h: 14 * u, name, hue: c.hue + p * 20 }));
    const core = checkbox(c.host, { x: 0, y: 0, w: 20 * u, h: 20 * u, hue: c.hue, rot: Math.PI / 4 });
    const out = checkbox(c.host, { x: r * 0.7, y: 0, w: 14 * u, h: 14 * u, hue: c.hue2 });
    pads.forEach((p, i) => c.scope.on(p, 'change', () => {
      if (!p.checked) return;
      c.hit(pos(i).x, pos(i).y, 0.3, i);
      R.s.after(200, () => poke(core));
    }));
    c.scope.on(core, 'change', () => { if (core.checked) { c.hit(0, 0, 0.5, 2); R.s.after(260, () => poke(out)); } });
    return {
      entries: pads, exit: { el: out, type: 'change' }, entryPts: pads.map((_, p) => pos(p)), exitPt: { x: r * 0.7, y: 0 }, budgetMs: 1000,
      reset() { R.reset(); pads.forEach((p) => (p.checked = false)); core.checked = false; out.checked = false; },
      collide(port) {
        const pad = pads[port], q = pos(port);
        pad.classList.add('red', 'on');
        const w = c.world, cs = Math.cos(w.rot), sn = Math.sin(w.rot);
        c.fx.shake(w.cx + q.x * cs - q.y * sn, w.cy + q.x * sn + q.y * cs, c.hue);
        c.scope.tween(420, (t) => mv(pad, q.x + Math.sin(t * 40) * 4 * (1 - t), q.y, 0, 1 + 0.6 * (1 - t)), () => { pad.classList.remove('on'); }, undefined, true);
        c.scope.after(1600, () => pad.classList.remove('red'), true);
      },
      flourish() { core.classList.add('on'); },
    };
  },
};
