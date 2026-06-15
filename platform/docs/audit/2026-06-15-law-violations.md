# Audit — Law Violations — 2026-06-15 (auditor: Opus)

Scope: read-only sweep of `platform/` against the four binding laws
(dependency arrow · no-privileged-dims · DataSpec-declarative · react-agnostic),
plus an open eye for any integrity threat beyond the floor.

Summary: **2 findings — 0 blocker, 2 high, 0 medium, 0 low** (live code).
Plus 1 pre-known blocker (dead Track-B re-exports) reconfirmed, already backlogged.

| id | location | finding | principle | severity | reversibility | ISO 25010 | fix |
|----|----------|---------|-----------|----------|---------------|-----------|-----|
| D-1 | `engine/react/src/components/filters/CascadeSelect.tsx:40,42` | Hardcoded Georgian UI strings `დონე ${n}` (aria-label) and `ყველა` ("All") as fallbacks inside an app-agnostic component | Law 4 (react-agnostic) | high | two-way | Portability, Reusability | Lift strings to required props / i18n token; component takes `placeholders`/`allLabel`, app supplies them |
| D-2 | `engine/react/src/context/SiteContext.tsx:43-45` | `DEFAULT_I18N` hardwires `locales:['ka']`, `defaultLocale:'ka'`, `fallbackLocale:'ka'` — a Geostat-specific default baked into the shared shell | Law 4 (react-agnostic) | high | two-way | Portability, Reusability | Remove the `ka` default; make I18nConfig a required `SiteProvider` prop, or default to a neutral locale-agnostic stub |
| B-* | (none) | — | Law 1 | — | — | — | clean — see notes |
| C-* | (none) | — | Law 2 | — | — | — | clean — see notes |
| A-* | (none) | — | Law 3 | — | — | — | clean — see notes |

## Findings in detail (root-cause, not symptom)

### D-1 — Georgian literals in `CascadeSelect` (high)
`engine/react/src/components/filters/CascadeSelect.tsx`
- L40: `aria-label={placeholders[levelIdx] ?? `დონე ${levelIdx + 1}`}`
- L42: `<option value="">{placeholders[levelIdx] ?? 'ყველა'}</option>`

**Root cause (structural, not "uses a Georgian string"):** `engine/react` is the
app-agnostic adapter layer (Law 3/4 — Geostat specifics belong in `plugins/`).
This component was authored with a *fallback* convenience so a caller could omit
`placeholders` and still render — but the fallback was written in the Geostat
product's primary locale (`ka`) instead of staying locale-neutral. The component
silently assumes its consumer is the Georgian app. The moment a second consumer
(panel constructor preview, a non-`ka` deployment) renders it without placeholders,
it leaks Georgian into their UI. This is a **Principle-of-Least-Astonishment** and
**Open/Closed** break: the component is closed against new locales because a domain
default is hardwired in the leaf.

**Proven fix:** make the labels injected, not defaulted in-layer. Either (a) make
`placeholders`/`allLabel` required props (fail-fast at the type boundary — *make
illegal states unrepresentable*), or (b) resolve them through the existing i18n
token mechanism (`useT`, present in `SiteContext`) so the string lives in the
app/locale catalog, not the component. The `ka` text moves down to `plugins/` or
the app i18n manifest where it belongs (Strangler-Fig: add the prop, migrate the
one current caller, delete the literal).

### D-2 — `ka`-hardwired `DEFAULT_I18N` in `SiteContext` (high)
`engine/react/src/context/SiteContext.tsx:42-46`
```
const DEFAULT_I18N: I18nConfig = { locales: ['ka'], defaultLocale: 'ka', fallbackLocale: 'ka' }
```

**Root cause:** `SiteContext` is the shared site-shell provider in the agnostic
layer. A default was needed so `SiteProvider` works without explicit i18n config;
the default was filled with the *current* product's locale rather than a neutral
one. This is the classic "agnostic layer carries the first customer's identity"
erosion (Lehman: the shell accreted Geostat assumptions instead of staying
generic). It is more load-bearing than D-1 because every consumer that doesn't
pass `i18n` silently inherits Georgian-only locale config — a constructor-authored
site for a different tenant would be wrong by default.

