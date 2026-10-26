// Generated audio only (Web Audio). Muted by default; one tiny control enables it.
// Each contraption "family" has its own voice. Notes are tuned to a scale that follows the palette.

interface VoiceDef { type: OscillatorType; oct: number; dur: number; gain: number; lp: number; detune?: number; noise?: number; fm?: number }

const VOICES: Record<string, VoiceDef> = {
  tick:    { type: 'square',   oct: 2, dur: 0.05, gain: 0.05, lp: 3200, noise: 0.5 },
  pluck:   { type: 'triangle', oct: 1, dur: 0.35, gain: 0.12, lp: 2600 },
  chime:   { type: 'sine',     oct: 3, dur: 1.2,  gain: 0.09, lp: 6000, fm: 2.01 },
  organ:   { type: 'sawtooth', oct: 0, dur: 0.6,  gain: 0.045, lp: 1100 },
  bell:    { type: 'sine',     oct: 2, dur: 1.6,  gain: 0.08, lp: 7000, fm: 3.5 },
  blip:    { type: 'square',   oct: 2, dur: 0.09, gain: 0.04, lp: 2000 },
  thump:   { type: 'sine',     oct: -1, dur: 0.4, gain: 0.2, lp: 400 },
  glass:   { type: 'triangle', oct: 3, dur: 0.8,  gain: 0.07, lp: 5000, detune: 7 },
};
const FAMILY: Record<string, keyof typeof VOICES> = {
  domino: 'tick', bead: 'pluck', organ: 'organ', fan: 'glass', contagion: 'blip', flip: 'tick', odometer: 'tick', bloom: 'chime',
  stairs: 'pluck', typewriter: 'tick', feed: 'blip', pendulum: 'bell', cradle: 'glass', marble: 'pluck', ripple: 'chime', life: 'blip',
  sorter: 'blip', escapement: 'tick', hourglass: 'organ', ferris: 'chime', sequencer: 'thump', piston: 'thump', waterfall: 'glass',
  tree: 'chime', calendar: 'tick', roulette: 'tick', safe: 'tick', reels: 'blip', slinky: 'glass', fuse: 'organ', and: 'thump', arbiter: 'thump',
  finale: 'bell', wire: 'tick',
};
const SCALES = [[0, 2, 4, 7, 9], [0, 3, 5, 7, 10], [0, 2, 3, 7, 8], [0, 2, 5, 7, 9], [0, 1, 5, 7, 8]];

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private comp!: DynamicsCompressorNode;
  enabled = false;
  private root = 220;
  private scale = SCALES[0];
  private active = 0;
  private lastT = 0;
  private budget = 0;

  setKey(hue: number, mode: number) {
    this.root = 110 * Math.pow(2, Math.floor((hue % 360) / 30) / 12);
    this.scale = SCALES[mode % SCALES.length];
  }

  toggle(on: boolean) {
    this.enabled = on;
    if (on) {
      if (!this.ctx) {
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.7;
        this.comp = this.ctx.createDynamicsCompressor();
        this.comp.threshold.value = -18; this.comp.ratio.value = 6;
        this.master.connect(this.comp).connect(this.ctx.destination);
      }
      this.ctx.resume();
    } else this.ctx?.suspend();
  }

  freq(note: number): number {
    const n = Math.floor(note), len = this.scale.length;
    const oct = Math.floor(n / len), deg = ((n % len) + len) % len;
    return this.root * Math.pow(2, (this.scale[deg] + 12 * oct) / 12);
  }

  voice(kind: string, note: number, x01: number, vel: number) {
    if (!this.enabled || !this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    if (t - this.lastT > 0.1) { this.lastT = t; this.budget = 14; }
    if (this.budget-- <= 0 || this.active > 36) return;
    const def = VOICES[FAMILY[kind] ?? 'pluck'];
    const f = this.freq(note) * Math.pow(2, def.oct);
    const g = c.createGain();
    const pan = c.createStereoPanner();
    pan.pan.value = clampN(x01 * 2 - 1, -1, 1) * 0.8;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = def.lp;
    const o = c.createOscillator();
    o.type = def.type; o.frequency.value = f; if (def.detune) o.detune.value = def.detune;
    o.connect(lp);
    const stops: AudioScheduledSourceNode[] = [o];
    if (def.fm) {
      const m = c.createOscillator(), mg = c.createGain();
      m.frequency.value = f * def.fm; mg.gain.value = f * 0.8; m.connect(mg).connect(o.frequency);
      stops.push(m);
    }
    if (def.noise) {
      const n = c.createBufferSource();
      n.buffer = this.noiseBuf();
      const ng = c.createGain(); ng.gain.value = def.noise;
      n.connect(ng).connect(lp); stops.push(n);
    }
    lp.connect(g).connect(pan).connect(this.master);
    const a = Math.max(0.005, def.gain * vel);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(a, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + def.dur);
    this.active++;
    for (const s of stops) s.start(t);
    for (const s of stops) s.stop(t + def.dur + 0.05);
    o.onended = () => { this.active--; };
  }

  chord(root: number, vel = 1) {
    for (let i = 0; i < 5; i++) this.voice('finale', root + i * 2, 0.5, vel * 0.9);
  }

  private nb: AudioBuffer | null = null;
  private noiseBuf() {
    if (this.nb) return this.nb;
    const c = this.ctx!;
    const b = c.createBuffer(1, c.sampleRate * 0.2, c.sampleRate);
    const d = b.getChannelData(0);
    let s = 12345;
    for (let i = 0; i < d.length; i++) { s = (s * 1664525 + 1013904223) >>> 0; d[i] = (s / 4294967296) * 2 - 1; }
    return (this.nb = b);
  }
}
const clampN = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
