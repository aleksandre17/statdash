---
name: authoring-reconception
description: Owner-mandated holistic reconception of the panel/authoring platform — vision-first, market-differentiating, existing code adapts to the new concept
metadata:
  type: project
---

Owner launched (2026-07-09) a bold, holistic reconception of the authoring platform (`apps/panel` + config/plugins/styles): UI **and** functionality **and** conceptual model **and** architecture — one initiative, not three. Frame: study the best JSON/declarative-rendering platforms, extract concepts, and build "something that does not yet exist on the market — powerful yet simple, for non-programmers."

**Why:** Owner wants a market-leading, differentiated Constructor, not incremental gap-patching. Explicitly asked the lead to be innovator/leader/ideologue.

**How to apply:**
- **Vision leads, existing adapts** (Law 7 / Strangler-Fig) — do NOT constrain the concept to fit current code; reshape code to the concept. Owner said this directly.
- Owner **dislikes the current 3-step Data→Site→Pages wizard** ("doesn't fit") — the authoring paradigm is open for total reconception, not tweaking.
- Open to adopting best-in-class packages IF they strengthen **and** simplify simultaneously (his central tension: power + simplicity).
- Working assumptions in play: single-tenant-first (Geostat) with MT seam preserved not built ([[project_mt_deferred]]); brand/visual identity is ours to propose.
- Sequence: vision/concept proposal (platform-architect, Opus) → owner sign-off → detailed architecture → phased Strangler-Fig build. Authoritative artifacts: `docs/architecture/proposals/SPEC-authoring-reconception-vision.md` (AR-49) + `ARCHITECTURE-REGISTRY.md`. Recon confirmed `apps/panel` is already a mature ~19k-LOC schema-driven builder — this is refactor+reconceive, not greenfield.

**STATUS (2026-07-09): direction LOCKED.** Owner explicitly delegated all reversible technical decisions to the lead ("you are the leader now"). Lead DECIDED: (1) vision APPROVED — metric-first "Governed Canvas" + Model/Compose role split (the 3-step wizard's root flaw = role-conflation, not step count); (2) first milestone = **M0: semantic layer + metric palette** (complete AR-40 → browsable governed metric catalog + additive `metric-ref` PropSchema + bind-to-metric affordance; additive/reversible, breaks nothing); (3) brand **"Strata"** adopted provisionally (rebrand = token preset = data not code, so trivially changeable — not gating). Key law guard: grow OUR SDMX/OLAP-native semantic layer, REFUSE Cube/Malloy as a runtime (breaks Law 5 fromSDMX-only + Law 2).

**M0 BUILT (2026-07-09)** — all 11 items shipped additively across 6 parallel agents in 3 waves + a root-cause fix; chief-engineer verdict SHIP-WITH-FOLLOWUPS; converged gate green (full 2675 tests, 0 fail; core 714 / react 501 / geostat-render 127; lint 0; tsc clean). Delivered: `DimensionDef` catalog (peer of `MetricDef`), `metric-ref`/`dimension-ref` as additive `enum-ref source:'metrics'/'dimensions'` (no new PropFieldType), Metric Palette + bind, provisioning seed (6 dims, 17 metrics), chart `data.query.measure` picker, FF-BIND-PARITY. Root-cause fix: KPI read now honors metric default-dims via shared `mergeMetricDims` (chart≡KPI). Committed to a feature branch (NOT pushed — awaiting owner). **Open follow-ups** (in AR-49 registry Next): (a) KPI inline per-item metric-ref needs core `itemSchema`; (b) `dimension-ref` needs a `resolveDimensionRef` lowering seam before shipping a picker; (c) retire panel `CatalogDimension` mirror → engine `DimensionDef`; (d) section-fed chart picker (M1). **Next milestone M1:** dissolve the 3-step wizard + retire react-admin — designed as "The Studio" (`SPEC-authoring-reconception-M1.md`; canvas-always-open + summonable icon-rail, role-as-lens; 4 sub-milestones M1.1 retire-react-admin → M1.2 shell → M1.3 re-home+delete-wizard → M1.4 Strata skin). Deferred (out of M0): brand "Strata" theme-editor build.

**⚠ M0 LIVE-BOOT DEFECTS (found 2026-07-09 via owner's "see it live"):** M0 passed all tests + QC but was non-functional in the running panel — (A) panel had no metric-registration boot seam (empty palette live), (B) `main.tsx` missing `i18next.init()` (Page step white-screens). Components proven correct in a harness. Fix + regression guards + real-boot smoke in flight (senior-frontend, opus) before M0 is truly DONE and before M1.1 starts. Lesson recorded: [[panel-live-boot-verification]]. M1.1 PAUSED until M0 works live.
