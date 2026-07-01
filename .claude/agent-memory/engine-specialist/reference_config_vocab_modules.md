---
name: config-vocab-modules
description: config/ vocabulary split — DataSpec/visibility/links/template live in concern modules (not section.ts); barrel preserved; sibling-smell inventory
metadata:
  type: reference
---

`packages/core/src/config/section.ts` was a misnomer grab-bag (element-named, held platform-wide vocab). Split 2026-06 into concern-cohesive modules, `section.ts` deleted:
- `config/data-spec.ts` — `DataSpec` union + `ColumnDef`/`RowSpec`/`YearsSpec`/`TableConfig` (every data element)
- `config/visibility.ts` — `VisibilityExpr` + `evalVisibility` (every node's `visibleWhen`)
- `config/links.ts` — `LinkIconKey`/`LinkDef` (methodology-link primitive, `links` panel)
- `config/template.ts` — `resolveTemplate` (generic context template resolver)

**Barrel contract:** public barrels (`@statdash/engine` root `index.ts` + `config/index.ts`) re-export all of these unchanged — external/app consumers import via the barrel and were unaffected. Only deep relative importers inside `packages/core/src` were re-pointed. No app/api deep-imports section internals.

**gen:schema:** `DataSpec`/`VisibilityExpr` ARE schema-referenced, but a pure type-relocation leaves `contracts/schema/page-config.schema.json` byte-identical (verify it stays out of the git diff after `pnpm gen:schema`).

**Two distinct "link" concepts** (don't conflate): `config/links.ts` = methodology reference links (`LinkDef`); `core/src/links/` = Grafana-style drill-down/navigation DataLinks (`DataLinkDef`). Separate subsystems.

**Surviving sibling-smell inventory** (same misnomer/grab-bag class, NOT yet fixed — low priority, reported as follow-ups):
- `core/src/core/types.ts` — vague generic name ("types.ts") but cohesive 22-line content (node-derive vocab: `DataLookupOp`/`DeriveEntry`/`NodeDeriveMap`). Rename to `node-derive.ts` for intent. Cheap, low-value.
- `config/kpi.ts` holds `KpiDef` which is a *view-output* type (result of interpretKpi), not a config/authoring type — slight concern-mismatch with the `config/` dir (the input `KpiSpec` correctly lives in `data/kpi.ts`). Minor.
- NOT smells (legitimately cohesive, do not churn): `core/layout.ts` (generic groupBySpan, well-documented), `sdmx.ts` (cohesive SDMX model), `core/context.ts` (foundation primitives), `react/engine/types/node.ts` (already split from a monolith — healthy precedent).
