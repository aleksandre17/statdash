---
name: project-panel-quality-ledger
description: apps/panel framework/platform-grade audit — six-dimension verdicts + ranked hardening backlog on the settled ADR-041/042 substrate
metadata:
  type: project
---

`docs/architecture/audit/DEEP-2026-07-15-panel-quality.md` — I OWN this. Read-only quality-gap ledger for `platform/apps/panel` (the Constructor), NOT a re-conception (ADR-041/042 stand).

**Verdict: PARTIAL** — reference-class at the projection substrate (above Builder.io/Puck; store exemplary; facet fold is registration-based via `registerFacetSections` iterating `facetRegistry.list()`, NOT the hand-wired `⊕` ADR-043 feared), NOT yet platform-grade on 3 seams.

**The deepest gap + the 3 highest-leverage moves (ranked hardening backlog):**
1. **Kill `capabilityGate.needsGeo` type-sniff** (`discovery/capabilityGate.ts:41` — `entry.type==='map' || .includes('geo')`, violates its own Law-1 header) → declare `requires.conceptRole` on NodeSliceMeta. Size S. The ONLY live Law-1 breach; cheapest canon win.
2. **PLANE axis (0-code) + `vars` leak** — `PropField.plane` absent; `pageSchemaSource.ts:67` projects the system-plane `vars` derive-graph to the author as raw JSON. Deepest concept gap; routed via PM-B/ADR-042 D4/W3 (no re-fork). Size M.
3. **ONE `composeConstructor(manifest)` seam** — registration scattered ≥5 places (setupCanvasRegistry, builtins.tsx, FieldControlRegistry module-eval, perspectiveRegistry); fixes BOTH scattered-aggregation AND tenant-seed leak. Size M.

**Other confirmed gaps:** two drag transports (native HTML5 dataTransfer on canvas/palettes ⟂ dnd-kit elsewhere — S1) · three i18n mechanisms (LocaleString T-objects ⟂ i18next ⟂ `en?'':''` ternary) · `NestedItemControl.tsx` 549 = the one oversized module · MUI 82/228 non-test files (flag-don't-fix, DTCG token seam hedges it) · tenant seeds baked (`defaultLocale:'ka'` ×3, LoginForm brand string, year/range perspectives).

**Per-dim:** Concepts PARTIAL · Standards PARTIAL · Canon PARTIAL(strong) · Architecture PARTIAL(strong) · Aggregation PARTIAL · Agnosticism PARTIAL→NO(H5). See [[project_benchmark_corpus]].
