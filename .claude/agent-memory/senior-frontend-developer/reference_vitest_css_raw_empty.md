---
name: vitest-css-raw-empty
description: In apps/panel vitest, `.css?raw` imports resolve to an EMPTY string (css:false); `.tsx?raw` works — CSS-scanning fitness tests are vacuous
metadata:
  type: reference
---

In `platform/apps/panel` under vitest (v4), importing a stylesheet as raw text
returns an **empty string** — both `import x from './f.css?raw'` and the
`import.meta.glob(['./f.css'], { query:'?raw', import:'default', eager:true })`
idiom. Raw import of `.tsx`/`.ts` source works fine (returns the real source).

**Why:** the panel's vitest config does not process CSS (css:false), so the CSS
module transform yields `''` for raw queries.

**How to apply:** never write a fitness/layout-contract test that asserts on the
TEXT of a `.css` file — it will pass vacuously (negative assertions) or fail on
positive ones. Assert the layout contract on the component's own `.tsx` source
(readable via `?raw`) + rendered DOM structure instead. This is why
[[ff-chrome-token-driven-scans-css-vacuously]] is a latent hole.

Discovered building AR-49 M4 Wave 7 (right-dock FF-RIGHTDOCK-FILLS).
