// Three viewports: no console errors, nothing scrolls, layout recomputed on resize, screenshots.
import { launch, openPage, sleep, root } from './lib.mjs';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
mkdirSync(join(root, 'shots/vp'), { recursive: true });
const browser = await launch();
let failed = 0;
const check = (n, ok, e = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n} ${e}`); if (!ok) failed++; };
for (const [w, h] of [[390, 844], [1440, 900], [2560, 1080]]) {
  const { page, ctx, errors } = await openPage(browser, { w, h, q: 'seed=5&ts=3' });
  await sleep(14000);
  const m = await page.evaluate(() => ({
    sx: document.documentElement.scrollWidth, sy: document.documentElement.scrollHeight, iw: innerWidth, ih: innerHeight,
    nodes: window.__cascade.nodes.length, fm: window.__cascade.clock.frameMs, lvl: window.__cascade.director.lattice.level, dom: document.querySelectorAll('*').length,
    cells: window.__cascade.director.lattice.cells.length, forced: window.__cascade.stats.forced,
    offscreen: window.__cascade.plan.nodes.filter((n) => n.cx < 0 || n.cx > innerWidth || n.cy < 0 || n.cy > innerHeight).length,
  }));
  await page.screenshot({ path: join(root, `shots/vp/${w}x${h}.png`) });
  check(`${w}x${h} no page scroll`, m.sx <= m.iw && m.sy <= m.ih, JSON.stringify(m));
  check(`${w}x${h} nodes placed on screen`, m.offscreen === 0);
  // resize → layout recomputed
  const before = await page.evaluate(() => window.__cascade.plan.W);
  await page.setViewportSize({ width: Math.round(w * 0.7), height: Math.round(h * 0.8) });
  await sleep(2500);
  const after = await page.evaluate(() => ({ W: window.__cascade.plan.W, H: window.__cascade.plan.H, sx: document.documentElement.scrollWidth, iw: innerWidth }));
  check(`${w}x${h} resize recomputes layout`, after.W === Math.round(w * 0.7) && after.sx <= after.iw, `W ${before}→${after.W}`);
  check(`${w}x${h} no console errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
