// Runs the fast browser suite: kinds, causality, viewports. (Soak is separate: node tests/browser/soak.mjs)
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
let bad = 0;
for (const f of ['kinds.mjs', 'causality.mjs', 'viewports.mjs']) {
  console.log(`\n=== ${f} ===`);
  const r = spawnSync('node', [join(here, f)], { stdio: 'inherit' });
  if (r.status) bad++;
}
process.exit(bad ? 1 : 0);
