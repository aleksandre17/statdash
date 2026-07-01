---
title: Semantic-Token / Theming Spine
status: Proposed
date: 2026-06-24
authors: architect (Opus)
migrated_from: adr_semantic_token_theming_spine
---

# ADR-006 — Semantic-Token / Theming Spine

**Status:** Proposed (Strangler-Fig P0–Pfinal over ~34 files).

## Context

Brand colors and theme values are hardcoded across ~34 files, making re-branding a code change and blocking multi-tenant / white-label theming. There is no token layer between raw values and components, and no way to override a brand per tenant without editing components.

## Decision

- **Three-tier semantic tokens** (primitive → semantic role → component) with a brand-neutral default set and a `[data-tenant]` attribute override layer.
- **Byte-identical geostat**: the reconciliation maps every current role → value so the migration is visually lossless (e.g. accent `#0080BE`, not the incidental `#005a9c`).
- **CSS attribute scoping, NOT CSS-Modules** — attribute selectors preserve byte-identity of emitted class names and the cascade; CSS-Modules would rename classes and break the identity guarantee.
- **De-tenant resolution:** accent → tenant layer; neutrals → default layer.

## Rejected Alternatives

1. **CSS-Modules for theme scoping** — REJECTED: renames classes and breaks byte-identity with the current output; attribute scoping keeps the cascade and emitted names stable.
2. **Keep hardcoded per-component colors (status quo)** — REJECTED: re-branding stays a code change; no tenant override is possible; violates SSOT for design values.
3. **A single flat token map (no role tier)** — REJECTED: without the semantic-role tier, tenant overrides must restate every primitive; the role tier is what makes an override small and safe.

## Consequences

- Positive: re-branding becomes a token/attribute change, not a code change; tenant override is a thin layer; geostat remains byte-identical.
- Negative / cost: a ~34-file Strangler migration; a role→value reconciliation table must be maintained during transition.
- Fitness functions: `FF-TOKEN-ONLY`, `FF-THEME-COMPLETE`, `FF-TENANT-OVERRIDE`.

---

## Detailed Record (preserved verbatim from architect memory)

> Migrated from `.claude/agent-memory/architect/`.


# ADR — Semantic-Token / Theming Spine (visual cohesion + multi-tenant theming)

Status: PROPOSED (decision-grade; implementation orchestrated in phases P0–Pn)
Date: 2026-06-24
Supersedes/extends: [[adr_config_and_render_vision]] (color-SSOT migration was a named P1 there), [[adr_element_config_schema_seam]] (per-slice purity), [[project_panel_external_product]] (engine packages = published contract → tokens are part of that contract).
Related laws: Root Law 1 (no privileged dimensions → no privileged TENANT), Law 3 (dependency arrow), Law 6 (best/root-cause), Law 7 (architecture leads), Law 9 (WCAG AA / data integrity). [[feedback_first_tenant_erosion]], [[feedback_css_architecture]], [[feedback_strict_solid_per_element]].

---

## Context

A survey quantified a structural defect. Visual cohesion rests on a fragile convention — copy-pasted hexes — and it has broken three ways:

1. **~377 literal hex/rgb colors across ~34 files** in `packages/plugins/**` + `packages/react/src/**`. Distinct color count: ~93. Top offenders: `react/src/styles/section-card.css` (46), `plugins/nodes/section/default/section.css` (39), `plugins/panels/table/.../data-table.css` (30), `plugins/chrome/inner-sidebar/...` (27).
2. **Three competing palettes, diverged:**
   - The shells render a **teal-blue** family led by `#0080BE` (83 uses — the live accent, the source of truth).
   - The `@statdash/styles` catalog (`tokens.css`) ships `--color-accent: #005a9c` (a different blue) plus `--color-border: #dee2e6`, gray-based surfaces — **the shells never adopted these**, so the catalog is dead/diverged SSOT.
   - `apps/geostat/src/shared/styles/index.css` declares a THIRD set (`--color-primary: #0080BE`, `--color-teal: #00A896`, chart vars) — tenant-ish vars that the shells also do not consume (they hardcode instead).
