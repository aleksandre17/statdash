# packages/ — Engine + React Layer Orientation

> ავტოლოადი packages/-ის ნებისმიერ ფაილზე მუშაობისას.
> **Layer orientation only** — the MAP + the laws + where to go deeper. Field-level ✅/❌ patterns live with each module's fitness tests (`packages/*/src/**/*.fitness.test.*`) + `docs/patterns/`.

---

## The map — where each package lives (find here, don't grep)

In dependency-arrow order (innermost → outermost). npm scope `@statdash/*`.

| package | owns | look here for |
|---------|------|---------------|
| **contracts** | zero-dep shared boundary types (innermost; importable by ALL, incl. `apps/api`) | wire/DTO types, `ManifestMetric`/`Dimension`, page-config schema |
| **expr** | safe, sandboxed expression / measure-algebra engine | `parseFormula`, calc/derive evaluation, whitelisted ops |
| **core** (`@statdash/engine`) | the **pure, framework-agnostic engine** | `DataSpec`/`interpretSpec`, `DataStore`, `SectionContext`, metric/semantic layer, transforms, export registry |
| **charts** | chart interpretation | `interpretChart` → `ChartOutput` → `toApexOptions`; cartesian/donut/treemap/hbar builders |
| **styles** | design tokens + CSS cascade | `resolveStyle`/`NodeStyles`, `@layer` tokens, `scrollbar.css` |
| **react** (`@statdash/react`) | **app-agnostic React adapter** over the engine | generic renderers, hooks, node templates, **`engine/slice-meta.ts` = `ObjectMeta` (the declare-once contract)**, `FieldControlRegistry` seam |
| **plugins** | the **shell layer** — concrete nodes/panels/chrome composing the engine into dashboards | see `packages/plugins/CLAUDE.md` (its own map) |

> **Authoring / Constructor is NOT here** — it lives in `apps/panel/src` (`inspector/`, `studio/`, `canvas/`). App specifics never leak into `packages/react` (kept app-agnostic).

---

## Dependency Rule (the arrow) — the #1 law

```
packages/contracts ← packages/expr ← packages/core ← packages/charts ← packages/react ← packages/plugins ← apps/*
packages/contracts ← apps/api
```

- `packages/contracts` — innermost, zero-dep, importable by all (incl. `apps/api`, which the arrow otherwise forbids from importing `packages/react`).
- `packages/core` is the pure engine; `packages/react` is the React adapter (stays app-agnostic — Geostat/panel specifics → `packages/plugins` / `apps/*`).
- Never import against the arrow. **Executable SSOT** = `eslint no-restricted-imports` (`platform/eslint.config.js`) — a violation fails the build. Conceptual canon = `.claude/skills/architecture-standards/references/` §1 (Clean/Hexagonal) + `docs/patterns/`.

---

## Data Pipeline (the canonical flow)

```
defineFilters({ bars }) → FiltersResult { ctx: SectionContext, bars: FilterBarSpec[] }
        ↓
SectionContext { timeMode: 'year'|'range', dims: Record<string, DimVal> }
        ↓
DataSpec → interpretSpec(spec, ctx, store) → DataRow[]
        ↓                    ↓
   DataTable           interpretChart(def, rows, ctx) → ChartOutput → toApexOptions → <ReactApexChart />
```

**DataSpec types:** `query` · `row-list` · `timeseries` · `growth` · `ratio-list` · `pivot` · `transform` · `metric` — extend via `registerSpec` (the single extension path; no `custom`/`fn` escape hatch).

**FilterSchema (shape):** `defineFilters({ bars: { barId: { position, order?, filters: { key: ParamDef } } }, crossValidate?, computed?, context?:{dims}, store? })` → `{ bars, typed values, ctx, errors, isLoading }`. **ParamDef types:** `hidden` · `year-select` · `cascade` · `select` · `range` · `multi-select`.

---

## Go deeper

Per-package laws + ✅/❌ patterns → that package's `*.fitness.test.*` + `docs/patterns/`. Architecture decisions → `docs/architecture/decisions/` (ADRs). Visions/registry → `docs/architecture/ARCHITECTURE-REGISTRY.md`. Governing compositional law → **ADR-038 (Bounded Element Law)**.
