import type { Contraption } from '../engine/types';
import { mk, lamp, poke, WORDS, Runner } from '../engine/kit';

// Self-scrolling feed: a scroll container driven past a reading band; an IntersectionObserver checks each row's box as it arrives.
export const feed: Contraption = {
  kind: 'feed', tags: ['fast'], nominal: 4000, weight: 1.0,
  build(c) {
    const R = new Runner(c.scope);
    const { rng, u, r } = c;
    const w = r * 0.95, h = r * 1.55;
    const box = mk('div', c.host, { x: 0, y: 0, w, h, cls: 'scr', hue: c.hue });
    const rowH = Math.max(15 * u, r * 0.1), n = rng.int(18, 28);
    const pad = h / 2 - rowH / 2;
    const top = document.createElement('div'); top.style.height = pad + 'px'; box.appendChild(top);
    const boxes: HTMLInputElement[] = [], rows: HTMLElement[] = [];
    for (let i = 0; i < n; i++) {
      const row = document.createElement('div');
      row.className = 'row'; row.style.height = rowH + 'px'; row.style.fontSize = Math.round(rowH * 0.6) + 'px';
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.className = 'cb cv'; cb.tabIndex = -1;
      cb.style.cssText = `width:${rowH * 0.6}px;height:${rowH * 0.6}px;flex:none`;
      const t = document.createElement('span'); t.textContent = rng.pick(WORDS) + ' ' + rng.pick(WORDS);
      row.append(cb, t); box.appendChild(row);
      boxes.push(cb); rows.push(row);
    }
    const bot = document.createElement('div'); bot.style.height = pad + 'px'; box.appendChild(bot);
    const entry = lamp(c.host, 0, -h / 2 - 14 * u, 11 * u, c.hue);
    const out = lamp(c.host, 0, h / 2 + 14 * u, 11 * u, c.hue2);
    const io = c.scope.observe(new IntersectionObserver((es) => {
      for (const e of es) {
        if (!e.isIntersecting) continue;
        const i = rows.indexOf(e.target as HTMLElement);
        if (i >= 0 && running) { poke(boxes[i]); }
      }
    }, { root: box, rootMargin: `-${(h / 2 - rowH * 0.9)}px 0px -${(h / 2 - rowH * 0.9)}px 0px`, threshold: 0.01 }));
    rows.forEach((row) => io.observe(row));
    let running = false;
    boxes.forEach((b, i) => c.scope.on(b, 'change', () => {
      if (!b.checked) return;
      c.hit(0, -h / 2 + (i / n) * h, 0.08, i);
      if (i === n - 1) R.s.after(180, () => poke(out));
    }));
    c.scope.on(entry, 'change', () => {
      if (!entry.checked) return;
      running = true;
      const max = box.scrollHeight - box.clientHeight;
      R.s.tween(n * 150, (t) => { box.scrollTop = max * t; });
    });
    return {
      entries: [entry], exit: { el: out, type: 'change' }, entryPts: [{ x: 0, y: -h / 2 - 14 * u }], exitPt: { x: 0, y: h / 2 + 14 * u }, budgetMs: n * 160 + 1200,
      reset() { R.reset(); running = false; entry.checked = false; out.checked = false; boxes.forEach((b) => (b.checked = false)); box.scrollTop = 0; },
      flourish() { R.s.tween(900, (t) => { box.scrollTop = (box.scrollHeight - box.clientHeight) * (1 - t); }, undefined, undefined, true); },
    };
  },
};
