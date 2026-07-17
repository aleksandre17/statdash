---
name: semantic-token-spine
description: The semantic-token/theming spine end-to-end — P0 (3-tier tokens, brand-neutral default, [data-tenant] override seam) through Pfinal (full role inventory, FF-TOKEN-ONLY error gate, FF-TENANT-OVERRIDE, cssVar() util) — plus the byte-identity gotcha (kept verbatim) that governs any future tokenization pass
metadata:
  type: project
---

The semantic-token spine ([[adr-semantic-token-theming-spine]]) shipped in two stages, both DONE and
green. This is the current-state architecture; see git history for the P1–P5 per-layer rollout order.

## Mechanism (SSOT)

- **Tier 1 (primitive ramps)** — `--blue-50..900`, `--teal-50..900` etc. in `packages/styles/src/css/
  tokens.css` `:root`. Not cataloged; referenced only by Tier 2.
- **Tier 2 (semantic roles)**, same `:root`, brand-NEUTRAL defaults: text {primary,secondary,muted,
  faint,inverse}, surface {_,raised,sunken,frame,hover,translucent,skeleton}, border {_,subtle,frame,
  strong,interactive,translucent}, accent {_,hover,muted,bg,secondary,ring,chip-bg,chip-border},
  chart-frame/-grid, trend {positive,negative}, heading-display(-muted), breadcrumb-separator, error
  family, danger-fg, STATUS families (`--status-*` alert tones AND the DISTINCT SDMX
  `--status-obs-{preliminary,estimate,revised,confidential}-*` + `--status-total-*` taxonomy — these
  do not share values with `--status-*`, they're a different concern). All mirrored into
  `tokens/color.ts` COLOR/STATUS + user-facing ones into `catalog/color.ts` (bilingual {ka,en}).
- **Tier 3 (per-element accent projectors)** — `--sc`, `--kc`, `--rc`, `--tc`, `--card-accent`: each
  rebases its literal fallback to `var(--color-accent)` (e.g. `var(--sc, var(--color-accent))`).
- **A tenant theme is a selector block** — `[data-tenant="<x>"] { --color-accent: ...; }` — that
  overrides ONLY Tier-2 roles. `document.documentElement.dataset.tenant` is set at app boot.
  `--color-accent-ring` derives via `color-mix()` from whatever accent is active, so it always
  follows the tenant/theme without its own override.
- **`cssVar(name, fallback)`** (`@statdash/styles/utils/cssVar.ts`) — reads
  `getComputedStyle(documentElement).getPropertyValue(name)` with a literal fallback for SSR/jsdom.
  The bridge for contexts where `var()` itself is invalid (see the gotcha below): Apex builders,
  DonutChart/DonutTip, HeroGraphic, annotationUtils, GeoMap's Leaflet `PathOptions` fill/stroke
  functions. Plain `var()` is used instead wherever the literal lives in a React `style={{}}` object
  (TreemapChart, HBarDivergingChart, StatsCarouselShell) — `var()` IS valid there.

## The gates

- **FF-THEME-COMPLETE** (`tokens.parity.test.ts`) — every `var(--color-*)` referenced anywhere in
  `src/tokens/**` must be bound by the DEFAULT (light) theme — a role defined only in a dark/tenant
  layer fails.
- **FF-TOKEN-ONLY** (`packages/plugins/nodes/__tests__/token-cohesion.fitness.test.ts`,
  `@vitest-environment node`) — scans `packages/plugins/**`, `packages/react/src/**`,
  `packages/charts/src/**`, `packages/core/src/**` (.css/.ts/.tsx) for hex/rgb/hsl; **ERROR**, not
  warn (flipped at Pfinal). No dir-level exclusions — only `dist/`, `node_modules`, `*.test.*`,
  `*.stories.tsx`. Strips `cssVar(...)`/`var(--)`, `rgba(0,0,0,…)` overlays, and `//` line comments
  before scanning. The allowlist is **value-aware**: an entry may pin `literals:[…]` so ONLY those
  exact values are exempt in that file (a brand hex slipped in beside a sanctioned seed still fails).
  4 entries max, each asserted still-present (no stale exemptions): `mapColorUtils` DEFAULT_PALETTE
  (Leaflet-fed sequential ColorBrewer-Blues) + `PropSchemaForm` whole-file `#000000` +
  `charts/src/colors.ts` pinned neutral series-grey/action-red wire-seeds + `core/src/registry/
  resolvers.ts` pinned growth +/- semantic pair. The `charts`+`core` scan scope was added at Wave-1
  (2026-06-28) to close a real hole: `charts/colors.ts`'s `DEFAULT_ACCENT_COLOR` had shipped as the
  EXACT geostat brand hex under a "neutral default" guise, unscanned until then.
- **FF-TENANT-OVERRIDE** (`packages/react/src/engine/tenant-override.fitness.test.tsx`,
  `@vitest-environment jsdom`) — loads the real tokens.css + a synthetic `[data-tenant=test]`
  override, asserts the computed custom-prop flips and `cssVar()` observes it. jsdom DOES resolve the
  custom-property cascade `:root → [data-tenant]`; it does NOT do `var()` substitution — assert on
  the custom-prop value the shell actually consumes, not a resolved rendered color.

## Guard for comments in packages/{react,styles}

`no-tenant-content.fitness.test.ts` scans those two packages for `/geostat/i` with an intentionally
EMPTY allowlist — seam comments must stay generic ("a tenant theme rebinds this family"), never name
the tenant or its brand hex.

---

## The byte-identity gotcha (verbatim — governs any future tokenization pass)

Tokenizing shells against the semantic spine under a **byte-identical** invariant has two systematic
traps that the ADR's role→value table hides:

**1. ADR §3 "collapse" rows are intentionally ΔE<3 merges — NOT byte-identical.** Each role row lists
several literals collapsing to ONE value, but only the FIRST (the canonical resolved token value)
renders identically. The divergent near-duplicates (which a byte-identical pass MUST leave literal +
report, not tokenize, until a ΔE trade is explicitly ratified):
- text-secondary = `#4A5568` only. NOT `#2D3748`, `#445A66`.
- text-muted = `#6B7B8D` only. NOT `#5A7A8A`, `#718096`, `#6B8899`.
- text-faint = `#9AABB8` only. NOT `#94A3B8`, `#B0C4CC`.
- border-strong = `#C8D5D9` only. NOT `#CBD5E1`, `#CBD5E0`.
- border-interactive = `#B0C8D4` only. NOT `#B0C4CC`.
- surface-raised = `#FAFBFB` only. NOT `#F8FAFA`, `#F8FAFB`, `#F7FAFA`.
- accent-muted (geostat) = `#E6F3FA` only. NOT `#EAF4FB`, `#F0F8FF`.
- accent-secondary (geostat) = `#00A896` only. NOT `#2A9D8F`.

**2. `var()` resolves in CSS contexts ONLY — not SVG presentation attributes.** Safe to tokenize:
React inline `style={{ color: 'var(--x)' }}`, CSS custom-property values (`style={{ '--kc':
'var(--color-accent)' }}`), and ApexCharts `fill.colors`/`track.background` strings (Apex resolves
`var()`). NOT safe: JSX SVG presentation attributes (`<text fill="var(--x)">`, `<rect stroke=...>`)
and JS-fed Leaflet `PathOptions` (`fillColor`) — `var()` is invalid as a presentation-attribute value
→ renders black/no-fill. Use `cssVar()` there instead.

**3. Tier-3 per-element accent projectors** (`--sc`, `--kc`, `--rc`, `--tc`, `--card-accent`): rebase
their literal fallback `#0080BE` → `var(--color-accent)` exactly like `--sc` did in P0. `--rc`/`--tc`
are never set in TSX (always fall through to fallback) so the rebase is pure win.

**4. Status tones diverge from `--status-*` tokens.** data-table OBS_STATUS badges and the kpi
preliminary badge do NOT equal `--status-warning-*` — the ADR's "map to --status-*" instruction
breaks byte-identity unless the status-token values are first reconciled; report the divergence,
don't force the remap.

---

## Pfinal ratification (the ΔE collapses ARE now applied)

Pfinal is the point where the byte-identity hold above was explicitly LIFTED for the cohesion-first
trade: `#5A7A8A`/`#6B8899`/`#6B8896`/`#718096`→text-muted; `#445A66`/`#2D3748`/`#3D4F5C`/`#334155`
→text-secondary; `#B0C4CC`/`#8FA4AE`→text-faint; assorted off-whites→surface-raised/sunken;
`#CBD5E0`/`#CBD5E1`/`#cbd5e1`→border-strong; `#EFF3F3`/`#f0f0f0`→surface-frame;
`#EAF4FB`/`#F0F8FF`→accent-muted. There is no allowlist for frozen color debt in the FF-TOKEN-ONLY
error gate — a straggler literal had to either collapse into an existing role (ΔE 3–10, same design
intent) or get its own new role (trend/error/heading-display/etc., listed above).

**DonutChart split** (bloat ceiling 400 lines, hit at 403 during this pass): `donutGeometry.ts` (pure
label-placement math), `DonutTip.tsx` (hover tooltip), `DonutChart.tsx` (~95-line view) — clean SoC,
not a line-count dodge.

**Geograph straggler (closed):** `GeoMap.tsx` `FILL_COLOR`/`#fff` → `cssVar('--color-accent', ...)`/
`cssVar('--color-surface', ...)` (Leaflet `PathOptions` is JS-fed, `var()` invalid — gotcha #2). The
`geograph/` dir-level FF-TOKEN-ONLY exclusion was REMOVED once this landed.

**Charts EMIT path — the charts-LOCAL cssVar twin (closed 2026-07-12).** The server-side SVG
realizer (`packages/charts/src/emit/`: `emitter.ts` placeholder, `cartesian.ts` chrome, `palette.ts`
`EMIT_PALETTE`) had baked hex literals — FF-TOKEN-ONLY scans `charts/src/**`, so these were red.
`charts` MUST NOT import `@statdash/styles` (Law 3: it's inside the arrow `…←core←charts←react`,
styles is a render-layer leaf). Lawful path = a DELIBERATE charts-local twin `emit/cssVar.ts`
(byte-identical logic to styles' cssVar, guarded `getComputedStyle`→fallback): the VALUE SSOT stays
single (tokens.css), only the ~5-line resolver is duplicated across the arrow boundary. All emit
colours now `cssVar('--token', <light fallback>)`: `--chart-color-1…10`, `--color-chart-frame/-grid`,
`--color-text-muted/-secondary`, `--color-surface`. SVG presentation attrs can't hold `var()`
(gotcha #2), and the emitter is server-side (no DOM) → cssVar returns the fallback = deterministic
export; a browser export re-themes for free. NOTE: the emit muted fallback was STALE `#6B7B8D`; the
SSOT `--color-text-muted` is now `#5A6B7D` (darkened for WCAG AA 4.5:1, tokens.css) — aligned the
fallback to close the drift (no assertion pinned the old value). `emit.fitness.test.ts` pins
`stroke="#F0F5F3"` (grid) + authored per-point colours — all unchanged since fallbacks == SSOT light.
Allowlist stays 3 entries (PropSchemaForm, charts/colors.ts neutral seeds, core resolvers.ts) — the
emit path did NOT need an exemption; cssVar-pairing is the honest fix.

See also [[project_dark_mode_completeness_and_fitness]] (the dark-mode override LAYER built on top
of this spine) and [[project_geostat_tenant_dark_cascade_gap]] (a tenant stylesheet silently
defeating the dark-flip mechanism by source-order — a distinct, later-found defect class).
