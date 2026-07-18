# Capability-Injection Backlog — statdash-platform vs the proven class

> **What this is.** The ranked, continuously-delivered backlog of reference-class capabilities we mine → hybridize → lay as OUR variant (owner's D6 standing mandate, re-affirmed 2026-07-17). Each entry: the reference concept + who proved it + our hybrid variant sketch (governed-quadrant twist) + effort class + the wave/stage it folds into.
>
> **Owner:** platform-architect. **Companion:** `BENCHMARK-REFERENCE-PLATFORMS.md` (capability-parity SSOT — this backlog is its action list). The live delivery ledger is the orchestrator's `capability-injection-pipeline` thread (what has actually shipped). **Registry rows (AR-*) are the lead's to write** — this file proposes; it does not set registry status.
>
> **Reading rules.** *Effort:* **S** ≤ few days apps-only · **M** ~1 wave · **L** multi-wave / crosses a `packages/*` seam. *Status:* SHIPPED · REGISTERED (AR exists, unbuilt) · NEW (this cycle). Every entry obeys the laws: config-is-data (Law 2), arrow-clean (Law 3), whole-standard (Law 4), OCP/additive (Law 8), honest states (Law 11). MT stays deferred (AR-30) — no entry requires it.
>
> _Created 2026-07-17 (platform-architect, D6 cycle). Ranking = (Constructor/steward leverage × distance-from-standard × wave-fit), WIP=1-safe._

---

## Already shipped this program (delivery ledger — do not re-propose)

| # | Capability | Reference lineage | Evidence |
|---|-----------|-------------------|----------|
| P-1 | **Dynamic property binding** (`$bind` + literal↔bind toggle + live preview) | Builder.io ⚡ · Retool `{{ }}` | SHIPPED (`b69067a`), live-proven; Law-2-aligned (expr-as-data) |
| P-2 | **Conditional formatting / thresholds** (value→state/color, up/down glyph) | Grafana thresholds | SHIPPED (`6318508`/`9edbbe4`/`8202080`); honest + authoring legs |
| P-3 | **Per-breakpoint responsive prop overrides** (authored visually) | Builder.io / Framer | SHIPPED (`1aedd0c`…); absorbed into ONE `ValueAuthoringControl` (not a bolt-on) |
| P-4 | **Schema-aware binding editor** (autocomplete over governed metrics/dims + in-scope refs + ops) | Retool intellisense | SHIPPED (`5e0f5f7`/`6e809fe`); FF-BIND-AUTOCOMPLETE-GOVERNED green |

> Standing debt from the pipeline: TWO Threshold models (`core/field/config.ts` hex `Threshold` vs `core/config/threshold.ts` token-bound `ValueThreshold`) — converge on the token-bound grammar (Strangler), do not re-fork. The projector-label i18n question (architect-owned) stays parked.

---

## Ranked injection queue (deliver top-down, WIP=1)

### 1. Declared data-quality expectations on ingest — **NEW · the headline · L · folds into W2**
- **Reference concept.** A declared, versioned expectation-set that runs on ingested rows and produces pass/fail per rule: not-null, in-range, value-in-codelist, uniqueness, referential, freshness/completeness.
- **Who proved it.** Great Expectations (`expect_column_values_to_*` + checkpoints) · Soda · dbt tests · **Eurostat VTL (Validation & Transformation Language)** + SDMX structural/content validation · **.Stat DQAF** quality dimensions.
- **Our hybrid variant (governed-quadrant twist).** The expectation-set is a **declaration on the self-describing `CanonicalDsd`** (AR-51 seam), lowered through the **same two-tier validation floor** we already own — no second engine (Law 2/4). It is **SDMX-grade, not generic**: rules speak dimensions/codelists/OBS_STATUS, not raw columns. Failures surface through the **Honest-Canvas `Cell` state grammar** (Law 11) — a cell failing an expectation is a *declared* state (never a fake 0 or silent blank), and the steward sees a validation report at the front door. This is the one place we can *exceed* Great Expectations: they validate columns; we validate a **governed statistical fact with provenance**, and the result is projected to the reader honestly.
- **Why here.** W2 is opening the ingest front door RIGHT NOW (J1 upload→published cube). Expectations ride that door instead of being retrofitted. No stronger statistics-native our-better exists in the whole scan.
- **Refusal option.** Ad-hoc post-ingest inspection / trust-the-source (rejected — no declared contract, not reproducible, not Constructor-ready, not honest-state-projected).
- **Fold:** W2 sub-item (after corpus migration lands, before J1 closes) — or, if it over-loads W2, a fast-follow W2.5 gated behind J1. ADR owed (expectation-declaration contract, ≥2 rejected alts: VTL-embedded vs our-own predicate DSL over `@statdash/expr`).

### 2. Time-relative derived metrics as governed nouns — **REGISTERED (AR-49 M3.2) · rank up · L · folds into W2**
- **Reference concept.** YoY / QoQ / growth / cumulative / MTD as *metric declarations*, not per-config hand-derives.
- **Who proved it.** dbt MetricFlow (`cumulative`, `derived` with time-offset, `time_spine`) · Cube (`rolling_window`) · Power BI quick-measures · LookML `dimension_group`.
- **Our hybrid variant.** Extend `MetricInput.at` with a relative-time coordinate `{$prev:'time'}` over `@statdash/expr` (the already-safe, serializable calc target) so growth expresses as a governed calc-metric — **no query language** (FF-AUTHOR-NO-QUERY holds), byte-identical through `resolveMeasureRef`. Our-better: MetricFlow needs a `time_spine` model + SQL; we derive on the SDMX-native reactive graph, and the derived number is a first-class provenance-carrying NOUN (reusable, certifiable via N3), not a one-off column.
- **Why now.** The scan's sharpened seed-1 finding: ratio/share/derived already ship; **time-relative is the one real semantic-layer gap**. It also kills the recurring `op:if`-growth-derive drift bug-class structurally.
- **Refusal option.** Leave growth as bespoke per-config derives (rejected — ungoverned, non-reusable, re-opens the number-drift class we already firefought).
- **Fold:** W2 metric-definition completion, but **explicitly the heavier engine-crossing seam** (`packages/core`+`expr`+`contracts`) — sequence it as a discrete W2 sub-item AFTER the apps-only corpus migration, never concurrent (WIP=1). Already has an owner one-way-door flag in AR-49.

### 3. Config versioning: semantic diff + one-click rollback + visible history — **REGISTERED (AR-47) · M–L · folds into W5**
- **Reference concept.** Named version checkpoints, a visible history timeline, a diff between versions, one-click rollback, and a draft→review→publish editorial FSM with change-audit.
- **Who proved it.** Builder.io (revision history + scheduled publish) · Figma (named versions + restore) · Grafana (dashboard version history) · Contentful/Sanity (editorial workflow).
- **Our hybrid variant.** Build on the ONE `Publishable` identity (already W5's substrate per the roadmap). **Our-better:** the diff is a **semantic diff over the declaration tree** (which metric rebind, which node moved, which facet changed) — not a JSON text diff — and rollback is **lossless by the visual↔JSON round-trip law**, which text-diff builders cannot guarantee. Change-audit (who/when/why) rides the existing `page_version` rows expanded.
- **Refusal option.** Keep `page_version` rows + undo/redo only (rejected — no multi-author editorial safety the moment Phase-2 non-devs co-author; no rollback = every publish is a one-way risk).
- **Fold:** W5 (publish closes the loop) — this IS the spine of W5, already sequenced. Not a W2 detour. Scheduled-publish + review-comments (N9) fold in here, not as separate rows.

### 4. Dataset-discoverability metadata projection — **NEW · S–M · folds into W5 / AR-28 R1**
- **Reference concept.** Machine-readable dataset metadata so a public dataset is findable and citable: schema.org/`Dataset` JSON-LD, DCAT-AP, CSVW, sitemap.
- **Who proved it.** Google Dataset Search (schema.org/Dataset) · EU data portals (DCAT-AP) · ONS/Eurostat/OWID citation blocks.
- **Our hybrid variant.** A **projection of the declaration we already hold** — the `Publishable` + `ReferenceMetadataContract` (agency/methodology/last-updated/lineage) emit `Dataset` JSON-LD + DCAT at publish, zero new authoring. This is a slice of H-EXPLAIN reached cheaply: the metadata already exists as a declaration; we just project it to a standard. Rides `render(config)` purity (static, nginx-safe, AR-28).
- **Refusal option.** None needed — pure standard-adoption of owned data; YAGNI-gate on a real discoverability trigger (public launch / SEO ask).
- **Fold:** W5-adjacent or AR-28 R1 (SEO scaffolding). Small; do NOT let it derail W2/W5 — admit on a real trigger.

### 5–7. Route-into-registered / hold-the-horizon (do not re-propose as fresh work)
- **5. Manipulate on canvas** (drag/move/keyboard place) — Builder.io/Framer/Figma direct manipulation. **REGISTERED = W4 / ADR-042.** The one open *authoring-functionality* gap; already sequenced. Hold.
- **6. Source→pixel lineage as a read** — Sigma/OpenLineage/Power BI. **REGISTERED = AR-43 / H-LINEAGE (Stage 2).** Steward change-impact already ships; reader-facing lineage is the horizon. Hold.
- **7. Metric certification lifecycle** (draft→certified→deprecated badge) — Tableau Certified / Power BI endorsement. **REGISTERED = AR-50 lifecycle / N3.** Small, high stats-value; admit after W2's catalog-validator lands (a real certification consumer).

### Explicitly refused this cycle (out of the governed-stats domain — YAGNI, not oversight)
- **A/B testing / experiments** (Builder.io) — a published national statistic is not A/B-tested; refuse.
- **Alerting / subscriptions** (Grafana/Metabase) — no per-request freshness need on governed published stats; the publish FSM is the trigger, not an alert loop. Defer until a real "data updated → notify" consumer.
- **Row-level security / RLS** (Looker/Superset) — belongs to the deferred multi-tenancy seam (AR-30); do not build ahead of MT.

---

## The executing-gate note (not a capability — a precondition)
The single highest-leverage non-feature item in the scan is **Stage-0 CI resurrection** (AR-53): until CI executes unit + DB-gated + e2e + J1–J6 journeys on every push, every "SHIPPED/BUILT" claim above is agent-testimony, not machine-truth. This backlog's delivery discipline (WIP=1, live-proven on :3013) is the interim substitute. It is blocked on an owner door (`gh auth` + push, or a Docker runner) — flagged, not this backlog's to unblock, but named because it gates the *quality bar* every injection is measured against.

## Maintenance
- When an entry is accepted, the lead registers/advances it in `ARCHITECTURE-REGISTRY.md` (AR-*) and this row points to the AR. This file never becomes a second competing registry.
- Re-rank at every Leader's Scan against the refreshed `BENCHMARK-REFERENCE-PLATFORMS.md`. YAGNI governs net-new surfaces — a candidate waits for a real consumer.

## Archaeology revivals (2026-07-18 — dig report: `docs/architecture/audit/ARCHAEOLOGY-2026-07-18-lost-concepts.md`)

Mined from docs/archive + examples on the owner's ask; both owner-remembered shapes (href/fromSDMX per-spec source · tree-field derive) verified ALIVE (absorbed/upgraded). Four fragments worth reviving, ranked:

- **R1 · Remote self-describing structure** for external SDMX sources (`structureUrl` — the Tier-2/3 envelope's good half). Anchor: SDMX Registry structure endpoints · Grafana getMetadata · Power BI composite models. Folds: AR-51 + W-P6 Floor-1 (unify the D-HREF door with AR-51 as ONE item). Effort M–L; trigger = the first real external source.
- **R2 · One hierarchy grammar** — tree-field ops reify from the governed codelist (today: three coexisting lookup surfaces). Anchor: SDMX HierarchicalCodelist · LookML drill_fields · Power BI/Cube hierarchies. Folds: ADR-034 S4 seam. Effort S–M.
- **R3 · Perspective facet (small multiples)** — axis `render:'switch'|'facet'`. Anchor: Vega-Lite facet/GoG · Power BI small multiples. Folds: AR-31 lattice. Effort M; YAGNI-gated on a real trellis ask.
- **R4 · Extract/freeze** — snapshot a live query into a `static` source. Anchor: Tableau Extract · Power BI Import · Superset upload-to-dataset. Folds: AR-48 delivery port (built, unwired). Effort S–M.
