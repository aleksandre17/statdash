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

**First milestone = M0** (semantic layer + Metric Palette): attacks the data-binding cliff, additive on AR-40 spine, reversible. **M0 BUILT** (2026-07-09). **M1 DESIGNED** (2026-07-09, `SPEC-authoring-reconception-M1.md`, owner sign-off pending): the "Studio" shell — dissolve the 3-step wizard into ONE canvas-always-home + Webflow activity-rail of summonable surfaces (Insert·Data·Layers·Pages&Site·Style·Model🔒) + Framer top bar + selection-contextual right dock; NO gating/waterfall. react-admin RETIRED (dead `<Resource>` fork + AdminContext + dataProvider/i18nProvider; one live `useNotify`→our `notify` port on MUI Snackbar). Adds nothing but the notify port. MUI→Radix exit FLAGGED not ridden (don't fork the design system mid-shell-migration). 4 sub-Ms: M1.1 ra-retire (⭐recommended first, clean/reversible/wizard-untouched) · M1.2 shell scaffold behind `STUDIO_SHELL` flag · M1.3 re-home+delete wizard · M1.4 Strata token skin + writable theme editor (`themeOverrides` via StyleField). Arrow untouched (apps-only). Grounded fact: current panel path is `platform/apps/panel/src` (NOT `apps/panel`).

**How to apply:** this is the umbrella that SEQUENCES AR-40/10/11/4/46/47/48 (see [[benchmark-corpus]]). At Leader's Scans, treat AR-49 as the north-star the authoring cards serve; don't re-propose sub-parts. Enabled-later by AR-31/36/41/43/44/28.
