# CSS + Responsive Standard — statdash-platform (canonical)

> The platform's binding CSS architecture and responsive law. **Refines, does not contradict**, the
> existing canon (co-located shell CSS, BEM-agnostic names, 3-tier token spine, the data-attribute
> responsive engine in `node-styles.css`). Where this document chooses to be *stronger* than the
> current code, the gap is an alignment target, not a description of today — see `AUDIT-css-adherence.md`.
>
> Reference-grounded: Tailwind v4 (`@theme`, container queries), Builder.io (per-breakpoint override
> inheritance — already mirrored by our `--ar-*` cascade), Grafana/shadcn (component-co-located CSS),
> Every-Layout / intrinsic web design (fluid + Grid `auto-fit`), Open Props / GOV.UK Design System
> (token spine), MDN cascade-layers. We match the leaders on co-location + tokens + container queries,
> and go **stronger** on three axes (single breakpoint SSOT projected to CSS, container-first node
> responsiveness, and fitness-function-enforced invariants).

---

## 0. The spine in five laws

1. **Co-location law** — a node/panel/shell owns its CSS *and* its responsive breakpoints, in its own
   folder, imported by its TSX. Only true globals (tokens, reset, primitive utilities, the generated
   responsive engine) live centrally in `packages/styles` + `packages/react/src/styles`.
2. **Token-spine law** — every breakpoint, space, type, color, radius, shadow, z value is a *named
   token with one source of truth*. No magic px/hex/shadow literal in a component. Breakpoints have a
   single SSOT (`BREAKPOINTS` in `styles/src/tokens/effects.ts`) projected into CSS — never hand-typed.
3. **Mobile-first authoring law** — hand-written CSS targets the smallest viewport at base; every
   `@media`/`@container` enhancement uses `min-width` and layers upward (progressive enhancement). The
   generated data-attribute engine is the *one* documented exception (§4.3) — it is override-inheritance,
   a different axis, not authoring direction.
4. **Container-first responsiveness law** — a node responds to *its container*, not the viewport
   (`@container`). `@media` is reserved for page/shell chrome genuinely tied to the viewport (header
   collapse, page gutters, sidebar→stack). Fluid (`clamp`) is preferred over breakpoints wherever a
   value can scale continuously.
5. **Invariant law** — "flawless at every resolution, nothing breaks" is encoded as fitness functions,
   not hope: no horizontal overflow (320→3440), no clipped/cramped text, touch targets ≥ 24×24 CSS px
   (WCAG 2.5.8) / 44 recommended, no static-at-ultrawide. A guard exists or is added per invariant.

---

## 1. Co-location — the exact boundary

The dependency arrow (Law 3) governs CSS exactly as it governs TS. CSS flows inward-to-outward only.

### 1.1 What is GLOBAL (lives centrally — three homes, by layer)

| Home | Owns | Rule |
|---|---|---|
| `packages/styles/src/css/tokens.css` | The 3-tier token spine (primitive → semantic → component roles), dark-mode + `[data-theme]`/`[data-tenant]` overrides. | The **only** place raw hex/px primitives live. Shells consume Tier-2/3 roles, never primitives. |
| `packages/styles/src/css/node-styles.css` | The **generated** data-attribute responsive engine (`[data-aspect]`, `[data-height]`, the ~34 per-property `[data-*-responsive]` cascades), interaction-state surface (`[data-hover/focus/active]`), print. | Generated from the TS SSOT (§4.3) — never hand-edited rule-by-rule. Framework-level, zero BEM coupling. |
| `packages/styles/src/css/{card,animations}.css` | Cross-node primitives: the `.sc`/`.panel` card, keyframes + `prefers-reduced-motion`. | A primitive is global only when ≥2 unrelated nodes consume it (YAGNI — promote on the second caller). |
| `packages/react/src/styles/{index,a11y,slot,panel-layout,chrome-region}.css` | React-layer globals: visually-hidden utility, the generic `.panel-row/.panel-col` grid, slot/region scaffolding. Imports the `@statdash/styles` bundle. | App-agnostic only (Law: `packages/react` stays Geostat-free). This is the React adapter's global surface, one layer out from `styles`. |

