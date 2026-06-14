# Documentation — Geostat National Accounts

> **The single home for design knowledge.** One entry point, one home per category.
> Two systems, clean boundary: **`docs/` = what we build (the truth) · `.claude/` = how the AI session works (the process).**
> `docs/` owns design truth; `.claude/` references it and owns no design truth.

---

## Start here

| You want… | Read |
|-----------|------|
| **The current plan** — what exists, what it should become, how we get there | `docs/plan/` ↓ |
| **Reference** — canonical patterns, deep architecture, decisions, Phase-2 planning | `docs/architecture/` ↓ |
| **History** — superseded / archived design (kept for provenance, not authoritative) | `docs/archive/` |
| **How the AI session operates** — protocol, doctrine, live state | `.claude/INDEX.md` |

---

## `docs/plan/` — current truth · target · execution *(authoritative)*

| File | What it is |
|------|-----------|
| `SYSTEM-PIPELINE-TREE.md` | **Current state** — every element/service, bottom to top, with its role. The map. |
| `ARCHITECTURE-TARGET.md` | **Target** — same tree with REMOVE/MOVE/ADD/RESHAPE/KEEP per element + Tier 1/2/3 (best-in-class → standard-setting → north star). |
| `IMPLEMENTATION-ROADMAP.md` | **Execution** — 34 gaps + N1–N31 across 11 phases (0–10), each a layer with Goal/Scope/DoD. Start at Layer 0.1. |

These three are the live source of truth for current-state, target, and execution. When code and these disagree, these win (architecture leads, code follows).

---

## `docs/architecture/` — reference corpus *(currency-checked)*

The still-canonical design corpus, consolidated and currency-checked from the former `refactor-plane/`.
**Map (grouped by domain): `docs/architecture/README.md`.**

| Area | What it holds |
|------|---------------|
| `subsystems/` | Deep design per subsystem, grouped by domain (nodes · data pipeline · expression/derive · filter · layout/styling · mode · datasource · standards · constructor). |
| `examples/` | Canonical code patterns — the first reference for any pattern/type/approach. `❌`-marked = anti-pattern; `✅` = canonical. |
| `decisions/` | Decision framework · platform analysis · non-negotiables · anti-patterns · SOLID. |
| `future/` | Phase-2 planning skeletons (constructor · async options · dep-graph · database · backend). |
| `packages/` + `types/` | Per-package design notes + type-system snapshot (live types are in `packages/*`; these are reference). |

---

## `docs/archive/` — superseded / historical

Frozen design artifacts kept for provenance only — **not authoritative**. Anything here references a prior architecture (e.g. the deleted Track-B `features/` layer, pre-monorepo paths, superseded migration plans). If a doc here conflicts with `docs/plan/`, `docs/plan/` is correct.

---

## Boundary with `.claude/`

`.claude/` is the AI session system — protocol (`generic/`), per-project doctrine + live operational state (`individual/`). It **references** `docs/` for all design knowledge and holds none of its own:
- AI operating doctrine (how to apply principles/SOLID/patterns while working) → `.claude/individual/knowledge/`
- AI migration *doctrine* (the timeless M-rules + step discipline — process, not design) → `.claude/individual/knowledge/migrate.md`
- Live operational state (current sprint, gaps, blockers, phase status) → `.claude/individual/context/`
- **All design truth + reference + history → `docs/`** (`plan/` · `architecture/` · `archive/`). On any conflict, `docs/plan/` wins.

> The former `.claude/individual/migration/` (Gen-2 migration specs) was dissolved 2026-06-02 — migration-time specs for a **DONE** migration (≥1 drifted from live code, e.g. `02-types` `NodeBase` fields): 8 → `docs/archive/migration-specs-gen2/`; the 2 current-subsystem docs → `docs/architecture/subsystems/29-i18n-architecture` + `30-plugin-taxonomy`. `migrate.md` keeps only the doctrine. **One design home: `docs/`. No design content lives in `.claude/`.**
