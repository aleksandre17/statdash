---
name: project-platform-maturity
description: Actual maturity of the statdash platform engine/plugins/constructor as of 2026-06 — what is already built vs commonly assumed missing
metadata:
  type: project
---

The statdash platform is far more mature than a surface read (or a gap-analysis prompt) implies. Before claiming something is "missing", verify against this baseline.

**Already shipped (roadmap N1–N33, 34 audit gaps closed 2026-06-16):**
- Engine has FieldConfig (thresholds, colorMode, overrides) — `engine/core/src/field/config.ts`
- DataLinks drill-through — `engine/core/src/links/` (resolveDataLinks, DataLinkDef)
- Provenance/metadata port (ObsStatus, ProvenanceRecord) — `core/provenance`
- Telemetry port, Diagnostic/Result contract, validation pipeline, schema migration (migratePageConfig)
- Sandboxed expression language as its own package `engine/expr` (evalExpr, registerExprOp, no eval)
- Design-token system as its own package `engine/styles` (NodeStyles, responsive, tokens catalog)
- Multi-target render: `targets/html.tsx` (SSR), `targets/api.ts` (JSON snapshot), `targets/warm.ts` (prefetch)
- Constructor spine: `describeApp()` → AppManifest (10 axes), propSchemaToJsonSchema, NodeCap taxonomy
- A real Constructor app at `apps/panel` (react-admin based): form editors, wizard, pipeline builder, DnD provider, undo history (constructor.history.ts)
- Backend API at `apps/api`: auth + config CRUD (pages/data-sources/data-specs/site/nav) + stats (observations/classifiers/datasets)
- 15-op transform pipeline, metric registry, export registry (CSV + SDMX-JSON)

**Genuinely absent (confirmed by grep, not yet built):**
- Async data resolution — `interpretSpec` returns `EngineRow[]` synchronously, not Promise/PanelData. No per-node loading/error states. This is the single biggest architectural gap vs Grafana.
- No polling / refreshInterval / streaming (StoreCaps.streaming exists but always false)
- No RBAC / per-node permissions / visibility-by-role (zero matches platform-wide)
- No alerting / threshold-rule engine, no annotations (temporal overlays)
- No cross-filter propagation between panels; no per-panel time-range override
- No signed embed URLs / snapshot persistence API / scheduled exports
- Constructor `apps/panel` has NO live WYSIWYG canvas using NodePageRenderer — editing is form-based, not drag-on-rendered-page

**How to apply:** When asked for a gap analysis or new capability, grep first; most "obvious" features are already present. The high-value frontier is async/reactive data (loading/error/polling), cross-panel interactivity, and embed/snapshot/governance — not basic panel/transform/export coverage.
