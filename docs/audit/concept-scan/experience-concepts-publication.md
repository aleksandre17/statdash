# Experience Concepts — §4 Publication / narrative concepts

> Cards EXP-11..13. Index + grounding + ranking: `experience-concepts.md`. Analysis only.

---

### [EXP-CONCEPT-11] Story points — guided perspective tour (Tableau story points)
- **What it is** — Tableau **story points**: an authored *sequence* of dashboard states with captions, a
  guided narrative the reader steps through. For a statistical agency this is the "data story / bulletin
  walkthrough" format.
- **Does it strengthen US? — STRENGTHEN (publication fit).** A national-accounts release IS a narrative
  (headline → drivers → regional detail → methodology). A story = an *ordered list of perspectiveState
  snapshots + captions*.
- **Fit** — **rides perspectiveState + permalink directly**: a story point is literally a saved
  `Record<param,activeId>` + a caption; "next" applies the next state. Near-zero new substrate — a thin
  authored sequence over the view-algebra we already shipped. A textbook payoff of the Perspective Lattice.
- **FULL-adoption plan** — core: a `StoryPoint[] = { state: Record<param,id>; caption: LocaleString }[]`
  carrier on the page; applying a point = setting perspectiveState (the existing writer). react: a story nav
  shell (prev/next/dots) driving perspectiveState; each step permalink-addressable (free). panel: author
  points by "capture current view + caption" (capture = read perspectiveState). api: the JSON/embed target
  serializes story state. **Fitness:** "each story point's state round-trips through the permalink"; "applying
  a point yields the same render as navigating to its permalink" (the two paths can't diverge). a11y: story
  nav is an APG pattern (EXP-09); reduced-motion suppresses transitions.
- **Effort S/M · two-way · Class M · P3→P2.**
- **Raises-the-bar** — story points as **permalink-addressable view-algebra states** (each step a real
  shareable URL, every panel live, not a screenshot) — Tableau story points are captured snapshots; ours are
  live, composable, deep-linkable.

---

### [EXP-CONCEPT-12] Annotations & threshold-bands — data-driven, authorable (Grafana)
- **What it is** — Grafana **annotations** (event markers on a time axis: "policy change", "rebase year") and
  **thresholds** (reference lines/bands: target, recession band). We have *static chart annotations* in the
  neutral output (`ChartOutput.annotations`, `annotationUtils.ts`) — but not a *data-driven, authorable* layer
  (no Inspector surface, not bound to data/events).
- **Does it strengthen US? — STRENGTHEN (marginal-existing→complete).** Statistical charts need reference
  lines (target/threshold) and event markers (methodology breaks, rebasings) as first-class authored,
  data-bound annotations — currently a render-only primitive.
- **Fit** — rides the existing `AnnotationOutput` neutral primitive + the semantic-token spine (band color =
  token) + the Inspector (author the annotation list generically). Optionally data-bound (positions from a
  DataSpec/`$ref`) — rides the `$ref` taxonomy.
- **FULL-adoption plan** — core/charts: formalize an authorable `Annotation[]` carrier (line/band/point, value
  or `$ref`-bound) feeding the existing `AnnotationOutput`. panel: an annotation editor (rule list via generic
  Inspector; color from token enum-ref). api: none. **Fitness:** "annotation color resolves to a token"; "a
  `$ref`-bound annotation resolves to a valid data position"; a11y: annotation conveyed in the accessible
  table/narrative (EXP-10), not visual-only.
- **Effort M · two-way · Class M · P3.**
- **Raises-the-bar** — annotations bound to the **same `$ref` data taxonomy** as everything else (a threshold
  can be a live metric, not a typed-in number) + token-themed + accessible — a coherent layer, not Grafana's
  bolt-on.

---

### [EXP-CONCEPT-13] Explore / ad-hoc analysis mode (Grafana Explore)
- **What it is** — Grafana **Explore**: a throwaway, non-persisted ad-hoc query/exploration surface separate
  from authored dashboards. An analyst pokes the data without building a page.
- **Does it strengthen US? — MARGINAL.** Audience split matters: useful for *analysts* (fast data poke), but
  our north-star is *citizen-grade authoring of governed pages*, and an ad-hoc mode producing non-persisted,
  non-governed output partly cuts against the "everything is validated config" moat. Honest verdict: **adopt
  thinly, as a launchpad** — Explore as a scratch surface that *generates a page config* (reusing data-first
  generate, CON-12) rather than a parallel non-config artifact.
- **Fit** — rides the live-preview stores + field-wells + `generatePageFromProfile` (Explore = field-wells on
  a scratch page; "keep" → generate a real config). No new substrate; explicitly NOT a second
  non-serializable artifact (avoid the Power-BI-auto-report dialect trap).
- **FULL-adoption plan** — panel-only: a scratch route reusing field-wells + live preview; "save as page"
  routes through the existing generate + save-guard. **Fitness:** "Explore output is a valid NodePageConfig
  that passes the save-guard" (no parallel dialect — same invariant as templates).
- **Effort M · two-way · Class M · P3 (analyst-demand-gated; YAGNI until asked).**
- **Raises-the-bar** — an Explore mode whose output is **first-class governed config**, not a throwaway — the
  opposite of Grafana's non-portable Explore.
