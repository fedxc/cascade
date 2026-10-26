// Run every contraption alone: must complete without the watchdog, report duration; optional screenshots.
// node tests/browser/kinds.mjs [--only a,b] [--shots] [--ts 4]
import { launch, openPage, parseArgs, sleep, root } from './lib.mjs';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const a = parseArgs();
const ts = a.ts ?? '4';
const browser = await launch();
const { page, errors } = await openPage(browser, { w: 900, h: 700, q: `seed=3&ts=${ts}&nowd` });
await sleep(800);
const all = await page.evaluate(() => window.__cascade.kinds());
const kinds = a.only ? a.only.split(',') : all;
mkdirSync(join(root, 'shots/kinds'), { recursive: true });
let bad = 0;
for (const k of kinds) {
  const t0 = Date.now();
  const res = await page.evaluate(async (k) => {
    const done = window.__cascade.runSolo(k, false);
    const timeout = new Promise((r) => setTimeout(() => r({ timeout: true }), 60000));
    return Promise.race([done, timeout]);
  }, k);
  const ok = !res.timeout && !res.forced;
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${k.padEnd(12)} virtual ${res.ms ? (res.ms / 1000).toFixed(1) + 's' : '-'}  els ${res.elements ?? '-'}  real ${((Date.now() - t0) / 1000).toFixed(1)}s ${res.forced ? 'FORCED' : ''} ${res.timeout ? 'TIMEOUT' : ''}`);
  if (a.shots) {
    // run again looping at real speed? just snapshot the settled state of this run's fade
    await page.screenshot({ path: join(root, `shots/kinds/${k}.png`) });
  }
}
console.log(bad ? `${bad} failing` : 'all contraptions completed', errors.length ? errors : '');
await browser.close();
process.exit(bad ? 1 : 0);
