# BOARD — Render-Pipeline TARGET epic (single source for this epic)

_Last updated: 2026-07-02._
> This is the ONE board for the render-pipeline epic (items 0009–0055). `work/BOARD.md` points here.
> SSOT specs: **`platform/work/SPEC-render-pipeline-target.md`** (E1–E8, C1–C6, O-1…O-7, FF suite)
> **+ `platform/work/SPEC-render-pipeline-target.DELTA-6-14.md`** (img_6…14: C7, E9, O-8…O-12, LV-1…LV-5, added FFs)
> **+ `platform/work/SPEC-render-pipeline-target.DELTA-new12.md`** (new-12 interaction-state shots: bugs BI-B1…B3, axes AX5–7, O-13…O-16, LV-6, added FFs).
> Diagnosis: `render-drift-audit.md`, `effect-variable-architecture-drift.md`, `static-era-regression.md`. Item files live in `work/items/`.
> **START HERE:** resolve the 16 DECISION cards (0009–0015 + 0031–0035 + 0043–0046, ~2 min each), then land the 3 cheap bug fixes (0048→0049→0050), then build the capabilities, then wire the elements, then lock the FF suite + data-parity gates. Run the LV live-verify checks (0038–0042, 0047) against the live app before their dependent elements CLOSE.

> **STANDING DoD** (attached verbatim to every item 0009–0042): rendered result must match `scriness/` achieved ONLY through highest-concept architecture — no hardcoding, no anti-patterns, no DRY violations; declarative/config-driven; conditional logics (visibleWhen/perspective/effects) covered; SSOT; refine/elevate EXISTING code (Strangler) — never rewrite-from-scratch or hardcode-to-match the screenshot. "Look like the screens" must NEVER be met by dropping quality.

---

## ⚑ DECISIONS FIRST — [OWNER-CONFIRM] (P0 · resolve at morning)

**O-1…O-7 (from the main spec §5):**
| Item | Decision | DEFAULT (build unless told) | Blocks |
|------|----------|-----------------------------|--------|
| [0009](../items/0009-decision-o1-axis-tick-style.md) | O-1 axis-tick style | **Compact** `88.4K`; confirm `ka` glyph | C1 |
| [0010](../items/0010-decision-o2-warm-pivot-transform.md) | O-2 pivot/transform warm | **Nested-query reqs**; name store-hitting pipe ops | C2,E8 |
| [0011](../items/0011-decision-o3-effects-build-vs-defer.md) | O-3 effects now/defer | **Build now** (else `D-EFFECTS`, free later) | C3,E1 |
| [0012](../items/0012-decision-o4-map-ramp-plus-selection.md) | O-4 map ramp | **Always ramp + selection overlay** | C4,E5 |
| [0013](../items/0013-decision-o5-mean-base-year.md) | O-5 mean base year | **Include all N** (alt: N−1) | C5,E1 |
| [0014](../items/0014-decision-o6-component-dimension.md) | O-6 component dim ⚠️**HIGHEST-MATERIAL** | Iterate `measure` by `approach`; **needs code set → database-architect** | C6,E6 |
| [0015](../items/0015-decision-o7-percapita-2014-pipeline-vs-seed.md) | O-7 per-capita 2014=483 | **Pipeline** (C6-d); if gold=483 → **database-architect** | C6,E7 |

