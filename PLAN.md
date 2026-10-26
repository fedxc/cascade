# CASCADE MACHINE — PLAN

A full-bleed, self-running Rube Goldberg machine built from nothing but native HTML form controls.
This file is the working plan; it is kept in sync with the code (see "Status" at the bottom).

## 1. Principles

1. **Every hop is an event.** A contraption's exit is a native (or control-dispatched) DOM event on a
   real control. A *wire* listens to that event, then walks a pulse along a line of tiny checkboxes /
   progress rails / sliders — each pip's `change`/`input`/`transitionend` triggers the next. The last
   pip pokes the next contraption's entry control (`el.click()` on a real checkbox/button/radio), whose
   own listener starts that contraption. Delete or `disable` any control on the path and the chain
   stops right there (`poke()` refuses disabled / detached targets).
2. **Virtual-time clock.** All delays go through one rAF-driven clock (`engine/clock.ts`). Handlers run
   at their *due time*, and schedule relative to it, so ordering is independent of frame jitter. That
   gives batched writes, a single timer heap (no timer leaks), tempo control, `?ts=` time-scaling for
   tests, and reproducible event order for a given seed (plans — layout, kinds, wiring, palette — are
   100 % reproducible; browser-native async events such as `transitionend`/IntersectionObserver are
   best-effort).
3. **Watchdogs everywhere.** Every node has a watchdog on the virtual clock. If a contraption was
   entered but never exits, `force()` fires its exit event and the stall is counted (`stats.forced`).
   The soak test asserts that forced exits are rare — watchdogs are a net, not a crutch.
   A cycle-level watchdog forces the finale if a cycle runs too long.
4. **Seeded everything.** `?seed=N` (else random, logged). No `Math.random` in `src/` (a unit test greps).
5. **Scopes, not leaks.** Every listener, timer, tween and observer lives in a `Scope`; a cycle's
   teardown disposes its scope tree. The soak test samples heap, DOM node count and CDP listener count.

## 2. Architecture

```
src/
  main.ts                 entry: params, stage, director boot, resize, debug
  engine/
    prng.ts               mulberry32, Rng (range/int/pick/shuffle/fork/gauss)
    clock.ts              virtual-time timer heap + tweens (rAF-driven)
    scope.ts              disposal scope: on/after/tween/observe, live counters
    geometry.ts           PURE: curves (bezier, spiral, lissajous, 8), arc-length sampling,
                          hex lattice, force layout of circles along a flow skeleton
    graph.ts              PURE: chain-graph generation (split/merge/race/loop) + validation
    pacing.ts             PURE: tempo/phase curves over cycle progress
    color.ts              palette modes, hue-by-depth, css helpers
    kit.ts                control factories + placement helpers + poke/emit/flash
    types.ts              Contraption / Machine / Ctx / Fx interfaces
    node.ts               runtime node: tokens, AND/arbiter semantics, watchdog, forwarding
    wire.ts               carriers: pips (checkboxes), rail (progress), slider chain
    plan.ts               a cycle plan = graph + layout + hues + wire styles; mutate(prev) → next
    director.ts           cycle loop: plan → build → ignite → run → finale → stillness → rebirth
    debug.ts              ?debug overlay (seed, cycle, active, graph text, fps)
  lattice/lattice.ts      background field of tiny checkboxes + radios, ripples, adaptive density
  audio/audio.ts          Web Audio, generated, muted by default, one tiny control
  contraptions/*.ts       one file per contraption + index.ts registry
scripts/                  assemble.ts (inline CSS+JS → one html), build.ts, dev.ts
tests/unit/               bun test — pure logic only
tests/browser/            Playwright (Node): shots, causality, soak, viewports
```

### Contraption contract

```ts
build(ctx) → Machine {
  entries: HTMLElement[]        // poke(entries[i]) starts the contraption (port i)
  exit: { el, type }            // the event that means "I'm done"; wires listen to it
  entryPts, exitPt              // local coordinates for wire anchoring
  reset(), flourish(), budgetMs, collide?(port)
}
```

`ctx` supplies: local→world `hit(x,y,strength,note)` (feeds lattice ripples and audio), seeded `rng`,
`hue` for the node, `scope`, `tempo()`, unit scale `u`, radius `r`.

### Graph (series–parallel with extras)

* **split**: a node with two or more out-edges (the same exit event drives both wires).
* **merge (AND)**: `AndGate` waits for a token on every port (latch checkboxes) and then slams a bar.
* **race (arbiter)**: `Arbiter` — a radio group; first arrival wins and continues, the loser *collides*
  (shockwave in the blended hue, shake) and dies.
* **loop**: a back-edge on a linear run, with `maxPasses`; the node re-enters itself via a visible
  curved return wire. A pass counter decides back vs. forward.
* **finale**: single sink. The cycle ends only when the finale's detonator fires.
* Pure `validateGraph` checks: reachability from source, every node reaches the finale, no dead ends,
  merge in-degree == ports, back-edges are on linear runs and bounded.

### Pacing arc (function of chain *progress*, not wall time)

