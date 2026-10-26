// Soak: run for N minutes (default 10) at real speed; sample heap (after forced GC), DOM nodes, JS event listeners (CDP),
// live scope counters, cycle number, forced watchdog exits. Fails on stalls, errors, or heap/DOM/listener growth.
// node tests/browser/soak.mjs --minutes 10 --w 1440 --h 900 --seed 12 [--ts 1]
import { launch, openPage, parseArgs, sleep } from './lib.mjs';
const a = parseArgs();
const minutes = +(a.minutes ?? 10), w = +(a.w ?? 1440), h = +(a.h ?? 900);
const browser = await launch();
const { page, ctx, errors } = await openPage(browser, { w, h, q: `seed=${a.seed ?? 12}${a.ts ? '&ts=' + a.ts : ''}` });
const cdp = await ctx.newCDPSession(page);
await cdp.send('Performance.enable');
const samples = [];
async function sample() {
  await cdp.send('HeapProfiler.collectGarbage');
  const { metrics } = await cdp.send('Performance.getMetrics');
  const m = Object.fromEntries(metrics.map((x) => [x.name, x.value]));
  const dom = await cdp.send('Memory.getDOMCounters');
  const s = await page.evaluate(() => { const c = window.__cascade; return { cycle: c.director.cycle, phase: c.director.phaseName, forced: c.stats.forced, runs: c.stats.runs, live: { ...c.live }, fm: c.clock.frameMs, lvl: c.director.lattice.level, vt: c.clock.now, pending: c.clock.pending }; });
  const row = { t: samples.length, heapMB: m.JSHeapUsedSize / 1048576, nodes: dom.nodes, listeners: dom.jsEventListeners, ...s };
  samples.push(row);
  console.log(`[${(row.vt / 60000).toFixed(1)}m] cycle ${row.cycle} ${row.phase.padEnd(9)} heap ${row.heapMB.toFixed(1)}MB dom ${row.nodes} lsn ${row.listeners} timers ${row.live.timers} tw ${row.live.tweens} scopes ${row.live.scopes} forced ${row.forced} runs ${row.runs} frame ${row.fm.toFixed(1)}ms L${row.lvl}`);
}
const start = Date.now();
let lastRuns = -1, stall = 0, stalls = 0;
while (Date.now() - start < minutes * 60000) {
  await sleep(20000);
  await sample();
  const r = samples[samples.length - 1];
  if (r.runs === lastRuns) { stall++; if (stall >= 2) stalls++; } else stall = 0;
  lastRuns = r.runs;
}
// compare at the same phase of cycles: take samples in 'stillness'/'rebirth' (cleanest) vs. first such
const quiet = samples.filter((s) => s.phase === 'stillness' || s.phase === 'rebirth');
const cyc = Math.max(...samples.map((s) => s.cycle));
const grow = (key) => { const xs = samples.slice(Math.floor(samples.length / 3)); const first = xs.slice(0, Math.ceil(xs.length / 3)), lastS = xs.slice(-Math.ceil(xs.length / 3)); const avg = (l) => l.reduce((p, c) => p + c[key], 0) / l.length; return avg(lastS) / avg(first); };
let failed = 0;
const check = (n, ok, e = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n} ${e}`); if (!ok) failed++; };
check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
check('no stalls (runs counter kept advancing)', stalls === 0, `stalls=${stalls}`);
check('cycles completed', cyc >= 1, `cycle ${cyc}`);
check('heap does not grow (>25%) late vs mid', grow('heapMB') < 1.25, `x${grow('heapMB').toFixed(2)}`);
check('DOM nodes stable', grow('nodes') < 1.15, `x${grow('nodes').toFixed(2)}`);
check('listeners stable', grow('listeners') < 1.2, `x${grow('listeners').toFixed(2)}`);
check('watchdog rarely needed', samples[samples.length - 1].forced <= 2 + cyc, `forced=${samples[samples.length - 1].forced}`);
void quiet;
await browser.close();
process.exit(failed ? 1 : 0);
