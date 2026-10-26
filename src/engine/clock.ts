// Virtual-time clock. One rAF loop drives every timer and tween in the piece.
// Handlers run at their *due time* and schedule relative to it, so the order of events does not
// depend on frame jitter. `timeScale` lets tests fast-forward.

export type Handle = { cancelled: boolean };

interface Timer {
  due: number;
  seq: number;
  fn: () => void;
  h: Handle;
}
interface Tween {
  start: number;
  dur: number;
  fn: (t: number) => void;
  done?: () => void;
  ease: (t: number) => number;
  h: Handle;
}

export const ease = {
  lin: (t: number) => t,
  in: (t: number) => t * t,
  out: (t: number) => 1 - (1 - t) * (1 - t),
  inOut: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  cubicOut: (t: number) => 1 - Math.pow(1 - t, 3),
  bounce: (t: number) => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

export class Clock {
  now = 0; // virtual ms
  timeScale = 1;
  paused = false;
  private heap: Timer[] = [];
  private tweens: Tween[] = [];
  private seq = 0;
  private raf = 0;
  private last = 0;
  private running = false;
  /** called once per frame after timers+tweens ran (batched effects, e.g. lattice decay) */
  onFrame: ((dt: number, now: number) => void)[] = [];
  frameMs = 16; // smoothed real frame time (for the fps governor)
  get pending() { return this.heap.length + this.tweens.length; }

  // ---- heap ----
  private less(a: Timer, b: Timer) { return a.due < b.due || (a.due === b.due && a.seq < b.seq); }
  private push(t: Timer) {
    const h = this.heap;
    h.push(t);
    let i = h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(h[i], h[p])) break;
      [h[i], h[p]] = [h[p], h[i]];
      i = p;
    }
  }
  private pop(): Timer {
    const h = this.heap;
    const top = h[0];
    const last = h.pop()!;
    if (h.length) {
      h[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < h.length && this.less(h[l], h[m])) m = l;
        if (r < h.length && this.less(h[r], h[m])) m = r;
        if (m === i) break;
        [h[i], h[m]] = [h[m], h[i]];
        i = m;
      }
    }
    return top;
  }

  after(ms: number, fn: () => void): Handle {
    const h: Handle = { cancelled: false };
    this.push({ due: this.now + Math.max(0, ms), seq: this.seq++, fn, h });
    return h;
  }

  tween(dur: number, fn: (t: number) => void, done?: () => void, e: (t: number) => number = ease.lin): Handle {
    const h: Handle = { cancelled: false };
    this.tweens.push({ start: this.now, dur: Math.max(1, dur), fn, done, ease: e, h });
    return h;
  }

  /** advance virtual time by dt ms, running everything due. Deterministic regardless of dt. */
  step(dt: number) {
    const target = this.now + dt;
    while (this.heap.length && this.heap[0].due <= target) {
      const t = this.pop();
      if (t.h.cancelled) continue;
      this.now = Math.max(this.now, t.due);
      try { t.fn(); } catch (e) { console.error(e); }
    }
    this.now = target;
    if (this.tweens.length) {
      const list = this.tweens;
      this.tweens = [];
      const keep: Tween[] = [];
      for (const tw of list) {
        if (tw.h.cancelled) continue;
        const raw = Math.min(1, (this.now - tw.start) / tw.dur);
        try { tw.fn(tw.ease(raw)); } catch (e) { console.error(e); }
        if (raw >= 1) {
          if (!tw.h.cancelled && tw.done) { try { tw.done(); } catch (e) { console.error(e); } }
        } else keep.push(tw);
      }
      // tweens started inside callbacks were pushed to this.tweens; keep order
      this.tweens = keep.concat(this.tweens);
    }
    // drop cancelled timers lazily when heap gets big
    if (this.heap.length > 4096) this.heap = this.heap.filter((t) => !t.h.cancelled), this.reheap();
  }
  private reheap() {
    const items = this.heap;
    this.heap = [];
    for (const t of items) this.push(t);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (ts: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      const real = Math.min(100, ts - this.last);
      this.last = ts;
      this.frameMs += (real - this.frameMs) * 0.05;
      if (this.paused) return;
      const dt = real * this.timeScale;
      // sub-step big dt so tweens/timers interleave sanely
      let left = dt;
      while (left > 0) {
        const s = Math.min(left, 40);
        this.step(s);
        left -= s;
      }
      for (const f of this.onFrame) f(real, this.now);
    };
    this.raf = requestAnimationFrame(loop);
  }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }
  clear() { this.heap = []; this.tweens = []; }
}