3. **Consequence — multi-tenant is impossible.** Because shells bake geostat's brand hexes inline, a new tenant cannot be re-themed without editing `packages/*`. The theming spine the platform's cohesion depends on does not actually exist. This directly violates the de-tenant north-star ([[feedback_first_tenant_erosion]]): geostat brand is leaking into engine packages.

The existing catalog is NOT worthless: `tokens.css` already has a clean spacing scale (`--spacing-*`), radius/border-width/shadow/z/typography/motion scales, a gray primitive ramp, status tones, a 10-color chart palette, AND a complete dark-mode override layer (`@media prefers-color-scheme` + `[data-theme]`). The defect is narrow and specific: **the semantic COLOR role values diverged from the rendered shells, and the shells bypass the tokens entirely.** This is a reconciliation + adoption problem, not a green-field token-system problem.

### Forces

- **F1 — Byte-identical mandate.** The live teal-blue UI is the source of truth. The migration must change zero rendered pixels for geostat today. Reconcile the default-theme values UP to the rendered hexes; do NOT re-skin to the catalog's stale `#005a9c`.
- **F2 — De-tenant north-star.** `packages/*` must carry no tenant brand. So the default theme in `packages/styles` must be **brand-NEUTRAL**, and geostat's specific teal-blue values must live as a **tenant theme outside the engine contract** (in the app/provisioning layer). But F1 says today's render = geostat's teal-blue. These two forces collide and the resolution is the crux of this ADR (see Decision §2).
- **F3 — Cohesion must be un-regressable.** A convention that depends on authors copy-pasting is exactly what failed. The end state must be a fitness function that fails the build on any new literal.
- **F4 — YAGNI / dark-mode door.** Dark mode already exists in tokens.css but is unreachable while shells hardcode. The role model must leave dark-mode/high-contrast reachable WITHOUT building/validating it in this effort.
- **F5 — Strangler-Fig.** ~34 files cannot move in one PR safely. Each phase must be independently shippable AND byte-identical.

---

## Decision

### §1 — Token tier model (3 tiers; shells consume SEMANTIC only)

Adopt the W3C-Design-Tokens / Material-3-color-roles / Radix-Themes layered model, mapped to CSS custom properties (which already cascade — no build step required):

```
TIER 1 — PRIMITIVE (ramps, raw values)   "what colors exist"
   --gray-50…900           (already present, keep)
   --blue-50…900           (NEW ramp — the teal-blue family, brand-neutral names)
   --teal-50…900           (NEW ramp — secondary)
   raw spacing/radius/shadow scales (already present)
        │  primitives are referenced ONLY by the semantic tier, NEVER by shells
        ▼
TIER 2 — SEMANTIC / ROLE (aliases by intent)   "what a color is FOR"   ← shells consume ONLY this
   --color-surface, --color-surface-raised, --color-surface-sunken
   --color-border, --color-border-subtle, --color-border-strong, --color-border-interactive
   --color-text-primary, --color-text-secondary, --color-text-muted, --color-text-faint, --color-text-inverse
   --color-accent, --color-accent-hover, --color-accent-muted, --color-accent-bg
   --color-chart-frame
   status-* (already present), --space-* (already present)
        │  semantic role → primitive value is the ONE place a theme rebinds
        ▼
TIER 3 — COMPONENT (per-shell local aliases)   "this component's slot"   ← OPTIONAL, build only when warranted
   e.g. --sc (the existing per-page accent projector) ; --table-row-stripe
```

