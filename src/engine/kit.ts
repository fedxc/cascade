// Control factories and DOM helpers shared by all contraptions.
// Every control is a REAL form element. Styling lives in style.css.
import type { Scope } from './scope';
import { clamp } from './geometry';

export interface PlaceOpts { x?: number; y?: number; w?: number; h?: number; rot?: number; s?: number; hue?: number; cls?: string; z?: number }

interface T { x: number; y: number; rot: number; s: number; w: number; h: number }
const state = new WeakMap<HTMLElement, T>();

function applyT(e: HTMLElement, t: T) {
  e.style.transform = `translate(${t.x.toFixed(2)}px,${t.y.toFixed(2)}px) rotate(${t.rot.toFixed(4)}rad) scale(${t.s.toFixed(3)})`;
}

/** position an element so its CENTRE sits at local (x,y) */
export function place(e: HTMLElement, o: PlaceOpts) {
  const t: T = { x: o.x ?? 0, y: o.y ?? 0, rot: o.rot ?? 0, s: o.s ?? 1, w: o.w ?? 12, h: o.h ?? 12 };
  state.set(e, t);
  const st = e.style;
  st.width = t.w + 'px';
  st.height = t.h + 'px';
  st.left = -t.w / 2 + 'px';
  st.top = -t.h / 2 + 'px';
  if (o.hue !== undefined) st.setProperty('--h', o.hue.toFixed(1));
  if (o.z !== undefined) st.zIndex = String(o.z);
  applyT(e, t);
}

export function mv(e: HTMLElement, x?: number, y?: number, rot?: number, s?: number) {
  const t = state.get(e);
  if (!t) return;
  if (x !== undefined) t.x = x;
  if (y !== undefined) t.y = y;
  if (rot !== undefined) t.rot = rot;
  if (s !== undefined) t.s = s;
  applyT(e, t);
}
export const getT = (e: HTMLElement) => state.get(e)!;

type Attrs = Record<string, string | number | boolean>;

export function mk<K extends keyof HTMLElementTagNameMap>(tag: K, parent: Element, o: PlaceOpts & { attrs?: Attrs } = {}): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = 'c' + (o.cls ? ' ' + o.cls : '');
  if (o.attrs) for (const k in o.attrs) { const v = o.attrs[k]; if (v === true) e.setAttribute(k, ''); else if (v !== false) e.setAttribute(k, String(v)); }
  place(e, o);
  parent.appendChild(e);
  return e;
}

export const checkbox = (p: Element, o: PlaceOpts = {}) => mk('input', p, { w: 12, h: 12, ...o, cls: 'cb ' + (o.cls ?? ''), attrs: { type: 'checkbox', tabindex: -1 } });
export const radio = (p: Element, o: PlaceOpts & { name?: string } = {}) => mk('input', p, { w: 12, h: 12, ...o, cls: 'rd ' + (o.cls ?? ''), attrs: { type: 'radio', tabindex: -1, ...(o.name ? { name: o.name } : {}) } });
export const range = (p: Element, o: PlaceOpts & { min?: number; max?: number; value?: number; step?: number | string } = {}) => {
  const e = mk('input', p, { w: 80, h: 14, ...o, cls: 'rg ' + (o.cls ?? ''), attrs: { type: 'range', min: o.min ?? 0, max: o.max ?? 100, step: o.step ?? 'any', tabindex: -1 } });
  e.value = String(o.value ?? 0);
  syncFrac(e);
  return e;
};
export const progress = (p: Element, o: PlaceOpts & { max?: number; value?: number } = {}) => {
  const e = mk('progress', p, { w: 80, h: 8, ...o, cls: 'pg ' + (o.cls ?? ''), attrs: { max: o.max ?? 1 } });
  e.value = o.value ?? 0;
  return e;
};
export const meter = (p: Element, o: PlaceOpts & { min?: number; max?: number; value?: number; low?: number; high?: number; optimum?: number } = {}) => {
  const attrs: Attrs = { min: o.min ?? 0, max: o.max ?? 1 };
  if (o.low !== undefined) attrs.low = o.low;
  if (o.high !== undefined) attrs.high = o.high;
  if (o.optimum !== undefined) attrs.optimum = o.optimum;
  const e = mk('meter', p, { w: 80, h: 8, ...o, cls: 'mt ' + (o.cls ?? ''), attrs });
  e.value = o.value ?? 0;
  return e;
};
export const button = (p: Element, o: PlaceOpts & { text?: string } = {}) => {
  const e = mk('button', p, { w: 16, h: 16, ...o, cls: 'bt ' + (o.cls ?? ''), attrs: { type: 'button', tabindex: -1 } });
  if (o.text) e.textContent = o.text;
  return e;
};
export const select = (p: Element, o: PlaceOpts & { options: string[]; size?: number; multiple?: boolean } = { options: [] }) => {
  const attrs: Attrs = { tabindex: -1 };
  if (o.size) attrs.size = o.size;
  const e = mk('select', p, { w: 24, h: 20, ...o, cls: 'sl ' + (o.cls ?? ''), attrs });
  for (const t of o.options) { const op = document.createElement('option'); op.textContent = t; e.appendChild(op); }
  return e;
};
export const num = (p: Element, o: PlaceOpts & { min?: number; max?: number; value?: number; step?: number } = {}) => {
  const e = mk('input', p, { w: 22, h: 28, ...o, cls: 'nm ' + (o.cls ?? ''), attrs: { type: 'number', min: o.min ?? 0, max: o.max ?? 9, step: o.step ?? 1, tabindex: -1 } });
  e.value = String(o.value ?? 0);
  return e;
};
export const colorIn = (p: Element, o: PlaceOpts & { value?: string } = {}) => {
  const e = mk('input', p, { w: 22, h: 22, ...o, cls: 'co ' + (o.cls ?? ''), attrs: { type: 'color', tabindex: -1 } });
  e.value = o.value ?? '#202030';
  return e;
};
export const dateIn = (p: Element, type: 'date' | 'time' | 'week' | 'month' | 'datetime-local', o: PlaceOpts = {}) =>
  mk('input', p, { w: 110, h: 22, ...o, cls: 'dt ' + (o.cls ?? ''), attrs: { type, tabindex: -1 } });
