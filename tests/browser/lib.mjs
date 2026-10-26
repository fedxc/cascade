import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
export const pageUrl = (q = '') => pathToFileURL(join(root, 'dist/index.html')).href + (q ? '?' + q : '');

export async function launch(extra = []) {
  return chromium.launch({
    executablePath: process.env.CHROME || '/usr/bin/chromium',
    args: ['--no-sandbox', '--enable-precise-memory-info', '--js-flags=--expose-gc', '--autoplay-policy=no-user-gesture-required', ...extra],
  });
}

export function parseArgs(argv = process.argv.slice(2)) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const k = argv[i].slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
      o[k] = v;
    }
  }
  return o;
}

export async function openPage(browser, { w = 1440, h = 900, q = '', dpr = 1 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
  const page = await ctx.newPage();
  const errors = [];
  const logs = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); else logs.push(m.text()); });
  page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
  await page.goto(pageUrl(q));
  return { page, ctx, errors, logs };
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