**Rule (the cohesion invariant):** shells (`plugins/**` + `react/src/**`) reference **only Tier-2 semantic tokens** (and the `--sc` Tier-3 projector). They never reference Tier-1 primitives and never inline a literal. A theme = a set of Tier-2 VALUES (which resolve through Tier-1 ramps). This is the SSOT: every shell color has exactly one authoritative home — its semantic role — and the theme is the only thing that binds role→value.

**Where the `--sc` projector fits.** `--sc` is already a Tier-3 component token: a per-page accent color projected onto a card subtree (set inline on the `.sc/.panel/.section` root when a `color` prop is provided). It must **default to `var(--color-accent)`**, not to the literal `#0080BE`. Today shells write `var(--sc, #0080BE)` — the fallback is a hardcoded brand leak. Canonical form: `var(--sc, var(--color-accent))`. `--sc` stays as the page-level override mechanism (it is genuinely per-page data, Constructor-authored), but its FALLBACK becomes the semantic accent — so an un-projected card inherits the theme, not geostat's hex.

**Granularity line (YAGNI, answers the over/under-tokenizing trade-off).** Tier-2 is sized to the roles the shells *actually* use, derived from the reconciliation table (§3) — not a speculative Material-3-complete 13-step tonal palette per role. We add a semantic token when ≥2 distinct shell hexes collapse into one intent OR one hex serves a clearly-named role. We do NOT mint `--color-border-subtle-hover-pressed`. Tier-1 ramps are introduced only for accent/teal (because a theme must be able to derive hover/muted variants); grays already have a ramp. Status and chart palettes already exist at the right granularity — leave them.

### §2 — Default theme + tenant override seam (the de-tenant resolution)

**A theme is a set of Tier-2 token VALUES.** Mechanism: a CSS scope that rebinds the semantic custom properties. Three layers of precedence, lowest→highest:

```
1. :root  in packages/styles/tokens.css           — the DEFAULT theme (brand-NEUTRAL)
2. [data-tenant="…"] { … }  OR  runtime-injected <style>  — the TENANT theme (brand)
3. [data-theme="dark"] / @media prefers-color-scheme   — the MODE layer (already present)
```

**Resolving F1↔F2 (the crux):** the byte-identical mandate and the brand-neutral mandate are reconciled by SPLITTING geostat's current palette into two homes:

- The **DEFAULT theme** (`packages/styles`, brand-neutral) gets values that are *functionally* the geostat render but named/owned as the platform default — specifically the **neutrals** (surface/border/text/gray-derived) which are NOT brand: `#fff`, `#E8EEED`, `#1A2332`, `#9AABB8` etc. are a tasteful neutral light theme, legitimately the platform default. They are not "geostat brand" — they are "a clean light dashboard." These stay in `packages/styles`.
- The **ACCENT family** (`#0080BE` teal-blue, `#00A896` teal, the accent-muted/hover/bg derived from them) IS geostat brand. These move to a **geostat tenant theme** that lives OUTSIDE the engine contract. The brand-neutral default theme ships a NEUTRAL accent (a desaturated slate-blue, e.g. derived from `--blue-600` of a neutral ramp) so `packages/styles` carries no tenant brand. Geostat's `[data-tenant="geostat"]` override rebinds `--color-accent` family to `#0080BE`.

Net effect for byte-identity: **on the geostat app, `data-tenant="geostat"` is set at the root, so `--color-accent` resolves to `#0080BE` and every shell renders identically.** The neutrals come from the default theme (already the geostat neutrals). Zero pixels move. For a future tenant B: set `data-tenant="b"`, ship a 12-line override of the accent family (and any neutral they want to retint) — **zero edits to `packages/*`.**

