# DESIGN — Context-Proportional Panel Sizing (AR-8 elevation)

> DESIGN-ONLY. Read-only senior audit + best-concept model + tight build spec.
> Supersedes the sizing half of `DESIGN-panel-sizing-cqi.md` by REFINEMENT (not overturn).
> Owner problem (AR-8, still open): panel/section sizing must use the BEST RATIO on HEIGHT **and**
> WIDTH — dynamically calculated, agnostic, always optimal. A SOLO panel should be TALLER than a
> PAIRED one (more focus); ratios must adapt to layout context, never a uniform clamp.

---

## 1. Prior-decision reconciliation (Chesterton's fence — read before designing)

**What the prior decision ruled** (`DESIGN-panel-sizing-cqi.md`, `AUDIT-BRIEF-styles-responsive.md`,
shipped `84d8a93`): retire the CSS `aspect-ratio` **property** and the per-breakpoint `--ar-*` cascade;
size every data panel from ONE honest fluid band —

```
--size-panel-height: clamp(380px, 64cqi, 560px)   /* floor, cqi-fluid, cap */
```

consumed as a **flex-basis on the content body** (`.section__body` / `.panel__body`), with
`align-items: stretch` on the layout node giving equal-height siblings.

**Why they retired `aspect-ratio`** (the fence — and it is SOUND): `aspect-ratio` + `max-height` is a
self-contradiction. `aspect-ratio` derives height from width; `max-height` then caps it; past a crossover
width the *declared ratio is silently violated* (a "16:9" panel stops being 16:9). A height band is one
**monotonic** constraint — honest at every width. **This reasoning is correct and I KEEP it.**

**Verdict: KEEP the core, REFINE the middle term. This is a conscious evolution, not a re-addition of
`aspect-ratio`.** The prior model is 90% right. Its ONE weakness is that it conflates *proportion* with a
single hardcoded scalar:

- `64cqi` is literally `calc(0.64 * 100cqi)` — a **fixed 0.64 aspect coefficient applied to every panel,
  every role, every context.** A chart, a map, and a KPI strip all get the same 0.64 shape.
- The **absolute-pixel bounds** (`380px` floor, `560px` cap) *pin the shape* across most of the ladder.
  Worked example at a 1440 viewport (`--page-measure ≈ 1280`):
  - **Solo** section: container ≈ 1280 → `64cqi = 819` → **capped at 560** → effective aspect **0.44**
    (a wide letterbox — not a focus shape).
  - **Paired** panel: container ≈ 630 → `64cqi = 403` → aspect **0.64**.
  - So solo is *technically* taller (560 vs 403) but pinned to the cap and shape-distorted; the two read
    as roughly uniform-height, and neither lands on a content-optimal ratio. This is exactly what the
    owner sees: "UNIFORM, not context-proportional."

**Root cause (5-whys):** the band is *width-proportional but not proportion-proportional.* The coefficient
`0.64` and the px bounds are **constants**, so the SHAPE is constant; only absolute size varies with width,
then the cap flattens even that. The fix is not to re-add `aspect-ratio` (fence honored) — it is to make the
band's **middle-term coefficient a role- and context-driven token**, and let the clamp bounds guard extremes
only, not dictate shape.

---

## 2. The best-concept model — "Contextual Aspect Band"

One primitive. Height stays a single monotonic `clamp()` (the fence). We generalize the frozen `0.64` into
a token `--panel-ratio` that is set by **role** (what content), adjusted by **context** (how much width the
panel actually got), and **authorable** in config — every input a token, zero magic px, fully agnostic.

```css
/* tokens.css — the SSOT band, now proportion-driven */
--panel-ratio:        0.58;   /* default content aspect (height / width); role + context override it */
--size-panel-h-floor: 320px;  /* legible mobile/narrow minimum (guard, not shape) */
--size-panel-h-cap:   640px;  /* ultrawide ceiling (guard, not shape) — raised so a wide solo can breathe */
--size-panel-height:
  clamp(var(--size-panel-h-floor), calc(var(--panel-ratio) * 100cqi), var(--size-panel-h-cap));
```

