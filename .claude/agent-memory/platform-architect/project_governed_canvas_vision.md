---
name: governed-canvas-vision
description: AR-49 — the authoring reconception umbrella (metric-first Governed Canvas); sequences AR-40/10/11/4/46/47/48
metadata:
  type: project
---

**AR-49 "The Governed Canvas"** — the authoring-paradigm reconception vision I authored 2026-07-09 (owner mandate: study the best JSON-rendering platforms, own the unclaimed market gap). Doc: `docs/architecture/proposals/SPEC-authoring-reconception-vision.md`.

**Thesis:** the unclaimed quadrant = *statistics-grade AND non-programmer-authorable*. LookML/Malloy power × Builder.io/Notion simplicity × ONS/Eurostat integrity. Retire the disliked 3-step wizard (Data→Site→Pages) for a **metric-first document-canvas** — content-first, bind-progressively.

**The load-bearing move:** define-vs-curate as a ROLE, not a step. Modeling (query/pivot/cube) → steward's **Model** mode; author **Composes** by picking governed nouns from the semantic layer, never a query. The wizard failed because it was a role boundary masquerading as a linear step (root = role-conflation, not step-ordering).

**Why it fits our code:** arrow unchanged, rides existing seams. Only new vocabulary = one additive PropSchema type (`metric-ref`/`dimension-ref`). Semantic layer (AR-40) IS the simplicity engine.

**Key refusals (hold these):** reject Cube.dev/Malloy as a *runtime* (SQL-assuming → breaks Law 5 `fromSDMX`-only + Law 2); adopt the *concept*, grow AR-40. Reject adopting Puck as the engine (would bend our schema → breaks Config=SSOT); keep our canvas, steal its ergonomics. Retire dead react-admin CRUD fork.

**Milestones:** M0 (semantic layer + Metric Palette) **BUILT**; M1 (the "Studio" shell — one canvas-always-home + Webflow activity-rail Insert·Data·Layers·Pages&Site·Style·Model🔒 + Framer top bar; wizard DELETED, react-admin RETIRED, `notify` port on MUI Snackbar) **BUILT** (2026-07-09). **M2 DESIGNED** (2026-07-09, `SPEC-authoring-reconception-M2.md`, owner sign-off pending): Model mode + **Steward-as-a-LENS** (not RBAC/auth/MT). Role = persisted `author|steward` read through ONE `useRole()` selector (default author); unlocks the `Model🔒` slot as a surface over the SAME canvas; auth-claim binding PRESERVED not built (AR-30-style swappable seam). Model mode = in-tool **metric authoring** (pick dataset→raw measure via `cubeApi.profile`, unit pre-fill, governance form, immutable id) + the RELOCATED raw modeler (`DataModelingPanel` leaves the M1 Data-surface "Advanced" disclosure → Model; Author Data surface becomes Metric-Palette-only). **KEY GROUNDED FACT (durable):** the persistence round-trip ALREADY WORKS end-to-end — `PUT /api/config/site` accepts arbitrary keys, `site_config.metrics/dimensions` is the one governed catalog SSOT (M0 decision, NOT publish-versioned), `GET /api/bootstrap` already reads+delivers them, `registerManifestMetrics/Dimensions` already registers. So M2 = AUTHORING half only (role lens + Model surface + Metric Editor + `saveSemanticCatalog()`), apps/panel-only, NO contracts change, NO required api change, arrow unchanged. **Calc/measure-algebra editor DEFERRED** (`MetricCalc` runtime already live; only authoring UI waits → M2.5/M3). 5 sub-Ms (M2.0 role-lens ⭐first · M2.1 relocate modeler · M2.2 Metric Editor · M2.3 integrity · M2.4 dimension curation), 6 FFs. Grounded fact: panel path is `platform/apps/panel/src` (NOT `apps/panel`).

**How to apply:** this is the umbrella that SEQUENCES AR-40/10/11/4/46/47/48 (see [[benchmark-corpus]]). At Leader's Scans, treat AR-49 as the north-star the authoring cards serve; don't re-propose sub-parts. Enabled-later by AR-31/36/41/43/44/28.