**Where geostat's tenant theme legitimately lives.** Two valid homes; pick by F2:
- **Build-time (chosen for geostat now):** `apps/geostat/src/shared/styles/index.css` already declares `--color-primary: #0080BE`. Reshape it into a proper `[data-tenant="geostat"]` semantic override block (rebinding `--color-accent`, `--color-accent-hover`, `--color-accent-muted`, `--color-accent-bg`, `--color-chart-*`). This is the geostat app's own layer (outermost, allowed to know brand) — NOT `packages/*`. Compliant with F2.
- **Runtime-injected (the multi-tenant target, door left open):** the de-tenant north-star ([[project_panel_external_product]], ADR-0028 runner) says tenant content arrives from `/api/bootstrap`. The tenant manifest SHOULD carry a `theme: { accent, accentHover, … }` token-value map; `apps/geostat/src/main.tsx` (the boot seam) injects a `<style id="tenant-theme">[data-tenant="x"]{ --color-accent: …; }</style>` from `manifest.theme` before first paint, and sets `document.documentElement.dataset.tenant`. This is the same fail-soft boot path as i18n/stores. **We do NOT build runtime injection in this effort (YAGNI) — but the override is shaped as a flat token-value map precisely so the manifest can supply it later with no shell change.** The build-time geostat block IS that same map, just authored in CSS instead of fetched.

**Why a flat `[data-tenant]` data-attribute scope, not a `.theme-x` class or per-tenant `:root` file:**
- `[data-tenant]` composes with the existing `[data-theme="dark"]` attribute on the same `<html>` (Postel/least-astonishment — both are root data-attributes, orthogonal axes: tenant × mode).
- A single attribute is what a runtime bootstrap can set in one line (`documentElement.dataset.tenant = id`), matching the runner pattern.
- It is brand-neutral in `packages/*`: the engine defines the role NAMES and neutral defaults; the attribute VALUE space is owned by apps/provisioning.

### §3 — Palette reconciliation (byte-identical role→value table)

Every distinct shell hex mapped to its semantic role at its CURRENT value. Near-duplicates collapsed (the ~5 near-identical greys/off-whites become one role each). Values below are the **resolved render** (default-theme neutrals + geostat-tenant accents). For geostat, the rendered value is unchanged.

**ACCENT family — geostat tenant theme (`[data-tenant="geostat"]`); default theme = neutral slate placeholder**

| Role token | geostat value | shell literals it replaces |
|---|---|---|
| `--color-accent` | `#0080BE` | `#0080BE` (83×), the `var(--sc, #0080BE)` fallbacks |
| `--color-accent-hover` | `#006A9E` | `#006A9E`, `#006a9e` |
| `--color-accent-muted` | `#E6F3FA` | `#E6F3FA`, `#EAF4FB`, `#E6F3FA`, `#F0F8FF`, `#eaf4fb` |
| `--color-accent-bg` | `#EEF3F4` | `#EEF3F4`, `#EEF3F5`, `#EEF3F4` (active icon-btn bg) |
| `--color-accent-secondary` | `#00A896` | `#00A896`, `#2A9D8F`, `#00a896` (teal secondary) |
| `--color-accent-ring` | `rgba(0,128,190,0.x)` | `rgba(0,128,190,0.08/.12/.15/.18)` → `color-mix(var(--color-accent) N%)` |

**NEUTRALS — default theme (`:root`, brand-neutral, = geostat render today)**

