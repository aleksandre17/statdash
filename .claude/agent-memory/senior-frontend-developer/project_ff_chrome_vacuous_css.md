---
name: ff-chrome-token-driven-scans-css-vacuously
description: FF-CHROME-TOKEN-DRIVEN's studio.css leg is a vacuous scan (raw CSS resolves empty under vitest) — real color literals in studio.css would NOT be caught
metadata:
  type: project
---

`platform/apps/panel/src/studio/chromeTokenDriven.fitness.test.ts` scans the
Studio chrome frame sources for hardcoded brand color literals via
`import.meta.glob(..., { query:'?raw' })`. Its 4 `.tsx` sources scan correctly,
but `studio.css` resolves to `''` (see [[vitest-css-raw-empty]]), so the
per-file `findBrandColorLiterals(studio.css)` assertion passes on empty content.

**Why it matters:** a hardcoded `#hex`/`rgb()`/`hsl()` planted in `studio.css`
would NOT fail the gate — the stylesheet leg is a false-green. The `.toHaveLength(5)`
count still holds (the key exists) but the content is never inspected.

**How to apply:** if hardening the token-driven invariant, move the CSS leg off
`?raw` (e.g. a build-step scan of the file on disk, or enable vitest CSS
processing for this test). Owned by the theming/palette track (out of scope for
Wave 7 — flagged, not fixed). Not urgent; brand literals in studio.css are also
caught by review + the `.tsx` sources are genuinely scanned.
