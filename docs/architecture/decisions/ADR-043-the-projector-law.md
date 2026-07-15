# ADR-043 — The Projector Law (`everySurface(declaration) = fold(applicable projectors)`)

**Status:** PROPOSED (named now as doctrine; owner blesses acceptance later — the build lands after Stage 1, never before Stage 0's gate runs).
**Decision authority:** lead proposes; owner accepts (this is a meta-law above two ACCEPTED ADRs — it must not be adopted as a build stratum by delegation).
**Extends (never forks):** ADR-041 (Part grammar + Part port — the FIRST instance of this meta-model) · ADR-042 (Authoring Triprojection + Placement port — the SECOND instance) · the Facet registry / `registerFacetSections` (ADR-042 D4, `builtinFacets.ts` — the THIRD instance). ADR-041 and ADR-042 STAND unchanged; this ADR names the law they are three un-named writings of, so the fourth writing is a *registration*, not a fourth hand-written fold.
**Source of truth:** `docs/architecture/proposals/CONCEPT-power-of-the-core.md` §2–§4 ("name the Projector meta-model as doctrine now") · `STUDY-authoring-canon-circle-break.md` (AR-52, the sound substrate this sits on) · `audit/DEEP-2026-07-15-system-architecture.md` (system-lens finding: "the unifying law was written three times and never named"). Registry: AR-53 horizon (Projector meta-model build). ROADMAP: STAGE 2 item H-EXPLAIN is this law's first real consumer.

---

## Context — the projector meta-model is written three times and named zero times

The platform already lives by ONE law of form and has never stated it. Three subsystems each independently implement *"a derived surface is a generic projection of the ONE declaration"* — and each stops one level short of naming the meta-model, so the concept keeps **forking one level above wherever it was just unified** (the residual circle STUDY-authoring-canon named):

| Instance | Declaration | The projection engine | Named as a law? |
|---|---|---|---|
| **Part port** (ADR-041) | `PartField`s on `ObjectMeta` | every surface recurses `enumerateParts` → one `PartAddress` | as *the Part port*, not as a projector |
| **Triprojection** (ADR-042) | the ONE Part model `(PartAddress, contract, accept-set)` | Select / Inspect / Manipulate, each `f(the model)` onto every surface | as *three projections*, hand-listed |
| **Facet registry** (ADR-042 D4) | `FacetDescriptor`s (`facetRegistry`) | `registerFacetSections` derives one dock section per facet, no type read | as *a registry*, not as a projector fold |

The tell that the law is unnamed is a **hand-wired binary fold** at the seam where two instances meet:

> **INSPECT `= projectParts(sel) ⊕ projectFacets(sel)`** (ADR-042 D1).

`⊕` here is a *literal two-term expression in code*, not a fold over a set. It works for exactly two inspectable axes. The moment a **third inspectable axis** arrives — **provenance** (the EXPLAIN projection, ROADMAP H3/H-EXPLAIN) or **relationships** (lineage/reference graph, STAGE 2 H-LINEAGE) — the honest thing under today's shape is to write `projectParts ⊕ projectFacets ⊕ projectProvenance`: a **fourth hand-written term**, a new bridge, the anti-pattern the Bounded-Element law (ADR-038) and Law 8 exist to forbid. That is the circle regenerating one stratum up: the object model is unified (ADR-041/042 hold), but the *projection* of the object model is still assembled by hand.

The EXPLAIN projection makes this urgent, not academic: CONCEPT §2 makes "every published number explains itself" (what am I · am I real · who may see me · where from · who verified) an un-copyable differentiator, and its `provenance` is a **declared field already conserved by the engine and discarded before it reaches a reader** (CONCEPT §1, the wound). EXPLAIN must be a *projection of the one declaration*, never a second narrative subsystem (CONCEPT §5, explicitly refused). Without a named projector law, EXPLAIN cannot be a projection — there is no fold to register it into.

---

## Decision — name the Projector Law; a new projected axis is a REGISTRATION, not a fold term

> **THE LAW.** Every derived surface is the fold of the projectors that apply to a declaration:
>
> **`surface(declaration, selection, ctx) = fold_{ p ∈ Projectors | p.surface = surface ∧ p.appliesWhen(declaration, ctx) }  p.project(declaration, selection, ctx)`**
>
> The Part port, the Triprojection axes, and the Facet registry are three **instances** of this ONE law. Nothing is hand-wired between projectors; `⊕` is the generic fold, never a named binary term.

### What a projector IS (the declared unit)

A **projector** is a registered, bounded unit that declares its own applicability and emits a surface-shaped contribution — it is the Bounded-Element law (ADR-038) applied to *derivation* instead of to *content*:

```
Projector = {
  id          // stable identity
  axis        // reach | inspect | manipulate | explain | …  (a family, extensible)
  surface     // which derived surface(s) it contributes to: canvas · navigator · dock · palette · export · explain
  appliesWhen (declaration, ctx) → boolean        // self-declared applicability; NEVER read externally by type
  precedence  // declared order within the fold (not positional, not hand-wired)
  project     (declaration, selection, ctx) → Contribution   // surface-shaped output
}
```

A projector names **no concrete element type** (Law 1, `FF-DISPATCH-NOT-BRANCH`). `appliesWhen` is a capability/residence/facet predicate — the same declared-predicate discipline as `slotAdmits`, `PartField.residence`, and `FacetDescriptor.appliesWhen`.

### The fold contract (why it is a fold, not a list)

Each surface has a **Contribution monoid** — an associative combine `⊕` with an identity element (the empty contribution):

| Axis / surface | Contribution | Identity | Combine |
|---|---|---|---|
| **reach** (Select) | `{ frames, rows, anchors }` | `{ }` | union by `PartAddress` |
| **inspect** (dock) | ordered facet/part sections | `[]` | concat by declared `precedence` |
| **manipulate** | placement affordances + `resolvePlacementPlan` arms | `∅` | residence-routed merge |
| **explain** (reader) | cite · methodology · lineage · JSON-LD blocks | `[]` | concat by `precedence` |

Because the combine is associative with identity, the surface is a **fold over the applicable projector set**, and result order is governed by *declared precedence*, not by the textual order of hand-written terms. `INSPECT = projectParts ⊕ projectFacets` is re-read as `INSPECT = fold(inspect-axis projectors)` whose set today has exactly two members — `partsProjector` and `facetProjector` — both **registered**, neither privileged.

### How a new axis registers (the whole point)

A new projected axis — **provenance**, **relationships**, a future **validation** or **lineage** surface — is added by:

```
registerProjector({ id: 'provenance', axis: 'explain', surface: 'explain',
                    appliesWhen: hasConservedProvenance, precedence: …, project: projectProvenance })
```

That is a **declaration into the registry**. It is **not** an edit to any `⊕` expression, not a new term in `inspect =`, not a new bridge. The fold machinery is unchanged (Open/Closed, Law 8). This is the exact test ADR-041 set for parts ("the next kinds are declarations only, no new bridge") lifted from *content* to *derivation*: **the next projected axes are registrations only, no new fold.**

### The invariant this law eventually enforces

> **`FF-NO-UNPROJECTED-DECLARED-FIELD`** — every field a declaration declares is projected by at least one registered projector onto at least one surface *for its audience/plane* (ADR-042 D4, the plane axis); and dually, **no surface assembles a projection outside the registry** (no live `⊕`-of-named-terms, no `if axis === X`). A declared field that reaches no surface is a *conserved truth lost at the projection gate* (CONCEPT §1, gate G2) — the fitness function makes that loss a RED build.

This is the projection-side peer of ADR-041's `FF-ONE-PART-GRAMMAR` (all enumeration through the port) and ADR-042's `FF-DISPATCH-NOT-BRANCH` (no type branch in any projection). It supersedes nothing; it names the gate the three instances already half-guard.

---

## Relationship to the Publishable Identity (ADR-044) — orthogonal, composed, not overlapping

ADR-044 (proposed in parallel) defines the `Publishable` **declaration** — identity, version, lineage-to-release, plane. This ADR defines how ANY declaration's surfaces are **derived**. They meet cleanly and do not overlap:

- **ADR-044 owns the declaration**: `release_id` / lineage-to-release is a *declared field of the Publishable*, not a projector.
- **ADR-043 owns the derivation**: the **provenance/EXPLAIN projector** *projects* that field onto reader surfaces (cite, JSON-LD, narration).
- Their seam is `FF-NO-UNPROJECTED-DECLARED-FIELD` applied to the Publishable: because `release_id` is a declared field, the law *forces* a projector to exist for it — which is precisely EXPLAIN (H3). The Publishable identity is *why EXPLAIN has something to project*; the Projector Law is *how EXPLAIN is a projection rather than a subsystem*. One is the noun, the other is the verb.

If provenance were modelled as "a projector axis that owns its own data," the two ADRs would overlap and fork lineage into a second store (CONCEPT §5, explicitly refused). The clean rule — **lineage is a declared field (ADR-044); projecting it is a registered projector (ADR-043)** — is the resolution and is recorded here so no future build re-forks it.

---

## Alternatives rejected (≥2, per ADR practice)

1. **Keep the hand-wired fold; add each axis as a new `⊕` term when it arrives** (status quo — `projectParts ⊕ projectFacets`, then `⊕ projectProvenance`, then `⊕ projectRelationships`). *Gains:* zero cost today; nothing to name. *Rejected:* this IS the circle one level up — every new inspectable/reader axis is a new hand-written bridge in the surface assembler, re-creating the "one question asked once per grammar" disease ADR-041 killed for parts, now for projections. The EXPLAIN projection (a near-term Stage-2 differentiator) would land as a fourth term and a candidate second subsystem — the exact outcome CONCEPT §5 refuses. Naming the law is the cheapest possible act that stops the regeneration; declining to name it is choosing the circle deliberately.

2. **Build a Projector framework NOW** (generalize `enumerateParts`, the facet registry, and the Triprojection axes into one live `Projectors` registry and refactor all three onto it this stage). *Gains:* the meta-model is real, not just doctrine. *Rejected — sequencing, not merit:* the substrate HOLDS (STUDY verdict); re-mechanizing three *already-generic* engines before Stage 0's gate even runs would be "another object-model reform," the first thing STUDY §5 and CONCEPT §5 refuse, and it violates WIP=1 (it opens a 13th stratum ahead of the journeys). The correct trigger is the *first real fourth consumer* — the EXPLAIN projection at STAGE 2 — which pays for the generalization with a shipped surface. Doctrine now (free); build when a consumer arrives (H-EXPLAIN). This ADR records the target so that build has ONE shape to hit, not a re-derivation.

3. **Model each surface (canvas / dock / EXPLAIN) as its own bespoke composer** (no shared fold; each surface owns how it assembles its inputs). *Gains:* per-surface freedom. *Rejected:* it abandons the one property that makes the platform's authoring loosely-coupled — that a new capability is visible on *every* surface by construction (ROADMAP H4). Bespoke composers re-introduce per-surface per-type knowledge (the `table`-shell-forgot-to-anchor class of defect, ADR-042 D2), and there is then no single place for `FF-NO-UNPROJECTED-DECLARED-FIELD` to bite. The fold is what makes "declare once, appears everywhere" a theorem instead of a hope.

---

## Consequences

**Positive.** The residual circle closes at the projection layer: a new projected axis (provenance, relationships, validation, lineage) is a *registration*, matching what ADR-041 already achieved for parts and ADR-042 for placement. EXPLAIN (H3) becomes definitionally a projection — it cannot be built as a second subsystem without failing the law. Concept count does not rise: the law *names* three engines that already exist; it adds vocabulary, not machinery. `FF-NO-UNPROJECTED-DECLARED-FIELD` gives CONCEPT's gate-G2 truth-loss ("surfaces cannot project undeclared axes") a machine home.

**Costs / trade-offs (ISO 25010 named).** A one-time generalization of the `⊕` seam when the build lands (**maintainability +** long-term; short-term **modifiability −** only during that refactor window, Stage 2). Until then the law is *doctrine that constrains new work* (no new hand-written fold terms) without touching the two shipped instances — pure additive discipline, zero risk. The genuine judgement call deferred to build time: the exact Contribution-monoid shapes per surface (above is the design intent, not a frozen signature).

**Sequencing / build discipline (binding).** This is **ADR-now / build-after-Stage-1**. It **must not open as a build stratum before Stage 0 (the gate) runs** — until CI executes, no generalization is evidence (CONCEPT §4, Tier-0). It rides Stage 2's **H-EXPLAIN** as that consumer's substrate; it does not add a wave. WIP=1 stands: naming the law costs no build slot; the build waits its turn behind the journeys.

---

## Fitness functions (the invariant, as an eventual executable gate)

**New (this ADR — scaffolded as doctrine now, biting when the build lands):**
- **`FF-NO-UNPROJECTED-DECLARED-FIELD`** — every declared field on every registered declaration is projected by ≥1 registered projector onto ≥1 surface for its plane; and no surface assembles a projection outside the projector registry (no live `⊕`-of-named-terms, no `if axis === X`). *Home (when built): `packages/react/src/engine/object-model.fitness.test.ts` (the projector-registry tooth) + the corpus `[]` gate.*
- **`FF-PROJECTOR-DISPATCH-NOT-BRANCH`** — a refinement of ADR-042's `FF-DISPATCH-NOT-BRANCH` onto the projector set: no projector reads a concrete element type; applicability is a declared predicate.

**Kept green throughout (the three instances this law names — unchanged):**
- `FF-ONE-PART-GRAMMAR`, `FF-RESIDENCE-AT-FIELD`, `FF-DERIVED-CONTAINMENT` (ADR-041) — the reach instance.
- `FF-AUTHORING-TRIPROJECTION`, `FF-DISPATCH-NOT-BRANCH` (ADR-042) — the Select/Inspect/Manipulate instance.
- `FF-DOCK-IS-FACET-PROJECTION`, `FF-FACET-SECTION-IS-PROJECTION`, `FF-EVERY-DECLARED-FACET-PROJECTED` (ADR-042 D4) — the facet instance; these are the *first members* the generalized `FF-NO-UNPROJECTED-DECLARED-FIELD` subsumes.
