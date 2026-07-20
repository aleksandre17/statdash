# ADR-051 — One Data Workspace. The Source Is Step 0.

**Status:** ACCEPTED (owner-blessed 2026-07-20 — "research the reference-class, build the BEST UI and BEST platform, move faster", FULL autonomy on the direction, card `work/items/0102-canonical-panel-ia.md`, data-fragmentation facet).
**Extends (never forks):** ADR-046 (The Pipeline Is the Spine — the grammar) · ADR-050 (The Canonical Panel IA — this is R6, elevated from "polish" to unification) · ADR-041/042 (object model, untouched) · ADR-034 (semantic query plane). **This ADR adds NO grammar, NO engine object-model change, NO new first-class entity.** It is a *surface-and-residence-of-destination* decision: it retires two parallel authoring doors and one teleport, projecting the ONE spine ADR-046 already settled.
**Source of truth:** `docs/architecture/proposals/STUDY-canonical-panel-ia.md` (data-fragmentation facet, owner 2026-07-20). Honors CLAUDE.md Law 2 (config declarative), Law 6 (root-cause), Law 7 (Strangler-Fig / architecture-leads), Law 10 (one containment grammar), Law 11 (Authoring Canon: data-first, canvas-never-lies).

---

## Context — "one concept, two independent sources"

ADR-046 unified the **grammar**: one `pipeline` DataSpec, a store-aware `source` head as step 0, the pure transform verbs as the tail. That decision is *settled and shipped in the engine*. But the owner's verdict — "one concept, two independent sources; not ready in any aspect" — is correct at the two layers ADR-046 did **not** touch: the **authoring surface** and the **residence of the destination**. Verified against the code (2026-07-20):

- **The Surface is an archipelago.** The rail ships **two** top-level data destinations — `sources` and `model` (`studio/rail.ts:38-45`) — bridged by a one-shot courier store (`store/sourcesHandoff.ts`) that fires a **role-flip + nav teleport** (`SourcesBody.tsx:45-54`: `browseCube()` → `setRole('steward')` → `setSurface('model')`) so the workbench, hosted only behind the Model page's steward lens (`ModelSurface.tsx:89`), can consume the cube on arrival (`DataModelingPanel.tsx:136-143`). Two screens with no shared parent, welded by a fragile multi-step choreography — itself a probable architectural cause of the "constructor gets stuck" symptom (routed to debugger separately).
- **There are literally two spec editors for one spec.** The three-pane `DataWorkbench` (the canonical editor) is mounted, and **directly below it** a second editor — the legacy `DataSpecEditor` — is mounted as a *"Raw editor (advanced)"* accordion in **both** hosts (`DataModelingPanel.tsx:229-241` and `DataFacetField.tsx:199-212`). Two editors, two codepaths, one spec. This is the owner's "two sources" in its most literal form, and exactly the parallel-surface pattern Law 6 forbids.
- **The `source`-is-step-0 truth is buried.** The engine head IS step 0 (the workbench Get card, `DataWorkbench.tsx:176-193`), but at the surface an author never *reads* "pick a source" as the front door: they read two rail icons, or an inspector accordion. The perception model the reference class converges on — a source is step 0 of one editor — is true in the engine and invisible on screen.

The three axes precisely: **Grammar = DONE (ADR-046)** · **Surface = archipelago (this ADR)** · **Residence = inline-vs-named, unbridged (deferred to ADR-052 / Option B)**. This ADR closes the Surface axis. It changes zero stored data and zero grammar; it is the projection ADR-050's governing invariant demands ("a canonical capability unreachable in one place, offered in two, is a defect").

---

## Decision — one workspace; the source is step 0; retire the doubles

**1. One Data workspace.** The `sources` and `model` rail destinations collapse into ONE **Data** destination. Inside it, the dependency arrow is the IA (ADR-046 four-floor ladder made visible): **Sources (raw cubes) → Model (governed metrics) → Pipelines (specs) → the element**. These are *floors of one workspace*, reached by in-workspace selection — never two peer doors, never a cross-screen navigation.

**2. The source is step 0 — as the entry, not just the engine.** Opening the Data workspace, or opening any element's data, lands on the **applied-steps pipeline editor** whose first step is `source`: "pick a source." Picking a cube or a governed metric from the catalog IS choosing step 0. There is no "choose a spec type" screen (ADR-046 already killed the 8-way discriminant `Select` inside the workbench); there is no separate "go to Sources first, then teleport to the workbench" dance.

**3. Retire the second "Raw editor (advanced)" — safely, by absorption then removal.** The parallel `DataSpecEditor` accordion is not deleted while any kind is uneditable. It is first **absorbed** as the workbench's own declared fallback lane (the generic, declaration-driven `SpecBody` dispatch — `DataSpecEditor.tsx:87-110` — is already OCP-clean and reaches every kind's authoring contract by declaration), co-located *inside the one workspace* for kinds the pipeline cannot yet natively shape. Then, kind-by-kind, the non-pipeline discriminants (`timeseries`, `growth`, `ratio-list`, `row-list`) fold into the pipeline via the existing `desugar` SSOT so they open as `source`-is-step-0 pipelines. Only when every kind is workbench-shapeable (`FF-ALL-KINDS-SHAPED`) does the fallback lane demote to a steward last-resort / disappear. **No kind is ever left uneditable.**

