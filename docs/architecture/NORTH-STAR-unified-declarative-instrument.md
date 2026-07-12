# North-Star — The Unified Declarative Instrument (the lead's synthesis)

> **Status:** VISION / lead's independent synthesis (2026-07-12). Not a task list — the map that makes the map. It names the ONE thing the registered epics are facets of, the reference-class fusion the platform IS, and the gaps I see that no one has yet named. Owner directive: "see the links that aren't visible; bring the core concepts of the reference platforms; do genuine improvement."

## 1. The link that isn't visible: the epics are ONE model, not four
`ARCHITECTURE-REGISTRY` lists AR-40 (semantic layer), AR-41 (reactive dataflow), AR-42 (grammar of interaction), AR-43 (lineage) as separate epics. **They are four FACETS of ONE declared model over the Part substrate (ADR-041):**

| Facet | Question it answers | Declared as | Registry |
|---|---|---|---|
| **Structure** | what exists / what nests in what | Part grammar (`PartField`, port) — **DONE** | ADR-041 |
| **Semantics** | what the numbers MEAN (measure · dimension · grain · unit) | metric/measure declarations | AR-40 |
| **Behavior** | how the user EXPLORES (select → filter/scope/drill) | interaction links between Parts | AR-42 |
| **Provenance** | where a number CAME FROM + as-of-when | lineage / vintage coordinate | AR-43 / AR-36 |

All four are **declared in config (no code, Law 2)**, all four **project generically onto every surface** (render · author · interact), all four are **Parts/relations in ONE graph**. A dashboard is not a page of widgets — it is a *declared instrument* whose structure, meaning, behavior, and provenance are one homoiconic representation, and every surface (the renderer, the Constructor, the explorer) is a projection of it.

## 2. The reference-class fusion the platform IS (the identity)
No single reference platform is the target — the platform is their **fusion, specialized for official statistics**:
- **Builder.io / Puck / Plasmic** — visual builder / registered-component + declared inputs (→ our Constructor + Part grammar). ✔ realized.
- **Vega-Lite / Vega** — grammar of graphics **and interaction** (selection/param) (→ AR-42).
- **Malloy / Cube / LookML** — a governed **semantic layer** (measures, dimensions, grain) (→ AR-40).
- **OpenLineage / dbt** — **provenance** as first-class (→ AR-43).
- **SDMX / ONS / Eurostat / IMF** — the **domain**: data integrity, revisions/vintages, methodology transparency.

**The identity (the SURPASS):** *a declarative instrument grammar for official statistics — statistics-grade (integrity · revision · methodology · governance) AND non-programmer (Constructor, no code).* Generic builders (Builder.io) have no semantics/provenance; BI tools (Superset/PowerBI) are not no-code-authorable-and-agency-grade; notebook tools (Observable) are not for non-programmers. The intersection is empty — that is the moat.

## 3. Gaps I independently see (critical, honest — including in my own recent work)
1. **Port performance is unmeasured.** `enumerateParts` + the overlay's recursion are O(nodes × depth) per selection/render. The interaction layer (AR-42) will multiply enumeration frequency. **Before AR-42 amplifies it, add a perf fitness** (bound enumeration cost on a large/deep page). I built the port; I have not proven it scales. Own it.
2. **There is no explicit composition grammar.** "Homeless content blocks" (a `section.accepts` too narrow to hold hero/text) is a symptom: nesting is ad-hoc `accepts` lists, not a principled **capability graph** (what-nests-in-what, derived). Notion/Webflow have a clean nesting model; we have hardcoded lists. Design `accepts` as a capability graph over caps, not per-type lists.
3. **The semantic layer (AR-40) is the keystone — a SEQUENCING insight.** AR-42 (interaction: select → filter/**re-base a measure**) and AR-43 (lineage of **measures**) both DEPEND on a solid semantic model. **AR-40 should co-develop with or precede AR-42**, not follow it — else interaction is built on ad-hoc measures and re-forks the semantic seam. (Flagged to the AR-42 design.)
4. **Fitness functions are scattered, not an instrument.** We have many FFs (the evolutionary-architecture canon, Ford/Parsons) but no continuous **architectural-health surface**. The dogfood move: render the platform's own invariants THROUGH the platform (the instrument measuring itself).

## 3b. The two contract axes: Parts ⊥ Facets (the authoring-completeness root)
Every element declares its contract along TWO orthogonal axes, and full authorability requires BOTH be generic + declared + projected:
- **Parts** — *what constituents it contains* (`PartField`s: slot/value/sourced). Projected by `element.schema`. **DONE** (ADR-041 Ph.1–6: the Part port, one `PartAddress`).
- **Facets** — *what universal capabilities it exposes* (**style · data · events · visibility · chrome**). Today declared as bare TS structure on `NodeBase` (`view.styles`/`.data`/`.on`), NOT a projectable authoring contract → the dock can't recurse → hand-wired one-offs or absent. This is the root of the four felt authoring gaps (chrome not clean · no full per-element management · data-pipe buried · no per-element style).
**The fix (SPEC-deep-authorability-completion):** a `FacetDescriptor { id, appliesWhen(meta), contract, readPath }` registry → six generic dock projections (content · style · data · events · visibility · chrome), `appliesWhen` reading a cap/declared-field (never a concrete type; rich facets get rich controls via the `FieldControlRegistry` dispatch). `inspect(el) = projectParts ⊕ projectFacets` — the generic-projection law (ADR-038) applied to BOTH axes. Elevates ROOT-4 (Facet) from a render-side opt-in to a declared authoring contract. Reference class (Webflow/Framer/Builder/Figma) = fixed facet tabs opted-in by declaration; ours + a declared-data moat.

## 4. The trajectory (several moves ahead)
Structure (done) → **Semantics (AR-40, the keystone)** → **Behavior (AR-42, the explorable leap)** → Provenance (AR-43, the statistics moat), each a declaration on the one substrate, each projecting to every surface. The end-state is not "a better dashboard tool" — it is *the instrument by which an agency declares, publishes, and lets anyone explore official statistics, with integrity and provenance built in, authored by non-programmers.* Everything is measured against that.
