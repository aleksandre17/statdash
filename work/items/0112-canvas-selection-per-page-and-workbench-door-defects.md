---
id: "0112"
title: "Owner triple-report (2026-07-22 evening): canvas clicks only on GDP page(?) · pipeline-node workbench opens EMPTY · exiting the workbench makes the visual VANISH"
status: ready
class: G
priority: P0
owner: lead → chief-engineer (repro) → root-cause → fix
links:
  - work/items/0109-canvas-editor-freeze-and-active-area-misplacement.md   # closed today — different root; re-check per page anyway
  - work/items/0104-data-workspace-unification-and-capability-restoration.md
---
**Goal** — Owner (verbatim): «მგონი მარტო ჯდპ-ის გვერდზე მუშაობს კანვასი. დანარჩენებზე რომ გადავდივარ არც ეკლიკებათ. და ისეთ ნოდებზე რომელსაც პაიპლაინი აქვს, რომ შედიხარ იქ მონაცემი არ გხვდება წორკბენჩი. რომ გამოხვალ კიდევ ქრება ვიზუალი». Three symptoms:
- **S1** canvas selection allegedly works ONLY on the GDP page; other pages don't take clicks at all. (Today's 0109 re-verify passed 5/5 on REGIONAL — so either stale bundle on the owner's browser, a per-page difference, or a navigation-order effect. Reproduce across ALL pages, fresh + after switching.)
- **S2** a node WITH a pipeline spec → enter its data (inspector door → workbench) → the workbench shows NO data. (Suspect the inspector-door path — `DataFacetField` keeps the lazy workbench + seeds differently than the Specs floor; also the E0 draft-store rehydration.)
- **S3** exiting the workbench back to the canvas → the node's VISUAL disappears. (Suspect today's E0 api-actions reshape / draft-optimistic state clearing the in-session spec — a possible SAME-DAY regression; treat as top suspect and check pre-E0 behavior in git if needed.)

**DoD** — per-symptom repro verdict (incl. exact page/node/gesture) → root cause (file:line; explicitly answer "did today's E0/E1/0109 commits cause S2/S3?") → root fix → guard → live re-walk → owner confirms.

## Repro dossier (chief-engineer, 2026-07-22 evening · read-only Playwright walk · :3013 @ main 74f0ab59)

**Environment note:** :3013 is a Vite DEV server (HMR, `/@vite/client` + `/src/main.tsx`) — no hashed prod bundle, so "bundle hash" ≠ applicable. Session auth was live (no login needed). `packages/*` (`@statdash/engine`,`@statdash/react`) are baked into the image (dev-deploy-topology-gap); the 0109 fix was confirmed LIVE by direct DOM probe (16/16 single `display:contents` anchors, non-degenerate frames on the boot page). Screenshots → `work/authoring-truth/0112/`.

### S1 — canvas selection per page · VERDICT: REPRODUCED, RACY (timing-dependent, NOT per-page-deterministic)
Not "GDP works, others don't" — it's **"the boot page + whichever page you land on with enough content-size change works; sparse/just-navigated pages frequently render 0 clickable frames."**

Mechanism (proven live): the overlay's node frames are re-measured ONLY by (a) a `useLayoutEffect` keyed to `page`/`chrome` change and (b) a `ResizeObserver` on the canvas scroll-parent + `window.resize` — `platform/apps/panel/src/canvas/CanvasOverlay.tsx:328-336` (`measure` deps `[page, onSelectItem, chrome]` at :326). On in-app navigation the layout effect measures BEFORE the destination page's async (live-mode) nodes stamp their `data-part-node-id` anchors; the observed scroll-parent's border-box does NOT change when inner async nodes later resolve (scrollHeight grows, border-box doesn't), so **no re-measure fires** → `frames=[]` → zero `button.canvas-node` overlay targets → clicks land on bare `DIV.canvas-root` and select nothing.

Page × result matrix (in-app nav via bottom page chips, measured ~2.2s post-nav, no manual resize):
| Page | anchors | node frames | selection |
|------|---------|-------------|-----------|
| regional (BOOT) | 16 | 16 non-degenerate | ✅ click → `canvas-node--selected` |
| gdp (nav) | 20 | 20 (4 are hidden chart/table-toggle tables @4×4) | ✅ (when frames present) |
| gdp (nav, other pass) | 20 | **0** | ❌ raced-out (repaired by any `resize`→20) |
| accounts (nav) | 10 | **0** on some passes / 10 on others | ❌/✅ oscillates |
| landing (nav) | 3 | **0** | ❌ (sparse page — parent size never re-triggers RO) |

Determinism: **RACY.** Same page (accounts) yielded 0 frames and 10 frames on different navigations in one sweep; firing a single `window.resize` deterministically repaired 0→N every time. Owner's "only GDP works" = GDP is the largest page (20 nodes) so its post-nav content growth most reliably perturbs the scroll-parent box → RO fires → frames measured; sparse pages (landing/accounts) don't perturb it → 0 frames → "არც ეკლიკებათ".

Same-day answer for S1: **exposed, not caused, by today.** The measure/re-measure logic (CanvasOverlay:328-336) was NOT modified today — d56c65a2 (0109) changed only the box-*resolution* lines (:252/:273/:317, `resolveAnchorBox`), not the re-measure *trigger*. Before 0109 every live-page frame collapsed to 0×0 globally, so this residual race was moot (nothing was clickable anyway). 0109 restored geometry and revealed that the overlay still has no re-measure signal keyed to async-node population / page-content-settle. Fix direction: re-measure on a signal tied to node render completion (e.g. a MutationObserver on the canvas root for `data-part-node-id` subtree changes, or observe the canvas CONTENT element not the fixed scroll-parent, or a rAF/settle re-measure after `page` change). Screenshots: `s1-regional-01-initial.png` (works), `s1-accounts-01-navigated.png` + `s1-accounts-02-zero-frames.png` (0 frames → click hits `canvas-root`, nothing selected).

