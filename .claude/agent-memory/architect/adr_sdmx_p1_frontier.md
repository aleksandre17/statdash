---
name: adr-sdmx-p1-frontier
description: ADR — SDMX-P1 domain-completeness frontier; prioritized P1 set (ConceptScheme separation, dataset lifecycle FSM, CategoryScheme) NOW vs ref-metadata/quality/REST-API deferred; V27+ roadmap, laws-aligned, rejected alternatives
metadata:
  type: project
---

# ADR-00xx — SDMX-P1 Domain-Completeness Frontier (design only; impl = next)

Status: PROPOSED (architect). Supersedes the BOARD "SDMX-P1 … 📋 NOTED" line with a designed, prioritized subset. Builds on V18 (concept_role), V25 (release), V26 (content_constraint), V20/V21 (unit at measure-classifier). Cube-profile + bootstrap routes are the published-only projection seams.

## Context — what already exists (do NOT rebuild)

- **Partial ConceptScheme.** `stats.dimension.concept_role` (V18) types a dimension's ROLE (measure/attribute/time/geo/classification). But Concept *identity* is NOT separated from Representation: `stats.dimension.code` IS both the semantic concept AND the codelist key. SDMX separates `Concept` (REF_AREA — semantic role) from `Codelist` (CL_AREA — the representation). Two dims that share a concept (e.g. partner-country and reporter-country both = REF_AREA over CL_AREA) cannot declare that today.
- **Publication-event FSM ≠ dataset lifecycle.** `stats.release` (V25) is an FSM (open→published→superseded) over a *vintage of data*. It is NOT the maintainable-artefact lifecycle of the dataset itself. `stats.dataset` has NO `status` (draft/published/deprecated/superseded), NO `valid_from/valid_to`, NO `replaced_by`. A dataset cannot be retired or marked draft. These are orthogonal SDMX concerns: release = "GDP as published on D"; dataset lifecycle = "the GDP_ANNUAL artefact is deprecated, superseded by GDP_ANNUAL_2025".
- **Projection seams.** `GET /api/cube/:code/profile` (Constructor discovery) and `GET /api/bootstrap` (runner) are both "published-only, read-only, minimal projection" surfaces. Lifecycle filtering belongs THERE (delivery), not in the cube write path (consistent with V25/V26 keeping the hot path free of cross-table coupling).
- Cube is Law-1 generic (dim_key JSONB), DSD-validated (V4/V22), SCD-2 codelists with code-chain hierarchy (V23/V24), ContentConstraint region (V26), unit at measure-classifier (V20/V21).

## Decision — the load-bearing P1 set (NOW) vs deferred

**NOW (V27–V29):**
1. **P1-A ConceptScheme** — separate Concept (semantic identity) from Representation (codelist). The keystone: it is the missing SSOT every other artefact references, and it upgrades concept_role from a per-dimension enum to a real concept reference. Cheapest to add now (additive, nullable FK; concept_role is already 80% of the payoff).
2. **P1-B Dataset lifecycle FSM** — `stats.dataset.status` + validity window + `replaced_by`, as a maintainable-artefact lifecycle ORTHOGONAL to release. Load-bearing because the platform is now multi-tenant/external-product (panel ships externally): a published contract needs a deprecation path, and the published-only projection (bootstrap/profile) must hide draft/deprecated datasets.
3. **P1-C CategoryScheme** — a browsable theme tree categorizing datasets (Constructor catalog / nav). Picked NOW (not deferred) because it is small, reuses the EXACT classifier LTREE/code-chain machinery, and directly powers the Constructor dataset palette + bootstrap nav. High value-to-cost.

