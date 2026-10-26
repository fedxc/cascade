# Cascade Machine

A self-running Rube Goldberg machine made only of native HTML form controls. No canvas, SVG or images —
checkboxes, radios, sliders, progress bars, meters, selects, number/colour/date inputs, textareas, details
and scroll containers pass real DOM events down chains of contraptions that split, race, merge, loop and end
in a screen-wide detonation, forever.

```
bun install
bun run dev          # http://localhost:3000  (live reload)   ?seed=7  ?debug  ?ts=4  ?solo=tree
bun run build        # → dist/index.html  (single self-contained file, open it directly)
bun test             # unit tests (pure logic)
bun run typecheck
node tests/browser/run.mjs      # Playwright: every contraption, causality, three viewports
node tests/browser/soak.mjs --minutes 10
node tests/browser/shots.mjs --seed 7 --times 5,20,60 --debug
node tests/browser/finale.mjs --seed 7
node tests/browser/contact.mjs --only tree,sorter,life   # contact sheet of single contraptions
```

URL flags: `?seed=N` reproduces a run's plan exactly (otherwise a random seed is logged to the console),
`?debug` shows seed / cycle / phase / active contraptions / chain graph / fps, `?ts=N` time-scales the
clock (testing), `?nowd` disables watchdogs (testing), `?solo=<kind>` loops one contraption alone.
The tiny circle at the bottom-right corner turns generated audio on (muted by default).

See PLAN.md (architecture, pacing, palette) and CRITIQUE.md (self-critique rounds).