| Role token | value | shell literals it replaces |
|---|---|---|
| `--color-surface` | `#FFFFFF` | `#fff`, `#ffffff` (43+4×) |
| `--color-surface-raised` | `#FAFBFB` | `#FAFBFB`, `#F8FAFA`, `#F8FAFB`, `#FAFBFB` (hover bg) |
| `--color-surface-sunken` | `#F5F7F7` | `#F5F7F7`, `#F7FAFA`, `#F8FAFA` (toggle/inset bg) |
| `--color-surface-frame` | `#F0F3F3` | `#F0F3F3` (16×, divider/methodology) |
| `--color-border` | `#E8EEED` | `#E8EEED` (36×) — the dominant border |
| `--color-border-subtle` | `#F0F3F3` | `#F0F3F3` (open-state hairline divider) |
| `--color-border-frame` | `#E0EBE8` | `#E0EBE8` (13×, chart/tooltip frames) |
| `--color-border-strong` | `#C8D5D9` | `#C8D5D9` (9×), `#CBD5E1`, `#CBD5E0` |
| `--color-border-interactive` | `#B0C8D4` | `#B0C8D4`, `#B0C4CC` (hover/active borders) |
| `--color-text-primary` | `#1A2332` | `#1A2332` (22×), `#111111` (collapse) |
| `--color-text-secondary` | `#4A5568` | `#4A5568` (10×), `#2D3748` (7×), `#445A66` |
| `--color-text-muted` | `#6B7B8D` | `#6B7B8D` (25×), `#5A7A8A` (13×), `#718096`, `#6B8899` |
| `--color-text-faint` | `#9AABB8` | `#9AABB8` (21×), `#94A3B8`, `#B0C4CC` (placeholder/subtitle) |
| `--color-text-inverse` | `#FFFFFF` | white-on-accent text |

**Collapse decisions (near-duplicate resolution):**
- `#FAFBFB`/`#F8FAFA`/`#F8FAFB`/`#F7FAFA` (4 off-whites within ΔE<2) → collapse to `--color-surface-raised` = `#FAFBFB`. NOTE: this is the one place byte-identity is traded for cohesion — these four were already perceptually identical accidents of copy-paste. If a pixel-diff test flags it, keep `#F7FAFA` as `--color-surface-sunken-warm` (one extra token) rather than re-spread literals. Default: collapse.
- `#6B7B8D`/`#5A7A8A`/`#718096` (muted greys ΔE<3) → `--color-text-muted`. Same trade note.
- The `#9B1C1C`/`#856404`/`#1B7A9E` etc. in `data-table.css` are STATUS tones → map to existing `--status-*-fg`, not new neutrals.
- `#ff0000` (9×) and `#aaa/#ccc/#bbb/#999` (placeholder/test colors) — audit per-file: test files (`*.test.ts`, `mapColorUtils.test.ts`) are EXEMPT from the fitness function (test fixtures, not render). `#ff0000` in render code is a bug-color placeholder → map to `--color-text-faint` or `--status-negative-fg` per intent.
- Chart-component literals (`HBarDivergingChart.tsx`, `cartesian.ts`, apex utils) consume `--chart-color-*` / `data-color` catalog — those are the EXISTING chart palette axis ([[project_charts_split_8_1]]); reconcile to `var(--chart-color-N)`, do not invent neutrals.

**Spacing literals** map to the EXISTING `--spacing-*` scale (4px grid): `0.25rem→--spacing-xs`, `0.5rem→--spacing-sm`, `0.75rem→--spacing-md` partials, `1rem→--spacing-md`, `1.25rem`, `1.5rem→--spacing-lg`. Non-grid values (`0.9375rem`, `0.625rem`, `0.3rem`, `3.5px`) are component-intrinsic dimensions, NOT spacing-scale members → allowlisted (see §5), OR introduce `--space-*` half-steps only if ≥3 call-sites share one (YAGNI). Border `1px`/`1.5px`, `100%`, `0`, radius pixel values map to existing `--border-width-*`/`--radius-*` or are allowlisted.

### §4 — Migration plan (Strangler-Fig; each phase green + byte-identical)

