// Screenshot each contraption mid-run (looping solo) and montage them. node tests/browser/contact.mjs --only a,b --at 3.2 --out shots/sheet.png
import { launch, openPage, parseArgs, sleep, root } from './lib.mjs';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const a = parseArgs();
const browser = await launch();
const probe = await openPage(browser, { w: 400, h: 300, q: 'seed=3' });
await sleep(300);
const all = await probe.page.evaluate(() => window.__cascade.kinds());
await probe.ctx.close();
const kinds = a.only ? a.only.split(',') : all;
const at = (+(a.at ?? 3.2)) * 1000;
mkdirSync(join(root, 'shots/kinds'), { recursive: true });
const files = [];
await Promise.all(kinds.map(async (k) => {
  const { page, ctx, errors } = await openPage(browser, { w: 720, h: 600, q: `solo=${k}&seed=${a.seed ?? 3}&ts=${a.ts ?? 1}` });
  await sleep(at);
  const f = join(root, `shots/kinds/${k}.png`);
  await page.screenshot({ path: f });
  if (errors.length) console.log(k, errors);
  await ctx.close();
}));
for (const k of kinds) files.push(join(root, `shots/kinds/${k}.png`));
const out = join(root, a.out ?? 'shots/sheet.png');
const labeled = [];
for (const [i, f] of files.entries()) {
  const lf = f.replace('.png', '_l.png');
  execFileSync('magick', [f, '-gravity', 'NorthWest', '-fill', 'white', '-pointsize', '22', '-annotate', '+8+6', kinds[i], lf]);
  labeled.push(lf);
}
execFileSync('magick', ['montage', ...labeled, '-tile', `${a.cols ?? 3}x`, '-geometry', '+3+3', '-background', '#000', out]);
console.log('wrote', out);
await browser.close();