**DEFERRED (documented doors, not built):**
4. **P1-D Reference metadata (ESMS/ESQRS)** — methodology/source/quality structured metadata reports. Deferred: large surface (ESMS = ~21 concept tree, ESQRS quality), and a *thin* version (free-text methodology) is already partly served by `dataset.metadata` JSONB + the preliminary/last-updated badges (P2-3). Build the full structured report only when a real ESMS consumer (an export, a metadata panel) exists — YAGNI until the second caller. Door: `stats.metadata_report` + `metadata_attribute` (same predicate-row shape as content_constraint).
5. **P1-E Quality indicators (CV / response-rate)** — series/release-grained quality measures. Deferred: needs a decided GRAIN (per-series? per-release? per-observation via obs_attribute?) and there is no current producer of CV/response-rate values. Door: model as a quality `metadata_report` attached at series or release grain (rides P1-D's structure) — do NOT invent a parallel table.
6. **P1-F SDMX REST API (`/data/{flow}/{key}`, `/datastructure`, SDMX-JSON/ML content-negotiation)** — deferred as the LAST P1, despite high interoperability value. Rationale: it is a *projection/adapter* over everything above (a new delivery surface, not new domain truth), so it is strictly cheaper AFTER ConceptScheme + lifecycle land (the `/structure` responses must serialize concepts, codelists, category scheme, lifecycle status — building it first would mean re-doing the serializer). It is also the largest single piece (URL grammar, key-path parser, two media types). Door: a `routes/sdmx/` adapter package mapping our internal model → SDMX-JSON/ML, content-negotiated; reuses `queryAsOf` + cube-profile internals. Build when an external SDMX client is a real requirement.

Priority order is deliberate: **identity (concept) → artefact lifecycle → catalog → metadata → quality → interop adapter.** Each later item references the earlier ones, so the dependency arrow of the data model dictates the build order (you cannot serialize a clean SDMX `/structure` document without the ConceptScheme).

---

## P1-A — ConceptScheme (V27): separate Concept from Representation

### The SDMX model
- **Concept** = the semantic role a column plays (REF_AREA, TIME_PERIOD, OBS_VALUE, FREQ). Lives in a **ConceptScheme** (a maintainable artefact, e.g. CROSS_DOMAIN_CONCEPTS).
- **Representation** = how a concept's values are coded — a **Codelist** (CL_AREA) or a primitive (a TIME format). One codelist may represent MANY concepts; one concept has ONE core representation.
- A **DSD dimension** binds a Concept to a Representation in a key position. Today our `stats.dataset_dimension` binds a *dimension code* (which is both) — collapsing concept and representation.

### Schema (V27, additive, two-way)
```
stats.concept_scheme (
  code        TEXT PRIMARY KEY,            -- 'CROSS_DOMAIN' | 'SDMX_STAT'
  agency      TEXT NOT NULL DEFAULT 'SDMX',
  version     TEXT NOT NULL DEFAULT '1.0',
  label       JSONB NOT NULL,              -- i18n (config.enforce_locale_string trigger)
  metadata    JSONB NOT NULL DEFAULT '{}'
)
stats.concept (
  scheme_code TEXT NOT NULL REFERENCES stats.concept_scheme(code) ON DELETE CASCADE,
  code        TEXT NOT NULL,               -- 'REF_AREA' | 'TIME_PERIOD' | 'OBS_VALUE'
  label       JSONB NOT NULL,
  concept_role TEXT,                       -- the role vocabulary, MOVED here from dimension
  core_representation_codelist TEXT,       -- NULL = primitive (time/numeric); else the SSOT codelist
  parent_code TEXT,                        -- SDMX concepts may nest; code-chain edge (ADR-0023 idiom)
  metadata    JSONB NOT NULL DEFAULT '{}',
  PRIMARY KEY (scheme_code, code),
  CONSTRAINT concept_role_chk CHECK (concept_role IN ('measure','attribute','time','geo','classification') OR concept_role IS NULL)
)
-- The binding: a dimension REFERENCES a concept (Protected Variations seam).
ALTER TABLE stats.dimension
  ADD COLUMN concept_scheme_code TEXT,
  ADD COLUMN concept_code        TEXT,
  ADD CONSTRAINT dimension_concept_fk
    FOREIGN KEY (concept_scheme_code, concept_code)
    REFERENCES stats.concept(scheme_code, code);   -- nullable: unbound dim = legacy/unclassified
```

### Why this shape (rationale + rejected alternatives)
- **Keeps Law 1.** No hardcoded concept names anywhere — `concept.code` IS the identity, exactly like `dimension.code` and `classifier.code`. A new concept = an INSERT, never an ALTER.
- **concept_role moves to its rightful home (Strangler-Fig).** Role is a property of the CONCEPT, not the per-cube dimension. V18 put it on `stats.dimension` as the cheapest first step; V27 promotes it to `stats.concept` and `stats.dimension.concept_role` is **kept as a generated/synced read alias for one release, then contracted** (expand-contract: V27 adds concept FK + populates from existing concept_role; a later V-contract drops the column once cube-profile reads through the concept). Do NOT dual-write — the concept is SSOT; the dimension reads through it.
- **Rejected — "make `stats.dimension` carry codelist_code directly".** That keeps concept/representation collapsed; two dimensions can never share a concept (partner/reporter REF_AREA), which is exactly the gap. Rejected: does not adopt the standard whole (Law 4).
- **Rejected — "ConceptScheme as JSONB on dataset.metadata".** Not queryable, not FK-validated, not a maintainable artefact; the SDMX `/structure` serializer (P1-F) could never emit a clean ConceptScheme document from a blob. Rejected (SSOT + Law 4).
- **Rejected — "one global concept table, no scheme".** SDMX concepts are namespaced by scheme+agency+version (maintainable-artefact identity); a flat table cannot represent two agencies' REF_AREA. Kept the scheme as the namespace.

### Integration
- **cube-profile**: `ProfileDimension.conceptRole` continues to resolve, but THROUGH the concept (dimension → concept → role). Add `concept: { scheme, code }` to the dimension wire shape so the Constructor can group/suggest by concept (two REF_AREA axes → "these are both geographies").
- **Constructor suggestions**: concept_role already drives panel suggestions (BOARD G5). Concept identity sharpens it: same-concept dims offer a "swap axis" affordance.
- **Codelist reuse**: `concept.core_representation_codelist` is the SSOT for "which codelist represents this concept" — but the cube still binds the actual codelist at the dimension level (a dataset MAY constrain to a sub-codelist). The concept's representation is the DEFAULT/contract; the dimension's classifier set is the actual.

### Fitness function
`concept-scheme.fitness.test.ts`: (1) every `stats.dimension.concept_role` value equals the role of its bound concept (no drift during the expand window); (2) no hardcoded concept name in the DDL (grep the migration for literal 'REF_AREA' etc. outside seed data — Law 1); (3) cube-profile `dimension.concept` resolves for every dim that has a binding.

---

## P1-B — Dataset lifecycle FSM (V28): maintainable-artefact status

### The SDMX model
A Dataflow/DSD is a **maintainable artefact** with its own lifecycle, ORTHOGONAL to the data vintages inside it. SDMX 3.0 maintainable artefacts carry `isFinal`, `validFrom`, `validTo`, and version chains; agencies layer a workflow status (draft → published → deprecated → superseded-by-vNext). This is NOT `stats.release` (that is the vintage of the *data*). A dataset can be `deprecated` while its last published release stays readable.

### Schema (V28, additive, two-way)
```
ALTER TABLE stats.dataset
  ADD COLUMN status        TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN valid_from    TIMESTAMPTZ,           -- artefact validity window (SDMX validFrom)
  ADD COLUMN valid_to      TIMESTAMPTZ,
  ADD COLUMN replaced_by   TEXT REFERENCES stats.dataset(code),  -- supersession chain (self-FK)
  ADD CONSTRAINT dataset_status_chk
    CHECK (status IN ('draft','published','deprecated','superseded')),
  ADD CONSTRAINT dataset_superseded_chk
    CHECK ((status = 'superseded') = (replaced_by IS NOT NULL)),  -- make illegal state unrepresentable
  ADD CONSTRAINT dataset_validity_chk
    CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from);
```
The FSM (enforced by a transition function `stats.set_dataset_status(code, new_status, replaced_by)`, mirroring publish_release):
```
draft ─publish→ published ─deprecate→ deprecated
  │                  │                     │
  │                  └──supersede(replaced_by)──→ superseded
  └─(may stay draft / be deleted while draft only)
```
- `draft → published`: sets `valid_from = now()` if null. Only published datasets are visible in delivery.
- `published → deprecated`: still readable (existing dashboards keep working), but flagged; Constructor warns, palette de-emphasizes. No `valid_to` forced (deprecated ≠ withdrawn).
- `published/deprecated → superseded`: REQUIRES `replaced_by`; sets `valid_to = now()`. The supersession is the SDMX version chain.

### What happens to observations (the load-bearing decision)
**Observations are NEVER deleted by a lifecycle transition.** A superseded/deprecated dataset's facts remain in `stats.observation` (data outlives code — the cube's standing law). Lifecycle is a PROJECTION FILTER, not a data operation:
- The delivery surfaces (bootstrap, cube-profile, public observations) project **published-only by default** (`status IN ('published','deprecated')`, deprecated still served but flagged; `draft`/`superseded` hidden unless an explicit `?includeLifecycle=` / authoring token).
- `superseded` datasets remain readable via direct/permalink + vintage (`asOf`) reads (auditability law — a permalink to an old dashboard must not 404), but are absent from discovery/catalog.
- This mirrors V25/V26: keep the hot write path untouched; enforce the rule in the read projection. No trigger on the hypertable.