`100cqi` = the panel's own inline-size (both `.section` and `.panel` already declare
`container-type: inline-size` — verified). `calc(var(--panel-ratio) * 100cqi)` = *height is `ratio` × own
width*. This is **the good intent of aspect-ratio, expressed as a bounded height** — NOT the CSS
`aspect-ratio` property, so the aspect-vs-max-height contradiction cannot recur (there is one height value,
monotonic; when a bound binds it simply clamps — we never *declare* an invariant ratio the bound could
"violate," the ratio is an input coefficient the bounds are allowed to override). The fence is honored in
letter and spirit.

### 2a. Context axis (solo vs paired vs grid-of-N) — the owner's core ask

The RATIO itself responds to the panel's own available width via **container-query breakpoints** — the same
mechanism AR-5's grid uses to reflow. Wide container (solo) → *shorter* ratio; narrow container (paired) →
*taller* ratio (approaching square):

```css
/* node-styles.css — context-responsive proportion (queries the panel's own .section/.panel container) */
@container (min-width: 680px)  { .section__body[data-height], .panel__body[data-height] { --panel-ratio: 0.50; } }
@container (min-width: 1040px) { .section__body[data-height], .panel__body[data-height] { --panel-ratio: 0.42; } }
```

Why *shorter* ratio when wide (this is the non-obvious part, and it is the correct proportional design):
absolute height = `ratio × width`, so a wide solo with ratio 0.42 at 1280px = **538px tall**, while a narrow
paired with ratio 0.62 at 630px = **391px tall**. **Solo IS taller than paired (538 > 391) — the owner's ask,
satisfied by construction** — yet each lands on a *content-appropriate shape*: the solo is a comfortable
2.4:1 focus panel (not a squashed 2.9:1 letterbox at the cap), the paired is a near-3:2 that doesn't look
starved. As a pair reflows to 1-up on a narrow viewport (AR-5 `auto-fit minmax`), the container crosses
680px → the ratio re-solves upward automatically. **Zero per-case values; the container width IS the
context signal.** grid-of-3/4 falls out for free (narrower cell → taller ratio → shorter absolute height).

### 2b. Role axis (chart vs map vs kpi vs table) — content-appropriate proportion (Law 1/4)

Each content plugin declares its *natural* base ratio as a token on its body — role-driven, never
tenant/dimension-driven:

```css
/* each plugin owns its proportion (emitted as --panel-ratio on the body, or via a data-content role attr) */
.geograph .panel__body        { --panel-ratio: 0.72; }   /* a map wants near-square, not a letterbox */
.section__body[data-content="timeseries"] { --panel-ratio: 0.52; }   /* a time chart reads well wider */
/* kpi-strip opts OUT of the band entirely (intrinsic height) — it is not a data-panel */
```

The context override (§2a) and role base (§2b) compose: role sets the baseline, container-query nudges it
per width. Population is progressive (YAGNI) — ship the mechanism + the two roles that regress today
(chart, map); add per-role tuning as real panels demand it.

### 2c. Authorable axis (Constructor-ready) — revive the retired machinery, correctly

The resolver ALREADY emits per-breakpoint responsive `aspectRatio` (the `--ar-*` vars + `data-aspect` flag),
retired in `84d8a93` as "inert residue" because nothing consumed it. **Re-point it at a real consumer:**
`aspectRatio` NodeStyle → `--panel-ratio` (per-breakpoint), which the band consumes. This resurrects the
dead emission with a genuine job, makes proportion **authorable in config** (`view.styles.aspectRatio`,
responsive), and keeps the whole thing declarative (config carries a number, the renderer does the math).
Nothing new in the resolver — flip the var name it writes from `--ar-<bp>` to `--panel-ratio-<bp>` and let
the band read the cascade.

