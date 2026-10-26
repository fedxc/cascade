// Disposal scopes: every listener / timer / tween / observer is owned by a Scope.
import type { Clock, Handle } from './clock';

export const live = { listeners: 0, timers: 0, tweens: 0, observers: 0, scopes: 0 };

export class Scope {
  private disposers: (() => void)[] = [];
  private kids = new Set<Scope>();
  disposed = false;
  /** returns tempo multiplier (>0). Delays/durations given to after()/tween() are divided by it. */
  constructor(readonly clock: Clock, private tempo: () => number = () => 1, private parent?: Scope) {
    live.scopes++;
    parent?.kids.add(this);
  }

  child(): Scope { return new Scope(this.clock, this.tempo, this); }

  on<K extends keyof HTMLElementEventMap>(
    target: EventTarget, type: K | string, fn: (e: any) => void, opts?: AddEventListenerOptions,
  ) {
    target.addEventListener(type, fn as EventListener, opts);
    live.listeners++;
    let gone = false;
    const off = () => { if (gone) return; gone = true; live.listeners--; target.removeEventListener(type, fn as EventListener, opts); };
    this.disposers.push(off);
    return off;
  }

  private handles = new Map<Handle, 'timers' | 'tweens'>();

  /** delay in nominal ms, scaled by tempo (pass raw:true to ignore tempo) */
  after(ms: number, fn: () => void, raw = false): Handle {
    if (this.disposed) return { cancelled: true };
    live.timers++;
    const h: Handle = this.clock.after(raw ? ms : ms / this.tempo(), () => {
      this.handles.delete(h); live.timers--;
      if (!this.disposed) fn();
    });
    this.handles.set(h, 'timers');
    return h;
  }

  tween(dur: number, fn: (t: number) => void, done?: () => void, e?: (t: number) => number, raw = false): Handle {
    if (this.disposed) return { cancelled: true };
    live.tweens++;
    const h: Handle = this.clock.tween(raw ? dur : dur / this.tempo(), (t) => { if (!this.disposed) fn(t); }, () => {
      this.handles.delete(h); live.tweens--;
      if (!this.disposed) done?.();
    }, e);
    this.handles.set(h, 'tweens');
    return h;
  }

  cancel(h: Handle) {
    const k = this.handles.get(h);
    if (k) { this.handles.delete(h); h.cancelled = true; live[k]--; }
  }

  observe<T extends { disconnect(): void }>(o: T): T {
    live.observers++;
    this.disposers.push(() => { live.observers--; o.disconnect(); });
    return o;
  }

  add(fn: () => void) { this.disposers.push(fn); }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const k of [...this.kids]) k.dispose();
    this.kids.clear();
    for (const [h, k] of this.handles) { h.cancelled = true; live[k]--; }
    this.handles.clear();
    for (const d of this.disposers) { try { d(); } catch { /* ignore */ } }
    this.disposers = [];
    this.parent?.kids.delete(this);
    live.scopes--;
  }
}
