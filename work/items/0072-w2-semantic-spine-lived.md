---
id: "0072"
title: "W2 — THE SEMANTIC SPINE, LIVED: data-first front door · dictionary→canvas bind · migrate the corpus onto governed handles"
status: DONE (2026-07-17) — J1/J2/J4 walked LIVE on :3013, consoleErrors:[], evidence work/authoring-truth/w2/; dev reprovisioned (regional v5 · gdp v6 · accounts v3 published); post-walk fixes 3a3eb4a (boot-race hydrate) + 5b87c2d (dev sync mount); gates: panel 977/977 · api 379/0 · bind-parity 8/8
class: M
priority: P0
owner: — (senior/apex build agent, Opus)
implements: STUDY-authoring-canon-circle-break §F3/§W2 (Canon C1) — the owner's "everything starts from raw data; it's stuffed in somewhere", verbatim
depends_on: ["0071"]
links:
  - docs/architecture/proposals/STUDY-authoring-canon-circle-break.md
  - work/authoring-truth/07-model.png   # the read-only cul-de-sac; hasUpload:false on default lens
---
**Intent.** The platform's spine — raw data → governed semantic model → bound elements — must be the LIVED journey, not just the architecture. Today (live-probed): onboarding is buried behind Model→lens-flip; the Data Dictionary lists 17 metrics ("11 never used") but cannot bind anything to the canvas; DataFlowMap is exiled full-screen; live page elements carry raw coordinate configs with EMPTY metric selects — D5 (ADR-042) stalled at "mechanism shipped, adoption pending".

**The outcome that counts.** (1) Onboarding raw data is ONE intentful step from the shell (front door, no lens burial — the lens still governs WHO can publish, not WHERE the door is). (2) A metric drags from the Dictionary/palette onto a canvas element and binds (dnd-kit — align with W4's one-transport direction). (3) The EXISTING page corpus migrates onto metric handles (the stalled Strangler second half): every bindable element on live pages gets its governed ref; raw coordinate/DataSpec editors demote to steward plane. (4) `FF-DATA-BOUNDED` + `FF-AUTHOR-NO-QUERY` BITE on the corpus, not just on intentions. (5) DataFlowMap embeds as the Data home's orientation.

**Known facts.** MetricPalette + `bindMetric` seam exist (`useCanvasController`, `discovery/`); `metricDrag.ts` already speaks dnd-kit; `resolveMeasureRef` is the ONE lowering path (FF-BIND-PARITY proves byte-identity); provisioning holds the corpus configs; AR-51 CanonicalUpload is real and works — it is buried, not broken.

**Hard boundaries.** Governance lens PRESERVED (D-DA1: author binds, steward defines) — one-step journey, zero-step governance is refused. Dependency arrow unchanged. Corpus migration is expand-contract: config byte-compat until the flip, each page render-verified (chart==table parity where same-section).

**DoD.** Journeys **J1 (upload→published cube), J2 (define metric), J4 (bind via governed noun)** each walked LIVE on :3013 against the real api/db · corpus scan: 0 author-plane raw-source configs · deployed · owner shown.

---

## Delivery log (senior build agent, 2026-07-17, on `main`)

**Commits:** `02d2cf9` (front door) · `04b39af` (corpus migration + FF-DATA-BOUNDED) · `90fb21c` (probe mechanics).

**Landed (reversible, in-codebase, gate-proven):**
- **Outcome 1 — data-first front door.** CanonicalUpload was buried inside the Steward-only ModelSurface (rail Data → flip lens → upload). Hoisted to `DataModelBody` ABOVE the role-lens split → the onboard-data door renders in the DEFAULT author lens, ONE step from the shell, both lenses. Governance preserved (publish = server-FSM; raw-source modeler stays behind Steward Edit). `DataModelBody.test.tsx` proves the front-door-in-both-lenses invariant. FF-AUTHOR-NO-QUERY holds (CanonicalUpload is the blessed front-door component, not the ExcelUpload/DataModelingPanel wall).
- **Outcome 3 — corpus migrated onto governed handles (the FLIP).** 53 author-plane single-value bindings across the SNA/regional/GDP pages flipped off raw SDMX codes onto governed metric-ids (B5G→accounts.gni, B9→accounts.netLending, B1G→accounts.gdp, P1→accounts.output, B6G→accounts.disposableIncome, B8G→accounts.savings, GVA→regional.gva, gross-domestic-product-at-current-prices→gdp.current, gdp-per-capita-usd→gdp.perCapita, real-gdp-growth-rates→gdp.realGrowth). The catalog already DEFINED every metric (expand done); this run is the flip. Coordinate parity proven on-disk by `config-cube-contract.fitness` (resolveMeasureRef mirror → same DSD code, checked vs the canonical workbook). KPI specs already carried format/unit inline → render-identical. Steward plane untouched: catalog `code` fields, calc-input coordinates (D1/B1G `at`), and `type:query` fan-out DataSpecs (breakdown charts + raw-code exprs `measure == 'P1'`) stay raw by design.
- **Outcome 4 — FF-DATA-BOUNDED bites.** New `apps/api/src/provisioning/data-bounded.fitness.test.ts`: every author-plane single-value binding must name a governed metric-id; a planted raw code fails the build. This IS "corpus scan: 0 author-plane raw-source configs". FF-AUTHOR-NO-QUERY (surfaces) already held.
- **Folded — probe mechanics.** `platform/e2e/probes/` is the new journey-probe home (resolves @playwright/@statdash natively; the work/ copy dance is gone). W2 J1/J2/J4 probe landed there.

**Already built (verified, no work needed):**
- **Outcome 2 — metric drag→bind.** Fully wired: `CanvasOverlay` consumes the metric drag → `useCanvasController.bindMetric` → `firstMetricField`/`bindMetricToProps`; the Inspector DATA facet (`DataFacetField`) mounts the `MetricPalette` for click+drag. Byte-identical writes, both gestures.
- **Outcome 5 — DataFlowMap embedded.** Since AR-49 M4.3 it is Region 0 of ModelSurface + top of DataDictionarySurface (the Data home orientation) — no longer exiled full-screen.

**Converged gate (parsed logs):** panel vitest **977/977** · `tsc -b apps/panel` clean · lint **0 err / 6 warn** · apps/api **379 pass / 0 fail** (config-cube-contract **4/4**, FF-DATA-BOUNDED **4/4**) · core bind-parity **8/8**. No `packages/*` touched → no dist rebuild.

**Remainder (owner / next run):**
- **Live J1/J2/J4 walks + screenshots → `work/authoring-truth/w2/`.** BLOCKED: :3013 + the api are DOWN this session (curl 000). Run `node e2e/probes/probe-w2-semantic-spine.mjs` from `platform/` once the stack is up.
- **Reprovision the live db.** The migration edits the SEED (`geostat.provisioning.json`); the running :3013 db still carries the pre-migration config until a reprovision — a server side-effect that is the owner's step. Only then does the governance benefit (format/unit now applied via the metric) render live.
- **Surfaced follow-ups (out of W2 scope):** (a) the honest UNBOUND-KPI card (`data-kpi-state=unbound`) is not yet a metric DROP target — kpi-strip's measure is nested in `items[]`, not top-level bindable, so drag-onto-unbound-card (the ideal J4 gesture) needs a nested-part bind seam. (b) `type:query` DataSpecs still carry raw codes (e.g. `non-observed-economy-share` at prov:2574) — steward-plane by design; a future pass could govern the query measures too. (c) the GVA query specs carried a redundant `query.filter.measure` alongside `query.measure` — now both governed, still redundant.
