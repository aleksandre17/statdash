---
id: "0009"
title: "DECISION O-1: Axis-tick style (compact vs honest-full)"
status: backlog
class: DECISION
priority: P0
owner: —
implements: SPEC §5 O-1, §1 C1
blocks: ["0016", "0024", "0025", "0026", "0027", "0028"]
links:
  - platform/work/SPEC-render-pipeline-target.md
---
**Decision needed** — How numeric-axis ticks abbreviate on level/currency charts (the axis whose `axes.y.decimals` is undefined).

**Reasoned DEFAULT (build this unless told otherwise)** — **Compact** (`88.4K`, locale-aware) via `Intl.NumberFormat(locale,{notation:'compact',maximumFractionDigits:1})`. Industry standard (Grafana / Datawrapper / OWID), scales to any magnitude, monotonic (equal ticks never collapse to duplicates), and agrees with the table by rounding-not-fabricating.

**Alternative** — **Honest-full** (`88 426`, space-separated): exact but wide on tall-value axes.

**One sub-confirm** — the `ka` abbreviation glyph: `ათ.` / `მლრ.` vs `K` / `B`.

**Reversibility** — Two-way door (formatter registry entry; swappable per-locale later at zero cost).

**Blocks** — 0016 (C1 formatting SSOT) and every axis-bearing element: 0024 (E3), 0025 (E4), 0026 (E5), 0027 (E6), 0028 (E7). C1 can proceed on the DEFAULT; only the `ka` glyph is genuinely owner-only.

**Owner action (~2 min)** — Confirm compact + the `ka` glyph, or select honest-full.

**Standing DoD (applies to the dependent build items, not this decision):** rendered result must match `scriness/` achieved ONLY through highest-concept architecture — no hardcoding, no anti-patterns, no DRY violations; declarative/config-driven; conditional logics (visibleWhen/perspective/effects) covered; SSOT; refine/elevate EXISTING code (Strangler) — never rewrite-from-scratch or hardcode-to-match the screenshot. "Look like the screens" must NEVER be met by dropping quality.
