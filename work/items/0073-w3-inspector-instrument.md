---
id: "0073"
title: "W3 — THE INSPECTOR AS INSTRUMENT: D4 facet tabs · PLANE on PropSchema (author/steward/system) · no raw-object escapes · studio i18n"
status: BLOCKED on 0072
class: M
priority: P0
owner: — (senior/apex build agent, Opus)
implements: STUDY-authoring-canon-circle-break §F2/§W3 (Canon C3) — the owner's "right dock" complaint, root-caused
depends_on: ["0072"]
links:
  - docs/architecture/proposals/STUDY-authoring-canon-circle-break.md
  - work/authoring-truth/03-studio.png   # _mark/_xDim/_byDims exposed to authors; "Open presentation.crumbs →"; mixed EN/KA
  - docs/architecture/decisions/ADR-042-authoring-triprojection-and-placement-port.md   # D4 — build as designed
---
**Intent.** Projection ≠ presentation. The dock stays a generic projection of declared contracts (ADR-038/041/042 — untouched) AND becomes a curated instrument: Figma/Webflow-grade. Today (live-probed): every facet section stacks into a form-wall; nested objects escape as "N fields · … → Open" raw-JSON drills; the SYSTEM plane leaks to authors (`vars` = `_mark/_xDim/_byDims/_selKey` derive internals; `presentation.crumbs`) at equal rank with "Title"; studio chrome mixes EN/KA labels.

**The outcome that counts.** (1) **D4 built as designed:** the dock projects facets as a tab-bar derived from `facetRegistry` order + `appliesWhen` (Content · Style · Data · Interactions · Visibility) — one facet visible at a time, existing progressive disclosure within. (2) **Plane on the contract:** one additive `plane?: 'author'|'steward'|'system'` on `PropField` (default `'author'`, OCP); surfaces project by plane — system hidden everywhere by default, steward behind the lens. `vars` + `presentation.crumbs` are the first two fields to move plane. This is the ROOT fix for "nodes don't declare contracts properly": contracts gain the audience axis they were missing. (3) Zero raw-object escapes on the author plane — each becomes a typed sub-editor or changes plane. (4) Studio-chrome i18n completeness — extend the locale-leak fitness to the Studio's own chrome.

**Known facts.** `facetRegistry`/`registerFacetSections`/`dockSectionRegistry` are canonical and built (do NOT re-mechanize the model — ADR-042 D4's own warning). `pageSchemaSource.ts:67` is the `vars` leak. JsonDataField is the escape hatch to retire from author plane.

**Hard boundaries.** No per-type dock code (FF-DISPATCH-NOT-BRANCH); the tab set derives, never hand-authored. Plane is a DECLARATION read generically — never an `if field==='vars'` special case.

**DoD.** `FF-DOCK-IS-FACET-PROJECTION` + `FF-PLANE-PROJECTION` (no system-plane field on an author surface — corpus scan) + locale-leak-studio green · **Journey J5 (restyle element→page→site→chrome) walked live** · deployed · owner shown.
