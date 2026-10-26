# CRITIQUE

Honest self-review after looking at real footage (screenshots at 390×844, 1440×900, 2560×1080, a contact
sheet of every contraption running alone, and a frame-by-frame capture of the finale). Each round lists what
is weak, then what was done, and the result is judged again in the next round.

---

## Round 1 — first complete build (33 contraptions, engine, tests passing)

### The 5 weakest moments

1. **The finale is a polite firework, not a detonation.** The screen-wide lattice wave lights thin, small dots
   and is over in about a second; the machines' "flourish" is a brightness bump that barely reads. Only the
   corner holding the finale rings feels like an event. *Should be the piece's best 5 seconds.*
2. **Dead air.** At any instant 1–3 of ~20 machines are moving. Everything else is a static dim diagram
   waiting for its turn, and the lattice only sparkles near activity. It reads as "a diagram being traced",
   not "a machine".
3. **The hush does nothing but slow down.** Tempo drops and a vignette appears, but there is no visual
   tension — no accumulation, no dimming of the field, no sense that something is being held back.
4. **Wires are the same wire.** Bezier curves of identical pips, crossing straight through other machines.
   The `rail` and `slider` carriers are rarer and thinner, so the network reads as one texture. Colour
   gradient along the wire is too subtle to "follow the energy".
5. **Small, dim, clipped.** Idle controls are close to the background; typewriter / waterfall text is
   unreadable at real footprint sizes (r ≈ 80–110 px); several machines hang off the screen edge (the
   odometer on the left, the feed at the bottom), so "full bleed" turns into "cropped".

### What's boring / generic
* Every contraption ends with a diamond "lamp" checkbox that the wire attaches to. Functional, repetitive.
* Palette modes differ only in hue; saturation/lightness are constant, so the piece has one "voice".
* The lattice is one species of dot. Beautiful at rest, monotonous in motion.
* No sound has been listened to; it is only verified to run without errors.

### Fixes applied after round 1
* Finale: second flare of every machine after ~1.9 s, a rain of ~70 sparks across the screen, a radial
  CSS flash from the detonator, larger/longer lattice cells in the boom waves, detonator → exit delayed to
  4.3 s, lattice dims during the hush so the boom lands harder.
* Dead air: idle machines now *breathe* (CSS opacity cycle with per-machine phase) and shed faint
  sparkles into the lattice every 4–11 s; the planner makes more splits (≈ machines/4.6) and 1–3 loops
  per cycle so more branches run at once.
* Hush softened from 0.24 → 0.30 tempo (it was long enough to feel stalled).
* Layout keeps circle centres ≥ 0.78 r from the edges (was 0.55 r).
* Lattice density reduced (it had ~35 % too many cells); idle control colour lightened.

(Round 2 follows once these are re-examined in footage.)

---

## Round 2 — after the round-1 fixes (finale capture, full browser suite green)

### What improved
* The finale now reads as an event: radial flash, multi-hue lattice burst, a second flare of every machine
  ~2 s later, a rain of sparks, a long tail. The previous version was over in about a second.
* Hush → boom contrast is real: the field dims during the hush, then lights up.
* Phone, desktop and ultrawide all compose; the layout keeps machines away from the edges.

### The 5 weakest moments that remain
1. **The finale rings still live in one place.** Detonation is screen-wide, but the structure that explodes is
   a single ring cluster in a corner. The best version would have every machine *visibly* detonate in a
   wavefront, not just brighten.
2. **Quiet middles.** Even with breathing and more splits, long stretches have 2–3 active contraptions;
   the slow ones (hourglass, fuse, escapement) are deliberate fuses but, stacked, can feel idle.
3. **Collisions are subtle.** The arbiter's loser shakes and fires a lattice ping, but at normal scale it is
   easy to miss that a race was lost — it deserves its own bigger visual.
4. **Wire routing ignores machines.** Pulses pass straight through other contraptions; it looks organic
   but sometimes buries a wire under a busy machine.
5. **Sound is unverified by ear.** It is generated, muted by default and error-free, but I have not
   listened to it; the voices/scales are untuned guesses.

### What is still generic
* Many contraptions end the same way (a lamp checkbox); the wire handoff could be more varied.
* Typewriter / waterfall text is tiny at real footprint size.
* Only three wire carrier types, and the progress/slider carriers are less common than checkbox pips.

### Honest limits of the verification
* Frame time was measured in headless Chromium with software rendering; the density governor kicked in at
  2560×1080 (level 3), which is exactly its job, but real-GPU 60 fps is not demonstrated here.
* Determinism: plans (kinds, layout, wiring, palette) reproduce exactly per `?seed`; event timing is
  virtual-time deterministic except for browser-native async events (transitionend, IntersectionObserver,
  scroll, details toggle), which can reorder slightly between runs.
* Soak: two 10-minute runs at 1440×900 — no stalls, no errors, flat heap/DOM/listeners, zero watchdog exits.
  Phone/ultrawide were exercised for correctness and layout, not for 10 minutes each.
