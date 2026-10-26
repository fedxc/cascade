// Assembles the single self-contained page: src/index.html + src/style.css + bundled src/main.ts.
import { join } from 'node:path';
const root = join(import.meta.dir, '..');

export async function assemble(opts: { minify: boolean; live?: boolean }): Promise<string> {
  const res = await Bun.build({
    entrypoints: [join(root, 'src/main.ts')],
    target: 'browser',
    minify: opts.minify,
    format: 'iife',
  });
  if (!res.success) {
    for (const l of res.logs) console.error(l);
    throw new Error('bundle failed');
  }
  const js = (await res.outputs[0].text()).replace(/<\/script/gi, '<\\/script');
  const css = await Bun.file(join(root, 'src/style.css')).text();
  let html = await Bun.file(join(root, 'src/index.html')).text();
  const live = opts.live ? `<script>new EventSource('/__reload').onmessage=()=>location.reload()</script>` : '';
  html = html.replace('/*__CSS__*/', () => css).replace('/*__JS__*/', () => js).replace('</body>', () => live + '</body>');
  return html;
}
