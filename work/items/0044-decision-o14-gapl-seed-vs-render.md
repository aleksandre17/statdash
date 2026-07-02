---
id: "0044"
title: "DECISION O-14: GAP-L — EN data-category labels stay Georgian: missing codelist `en` (seed) vs render-boundary `String()` (engine)"
status: backlog
class: DECISION
priority: P0
owner: —
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
