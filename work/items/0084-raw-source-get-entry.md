---
id: "0084"
title: "RAW WORK IN THE WORKBENCH — the steward raw-cube Get entry + the promotion loop (owner directive)"
status: DONE (2026-07-18, senior-frontend Opus) — the STEWARD Get gains «მეტრიკები | ნედლი კუბები» tabs (author lens NEVER sees the raw tab, live-proven); picking a cube emits the steward `source(query)` head → the 200-row raw browse renders live; the promotion loop (E2) is flesh — «მეტრიკად დაწინაურება» reuses the semanticCatalog seam, blesses a governed metric, and REPLACES the head (governed ref; the palette then offers it — live-proven, head becomes governed). Member-label DEBT surfaced honestly in the cube list («N წევრს ეტიკეტი აკლია» — REGIONAL_GVA/ACCOUNTS_SEQUENCE/GDP_ANNUAL each carry 8 label-less members, ledgered below). FF-PROMOTE-ROUNDTRIP FLIPPED (core, test-only, 3/3 green). probe-poffer-filter fixed (the missing «Add condition» click). Gates: panel vitest 1110/0 · tsc -b apps/panel clean · eslint clean. Zero console errors. Shots: work/authoring-truth/0084/.
was: QUEUED-HOT (2026-07-18, owner verbatim: «იქნებ ნედლი დატაზე მინდა მუშაობა?» + «არ გადადო» — fires the moment the in-flight P-OFFER wave lands; serialized ONLY for file-collision safety)
class: M
priority: P0
owner: lead → senior/apex build agent (Opus)
implements: the two-audience canon (see anchors) · ADR-046 (the source head's THREE variants — the steward `query` variant EXISTS in grammar, unsurfaced in UI) · E2 promotion rule · pulls the W-P6 front-door forward
links:
  - docs/architecture/decisions/ADR-046-pipeline-as-spine.md
  - docs/architecture/proposals/SPEC-query-pipeline-data-home.md   # §2 four floors · §3.4 plane law
---
**The international canon (Law 4 — adopt whole, name in code comments):** every reference leader gives raw access as a ROLE, never a default, with a PROMOTION loop upward: Power Query (connect-to-source → shape → lands in the model) · Superset (SQL Lab → publish as dataset) · Looker (SQL Runner → LookML model) · dbt (raw → staging → marts). Three-part principle: (1) raw work EXISTS and is strong; (2) it is PLANE-gated (published pages consume only governed facts — reader trust is never spent); (3) raw→governed promotion is the loop that FEEDS the semantic layer.

**The build (grammar is ready — this is surface + loop):**
1. **Get gains two offered tabs in the STEWARD lens:** «მეტრიკები» (existing MetricPalette) | «ნედლი კუბები» — the cube/dataset list (Floor 1 vocabulary: dataset code + governed title + dim summary from the cube profile/describeApp). Picking a cube emits the EXISTING steward head `{op:'source', query:{...}}` (ADR-046 variant 2 — no new grammar) → the browse grid shows the raw observations (the same one-derivation grid; steward plane may show raw codes per the plane law). The AUTHOR lens keeps metrics-only (FF-AUTHOR-NO-QUERY untouched).
2. **The promotion loop (E2 made flesh):** a workbench whose head is raw/steward gains «მეტრიკად დაწინაურება» — proposes a governed metric from the shaped read (name ka/en, unit, the coordinate); steward blesses → the catalog gains the metric (the existing semanticCatalog/steward metric-definition seam — REUSE, no new pipeline) → the head is REPLACED by the governed ref. `FF-PROMOTE-ROUNDTRIP` (registered pending in W-P0) flips to a biting gate: the promoted head resolves byte-identically to the raw one it replaced.
3. **P-OFFER holds everywhere:** the cube list, its dims, everything is offered — nothing typed.
4. **Honest states:** a cube with no obs → declared empty; no cubes → declared, never a blank tab.

**Hard boundaries.** No new DataSpec grammar (variant 2 exists) · plane law verbatim (ADR-041 §PLANE; author never sees the raw tab) · one derivation path (the grid/query-pane read the same model) · Law 9 WCAG · bilingual · the DQ floor and the full four-floor IA stay W-P6 (do not scope-creep into ingest).

**DoD.** Live walk (:3013, steward lens): Get → «ნედლი კუბები» → pick REGIONAL_GVA → raw browse renders → shape with steps → «მეტრიკად დაწინაურება» → the blessed metric appears in the catalog AND the head becomes governed → FF-PROMOTE-ROUNDTRIP green · author lens shows NO raw tab (fitness) · gates: panel vitest + tsc + lint · screenshots · zero console errors.

---

## Build log (senior-frontend, 2026-07-18) — DONE, apps-only + one core test-only flip

**The surface (apps/panel, all in `features/data-layer/workbench/`):**
- **`GetHead.tsx`** — the plane-gated source picker. AUTHOR lens → `MetricPalette` ONLY (no tabs, no raw code — FF-AUTHOR-NO-QUERY); STEWARD lens → two OFFERED MUI tabs «მეტრიკები» | «ნედლი კუბები». Reads `useRole()` (the swappable lens seam), never a second role source.
- **`RawCubePalette.tsx`** — the raw-cube browser. Lists `cubeApi.datasets()` (governed title + code); each cube an expandable disclosure loading its profile lazily (`cubeProfile.store`), showing a per-dim summary + the label-DEBT chip; «დაათვალიერე» emits the cube's measures. Everything OFFERED (P-OFFER), nothing typed. Honest loading/error/empty.
- **`cubeDebt.ts`** — the pure debt lens: `memberLacksLabel` (empty OR code-echoed-as-label ⇒ missing), `dimLabelDebt`/`cubeLabelDebt` (time axis exempt), `debtNote` («N წევრს ეტიკეტი აკლია»). Visibility ONLY — never invents a label, never touches provisioning (§3 mandate).
- **`PromoteMetric.tsx`** — the E2 promotion loop. Shown for a bound STEWARD head (steward-lens gated — a legacy `query` desugars to a steward head even in the author lens, so the affordance is role-gated, not head-gated). Proposes a governed metric (id + bilingual name/unit, unit pre-filled from the resolved measure — pick, never type) and REUSES the existing definition seam verbatim: `upsertMetric` (SAFE-SAVE: `ensure()` hydrates the working copy first, never wiping the catalog) → `saveSemanticCatalog` (PUT + register + palette invalidate). On bless → `onPromoted(id)` → `promoteHeadToMetric` replaces the head with `{op:'source', metrics:[id]}`.
- **`workbenchModel.ts`** — pure helpers: `isStewardHead`/`stewardHeadMeasure`, `withStewardCube` (steward `source(query)` head + CLEARS the tail — a new raw cube is a new table), `promoteHeadToMetric` (head SWAP, tail preserved).
- **`DataWorkbench.tsx`** — the Get block now mounts `<GetHead>`; the promote affordance renders for a steward-lens bound raw head.

**FF-PROMOTE-ROUNDTRIP (flipped, `packages/core/src/data/promote-roundtrip.fitness.test.ts` — TEST-ONLY, no engine src):** the it.todo → 3 biting assertions on a real `ExternalStore`. The invariant holds BY CONSTRUCTION (ADR-046 Addendum 2): a governed BASE metric whose `code` = the raw head's `query.measure` browses through `browseBaseMetric` = the SAME storeObs read the steward `source(query)` head uses → `interpretSpec(governedHead) ≡ interpretSpec(rawHead)`, and the Floor-3 tail is preserved verbatim across the head swap. Home decision: the byte-identity is an ENGINE property (the browse lowering), so it lives in core; the panel proves the PROMOTION SEAM (pure model + the component's upsert/save/replace flow). NO engine src change was needed — the roundtrip is an emergent property of the existing browse, asserted.