### S2 — pipeline node → workbench EMPTY · VERDICT: REPRODUCED, DETERMINISTIC
Gesture: gdp → select the visible production chart (canvas node `production-0-0`) → inspector Data facet → "გახსენი ვორქბენჩი" (`open-data-workbench`). Result: the three-pane opens but the grid reads **"აირჩიეთ მართული მეტრიკა მონაცემების სანახავად"** (0 rows), left rail = "წყარო — აირჩიეთ მეტრიკა" (unbound metric palette). The facet summary itself already read `summary-unbound` ("მონაცემები ჯერ მიბმული არ არის") for a chart that VISIBLY renders a GDP donut.

Root cause (config-proven): the persisted gdp config (`/api/config/pages/4590ce20-…`) has **no node `production-0-0`** — that id is synthesized by the canvas for the section's chart child. The DATA lives on the parent **section** as an inline `query` DataSpec (aggregate→rollup→derive→lookup→sort, `filter.approach=PROD`, `measure:'*'`). The section's single child is a `wrap` whose chart+table VIEWS are **data-less** and render from the section's shared data. Whole-page scan: **all 8 sections own `query` data; all 16 render nodes (8 chart + 8 table) are data-less inheriting children.** So `DataFacetField` receives `value = props.data = undefined` for the selected chart → the summary/door are a generic projection of the chart element's declared `data` field, which is empty in this composition → workbench opens on `adoptOnOpen(undefined)` = a fresh unbound `freshPipelineSpec()`.

Door-vs-owner comparison (the meaningful one — these are INLINE specs, not named specs, so the Specs floor holds no equivalent): selecting the data-OWNING section (`production`) exposes **no** Data facet and **no** door — only `onboard-data-cta`. So the canvas offers the (broken) data door on the data-LESS child and offers NO door on the data-OWNING section. The DATA-facet projection sits on the wrong element in the containment hierarchy (Law 10 / ADR-041): `platform/apps/panel/src/inspector/controls/DataFacetField.tsx` (unbound branch :153-159, door :162-173) + `dataFacetModel.ts:35-37` (`adoptOnOpen(undefined)→freshPipelineSpec`). Screenshot: `s2-gdp-production-workbench-empty.png`.

### S3 — visual VANISHES on exit · VERDICT: REPRODUCED, DETERMINISTIC, in-session-only (NOT persisted)
Gesture: gdp → select production chart → open workbench door → **make NO edit** → back to canvas. Result: `production-0-0` renders **"მონაცემები არ არის / empty.desc"** (a leaked i18n key), chart body collapses 311→203px; the untouched sibling still renders. Top bar flips to **"Draft" + "Unsaved changes"**.

Root cause: `DataFacetField.openWorkbench` (DataFacetField.tsx:108-126) runs `const seed = adoptOnOpen(spec); if (seed) onChange(seed)` **on OPEN**. For a data-less child `spec===undefined` → `adoptOnOpen` returns `freshPipelineSpec()` (`{type:'pipeline',pipe:[{op:'source',metrics:[]}],…}`) → `onChange` WRITES that empty spec onto the child's `props.data`. That now-present-but-empty own-data **shadows the inherited section data** → the chart renders no-data. It is a mutation-on-open with no edit — the door is not a live read path, it's a destructive write (Law 11: "the canvas never lies" — a look-only gesture fabricates a no-data state).

Persistence check: **in-session only.** Hard reload restored the donut and cleared "Unsaved changes" (`s3-gdp-after-reload-restored.png`). The write hits the constructor PAGE store (in-memory); E0 deleted the debounced auto-PUT, so nothing durably persists until an explicit save/publish. The dataSpec draft store stayed `{}` (that store is for named specs, not inline node data). Screenshots: `s3-gdp-production-vanished-after-door.png` (vanished + Unsaved chip), `s3-gdp-after-reload-restored.png`.

### Same-day-regression verdict (explicit)
- **E0 (2fed78e7) / E1 (825e1e68) did NOT cause S2 or S3.** Neither touched `DataFacetField.tsx`, `dataFacetModel.ts`, `focusEscalation.tsx`, or `CanvasOverlay.tsx` (git-verified). The destructive-seed + unbound-facet-on-inherited-data logic is PRE-EXISTING (DataFacetField last: `e1c99afd` ADR-051 DU3; adoptOnOpen last: `6ffe97df` ADR-049 P2a). E0 in fact **mitigated** S3 by removing the auto-PUT → the corruption is now transient, not persisted.
- **0109 (d56c65a2) is the EXPOSER of all three.** It restored whole-node frame geometry, which made the data-less inheriting chart/table children selectable again (before, all frames were 0×0). Selectability → the unbound facet + destructive door (S2/S3) became reachable, and the residual measure-race (S1) became visible. 0109's own fix is correct; it uncovered two older latent defects (S2/S3) and one older latent race (S1) that its predecessor bug had been masking.
- Net: **one 0109-exposed re-measure race (S1)** + **one pre-existing containment/projection defect with two faces (S2 empty door, S3 destructive-seed vanish)**, all live-reproduced. None is a genuine E0/E1 regression.