### 1.2 What is NODE-LOCAL (lives in the node's folder, imported by its TSX)

Everything that styles a *specific* shell/node/panel: structure, skin, **and its own `@media`/`@container`
breakpoints**. Examples already correct today: `nodes/hero/default/hero.css`,
`chrome/app-header/default/app-header.css`, `nodes/filter-bar/default/filter-bar.css`,
`nodes/layout/layout.css`, `panels/*/.../*.css`, `pages/*/.../*.css`.

**Co-location test (binding):** if a breakpoint rule names a node's own BEM block (`.hero__cards`,
`.app-header__nav`), it MUST live in that node's CSS — never in a central stylesheet. A central file may
only carry rules keyed on framework hooks (`[data-*]`, `.panel-row`, `.sc`) that any node can wear.

### 1.3 Import discipline (the arrow, in CSS)

```
tokens.css (styles)
  → node-styles.css + card.css + animations.css (styles)
    → react/src/styles/index.css  (imports the styles bundle, adds react-layer globals)
      → each shell TSX  import './<block>.css'   (node-local, may use tokens + framework hooks)
```

- A node CSS file may reference **tokens** and **framework hooks** (`[data-*]`, `.panel-col`) — these are
  inward dependencies. It must **never** be imported by a more-inward layer, and must never reach into
  another node's BEM namespace (no `inner-*`/app-specific names — BEM-agnostic law).
- `packages/react` and `packages/styles` ship **zero** tenant/domain content (enforced by the existing
  no-tenant-content scan). A breakpoint tuned for one tenant's logo width is a node-local concern, not a
  global token.

---

## 2. Token spine — single source of truth per axis

The spine exists and is strong (`tokens.css`). The standard formalizes it and closes the one open gap
(breakpoints are SSOT in TS but **not yet projected to CSS** — §4).

| Axis | SSOT | CSS surface | Rule |
|---|---|---|---|
| **Breakpoints** | `styles/src/tokens/effects.ts` → `BREAKPOINTS` (xs 480, sm 640, md 768, lg 1024, xl 1280, 2xl 1536) | `@custom-media --bp-*` (generated, §4) | One scale. No off-scale literal (960/1100/700). Authors write `@media (--bp-lg)`, never `1024px`. |
| **Spacing** | `--spacing-*` (4px grid) | `var(--spacing-*)` | No raw rem/px margins/padding/gaps. |
| **Type** | `--font-size-*` + `--font-size-fluid-*` (clamp) | role tokens | Prefer the **fluid** clamp tokens for headings/display (continuous scale, §3). |
| **Color** | 3-tier: primitive ramp → `--color-*` semantic → component roles | semantic roles only | Shells consume roles; primitives are private to Tier-2. Tenant rebrands at `[data-tenant]`. |
| **Radius / border / shadow / z / blur / opacity** | `--radius-*`, `--border-*`, `--shadow-*`, `--z-*`, `--blur-*`, `--opacity-*` | `var(--…)` | No literal `box-shadow: 0 4px 20px rgba(...)`, no `border-radius: 18px`. |
| **Motion** | `--duration-*`, `--easing-*` (+ legacy `--transition-*`) | composable | Honor `prefers-reduced-motion` (already global). |
| **Container measure** | `--size-container-{narrow,mid,wide,ultra}` → **`--page-measure`** (SSOT, fluid: `clamp(--size-container-wide, 90vw, --size-container-ultra)`) | `max-width` | ONE fluid page measure. Header inner, content body, footer inner all consume `--page-measure` so they agree at every width. A data dashboard is not prose — the measure is set *above* a reading column (charts breathe on 1440/1920) and clamped (1760) so ultrawide centres, never an edge-to-edge ribbon. A tenant/layout rebinds `--page-measure` in one place (OCP). |

**Why a TS SSOT for breakpoints and not a CSS var:** CSS `@media`/`@container` feature queries **cannot**
read `var()` (the custom property is invalid in the media feature context). The only standards-compliant
way to have *one* breakpoint source feed both the data-attribute engine and hand-authored `@media` is to
**generate** the CSS from the typed value. We already have the SSOT (`BREAKPOINTS`) and a codegen util
(`styles/src/utils/codegen.ts`) — §4 wires them.

