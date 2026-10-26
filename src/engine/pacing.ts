// PURE pacing curves. Tempo is a function of chain *progress* (0..1) so the arc survives any branching.
import { clamp, smooth } from './geometry';

export type Phase = 'windup' | 'rolling' | 'building' | 'hush' | 'crescendo' | 'finale';

export const PACE = {
  windupEnd: 0.12,
  rollEnd: 0.45,
  buildEnd: 0.68,
  hushEnd: 0.82,
};

export function phaseAt(p: number): Phase {
  if (p < PACE.windupEnd) return 'windup';
  if (p < PACE.rollEnd) return 'rolling';
  if (p < PACE.buildEnd) return 'building';
  if (p < PACE.hushEnd) return 'hush';
  if (p < 1) return 'crescendo';
  return 'finale';
}

/** `t` = virtual seconds since ignition, `ph` = per-cycle phase offset for the bursts */
export function tempoAt(p: number, t = 0, ph = 0): number {
  p = clamp(p, 0, 1);
  const burst = Math.pow(Math.max(0, Math.sin(t / 7.3 * Math.PI * 2 + ph)), 5); // brief 0..1 spikes
  let base: number;
  if (p < PACE.windupEnd) base = 0.42 + 0.3 * smooth(p / PACE.windupEnd);
  else if (p < PACE.rollEnd) base = 0.9 + 0.2 * smooth((p - PACE.windupEnd) / (PACE.rollEnd - PACE.windupEnd));
  else if (p < PACE.buildEnd) base = 1.1 + 0.6 * smooth((p - PACE.rollEnd) / (PACE.buildEnd - PACE.rollEnd));
  else if (p < PACE.hushEnd) {
    const k = (p - PACE.buildEnd) / (PACE.hushEnd - PACE.buildEnd);
    base = 1.7 + (0.3 - 1.7) * smooth(Math.min(1, k * 3)); // crash into the hush quickly, then hold
  } else base = 0.32 + 2.9 * smooth(Math.min(1, (p - PACE.hushEnd) / (1 - PACE.hushEnd)));
  const burstGain = p > PACE.windupEnd && p < PACE.buildEnd ? 0.9 : 0.15;
  return clamp(base * (1 + burst * burstGain), 0.18, 4.2);
}

/** how much of the ambient light is dimmed (the hush draws the lights down) */
export function dimAt(p: number): number {
  if (p < PACE.buildEnd) return 0;
  if (p < PACE.hushEnd) return 0.55 * smooth((p - PACE.buildEnd) / (PACE.hushEnd - PACE.buildEnd));
  return 0.55 * (1 - smooth((p - PACE.hushEnd) / (1 - PACE.hushEnd)));
}
