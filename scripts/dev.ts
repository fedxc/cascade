import { assemble } from './assemble';
import { watch } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dir, '..');
const clients = new Set<ReadableStreamDefaultController>();
watch(join(root, 'src'), { recursive: true }, () => {
  for (const c of clients) { try { c.enqueue('data: reload\n\n'); } catch { clients.delete(c); } }
});
const port = Number(process.env.PORT ?? 3000);
Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === '/__reload') {
      let ctl!: ReadableStreamDefaultController;
      const body = new ReadableStream({ start(c) { ctl = c; clients.add(c); }, cancel() { clients.delete(ctl); } });
      return new Response(body, { headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' } });
    }
    try {
      return new Response(await assemble({ minify: false, live: true }), { headers: { 'content-type': 'text/html' } });
    } catch (e) {
      return new Response(String(e), { status: 500 });
    }
  },
});
console.log(`dev server on http://localhost:${port}  (try ?seed=7&debug)`);
