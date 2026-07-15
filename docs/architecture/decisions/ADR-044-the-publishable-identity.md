# ADR-044 — The Publishable Identity (ONE spine for the published thing; lineage-to-release conserved)

**Status:** PROPOSED (named/designed now; owner blesses acceptance later — the build is W5's substrate in Stage 1, never a new stratum before Stage 0's gate runs).
**Decision authority:** lead proposes; owner accepts (this fixes a referential-integrity axis that touches the DB and the publish loop — an owner door).
**Extends (never forks):** ADR-001/010 (data-binding + `DataStore` port) · ADR-0025 (vintage/release) · ADR-036 (vintage as a port coordinate) · the AR-48 Delivery Port design (`ViewSnapshot`/`SnapshotEnvelope`) — none re-opened; this ADR names the shared identity of which they are projections. Sibling: ADR-043 (the Projector Law) governs how a Publishable's surfaces are *derived* (see "Relationship to ADR-043").
**Source of truth:** `docs/architecture/proposals/CONCEPT-power-of-the-core.md` §3 gate G3 ("ONE `Publishable` identity … with `release_id` stamped to the pixel; design-now, build-on-W5") · `audit/DEEP-2026-07-15-data-plane.md` (data-lens: "a published thing is modelled five ways with no shared identity/version/lineage spine"; "the published pixel is a lineage island") · `audit/DEEP-2026-07-15-system-architecture.md` (system-lens PM2) · `proposals/DESIGN-delivery-port-export-embed-snapshot.md` (AR-48). Registry: AR-43 (publish FSM), AR-47 (versioning), AR-48 (delivery). ROADMAP: **STAGE 1 W5** builds on this identity; **STAGE 2 H3/H-EXPLAIN + H-LINEAGE** consume it.

---

## Context — "a published thing" is modelled five ways with no shared spine

The axis that most differentiates a *national-statistics* platform from a generic dashboard builder is **provenance/publishing**: a published number must trace to the release that produced it and must not silently change when the series is revised. That axis is today the platform's *least-unified* concept — the "published thing" is modelled at least **five** disagreeing ways, none sharing an identity, a version rule, or a lineage edge:

