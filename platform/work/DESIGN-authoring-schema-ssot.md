# DESIGN — The Engine Manifest as the Single Authoring SSOT

> Cluster ①. Design-only. The Constructor (`apps/panel`) must CONSUME the engine's
> declared schema + capability manifest, never fork or hand-sync it. Strangler-Fig,
> phased, each phase green + reversible, each locked by a fitness function.
>
> Standard invoked: **SSOT** · **DRY** · **Fail-fast at the boundary** · **GRASP
> Protected Variations / Information Expert** · **OCP** · **Postel's Law** ·
> **Strangler-Fig** · **YAGNI**. Reference class: Builder.io content-model,
> Grafana panel/FieldConfig, RJSF/JSON-Forms schema-driven rendering.

---

## 1. Problem synthesis (grounded at file:line)

The engine already publishes ONE capability manifest and ONE authoring vocabulary:

- **`describeApp()`** — `packages/react/src/engine/constructor.ts:130` — composites every
  open registry into a JSON-serializable `AppManifest` (`constructor.ts:75`): `palette`,
  `propertySchemas`, `chartTypes`, `specTypes`, `perspectives`, `datasourceKinds`,
  `transformOps`, `metrics`, `exportFormats`, `filterControlTypes`, versioned by
  `CONTRACT_VERSION` (`constructor.ts:55`). Its own header (`constructor.ts:30-35`) declares
  it "the published API/contract of the renderer engine" and warns that a capability that
  silently disappears is a silent breaking change.
- **`PropSchema` / `PropField`** — `packages/core/src/config/prop-schema.ts:92` — the typed
  authoring vocabulary, deliberately hosted in `core` (the arrow) so a slice is the SSOT for
  both its behaviour AND its editor (`prop-schema.ts:9-19`).

Against that SSOT, four independent forks / lags were found:

**AD-3 — two visibility+validation cores, hand-synced (SSOT + DRY breach).**
- `packages/react/src/components/PropSchemaForm.tsx` is a generic schema→form renderer,
  exported + tested, whose own header admits "until now NOTHING rendered a FORM"
  (`PropSchemaForm.tsx:6-10`). It carries `isVisible` (`PropSchemaForm.tsx:71`) and
  `getAtPath` (`PropSchemaForm.tsx:54`).
- `apps/panel` never consumes it. It forked its own Inspector stack
  (`apps/panel/src/inspector/Inspector.tsx:91`) whose visibility core
  `apps/panel/src/inspector/showWhen.ts:74` is a **byte-identical regex mirror** of
  PropSchemaForm's — the file says so verbatim (`showWhen.ts:9` "Mirrors the engine
  PropSchemaForm's isVisible").
- The duplication is broader than the brief named. **Four** near-identical dot-path readers
  exist: `PropSchemaForm.tsx:54`, `showWhen.ts:14`, `validateNodeConfig.ts:26`,
  `saveGuard.ts:253` (the last, `getAt`, uses a `reduce` form with **no array-index
  handling** — a latent divergence bug against the other three). **Two** `showWhen`
  string evaluators (`PropSchemaForm.tsx:71`, `showWhen.ts:74`). **Three** validators that
  do not agree on shape: the engine's `validateNodeConfig` (`validateNodeConfig.ts:98`,
  returns `ValidationError[]`), the panel's `validateField` (`validateField.ts:23`, returns
  `string|null`), and the save gate that loops schema calling the panel one
  (`saveGuard.ts:172`) while the engine's `validateNodeByType` (`validateNodeConfig.ts:175`)
  goes uncalled.

**AD-2 — the save gate fails LATE, not early.**
`apps/panel/src/save/saveGuard.ts` runs four checks (`saveGuard.ts:69`) but **never
cross-checks `node.type`/`chartType`/`specType` against the manifest**. An unregistered type
falls straight through: `nodeRegistry.getSchema(node.type) ?? []` yields `[]`
(`saveGuard.ts:171`), the per-node loop iterates nothing, `getValidate` returns `undefined`
(`saveGuard.ts:183`), and the page **saves silently** — emitting a config the runner cannot
render. `saveGuard` imports `nodeRegistry` but uses only `getSchema`/`getValidate`, never
`has()` and never `describeApp()`.

**AD-1 — chart authoring lags the runner's rendered capability.**
The runner resolves the full Grafana-class FieldConfig/threshold system:
`resolveFieldConfig` (`packages/charts/src/interpreters/shared.ts:4`, applied in
`cartesian.ts`/`radial.ts`/`special.ts`), driven by `FieldConfig` (`core/src/field/config.ts:59`)
with `colorMode` (`config.ts:69`), `thresholds` (`config.ts:71`), `overrides`
(`config.ts:75`). `ChartNode` carries `fieldConfig` (`ChartNode.ts:30`). Yet `ChartSchema`
(`ChartNode.ts:36-53`) exposes **only** `chartType` + data-integrity — none of
`colorMode`/`thresholds`/`overrides`. The **gauge** slice DID expose `thresholds`
(`GaugeNode.ts:51`, as `type:'object'` → raw-JSON control); the dominant chart did not.