**O-8…O-12 (from the DELTA §3 — img_6…14):**
| Item | Decision | DEFAULT (build unless told) | Blocks |
|------|----------|-----------------------------|--------|
| [0031](../items/0031-decision-o8-expenditure-encoding.md) | O-8 expenditure encoding `contribution` vs `waterfall` | **Keep `contribution`** (prov. 1758) as the bridge; `waterfall` = its alias (both → ApexRenderer); confirm `isTotal` closing-bar colour token | E6,E9 |
| [0032](../items/0032-decision-o9-dualview-default-url.md) | O-9 dual-view default + URL-encode | **Chart-first**; active-view state **in URL** per section (permalink Law 9) | C7 |
| [0033](../items/0033-decision-o10-accounts-dynamics-panelset.md) | O-10 `/accounts` dynamics panel set (unseen) | Assume dynamics grid mirrors GDP (time-series of closing balances); **confirm via LV-3 (0040)** | E9 |
| [0034](../items/0034-decision-o11-income-treemap-total-signs.md) | O-11 income treemap `=GDP` tile + data-driven signs | Sign + total are **data-driven** (`isTotal` field); treemap must NOT double-count the `=GDP` tile | E6,E9 |
| [0035](../items/0035-decision-o12-regional-sector-selector.md) | O-12 regional sector-selector semantics | KPI re-bases to the selected sector; `_T` = total; comparison-bar scope per O-8/**LV-1 (0038)** | E10-family |

**O-13…O-16 (from the DELTA-new12 §4 — interaction-state shots):**
| Item | Decision | DEFAULT (build unless told) | Blocks |
|------|----------|-----------------------------|--------|
| [0043](../items/0043-decision-o13-range-byregion-semantics.md) | O-13 range-mode "by region" ranking semantics | **Terminal-year snapshot** (`by:["geo"]`, pin `time=toYear`); alt = windowed sum | 0050 (BI-B2) |
| [0044](../items/0044-decision-o14-gapl-seed-vs-render.md) | O-14 GAP-L: EN data-category labels stay Georgian | **Diagnose codelist for `en`**: present → render-fix (BI-B1); absent → database-architect seed | 0049 (BI-B1) |
| [0045](../items/0045-decision-o15-theme-persistence.md) | O-15 theme persistence | **localStorage + `prefers-color-scheme`**, NOT URL-encoded | 0051 (AX5) |
| [0046](../items/0046-decision-o16-unify-map-viewrole.md) | O-16 unify map toggle into C7 `view.role:'map'` | **Unify now** (else `D-MAP-VIEWROLE` defer) | 0052 (AX6) |

> ⚠️ O-6 (0014) + O-7 (0015) may need data/DB input before dependents (0020/0027/0028) CLOSE — flag database-architect early.
> ⚠️ O-10 (0033) is confirmed by the LV-3 live capture; O-12 (0035) by LV-1. Decisions can proceed on DEFAULT; LV closes the residual unknown.
> ⚠️ O-14 (0044) is a diagnosis-gated fork: if the codelist lacks `en`, GAP-L is a database-architect seed item (outside this epic's code fences).

---

## 🐛 BUG FIXES — root-caused in DELTA-new12 (land EARLY · cheap, high-visibility wins)

> These 3 gate trustworthy verification of every new interaction state. Land order: **BI-B3 → BI-B1 → BI-B2** (B3 trivial/visible first; B1 establishes the locale-at-boundary SSOT; B2 the ranking rollup). Each is a root-cause fix with an exact seam + FF.
| Item | Bug | Seam | FF | Depends on |
|------|-----|------|-----|-----------|
| [0048](../items/0048-bib3-sign-pct-signed-formatter.md) | **BI-B3** dropped negative sign (`6.3%`→ must be `-6.3%`) | `formatters.ts:9` drop `Math.abs` | FF-SIGN-PRESERVED | 0016 |
| [0049](../items/0049-bib1-derive-localestring-resolution.md) | **BI-B1** `[object Object]` map subtitle | `filter-derive.ts:163` + thread `locale` into `DeriveContext` (`evalVarMap.ts`) | FF-DERIVE-LOCALIZES-LABELS · FF-NO-LOCALESTRING-TO-STRING | 0044 |
| [0050](../items/0050-bib2-ranking-group-key-normalization.md) | **BI-B2** duplicated/collapsed region labels | `geostat.provisioning.json:3857` group key = `["geo"]`, roll up `time` | FF-RANKING-ONE-ROW-PER-CATEGORY | 0043·0016 |

---

## CAPABILITIES then ELEMENTS then LOCK

Class **M** = architect/migration mandatory · **G** = general · all P0–P2 · status `backlog` (owner promotes to `ready`).

**Capabilities (build these first — every element depends on them):**
| Item | Work | Cls | Prio | Depends on |
|------|------|-----|------|-----------|
| [0016](../items/0016-c1-formatting-ssot.md) | C1 Formatting SSOT (compact + yFormatter) — Drift 1 | M | P0 | 0009 |
| [0017](../items/0017-c2-warm-contract-guard.md) | C2 Warm-contract guard + FF-WARM-COVERS-RENDER | M | P0 | 0010 |
| [0018](../items/0018-c4-choropleth-consolidation.md) | C4 Choropleth consolidation — retire `panels/map` node (Drift 2) | M | P1 | 0012·0016·0017 |
| [0019](../items/0019-c5-mean-kpi-reduction.md) | C5 `mean` KPI + fail-loud CAGR — Drift 3 | M | P1 | 0013·0016·0017 |
| [0020](../items/0020-c6-component-rollup-pinning.md) | C6 Component rollup/pinning + per-capita — Drift 4&5 | M | P1 | 0014·0015·0016·0017 |
| [0021](../items/0021-c3-effects-recovery.md) | C3 Effects recovery (`onEnter`/`onExit`) | M | P2 | 0011·0017 |
| [0036](../items/0036-c7-section-dual-view.md) | **C7 Section dual-view (chart↔table); invariant I-6 — both views re-encode the SAME warmed rows, no re-query** | M | P1 | 0032·0016·0017 |

**New axes / capabilities (DELTA-new12 §3 — build after the bug fixes):**
| Item | Work | Cls | Prio | Depends on |
|------|------|-----|------|-----------|
| [0051](../items/0051-ax5-theme-token-ssot.md) | **AX5 Dark/light theme axis — `data-theme` token SSOT + chart/map re-theme** | M | P1 | 0045·0016 |
| [0052](../items/0052-ax6-unify-map-into-c7-viewrole.md) | **AX6 Unify geograph map↔table into C7 `view.role:'map'` (one toggle mechanism)** | M | P1 | 0046·0036·0018 |
| [0053](../items/0053-ax7-sector-select-requery-warm.md) | **AX7 Regional sector-select re-query interaction + warm contract** | G | P1 | 0017·0035·0047 |

**DATA-PARITY sweep (owner requirement — "data must come out as it was"; extract-then-gate):**
| Item | Work | Cls | Prio | Depends on |
|------|------|-----|------|-----------|
| [0054](../items/0054-golden-fixtures-static-era-extract.md) | **Extract static-era golden fixtures from git `191bc0e` (the known-correct dataset) — EXPLICIT prerequisite** | M | P1 | — |
| [0055](../items/0055-data-parity-sweep-gates.md) | **DATA-PARITY build gates: FF-DATA-PARITY · FF-CHART-EQ-TABLE · FF-CHART-PRESENCE (locks the epic)** | M | P1 | 0054·0016·0036·0048·0049·0050·0022–0029·0037 |

**Elements (config `kit` wiring once C1–C7 land):**
| Item | Work | Cls | Prio | Depends on |
|------|------|-----|------|-----------|
| [0022](../items/0022-e1-kpi-strip.md) | E1 KPI strip (per-perspective 4-card) | G | P2 | 0016·0017·0019·0021 |
| [0023](../items/0023-e2-region-table.md) | E2 Region table + bars (C6 reference) | G | P2 | 0016·0017 |
| [0024](../items/0024-e3-gdp-bar-chart.md) | E3 GDP bar chart (compact axis) + table view | G | P2 | 0016·0017·0036 |
| [0025](../items/0025-e4-sectoral-stacked-area.md) | E4 Sectoral stacked-area + year×sector pivot table view | G | P2 | 0016·0017·0036 |
| [0026](../items/0026-e5-choropleth-map.md) | E5 Choropleth map | G | P2 | 0016·0017·0018 |
| [0027](../items/0027-e6-gdp-component-charts.md) | **E6 GDP component quartet — expenditure `contribution`/waterfall BRIDGE · production donut · income treemap · capital donut-% + table view** | G | P2 | 0016·0017·0020·0014·0031·0034·0036 |
| [0028](../items/0028-e7-growth-contribution-percapita.md) | E7 Growth + contribution + per-capita + table view | G | P2 | 0016·0017·0020·0036 |
| [0029](../items/0029-e8-sna-pivot-table.md) | E8 SNA pivot (warm-coverage verify) — **is E9's table view** | G | P2 | 0016·0017·0010 |
| [0037](../items/0037-e9-sna-accounts-hbar-diverging.md) | **E9 SNA `/accounts` `hbar-diverging` sequence + per-account sub-charts (E8 pivot = its table view)** | G | P2 | 0016·0017·0031·0033·0034·0036·0029 |

**Lock:**
| Item | Work | Cls | Prio | Depends on |
|------|------|-----|------|-----------|
| [0030](../items/0030-ff-suite-lock.md) | FF suite — CI lock (each FF ships WITH its capability; now incl. FF-DUALVIEW-ONE-DATA, FF-BRIDGE-CLOSES, FF-DIVERGING-TREE-ORDERED, FF-TABLE-FOOTER-MEAN) | M | P1 | 0016–0021·0036·0037 |

---

## 🔎 LIVE-VERIFY checks (headless-browser pass · status `needs_live_verify`)

> Run against the live app BEFORE the dependent element CLOSES. Each resolves a residual unknown the screenshots left open. Two-way (read-only observation).
| Item | Live check | Feeds / gates |
|------|------------|---------------|
| [0038](../items/0038-lv1-regional-comparison-single-bar.md) | LV-1 Regional-comparison `hbar` collapses to a single Imereti bar (=579) under region+sector select — intended focus vs C6 degeneracy (should rank all, highlight one) | O-12 (0035); regional-comparison element; broken x-axis = C1 (0016) |
| [0039](../items/0039-lv2-dualview-url-persist.md) | LV-2 Section chart↔table active-view persisted in URL (Law 9) + restored on reload/share | O-9 (0032) → C7 (0036) |
| [0040](../items/0040-lv3-accounts-dynamics-panelset.md) | LV-3 `/accounts` in **dynamics** mode — capture the panel set (unseen) | O-10 (0033) → E9 (0037) |
| [0041](../items/0041-lv4-choropleth-region-click-rescope.md) | LV-4 Choropleth region-click re-scopes sector donut + comparison + area; agrees with KPI base | E5 (0026); regional elements; O-12 (0035) |
| [0042](../items/0042-lv5-duplicate-tick-live.md) | LV-5 C1 duplicate-tick bug fires on GDP-dynamics `combo` y-axis (img_7) + regional-comparison x-axis (img_12/13) — both fixed by the single C1 seam | C1 (0016) |
| [0047](../items/0047-lv6-donut-vs-sectoral-structure-slot.md) | LV-6 Regional right-column slot: sector donut (img_5) vs sectoral-structure bar (img_6) — distinct section slots vs state swap | AX7 (0053); E10-family panel inventory |

---

## Build order (FINAL — full epic sequence)

`O-1…O-16 decisions (16 cards)`
`→ 0054 extract golden fixtures (start early — the correctness reference; parallel, no deps)`
`→ C1(0016) → BI-B3(0048) [trivial, extends C1] → C2(0017)`
`→ BI-B1(0049) [after O-14/0044] → BI-B2(0050) [after O-13/0043, needs C1]   ← the 3 cheap bug wins, land early`
`→ (C4·C5·C6·C7 = 0018·0019·0020·0036 parallel) → C3(0021)`
`→ AX5(0051) · AX6(0052 · after C7+C4) · AX7(0053 · after C2, LV-6/0047)   ← new axes`
`→ E1…E9 wiring 0022–0029·0037 (with LV-1…LV-6 live-checks before each dependent CLOSES)`
`→ FF(0030) lock + DATA-PARITY gates(0055) lock   ← epic locks LAST, fails loudly on any divergence from "as it was".`

C1 + C2 + the 3 bug fixes (BI-B1/B2/B3) are prerequisites for trustworthy verification of everything else. The data-parity sweep (0054 extract → 0055 gate) proves the pipeline outputs the static-era-correct data THROUGH the clean architecture — no rollback, no hardcode-to-golden.

> WIP limit (PROCESS.md): in-progress ≤ 2. backlog→ready is the owner's call.
