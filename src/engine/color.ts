import type { Rng } from './prng';
import { lerp } from './geometry';

export type PaletteMode = 'analogous' | 'split' | 'triad' | 'duotone' | 'ember' | 'tide';
export const MODES: PaletteMode[] = ['analogous', 'split', 'triad', 'duotone', 'ember', 'tide'];

export const wrapHue = (h: number) => ((h % 360) + 360) % 360;
export const hsl = (h: number, s = 85, l = 62, a = 1) => `hsl(${wrapHue(h).toFixed(1)} ${s}% ${l}%${a < 1 ? ` / ${a}` : ''})`;

/** hue of a node as a function of its depth fraction f∈[0,1] along the chain */
export function nodeHue(mode: PaletteMode, base: number, f: number, rng: Rng): number {
  const j = rng.range(-9, 9);
  switch (mode) {
    case 'analogous': return base + f * 110 + j;
    case 'split': return base + (Math.sin(f * Math.PI * 2) * 0.5 + f) * 150 + j;
    case 'triad': return base + Math.floor(f * 3 + 0.0001) * 120 + (f * 3 % 1) * 30 + j;
    case 'duotone': return base + (Math.round(f * 5) % 2 ? 160 : 0) + f * 30 + j;
    case 'ember': return lerp(350, 62, f) + (base % 20) + j;
    case 'tide': return lerp(165, 285, f) + (base % 24) + j;
  }
}

export function pickMode(rng: Rng, prev?: PaletteMode): PaletteMode {
  let m = rng.pick(MODES);
  if (prev && m === prev) m = rng.pick(MODES);
  return m;
}

export function hex(h: number, s = 80, l = 60): string {
  h = wrapHue(h) / 360; s /= 100; l /= 100;
  const f = (n: number) => {
    const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l);
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255).toString(16).padStart(2, '0');
  };
  return '#' + f(0) + f(8) + f(4);
}
