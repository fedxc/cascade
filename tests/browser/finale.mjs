// Capture the finale sequence: implosion → detonation → ripples → stillness. node tests/browser/finale.mjs --seed 7 --w 1440 --h 900
import { launch, openPage, parseArgs, sleep, root } from './lib.mjs';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
const a = parseArgs();
mkdirSync(join(root, 'shots/finale'), { recursive: true });
const browser = await launch();
const { page, errors } = await openPage(browser, { w: +(a.w ?? 1440), h: +(a.h ?? 900), q: `seed=${a.seed ?? 7}&ts=${a.ts ?? 4}` });
await page.waitForFunction(() => window.__cascade?.director.phase === 'finale', null, { timeout: 180000, polling: 50 });
const t0 = Date.now();
for (const t of [0.15, 0.6, 1.2, 2.2, 3.6, 5.5]) {
  const w = t * 1000 - (Date.now() - t0); if (w > 0) await sleep(w);
  await page.screenshot({ path: join(root, `shots/finale/f_${a.seed ?? 7}_${t}.png`) });
}
console.log('errors', errors.length ? errors : 'none');
await browser.close();
