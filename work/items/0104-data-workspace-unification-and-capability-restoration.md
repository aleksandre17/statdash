# 0104 — Data-Workspace Unification & Capability Restoration

_Session handoff, 2026-07-20 (owner-directed: "restore the lost parts, unify the two pipelines FULLY with beautiful UI, then write everything down for next session"). Status truth: this card + ADR-051 + ADR-046 Add.4/5 + the DESIGN/STUDY docs. This card is the entry point for the next session._

## Origin
Owner circle-break (2026-07-20): "one concept, two independent sources" — the query **workbench** and the **advanced raw data editor** are two tools for one thing; "not ready in any aspect; we move too slowly." → platform-architect study proved a data-workspace archipelago; program **ADR-051 "One Data Workspace — the source is step 0"** (Strangler, waves DU1–DU6). Owner blessed full autonomy + "build the BEST UI/platform, research the reference class (Power Query/Retool/Grafana/Airtable/Looker-dbt), go faster." Standing mandate: **the ONE pipeline must do EVERYTHING the arsenal can AND be simple enough for a non-programmer — simple AND powerful** (owner authorized adopting reference-class libraries; verdict so far: adopt TanStack Table only, build the rest).

## Shipped today (committed on main, each live-J-walked on :3013)
- **DU1** `1e62e140` — Sources+Model folded into one `/studio/data` workspace (floors), old routes redirect.
- **DU2** `dbe5e142` — courier/teleport `sourcesHandoff.ts` deleted; cube-browse seeds the workbench via a URL one-shot (the likely freeze cause, gone).
- **DU3** `e1c99afd` — one editing surface: `SpecBody` → workbench fallback lane; both hosts route to the ONE `DataWorkbench`; removed the duplicate accordions + kind `<Select>`.
- **persistence** `39a32e99` — DataSpec edits now PUT to the API (were store-only/lost-on-reload since AR-49); optimistic + debounced coalesced PUT + honest Saving/Saved chip.
- **DU4a** `cc090228` — engine value-cell `source` variant (ADR-046 Add.4); **timeseries folds** onto the spine byte-identical.
- **DU4b** `952b230b` — **single-code growth folds** byte-identical (honest first-period drop).
- **DU4c/d** `9722e58c` — ratio-list + row-list assessed: **deferred to ADR-046 Add.5** (need the explicit-cells variant; kept on fallback with guards).
- **Step A** `fec72cab` — timeseries + single-code growth OPEN as the three-pane pipeline (reversible view; convert-on-first-edit = query behavior).
- **F2** `8243f5b7` — value-cell fold routes cross-store (governed metric-id) + honest '—' not fake 0 (Law 11); closed the FF-PIPELINE-EQUIV cross-store corpus gap.
- **authoring-hold** `5506cc59` — **INTERIM: DataSpec persistence PAUSED by default (`DEFAULT_AUTHORING_HOLD=true`)** — owner was auto-saving experiments and corrupting specs. Amber "Draft — not saving" + "Enable saving" toggle. Flip OFF (or ship the draft→publish model) to restore saving.
- **Docs:** ADR-051, ADR-046 Add.4 `d6ca4379` + Add.5 `bccd1798`; `docs/architecture/proposals/DESIGN-data-workspace-canonical-redistribution.md`; STUDY-canonical-panel-ia.

## Data restores (dev :3013 / portal :3012)
- **Regional** — `config.data_source[regional].datasetCode` had been flipped REGIONAL_GVA→GDP_ANNUAL (every regional pipeline silently read the national cube). Restored from provisioning. Verified (samtskhe/OTHER/GVA: 0 → 538.67).
- **GDP portal `/ka/gdp?mode=range`** — charts 1 (nominal level) & 2 (per-capita $) were mis-bound to the real-growth % series; charts 3 & 4 correct. Restore IN FLIGHT (chief-engineer, provisioning baseline, live-render verified). NOTE: my earlier "published page is fine" was WRONG — it was a config-read, not a live render. **Lesson: live render = truth.**
- **Orphan scratch** — broken GDP_AGRI/probe "(შემოთავაზებული)" specs (`d954e1ba` + 7 siblings, unbound/0-rows/regenerable) — **DELETED 8/8** (backup `work/data-spec-backups/orphan-suggested-specs-backup-2026-07-20-173919.json`; 32→24 specs, 0 collateral, verified against full page configs). Note: `/api/config/pages` list omits `config` bodies — a "is this referenced?" check MUST fetch each `/api/config/pages/:id`.

## ⚠️ THE REGRESSION INCIDENT (owner lost trust — must not recur)
DU3 + Step A **silently dropped capability**. Root: Step A's `toWorkbenchModel` fold gate conflated "engine CAN lower to a pipeline" with "the author SHOULD edit it as a pipeline." Confirmed losses (parity sweep):
- **R2 (HIGH):** timeseries/single-code-growth head READ-ONLY — can't edit `code`/`years`.
- **R3 (HIGH):** pivot diverted from `PivotEditor` (rows/keyField/values/colors) — violates its own POLA lossless-round-trip contract.
- **R4:** transform inline `source` rows + `encoding` not editable.
- **R5:** single→multi growth one-way trap.
- **R1 (DU3):** spec-type picker / kind `<Select>` (create-from-scratch + inter-kind convert) unmounted.
- **R6 (DU3):** read-only JSON disclosure gone for editor kinds.
- **Advanced-editor-in-pipeline:** for a query/pipeline in the three-pane, `encoding` editing, `FieldWells`, steward `FilterBuilder`, `MeasureSelector`, writable raw-JSON all unreachable.

