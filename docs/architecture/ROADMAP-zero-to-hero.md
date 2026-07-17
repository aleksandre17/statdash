# ROADMAP — Zero → Hero: the ONE master plan of the statdash platform/framework

**Owner mandate (2026-07-15):** "finish it as ONE body — a 0→100%, platform/framework-grade, conceptual, architectural, canonical, principled whole."
**This is the single stitching document.** Depth lives in: `proposals/STUDY-authoring-canon-circle-break.md` (AR-52, the product canon + waves) · `proposals/CONCEPT-power-of-the-core.md` (AR-53, the conservation law) · `audit/DEEP-2026-07-15-*.md` (the five-lens ground truth) · ADR-041/042 (the settled substrate) · `ARCHITECTURE-REGISTRY.md` (every parked vision, nothing lost).
**Standing discipline (binding):** WIP = 1 stratum · a stage closes only on its JOURNEY/PROOF walked live · every close is deployed and SHOWN to the owner · new ideas mid-stage get registry cards, never build slots.

---

## THE END-STATE — what "hero" means (the final Definition of Done)

The platform is DONE at 100% when all seven hold, each machine-verified:

| # | Hero property | Proven by |
|---|---|---|
| H1 | **A non-programmer authors end-to-end:** onboards raw data → governs a metric → composes pages → binds by governed nouns → restyles → publishes — without touching code or JSON | journeys `FF-JOURNEY-J1..J6` green in CI, walked live |
| H2 | **The canvas and every surface never lie:** live truth by default; unbound/no-data/error/masked are declared, projected states | `FF-CANVAS-NEVER-LIES` + the `Cell` state grammar end-to-end |
| H3 | **Every published number explains itself:** what am I · am I real · who may see me · where do I come from (lineage to the release) · who verified me | the EXPLAIN projection + `Publishable` identity + lineage-as-a-read |
| H4 | **A new capability is ONE declaration** (element, facet, residence, metric, recipe, source-adapter) — zero new mechanism, visible on every surface automatically | ADR-041/042 suites + `FF-NO-UNPROJECTED-DECLARED-FIELD` |
| H5 | **A second tenant renders zero-code** (the platform ≠ the Geostat app; brand/content fully config) | ADR-0026 Phase C proof: a different-dims/pages/brand site boots from config alone |
| H6 | **The truth is held by machines, continuously:** executing CI runs unit + DB-gated + e2e + journey walks on every push; adoption gaps are RED builds | Tier-0 pipeline + corpus meta-FFs |
| H7 | **Statistics-grade integrity throughout:** confidentiality masked at the cell, additivity guarded on every path, vintages/revisions queryable, WCAG 2.1 AA | engine F7/F4 closed · SDMX suite · a11y e2e |

---

## STAGE 0 — the floor: the gate RUNS *(the only item outside wave order — nothing above it is evidence until it lands)*
Resurrect CI so a red commit is caught by the machine, not by an agent's memory. **Config-correct (card 0077, 2026-07-15):** dead `@geostat/*` filters → `@statdash/*`; `lint` + panel typecheck added; unit coverage confirmed complete; the **fresh-migrate V33 hazard** flagged (ADR-035 — a pristine CI Postgres migrating V1→V39 may die at V33; the true work of Stage-0). **Deferred honestly:** the 12 e2e + J1–J6 journey walks land as a second CI job AFTER the base pipeline proves green (not authored blind).
**⛔ The blocker — an owner door:** `gh` unauthenticated + no local Docker → the gate cannot be *proven green* from here. Turn the key: `gh auth login` + push & watch (lead iterates on V33), OR a Docker runner. *Awaiting owner's word.*

## STAGE 1 — the authoring canon lands: AR-52 waves W1–W5 *(the current stage)*
Each wave hardened by AR-53's conservation moves (they ride, they don't add strata).

> **⚠️ One cross-wave architectural invariant (lead sharpening, 2026-07-15 — the deepest five-lens finding, system-lens I-1):** **STATE** (W1's `Cell` grammar) and **PLANE** (W3's PropSchema audience axis) are the ONE declaration's TWO missing orthogonal axes — not two unrelated efforts. They must share ONE "declared axes" design so every surface projects both from the same contract, never two half-declarations that later collide. W1 lays the STATE axis to a shape that PLANE extends cleanly in W3 (same declaration model, same projection law). The lead holds this seam across the two waves.

