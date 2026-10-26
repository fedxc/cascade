// node tests/browser/shots.mjs --seed 7 --w 1440 --h 900 --times 3,10,30 --ts 1 --out shots/a [--debug] [--q extra=1]
import { launch, openPage, parseArgs, sleep, root } from './lib.mjs';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const a = parseArgs();
const w = +(a.w ?? 1440), h = +(a.h ?? 900), seed = a.seed ?? '7';
const times = String(a.times ?? '3,10').split(',').map(Number);
const out = a.out ?? `shots/s${seed}_${w}x${h}`;
const q = [`seed=${seed}`, a.ts ? `ts=${a.ts}` : '', a.debug ? 'debug' : '', a.q ?? ''].filter(Boolean).join('&');
mkdirSync(join(root, dirname(out)), { recursive: true });
const browser = await launch();
const { page, errors } = await openPage(browser, { w, h, q });
const t0 = Date.now();
for (const t of times) {
  const wait = t * 1000 - (Date.now() - t0);
  if (wait > 0) await sleep(wait);
  const f = join(root, `${out}_t${t}.png`);
  await page.screenshot({ path: f });
  const info = await page.evaluate(() => window.__cascade && { cyc: window.__cascade.director.cycle, ph: window.__cascade.director.phaseName, p: +window.__cascade.director.progress.toFixed(2), forced: window.__cascade.stats.forced, active: window.__cascade.director.active(), fm: +window.__cascade.clock.frameMs.toFixed(1), lvl: window.__cascade.director.lattice.level, dom: document.querySelectorAll('*').length });
  console.log(`t=${t}s ${f}`, JSON.stringify(info));
}
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
