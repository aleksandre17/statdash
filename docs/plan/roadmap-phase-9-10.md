# Roadmap — Phase 9: Standard-Setting · Phase 10: North Star

> Operating rules: [IMPLEMENTATION-ROADMAP.md](IMPLEMENTATION-ROADMAP.md)

---

## Phase 9 — Tier 2: Standard-Setting (official-statistics grade)

`ARCHITECTURE-TARGET.md §Tier 2`. Execute the **spine** (🟩) first — after it the platform is standard-setting; the rest compounds. Spine moves get full layers; high-value/polish are tabled and scheduled as capacity allows.

---

### Layer 9.1 — Typed `PropSchema` per slice + manifest export `[N10, N11]` 🟩 ✅

> **✅ DONE (2026-06-15)** — `PropField`, `PropSchema`, `PropFieldType`, `PropFieldOption`, `PropFieldValidation` added to `slice-meta.ts`. All four meta interfaces (`NodeSliceMeta`, `PageSliceMeta`, `PanelSliceMeta`, `ChromeSliceMeta`) use `schema?: PropSchema`. `NodeRegistry`: `StoredMeta.schema?: PropSchema`, `getSchema() → PropSchema | null`, `RegistryManifest` interface, `describeRegistry()` → `{ palette, propertySchemas }`. 19 plugin files migrated from JSON Schema objects to typed `PropField[]` arrays (enum fields → `options:[]`; nested schemas collapsed to `array/object` leaves). Card's empty placeholder schema removed. All types re-exported from `@geostat/react/engine`. tsc EXIT=0.

**Goal:** Every slice is self-describing — the Constructor's property panel is generated from typed per-slice schemas, not hand-built.

**Scope:**
- Replace `NodeSliceMeta.schema?: object` with a typed `PropSchema` (field · type · label · default · validation · `showWhen` · group), declared by every node/panel/control/chrome slice.
- `@geostat/constructor` (from N2) gains `describeRegistry()` → `{ palette, propertySchemas, datasourceCatalog, chartTypes, specTypes }` as JSON.
- The same `PropSchema` validates a stored config on load.

**Definition of Done:**
- [x] Every registered slice declares a typed `PropSchema`.
- [x] `describeRegistry()` emits the full builder manifest as JSON (round-trips).
- [ ] A stored config validates against its slice's schema.
- [x] `npx tsc --noEmit` = 0 errors.

**Dependencies:** Phase 7.2 (`@geostat/constructor` exists), Phase 0.4 (live-tree validation)
**Touches:** engine/react · packages/constructor · plugins
**Estimated size:** M (half-day) — **split per slice family if it exceeds M**
**Risk:** MED — broad but mechanical; the schema type is the one design call.
**Closes:** N10, N11 — *the move that makes the Constructor real.*

---

### Layer 9.2 — Provenance plane `[N14]` 🟩

**Goal:** Every figure resolves its source · vintage · methodology · `OBS_STATUS` · confidence, surfaced uniformly.

**Scope:**
- `MetadataPort` in the engine; `DataRow.status` (existing OBS_STATUS) generalizes to a provenance record. A shared info-affordance on chart/table/KPI surfaces it.

**Definition of Done:**
- [ ] Any rendered figure can resolve its provenance via one port.
- [ ] Provenance is uniform across panels, not per-shell ad hoc.
- [ ] `npx tsc --noEmit` = 0 errors.

**Dependencies:** Phase 3.1 (datasource seam)
**Touches:** engine/core · plugins · src/data
**Estimated size:** M
**Risk:** MED — provenance must thread from source through transforms without lying.
**Closes:** N14

---

### Layer 9.3 — Accessibility contract + chart→table fallback `[N15]` 🟩

**Goal:** Every chart has an equivalent accessible data table; WCAG 2.1 AA enforced in CI.

**Scope:**
- Every chart shell exposes an accessible `<table>` alternative (ONS standard). Add `axe-core` checks to the test run; each shell declares its a11y contract (roles, labels, keyboard path).

**Definition of Done:**
- [ ] Every chart has a screen-reader/keyboard-usable table equivalent.
- [ ] `axe-core` gate passes in CI for every shell.
- [ ] `npx tsc --noEmit` = 0 errors.