---

## 3. How it composes with what shipped (no regression)

- **AR-5 grid (width).** The grid distributes WIDTH (`repeat(auto-fit, minmax(min(100%,24rem), 1fr))`); the
  band reads that width via `100cqi` and maps it to height. Reflow 2↔1 automatically re-solves the ratio via
  the `@container` breakpoints. Height *derives from* the grid's width decision — one causal chain, no
  second source of truth.
- **Chart-fill growable band (`84999e2` / AR-3).** Unchanged. The band is still a **flex-basis**
  (`flex: 1 1 var(--size-panel-height)` on the body), so a body still GROWS to fill a card a taller sibling
  header stretched — the chart never letterboxes. We only change what the *basis value* computes to.
- **`wrap` / aspectRatio carriers.** The `data-aspect` / `data-height` carriers stay; they now feed
  `--panel-ratio` instead of a frozen `--size-panel-height`. Same DOM contract, richer meaning.
- **Equal-height paired cards (verified).** PRESERVED two ways, redundantly and correctly: (1) equal-WIDTH
  siblings resolve identical `100cqi` AND fall in the same `@container` band → identical `--panel-ratio` →
  identical basis → equal height by construction; (2) `align-items: stretch` on `.layout-columns/.layout-grid`
  still equalizes any residual ragged-header growth. Neither is touched.
- **Map's definite-height need (the revert's root blocker).** The band still resolves to a **definite px
  clientHeight** (a `clamp()` of concrete lengths), so Leaflet (absolutely-positioned) keeps its box — the
  map does NOT collapse. The map just gets a near-square role ratio (0.72) instead of 0.64. `--size-panel-min-height`
  (14rem) floor for `height:100%` renderers is retained untouched. This model does not reintroduce the
  `83d117a` map-collapse (that was caused by removing the wrapper's definite height; here the body keeps a
  definite band).

---

## 4. EXACT build spec (tight execute-task afterward)

