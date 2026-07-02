---
id: "0044"
title: "DECISION O-14: GAP-L — EN data-category labels stay Georgian: missing codelist `en` (seed) vs render-boundary `String()` (engine)"
status: resolved
class: DECISION
priority: P0
owner: database-architect
implements: SPEC.DELTA-new12 §3 axis-4 GAP-L, §4 O-14
blocks: ["0049"]
links:
  - platform/work/SPEC-render-pipeline-target.DELTA-new12.md
---
**Decision needed** — Under EN locale, chrome/nav/section/KPI translate but **data-derived category labels stay Georgian** (img.png production-donut legend, income-treemap tiles). Two possible root causes: (a) the `sector`/income codelist seed **carries no `en`** for those members (a data gap → database-architect); (b) the codelist HAS `en`, but the legend/tile/cell render boundary flattens the `LocaleString` with `String()` instead of resolving to `ctx.locale` (an engine/plugins fix, same class as Bug 1 / BI-B1).

**Reasoned DEFAULT (build this unless told otherwise)** — **Diagnose first, then route.** Quick check: does the `sector`/income codelist carry an `en` field for the affected members? If **present** → render-boundary fix (fold into BI-B1's localize-at-boundary sweep, I-7). If **absent** → seed fix owned by database-architect (add the `en` translations to the codelist). This is a diagnosis-gated fork, not a guess.

**Alternative** — None; the two causes are mutually exclusive and the codelist inspection settles it.

**Reversibility** — Two-way door (either a seed addition or a render-boundary resolution; both are additive and reversible).

**Blocks** — 0049 (BI-B1). If O-14 resolves to the render-boundary cause, GAP-L is covered by BI-B1's FF-NO-LOCALESTRING-TO-STRING sweep; if it is a seed gap, raise a database-architect data item (out of this epic's code fences).

**Owner action (~2 min)** — Confirm the codelist inspection route; if a seed gap, name the codelist(s) needing `en`.

**Standing DoD (applies to the dependent build items):** rendered result must match `scriness/` achieved ONLY through highest-concept architecture — no hardcoding, no anti-patterns, no DRY violations; declarative/config-driven; conditional logics (visibleWhen/perspective/effects) covered; SSOT; refine/elevate EXISTING code (Strangler) — never rewrite-from-scratch or hardcode-to-match the screenshot. "Look like the screens" must NEVER be met by dropping quality.

---
**RESOLVED (database-architect, 2026-07-02) — SEED CARRIES GENUINE `en` → RENDER-BOUNDARY FAULT (BI-B1). NOT a seed gap.**

Codelist inspection of the **LIVE SSOT** `DATA/canonical/*.xlsx` (ingested via `POST /api/ingest/canonical` / `ops/scripts/n.sh` — the authoritative prod/staging/validate-local bring-up; the `ops/seed-data/*.bundle.json` + `seed.ts` direct path is the RETIRED lane, ADR-0032). Every category-bearing `CL_<dim>` sheet carries a genuine `name_en` column, distinct from `name_ka`:
- **CL_MEASURE** (production-donut + income-treemap categories): e.g. `agriculture-forestry-and-fishing → "Agriculture, forestry and fishing"`, `gross-operating-surplus → "Gross Operating Surplus"`. Real English on all 16 members.
- **CL_APPROACH**: "Production approach / Expenditure approach / Income approach".
- **CL_SECTOR** (regional): "All activities (total)", "Manufacturing", "Wholesale and retail trade…", etc.
- **CL_GEO**: "Georgia"; **CL_ACCOUNT**: "Production Account"…; **CL_SIDE**: "Uses"/"Resources".

`en` is an active locale (`config.i18n.locales = ['ka','en']`), so the canonical parser (`name_<lang>` ∩ activeLocales) ingests these into `stats.classifier.label.en` in gold. **The data has the English; it is not a seed gap.**

**Therefore GAP-L is cause (b): a render-boundary fault** — the legend/tile/cell boundary flattens the `LocaleString` (e.g. `String(label)`, or picks `.ka`) instead of resolving to `ctx.locale='en'`. **Route to BI-B1 (0049) / the FF-NO-LOCALESTRING-TO-STRING localize-at-boundary sweep (I-7).** No database-architect seed change.

⚠️ TRAP NOTE for future diagnosis: the RETIRED `ops/seed-data/geostat/*.bundle.json` DOES carry `en = ka` (Georgian placeholder — `seed-helpers.labelEn()` returns `ka` verbatim). Diagnosing against that dead lane would falsely indicate a seed gap. Always diagnose data questions against the LIVE canonical SSOT (`DATA/canonical/*.xlsx`).
