# docs/architecture — Reference Corpus

> **Authority chain (current, 2026-07-15):**
> 1. **`ROADMAP-zero-to-hero.md`** — THE master plan (stages, waves, the hero checklist). On any conflict about direction, it wins.
> 2. **`ARCHITECTURE-REGISTRY.md`** — the vision/initiative SSOT (every AR-* with lifecycle status; nothing is lost).
> 3. **`decisions/`** — ADRs, binding once ACCEPTED.
> 4. **`proposals/`** — designs in flight: SPEC (target design) · STUDY (grounded investigation) · CONCEPT (synthesis) · DESIGN/PLAN (build path). A proposal binds only via an ADR or a registry status.
> 5. **`audit/`** — ground-truth studies of what IS (e.g. the `DEEP-2026-07-15-*` five-lens expedition).
> 6. This corpus below (`subsystems/`, `examples/`, …) — deep reference on how things work; currency-checked but **descriptive, never authoritative over 1–3.**
>
> ⚠️ `docs/plan/` is a HISTORICAL register (pre-ROADMAP era) — superseded by `ROADMAP-zero-to-hero.md`; kept for archaeology only.
>
> Folders: `subsystems/` (deep design) · `examples/` (code patterns) · `decisions/` (why) · `proposals/` (designs) · `audit/` (ground truth) · `future/` (Phase-2 planning) · `packages/` + `types/` (per-package notes + type snapshot).

---

## `subsystems/` — deep design, grouped by domain

> Filenames keep their stable `NN-` ids (cross-referenced internally). This index groups them by domain for navigation.

| Domain | Docs |
|--------|------|
| **Nodes & render** | `02-node-system` · `20-data-nodes` · `26-missing-nodes` |
| **Data pipeline** | `05-data-pipeline` · `17-data-cube` · `18-classifier-pipe` · `24-options-source` · `25-datasource-system` |
| **Expression · derive · defaults** | `06-expression-system` · `22-derive-effects` · `23-defaults-system` |
| **Filters** | `07-filter-system` |
| **Layout & styling** | `21-layout-system` · `16-styling-architecture` |
| **Mode system** | `19-mode-system` |
| **Site & manifest** | `08-site-manifest` |
| **Specialized nodes** | `27-geo-map` · `28-section-nav` |
| **Standards** | `11-backend-standards` (SDMX·Kimball·SNA) · `12-ux-standards` (ONS/Eurostat·a11y·export) · `13-testing-strategy` |
| **Constructor (Phase 2)** | `15-constructor` |

## `examples/` — canonical code patterns

The first reference for any pattern/type/approach (CLAUDE.md escalation ladder #2). `❌`-marked code = anti-pattern; `✅` = canonical. Grouped:

| Domain | Examples |
|--------|----------|
| **Data / spec / transform** | `data-spec` · `transform-pipeline` · `encoding` · `data-store` · `http-data-store` · `store-access` · `multi-store-platform` · `collection-ops` |
| **Nodes / layout** | `data-nodes` · `layout-nodes` · `repeat-node` · `visible-when` · `section-nav` · `geo-map` |
| **Filters / controls** | `filter-schema` · `filter-shell` · `filter-control-registry` · `filter-effects` · `filter-bar-page` · `derive-effects` · `derive-map` · `defaults` |
| **Charts** | `chart-def` |
| **Pages / site** | `gdp-page-config` · `tab-page-config` · `landing-page` · `nav-config` · `site-manifest` · `main` · `multi-site` |
| **Mode / tokens** | `mode-system` · `tokens` |
| **Constructor / registration** | `constructor-registry` · `constructor-schema` · `vertical-slice` · `vertical-slice-registration` |
| **Perf** | `performance` · `showcase` |

## `decisions/` — why we decided what we decided

`00-decision-framework` · `01-platform-analysis` · `02-non-negotiables` · `03-anti-patterns` · `04-solid-principles` · `05-architecture-mandate` · `06-key-success-rules`.
> AI *operating* doctrine (how to apply these while working) lives in `.claude/individual/knowledge/`; these are the design-decision record.

## `future/` — Phase-2 planning

`01-database` · `02-backend-java` · `03-constructor` · `04-dep-graph` · `05-async-options` · `06-mode-system/phase2` · `07-framework-gaps`.

## `packages/` + `types/`

Per-package design notes (`engine/core.md` · `engine/expr.md`) + the type-system design snapshot (`types/all-types.md` — **reference only; the live types are in `packages/*`**).