| # | Model | Where | What it is | What it MISSES |
|---|---|---|---|---|
| 1 | `SiteConfig` | config / runner | the authored site (brand, pages, chrome) | no version identity; no release lineage |
| 2 | `SiteManifest` | `@statdash/contracts`, `subsystems/08` | the multi-site directory | site identity only; no version/lineage |
| 3 | `ViewSnapshot` | AR-48 delivery (`react` + contracts) | a frozen view for export/embed | pins **data** but **not provenance/`release_id`** (AR-48 finding #4) |
| 4 | `SnapshotEnvelope` | `@statdash/contracts`, `config.snapshot` (V36) | the persisted-snapshot boundary | **no `release_id`** (data-plane row 4) |
| 5 | `page_version` | `config.page_version` (V3, immutable FSM) | the published page snapshot | captures the **tree**, not the **vintage that produced its values**; zero `config.*→stats.*` FK |

The consequence, named by the data lens: **the published pixel is a lineage island.** A `page_version` can point at a retired cube and no edge objects; a `ViewSnapshot` freezes numbers with no record of *which release* they are; `config.snapshot` has no `release_id`. Truth the engine already computed (the vintage/release behind every value) is **discarded at the storage gate** (CONCEPT §1, gate G3). And because there is no shared identity, the three near-term efforts that all publish something — **AR-43** (publish FSM), **AR-47** (versioning), **AR-48** (delivery/embed) — plus ROADMAP **W5** (publish closes the loop) and **H3** (every number explains itself) are on track to be built as **three-to-five re-derivations of one identity**. That is the circle, on the axis that matters most for credibility (Law 9).

---

## Decision — define ONE `Publishable` identity; page/version/snapshot/embed/release are its projections

> **THE IDENTITY.** Everything the platform publishes is a **`Publishable`** — a bounded thing that carries, at minimum:
>
> | Field | Meaning | Why it is on the identity, not the projection |
> |---|---|---|
> | `id` + `kind` | stable identity + which projection family (`site` · `page` · `snapshot` · `embed` · `release`) | one address space for every published thing (SSOT) |
> | `version` | immutable, monotonic revision | versioning (AR-47) is a property of *being publishable*, not of one table |
> | `release_id` → **lineage-to-release** | the stats vintage/release that produced its numbers | **the missing edge** — makes lineage-to-the-pixel a referential fact, not a lost truth (CONCEPT G3) |
> | `audience` / `plane` | who may see it, at what confidentiality | provenance/masking is an identity property (Law 9); the plane axis (ADR-042 D4 / W3) reused, not re-invented |
> | `lifecycle` | draft → published → retired (FSM) + `generatedAt` | the publish FSM (AR-43) is ONE state machine over the identity, not per-model |

The five existing models become **projections of the ONE identity**, each adding only its own facet:

- **`page` / `page_version`** — the authoring handle (`page`, mutable) and an **immutable Publishable version** (`page_version`). `page_version` gains a **required `release_id`** — the edge that today does not exist.
- **`ViewSnapshot` / `SnapshotEnvelope`** — a Publishable *frozen for delivery*: a pinned version + view-state + scope, with `release_id` **stamped at mint** (this is exactly AR-48 finding #4's fix, now identity-level not delivery-local).
- **`embed`** — a **scoped, signed** projection of a snapshot Publishable (`scope.nodeId` + HMAC); adds delivery-signing, inherits identity + lineage.
- **`release`** — the **stats-side Publishable**: a vintage of the cube (ADR-0025/036). It is the *target* every other Publishable's `release_id` points at — the lineage anchor. Modelling release as a Publishable is what closes the config↔stats referential gap without a big-bang catalog migration (CONCEPT §5).
- **`SiteConfig` / `SiteManifest`** — the **site-scoped** Publishable: a site is a Publishable whose *parts* are pages (ADR-041 Part grammar — pages are a `slot` residence of the site), carrying brand/chrome as its own facets.

A **new** published surface (a governed export bundle, a certified citation, a second-tenant site) is then a **new `kind`** — a declaration over the identity — never a sixth parallel model. (Law 8; the Bounded-Element law ADR-038 applied to publishing.)

### Zero big-bang, expand-first

The identity is **additive**: `release_id`, `version`, `plane`, `lifecycle` land as forward-added fields (some already inert-present — e.g. `config.snapshot.tenant_id` precedent, AR-48 §8). No table is collapsed; the five models keep their names as *surface forms* (the ADR-041 alias discipline) and gain the shared identity beneath. The one genuinely new referential fact — `page_version.release_id` and the snapshot `release_id` stamp — is an **expand** step (write the edge going forward; backfill or degrade for legacy rows, Postel), never a schema rewrite. The relational config↔stats catalog (STAGE 2 H-CATALOG / H-LINEAGE) is the *later* home for enforcing the edge as a DB foreign key; this ADR defines the identity that makes that enforcement a tightening, not a redesign.

---

## Relationship to ADR-043 (the Projector Law) — the noun to its verb

ADR-043 names how any declaration's surfaces are *derived*: `surface = fold(applicable projectors)`. `Publishable` is the **declaration**; its reader surfaces (cite · methodology · lineage · JSON-LD · a11y narration) are the **EXPLAIN projection** (H3), a *registered projector*, never a second subsystem.

- **This ADR owns the declaration**: `release_id`/lineage-to-release is a **declared field of the Publishable**.
- **ADR-043 owns the derivation**: the provenance/EXPLAIN projector *projects* that field to readers.
- Their seam is `FF-NO-UNPROJECTED-DECLARED-FIELD` (ADR-043) applied here: because `release_id` is a *declared* field, the Projector Law **forces** EXPLAIN to exist — a lineage field that reaches no reader surface is a RED build. **H3 ("every published number explains itself") is exactly this composition**: ADR-044 gives the number its lineage; ADR-043 makes that lineage a projection. Recording the split here prevents the future fork where provenance is re-modelled as projector-owned data (a parallel lineage store — CONCEPT §5, refused).

**W5 in these terms:** *publish* = mint a `Publishable` version + stamp `release_id` + transition the lifecycle FSM; *public render* = project that Publishable to the runner surface. The loop closes because there is one identity to mint, stamp, and project — not five.

---

## Alternatives rejected (≥2, per ADR practice)

1. **Leave the five models separate; add `release_id` only where each effort needs it** (AR-48 stamps its snapshot, AR-43 stamps its FSM, AR-47 versions its page — independently). *Gains:* smallest per-effort diffs; no shared type to design. *Rejected:* this *is* the five-re-derivations circle the data lens named — three efforts each invent version+lineage+audience with subtly different rules, and the "published pixel is a lineage island" defect persists because no two agree on what `release_id` means or which model owns it. Law 9 credibility cannot rest on three drifting definitions of "where this number came from." Naming the identity once is the cheap act that makes W5/H3/AR-43/47/48 *consistent by construction*.

2. **Collapse everything into the `page_version` table now** (one physical table for site/page/snapshot/embed/release). *Gains:* one row shape trivially. *Rejected:* it forks the wrong way — a `release` (a stats vintage) and an `embed` (a signed delivery token) have genuinely different lifecycles, stores, and security postures; one physical table regresses to a stringly-typed heterogeneous blob (the exact anti-pattern ADR-041 rejected for parts, and ADR-023 for behaviour-stores). The correct shape is **one identity, N residences/kinds** — a shared identity contract with per-kind projections, not one table. Uniformity of *identity* does not require uniformity of *storage*.

3. **Build the relational config↔stats catalog first** (make `release_id` a real FK across planes before defining the identity). *Gains:* referential integrity enforced immediately. *Rejected — sequencing:* the relational catalog is a flagged one-way, big-bang-risking migration (STAGE 2 H-CATALOG), triggered only by a real lifecycle/certification need (CONCEPT §5 refuses the big-bang). Defining the *identity* now (additive, reversible) lets W5 stamp and read `release_id` as an application-level edge immediately, and lets the DB FK land LATER as a tightening of an already-shipped field — never a redesign. Identity-now, enforcement-when-triggered.

---

## Consequences

**Positive.** The most credibility-critical axis gets ONE spine: version, lineage-to-release, audience/plane, and lifecycle are identity properties every published thing shares. The "lineage island" defect becomes representable-away — a `Publishable` without a `release_id` is a caught gap, not a silent one. W5 builds publish once (mint+stamp+transition) instead of per-model; H3/EXPLAIN has a declared field to project (composing with ADR-043); AR-43/47/48 converge on the identity instead of re-deriving it. Concept count *drops* (five ad-hoc models → one identity + five projections).

**Costs / trade-offs (ISO 25010 named).** The one genuinely new referential fact (`page_version.release_id` + the snapshot stamp) is a real **data-model change** (honestly named, not a projection) — an **expand** step with a legacy-row backfill/degrade decision (**reliability + / integrity +**; short-term **modifiability −** during the stamp rollout). Everything else is additive identity fields over existing models (alias-reversible). The DB-level FK enforcement is deliberately deferred to H-CATALOG's trigger (one-way-door hygiene: keep the irreversible step out of Stage 1).

**Sequencing / build discipline (binding).** **Design-now / build-on-W5** (ROADMAP STAGE 1). It **must not open as a new stratum before Stage 0's gate runs** — the `release_id` stamp is only *evidence* once CI executes the DB-gated + journey suites (CONCEPT §4, Tier-0; today those 18 DB suites are dark). It is W5's substrate, not a wave of its own; WIP=1 stands.

---

## Fitness functions (the invariants, as eventual executable gates)

**New (this ADR — designed now, biting when W5's build lands):**
- **`FF-PUBLISHABLE-HAS-LINEAGE`** — every published `Publishable` (page_version, minted snapshot, embed) carries a resolvable `release_id`; a published thing with no lineage-to-release is a RED build (degrade only for explicitly-`live`/unpinned kinds, never silently). *Home (when built): the delivery/publish fitness suite + a config↔stats integrity sweep (CONCEPT G3).*
- **`FF-ONE-PUBLISHABLE-IDENTITY`** — site/page/snapshot/embed/release resolve their identity+version+lineage+plane through the ONE `Publishable` contract; no sixth parallel "published thing" model is introduced (grep/property gate — the peer of `FF-ONE-PART-GRAMMAR`).
- **`FF-PUBLISHABLE-PLANE-HONEST`** — a Publishable's `audience`/`plane` (confidentiality) is enforced at the identity, so masking travels with the artifact (reuses W1's `Cell` masked-state + W3's plane axis; closes CONCEPT F7 for delivered artifacts).

**Composed with ADR-043:** `FF-NO-UNPROJECTED-DECLARED-FIELD` over the Publishable forces the EXPLAIN projection to project `release_id`/provenance — the machine statement of H3.

**Kept green throughout (inherited):** `FF-DELIVERY-ONE-SSOT`, `FF-DELIVERY-PROVENANCE`, `FF-EMBED-ROUNDTRIP` (AR-48); the vintage/release invariants (ADR-0025/036).