**4. Kill the courier.** `store/sourcesHandoff.ts`, the role-flip, and the nav teleport are deleted. Because Sources and the workbench now share ONE parent workspace, "browse this cube" is an in-workspace selection that seeds the `source` step in place — no cross-screen signal, no state the config cannot replay.

**The near-irreversible naming commitment:** *there is one Data workspace; the source is step 0; there is no second "raw editor" and no Sources/Model split-as-destinations and no `sourcesHandoff` teleport.* This is the decision this ADR makes hard to walk back — deliberately, because the reference class is unanimous and the owner has blessed it.

---

## The reference-class basis (Law 4 — adopted whole)

Every leader in this class puts data behind **one workspace with the source as the first step**, never a scatter of parallel editors:

- **Power Query** — the *Applied Steps* rail with **"Source" as the literal step 0**, one editor top-to-bottom, one results-preview grid. We adopt this exactly (our workbench IS this), and *surpass* it with a **per-step** live grid.
- **Grafana panel edit** — **data source → query (builder↔code) → transform → preview**, all one vertical flow in one panel. We adopt the single-flow and the builder↔code duality (our generated-query pane).
- **Retool** — one **query panel**: a query names its **resource** (data source) at its head, then its body; the list of named queries lives *with* the editor, not on a separate screen. We adopt the head-names-its-source model and the co-located catalog (its full reference-binding — component binds a *named* query — is Option B / ADR-052).
- **Looker / Power BI / Superset** — the data hub is one destination with floors (connections → model → explores), reached by drill-in, not by peer top-level doors.

None of them ships two editors for one query, or teleports you between screens to shape data. Our engine already matches their *grammar*; this ADR makes our *surface* match too.

---

## Why this, not the alternatives

- **Option A — One Data workspace + source-is-step-0 + retire the doubles (ACCEPTED).** Pure surface projection of the settled ADR-046 spine. Zero grammar change, zero stored-data one-way door (the only ⛔ is the ADR-046 W-P5 emission-flip, already gated on `FF-PIPELINE-EQUIV`). *Trade-off (ISO 25010):* usability/learnability ++ and maintainability ++ (two codepaths → one) for a sustained-but-revertible projection cost. Satisfies every canon test: ONE containment (Law 10), config-declarative (Law 2), root-cause (Law 6 — it removes the duplicate, not relabels it), architecture-leads (Law 7 — the surface migrates to the spine), and is precisely the reference-class mechanism.

- **Option B — reference-binding + spec-as-first-class-object (DEFERRED to ADR-052).** An element *references* a named pipeline; inline `CanvasNode.props.data` becomes auto-promotable sugar. This closes the **Residence** axis (inline vs named `NamedDataSpec`), touches the object model, and needs its own ADR. It is **complementary, not competing** — sequenced strictly *after* A (surface before residence): once there is one workspace, "this element points at that named pipeline" has a home to point into. Not rejected — scheduled.

- **Option C — relabel / co-locate the two editors under nicer headings (REJECTED).** Symptom patch (Law 6). Two codepaths and the courier survive; the owner is back in the archipelago within a month. Refused.

---

## Consequences + guards

**Positive.** One data home the author can read as the dependency arrow; the source is visibly step 0; one editing codepath (the workbench + its declared fallback lane) instead of two; the fragile teleport (a likely "stuck" cause) is gone; every non-pipeline kind stays editable throughout the transition and ends up shapeable as a pipeline.

**Costs / trade-offs.** Sustained projection work across the rail, the focus-view registry, the two workbench hosts, and the desugar coverage for four kinds (sequenced, WIP=1). Deferred: reference-binding / spec-as-object (ADR-052). Multi-site and per-site shared pipelines remain YAGNI.

**The fitness functions that lock each projection** (protection-layer-first — each lands with its wave, then ratchets):
- `FF-ONE-DATA-WORKSPACE` — the rail exposes exactly ONE data destination; `sources` + `model` are not two peer top-level entries.
- `FF-SOURCE-IS-STEP-0` — every pipeline head is a `source` step, and the workspace/element entry presents "pick a source" as the first affordance.
- `FF-NO-DATA-COURIER` — `store/sourcesHandoff.ts` is deleted; no role-flip + nav teleport bridges Sources → workbench.
- `FF-ONE-SPEC-EDITOR` — `DataSpecEditor` is not mounted as a second parallel editor beside the workbench; the workbench (with its co-located fallback lane) is the sole spec-editing surface.
- `FF-ALL-KINDS-SHAPED` — every DataSpec discriminant either desugars to `pipeline` (workbench-shapeable) or declares a co-located editor; no kind is uneditable.
- Held / reused: `FF-PIPELINE-EQUIV` (the ⛔ gate for any emission-flip or editor deletion), `FF-AUTHOR-NO-QUERY`, `FF-CANVAS-NEVER-LIES`, `FF-ONE-DERIVATION-PATH`.

**The one-way door.** Only the deletion of a codepath (the courier, then the parallel editor) is hard to revert cheaply. Each such deletion is sequenced *after* its replacement is live and walked (Strangler), and the editor deletion is gated on `FF-ALL-KINDS-SHAPED` + `FF-PIPELINE-EQUIV` green. Everything before those deletions is git-revertible.

**Governing-invariant tie-in (ADR-050).** This ADR is the concrete R6 discharge of ADR-050's rule that *a canonical capability offered in two places instead of one is a defect*. The five FFs above are its enforcers so the archipelago cannot silently reopen.