**Why it happened (owned):** I verified PROXIES (FF-ONE-SPEC-EDITOR "no duplicate", one-gesture live walk) not the PURPOSE ("survivor ⊇ removed"). I HELD `feedback_verification_doctrine.md` ("verify purpose not proxy" · pre-action gate pt.2 "state the WHOLE target" · "old version = the spec") and did NOT execute it as a pre-gate. DU1/DU2/persistence/authoring-hold were clean supersets; DU3 + Step A were not.

**BINDING FIX (now a hard pre-gate):** before ANY retire/merge/fold — enumerate the removed surface's FULL capability set FIRST, prove the survivor is a superset, guard it with a fitness (`FF-EDITOR-CAPABILITY-PARITY`). DoD = "no capability lost", never "no duplicate". Executed + shown, not held passively. (memory: `feedback_capability_parity_gate`.)

## ▶ PRIMARY NEXT-SESSION OBJECTIVE — full unification + beautiful UI
Owner: "restore the lost parts, and **unify those two pipelines FULLY, with everything, including a beautiful UI**."
1. **Restore capability (IN FLIGHT this session):** narrow the fold gate so timeseries/growth/pivot/transform regain their full dedicated editors; add an "Advanced/raw" escape hatch in `DataWorkbench` (reuse `SpecBody`) for encoding + raw-JSON on query/pipeline; restore R1 (type picker) + R6 (JSON read); add the `FF-EDITOR-CAPABILITY-PARITY` gate. (senior-frontend, revert-clean, then live-verify.)
2. **THEN unify properly (next session):** ONE workbench that authors EVERY kind with FULL power (dedicated-editor capabilities available IN the three-pane — editable value-cell heads: measure/years, encoding, pivot fields, inline rows), re-admitting kinds to the three-pane ONLY when capability-parity is proven — with a **beautiful, reference-class UI** (Power Query applied-steps + Retool/Grafana single-flow + Airtable core-ops). This is the true end of "one concept, not two sources": simple forward, full power one click behind, beautiful.

## Queued program (fold into the above / DU6)
- **5 UX items** (owner live review) + `DESIGN-data-workspace-canonical-redistribution.md` verdicts: (1) metric IA scatter → one `MetricCatalogView` (Looker/dbt "one definition, many views"); (2) core table ops forward on the element (a "workbench"=the powerful DataWorkbench; basics as a lightweight band/popover); (3) Sources classifiers 3→1 disclosure (renderer is world-class, tune defaults); (4) Model-floor canonical+beautiful redistribution = **DU6** (de-dup DataFlowMap, dissolve browse/edit lens exclusion); (5) popups on a principled interruption axis (add the missing modal/confirm-dialog). Root: route data-workspace surfaces through the existing Placement Law (`resolveSurface.ts`) instead of hand-placement. Waves DW-C→DU6→DW-A→DW-B→DW-D.
- **VISUAL refresh** of chart rendering (owner: GDP page "structure good, visual outdated" — flat gray bars/heavy dark). Reference-class theme/typography/color. Structure = canonical Section⊃Elements⊃metric-binding reference.
- **Per-capita chart stops at 2017** while siblings reach 2025 — real data/binding gap to investigate.
- **DU4 remainder:** ADR-046 Add.5 build (explicit-cells `cells` variant → fold ratio-list + row-list) · multi-code growth (calc-metric-browse, DU4e — flagged not-byte-identical, needs its own equivalence proof) · then the ⛔ one-way emission flip (DU5) gated on FF-ALL-KINDS-SHAPED + FF-PIPELINE-EQUIV full-corpus + J-walk.
- **Data-integrity guards (from the corruption incident):** the real fix for auto-save is a **draft/dirty → explicit Save/Publish (+ discard/undo)** model (like pages); add **version history** to `config.data_source`/`config.data_spec` (destructive UPDATE today — only git provisioning saved regional); add **PUT validation** (a source's dims ⊆ the datasetCode's DSD dims; datasetCode exists).

## Environment / ops facts (load-bearing)
- **Deploy topology:** dev container `statdash-dev-panel-full` bind-mounts only `panel/src`; `packages/*` are baked → an ENGINE change needs `docker cp core/src` (or image rebuild), NOT just `dev-watch-panel.sh`. "Committed" ≠ "live on dev" for packages/*.
- **Live-check host:** playwright against the REAL container — studio `http://192.168.1.199:3013`, portal `http://192.168.1.199:3012`; API `http://192.168.1.199:3011/api` (auth `admin`/`dev_admin_pw_123`). Do NOT boot a local panel (502s on the Docker api hostname).
- **authoring-hold is ON** → :3013 is NOT saving DataSpec edits until flipped (or draft→publish ships).
- Backups: `work/gdp-restore-backup/`, session scratchpad `BACKUP-live-data-specs-*.json`.

## Discipline carried forward
WIP=1 (finish end-to-end: built→gated→**live-J-walked**→shown). **Capability-parity pre-gate before any retire/merge.** Verify the PURPOSE on the live render, never a proxy. Owner feedback QUEUES, never abandons. Decide-and-drive reversible work; don't ask what I can decide.