**Seam-3 — a live capability invisible to authoring (mirror of the map dead-node).**
`resolveDataLinks` (`packages/core/src/links/resolver.ts:65`) renders live cross-filter
(`resolver.ts:76-79`, `target:'filter'`) and drill (`target:'page'`/`'url'`). Authored on
`ChartNode.dataLinks` (`ChartNode.ts:32`). But `ChartSchema` exposes **no** `dataLinks`
field → the capability is dark in the Constructor.

---

## 2. The canonical model — one authoring SSOT

```
                     ┌──────────────── ENGINE (the SSOT) ────────────────┐
                     │  describeApp()  →  AppManifest                     │
   open registries → │    palette · propertySchemas · chartTypes ·       │
   (nodeRegistry,    │    specTypes · perspectives · datasourceKinds ·   │
    chartRegistry,   │    transformOps · metrics · exportFormats ·       │
    SPEC_CATALOG…)   │    filterControlTypes                             │
                     │  PropSchema  (core/config/prop-schema.ts)          │
                     │  config-semantics core  ← NEW SSOT (§4 P1)         │
                     │    evalShowWhen · getAtPath · setAtPath            │
                     └───────────────────────┬───────────────────────────┘
                                             │  consumed, never forked
                     ┌───────────────────────▼───────────────────────────┐
                     │  CONSTRUCTOR (apps/panel) — pure consumer          │
                     │   palette   ← manifest.palette                     │
                     │   forms     ← PropSchema  (Inspector, app-rich)    │
                     │   pickers   ← chartTypes/specTypes/perspectives…   │
                     │   visibility← evalShowWhen  (shared, not mirrored) │
                     │   SAVE GATE ← manifest compat-contract (fail-early)│
                     └────────────────────────────────────────────────────┘
```

**Invariant.** The Constructor holds no semantics the engine also holds. It renders no
schema the runner cannot render, and blocks any capability the runner has that the manifest
omits. Concretely: no forked `isVisible`, no hand-synced path accessor, no save that emits an
unregistered type, no chart display setting the runner honours but the schema hides.

Two things stay **correctly app-side** (Law 3 — `packages/react` is app-agnostic): the panel's
richer *controls* (LocaleField multi-locale authoring, EnumRefField resolving `enum-ref`
sources against discovery APIs — `prop-schema.ts:37-70` explicitly assigns this to the panel)
and the panel's Zustand/undo store mechanics. The SSOT is the **vocabulary and semantics**,
not the UI richness.

---

## 3. AD-3 decision — (a) extract, (b) demote: a deliberate HYBRID

The brief frames it as "(a) extract a shared engine primitive the panel consumes **or**
(b) demote the react primitive." The correct answer is **both, at two different
granularities** — because the two "cores" are not peers.

**The pure SEMANTICS (`evalShowWhen`, `getAtPath`, `setAtPath`) → EXTRACT (a).**
These define what `PropField.showWhen` *means* and how a stored dot-path *addresses* config.
If the runner and the authoring tool interpret them differently, a field visible in the
Inspector can be misread or invisible at render — a correctness bug, not a style nit. This is
textbook **SSOT**: one authoritative home, all else derives. It belongs in `core` beside
`prop-schema.ts` (pure TS, no React, satisfies the arrow; re-exported through
`@statdash/react/engine` so every current import path is unchanged, exactly as
`prop-schema.ts:16-17` already does for the vocabulary).

**The FORM COMPONENT `PropSchemaForm` → DEMOTE (b).**
`PropSchemaForm` and the panel `Inspector` are **not** peer engine-primitives to choose
between. The Inspector is a strict superset: open `FieldControlRegistry`
(`FieldControlRegistry.ts:31`, OCP dispatch), `LocaleField`/`EnumRefField`, `PropertyGroup`
fieldsets, inline `validateField` with `aria-describedby`, and a `SchemaSource` port
(`schemaSource.ts:32`) that already serves both node and chrome slices by Dependency
Inversion. `PropSchemaForm` is a flat, closed `FIELD_RENDERERS` map (`PropSchemaForm.tsx:165`)
with no groups, no validation display, no enum-ref resolution, and a raw-JSON fallback.

Therefore **"make the panel consume PropSchemaForm" is explicitly REJECTED**: it would be a
downgrade AND a Law-3 violation (it would drag app-level enum-ref/locale resolution down into
`packages/react`). `PropSchemaForm` is a **Speculative-Generality / "form nobody renders"**
artifact. Verdict:

1. Rewire `PropSchemaForm` onto the extracted core so it can never again be a *second
   semantics SSOT* (cheap, kills drift immediately).
2. Re-label it as the **headless, zero-dep reference fallback** for a *non-panel* embedder —
   and mark it for retirement unless a real second consumer appears (**YAGNI**). The panel
   `Inspector` is, and remains, THE authoring surface.

This is the root-cause kill the charge demands: not "pick one form," but "there is exactly
one *meaning* of visibility and one *meaning* of a config path, and everything imports it."

---

## 4. Phased Strangler roadmap

Ordered so the foundational SSOT lands first (architecture leads, code follows), reducing
churn for every later phase that sits on the shared path/visibility helpers. Each phase is
green + reversible on its own.

### P1 — Semantics SSOT (the MVP, Wave 3)

Extract to `packages/core/src/config/`:
- `prop-path.ts` — `getAtPath` / `setAtPath` (SSOT for the dot-path grammar; `setAtPath`'s
  numeric-segment=array-index rule, `showWhen.ts:47-67`, is a config-semantics concern, not a
  store concern — the write grammar must match the read grammar exactly).
- `prop-visibility.ts` — `evalShowWhen(showWhen, values)` (the single `lhs === rhs`
  parser; Postel's Law — liberal, never throws on author input).

Rewire all consumers onto them: `PropSchemaForm.tsx` (→ demoted per §3), `showWhen.ts`
(becomes a thin re-export so `Inspector.tsx:27` is untouched), `validateNodeConfig.ts:26`,
and `saveGuard.ts:253` (`getAt` → the shared array-safe accessor, fixing its latent
divergence). Retire the four duplicate bodies.

- **FF-NO-FORKED-ISVISIBLE** — exactly one `showWhen` regex/parser exists in the tree
  (arch/grep test); `showWhen.ts` contains no second literal, only a re-export.
- **FF-ONE-PATH-ACCESSOR** — exactly one `getAtPath`/`setAtPath` implementation; all sites
  import it.
- **FF-SEMANTICS-PARITY** — the extracted `evalShowWhen`/`getAtPath` agree, over a case
  table, with the pre-extraction copies (guards the swap; delete once green).

*Why MVP:* smallest, fully reversible, zero user-visible change, and it is the "kill the
duplication at root" charge. It establishes the one vocabulary every later phase builds on.

### P2 — saveGuard as the capability-compat contract (fail-early)

Add a fifth check to `validatePageForSave` (`saveGuard.ts:69`): **`capability-registered`**.
Read the manifest (`describeApp()` / direct registry `has()`), then for every node assert
`nodeRegistry.has(node.type, node.variant)`; for every chart node assert
`chartType ∈ manifest.chartTypes`; for every data-bearing node assert its `specType ∈
manifest.specTypes` and its datasource kind ∈ `manifest.datasourceKinds`. Any miss →
`ok:false` with an actionable, deep-linkable `SaveIssue`. This shifts an unrenderable-config
failure from gold-trigger-reject to authoring time — **Fail-fast at the boundary**.

- **FF-SAVEGUARD-DESCRIBES** — a page containing a bogus `node.type` (or unknown
  `chartType`/`specType`) makes `validatePageForSave` return `ok:false` with a
  `capability-registered` issue.

Independent of P1; sequenced after it only because both touch the registry-consumption
surface and P1's array-safe accessor removes a bug from the same file.

### P3 — AD-1 chart FieldConfig hybrid (see §5)

Add `fieldConfig.colorMode` + `fieldConfig.thresholds` to `ChartSchema`. DEFER `overrides`.

- **FF-CHART-FIELDCONFIG-AUTHORABLE** — `describeApp().propertySchemas['chart:default']`
  contains `fieldConfig.colorMode` and `fieldConfig.thresholds`; a config authored through the
  schema round-trips to exactly the `fieldConfig` the runner's `resolveFieldConfig` consumes.

Independent of P1/P2; parallelizable after P1.

### P4 — Seam-3 cross-filter/drill authorable (see §6)

Expose `ChartNode.dataLinks` as an authored schema field. MVP = `type:'array'` (JsonControl
fallback) so it is authorable + round-trips + save-validated. Name the rich-control seam.

- **FF-DATALINKS-AUTHORABLE** — `ChartSchema` exposes `dataLinks`; a saved `DataLinkDef`
  survives the round-trip gate (`saveGuard.ts:128`) and resolves via `resolveDataLinks`.

Independent; parallelizable after P1.

**Dependency order:** P1 → {P2, P3, P4} (the latter three fan out in parallel once the shared
semantics exist). P1 is the only hard prerequisite.

---

## 5. AD-1 — the HYBRID spec (expose now / defer the matrix)

**Expose now, in `ChartSchema` (`ChartNode.ts:36`), group "Visualisation":**

- `fieldConfig.colorMode` — `type:'string'`, `options: [fixed, palette, thresholds]`
  (mirrors the `ColorMode` union, `config.ts:40`). A plain select via the existing
  `SelectControl` — zero new control.
- `fieldConfig.thresholds` — `type:'object'` (raw-JSON control, **identical to the gauge
  field** `GaugeNode.ts:51`), with `showWhen: "fieldConfig.colorMode === 'thresholds'"`.
  The `showWhen` lhs is a dot-path the P1 evaluator handles directly — no new mechanism.

**Pattern naming.** This is **OCP** (new schema fields = new authorable capability, the
generic Inspector unchanged), **Information Expert** (the chart slice owns its authoring
schema — the SSOT-for-behaviour-and-editor rule of `prop-schema.ts:12`), and **DRY /
Composition** (lift the gauge's threshold control unchanged; when a richer `ThresholdControl`
is later registered on `FieldControlRegistry` for `type:'object'`+context, it serves gauge
AND chart from one registration).

**Protected Variations wrinkle.** `ChartNode.fieldConfig` is a `LocaleFieldConfig`
(`ChartNode.ts:5,30`) — its `unit`/`noValue` text is bilingual and resolved at the
`resolveChartDefLocale` boundary. `colorMode` and `thresholds` are locale-agnostic; author
them WITHOUT `coverage:'localized'` so the LocaleString resolution boundary is untouched. The
localized text fields (unit/noValue) are a separate, later schema addition.

**DEFER — `fieldConfig.overrides` (the FieldOverride matrix, `config.ts:47`).** Seam name
**D-FIELD-OVERRIDE-MATRIX**. Reason: a per-series override needs a match-builder control that
enumerates resolved series (a genuinely richer control, not a JSON fallback), and per-series
divergence has no current authoring demand — **YAGNI** until the second real caller. The
`fieldConfig` object still accepts a hand-written `overrides` array (the runner honours it);
we simply do not yet ship a control for it.

---

## 6. Seam-3 — making the live cross-filter authorable

**MVP (P4).** Add `dataLinks` to `ChartSchema` as `type:'array'` → JsonControl fallback. This
alone moves the capability from dark to authorable, round-trippable, and save-validated.

**The rich-control seam (name it, defer it): D-DATALINK-BUILDER.** The strong signal that this
seam is *designed-for*: `PropFieldSource` already declares `'filterParams'` and `'pages'`
(`prop-schema.ts:57,66`) — the exact discovery sources a Law-2-correct link builder needs.
A future `DataLinkBuilder` FieldControl would let the author pick, for `target:'filter'`, an
authored filter param via `enum-ref` source `'filterParams'`, and for `target:'page'` a page
via source `'pages'` — *choosing* a registered param/page, never typing a raw key. That is the
open extension point; the JSON fallback is the bridge until an author needs the guided UX.

**Discovery.** Cross-filter is a *property of a chart*, not a palette tile — so it surfaces in
the Inspector (a field), not the `NodePalette`. Optionally, a `cross-filter-source` /
`drill-source` cap token would let `getByCapability` (`NodeRegistry.ts:240`, already consumed
by `apps/panel/src/discovery/capabilityGate.ts`) drive a "which charts link where" affordance
— a nice-to-have follow-on, not part of the MVP.

---

## 7. YAGNI ledger (deferred, with the door named)

| Deferred | Door | Trigger to build |
|---|---|---|
| `FieldOverride[]` per-series matrix authoring | **D-FIELD-OVERRIDE-MATRIX** | first author needing per-series divergence; needs a series-enumerating match-builder control |
| Guided `DataLinkBuilder` control (filterParams/pages pickers) | **D-DATALINK-BUILDER** | JSON-authored links become common; the `enum-ref` sources already exist |
| Retire `PropSchemaForm` entirely | — | confirm no real non-panel headless embedder; until then keep as rewired reference fallback |
| Localized `fieldConfig.unit`/`noValue` schema fields | — | authors need to translate chart units in-Constructor (separate from colorMode/thresholds) |
| Unify `validateField` (panel) with `validateNodeConfig` (engine) into one validator | — | after P1/P2 prove the shared-core pattern; today they differ in return shape by design (inline message vs `ValidationError[]`) |
| `cross-filter-source` cap + `getByCapability` discovery affordance | — | after P4 MVP, if a "links overview" UX is wanted |

Fitness fns (each named inline in its phase): `FF-NO-FORKED-ISVISIBLE` ·
`FF-ONE-PATH-ACCESSOR` · `FF-SEMANTICS-PARITY` (P1) · `FF-SAVEGUARD-DESCRIBES` (P2) ·
`FF-CHART-FIELDCONFIG-AUTHORABLE` (P3) · `FF-DATALINKS-AUTHORABLE` (P4) — each fails the
build if the Constructor re-forks what the engine already declares.