| progress | phase | tempo |
|---|---|---|
| 0 – .12 | wind-up: slow fuse | 0.40 → 0.7 |
| .12 – .45 | rolling, bursts of 1.6× | 1.0 ± bursts |
| .45 – .70 | acceleration | 1.1 → 1.7 |
| .70 – .84 | **hush** — a long, nearly stopped fuse | 0.25 |
| .84 – 1 | crescendo | 1.0 → 3.0 |
| finale | implosion → detonation → ripples across the screen | |
| after | stillness (≈5 s) → rebirth | |

Individual contraptions can opt out of tempo (sand timer, spiral fuse are "slow fuses" and always drag).

### Recurrence / mutation

`mutate(plan_n, rng)` keeps ~60 % of the contraption kinds in place, swaps the rest, re-draws
topology (new split/merge/loop), drifts base hue and palette mode, perturbs the skeleton curve and
node radii. `cycle(n+1)` is seeded by the final hue and counter of cycle `n` — the end feeds the start.

### Lattice

A hex lattice with jitter, density-field culled (blobs + flow-skeleton falloff, deliberate voids). Cells
are 70 % checkboxes (dots/diamonds) and 30 % radios in small groups. A single delegated `change`
listener turns every `ping(x,y)` (a real `click()` on the nearest cell) into an expanding ring of
light. FPS monitor raises/lowers a hidden-cell level automatically.

### Palette

Dark aubergine/ink ground. Per-cycle palette mode (analogous / split / triad / duotone / ember /
tide); node hue = f(depth along the chain) so colour *is* the flow of energy. Activation is bright
(quick-in), decay is slow (CSS transitions). Hue drifts a little every cycle.

## 3. Contraptions (30 + 3 structural; 21 invented)

Starter set from the brief (11): `domino`, `bead` (spiral / figure-eight / Lissajous radio path), `organ`
(rotated progress pipes), `fan` (peacock sliders), `contagion` (button flood fill), `flip` (split-flap
selects), `odometer` (carrying number inputs), `bloom` (colour pickers), `stairs` (details), `typewriter`
(textareas + carriage-return buttons whose click `focus`es the next), `feed` (self-scrolling rows checked
by an IntersectionObserver).

Invented / from the "push further" list (19):

| kind | what it misuses | event that carries the baton |
|---|---|---|
| `pendulum` | rotated slider swinging, damped | zero-crossing `input` → tick radios |
| `cradle` | Newton's cradle of checkbox balls on slider strings | `change` of each ball pokes its neighbour |
| `marble` | a lit checkbox falling down zig-zag columns, bouncing | each cell's `change` → next cell, gravity delays |
| `ripple` | two-source interference on concentric checkbox rings | `change` flood, double hits flare |
| `life` | Conway on a checkbox disc, seeded by the cascade | last `change` of a generation starts the next |
| `sorter` | vertical sliders bubble-sort themselves | swap-complete `change` → next compare |
| `escapement` | a `meter` (red→amber→colour) ticking a gear train of radios | meter `change` per tick |
| `hourglass` | draining progress columns with filling twins (slow fuse) | 40 % drained → `input` starts next column |
| `ferris` | wheel of selects advanced on CSS `transitionend` | native `transitionend` |
| `sequencer` | circular drum machine, radio playhead | playhead radio `change` |
| `piston` | four sliders firing in order; number-input rev counter | stroke peak `change` |
| `waterfall` | stepped textareas spilling characters | `input` on the receiving textarea |
| `tree` | fractal tree that *spawns* new slider branches at runtime | branch `change` spawns children |
| `calendar` | stacked date inputs flicking days, tearing away | `input` per flick, `change` per tear |
| `roulette` | radio ring, decelerating ball | radio `change` with growing delay |
| `safe` | number dials locking one by one, `<details>` door opens | dial `input`, door `toggle` |
| `reels` | listbox selects spun by scrolling (native `scroll` events) | reel `change` brakes the next |
| `slinky` | wave along a row of sliders that reflects at the end | peak `input` kicks neighbour |
| `fuse` | spiral of meters burning slowly (colour = heat) | meter `input` at 70 % |

Structural: `and` (merge: latches + slamming bar), `arbiter` (race: radio group, loser *collides*),
`finale` (implosion rings → detonator → screen-wide boom).

## 4. Cycle timeline

1. Rebirth (≈3 s): lattice breathes in, contraptions fade/scale in staggered, wires drawn dim.
2. Ignition: a click on the source's ignition control — the last event of the previous cycle's finale
   (cycle 1: `DOMContentLoaded` + settle).
3. Run with pacing arc above; branches race; AND/arbiter gates resolve; one loop may replay a section.
4. Hush → crescendo → implosion → **detonation**: lattice shockwaves (multi-centre, hue sweep), every
   machine `flourish()`es with distance-based delay, wires flash, chord.
5. Stillness (≈5 s): everything dims; a single dim heartbeat; then the director disposes the cycle.

## 5. Verification

* `bun test` — prng determinism, geometry bounds/spacing, graph validity over thousands of seeds,
  pacing arc shape, clock determinism, no-Math.random grep.
* Playwright: timed screenshots for fixed seeds at three viewports, zero console errors, causality test
  (disable one pip / entry → downstream never runs; with watchdog on, it recovers), 10-minute soak
  (stall detection via stats, heap + DOM node + listener counts).
* CRITIQUE.md — at least two honest self-critique → fix rounds.

## Status

(updated as work proceeds — see bottom of CRITIQUE.md for the iteration log)