- **W1 · Honest Canvas** — 🔨 ~60% landed (live-default + veil + unbound-KPI affordance committed; `FF-CANVAS-NEVER-LIES` biting). **Remainder routed on GO:** the engine `Cell{value,state}` seam (designed from both sides) closes no-data/true-0 + `{token}` honesty; brand-into-manifest closes chrome faithfulness; dev-image rebuild makes it all felt on :3013. Closes on **J3**.
- **W2 · Semantic spine lived** — front-door onboarding · dictionary→canvas drag-bind · **corpus migrated to metric handles** (adoption meta-FF makes "mechanism without consumer" a RED build) · catalog write-time validator + mutation audit · the `metric:` reactive-graph edge (steward edits invalidate correctly). Closes on **J1+J2+J4**.
- **W3 · Inspector as instrument** — D4 facet tabs · the **PLANE axis declared on PropSchema** (author/steward/system) and projected generically (kills the `_xDim`/crumbs leak class forever) · zero raw-object escapes · studio i18n. Closes on **J5**.
- **W4 · Manipulate lands** — ADR-042 Slices 1–2: one dnd-kit transport (⚠️ the flagged one-way flip, revert-net + record) · `placePart` on canvas/navigator/palette · keyboard move (WCAG) · dead-strata sweep (FilterBarControlsBridge, walkNodes, stale D3 fitness). Closes on **J3-with-restructuring**.
- **W5 · Publish closes the loop** — built on the **ONE `Publishable` identity** (page/version/snapshot/embed/release — designed in Stage 1, its substrate here) · `release_id` stamped to the pixel · draft→publish→public-render walked. Closes on **J6**.

**Stage-1 gate:** all six journeys green in CI + the owner has SEEN each wave land on :3013.

## STAGE 2 — the conservation horizon: the un-copyable powers *(one at a time, each with a real consumer)*
1. **H-EXPLAIN — the reader-facing crown:** cite · methodology · provenance narrative · JSON-LD Dataset · a11y narration, ALL projected from the one declaration (no second subsystem). This is the NSO differentiator no reference platform ships.
2. **H-CATALOG — governance grows a real home:** semantic catalog blob → relational (expand-contract, the flagged one-way; triggered by the first real lifecycle/certification need) + definition vintages (certify/deprecate) — the platform vintages its *meanings* like its *facts*.
3. **H-LINEAGE — every number traces as a READ:** the config↔stats referential spine + materialized lineage view, bronze→pixel.
4. **H-INTERACT — the grammar of interaction completes** (AR-42 P3/P4): declared brush/drill/link authored visually.
5. **H-RECIPES — governed derivation for non-programmers** (AR-49 M3.1+): recipe library lowering to governed calc-metrics.

## STAGE 3 — the framework proof: platform ≠ product
1. **P-TENANT — the second tenant, zero-code** (ADR-0026 Phase C): different dims/pages/brand renders from config alone. *The definition of "we built a platform."*
2. **P-SDK — `@statdash/declare` published** (AR-46; `describeApp()` is ~90% there): a third party ships a node/spec/metric/source-adapter without touching the engine. Gated on a real external consumer.
3. **P-TEMPLATES — templates as semantic projections:** a template is a declaration binding governed nouns (the Figma-instance move); the gallery becomes a growing, governed asset.
4. **P-SCALE — only on real triggers** (each has a preserved seam, none built speculatively): multi-tenancy (AR-30), SSG/ISR pre-render (AR-28), SDMX-REST public API (AR-33), MUI→Radix exit.

**Stage-3 gate = the HERO CHECKLIST above, all seven green.**

---

## Re-entry rule for everything parked
The registry holds every deferred vision with a reason. After each stage-close, the lead re-scans the registry ONCE and admits at most the next ONE item whose trigger is now real. Nothing re-enters mid-stage.

## Where we stand today (2026-07-15)
Substrate ✅ (ADR-041/042) · Canon blessed ✅ (Law 11) · Five-lens ground truth ✅ · W1 ~60% (remainder designed, routed on GO) · **Stage 0 + W1-completion awaiting the owner's word.** Everything after that flows in the order above, one body, to the hero checklist.
