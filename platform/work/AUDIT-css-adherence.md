# CSS Adherence Audit — statdash-platform

> Audits the current codebase against `DESIGN-css-responsive-standard.md`. **AUDIT-ONLY** — no product
> CSS/TSX modified (a chart-fix agent is editing chart files concurrently; demo tomorrow). Findings are
> static-source analysis (grep + read across every source `*.css`, excluding `dist/`). Visual behaviour
> cross-referenced against the prior real-browser pass in `AUDIT-responsive.md` (Chromium, 54 shots).
>
> **Headline:** the system is *fundamentally sound and already well co-located* — co-location and
> BEM-agnostic naming are essentially done, the token spine is rich, container queries and a fluid type
> scale already exist. The gaps are narrow and mechanical: (a) breakpoint SSOT is not projected to CSS
> (literals hand-typed, a few off-scale), (b) ~56 magic shadow/radius/rgba literals in shells, (c) shells
> are authored desktop-first vs the mobile-first standard. None require new architecture.

---

## 1. Stylesheet inventory — every source `*.css`

Legend — **Loc**: Central (C) / Node-local (N) / React-global (RG). **BP**: breakpoint strategy.
**BP-token**: are the `@media`/`@container` thresholds on the 6-step scale? **Mag**: count of magic
shadow/radius/rgba literals (token violations).