| Phase | Scope | Owner | Byte-identity guarantee |
|---|---|---|---|
| **P0** | Land Tier-1 accent/teal ramps + the full Tier-2 semantic role set (§3 names) in `packages/styles/tokens.css` + mirror in `tokens/color.ts` + `catalog/color.ts`. Reconcile default-theme neutrals to the rendered values. Reshape `apps/geostat/src/shared/styles/index.css` into a `[data-tenant="geostat"]` accent override; set `data-tenant="geostat"` at app root. NO shell edits yet. | architect (token design) + migration (catalog wiring) | Pure addition; render unchanged because shells still use literals. Geostat tenant block reproduces `#0080BE` exactly. |
| **P1** | `packages/react/src/**` — `section-card.css` (46) + `feedback.css` + `PropSchemaForm.css`. literal→`var(--semantic)`. | migration | Each replaced literal == the token's resolved value (table §3). Visual regression test (Playwright/pixel) green. |
| **P2** | `plugins/chrome/**` — inner-sidebar (27), app-header, app-footer, locale-switcher, mode-bar. | migration | as P1 |
| **P3** | `plugins/nodes/**` — section (39), stats-carousel (22), filter-bar (17), page-header (16), hero (14). Includes `var(--sc, #0080BE)` → `var(--sc, var(--color-accent))`. | migration | as P1; `--sc` fallback now resolves through accent (= `#0080BE` under geostat tenant) |
| **P4** | `plugins/panels/**` — data-table (30), kpi (18), chart components, map. Chart literals → `--chart-color-*` / data-color catalog (coordinate with [[project_charts_split_8_1]]). | migration + (charts specialist for apex utils) | status tones → `--status-*`; chart colors → chart palette |
| **P5** | `plugins/pages/**` + remaining stragglers (inner-page, tab-page, presentation). | migration | as P1 |
| **Pfinal** | Flip the token-only fitness function from `warn` to `error` (no allowlist of frozen debt — the burn-down is complete). Delete the stale `--color-accent: #005a9c` default and the now-dead `apps/geostat` `--color-primary` duplicate vars. | architect | The gate proves zero literals remain. |

**Phasing principle:** P1–P5 are ordered by the dependency arrow's reverse (react before plugins) and by blast-radius (shared `.sc` first since both react and section consume the pattern). Each phase is one shippable PR, green CI, pixel-identical. If any phase's pixel-diff is non-zero, the cause is a wrong row in §3 — fix the table, not the shell (root-cause, Law 6).

### §5 — Fitness functions (cohesion invariants, un-regressable)

Encode in `.claude/rules/` + a vitest/eslint gate (Evolutionary Architecture, kit §5/§09). Three functions:

1. **FF-TOKEN-ONLY (no literals in shells).** Scan `packages/plugins/**` + `packages/react/src/**` (`*.css`, `*.ts`, `*.tsx`) for `#[0-9a-f]{3,8}`, `rgba?(`, `hsla?(`, and raw spacing (`\d+px`, `\d*\.?\d+rem` outside `var()`/`clamp()`/allowlist). FAIL on any match. **Allowlist (narrow, each line commented WHY):** `0`, `1px`/`1.5px` hairline borders, `100%`/`50%`, `transparent`, `currentColor`, `inherit`, component-intrinsic dimensions documented inline (e.g. `3.5px` accent-bar width), `*.test.ts(x)` fixtures. The allowlist is for non-themeable structural values, NOT for frozen color debt — after Pfinal there are zero color exemptions.
2. **FF-THEME-COMPLETE (no dangling roles).** Every `var(--color-*|--space-*|--status-*)` referenced anywhere in shells MUST be defined by the default theme (`:root` in tokens.css). Parse referenced vars, diff against defined vars, FAIL on any undefined. Prevents a shell referencing a role no theme supplies (the inverse cohesion bug).
3. **FF-TENANT-OVERRIDE (theming actually works).** A test that renders a shell under `[data-tenant="test"]{ --color-accent: #ff00ff }` and asserts the computed accent == `#ff00ff` with ZERO shell-file edits. Proves the override seam is live — re-theming is structural, not by convention. (jsdom/getComputedStyle or Playwright.)

### Trade-offs & critical questions (the sharp ones, answered)

