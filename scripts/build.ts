import { assemble } from './assemble';
import { join } from 'node:path';
const html = await assemble({ minify: true });
const out = join(import.meta.dir, '../dist/index.html');
await Bun.write(out, html);
if (/(src|href)=["']https?:|url\(["']?https?:|@import|fetch\(|XMLHttpRequest/.test(html)) console.warn('WARNING: possible external request in bundle');
console.log(`dist/index.html  ${(html.length / 1024).toFixed(1)} KB`);