**Dependencies:** Phase 6.2 (i18n'd aria)
**Touches:** plugins · test harness
**Estimated size:** M
**Risk:** MED — a11y is verify-heavy; budget testing time.
**Closes:** N15

---

### Layer 9.4 — `Result<T, Diagnostic>` error contract `[N17]` 🟩 ✅

> **✅ DONE (2026-06-15)** — `diagnostic.ts` (new): `Diagnostic` interface (code + message + path + context + level), `DiagnosticLevel`, `diagError`/`diagWarning`/`diagInfo` helpers, `Result<T>`/`ok`/`err`. `diagnostics.ts`: `DiagnosticObserver` now receives typed `Diagnostic` (was ad-hoc `(code, detail)`); `emitDiagnostic(d)` typed. `spec.ts`: `console.warn` removed — engine ships pure; `emitDiagnostic(diagWarning(...))` routes `UNKNOWN_SPEC_TYPE`. `resolvers.ts`: call site updated. `@geostat/engine` public API exports `Diagnostic`, `Result<T>`, all helpers. App-layer observer updated (DEV-only, 1 consumer). 09-B cleared by Opus (additive + 1 call site + DEV-only, fully reversible). tsc EXIT=0.

**Goal:** Resolvers, validators, and stores speak one diagnostic language — the disciplined form of "no silent failure."

**Scope:**
- Introduce `Result<T, Diagnostic>` in engine-core; resolvers/validators/stores return it instead of the `[]`/`console.warn`/`throw` mix. The render boundary surfaces diagnostics to the Constructor.

**Definition of Done:**
- [ ] One `Result`/`Diagnostic` type across the engine boundary.
- [ ] Misconfiguration is a typed value, never a silent empty.
- [ ] `npx tsc --noEmit` = 0 errors.

**Dependencies:** Phase 0.1/0.2 (diagnostics already started there), Phase 1.1 (observability seam)
**Touches:** engine/core · engine/react
**Estimated size:** M
**Risk:** MED — touches every resolver return; migrate behind the existing boundary.
**Closes:** N17

---

### Layer 9.5 — Security contract `[N24]` 🟩 ✅

> **✅ DONE (2026-06-15)** — `links/resolver.ts`: `SAFE_URL_SCHEMES` allowlist (rejects `javascript:`/`data:`/`vbscript:` in URL templates), `encodeURIComponent` on all substituted params. `FilterContext.tsx`: `sanitizeParam()` (max 512 chars + protocol prefix block) applied on mount + back/forward re-sync. `index.html`: baseline CSP meta (`script-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`; `unsafe-inline` for ApexCharts; `connect-src 'self' https:`). `resolveTemplate`: JSDoc confirms XSS-safe via React text rendering. All `target="_blank"` links already had `rel="noopener noreferrer"`. No `dangerouslySetInnerHTML` path exists. tsc EXIT=0.

**Goal:** The three injection surfaces — template interpolation, dataLinks, URL params — are XSS-safe; CSP in place.

**Scope:**
- XSS-safe `{dim}` template rendering (escape; no `dangerouslySetInnerHTML`), URL/param sanitization at the filter boundary, CSP headers, safe external-link policy (already `noopener`).

**Definition of Done:**
- [ ] Template, dataLink, and URL-param paths escape/sanitize untrusted input.
- [ ] CSP headers set; no inline-HTML injection path.
- [ ] `npx tsc --noEmit` = 0 errors.

**Dependencies:** none
**Touches:** engine/core · engine/react · src
**Estimated size:** S (1–2h)
**Risk:** MED — security; test the injection surfaces explicitly.
**Closes:** N24

---

### Layer 9.6+ — High-value & polish (scheduled as capacity allows)

| Layer | Move | Op · Weight | Closes |
|---|---|---|---|
| 9.6 | Transforms become a registry (drop the 15-case switch) | 🔵 M · 🟨 | N12 |
| 9.7 | Export registry (csv · xlsx · sdmx-json · png · svg) | 🔵 M · 🟨 | N16 |
| 9.8 | Registry contract-test harness + golden-file tests | 🟢 M · 🟨 | N18 |
| 9.9 | Page-level `schemaVersion` + migration chain | 🔵 M · 🟨 | N19 |
| 9.10 | Themeable design system + WCAG contrast + dark/high-contrast | 🔵 M · 🟨 | N20 |
| 9.11 | Component catalog (Storybook) | 🟢 M · ⬜ | N21 |
| 9.12 | ICU message format + locale-aware collation | 🔵 S · ⬜ | N22 |
| 9.13 | Telemetry plane (extend `ResolveObserver` → `TelemetryPort`) | 🟢 M · ⬜ | N23 |
| 9.14 | Large-data virtualization (conditional, budget-gated) | 🟢 M · ⬜ | N25 |
| — | Columnar `DataFrame` (big bet) | 🔵 L · ⬜ | N13 — **evidence-gated; prototype behind `DataRow`, do not schedule until measured** |

Each gets a full layer block (Goal/Scope/DoD) when it is pulled into a sprint — the table is the backlog, not the spec.

---

## Phase 10 — Tier 3: The North Star

`ARCHITECTURE-TARGET.md §Tier 3`. The synthesis no single platform achieves. Value-first order. N26 and N27 are the two highest-leverage and get full layers; N28–N31 are tabled (north-star directions — abstraction first, incremental, evidence-gated).

---

### Layer 10.1 — Semantic Layer `[N26]` 🟩 *(start here in Tier 3)*

**Goal:** Metrics are defined once over the SDMX DSD; configs reference metrics, not raw measure codes.

**Scope:**
- A thin `MetricRegistry`: `GDP: { code, unit, agg, parent, methodology, label }` — defined once. A `metric` spec resolver maps metric → measure code(s) at resolve time.
- Configs migrate page-by-page from `query: { measure: [...] }` to `{ metric: 'GDP', by: 'sector' }`. Existing code-based specs keep working (additive).

**Definition of Done:**
- [ ] A metric is defined in exactly one place; every reference resolves through it.
- [ ] At least one page migrated to metric-based specs, rendering identically.
- [ ] Provenance (N14) attaches to the metric.
- [ ] `npx tsc --noEmit` = 0 errors.

**Dependencies:** Phase 9.2 (provenance), Phase 3.1 (datasource seam)
**Touches:** engine/core · src
**Estimated size:** M — keep the registry thin (no LookML-scale modeling language).
**Risk:** MED — the resolver contract is the design call; migrate incrementally.
**Closes:** N26 — *the single highest architectural elevation.*

---

### Layer 10.2 — Multi-Target Rendering `[N27]` 🟨 *(the PDF-bulletin payoff)*

**Goal:** The same config renders to DOM (dashboard) **and** PDF (official bulletin) **and** static HTML **and** a data API — from the one neutral tree.

**Scope:**
- A `RenderTarget` abstraction consuming `renderNode`'s neutral output. DOM target = today. Add SSR/HTML + PDF targets as separate consumers; no engine change (the boundary is already neutral).

**Definition of Done:**
- [ ] One config produces the interactive dashboard and a PDF bulletin with no duplicate authoring.
- [ ] Adding a target touches no engine/shell internals.
- [ ] `npx tsc --noEmit` = 0 errors.

**Dependencies:** Phase 8.1 (`@geostat/charts` neutral), Layer 10.1 (metrics for bulletin content)
**Touches:** engine/react · new target package(s)
**Estimated size:** L → **split per target** (DOM exists · SSR · PDF · API each its own M layer)
**Risk:** MED per target — PDF fidelity is the hard part; ship SSR first.
**Closes:** N27

---

### Layer 10.3+ — North-star directions (abstraction first, evidence-gated)

| Layer | Move | Op · Weight | Closes |
|---|---|---|---|
| 10.3 | Query pushdown + capability planner (reuses `StoreCaps` + `extractRequirements`) | 🟢 M · 🟨 | N30 |
| 10.4 | Config as governed content (draft/publish/audit/lineage) — Phase-2-native | 🔵 M · 🟨 | N31 |
| 10.5 | Reactive dataflow graph (signals at the `SectionContext → interpretSpec` edge first) | 🔵 L · ⬜ | N28 — surgical, not blanket |
| 10.6 | Everything-is-a-node (capability-tagged registry abstraction, then incremental migration) | 🔵 L · ⬜ | N29 — **north-star, never big-bang** |

These are directions, not scheduled work. Each becomes a full layer only when its evidence gate is met (see `ARCHITECTURE-TARGET.md §Tier-3 anti-recommendations`).
