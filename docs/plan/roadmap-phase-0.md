# Roadmap — Phase 0: Integrity + Phase 0.5: Conformance Guards

> **✅ Phase 0 COMPLETE (2026-06-02)** · **✅ Phase 0.5 COMPLETE (2026-06-13)**
> Operating rules and root causes: [IMPLEMENTATION-ROADMAP.md](IMPLEMENTATION-ROADMAP.md)

---

### Layer 0.1 — Chart type: registry is the single source of truth

**Goal:** A registered chart type is known everywhere — validator, type system, and renderer agree, with no second place to update.

**Scope:**
- Delete `KNOWN_CHART_TYPES` Set in `engine/core/src/validation/pipeline.ts:66`. `validateChartDef` (line 141) validates against `defaultRegistry.chartTypes()` instead.
- Replace the literal `ChartType` union in `engine/core/src/core/context.ts:24-32` with `type ChartType = string` (Grafana `PanelPlugin.type: string` model) — the registry, not the union, is the authority.
- Make `interpretChart` in `engine/core/src/chart/engine.ts:39` emit a typed `ValidationError` (or dev warning routed through the observability seam from Layer 1.1) when no interpreter is registered, instead of silently returning `placeholderOutput`.

**Definition of Done:**
- [ ] No literal Set/array of chart-type strings exists outside the registry.
- [ ] `validateChartDef` accepts `hbar-diverging`, `contribution`, `treemap`, `area` (currently false-flagged).
- [ ] Registering a new chart interpreter makes it pass validation with no other edit.
- [ ] Unregistered chart type produces a visible diagnostic, not a blank chart.
- [ ] `npx tsc --noEmit` = 0 errors.

**Dependencies:** none
**Touches:** engine/core
**Estimated size:** S (1–2h)
**Risk:** MED — validation is on the Constructor hot path; a wrong derivation rejects valid configs.

**Closes:** gap #2, #16, #29

---

### Layer 0.2 — Spec type: registry is the single source of truth

**Goal:** `validateDataSpec` and the engine agree on which spec types exist — from one registry, not a hand-maintained Set.

**Scope:**
- Delete `KNOWN_SPEC_TYPES` Set in `engine/core/src/validation/pipeline.ts:61`. `validateDataSpec` (line 78) validates against `defaultRegistry.specTypes()`.
- Replace `interpretSpec`'s `console.warn` + `return []` on unknown spec type (`engine/core/src/data/spec.ts:29`) with a typed result the caller can surface (return an empty result tagged with a `ValidationError`, or throw an `EngineError` caught at the render boundary).

**Definition of Done:**
- [ ] No literal Set of spec-type strings exists outside the registry.
- [ ] Registering a new `SpecResolver` makes it pass validation with no other edit.
- [ ] Unknown spec type surfaces a typed diagnostic, not a silent empty array.
- [ ] `npx tsc --noEmit` = 0 errors.

**Dependencies:** none
**Touches:** engine/core
**Estimated size:** S (1–2h)
**Risk:** LOW — additive validation correctness; the resolver registry already exposes `specTypes()`.

**Closes:** gap #33, KNOWN_SPEC_TYPES half of Root A

---

### Layer 0.3 — Implement the `node.storeKey` cascade

**Goal:** A node's `storeKey` override actually resolves its store — the silent "wrong store" bug is gone.

**Scope:**
- `engine/react/src/engine/resolveNodeRows.ts:24` — widen `resolveStore` to accept an explicit override: `resolveStore(ctx, nodeStoreKey?)`, precedence `nodeStoreKey → ctx.pageStoreKey → first store → staticStore`.
- `engine/react/src/engine/renderNode.ts` step 2 — when `migrated.storeKey` is present, pass it to `resolveNodeRows` and propagate it into `ctxM.pageStoreKey` so descendants inherit the nearest override (CSS-cascade semantics already documented in `resolveNodeRows.ts:19`).
- Add a regression fixture: a section with `storeKey: 'accounts'` inside a `gdp` page resolves the accounts store.

**Definition of Done:**
- [ ] `node.storeKey` (declared on `NodeBase`, `types.ts:101`) is consumed by the render pipeline.
- [ ] Nearest-ancestor `storeKey` wins for descendants; wrong usage cannot silently fall through to the page store.
- [ ] Regression test pins the previously-silent case.
- [ ] `npx tsc --noEmit` = 0 errors.