### Why this shape (rationale + rejected alternatives)
- **Orthogonal to release (the critical distinction).** `release.status` (open/published/superseded) is the lifecycle of a *data vintage*; `dataset.status` is the lifecycle of the *artefact*. Conflating them was the trap — rejected explicitly. A dataset can publish many releases; a deprecated dataset still has a current release.
- **Make illegal states unrepresentable.** `dataset_superseded_chk` ties status='superseded' iff replaced_by present (fail-fast at write, not in app code).
- **Rejected — lifecycle as `dataset.metadata` JSONB flag.** Not constrainable, not FK-validated for the supersession chain, not indexable for the published-only projection. Rejected (SSOT, fail-fast).
- **Rejected — a separate `stats.dataset_version` table (full maintainable-artefact versioning).** Over-built for now: we have ONE version of each dataset live; the self-FK `replaced_by` chain captures supersession without a version-history table. Escalation door if true multi-version-concurrent becomes real (YAGNI). Note: distinct from `dataset_version` the ETag counter (V6) — different concern, do not merge (SSOT each).
- **Rejected — deleting/archiving observations on supersede.** Breaks vintage reconstruction (V25), revision triangles, and permalinks (auditability). Rejected hard.

### Integration
- **bootstrap / cube-profile / observations**: add the published-only WHERE clause (status projection). One shared `stats.dataset_published` view (or a `WHERE status IN (...)` constant) = SSOT for "what delivery shows", reused by all three (Protected Variations).
- **Constructor**: dataset palette reads lifecycle → draft datasets editable only in authoring, deprecated shown with a warning badge, superseded offer "go to {replaced_by}".
- **provisioning**: a provisioned dataset defaults to `draft`; publish is an explicit transition (mirrors the page_version publish FSM — same governance idiom).

