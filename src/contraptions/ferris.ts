import type { Contraption } from '../engine/types';
import { select, range, group, mv, lamp, emit, poke, GLYPHS, Runner } from '../engine/kit';

// Ferris wheel: a hub of spokes with a select at each rim. Each step is a CSS transition; its native `transitionend`
// advances the cabin at the bottom (selectedIndex + change) and then starts the next step.
export const ferris: Contraption = {
  kind: 'ferris', tags: ['big', 'slow'], nominal: 7000, weight: 1.25,
  build(c) {
    const R = new Runner(c.scope);
    const { rng, u, r } = c;
    const n = rng.int(8, 11), rad = r * 0.72, cw = Math.max(20 * u, r * 0.26), ch = cw * 1.1;
    const wheel = group(c.host, { x: 0, y: 0 });
    const set = rng.shuffle([...GLYPHS]).slice(0, 8);
    const cabins: HTMLSelectElement[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      range(wheel, { x: Math.cos(a) * rad / 2, y: Math.sin(a) * rad / 2, w: rad, h: 14, rot: a, cls: 'arm', hue: c.hue + i * 5, value: 100, min: 0, max: 100 });
      const s = select(wheel, { x: Math.cos(a) * rad, y: Math.sin(a) * rad, w: cw, h: ch, options: set, cls: 'flap', hue: c.hue + i * 14 });
      s.style.fontSize = Math.round(ch * 0.58) + 'px';
      s.selectedIndex = rng.int(0, set.length - 1);
      cabins.push(s);
    }
    const entry = lamp(c.host, -r * 0.98, r * 0.5, 11 * u, c.hue);
    const out = lamp(c.host, r * 0.98, r * 0.5, 11 * u, c.hue2);
    let step = 0, ang = 0;
    const dur = () => 650 / (Math.max(0.3, c.tempo()) * c.ts);
    const rot = (a: number, ms: number) => {
      wheel.style.transition = `transform ${ms}ms cubic-bezier(.5,0,.5,1)`;
      cabins.forEach((s) => { s.style.transition = `transform ${ms}ms cubic-bezier(.5,0,.5,1)`; });
      mv(wheel, 0, 0, a);
      cabins.forEach((s, i) => mv(s, undefined, undefined, -a));
    };
    c.scope.on(wheel, 'transitionend', (e: TransitionEvent) => {
      if (e.target !== wheel || e.propertyName !== 'transform' || step === 0) return;
      // the cabin now at the bottom turns over
      let best = 0, bd = -1;
      cabins.forEach((s, i) => { const y = Math.sin((i / n) * Math.PI * 2 - Math.PI / 2 + ang); if (y > bd) { bd = y; best = i; } });
      const s = cabins[best];
      s.selectedIndex = (s.selectedIndex + 1) % set.length; s.classList.add('on');
      R.s.after(900, () => s.classList.remove('on'), true);
      emit(s, 'change');
    });
    cabins.forEach((s, i) => c.scope.on(s, 'change', () => {
      c.hit(Math.cos((i / n) * Math.PI * 2 - Math.PI / 2 + ang) * rad, Math.sin((i / n) * Math.PI * 2 - Math.PI / 2 + ang) * rad, 0.25, i);
      if (step >= n) R.s.after(250, () => poke(out)); else R.s.after(120, go);
    }));
    const go = () => { step++; ang += (Math.PI * 2) / n; rot(ang, dur()); };
    c.scope.on(entry, 'change', () => { if (entry.checked) { step = 0; go(); } });
    return {
      entries: [entry], exit: { el: out, type: 'change' }, entryPts: [{ x: -r * 0.98, y: r * 0.5 }], exitPt: { x: r * 0.98, y: r * 0.5 }, budgetMs: n * 900 + 1500,
      reset() { R.reset(); step = 0; ang = 0; entry.checked = false; out.checked = false; wheel.style.transition = 'none'; cabins.forEach((s) => (s.style.transition = 'none')); mv(wheel, 0, 0, 0); cabins.forEach((s) => mv(s, undefined, undefined, 0)); },
      flourish() { rot(ang + Math.PI * 2, 1400); ang += Math.PI * 2; },
    };
  },
};