**Folded fix — `probe-poffer-filter.mjs`:** added the «პირობის დამატება / Add condition» click before reading the offer (the Wave-A2 DUTY-0 root cause: a fresh Filter has zero conditions → no FieldPicker until a row is added; the old probe read an empty offer and mis-signaled a product gap).

**Gates (parsed):** panel vitest **1110 passed | 0 failed** (151 files; baseline 1085 → +25: workbenchModel +4, cubeDebt, GetHead, RawCubePalette, PromoteMetric, DataWorkbench +4) · `tsc -b apps/panel` EXIT 0 · `pnpm eslint` clean on all changed files · core `promote-roundtrip.fitness` 3/3.

**LIVE WALK (:3013, `probe-0084-raw-cube.mjs`, admin) — GREEN.** Synced (`dev-watch-panel.sh --once`). STEWARD lens: workbench opens · the «ნედლი კუბები» tab is present · the cube list renders · a cube browse → **200 REAL observation rows** · add a Filter step → «მეტრიკად დაწინაურება» → **the head became governed (the promote affordance disappeared) AND the promoted metric appears in the palette** (`palettedMetric:1`) · **consoleErrors: []**. AUTHOR lens (fresh session): **the raw-cube tab count is 0** (FF-AUTHOR-NO-QUERY live). Steward-plane raw codes (`adjara/AGRI/GVA/_T`) are EXPECTED there (the plane law). Shots → `work/authoring-truth/0084/`.

**MEMBER-LABEL DEBT INVENTORY (§3 deliverable — surfaced live, ledgered for the steward/provisioning):**
- **REGIONAL_GVA** — a dim with **8 members lacking a governed label** (the `მხარე` R/U-class gap).
- **ACCOUNTS_SEQUENCE** — a dim with **8 members lacking a label**.
- **GDP_ANNUAL** — a dim with **8 members lacking a label**.
- GDP_AGRI — no label debt (all members governed).
These are a **cube-profile / provisioning governance gap** (the codelists ship without member labels), NOT a panel defect — the panel now makes them VISIBLE to the steward who can fix them, per the DQ spirit. Fix belongs in provisioning (populate the codelist member labels), NOT here.

**FINDINGS ledgered (for the lead / architect):**
1. **Raw-cube store ROUTING is first-store fallback (apps-only boundary).** A steward `source(query)` head carries no `dataSource`, so `specDataSource`→undefined → `resolveStore` falls to the FIRST live store (the page's active cube). On the regional page the browse therefore reads the page store (`GDP_AGRI` in the walk) regardless of WHICH cube the steward picked from the list — correct when the picked cube IS a session source, but a cross-cube pick reads the wrong store. Honest cure needs either the picked cube added to the live descriptors (session-scope change) or an engine seam to scope a raw query head to a named dataset — engine/session, NOT this apps-only wave. The cube LIST (governance visibility + the debt inventory) is correct for ALL cubes; only the live BROWSE is page-store-scoped.
2. **The promoted metric's `dataSource` = the active dataset** (the browse's effective store), so byte-identity holds at runtime (both the raw head and the governed ref resolve through the same store). This is the honest consequence of finding 1.