### Fitness function
`dataset-lifecycle.fitness.test.ts`: (1) bootstrap + cube-profile NEVER return a `draft` or `superseded` dataset (the projection holds); (2) every `superseded` dataset has a resolvable `replaced_by`; (3) no lifecycle transition deletes an observation row (count before/after a supersede is equal); (4) a `superseded` dataset's permalink/asOf read still resolves (auditability).

---

## P1-C — CategoryScheme (V29): browsable theme tree

### The SDMX model
A **CategoryScheme** is a hierarchy of **Categories** (themes: "National Accounts" > "GDP" > "Annual"); **Categorisations** link a Dataflow to a Category. It is the agency's browsable subject taxonomy — exactly the Constructor's dataset catalog and the public nav theme tree.

### Schema (V29, additive, two-way) — REUSES the classifier idiom
```
stats.category_scheme ( code TEXT PK, label JSONB, metadata JSONB )
stats.category (
  scheme_code TEXT NOT NULL REFERENCES stats.category_scheme(code) ON DELETE CASCADE,
  code        TEXT NOT NULL,
  label       JSONB NOT NULL,                 -- i18n trigger
  parent_code TEXT,                           -- code-chain edge (ADR-0023, NOT surrogate id)
  category_path LTREE,                         -- materialized code-chain path (V23 idiom)
  ord         INT NOT NULL DEFAULT 0,
  PRIMARY KEY (scheme_code, code)
)
stats.categorisation (                         -- the Dataflow→Category link (M:N)
  category_scheme_code TEXT NOT NULL,
  category_code        TEXT NOT NULL,
  dataset_code         TEXT NOT NULL REFERENCES stats.dataset(code) ON DELETE CASCADE,
  PRIMARY KEY (category_scheme_code, category_code, dataset_code),
  FOREIGN KEY (category_scheme_code, category_code) REFERENCES stats.category(scheme_code, code) ON DELETE CASCADE
)
```
Reuse the V23/V24 code-chain LTREE machinery verbatim (path = code-chain, acyclicity guard, code_to_ltree_label sanitiser) — do NOT re-invent. This is the "solve it once" platform-thinking dividend: the classifier hierarchy engine is generic.