- **Q: Primitive-vs-semantic granularity — where's the line?** A: Shells touch Tier-2 ONLY; Tier-1 ramps exist solely so a theme can derive accent variants. We mint a Tier-2 token when ≥2 hexes collapse into one intent or a hex owns a named role (§3). No speculative tonal scales (YAGNI). Status/chart already correct — untouched.
- **Q: Byte-identity vs collapsing near-duplicates — which wins?** A: Collapse wins by default (the duplicates were copy-paste accidents within ΔE<3, sub-perceptual). The escape hatch: if a pixel-diff test flags one, add ONE extra warm/cool variant token rather than re-spreading literals. Cohesion is the goal; the duplicates were the disease.
- **Q: Default theme neutral vs geostat-tinted — is "neutral light dashboard" really brand-free?** A: Yes for neutrals (white/grey surfaces, slate text are not ownable brand). NO for the accent family (teal-blue IS geostat) — that splits out to the tenant theme. This is the F1↔F2 resolution and the de-tenant compliance point.
- **Q: Runtime-injected vs build-time theme?** A: Build-time `[data-tenant="geostat"]` CSS now (simplest, in-app layer, F2-compliant). Door left open for runtime injection from `manifest.theme` via the existing boot seam — the override is shaped as a flat token-value map so the manifest path needs no shell change. Don't build runtime now (YAGNI), but don't shape the CSS in a way that blocks it.
- **Q: Dark-mode / high-contrast readiness (Law 9)?** A: The MODE layer already exists in tokens.css (`[data-theme="dark"]` + `@media`). It currently overrides the OLD semantic names — once shells consume Tier-2, dark mode becomes reachable for FREE (it rebinds the same roles). We do NOT validate dark mode in this effort, but the role model leaves the door fully open: tenant × mode are orthogonal root data-attributes. High-contrast = a future `[data-theme="hc"]` rebinding the same roles. No new architecture needed.
- **Q: How does this compose with `--sc` and the `data-color` chart catalog?** A: `--sc` is Tier-3, fallback rebased to `var(--color-accent)` — it stays as the per-page projector, now theme-aware. The `data-color` chart catalog ([[project_charts_split_8_1]]) is a separate, already-correct palette axis (categorical data viz, not chrome) — shells' chart literals migrate INTO it, not into neutrals.
- **Q: Why not just fix the catalog value `#005a9c → #0080BE` and call it done?** A: That fixes divergence but NOT adoption — shells still hardcode, so cohesion stays convention-bound and tenants still can't re-theme. Root cause is bypass, not a wrong value (Law 6). Must tokenize + gate.

## Consequences

**Positive:** cohesion becomes structural (FF-TOKEN-ONLY), un-regressable. New tenant = one `[data-tenant]` override, zero `packages/*` edits (multi-tenant unlocked). De-tenant north-star satisfied (brand splits out of engine). Dark mode becomes reachable for free. SSOT restored: role→value has one home. Tokens become part of the published engine contract ([[project_panel_external_product]]).

**Negative / costs:** ~34-file mechanical migration (5 phases). One deliberate byte-identity trade on ~3 near-duplicate collapses (mitigated by escape-hatch tokens). A new fitness gate to maintain. The geostat app must set `data-tenant` and reshape its index.css.

**Rejected alternatives:**
1. **Guardrail patch (fix `#005a9c`→`#0080BE` in catalog, lint new literals only).** Rejected: leaves shells hardcoded, cohesion stays convention-bound, tenants still blocked. Not root-cause (Law 6/7).
2. **Tailwind theme config as the SSOT (extend tailwind.config tokens).** Rejected: shells are plain CSS modules, not all Tailwind; CSS custom properties cascade is the lower, universal seam that also feeds Tailwind AND runtime injection. Tailwind would couple the token system to one styling tool.
3. **One mega-PR tokenization.** Rejected: not safely shippable, no per-phase byte-identity proof, violates Strangler-Fig (F5).
4. **CSS-in-JS theme provider (styled-components/vanilla-extract).** Rejected: heavy runtime, fights the existing CSS-module architecture ([[feedback_css_architecture]]), and the cascade already does theming natively for free.