Strangler order: additive token change first (proven byte-safe), then context/role rules, then the authorable
rewire, then delete the frozen coefficient. Green gate + REAL-BROWSER every page×layout after EACH step
(the brief's law: green ≠ visually correct — proven twice).

**Step 1 — generalize the band middle term (SSOT).**
`packages/styles/src/css/tokens.css` (~L87–90):
- Add `--panel-ratio: 0.58;`
- Change `--size-panel-h-fluid: 64cqi;` → delete it (folded into the calc).
- Change `--size-panel-height:` to `clamp(var(--size-panel-h-floor), calc(var(--panel-ratio) * 100cqi), var(--size-panel-h-cap));`
- Retune bounds to guard-only: `--size-panel-h-floor: 320px;` `--size-panel-h-cap: 640px;`
- Update the doc-comment (L64–86): the middle term is now proportion-driven; the coefficient is a token.

**Step 2 — context-responsive proportion.**
`packages/styles/src/css/node-styles.css` (near the `[data-height]` / `[data-aspect]` block, ~L33–84):
- Add the two `@container (min-width: 680px|1040px)` rules setting `--panel-ratio` on
  `.section__body[data-height], .panel__body[data-height], [data-aspect]`.
- (These are unnamed container queries → they bind to the nearest `container-type` ancestor, which is
  `.section`/`.panel` — verified both declare it.)

**Step 3 — role base ratios.**
- Map: `packages/plugins/nodes/geograph/default/*.css` — `.geograph .panel__body { --panel-ratio: 0.72; }`
  (or emit via the geograph meta as a `data-content="geo"` attr the CSS keys on — preferred, keeps it in the
  plugin's registry surface, agnostic).
- Chart: give the chart panel body a `data-content` role (via its meta) and key `--panel-ratio: 0.52`.
  If a role attr is a larger change, defer role tuning to a follow-up and let §2a context handle charts;
  Step 3 is the smallest slice that removes the map letterbox.

**Step 4 — authorable rewire (revive the retired emission).**
`packages/styles/src/resolvers/node.ts` (~L240–251, the `aspectRatio` block): emit `--panel-ratio-<bp>`
per breakpoint (reuse the existing responsive cascade shape) instead of the retired inert `--ar-*`; keep the
`data-aspect` flag. Add the `[data-aspect]` per-bp `--panel-ratio` cascade in `node-styles.css` (mirrors the
existing responsive-prop cascade). This makes `view.styles.aspectRatio` (responsive) the config front-door
to proportion — Constructor-ready.

**Step 5 — remove the frozen coefficient (contract-side).**
Delete `--size-panel-h-fluid` references and any comment implying a fixed `64cqi`. Confirm no consumer reads
the removed token (grep).

**Files touched (total):** `tokens.css`, `node-styles.css`, `resolvers/node.ts`, geograph + chart plugin CSS
(role attr), and the fitness file below. `panel-layout.css` flex-basis chain is UNCHANGED (it reads
`--size-panel-height` — the token name is stable; only its computed value changes).

---

## 5. Fitness functions (harden the invariants — extend `panel-sizing.fitness.test.ts`)

- **FF-RATIO-DRIVEN-BAND** — `--size-panel-height` middle term is `calc(var(--panel-ratio) * 100cqi)`
  (proportion is a token), NOT a hardcoded `Ncqi`. *Guards against re-freezing the coefficient.*
- **FF-BAND-MONOTONIC** (retain + strengthen) — panel height is a single `clamp(...)`; there is NO CSS
  `aspect-ratio` property paired with `max-height` on a data panel. *Encodes the honored fence.*
- **FF-RATIO-CONTEXT-AWARE** — at least one `@container (min-width: …)` rule overrides `--panel-ratio`
  (solo ≠ paired by construction). *Guards the owner's core requirement.*
- **FF-RATIO-AGNOSTIC** — every `--panel-ratio` value is a unitless number or a token; no tenant/dimension
  name, no magic px in the ratio; role ratios keyed on registry/`data-content`, never a hardcoded node type
  list. *Law 1/4.*
- **FF-MAP-DEFINITE-HEIGHT** (retain) — the `.panel__body` band resolves to a definite length (a `clamp` of
  lengths), so the map cannot collapse; `--size-panel-min-height` floor present. *The revert's regression
  guard.*
- **FF-EQUAL-HEIGHT-SIBLINGS** (retain) — `align-items: stretch` on `.layout-columns` / `.layout-grid`.
- **FF-BAND-IS-FLEX-BASIS** (retain, from the frozen-176 guard) — the body consumes the band as
  `flex: 1 1 var(--size-panel-height)` (growable), never a frozen `height`. *Chart-fill preserved.*

---

## 6. Reference grounding

- **Every-Layout / Utopia — fluid ratios, not fixed:** proportion should track available space; a fixed
  aspect on a fluid canvas is an anti-pattern. Our `ratio × 100cqi` is the bounded fluid-aspect form.
- **CSS container-query responsive aspect (modern std / Tailwind v4 / Builder.io breakpoint overrides):**
  proportion driven by the component's *own* box, not the viewport — exactly `@container` on `.section`/`.panel`.
- **Grafana / Tableau / Power BI row contract:** equal-height panels in a row via cross-axis stretch —
  retained as the redundant equalizer beneath the identical-band construction.
- **Vega-Lite / Grammar of Graphics (Law 4):** the mark's proportion is a property of the encoding/role,
  not a global constant — hence role-declared `--panel-ratio` (map ≠ time-series ≠ kpi).

**Bottom line:** KEEP the honest band + the retired-`aspect-ratio` decision; REFINE its frozen `0.64`
coefficient into a role-declared, context-responsive, authorable `--panel-ratio` token so the band computes
the BEST ratio per panel per context, dynamically and agnostically — genuinely "always the best ratio,"
not another uniform clamp.
