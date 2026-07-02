---
id: "0055"
title: "DATA-PARITY sweep — build gates: FF-DATA-PARITY · FF-CHART-EQ-TABLE · FF-CHART-PRESENCE"
status: backlog
class: M
priority: P1
owner: —
implements: SPEC.DELTA-new12 data-parity sweep (owner requirement); invariants I-1/I-6
depends_on: ["0054", "0016", "0036", "0048", "0049", "0050", "0022", "0023", "0024", "0025", "0026", "0027", "0028", "0029", "0037"]
links:
  - platform/work/static-era-regression.md
  - platform/work/SPEC-render-pipeline-target.DELTA-new12.md
---
**Goal** — Prove, as CI build gates, that the current clean-architecture pipeline outputs CORRECT data — as the pre-regression static era did — THROUGH the pipeline, not by rollback or hardcode. The plan fails loudly if data diverges from "as it was". This item locks the epic alongside the FF suite (0030).

**Implements** — the owner's explicit data-parity requirement ("data must come out as it was, without the architecture regression"). Three build gates:

**FF-DATA-PARITY** — for every page × mode × filter, the rendered value (chart AND table) == the static-era golden fixture (0054) == source. The pipeline reproduces the known-correct dataset through DataSpec/ApiStore + pipe, not by hardcoding to the golden.

**FF-CHART-EQ-TABLE** — chart value == table value for every dual-view panel (structural via invariant I-6 — both views re-encode ONE section `data`; here asserted numerically). Reinforces C1 (0016) formatting SSOT and C7 (0036).

**FF-CHART-PRESENCE** — every expected chart/panel is present per state (none silently missing), and the per-slot chart type matches the spec (catches donut↔bar slot swaps and dropped panels). Uses the DELTA per-image slot inventory + LV-6 (0047) right-column resolution.

**Files / modules touched (WRITE ONLY under test/fitness locations)**
- Fitness/test harness reading the 0054 golden fixtures + the DELTA per-image slot inventory; asserts value parity, chart==table, and presence/type per page×mode×filter.
- Register the three gates in the CI fitness-function suite (with 0030).

**Dependencies** — 0054 (golden fixtures — the reference); 0016 (C1 formatting SSOT so parity compares clean magnitudes); 0036 (C7 dual-view so chart==table is structural); 0048/0049/0050 (bug fixes — parity would fail on the dropped sign, `[object Object]`, and duplicated rows until fixed); all element items 0022–0029, 0037 (the panels whose presence/type/value are asserted). Locks LAST.

**Acceptance criteria (incl. fitness functions)**
- [ ] **FF-DATA-PARITY**: per page×mode×filter, chart AND table rendered value == static-era golden == source; a divergence fails the build.
- [ ] **FF-CHART-EQ-TABLE**: chart value == table value for every dual-view panel (I-6 asserted numerically).
- [ ] **FF-CHART-PRESENCE**: every expected chart/panel present per state; per-slot chart type matches the spec (donut↔bar slot swaps and missing panels fail).
- [ ] All three registered as CI build gates (fail loudly, not warn).
- [ ] `npx tsc --noEmit` EXIT=0.

**Standing DoD (applies) — data-parity variant** — correct data via clean/canonical architecture — no hardcode-to-golden, refine existing. Gates prove parity THROUGH the pipeline (DataSpec/ApiStore/pipe), never by matching a hardcoded constant. No anti-patterns/DRY violations; SSOT; declarative/config-driven; Strangler. "Look like the screens" / "match the golden" must NEVER be met by dropping quality or hardcoding.

**Notes** — The epic-locking gate for data correctness (peer to 0030 FF-suite lock). Fails loudly on any divergence from "as it was". Two-way door (test-only; no runtime change).
