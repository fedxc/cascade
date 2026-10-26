// Causality: sabotage one link and prove the cascade stops exactly there.
//  A) disable a mid-chain wire pip      → downstream nodes never start (watchdog OFF); upstream ran
//  B) disable a contraption's entry     → that node never starts; nothing after it runs
//  C) remove a control INSIDE a contraption (not its entry) → node starts, never exits, downstream silent
//  D) with the watchdog ON the stall is forced onward and the chain resumes (and is counted)
import { launch, openPage, sleep } from './lib.mjs';

const browser = await launch();
let failed = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); if (!ok) failed++; };

async function scenario(kind, { watchdog }) {
  const { page, ctx, errors } = await openPage(browser, { w: 1200, h: 800, q: `seed=21&ts=6${watchdog ? '' : '&nowd'}` });
  await page.waitForFunction(() => window.__cascade && window.__cascade.nodes.length > 0);
  // wait for ignition
  await page.waitForFunction(() => window.__cascade.nodes[0].runs > 0, null, { timeout: 30000 });
  const target = await page.evaluate((kind) => {
    const c = window.__cascade, plan = c.plan, g = plan.graph;
    // pick the source's first successor chain: source → a → b (a plain machine pair on the main path)
    const first = g.edges.find((e) => e.from === g.source && !e.back);
    const a = first.to;
    const out2 = g.edges.find((e) => e.from === a && !e.back);
    const info = { a, b: out2.to };
    const nodeA = c.nodes[a];
    if (kind === 'pip') {
      const w = nodeA.outs[0].wire;
      const el = w.elems[Math.floor(w.elems.length / 2)];
      c.kill(el);
      info.what = 'pip ' + Math.floor(w.elems.length / 2) + '/' + w.elems.length;
    } else if (kind === 'entry') {
      const wire = c.nodes[g.source].outs.find((o) => o.edge.to === a).wire;
      c.kill(nodeA.machine.entries[0]);
      info.what = 'entry of node ' + a;
    } else if (kind === 'inside') {
      // remove the exit element's upstream partner: kill the machine's exit control itself
      c.kill(nodeA.machine.exit.el);
      info.what = 'exit control of node ' + a;
    }
    return info;
  }, kind);
  await sleep(14000);
  const res = await page.evaluate(({ a, b }) => {
    const c = window.__cascade;
    const reachedAfter = c.nodes.filter((n) => n.g.depth > c.nodes[b].g.depth && n.runs > 0).length;
    const downstreamFirst = c.nodes.find((n) => n.g.id === b);
    return { aRuns: c.nodes[a].runs, aForced: c.nodes[a].forced, aState: c.nodes[a].state, bRuns: downstreamFirst.runs, past: reachedAfter, forced: c.stats.forced, cycle: c.director.cycle };
  }, target);
  await ctx.close();
  return { target, res, errors };
}

const A = await scenario('pip', { watchdog: false });
check(`pip sabotage (${A.target.what}): upstream ran`, A.res.aRuns > 0);
check('pip sabotage: next contraption never started', A.res.bRuns === 0, JSON.stringify(A.res));
check('pip sabotage: nothing downstream started', A.res.past === 0);

const B = await scenario('entry', { watchdog: false });
check(`entry sabotage (${B.target.what}): node never started`, B.res.aRuns === 0, JSON.stringify(B.res));
check('entry sabotage: nothing after it ran', B.res.bRuns === 0 && B.res.past === 0);

const C = await scenario('inside', { watchdog: false });
check(`inner sabotage (${C.target.what}): node started but is stuck running`, C.res.aRuns > 0 && C.res.aState === 'running' && C.res.bRuns === 0, JSON.stringify(C.res));

const D = await scenario('inside', { watchdog: true });
check(`watchdog ON (${D.target.what}): stall forced onward`, D.res.aForced > 0 && D.res.bRuns > 0, JSON.stringify(D.res));
const errs = [...A.errors, ...B.errors, ...C.errors, ...D.errors];
check('no console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
await browser.close();
process.exit(failed ? 1 : 0);
