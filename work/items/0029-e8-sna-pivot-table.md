---
id: "0029"
title: "E8: National Accounts SNA pivot table (warm-coverage verification)"
status: backlog
class: G
priority: P2
owner: —
implements: SPEC §2 E8, §3
depends_on: ["0016", "0017", "0010"]
links:
  - platform/work/SPEC-render-pipeline-target.md
---
**Goal** — The `/ka/accounts` cross-classified pivot (account rows × Resources/Uses `series` columns) renders correctly and — the one open risk here — its underlying reads are actually warmed.

**Implements** — SPEC §2 E8 + §3. AR-35 (header↔column alignment + bounded-scroll freeze) is already BUILT+VERIFIED; this item verifies numbers via C1 and warm-coverage via C2.

**Files / modules touched** — accounts pivot config; verification (no engine change expected beyond C1/C2).

**Dependencies** — 0016 (C1 — numbers via SSOT), 0017 (C2 — **if the pivot spec lowers to `pivot`/`transform`, C2-a MUST cover its underlying query reads**; today `pivot`/`transform` warm `[]` — the latent gap this element most directly exercises), 0010 (O-2 confirms nested-query = warm set).

**Acceptance criteria (incl. fitness functions)**
- [ ] Dispatches to `PivotTable` (not `SimpleTable`); account rows × `series` columns.
- [ ] Header↔column alignment from ONE `alignClass(col)` source (numeric→right); header freezes on vertical scroll with a bounded `max-height` wrap (AR-35 — verify still green).
- [ ] Numbers via C1 SSOT (FF-FORMAT-SSOT, 0016).
- [ ] **FF-WARM-COVERS-RENDER + FF-NO-EMPTY-REQS-FOR-READING-SPEC** (0017): if the spec lowers to `pivot`/`transform`, its nested-query reads are warmed — no cold `querySync` on the accounts page.
- [ ] Account selection + time binding per perspective react correctly.
- [ ] `npx tsc --noEmit` EXIT=0.

**Standing DoD (applies)** — rendered result must match `scriness/` achieved ONLY through highest-concept architecture: no hardcoding, no anti-patterns, no DRY violations; declarative/config-driven; conditional logics covered; SSOT; refine/elevate EXISTING code (Strangler) — never rewrite-from-scratch or hardcode-to-match the screenshot. "Look like the screens" must NEVER be met by dropping quality.

**Notes** — This element is the canonical case where the C2-a pivot/transform gap would bite; treat its warm-coverage as the primary acceptance signal. Two-way door.
