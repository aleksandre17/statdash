# plugins/ — Shell Layer Orientation

> ავტოლოადი plugins/-ის ნებისმიერ ფაილზე მუშაობისას.
> **Layer orientation only** — the MAP + the anatomy + the law + where to go deeper. Shell/ISP/OCP field-level rules live with the fitness tests + `docs/patterns/`.

---

## The map — where each slice lives (find here, don't grep)

The shell layer = concrete elements composing the engine into dashboards. Every slice folder = `{ <Slice>Node.ts (schema/contract) · <Slice>Shell.tsx (render) · meta.ts (pure META, no React deps) · *.css · *.fitness.test.* }`.

| folder | owns | slices |
|--------|------|--------|
| **pages/** | page templates (roots) | container-page · inner-page · tab-page |
| **nodes/** | structural nodes | section · filter-bar · page-header · perspective-bar · geograph · links · repeat · hero · stats-carousel · featured-slider |
| **nodes/layout/** | layout containers | grid · columns · stack · card · divider · spacer · wrap |
| **panels/** | leaf DATA panels | chart · table · kpi-strip · gauge · text |
| **chrome/** | app chrome | app-header · app-footer · app-banner · inner-sidebar · locale-switcher · theme-switcher |
| **controls/** | filter controls | cascade · hidden · multi-select · range · select · year-select |
| **datasources/** | `DataStore` adapters | e.g. `stats-registrations` (`resolveStatsBase` → same-origin `/api`) |
| **presentation/** | presentation projectors | `registerPresentationProjectors` |
| **__tests__/** | cross-slice fitness | `schema-completeness.fitness` (FF-SCHEMA-COMPLETE) |

> **Authoring / Constructor is NOT here** — it lives in **`apps/panel/src`**: `inspector/` (schema-driven property panel — `Inspector.tsx`, `FieldControlRegistry`, `schemaSource.ts`, `sections/`), `studio/` (Studio shell, `RightDock.tsx`, `useCanvasController.ts`), `canvas/` (selection/overlay), `features/` (page-config · perspectives · filters · visibility). The panel READS each slice's declared schema — it never per-type-special-cases.

---

## The governing law — Bounded Element Law (ADR-038)

Every element here (node · panel · chrome · control · **item**) is a **bounded, self-owning unit** that DECLARES its contract once (its `Schema` / `itemSchema` / `slots.accepts`) and hides its internals; the renderer, the inspector, and the composer are **generic projections over that declaration — NEVER an external per-type special-case**. A new element = a new declaration, the machinery unchanged (SRP · Parnas · DIP/ISP · Open/Closed · Demeter · Composite · Hexagonal · Bounded Context). Gates: `FF-SCHEMA-COMPLETE` (declares) · `FF-NO-EXTERNAL-SPECIAL-CASE` (no hand-wire).

---

## Page Anatomy — ONS / Eurostat Standard

```
PageHeader → FilterBar (sticky) → KPI strip → Sections [chart ↔ table] → Methodology footer
```

Progressive disclosure: KPI → chart → table → methodology. Secondary sections collapsed by default. A **section** is a pure structural container; **chart ↔ table are two `view.role` views of ONE section `data`** (one dataset, two views — don't duplicate the pipe per child).

---

## UI / UX Principles

- **Clarity over cleverness (ONS)** — data უნდა გვესმოდეს, არ უნდა გვაკვირვებდეს.
- **Data integrity (IMF / Eurostat)** — preliminary badge · last-updated · methodology link · revision note.
- **Accessibility WCAG 2.1 AA** — semantic HTML · aria-label · keyboard nav · no color-only info.
- **Export (Eurostat / World Bank)** — Excel + CSV per section ✅ LIVE (`core/data/export/` + `ExportMenu`/`SectionExportMenu`, `data:export` bus). Embed/snapshot backend BUILT but UNWIRED — AR-48 (`docs/architecture/proposals/DESIGN-delivery-port-export-embed-snapshot.md`).
- **URL = permalink** ✅ (FilterContext + useSearchParams). **Chart / Table toggle** ✅ (SectionBlock).

---

## Go deeper

Slice-level laws + ✅/❌ patterns → each slice's `*.fitness.test.*` + `docs/patterns/`. Full shell spec → `docs/architecture/proposals/`. Dependency arrow + package map → `packages/CLAUDE.md`. Governing law → `docs/architecture/decisions/ADR-038-bounded-element-law.md`.
