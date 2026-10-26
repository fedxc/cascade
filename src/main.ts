import { Director, type Params } from './engine/director';
import { DebugOverlay } from './engine/debug';
import { createRng } from './engine/prng';

function params(): Params {
  const q = new URLSearchParams(location.search);
  let seed = Number(q.get('seed'));
  if (!q.has('seed') || !Number.isFinite(seed)) {
    // the one place we need entropy: pick a seed. Logged so any run can be reproduced.
    seed = (performance.now() * 1000 + Date.now()) % 4294967296 >>> 0;
  }
  return { seed: seed >>> 0, debug: q.has('debug'), ts: Number(q.get('ts') ?? 1) || 1, solo: q.get('solo'), nowd: q.has('nowd') };
}

const p = params();
console.log(`cascade seed=${p.seed}  (reload with ?seed=${p.seed} to reproduce)`);
const stage = document.getElementById('stage') as HTMLElement;
const d = new Director(stage, p);
if (p.nowd) d.watchdog = false;
(window as any).__cascade = d.api();

const snd = document.getElementById('snd') as HTMLInputElement;
snd.addEventListener('change', () => d.audio.toggle(snd.checked));

d.boot();
if (p.debug) new DebugOverlay(d);
void createRng;