### Why now (not deferred), rationale + rejected
- **Tiny + reuses proven machinery.** The hierarchy engine (LTREE code-chain, acyclicity, SCD-2-if-needed) already exists; CategoryScheme is "the same table for datasets-by-theme". Highest value-to-cost of the P1 set.
- **Directly powers two live surfaces.** Constructor dataset palette (browse by theme, not a flat list) + bootstrap nav (theme tree → nav). It is the missing catalog layer the Constructor needs as it scales past a handful of datasets.
- **Rejected — reuse `config.nav_item` for categories.** nav_item is PRESENTATION (a site's menu); CategoryScheme is the SEMANTIC subject taxonomy (agency-level, cross-site). Conflating them is first-tenant erosion (a category is not a menu entry). The nav can be GENERATED from a category scheme, but they are distinct SSOTs. Rejected.
- **Rejected — categories as classifier rows under a synthetic 'category' dimension.** Abuses the cube dimension model (a category is not a cube axis; it never appears in a dim_key). Keep it its own artefact (Law 4 — adopt CategoryScheme whole, not a hack).

### Integration
- **cube-profile / a new `GET /api/catalog`**: the category tree + categorisations → the Constructor dataset browser (published datasets only, joined to P1-B lifecycle).
- **bootstrap**: optional `categories` block so the runner can render a theme-driven nav.

### Fitness function
`category-scheme.fitness.test.ts`: (1) category tree is acyclic (reuse classifier cycle guard); (2) every categorisation references an existing published dataset; (3) catalog projection excludes non-published datasets (joins P1-B).

---

## Cross-cutting SOLID posture
- **Thin base, per-artefact specifics (ISP).** No shared "artefact" supertable bloat. Each scheme (concept/category) is its own thin table; they share only the i18n trigger + the LTREE code-chain helper (composition, not inheritance). No column added speculatively (Element-Config-Schema-Seam lesson: base-minimality).
- **DIP / Protected Variations.** Dimension→Concept and Dataset→replaced_by are nullable FK seams: legacy rows stay valid; the binding is the stable interface, the concept the variation point.
- **OCP.** A new concept/category/lifecycle-status-consumer = new data or a new projection, never an ALTER of the cube. concept_role CHECK is the one enumerated point (the SDMX role vocabulary is closed-ish; extend by migration if SDMX adds a role).
- **Law 1 throughout.** code = identity in every new table; no hardcoded concept/category/dimension names in DDL.

## Reversibility / risk (all V27–V29)
TWO-WAY: new PLAIN tables + nullable/defaulted ADD COLUMNs (metadata-only on PG ≥ 11). NO trigger on `stats.observation`, NO change to the partition key / unique index / compression. Hot write path byte-for-byte unchanged. The one expand-contract is concept_role moving dimension→concept (V27 expands, a later V-contract drops the dimension column after cube-profile reads through the concept). Rollback = drop new tables + columns; cube data untouched.

## Deferred doors (recorded so they are not lost — Chesterton's Fence)
- **P1-D ref-metadata**: `stats.metadata_report` + `metadata_attribute` (ESMS concept tree as predicate rows, content_constraint shape). Build when a metadata panel/export consumer is real.
- **P1-E quality indicators**: model as quality metadata_report at series/release grain (rides P1-D). Decide grain when a CV/response-rate PRODUCER exists.
- **P1-F SDMX REST API**: `routes/sdmx/` adapter — `/data/{flow}/{key}` (key-path parser → dim_key), `/structure/...` (serialize concept/codelist/category/DSD), SDMX-JSON + SDMX-ML content-negotiation. Build LAST (it is a projection over P1-A/B/C); reuses queryAsOf + cube-profile internals. Requires the ConceptScheme to emit a clean /structure document — hence sequenced after P1-A.