**Dependencies:** none
**Touches:** engine/react
**Estimated size:** M (half-day)
**Risk:** HIGH — Critical silent bug; wrong stores feed wrong data with no error. Verify against real multi-store page configs.

**Closes:** gap #15, #23

---

### Layer 0.4 — Validation pipeline targets the live NodeDef tree

**Goal:** The Constructor-facing validation validates what actually renders — the `NodeDef` tree — not the dead Track-B `SectionDef` shape.

**Scope:**
- `engine/core/src/validation/pipeline.ts` — `validateSectionDef` (line 161) currently validates the legacy `SectionDef` type that no page uses. Re-point validation at the live node shapes: validate `NodeDef` data/encoding via the registered slice `validate` hooks (`NodeRegistry.getValidate`) and the spec/chart validators, traversing the actual `children` tree.
- Confirm `validateDataSpec` / `validateChartDef` are reachable from the node tree path (they are invoked per-node in `renderNode.ts:135`); ensure the Constructor save-path can validate a whole page tree, not just isolated `SectionDef`s.

**Definition of Done:**
- [ ] No validator targets a type that no live config uses.
- [ ] A whole `NodePageConfig` tree can be validated in one call, surfacing per-node errors with JSONPath-style locations.
- [ ] `npx tsc --noEmit` = 0 errors.

**Dependencies:** Layer 0.1, 0.2
**Touches:** engine/core
**Estimated size:** M (half-day)
**Risk:** MED — touches the validation surface the Constructor will depend on; get the tree-traversal contract right.

**Closes:** gap #27 (part of Root C)

---

### Layer 0.5 — Repair `interpreters.ts` UTF-8 corruption

**Goal:** Source file is clean UTF-8 — no mojibake in comments or identifiers.

**Scope:**
- Re-save `engine/core/src/registry/interpreters.ts` as clean UTF-8. Every comment header is corrupted (`â"€â"€` instead of box-drawing `──`). Repair to match the codebase comment style.
- Confirm no string literal or identifier depended on the corrupted bytes (comments only, per inspection — low load-bearing risk).

**Definition of Done:**
- [ ] File is valid UTF-8; no replacement characters on visual inspection.
- [ ] `npx tsc --noEmit` = 0 errors.

**Dependencies:** none
**Touches:** engine/core
**Estimated size:** XS (< 30 min)
**Risk:** LOW — mechanical re-encode.

**Closes:** gap #17

---

## Phase 0.5 — Conformance Guards (precede deeper refactoring)

Surfaced by aligning this plan to `generic/engineering/structure.md` (§3) + `refactoring.md` (§4): two **foundational** guards that make the structure *self-enforcing* and refactoring *safe*. They should run before Phase 1+ deep changes — they protect every later layer.

---

### Layer 0.6 — Enforce the dependency contract as a build gate `[N32]`

**Goal:** a layer-boundary violation **fails the build**, not review (structure.md §3 — "build error, not review comment").

**Scope:**
- Add `eslint-plugin-boundaries` (or `dependency-cruiser`) encoding the inward rule `src → plugins → @geostat/react → @geostat/charts → @geostat/engine → @geostat/expr` + an **acyclic** check.
- Wire into `lint` / CI (and optionally the `PostToolUse` hook alongside `tsc`).

**Definition of Done:**
- [ ] An import that violates the inward direction fails `npm run lint`.
- [ ] Cycle check passes (no module cycles).
- [ ] `npx tsc --noEmit` = 0.

**Dependencies:** none · **Touches:** repo root (eslint/CI) · **Size:** S · **Risk:** LOW · **Closes:** N32

---

### Layer 0.7 — React test infrastructure (characterization safety net) `[N33]`

**Goal:** shells + the render pipeline become testable, so behavior-preserving refactors have a safety net (refactoring.md §4 — no safe refactor without one).

**Scope:**
- Add jsdom + Testing Library to the vitest setup.
- Write the **0.3 storeKey-cascade regression** + a `renderNode` smoke test as the first characterization tests.

**Definition of Done:**
- [ ] A jsdom-based React test runs under `vitest`.
- [ ] The storeKey-cascade case (section `storeKey` inside a different-store page) is pinned by a regression test.
- [ ] `npx tsc --noEmit` = 0 · all tests green.

**Dependencies:** none · **Touches:** test config · `engine/react` tests · **Size:** M · **Risk:** LOW · **Closes:** N33 · gaps #10 · the 0.3 follow-up