| # | File | Loc | BP strategy | BP-token | Mag | Notes / violations |
|---|------|-----|-------------|----------|-----|--------------------|
| 1 | `styles/css/tokens.css` | C | `prefers-color-scheme` only | n/a | — | The token SSOT. Correct. Breakpoints absent here (correctly — they're TS, §4). |
| 2 | `styles/css/node-styles.css` | C | `@media`+`@container` max-width, full 6-step | ✅ on-scale | — | The engine. Exemplary. **Hand-maintained, not generated** → SSOT-projection gap (should be codegen'd from `BREAKPOINTS`). |
| 3 | `styles/css/card.css` | C | `@container` | ✅ | (see §3) | `.sc`/`.panel` card primitive. Container-queried. Good. |
| 4 | `styles/css/animations.css` | C | `prefers-reduced-motion` | n/a | — | Correct, a11y-honoring. |
| 5 | `react/src/styles/index.css` | RG | — | n/a | — | Import manifest. Correct order (tokens → engine → react globals). |
| 6 | `react/src/styles/a11y.css` | RG | — | n/a | — | `.sr-only` hardened (R1 fix landed: `clip-path: inset(...)`). Guarded by reflow fitness test. |
| 7 | `react/src/styles/slot.css` | RG | — | n/a | — | Slot scaffolding. Fine. |
| 8 | `react/src/styles/chrome-region.css` | RG | — | n/a | — | Region scaffolding. Fine. |
| 9 | `react/src/styles/panel-layout.css` | RG | `@media` max-width **1280** | ✅ | — | Generic `.panel-row/.panel-col` grid. Desktop-first (`max-width:1280 → 1fr`). Legit react-global. |
| 10 | `react/src/components/feedback/feedback.css` | RG | none (`max-width:280px` cap) | n/a | — | Fine. |
| 11 | `react/src/components/PropSchemaForm.css` | RG | — | — | — | Constructor form. Fine. |
| 12 | `plugins/nodes/layout/layout.css` | N | `@container` cols+grid, 6-step + `@media` 480 fallback | ✅ | — | **Reference-quality** — container-first, full scale, viewport fallback only at 480. The model. |
| 13 | `plugins/nodes/hero/default/hero.css` | N | `@media` **1100, 700, max-height:860** | ❌ off-scale | **5** | Off-scale BPs; magic `border-radius:18px/10px`, `box-shadow:0 4px 20px rgba(...)`, `border:2.5px`, `translateY(-6px)`. Desktop-first. |
| 14 | `plugins/nodes/section/default/section.css` | N | none | n/a | 8 | 8 magic shadow/radius literals. |
| 15 | `plugins/nodes/stats-carousel/default/stats-carousel.css` | N | `@media` **700, max-height:860**, `max-width:1280` | ❌ off-scale | 6 | Off-scale; `max-width:1280` literal (should be `--size-container-wide`). Desktop-first. |
| 16 | `plugins/nodes/filter-bar/default/filter-bar.css` | N | `@media` max-width **1280** | ✅ | 3 | On-scale. `max-width: min(100%, var(--size-container-narrow))` — good token use. Desktop-first. Mobile `<select>` width (R/F5). |
| 17 | `plugins/nodes/page-header/.../page-header.css` | N | `@media` max-width **1280** | ✅ | 3 | On-scale. Desktop-first. |
| 18 | `plugins/nodes/perspective-bar/default/perspective-bar.css` | N | none | n/a | 1 | 1 magic literal. |
| 19 | `plugins/chrome/app-header/default/app-header.css` | N | `@media` **960**, 640 | ⚠ 960 off, 640 on | 2 | Off-scale 960; `max-width:1280` literal → `--size-container-wide`/`--page-measure`. R2 history (min-width:0 fix landed). Desktop-first. |
| 20 | `plugins/chrome/app-header/transparent/...css` | N | — | — | — | Visual variant. Fine. |
| 21 | `plugins/chrome/app-footer/default/app-footer.css` | N | `max-width:1280` cap | n/a | — | `max-width:1280` literal → token. |
| 22 | `plugins/chrome/inner-sidebar/default/inner-sidebar.css` | N | `@media` **1100, 1280** | ⚠ 1100 off | 9 | Off-scale 1100; **9 magic literals** (highest). Desktop-first. |
| 23 | `plugins/chrome/locale-switcher/default/...css` | N | none | n/a | 1 | 1 literal. |
| 24 | `plugins/pages/inner-page/default/page-layout.css` | N | `@media` max-width **1280** | ✅ | 2 | On-scale. **`--page-measure` seam present (R3 fix)** — the good measure pattern. Desktop-first. |
| 25 | `plugins/pages/tab-page/default/tabs.css` | N | `@media` max-width **640** | ✅ | 3 | On-scale. Desktop-first. |
| 26 | `plugins/pages/container-page/landing/landing.css` | N | `@media` **1100, max-height:860** | ❌ off-scale | — | Off-scale. Strongest page visually (audit F15) but off-scale BPs. |
| 27 | `plugins/panels/chart/default/chart.css` | N | `@media` max-width **1280** | ✅ | — | On-scale. *(Chart agent may be editing — coordinate.)* |
| 28 | `plugins/panels/chart/.../chart-placeholder.css` | N | none | n/a | 1 | 1 literal. |
| 29 | `plugins/panels/table/.../data-table.css` | N | none (`min/max-width` content sizing) | n/a | 5 | In-card `overflow-x:auto` correct (audit F10). 5 literals. |
| 30 | `plugins/panels/kpi-strip/.../kpi.css` | N | `@media` max-width **1280** | ✅ | 4 | On-scale. Desktop-first. |
| 31 | `plugins/panels/map/default/map.css` | N | none | n/a | 2 | 2 literals. |
| 32 | `plugins/panels/text/default/text.css` | N | none | n/a | 1 | 1 literal. |
| 33 | `plugins/panels/gauge/default/gauge.css` | N | none | n/a | — | Fine. |

**App-layer** (`apps/*`): `apps/geostat/src/shared/styles/{index,inner}.css` — `inner.css` uses `@media
max-width:640` (on-scale), `index.css` `max-width:1280` literal. `apps/panel/src/**` (Inspector, canvas,
outline, command, LocaleField) — Constructor authoring UI, not part of the rendered-dashboard surface;
breakpoint-light, a few literals. Lower priority (internal tooling, not tenant-facing output).

---

## 2. Adherence scorecard (against the 5 spine laws)

| Law | State | Evidence |
|---|---|---|
| **1 · Co-location** | ✅ **~done** | Every shell/node/panel owns its CSS, imported in TSX. No node BEM rules stranded in central files. Central files carry only framework hooks (`[data-*]`, `.panel-row`, `.sc`). This law is essentially satisfied — credit the prior CSS-architecture work. |
| **2 · Token spine** | 🟡 **strong, two gaps** | Spine is rich (3-tier color, fluid type, full scale). Gaps: (a) **breakpoints not projected to CSS** — literals hand-typed, 4 off-scale (960/1100/700/860); (b) **~56 magic shadow/radius/rgba literals** across 16 node CSS files. |
| **3 · Mobile-first** | 🔴 **inverted** | Shells + the engine are authored **desktop-first** (`max-width` down). The standard mandates mobile-first `min-width` for hand-authored CSS (engine keeps max-width by §4.3 exception). This is the largest *directional* gap — and the riskiest to close. |
| **4 · Container-first** | 🟡 **half-adopted** | `layout.css`, `card.css`, `[data-aspect]` use `@container` (exemplary). But most shells use viewport `@media` where `@container` would compose better under nesting. Acceptable for true chrome (header); a gap for in-content nodes. |
| **5 · Invariants guarded** | 🟡 **one of seven** | I1 reflow guarded (R1 test) + reduced-motion + token-parity tests exist. I2/I3/I5/I6 have no guard yet. |

---

## 3. Magic-literal hotspots (Law 2b)

56 hardcoded `box-shadow: 0 …` / bare-px `border-radius` / `rgba(0,0,0,…)` occurrences across 16 files.
Worst: `inner-sidebar.css` (9), `section.css` (8), `stats-carousel.css` (6), `hero.css` (5),
`data-table.css` (5), `kpi.css` (4). Most are decorative shadows/radii that have an exact token equivalent
(`box-shadow: 0 1px 3px rgba(0,0,0,0.04)` ≡ `--shadow-card`; `border-radius: 8px` ≡ `--radius-md`;
`0.5rem` ≡ `--spacing-sm`). Substituting a literal for its **value-identical token is visually
byte-identical** → SAFE — but spans 16 files, so batch *after* the demo to avoid conflicting with the
chart agent's concurrent edits.

---

## 4. Off-scale breakpoint literals (Law 2a / I5)

| Literal | Files | Nearest scale | Snap risk |
|---|---|---|---|
| `960px` | app-header (nav collapse) | `lg 1024` or `md 768` | **RISKY** — changes the exact width the nav hides; the 960 was tuned to the Georgian nav width. Verify in browser. |
| `1100px` | hero, stats-carousel, inner-sidebar, landing | `lg 1024` or `xl 1280` | **RISKY** — changes card-grid reflow point. Verify. |
| `700px` | hero, stats-carousel | `md 768` or `sm 640` | **RISKY** — changes 2-col→1-col point. Verify. |
| `max-height: 860px` | hero, stats-carousel, landing | (height axis — not in scale) | Separate concern: short-viewport tuning. Add a `--bp-h-*` height-axis token to the SSOT, *or* replace with fluid `clamp()` (hero already uses `vh`-based clamps inside it). RISKY. |
| `max-width: 1280px` (layout cap, not `@media`) | app-header, app-footer, hero, stats-carousel, geostat index | `var(--size-container-wide)` (=1280) | **SAFE** (byte-identical token swap) — and unifies the page measure (R3). The lowest-risk, highest-coherence win. |

Note: `max-width:1280` as a *container cap* is the one off-scale-adjacent item that is SAFE to tokenize
(the token equals the literal). The `@media` thresholds (960/1100/700) are *behavioral* — snapping them
moves the breakpoint, so they are RISKY and need real-browser verification.

---

## 5. Prioritized, reversible alignment plan

### (a) SAFE — visually byte-identical, reversible, executable any time

These change *representation*, not rendered pixels. Each is a token swap whose token value equals the
literal; reverting is a one-line git revert.

| # | File(s) | Change | Risk | Verification |
|---|---|---|---|---|
| S1 | app-header, app-footer, hero, stats-carousel, geostat `index.css` | `max-width: 1280px` → `max-width: var(--size-container-wide)` (and prefer `--page-measure` where it's the page column). | None (token = literal). | Build + 1 screenshot at 1920 (cap unchanged). |
| S2 | 16 node CSS files (§3) | Replace value-identical magic literals: `box-shadow: 0 1px 3px rgba(0,0,0,0.04)`→`var(--shadow-card)`, `border-radius: 8px`→`var(--radius-md)`, `0.5rem` gap→`var(--spacing-sm)`, etc. Only where token value is exact. | None per-swap. | Token-parity reasoning + spot screenshots; do as one reviewable commit. |
| S3 | `styles` package | Add the generated `@custom-media --bp-*` partial (from `BREAKPOINTS`) **as an inert file** — defined but not yet consumed. | None (no consumer yet). | Builds; no visual change. |
| S4 | tests | Add I5/I6 fitness scans as **skipped/todo** gates (would fail today) that flip on post-wave. | None. | Test suite green (skipped). |

**Caveat for before-the-demo:** S1–S4 are individually safe, but the chart agent is editing
`panels/chart/**` and a token-swap wave touches many files. To not jeopardize the demo, the recommendation
is to land **only S1 + S3 + S4** (small, isolated, zero chart-file overlap) if anything at all, and defer
S2 (16-file sweep) to the post-demo wave. Honestly: the lowest-risk path is to ship the two docs now and
execute even the SAFE set *after* the demo, when files aren't moving under us.

### (b) RISKY — behavioral / cascade changes, per-change real-browser verification

These move rendered pixels and MUST each be verified across the resolution ladder before/after. **None
before the demo.**

| # | File(s) | Change | Risk | Verification needed |
|---|---|---|---|---|
| R1 | hero, stats-carousel, inner-sidebar, landing, app-header | Snap off-scale `@media` (960/1100/700) to scale tokens. | Moves the breakpoint → reflow point shifts; could re-introduce the R2-band overflow if mis-snapped. | Real-browser ladder (320→3440) before/after on each affected page; diff screenshots. |
| R2 | All hand-authored shells | **Invert desktop-first → mobile-first `min-width`** (base = smallest, enhance up). | Largest surface; every reset flips; easy to drop a wider-screen rule. | Per-node, Strangler-Fig (one node per commit), full ladder verify each. Not a big-bang. |
| R3 | Shells using `@media` for in-content nodes | Convert viewport `@media` → `@container` where the node should respond to its slot. | Requires an ancestor `container-type`; nested behavior changes (intended, but must be checked). | Verify in 1/1 vs 1/3 column placements; nested-layout shots. |
| R4 | `node-styles.css` | Replace the hand-maintained per-property cascade with **codegen from `BREAKPOINTS`**. | The engine is load-bearing for every node; generated output must be byte-diffed against current. | Snapshot the generated CSS == current file (must be identical), then switch source. |
| R5 | `max-height:860` tuning | Add height-axis BP token or fluidize. | Short-viewport behavior. | Verify at constrained heights (laptop 1366×768, split-screen). |
| R6 | platform-wide | Adopt `@layer` ordering. | Reorders the entire cascade; the few `!important`s interact. | Full visual regression; only if specificity wars justify it (currently they don't — YAGNI, likely defer indefinitely). |

### Sequencing

1. **Now (pre-demo):** ship these two docs. Optionally S1 + S3 + S4 only (isolated from chart files). Touch
   no chart CSS, run no RISKY item.
2. **Post-demo wave 1:** S2 magic-literal sweep (one commit) → R4 engine codegen (byte-identical switch) →
   R1 off-scale snap (browser-verified per page).
3. **Post-demo wave 2 (Strangler-Fig):** R2 mobile-first inversion, one node per commit, ladder-verified;
   R3 container-query conversion alongside. R5 with R1.
4. **Deferred / YAGNI:** R6 `@layer` — adopt only if an override war appears.

---

## 6. Bottom line

The platform is **not missing a CSS system** — it has a strong one (co-located, tokenized, container-aware,
fluid-typed, fitness-guarded on the one P0 invariant). Adherence gaps are mechanical and reversible:
project the breakpoint SSOT into CSS (kill hand-typed + off-scale literals), tokenize ~56 decorative magic
values, and migrate authoring direction desktop-first → mobile-first node-by-node. The only items safely
shippable before the demo are isolated token-swaps (S1/S3/S4) — and the honest senior call is to ship the
docs now and execute even those after the demo, because files are moving under a concurrent chart-fix agent
and the demo is the priority. Every behavioral change (off-scale snap, mobile-first inversion, container
conversion, engine codegen) is RISKY and gets real-browser before/after verification, post-demo.