export const textIn = (p: Element, o: PlaceOpts & { value?: string } = {}) => {
  const e = mk('input', p, { w: 80, h: 18, ...o, cls: 'tx ' + (o.cls ?? ''), attrs: { type: 'text', tabindex: -1, readonly: false } });
  e.value = o.value ?? '';
  return e;
};
export const textarea = (p: Element, o: PlaceOpts & { rows?: number; cols?: number } = {}) =>
  mk('textarea', p, { w: 80, h: 36, ...o, cls: 'ta ' + (o.cls ?? ''), attrs: { tabindex: -1, rows: o.rows ?? 2, cols: o.cols ?? 8, spellcheck: false } });
export const details = (p: Element, o: PlaceOpts & { summary?: string; body?: string } = {}) => {
  const e = mk('details', p, { w: 40, h: 20, ...o, cls: 'dtl ' + (o.cls ?? '') });
  const s = document.createElement('summary'); s.textContent = o.summary ?? '▸';
  e.appendChild(s);
  const b = document.createElement('div'); b.textContent = o.body ?? '';
  e.appendChild(b);
  return e;
};
export const group = (p: Element, o: PlaceOpts = {}) => {
  const e = document.createElement('div');
  e.className = 'g';
  place(e, { w: 0, h: 0, ...o });
  p.appendChild(e);
  return e;
};

// ---- behaviour helpers ----

export function syncFrac(e: HTMLInputElement) {
  const min = +e.min || 0, max = +e.max || 100;
  e.style.setProperty('--v', clamp((+e.value - min) / (max - min || 1), 0, 1).toFixed(3));
}

/** click only if the element is alive and enabled; returns whether the poke landed */
export function poke(e: HTMLElement | null | undefined): boolean {
  if (!e || !e.isConnected || (e as HTMLInputElement).disabled) return false;
  e.click();
  return true;
}
export function emit(e: EventTarget, type: string) {
  e.dispatchEvent(new Event(type, { bubbles: true }));
}
/** set a value-bearing control and emit the event a user's hand would have */
export function setRange(e: HTMLInputElement, v: number, type: 'input' | 'change' | null = 'input') {
  e.value = String(v);
  syncFrac(e);
  if (type) emit(e, type);
}
export function setProgress(e: HTMLProgressElement | HTMLMeterElement, v: number, type: 'input' | 'change' | null = null) {
  e.value = v;
  if (type) emit(e, type);
}
export function flash(scope: Scope, e: HTMLElement, ms = 140, cls = 'on') {
  e.classList.add(cls);
  scope.after(ms, () => e.classList.remove(cls), true);
}
export function setHue(e: HTMLElement, h: number) { e.style.setProperty('--h', h.toFixed(1)); }
export const disable = (e: HTMLElement) => { (e as HTMLInputElement).disabled = true; };

export function focusEvent(e: HTMLElement) {
  if (!e.isConnected) return;
  e.focus({ preventScroll: true });
  if (!document.hasFocus()) e.dispatchEvent(new FocusEvent('focus'));
}

export const GLYPHS = Array.from('◼◻▲△▼▽●○◆◇✕✦✧⬡⬢◈◎⊕⊗※⁂∿⌁⋰⟡◌');
export const WORDS = ['tick', 'slip', 'pour', 'turn', 'drip', 'roll', 'spin', 'tap', 'hum', 'nudge', 'fall', 'wake', 'lean', 'tip', 'hand', 'pass', 'carry', 'ring', 'tilt', 'spill', 'echo', 'wind', 'latch', 'cog', 'gear', 'spring', 'bead', 'lift', 'drop', 'glide'];

/** per-run timers/tweens: reset() cancels everything the previous run scheduled (so a forced exit can't leave ghosts) */
export class Runner {
  private cur: Scope;
  constructor(private parent: Scope) { this.cur = parent.child(); }
  get s(): Scope { return this.cur; }
  reset() { this.cur.dispose(); this.cur = this.parent.child(); }
}

/** a small diamond checkbox used as entry/exit lamp */
export function lamp(parent: Element, x: number, y: number, s: number, hue: number) {
  return checkbox(parent, { x, y, w: s, h: s, rot: Math.PI / 4, hue });
}
export const L = (c: { host: Element }, x: number, y: number, s: number, hue: number) => lamp(c.host, x, y, s, hue);