**Proven fix:** the SSOT for locale is the **app/site manifest**, not the shell.
Make `i18n` a required prop of `SiteProvider` (the app already passes
`i18n={manifest.i18n}` per the doc comment on L6), and delete `DEFAULT_I18N`; or,
if a default must remain for ergonomics, make it locale-neutral (`['en']` is no
better — prefer requiring it). Encode as a fitness function: `engine/react/src/**`
must contain zero `[Ⴀ-ჿ]` codepoints and no literal `'ka'`/`'ka-GE'`.

## Categories that are clean (and *why* — so the floor isn't mistaken for absence of review)

- **A — Dependency arrow (clean).** No `engine/core/src/**` import of `engine/react`
  or `@geostat/react`; no `engine/react/src/**` import of `plugins/` or `apps/`.
  package.json confirms it: `engine/react` depends only on `@geostat/engine` +
  `@geostat/styles`. `@geostat/expr` is imported by both core and react — this is
  **correct**: `expr` is the bottom expression leaf (no upstream deps), so depending
  on it does not violate the arrow.

- **B — No-privileged-dims (clean).** Zero `ctx.year` / `ctx.regionId` / `ctx['year']`
  style accesses. The codebase consistently uses the generic map `ctx.dims['time']`
  (`spec.ts:98`, `kpi.ts:65/71`, `resolvers.ts:21`, `sdmx.ts:23`). `timeMode: 'year'`
  (`store.ts:299`, `useFilterState.ts:40/107`) is **not** a privileged dimension — it
  is a value of the `TimeMode` discriminated union (`'year'|'range'`), i.e. a mode
  discriminant, which is exactly the sanctioned pattern. No violation.

- **C — DataSpec-declarative (clean).** Zero `getRows:(ctx)=>…` or function
  expressions inside DataSpec. The `_val()` methods in `core/src/data/store.ts`
  (L186/280/433) are **private store internals** — the data/renderer layer, where
  imperative lookup logic *belongs* (Law 2: "logic lives in the renderer"). They are
  not in config. `interpretSpec(spec, ctx, store)` is the declarative boundary and it
  holds.

## Fixed in-place this pass
None — read-only run.

## Backlogged to project_debt (ids)
- D-1, D-2 → new (recommend board cards; see orchestrator handoff below).
- Pre-known blocker reconfirmed (NOT re-found, already in `project_debt.md`):
  `engine/react/src/index.ts:24-35` re-exports dead Track-B types
  (`SectionDef`, `WidgetDef`, `TabsDef`, `TabEntry`, `PageHeaderDef`, `FilterBarDef`,
  `KpiStripDef`, `LinksDef`, …) from `@geostat/engine`. Layer 6.3 BLOCKED on TS
  upgrade per `docs/plan/roadmap-phase-5-6.md`. No action this pass.

## Cross-cutting / systemic
**The one systemic pattern worth naming:** both live findings are the *same erosion
shape* — the agnostic `engine/react` layer carrying the **first tenant's identity
(`ka` locale)** as an in-layer default/fallback. This is Lehman's law in action: the
shared layer accretes the assumptions of its only current consumer unless a fitness
function forbids it. The two are not coincidental; they will recur at every new
"convenience default" added to `engine/react` until the rule is mechanized.

**Recommended fitness function (encode the law, don't re-audit it):**
a CI grep gate over `engine/react/src/**` and `engine/core/src/**` asserting:
(1) no Georgian codepoints `[Ⴀ-ჿ]`, (2) no literal `'ka'`/`'ka-GE'` locale
constants. This converts "react stays agnostic" from a comment into an enforced
invariant (SKILL §5 fitness functions; standards-as-code §10). Without it, D-1/D-2
will reappear.