---

## 3. Fluid-first — when to use fluid vs breakpoint vs container query

Decision order (prefer the earlier, cheaper mechanism; escalate only when it can't express the need):

1. **Intrinsic / fluid (no query at all)** — first choice. Use when a value can scale *continuously*:
   - Type: `--font-size-fluid-*` (`clamp(min, fluid, max)`) end-to-end across the whole range — a heading
     scales 360→3440 without a single breakpoint step (kills the "h1 jumps 27→50px at 1280" class of bug).
   - Spacing: `clamp()` gutters/padding (already used well, e.g. `app-header` padding
     `clamp(0.8rem, 2.5vw, 2rem)`).
   - Layout: CSS Grid `repeat(auto-fit, minmax(min(<floor>, 100%), 1fr))` for card/KPI grids — they reflow
     with **zero** breakpoints, fill the row for **any** item count, collapse empty trailing tracks (no dead
     cell), and the `min(<floor>,100%)` guard stacks to one column below the floor instead of overflowing.
     This is the Every-Layout/intrinsic standard and is stronger than counting columns per breakpoint.
     **Canonical implementation:** the KPI strip (`panels/kpi-strip/.../kpi.css`, one knob `--kpi-card-min`)
     — the reference every multi-item strip/grid follows. **Flag (additive, post-demo):** the layout
     `columns`/`grid` nodes still count fixed columns per breakpoint (`data-cols-*`); they should gain an
     intrinsic `auto` mode (a `min` floor → this same `auto-fit` rule) so page authors get gap-free reflow
     without enumerating counts — the platform eating its own dog food. Deferred only for YAGNI (no page
     config consumes it yet) + blast radius (touches the `@statdash/styles` `resolveColumns` resolver).
   - Caps: `max-width: min(100%, <token>)` and aspect ceilings (`--size-panel-max-height`) to stop
     ultrawide ballooning.
2. **Container query (`@container`)** — second choice, for *component-level* responsiveness: a node must
   respond to the width it was actually given (a chart in a 1/3 column on a wide screen needs the narrow
   layout). The platform already does this for layout columns/grid and the `[data-aspect]` cascade. This
   is the **default for anything inside the page body** — it composes correctly under nesting where
   viewport `@media` lies. Requires an ancestor `container-type: inline-size` (already on `.layout-*-ctx`,
   `.layout-stack`, cards).
3. **Viewport media query (`@media min-width`)** — last choice, **only** for chrome genuinely bound to the
   viewport, not a container: app-header nav collapse, page gutters, sidebar→stack, `prefers-*` (color
   scheme, reduced motion), and `print`. If a rule could be expressed as `@container`, it must be.

**Heuristic:** *page chrome → `@media`; everything in the content tree → `@container` or fluid.*

---

## 4. Breakpoints — direction, scale, and the SSOT→CSS projection

### 4.1 The scale (binding, single source)

`xs 480 · sm 640 · md 768 · lg 1024 · xl 1280 · 2xl 1536` — `BREAKPOINTS` in `effects.ts`. No other
threshold may appear in product CSS. The off-scale literals in use today (960, 1100, 700, `max-height:860`)
are violations to retire (snap to the nearest scale token *or*, if a real tuning point is proven, add it to
the SSOT so it is named and shared — never leave it an anonymous literal).

### 4.2 Direction — mobile-first `min-width`, ascending (binding for hand-authored CSS)

Base styles target the **smallest** viewport and require no query; enhancements layer up with `min-width`
in ascending order. Justification vs `max-width`-down:
- The base layer is the **safety floor** — the smallest screen is the hardest constraint, so making it the
  default guarantees no-overflow by construction; wider screens only *add* room. Desktop-first inverts the
  risk (the default is the easy case; the hard case is an override that's easy to forget).
- Enhancements are purely additive → smaller cascade surface, fewer resets, no `!important`-to-undo.
- It is the GOV.UK / MDN / Tailwind / Bootstrap consensus and aligns with Core Web Vitals (mobile CLS).

This is the **target** (architecture-leads-code, Law 7). Today's shells are authored desktop-first
(`max-width` down); migrating each to mobile-first is a per-node, browser-verified change (RISKY — see
audit), done Strangler-Fig, not a big-bang inversion.

### 4.3 The ONE documented exception — the data-attribute override engine

`node-styles.css`'s `--ar-*` / `[data-*-responsive]` cascades are **desktop-default `max-width`**, and they
**stay that way**. They are not "desktop-first authoring" — they are *Builder.io override inheritance*: a
node's flat (default) value is the canvas value, and each unset breakpoint **inherits from the next-larger**
via the `var(--x-md, var(--x-lg, …))` fallback chain. That is a different axis (config-override propagation,
not hand-authored progressive enhancement) and inverting it would be a high-risk rewrite of a working SSOT
for zero behavioral gain. The standard: **this engine is generated and max-width-cascaded; all *other* CSS
is mobile-first min-width.** Documenting the two axes explicitly is what prevents confusion.

### 4.4 SSOT → CSS projection (the stronger-than-standard move)

One source (`BREAKPOINTS`) → two CSS consumers, both generated, never hand-typed:

- **The engine** (`node-styles.css`): the per-property cascade is mechanical and must be emitted by a
  generator reading `BREAKPOINTS` (the codegen seam already exists). A breakpoint change is a one-line TS
  edit + regen, not a 600-line hand-edit.
- **Hand-authored shells**: adopt PostCSS `@custom-media` (postcss-custom-media / preset-env), with the
  `@custom-media --bp-xs … --bp-2xl (min-width: …)` definitions **generated from the same TS SSOT** and
  injected globally. Authors then write the tokenized, mobile-first form:

  ```css
  /* node-local, mobile-first, tokenized — the canonical shell pattern */
  .app-header__nav { display: none; }              /* base = smallest */
  @media (--bp-md) { .app-header__nav { display: flex; } }   /* ≥768, enhance up */
  ```

  YAGNI check: the second consumer (numerous hand-authored shells with literal px) is **real**, so the
  `@custom-media` seam is justified, not speculative. Until it lands, authors still write min-width with
  the scale's exact px and a `/* = --bp-md */` comment, so the migration is a find-replace.

---

## 5. Layering & cascade — predictable specificity

Today: flat BEM (`.block__el`, specificity 0,1,0) + data-attribute hooks (0,1,0) + a little `!important`
(engine `height:auto`, print). This is already low and mostly predictable — the standard formalizes it and
keeps it that way:

- **Naming:** BEM-agnostic (`.block`, `.block__element`, `.block--modifier`). No `inner-*`/tenant prefixes.
  No id selectors. No descendant chains deeper than necessary. Keep specificity flat so node-local rules
  win by *source order + layer*, not by escalating selectors.
- **Cascade layers (`@layer`) — target, optional, RISKY to adopt:** the principled ordering is
  `@layer reset, tokens, engine, components, utilities, overrides;`. It makes "node-local beats global"
  true *by layer* regardless of specificity, eliminating the few `!important`s. Because specificity is
  already flat, this is a *formalization*, not a rescue — adopt only if the `!important` count or an
  override war justifies it (YAGNI), and only as a verified cascade change (it reorders the whole sheet).
- **`!important`:** allowed only in the generated engine's documented resets and `@media print`. Never in
  hand-authored shell CSS — if a shell needs `!important`, the real fix is a layer or a specificity
  reduction.
- **Inline style vs stylesheet:** the engine deliberately routes per-breakpoint values through CSS vars
  (not inline `style`) because inline always beats a media-query rule — preserve that contract; never set a
  responsive property as a flat inline style if it also has breakpoint overrides.

---

## 6. The "flawless at every resolution" invariants (encode as fitness functions)

Target resolution ladder (binding): **320 · 360 · 390 · 414 · 768 · 834 · 1024 · 1280 · 1440 · 1920 · 2560
· 3440**. (Extends the prior audit's 360-floor down to 320 — smallest supported phone.)

| # | Invariant | Mechanism | Guard |
|---|---|---|---|
| I1 | **No horizontal overflow** at any width (WCAG 1.4.10 Reflow). | `min-width:0` on every flex/grid child that can hold long content; overflow contained in-card (`overflow-x:auto`), never on the document; the `.sr-only` mirror is a clipped `div`, not a `table`. | `ChartDataTable.reflow.fitness.test.tsx` exists (R1). **Extend**: a real-browser `documentElement.scrollWidth ≤ clientWidth + 1` check across the ladder. |
| I2 | **No clipped/cramped text.** | Titles wrap (no single-line ellipsis on primary headings) on mobile; fluid type tokens; `min-width:0` lets ellipsis happen on *secondary* labels only. | Add: assert primary `<h1>` is not `text-overflow:ellipsis` single-line; visual ladder. |
| I3 | **Touch targets ≥ 24×24 CSS px** (WCAG 2.5.8 AA), 44 recommended for primary actions. | min sizes on buttons/links/chips via tokens. | Add: computed min-size check on interactive roles at ≤480. |
| I4 | **No static-at-ultrawide.** | Shared `--page-measure` cap + `margin-inline:auto`; aspect ceiling `--size-panel-max-height`; `auto-fit` grids stop growing tracks unboundedly. | Visual ladder 1920/2560/3440 — no edge-to-edge stretch, no stranded narrow ribbon. |
| I5 | **No off-scale breakpoint.** | Only the 6 scale thresholds; SSOT-generated. | Add: a lint/fitness scan rejecting `@media`/`@container` px literals not in `BREAKPOINTS`. |
| I6 | **No magic value.** | Tokens only (space/color/radius/shadow/z). | Add: scan rejecting raw hex/`rgba(0,0,0,…)`/`box-shadow: 0 …`/bare-px radius in component CSS. |
| I7 | **Motion + contrast a11y.** | `prefers-reduced-motion` (global, present); semantic-token contrast ≥ 4.5:1; never color-only signal (trend pairs a glyph). | Existing `reduced-motion.fitness.test`, token parity test; keep. |

**Standards-as-code:** each invariant above is either already guarded or gets a fitness function — the
no-degradation law made concrete (Evolutionary Architecture). A guard that would fail today is added as an
explicit `todo`/skipped gate that flips on when the alignment wave lands, never as a silent gap.

---

## 7. Where we choose to be STRONGER than the leaders

1. **Single breakpoint SSOT projected to *both* the data-attribute engine and hand-authored `@media`**
   (§4.4). Most design systems tokenize breakpoints only for their utility framework; we make the *same*
   typed value drive the generative engine and shell CSS, with no hand-typed px anywhere.
2. **Container-first by default for the entire content tree** (§3), not just opt-in components — the
   composable-node platform demands a node respond to its slot, because the same node renders in a 1/1 hero
   and a 1/3 column. Viewport `@media` is the exception, not the rule.
3. **Invariants as fitness functions** (§6) — "nothing breaks at any resolution" is a CI gate, not a manual
   QA pass. The R1 reflow guard is the template; we extend it to the full invariant set.

Each is justified by a *real* second consumer (YAGNI honored) — none is speculative machinery.

---

## 8. Quick reference — authoring a new node's CSS (the canonical shape)

```css
/* nodes/<block>/<variant>/<block>.css — co-located, imported by <Block>.tsx */

/* 1. Base = smallest viewport. Tokens only. No query. */
.block            { padding: var(--spacing-md); gap: var(--spacing-sm);
                    border-radius: var(--radius-md); color: var(--color-text-primary); }
.block__grid      { display: grid; gap: var(--spacing-md);
                    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); } /* fluid, no breakpoint */
.block__child     { min-width: 0; }   /* I1 overflow guard on any flexible child */

/* 2. Enhance UP with min-width, tokenized scale (or px + `/* = --bp-* */` until @custom-media lands). */
@media (--bp-lg)  { .block { padding: var(--spacing-lg); } }

/* 3. Component-level: prefer @container when the node must respond to its slot, not the viewport. */
@container (min-width: 40rem) { .block__aside { display: block; } }
```

Rules: tokens for every value · `min-width:0` on flexible children · fluid/`auto-fit` before a breakpoint ·
`@container` before `@media` · mobile-first ascending · BEM-agnostic names · breakpoints from the scale only.
