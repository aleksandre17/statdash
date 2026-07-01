---
title: Ingestion Pipeline (generic canonical-workbook parser + declarative mapping)
status: Proposed (build-ready)
date: 2026-06-26
authors: architect (Opus)
consolidates: adr_ingestion_build_ready (ADR-0031), adr_excel_ingestion (ADR-0030)
supersedes: architect memory adr_ingestion_build_ready + adr_excel_ingestion (now slim pointers)
---

# ADR-004 — Ingestion Pipeline

**Status:** Proposed (build-ready — architecture decided, executable in parallel waves without re-deciding). The generic canonical-workbook parser is the PRIMARY steady-state path; the per-template declarative mapping spec (originally ADR-0030) is DEMOTED to the SECONDARY legacy→canonical path. This ADR consolidates both.

## Context

The 3 real GeoStat National-Accounts source files are the authoritative source for the seeded datasets (GDP_ANNUAL / ACCOUNTS_SEQUENCE / REGIONAL_GVA). Two designs address getting them (and future data) into the cube: (1) a per-file **declarative `TemplateMapping` spec** (Frictionless + Tidy + SDMX-CSV, code-from-label, DQAF validation) feeding the existing Staged Submission Pipeline; and (2) a **generic, self-describing canonical-workbook parser** that reads `STRUCTURE` + `CL_<DIM>` + `DATA` tidy sheets with zero hardcoded dimension names (Law 1), emits the existing bronze contract, and feeds the same pipeline. The canonical workbook is effectively a small SDMX-lite interchange DSL. Both target the contracts that verifiably exist on disk (`apps/api/src/ingest/*` submit→worker→conform→validate→publish→upsert); DB-side migration steps are flagged where the DDL was not present in the checkout.

## Decision

- **PRIMARY path: one generic `parseCanonicalWorkbook(sheets): BronzePayload`** that interprets the self-describing DSD/codelists/observations, iterates `STRUCTURE.dimensions` generically (no privileged dims), emits the existing `{ obs, classifiers, displays }` bronze contract, and calls the existing `createSubmission()` — from there the existing conform → validate → publish → gold + SCD-2 pipeline runs unchanged.
- **SECONDARY path: the declarative `TemplateMapping` interpreter** (ADR-0030) converts non-conformant source files INTO canonical workbooks offline (the `work/legacy-to-canonical/*` wave already does this). Legacy files never get a bespoke parser each.
- **Bake 6 canonicalization improvements as seams, not bolt-ons:** OCP self-describe, codelist/DSD declare-OR-reference registry + versioning, validation-as-data (VTL-ready `RuleSpec`), W3C PROV provenance, data-contract compat-check (BACKWARD/FORWARD/FULL), SIMS/ESMS metadata slot + reserved Serializer/QuerySpec ports.
- **Pattern stack:** Pipe-and-Filter · Interpreter · Registry (op / codelist-DSD / rule / serializer) · Adapter + Anti-Corruption Layer (xlsx confined to one file) · Idempotent Receiver + SCD-2.

## Rejected Alternatives

1. **Per-file parser scripts (one bespoke parser per source workbook)** — REJECTED as Shotgun Surgery: every new file would need new code; the generic self-describing parser reads any conformant workbook with zero new code.
2. **Keep the per-template `TemplateMapping` as the PRIMARY steady-state path** — REJECTED: mapping specs are the right tool for *non-conformant* legacy files, but the steady state should be a self-describing canonical format, so mapping is demoted to secondary (superseded-as-primary, not deleted).
3. **A vendor spreadsheet SDK in the worker hot path / logic-in-config** — REJECTED: xlsx idioms must not leak past the Adapter boundary, and logic in the mapping config forfeits the Constructor moat (a function in config is not authorable).
4. **Model everything now (full VTL engine, full SIMS, serializer)** — REJECTED (YAGNI): those go in as reserved seams/ports with named triggers, not built blind.

## Consequences

- Positive: one parser for all conformant data; legacy handled by an offline converter; SDMX/VTL/PROV capabilities enter as seams, preserving the declarative moat.
- Negative / cost: DB-side steps depend on migrations that were not all present in the checkout (flagged); `xlsx` must become a declared dep of `apps/api` (currently reached transitively).
- Follow-ups: the reserved Serializer (`?format=`) and QuerySpec ports connect this to [[ADR-015]] (Statistical Platform North-Star).

---

## Detailed Records (preserved verbatim from architect memory)

> Two original records follow, migrated from `.claude/agent-memory/architect/`. ADR-0031 (build-ready) is the primary; ADR-0030 (excel-ingestion) is preserved as the secondary-path record.

### A. Generic canonical-workbook parser + ingestion (ADR-0031, build-ready — PRIMARY)

# ADR-0031 — Generic canonical-workbook parser + ingestion (THE build-ready design)

**Status:** Build-ready. Architecture decided; executable in parallel waves without re-deciding. Supersedes nothing; **consolidates** [[adr-excel-ingestion]] (ADR-0030 — the per-template mapping spec, now demoted to the SECONDARY path), the schema-evolution governance rules, and [[adr-statistical-platform-north-star]] (the serve/VTL/PROV ports) into ONE implementable plan.
**Date:** 2026-06-26.
**Related:** [[ingestion-architecture]] (Staged Submission Pipeline) · [[vintage-release-adr]] (V25) · [[content-constraint-adr]] (V26) · [[classifier-code-path-adr]] (V23/24) · [[i18n-db]] · [[adr-statistical-platform-north-star]].

> **Honesty note (verified on disk THIS checkout, 2026-06-26 — not from frozen memory).**
> - **EXISTS + load-bearing:** `DATA/canonical/{ACCOUNTS_SEQUENCE,GDP_ANNUAL,REGIONAL_GVA}.xlsx` (the 3 conformant canonical workbooks — confirmed by direct probe); `work/legacy-to-canonical/*` (the converter wave: `primitives.js`, `build-*.js`, `writer.js`, `read-workbook.js`, `region-maps.js`, `validate.js` — the legacy→canonical SECONDARY path, already written); the full `apps/api/src/ingest/*` pipeline (`submit.ts`/`createSubmission`, `worker.ts`/`parseBronze`, `conform.ts`, `validate.ts`, `region.ts`, `publish.ts`, `upsert.ts`, `types.ts`); `apps/api/src/routes/ingest/{index,schemas,projection}.ts`; the `apps/api/src/routes/admin/displays.ts` CSV-at-boundary precedent; `apps/api/src/routes/stats/{datasets,observations,classifiers,releases,reference-metadata.fitness.test,lifecycle}.ts` (the serve surface).
> - **NOT on disk this checkout (frozen-in-memory / another branch):** the migration SQL (`ops/postgres/migrations/*.sql` returns ZERO files — V11/V25/V26/V31 are described by tests + TS but the DDL is absent here); `ops/seed-data/geostat/*.bundle.json`; `fromSDMX` as a real function. **`xlsx@0.18.5` is in the pnpm store but is NOT a declared dep of `apps/api`** (the converter wave reaches it via `platform/node_modules/xlsx`). The plan treats the contracts-that-exist (TS) as the build target and flags every DB-side step as "migration-IF-the-column-is-an-enum/constraint".

---

## 0. The decision in one paragraph

The CANONICAL workbook (`STRUCTURE` + `CL_<DIM>` + `DATA` tidy sheets) is a **self-describing SDMX-lite interchange format**. Build ONE **generic parser** — `parseCanonicalWorkbook(sheets): BronzePayload` — that reads the DSD from `STRUCTURE`, the codelists from each `CL_<DIM>`, and the tidy observations from `DATA`, with **zero hardcoded dimension names** (Law 1: it iterates `STRUCTURE.dimensions`, building `Record<dim, …>`). It emits the EXISTING bronze contract (`{ obs: RawObsRow[], classifiers: RawClassifierRow[], displays: RawDisplayRow[] }`) and calls the EXISTING `createSubmission()` once per kind — from there the EXISTING pipeline (conform → validate → publish → gold + SCD-2) runs unchanged. The legacy per-template `TemplateMapping` interpreter (ADR-0030) becomes the **SECONDARY** path that converts non-conformant source files INTO canonical workbooks offline (the `work/legacy-to-canonical/*` wave already does this); the **PRIMARY** steady-state ingest is this generic parser over any conformant workbook. The 6 improvements are designed as the parser's seams/contracts, not bolt-ons.

**Pattern stack:** Pipe-and-Filter (read → resolve-DSD → build-codelists → emit-bronze, then the existing conform/validate/publish) · Interpreter (the parser walks the self-describing structure) · Registry (op / codelist-DSD / rule / serializer — the 4 OCP extension points) · Adapter + Anti-Corruption Layer (xlsx confined to one file; the workbook's spreadsheet idioms never leak past the boundary) · Idempotent Receiver + SCD-2 (existing). Anti-patterns refused: no per-file parser scripts (Shotgun Surgery), no vendor SDK in the worker hot path, no logic-in-config (forfeits the Constructor moat).

---

## 1. The canonical workbook format (verified contract — the input grammar)

Probed directly from the 3 files. This is the grammar the parser interprets; it is a small, orthogonal DSL (Model-Driven Engineering, §12).

### 1.1 `STRUCTURE` sheet — the DSD, as key/value rows
```
key            | value
dataset_code   | ACCOUNTS_SEQUENCE
name_ka        | ეროვნული ანგარიშების მიმდევრობა
name_en        | Sequence of National Accounts
dimensions     | time,account,side,measure        ← ORDERED series-key; CSV of dim codes
measure        | OBS_VALUE                          ← the measure concept
unit_default   | GEL_MN
source         | GeoStat
vintage        | 2026-06-26
```
- `dimensions` is the **SSOT for the dim set + order** — the parser reads it, never assumes `time`/`geo`. (Law 1 enforced at the boundary.)
- Keys beyond the core set are the **metadata slot** (improvement 6): `unit_default`, `source`, `vintage` today; `methodology_ref`, `base_period`, `last_update`, `preliminary_policy`, `metadataflow`, `codelist_ref:<dim>`, `dsd_ref` reserved (§7).

### 1.2 `CL_<DIM>` sheets — one per non-time dimension
```
code | name_ka | name_en | parent | order
P1   | გამოშვება საბაზრო ფასებში | Output at market prices | "" | 1
```
- Header is fixed: `code, name_ka, name_en, parent, order`. **`name_<lang>` columns are open** — a new language = a new `name_<lang>` column, discovered by header scan against `config.locale` (improvement 1: no hardcoded `['ka','en']`).
- `parent` (possibly empty) → `RawClassifierRow.parentCode` (the LTREE code-chain hierarchy, [[classifier-code-path-adr]]). `order` → `ord`.
- Sheet name `CL_<DIM>` maps to dim `<dim>` lowercased (`CL_ACCOUNT` → `account`). `time` has no CL sheet (it is the melted axis).

### 1.3 `DATA` sheet — tidy/long observations
```
account | side | measure | time | obs_value | obs_status | seq_pos        (ACCOUNTS_SEQUENCE)
approach| measure | geo | time | obs_value | obs_status | contribution_role  (GDP_ANNUAL)
geo | sector | measure | time | obs_value | obs_status                   (REGIONAL_GVA)
```
- Header = `<non-time dims…>, time, obs_value, obs_status, <attribute columns…>`. The parser splits header into: the dim columns (∈ `STRUCTURE.dimensions`), the fixed `time`/`obs_value`/`obs_status`, and **everything else = attribute columns** → `RawObsRow.obsAttribute` (a `Record<string,unknown>`, generic — `seq_pos`, `contribution_role` flow through with no code change; improvement 1 OCP).
- Already tidy (one obs per row), already coded (dim cells are CODES, not labels) — so the PRIMARY parser does **no melt, no code-from-label, no surrogate translation**. Those transforms live in the SECONDARY (legacy→canonical) path.

**Why this is the right primary boundary:** the canonical workbook IS SDMX-CSV-shaped (DATA = series-key + OBS_VALUE + OBS_STATUS + attributes; CL = codelists; STRUCTURE = the DSD message). Adopting it whole (Law 4) means the parser is a thin, generic, lossless deserializer — the messy idioms (stacked tables, sign markers, bilingual mirror sheets, ka-only files) are already resolved upstream by the converter wave and frozen into a clean, re-runnable artifact.

---

## 2. The parser contract (the core new artifact)

**Location:** `apps/api/src/ingest/canonical/` (a sibling of `conform.ts`/`validate.ts`, INSIDE the ingest bounded context, OUTERMOST ring per the dependency arrow — it may import `xlsx` and the ingest contracts, never `packages/react`).

```ts
// canonical/types.ts — the self-describing structure (parsed from STRUCTURE)
export interface CanonicalDsd {
  datasetCode: string
  name: Record<string, string>            // { ka, en, … } from name_<lang> STRUCTURE rows
  dimensions: string[]                     // ORDERED, from STRUCTURE.dimensions (Law 1)
  measureConcept: string                   // 'OBS_VALUE'
  meta: Record<string, string>             // unit_default, source, vintage, methodology_ref, … (slot)
  codelistRefs: Record<string, CodelistRef>// per-dim: declared (inline CL_) OR referenced (registry id+ver)
  dsdRef?: { id: string; version: string } // whole-DSD reference (declare-OR-reference, improvement 2)
}
export type CodelistRef =
  | { kind: 'declared'; dim: string }                       // members come from this workbook's CL_<dim>
  | { kind: 'reference'; id: string; version: string }      // resolve from the shared registry

// canonical/parse.ts — the generic, PURE interpreter (no DB, no Fastify, no xlsx import here)
export function parseCanonicalWorkbook(
  sheets: Record<string, unknown[][]>,     // already-read sheet matrices (ACL: xlsx confined to reader)
  ctx: { activeLocales: string[] },        // config.locale SSOT, injected (improvement 1)
): {
  dsd: CanonicalDsd
  bronze: { obs: RawObsRow[]; classifiers: RawClassifierRow[]; displays: RawDisplayRow[] }
  parseIssues: ParseIssue[]                // structural (missing sheet, bad header) — fail-fast at boundary
}
```

**Emit mapping (canonical → existing bronze contract, exact):**
- Each `DATA` row → one `RawObsRow`: `{ timePeriod: row.time, dimKey: {<each non-time dim>: code}, obsValue: row.obs_value, obsStatus: row.obs_status, obsAttribute: {<each attribute column>}, rowIndex }`. `dimKey` is built by iterating `dsd.dimensions` (generic) — **the keys are exactly the DSD non-time dims, so `validateObs`'s set-equality check passes by construction** (F-5).
- Each `CL_<dim>` row → one `RawClassifierRow`: `{ dimCode: <dim>, code, label: {ka: name_ka, en: name_en, …}, parentCode: parent||undefined, ord: order, metadata: {}, rowIndex }`.
- Bilingual displays: the canonical CL already carries `name_ka` + `name_en` in the SAME row, so the parser **does NOT duplicate observation data per language** (improvement: multilingual-not-duplicating-data). Display OVERLAYS (curator label overrides, distinct from the official codelist name) remain the separate `displays` lane via `displays.ts` — the parser emits `displays: []` unless the workbook carries an optional `DISPLAY` sheet (SEAM-DEFER).

**Three kinds, three submissions (existing dependency order — codelists → displays → facts):** the upload route calls `createSubmission` once per non-empty kind, in order, so classifier members exist in gold before the facts that reference them are validated (mirrors the existing pipeline contract; `validateObs` checks codes against gold `is_current=true`).

**Fitness nets:** F-1 parser purity (snapshot the 3 fixtures' bronze) · F-5 every emitted `dimKey` key ∈ `dsd.dimensions` (Law 1) · F-6 round-trip (the parsed `CanonicalDsd` is plain data, JSON-loss­less).

---

## 3. The four registries (the OCP extension points — improvement 1)

All four are **data-keyed dispatch tables** (Registry pattern, `discriminant → handler`), giving "no code change to add a classifier/dim/language/format". Each is closed-for-modification (the interpreter never changes), open-for-extension (a new entry = a new capability).

| Registry | Location | Keyed by | Entries now (BAKE-NOW) | Reserved (SEAM-DEFER, trigger) |
|---|---|---|---|---|
| **op registry** | `canonical/ops.ts` (PRIMARY) + reused by `legacy-to-canonical` (SECONDARY) | op name | identity/passthrough (canonical is pre-transformed) | `melt`, `columnsToRows`, `repeatingBlocks`, `fromLabel`, `slug` already EXIST in `work/legacy-to-canonical/primitives.js`+`build-*.js` — promote into a registry when a 2nd legacy template arrives (ADR-0030's YAGNI line) |
| **codelist/DSD registry** | `canonical/registry.ts` (resolution) → gold `stats.classifier` / a future `stats.codelist_version` | `(dim or dsdId, version)` | `declared` resolution = upsert-and-register (the existing codelists path); shared geo/time/measure resolved by `reference` from gold | a `stats.codelist_version` table for explicit SDMX versioning (members added/deprecated across versions) — SEAM-DEFER until the first cross-version diff |
| **rule registry (RuleSpec)** | `ingest/rules/registry.ts` | `RuleKind` | the existing TS validators wrapped as the first registered kinds + the 3 DQAF integrity rules (`BALANCE`/`IDENTITY`/`TOTAL_RECONCILE`) as data | a VTL-2.1 compiled-rule kind — reserve the `runRules(rules, rows, ctx)` port; DO NOT adopt a VTL engine |
| **serializer registry** | `routes/stats/serialize/registry.ts` | `?format=` value | `json` (the current output, byte-identical default) | `sdmx-json-2.0`, `sdmx-csv`, `qb-turtle`, `datapackage`, `parquet`, `prov` — reserve the port, register only `json` |

---

## 4. The six improvements — each as a seam/contract, with BAKE-NOW vs YAGNI-SEAM

### Improvement 1 — OCP-open + self-describing  →  **BAKE-NOW (it IS the parser)**
- The parser reads `STRUCTURE.dimensions` for the DSD (no hardcoded dim names — Law 1, `Record<dim,…>`). Verified necessary: the 3 datasets have different dim sets (`time,account,side,measure` vs `time,approach,measure,geo` vs `time,geo,sector,measure`) and the parser must handle all three with one code path.
- Codelist members extend automatically: `declared` codelists upsert via the existing `codelists` submission → SCD-2 `upsert.ts` (adding a member is additive; the conform/validate path already treats a new code as `newRows`, not an error).
- **New language = new `name_<lang>` column:** the CL header scanner collects every `name_*` column, intersects with `ctx.activeLocales` (from `config.locale`, the SSOT `validate.ts::fetchActiveLocales` already reads). Adding `name_fr` + activating `fr` in `config.locale` = zero code change. **Fitness net F-LANG:** a synthetic CL with a `name_fr` column + `fr` active produces an `fr` label key; with `fr` inactive it is ignored (no leak). (Honours [[feedback-engine-react-locale-agnostic]]: the engine-side test uses `en`/`fr`, never `ka` literals — but this is API-side, where `ka` is legitimate data.)
- New transform-ops / validation-rules / output-formats = registry registrations (§3). **No code change to add a classifier/dim/language** is the headline guarantee, encoded as F-LANG + F-5 + F-DIM (a 4th synthetic dataset with a never-seen dim name parses without edits).

### Improvement 2 — Codelist/DSD registry: declare-OR-reference + versioning  →  **declare = BAKE-NOW · reference + version table = YAGNI-SEAM (trigger: shared codelist or 2nd cross-version diff)**
- **Declare** (self-contained `CL_` sheets): the current 3 workbooks. Resolution = **upsert-and-register** — emit `RawClassifierRow[]`, the codelists submission upserts them (SCD-2), and they become referenceable by `(dim, vintage)` for the next workbook. **BAKE-NOW** (it is the existing codelists path).
- **Reference** (`STRUCTURE` row `codelist_ref:geo = CL_GEO_GEOSTAT/1.0` or `dsd_ref = …`): the SDMX agency-registry model — geo/time/measure shared across the 3 datasets are **not duplicated**; the workbook names them by id+version and the parser resolves members from the registry (gold) instead of an inline CL sheet. **SEAM-DEFER:** add `CodelistRef.kind:'reference'` resolution + the `dsd_ref` STRUCTURE key now (the type union above already carries it); BUILD the resolver when the first workbook actually references rather than declares. Trigger: a 4th dataset wants to reuse `CL_GEO` without re-listing 13 regions.
- **Versioning** (SDMX codelist versions; members added/deprecated, **never hard-deleted**): reserve a `stats.codelist_version` registry keyed `(codelist_id, version)` with member `valid_from`/`valid_to`/`deprecated` columns — but the EXISTING SCD-2 on `stats.classifier` (`is_current`, the code-chain LTREE per [[classifier-code-path-adr]]) ALREADY gives append-only, never-hard-delete member history. **SEAM-DEFER** the explicit version table; **BAKE-NOW** the deprecate-not-delete invariant by reusing SCD-2 (a removed member retires `is_current=false`, never DELETE). Fitness net: re-ingesting a workbook with a member dropped retires it (is_current=false), never deletes the row (edge-case "codelist deprecate-not-delete").

### Improvement 3 — Validation-as-data (VTL-ready)  →  **minimal evaluator + 3 rules = BAKE-NOW · VTL engine = YAGNI-SEAM (trigger: curator-authored rule or .Stat round-trip)**
- Shape the DQAF integrity checks as **declarative `RuleSpec` data**, not hardcoded TS:
```ts
interface RuleSpec {
  id: string
  kind: 'balance' | 'identity' | 'totalReconcile'   // closed vocabulary (no eval, no functions — Law 2)
  datasetCode: string
  severity: 'warn' | 'error'                          // DQAF integrity = warn (surface, never silently drop)
  params: Record<string, unknown>                     // e.g. { epsilon: 0.5, group: ['account'], lhs:'U', rhs:'R' }
}
```
- Add `runRules(rules: RuleSpec[], rows: StagedObsRow[], ctx): ValidationIssue[]` as a **port in `validate.ts`** (the North-Star's silver `RuleSpec`/`ExpectationSet` seam). Ship a **minimal built-in evaluator** for the 3 kinds; reserve the port so a VTL-2.1 engine can later be the interpreter. The `IssueCode` union is extended with `BALANCE_MISMATCH | IDENTITY_MISMATCH | TOTAL_RECONCILE` (the stable output contract stays).
- Wired into the worker for `kind='facts'` after `validateObs`. **warn-severity** → does not block publish (a rounding-level identity gap surfaces with row numbers; only schema `error` blocks). ε is `RuleSpec.params.epsilon` (declared, default 0.5 mln GEL), never hardcoded.
- **No-eval / no-functions** (Law 2 / §12 safe-expression): `params` is pure data; the evaluator dispatches on `kind` via the rule registry. A rule that needs a function in config is rejected (it would forfeit the Constructor moat).
- Fitness net: the GDP_ANNUAL 2010 identity row produces zero `IDENTITY_MISMATCH` within ε; a deliberately-broken fixture produces exactly one warn with the offending rows.

### Improvement 4 — Provenance (W3C PROV) from day one  →  **2 cheap columns + stamp = BAKE-NOW · PROV graph export = YAGNI-SEAM (trigger: audit/reproduce request)**
- Capture lineage on every ingest: `source_digest` (SHA-256 of the workbook bytes — the parser computes it from the uploaded buffer, distinct from `createSubmission`'s `contentHash` of the JSON payload), the parser version, and the submission→release→revision chain (which ALREADY exists: `submission` + `release` V25 + `observation_revision`).
- **Reserve two nullable columns on `stats_stage.submission`:** `source_digest TEXT` + `provenance JSONB` (`{ parserVersion, sourceDigest, sourceFilename, mappingId?, rulesetId? }`), stamped at `createSubmission` (extend `CreateSubmissionArgs` with optional `provenance`/`sourceDigest`). The PROV graph (Entity = observation/dataset, Activity = submission/release, Agent = curator) becomes **derivable** from existing tables — never a parallel store.
- **BAKE-NOW:** the two columns (cheap, additive, migration-IF-DB-side) + the stamp site. **SEAM-DEFER:** the PROV/OpenLineage serializer (reuses improvement-6's serializer port). Full auditability source→transform→cube is achieved by the derivable graph; the export format waits for the trigger.

### Improvement 5 — Data-contract compatibility check  →  **classify + 3 issue codes = BAKE-NOW · compat_mode column = YAGNI-SEAM-light**
- On ingest, compare the workbook's declared DSD/codelists to the registered (gold) ones → classify:
  - **routine** (data only; DSD + codelist members unchanged) → proceed silently.
  - **codelist-extend** (new members, no removals) → `warn` `CODELIST_EXTENDED`, auto-applied (open-extend — the codelist governance the user asked to keep OPEN).
  - **codelist-deprecate** (a previously-present member is absent) → `warn` `CODELIST_DEPRECATED`, retire via SCD-2 (never hard-delete).
  - **DSD-change** (the `dimensions` set/order differs, or the measure concept differs) → **`error` `DSD_INCOMPATIBLE`** unless the workbook declares a new dataset version (a `STRUCTURE` `dataset_version` row, vehicle = V28 supersession). This is the **GATE**: codelist open, DSD governed.
- Formalize as **compatibility modes** (the Schema-Registry vocabulary the North-Star names): **BACKWARD** (new structure can read old data — codelist-extend), **FORWARD** (old structure can read new data), **FULL** (both). The default policy: **codelist = BACKWARD-auto; DSD = FULL-required (mint a version for a breaking change).**
- **BAKE-NOW:** the classifier function `classifyContractChange(declaredDsd, goldDsd): ContractChange` + the 3 new issue codes (`CODELIST_EXTENDED | CODELIST_DEPRECATED | DSD_INCOMPATIBLE`) wired into `validate.ts` as a pre-pass. **SEAM-DEFER-light:** a `compat_mode` column on `stats.dataset` (defaults to the policy above; only needed when a dataset wants a non-default mode). Fitness net: a fixture that drops a dim from `dimensions` produces `DSD_INCOMPATIBLE` (publish blocked); a fixture that adds a CL member produces `CODELIST_EXTENDED` (warn, publishes).

### Improvement 6 — Reference-metadata slot (SIMS/ESMS-lite) + reserved North-Star serve seams  →  **slot wiring = BAKE-NOW · full ESMS tree + serializers + QuerySpec = YAGNI-SEAM**
- The `STRUCTURE` sheet **carries/references** methodology/quality/unit/base-period/last-update/preliminary-policy as extra key/value rows (`unit_default`, `source`, `vintage` exist today; `methodology_ref`, `base_period`, `last_update`, `preliminary_policy`, `metadataflow` reserved). The parser collects ALL non-core keys into `CanonicalDsd.meta` and maps the recognized ones into the V31 `reference_metadata` (ESMS-lite, already exists per the `reference-metadata.fitness.test.ts` on disk) at publish. **BAKE-NOW:** collect `meta` + map the keys V31 already accepts; **SEAM-DEFER:** the full ~21-concept ESMS/SIMS predicate-row engine behind V31's `metadataflow_code` seam (no consumer today — explicit YAGNI).
- **Reserve the Serializer port** (`routes/stats/serialize/`): a `?format=` content-negotiation slot over `routes/stats/{observations,datasets,classifiers}.ts` query results → SDMX-REST / DCAT / RDF-Cube / Data-Package / Parquet / PROV-export. **BAKE-NOW:** register ONLY the `json` serializer (byte-identical to today — expand-contract/Postel); **SEAM-DEFER:** all standard formats (trigger: first ecosystem consumer). One seam, six future capabilities (the North-Star's single highest-leverage decision).
- **Reserve the QuerySpec boundary** in front of the store so OData/GraphQL become **parsers** producing the same internal `ObsQuery` the routes already build (`observations.ts` `ObsQuery` is the seam). **SEAM-DEFER** entirely (trigger: programmatic-query consumer). Do NOT fork the query path.

---

## 5. The seam map (every new piece + the EXISTING seam it extends)

| New piece | File location | Extends / reuses (verified on disk) |
|---|---|---|
| Generic parser (PURE) | `apps/api/src/ingest/canonical/parse.ts` + `types.ts` | emits the existing `RawObsRow/RawClassifierRow/RawDisplayRow` (`ingest/types.ts`); pure like `conform.ts` |
| Workbook reader (ACL) | `apps/api/src/ingest/canonical/read-workbook.ts` | the ONLY `import xlsx` in `apps/api` (mirrors `work/legacy-to-canonical/read-workbook.js`); `{ defval:null, raw:true }` |
| op / codelist-DSD registry | `apps/api/src/ingest/canonical/{ops,registry}.ts` | the converter primitives in `work/legacy-to-canonical/primitives.js` (liftCode/slugify/makeCodelist) — promote, don't reinvent |
| Upload route | `apps/api/src/routes/ingest/canonical.ts` (or extend `index.ts`) | mirrors `displays.ts` EXACTLY (raw body parser, `requireWrite`, → `createSubmission`, 202+jobId, 409 on dup) |
| RuleSpec port + 3 rules | `apps/api/src/ingest/rules/{registry,evaluator}.ts`; call site in `validate.ts` | the North-Star silver `runRules` seam; `IssueCode` union in `types.ts` |
| Contract-compat classifier | `apps/api/src/ingest/canonical/compat.ts`; pre-pass in `validate.ts` | the DSD set-equality logic already in `validateObs`; V28 supersession as the version vehicle |
| Provenance columns + stamp | `CreateSubmissionArgs` in `submit.ts`; migration on `stats_stage.submission` (IF DB-side) | `submission`+`release`(V25)+`observation_revision` event spine (derivable PROV) |
| Metadata slot → V31 | publish path; `CanonicalDsd.meta` → `reference_metadata` | V31 `reference_metadata` (ESMS-lite, on disk via its fitness test) |
| Serializer port (json only) | `apps/api/src/routes/stats/serialize/registry.ts` | `routes/stats/{observations,datasets,classifiers}.ts` (read/store already separated) |
| `xlsx` declared dep | `apps/api/package.json` | promote `xlsx@0.18.5` from the pnpm store to a declared dep (supply-chain fix) |

**Dependency arrow (Law 3) respected:** every new piece lives in `apps/api` (outermost) and imports the ingest contracts + `xlsx` (a leaf), NEVER `packages/react`. F-3 eslint `no-restricted-imports`: `xlsx` only under `ingest/canonical/read-workbook.ts`.

---

## 6. The byte-precise, PARALLELIZABLE roadmap (waves)

> Owner legend: **impl** = implementer agent · **specialist** = test/fitness-net author · **migration** = schema/issue-code/DB-enum agent · **architect** = me (contracts/ADR) · **user** = a one-way-door sign-off. Every step names files, owner, fitness net, and BAKE-NOW vs SEAM-DEFER(trigger). Steps within a wave are INDEPENDENT (run concurrently); a wave depends on the prior wave.

### WAVE 0 — prerequisites (all INDEPENDENT, run concurrently)
- **0a `xlsx` dependency.** Owner **impl**. Add `"xlsx":"0.18.5"` to `apps/api/package.json`; `pnpm install`; add F-3 eslint rule. Net: build resolves + lint gate. BAKE-NOW. *(Independent.)*
- **0b Issue-code vocabulary.** Owner **migration**. Extend `IssueCode` union in `ingest/types.ts` with `BALANCE_MISMATCH | IDENTITY_MISMATCH | TOTAL_RECONCILE | CODELIST_EXTENDED | CODELIST_DEPRECATED | DSD_INCOMPATIBLE`. IF `stats_stage.validation_issue.code` is a DB enum/CHECK → a migration extends it; if free text → no migration (verify on the real DB; SQL absent this checkout). Net: type compiles; enum migration test. BAKE-NOW. *(Independent.)*
- **0c Provenance columns.** Owner **migration**. Add nullable `source_digest TEXT` + `provenance JSONB` to `stats_stage.submission` (migration-IF-DB-side); extend `CreateSubmissionArgs` (`submit.ts`) with optional `sourceDigest`/`provenance`, persisted in the INSERT. Net: column-exists test + `createSubmission` round-trips provenance. BAKE-NOW (improvement 4). *(Independent.)*

### WAVE 1 — the parser core (depends on Wave 0; 1a/1b/1c INDEPENDENT of each other)
- **1a Workbook reader (ACL).** Owner **impl** → `ingest/canonical/read-workbook.ts`. The ONLY `import xlsx`; `readWorkbook(buffer): Record<sheet, cell[][]>` with `{ defval:null, raw:true }` (preserve numbers). Net: F-3. BAKE-NOW.
- **1b Parser types + DSD reader.** Owner **architect**+**impl** → `ingest/canonical/types.ts` + `parse.ts` (the `STRUCTURE`+`CL_`+`DATA` interpreter, §2; reads `dimensions` generically; collects `meta`; emits bronze). Net: F-1 (snapshot bronze of the 3 fixtures), F-5 (dimKey keys ⊆ dimensions), F-6 (round-trip), F-LANG, F-DIM. BAKE-NOW (improvement 1).
- **1c op/codelist-DSD registry skeleton.** Owner **impl** → `ingest/canonical/{ops,registry}.ts`. Register the identity op + `declared` codelist resolution; reserve `reference`/`dsdRef` resolution (type union present, resolver throws `NOT_IMPLEMENTED` until trigger). Net: registry-dispatch test. BAKE-NOW (declared); SEAM-DEFER (reference — trigger: shared-codelist workbook).

### WAVE 2 — validation-as-data + compatibility (depends on Wave 1; 2a/2b INDEPENDENT)
- **2a RuleSpec port + minimal evaluator.** Owner **impl**+**specialist** → `ingest/rules/{registry,evaluator}.ts` + call site in `validate.ts` (after `validateObs`, `kind='facts'`). 3 rule kinds (`balance`/`identity`/`totalReconcile`), warn-severity, declared ε. Net: GDP 2010 identity → 0 mismatch within ε; broken fixture → 1 warn. BAKE-NOW (improvement 3 minimal); SEAM-DEFER (VTL engine — trigger: curator-authored rule).
- **2b Contract-compat classifier.** Owner **impl** → `ingest/canonical/compat.ts` + pre-pass in `validate.ts`. `classifyContractChange` → `CODELIST_EXTENDED`(warn)/`CODELIST_DEPRECATED`(warn,retire-SCD-2)/`DSD_INCOMPATIBLE`(error unless versioned). Net: drop-a-dim fixture → `DSD_INCOMPATIBLE` blocks; add-a-member fixture → `CODELIST_EXTENDED` warns+publishes. BAKE-NOW (improvement 5); SEAM-DEFER (`compat_mode` column).

### WAVE 3 — the upload route + provenance stamp (depends on Waves 1+2)
- **3a Upload route.** Owner **impl** → `routes/ingest/canonical.ts`: `POST /api/ingest/canonical` (raw `application/octet-stream` body, mirroring `displays.ts`'s no-multipart decision), `requireWrite` (admin|editor) → `readWorkbook` → `parseCanonicalWorkbook` → compute `sourceDigest` → for each non-empty kind in order (codelists → displays → facts) `createSubmission({ format:'canonical-xlsx', payload, provenance })`. 202+jobId; 409 on dup. Net: route test 202 + F-2 idempotency (re-POST same bytes → 409). BAKE-NOW.
- **3b Metadata-slot → V31 mapping.** Owner **impl** → publish path. Map `CanonicalDsd.meta` recognized keys into `reference_metadata` (V31). Net: a workbook with `methodology_ref` lands a reference_metadata row. BAKE-NOW (slot); SEAM-DEFER (full ESMS tree).

### WAVE 4 — reserved serve seam (depends on nothing in 0-3; can run anytime, SEAM-only)
- **4a Serializer port (json only).** Owner **impl** → `routes/stats/serialize/registry.ts` + `?format=` slot on `observations.ts`/`datasets.ts`. Register ONLY `json` (byte-identical default). Net: F-SERIALIZE (json output byte-identical to pre-port — expand-contract). BAKE-NOW (the port); SEAM-DEFER (all standard formats — trigger: ecosystem consumer). *(Independent — parallel with Wave 1-3.)*

### WAVE 5 — the e2e proof (the deliverable's close; depends on Wave 3)
- **5a End-to-end.** Owner **specialist**, scripted `*.e2e.test.ts`:
  1. boot api + db (existing dev/test harness).
  2. POST the 3 `DATA/canonical/*.xlsx` through `/api/ingest/canonical` → poll each job (codelists+displays+facts) to `published`.
  3. assert gold: per-dataset `stats.observation` count > 0; ACCOUNTS_SEQUENCE 2010 row present with ka+en classifier labels; GDP_ANNUAL present; REGIONAL_GVA `_T/_T/GVA/2010 = 21821.57` present with `sector=_T`.
  4. hit the bootstrap/cube serve endpoint the geostat front consumes → assert the datasets render (the SAME end-to-end proof already in use).
  Net: the regression anchor — re-ingesting the canonical workbooks always reproduces the live render. BAKE-NOW.

**Parallelism summary:** Wave 0 (3 steps) ∥ → Wave 1 (3 steps) ∥ → Wave 2 (2 steps) ∥ → Wave 3 (2 steps) ∥ → Wave 5. Wave 4 (serializer seam) runs ∥ to Waves 1-3 (no dependency). Critical path: 0 → 1b → 2a/2b → 3a → 5a.

---

## 7. BAKE-NOW vs YAGNI-SEAM ledger (the 6, explicit — don't over-build)

| # | Improvement | BAKE-NOW | YAGNI-SEAM (trigger) |
|---|---|---|---|
| 1 | OCP self-describing | the whole generic parser (STRUCTURE-driven, `name_<lang>` open, attribute columns generic) | new ops in the registry (trigger: 2nd legacy template) |
| 2 | Codelist/DSD declare-OR-reference | **declare** (upsert-register) + deprecate-not-delete via SCD-2 | **reference** resolver + `stats.codelist_version` table (trigger: shared codelist / cross-version diff) |
| 3 | Validation-as-data | the `RuleSpec` port + minimal evaluator + 3 DQAF rules | VTL-2.1 engine as the interpreter (trigger: curator-authored rule / .Stat round-trip) |
| 4 | Provenance (PROV) | `source_digest`+`provenance` columns + stamp (derivable PROV graph) | PROV/OpenLineage serializer (trigger: audit/reproduce request) |
| 5 | Data-contract compat | `classifyContractChange` + 3 issue codes (codelist open, DSD gated) | `compat_mode` column for non-default policy (trigger: dataset wants a non-default mode) |
| 6 | Metadata slot + serve seams | collect `meta` → V31 keys; Serializer port with `json` only | full ESMS/SIMS tree; SDMX-REST/DCAT/RDF/Parquet serializers; QuerySpec/OData/GraphQL (trigger: consumer asks) |

---

## 8. Nothing-missed checklist (edge cases — each confirmed handled or explicitly deferred)

- **Idempotency.** Same workbook bytes → `createSubmission` content-hashes the JSON payload; an identical already-published payload → 409 (existing Idempotent Receiver). Re-ingest after a transient failure proceeds (guards only the published terminal state). SCD-2 `upsert.ts` converges (revised=0/new=0/unchanged=N). ✔ handled (F-2).
- **Deterministic codes.** Canonical DATA cells are ALREADY codes (no slug at primary ingest). The SECONDARY converter's `slugify`/`liftCode` (in `primitives.js`) are deterministic (EN-seeded, collision-suffixed, never random) — re-conversion is byte-stable (`writer.js` sorts by series key + time). ✔ handled.
- **Referential integrity DATA→CL.** Every DATA dim cell must be a member of that dim's CL. Enforced by the codelists-before-facts submission ORDER + `validateObs` UNKNOWN_CODE against gold `is_current=true`. A DATA code absent from CL → `error`, publish blocked. ✔ handled (existing).
- **Missing row = no auto-delete.** A workbook that omits a previously-published observation does NOT delete it (the pipeline upserts; it never DELETEs facts not in the payload — SCD-2 retires only on an explicit revision). ✔ handled (existing SCD-2 semantics). *(Note: a deliberate retraction needs an explicit mechanism — SEAM-DEFER, trigger: first retraction request.)*
- **Codelist deprecate-not-delete.** A member dropped from a CL → `CODELIST_DEPRECATED` warn + SCD-2 retire (`is_current=false`), never a hard DELETE (preserves vintage history). ✔ handled (improvement 2 + 5).
- **Multilingual not duplicating data.** `name_ka`+`name_en` live in the SAME CL row → one `RawClassifierRow` with a `label:{ka,en}` bag; observations are language-agnostic (codes only). No per-language obs duplication. ✔ handled by design.
- **Time-period granularity generic.** `time` cells pass through to `RawObsRow.timePeriod`, validated by the SDMX regex (annual `2020`, but `2020-Q1`/`2020-06`/`2020-01-15` all accepted — same accept-set as the serve route + V9 CHECK). No annual assumption. ✔ handled (existing `isValidTimePeriod`).
- **The 3 flagged source-data issues (from the canonical conversion).** These are resolved UPSTREAM in the converter and frozen into the clean canonical workbooks — the primary parser never re-encounters them, but they are recorded for audit:
  1. *Stacked region×activity×year (REGIONAL_GVA).* `build-regional-gva.js` `repeatingBlocks` already flattened it to tidy `geo×sector×measure×time`; Block A → `sector=_T`, trailing total → `geo=_T`. ✔ resolved upstream.
  2. *Sign markers `(+)/(−)/(=)`.* `primitives.js::liftSign` strips them to `contribution_role` (an attribute column in GDP_ANNUAL DATA), value stays unsigned (GDP identity holds). ✔ resolved upstream → flows through as a generic attribute.
  3. *ka-only regional file + bilingual mirror sheets.* `region-maps.js` curated ka→en for the 11 regions + activities; CL_GEO/CL_SECTOR now carry both `name_ka`+`name_en`. **Flag preserved:** any region/activity the curated map missed emitted `name_en=''` + a converter flag — the compat-check `MISSING_LABEL` (existing) catches a blank EN at validate. ✔ handled, gap visible never silent.
- **Stacked-table positional mapping risk.** `build-regional-gva.js` maps sub-tables to Block-A regions POSITIONALLY and flags a count mismatch — a converter-time `FLAG`, not silent. Confirmed the 3 fixtures parse clean (probed). ✔ handled (SECONDARY path, flagged).
- **DSD change vs codelist extend.** `classifyContractChange` gates a `dimensions` change (`DSD_INCOMPATIBLE` error unless versioned) while auto-applying member additions (`CODELIST_EXTENDED` warn). ✔ handled (improvement 5).
- **Worker never sees Excel.** `parseBronze` only `JSON.parse`s the canonical blob; `format:'canonical-xlsx'` is a provenance label, not a worker branch (verified — exactly the `displays.ts` precedent). The parser runs at the HTTP boundary. ✔ handled by design.
- **`format` enum.** `FactsBody.format` is `enum(['sdmx-json','bundle','csv'])`, `DisplaysBody` is `enum(['xlsx-rows','bundle'])`. The canonical route bypasses these route schemas (it builds the payload server-side and calls `createSubmission` directly, like `displays.ts`), passing `format:'canonical-xlsx'` — a free string at the `createSubmission` boundary (the DB column is text). No enum migration needed for `format`. ✔ verified.
- **Locale SSOT.** `name_<lang>` columns intersect `config.locale` active set (via `fetchActiveLocales`), never a hardcoded `['ka','en']`. ✔ handled (improvement 1, [[i18n-db]]).
- **Supply chain.** `xlsx@0.18.5` promoted to a declared `apps/api` dep + confined to one ACL file (F-3). ✔ handled (Wave 0a).

---

## 9. Consequences (ISO 25010, named)

**Gained:** *Maintainability/modifiability* (a new conformant dataset = a new workbook, ZERO code — the OCP headline; a new language/dim/classifier = data) · *Reusability* (one parser serves every future canonical source) · *Reliability* (DQAF integrity rules + SCD-2 vintaging + the compat gate) · *Auditability* (PROV from day one — derivable graph) · *Compatibility/Interoperability* (the reserved Serializer port makes the platform an ecosystem producer on trigger). **Constructor-readiness** is preserved: the workbook is data a non-programmer authors; the parser is pure `parse(workbook)→bronze`.

**Traded / guarded:** one declared vendor dep (`xlsx`, scanned, ACL-confined) · the SECONDARY legacy→canonical converter is GeoStat-idiom-specific (justified: it is the strangler that feeds the generic primary; it runs offline, never in the hot path) · every North-Star capability is **trigger-gated** (YAGNI is the explicit counterweight to Law 4's "adopt standards whole").

**One-way doors (flag for user sign-off before first public mint):** publishing public SDMX structure IDs / agency+version identity (improvement 6 serializers) and minting DOIs (North-Star #8) are externally-observable — decide agency/version identity ONCE. Until a serializer beyond `json` is registered, no public commitment is made.

**Rejected alternatives:**
1. **Per-file imperative parsers** (`parseGdp.ts`, …). Rejected: not Constructor-ready (logic in code), Shotgun-Surgery per drop, violates Law 2/8.
2. **Parse the workbook inside the worker** (branch `parseBronze` on `format`). Rejected: vendor SDK + I/O in the queue-drain hot path; the worker contract is "JSON blob → rows"; the `displays.ts` precedent parses at the boundary.
3. **Keep the per-template `TemplateMapping` as the PRIMARY path** (ADR-0030 as-is). Rejected for steady-state: it requires a hand-authored spec per template; the self-describing canonical workbook needs NO mapping. ADR-0030's interpreter is retained as the SECONDARY (non-conformant→canonical) path, where its melt/repeatingBlocks/code-from-label ops are genuinely needed.
4. **Build the VTL engine / SDMX-REST serializers now.** Rejected (YAGNI): ship the minimal rule evaluator + reserve the VTL port; register only the `json` serializer + reserve the rest. Build on trigger, additively.


---

### B. Canonical Excel -> SDMX-cube ingestion (ADR-0030, declarative mapping - SECONDARY path)


# ADR-0030 — Canonical Excel → SDMX-cube ingestion (declarative mapping spec)

**Status:** Proposed (architecture decided; awaits the 5 user decisions in §9 before build).
**Date:** 2026-06-26.
**Supersedes nothing.** Extends ADR-0026/0028 (bootstrap runner / de-tenant) and consumes the seams of the existing Staged Submission Pipeline (V11+), ADR-0025 (vintage-as-release), ADR-0027 (ContentConstraint).
**Scope:** the 3 real GeoStat National-Accounts Excel files in `DATA/` are the AUTHORITATIVE SOURCE for the already-seeded datasets GDP_ANNUAL / ACCOUNTS_SEQUENCE / REGIONAL_GVA. This ADR makes their ingestion a **data-driven, Constructor-ready capability**, not bespoke per-file code.

> **Honesty note up front (verified on disk, not from memory).** Architect-memory claims `ops/postgres/migrations/` and `ops/seed-data/geostat/*.bundle.json` and an `export-seed-data.ts` extraction tool. **None of these exist in this checkout** — `find` returns nothing; `seed.ts`/`seed-pipeline.ts` reference them but the files are absent (frozen-in-time memory, or a different branch). `fromSDMX` is **not** a real function here either (only a string in `packages/plugins/datasources/href-registrations.ts`). What DOES exist and is load-bearing: the full `apps/api/src/ingest/*` pipeline (submit→worker→conform→validate→publish→upsert), the `apps/api/src/routes/ingest/*` HTTP surface, the `apps/api/src/routes/admin/displays.ts` CSV-upload precedent, and `xlsx@0.18.5` in the pnpm store (NOT a declared dep of apps/api). This ADR targets the contracts that exist; the seed-data-file story is treated as one *possible* sink (§7-B), not a prerequisite.

---

## 1. Context — what the 3 files really are (verified with work/inspect-xlsx.js)

| File | Dataset | Layout | Sheets | Real grain |
|---|---|---|---|---|
| `1.National Accounts_Data.xlsx` | ACCOUNTS_SEQUENCE | LONG (row=obs) | GEO + ENG | `time × account × side(Uses/Resources) × measure` |
| `2 GDP მონაცემები.xlsx` | GDP_ANNUAL | WIDE (years as cols) | მონაცემები geo + Data Eng | `time × approach × measure` (geo=GE) |
| `რეგიონული_მშპ_22_12_2021.xlsx` | REGIONAL_GVA | WIDE, **STACKED** | 1 sheet, **ka-only** | `time × geo(region) × activity` |

**File 3 is materially richer than the task brief stated** (verified rows 0–146). It is NOT region×year. It is a **vertically stacked set of sub-tables**:
- rows 1–13 = **Block A**: region × year totals (12 regions + a trailing "მთლიანი შიდა პროდუქტი"/Total GDP row).
- rows 14+ = **one sub-table per region**, each headed by a spacer row carrying the region id in col B (`| 1 |`, `| 2 |`, …), then `activity × year` rows (Agriculture, Manufacturing, Construction, … "სხვა დანარჩენი"/Other).
So the file encodes **region × activity × year**; Block A is the region-marginal (`activity = _T` total). This forces a `sector`/`activity` dimension that the current seed already declares (`upsertDimension(c,'sector',…)` in seed.ts line 195) but which the brief did not mention. **This is the single biggest source-data surprise and the mapping spec must model it as a `repeatingBlocks` extractor — see §4.3.**

**Reconciled with the existing cube DSD** (from `seed.ts` dimension asserts, lines 189–196): declared dimensions are `measure, time, geo, approach, account, side, sector`. The 3 datasets' non-time DSDs are subsets of these. **Therefore the mapping must EMIT these exact dim codes** — it is a re-ingest of the same DSD, not a new DSD (this is the additive-vs-replace decision, §9-B; recommended = additive re-ingest as a new release/vintage).

**Messy/ambiguous spots in the source (flagged, with how the standard handles each):**
1. **Embedded newlines in region names** (`აჭარის ა.რ.\n`, `სამეგრელო-ზემო \nსვანეთი`) → mapping `clean: ['stripNewlines','collapseWhitespace','trim']` normalises the LABEL; the CODE comes from the stable col-B id, never the label.
2. **Junk row 0** in file 3 (`| 1 | …blanks`) and per-block spacer rows → mapping `skipWhen` predicate (all-data-cols-empty OR name-empty) drops them; the spacer's col-B value is captured as the block's region selector, not an observation.
3. **Totals rows mixed into data** — file 3 "მთლიანი შიდა პროდუქტი"(Total GDP) in Block A; files 1/2 carry balancing-item totals (`(=) GDP`). Decision §9-D: **keep as an explicit aggregate code** (`_T` / `B1GQ`) tagged `obs_attribute.derivation='total'`, NOT silently dropped — DQAF needs them for the reconciliation check, and a chart may legitimately show the total.
4. **Sign markers `(+) / (−) / (=)`** in GDP item labels — decision §9-C: these are **structural role markers, not value signs**. The value column already carries the correct arithmetic sign (imports row r9 is stored positive 10898… and the GDP identity subtracts it). The marker becomes `obs_attribute.contribution_role ∈ {add,subtract,total}`; it is NOT multiplied into obs_value. (Verified: r10 GDP 22148.65 = r6+r7+r8 − r9 = 21220.46+4635.60+7191.22−10898.62. The minus is in the identity, the stored value is unsigned.)
5. **File 3 is ka-only** — no English sheet. Decision §9-A: a curated ka→en map for the 11 regions + the activity codelist (regions/NACE-ish activities have canonical English names). Recommended over en=ka fallback because these are official territorial/ISIC names, not free text.
6. **Year-range divergence** — NA/GDP to 2024, regional to 2021, cube currently shows to 2025. Decision §9-E: ingest each dataset's own native coverage; the cube-profile `timeCoverage` per dataset already supports heterogeneous ranges (no global max-year assumption). Flag preliminary years per the source vintage.
7. **Two id-numbering systems** — file-1 has `account-number` + `aggregate-number` (per-account ordinals, reset each account), file-2 has a sparse `id` (only on the first item of each approach), file-3 has region-id (col B) AND activity-id (col B in sub-tables). None are globally unique. The mapping derives the SDMX **code** from the LABEL (code-from-label, §5) or a deterministic slug, and keeps the source ordinal only as `ord` / `obs_attribute.seqPos` for display ordering — never as the cube key.

---

## 2. Decision (the standard)

Adopt a **DECLARATIVE per-template Mapping Spec** (`TemplateMapping`) — a JSON/typed-DSL document that fully describes how ONE Excel template projects into the SDMX bronze contract (`RawObsRow[] + RawClassifierRow[] + RawDisplayRow[]`). A **single generic interpreter** (`runTemplateMapping`) reads any spec + a workbook and emits the bronze payloads; there is **no per-file imperative code**. The spec is authored once per template and re-used for every monthly/annual drop of that template.

The Excel→bronze transform is an **upload-time ADAPTER** that runs at the HTTP boundary (a new `POST /api/ingest/xlsx` route, or an extension of the curator surface), translating the workbook into the EXACT `Raw*Row[]` shapes, then calling the one authoritative `createSubmission()`. From there the **existing** Staged Submission Pipeline does conform → validate → publish → gold + SCD-2, unchanged. **The worker never sees Excel** (verified: `worker.ts` `parseBronze` only `JSON.parse`s a canonical blob; `format` is a provenance label, not a worker branch — exactly as `displaysRoutes` already does for CSV).

### 2.1 Standards lineage (the "full benefit of standards, not partial" — Law 4)

| Concern | Standard adopted whole | Why / what we take |
|---|---|---|
| Declarative tabular schema | **Frictionless Table Schema + Data Package** | field list, type, constraints, `primaryKey`, `missingValues`; our `TemplateMapping.fields[]` is a Table Schema superset adding melt + code-extraction. |
| Wide→long reshape | **Tidy Data (Wickham)** | one observation per row; the `melt` op turns year-columns into `time` + `value`. Already the platform's stated melt boundary. |
| Target model | **SDMX 2.1 Information Model** | DSD = dimensions + measure + attributes; codelists; concepts. Bronze rows ARE the SDMX-CSV column semantics (DIM keys + OBS_VALUE + OBS_STATUS + attributes). |
| Wire-level interchange | **SDMX-CSV 2.0** column convention | `dim_key` = the SERIES KEY columns; `OBS_VALUE`, `OBS_STATUS`; this is what the existing `format:'sdmx-json'`/`'csv'`/`'bundle'` enum aligns to — we ADD `format:'xlsx-rows'` (already reserved in DisplaysBody schema!). |
| Code-from-label | **SDMX codelist + the SNA 2008 transaction codes** (D1, D2-D3, P3, B8g, B1GQ …) embedded in GeoStat labels | a deterministic extraction rule (§5) lifts the bracketed code; the rest of the label becomes the ka/en display. |
| Validation | **IMF DQAF** + **Frictionless validation** | schema validation (type/required/codelist membership) AND statistical integrity (T-account Uses=Resources balance, GDP-3-methods agreement, totals reconciliation). |
| Vintage / revisions | **SDMX vintaging** via the platform's **ADR-0025 release model** + **SCD-2** (`upsert.ts`) | each ingest = a publication-event release; as-of/revision preserved. |

### 2.2 Patterns
Pipe-and-Filter (extract→reshape→extract-codes→validate→load) · Interpreter (spec walker) + Strategy (per-op: `melt` / `longPivot` / `repeatingBlocks` / `codeFromLabel`) + Registry (op-type → handler, the OCP extension point) · Adapter (Excel→bronze at the boundary, Law 5's "only adapter boundary" generalised to the ingest port) · Anti-Corruption Layer (GeoStat's spreadsheet idioms never leak past the adapter) · Idempotent Receiver + SCD-2 (existing).

---

## 3. The Mapping Spec contract (TemplateMapping — the core artifact)

A typed, serialisable document (JSON now; a visual Constructor authors it later). No functions, no `eval` (Law 2 / §12 safe-expression rule). Proposed shape:

```ts
interface TemplateMapping {
  id: string                       // e.g. 'geostat.gdp_annual.v1'
  datasetCode: string              // 'GDP_ANNUAL' — the gold dataset it feeds
  source: { sheets: SheetRole[] }  // which sheet(s), and the locale each carries
  shape: ShapeSpec                 // long | wide-melt | repeatingBlocks
  dims: DimMapping[]               // each output dimension: where its CODE + LABEL come from
  measure: MeasureMapping          // the value column(s) + unit + decimals
  attributes?: AttributeMapping[]  // obs_attribute sources (seqPos, contribution_role, status)
  clean?: CleanOp[]                // stripNewlines | collapseWhitespace | trim | dropEmptyRows
  skipWhen?: RowPredicate          // declarative row filter (no code): {allEmpty:[cols]} | {labelEmpty:col}
  codelists: CodelistDecl[]        // how each dim's codelist is built (from-labels | curated | source-id)
}

interface SheetRole { name: string; locale: 'ka' | 'en'; role: 'data' | 'data-mirror' }
interface DimMapping {
  dim: string                      // MUST be one of the cube dims: measure|time|geo|approach|account|side|sector
  from: ColumnRef | 'block' | 'melted-time'
  code: CodeRule                   // §5 — fromLabel(regex) | sourceId(col) | constant(value) | slug
  label?: ColumnRef                // the ka/en text after code extraction
}
type CodeRule =
  | { kind: 'fromLabel'; pattern: string; fallback: 'slug' }   // lift bracketed SDMX code
  | { kind: 'sourceId';  col: ColumnRef }                      // stable numeric id (region/activity)
  | { kind: 'constant';  value: string }                       // geo='GE'
  | { kind: 'slug' }                                           // deterministic kebab of the label
```

**Constructor-ready test (the fitness function):** a non-programmer edits a `TemplateMapping` JSON in the admin UI; `runTemplateMapping(spec, workbook)` produces identical bronze to the hand-authored seed. No code change = passes. (§8 net F-6.)

---

## 4. The three DSDs + mapping specs

### 4.1 GDP_ANNUAL (file 2) — WIDE, bilingual
- **DSD non-time dims:** `approach` (production/expenditure/income/derived), `measure` (the item), `geo=GE constant`.
- **shape:** `wide-melt` — id/name/item are key columns; `2010…2024` melt into `time` + `OBS_VALUE`.
- **approach code** ← `fromLabel` on `name` col: "GDP by Production approach"→`PROD`, Expenditure→`EXP`, Income(="Generation of Income")→`INC`; rows 16–18 (real-GDP-growth, GDP-per-capita-USD, GDP-nominal) → `approach=_Z` (not-applicable) with their own measure codes.
- **measure code** ← `fromLabel` on `item` col: lift `(P3)`,`(B1GQ)` etc. where present; else `slug` of the cleaned item (after stripping the `(+)/(−)/(=)` marker, which moves to `obs_attribute.contribution_role`).
- **measure label** ← the cleaned `item` text, ka from `მონაცემები geo`, en from `Data Eng` (same row index = the bilingual join key).
- **unit:** mln GEL (`decimals=1`); growth-rate rows = percent; per-capita = USD — carried per measure-classifier `metadata.unit` (the conform path already reads `metadata`).

### 4.2 ACCOUNTS_SEQUENCE (file 1) — LONG, bilingual, T-account
- **DSD non-time dims:** `account` (Production, Generation of income, …), `side` (Uses | Resources), `measure` (the balancing/aggregate item).
- **shape:** `long` — already one row per cell, BUT each source row carries BOTH a Uses value and a Resources value in two columns → the mapping **splits one source row into up to two observations** (`side=U` from the Uses col, `side=R` from the Resources col), each non-empty value becoming one `RawObsRow`. This is a declarative `columnsToRows: [{col:'Uses',side:'U'},{col:'Resources',side:'R'}]` op.
- **account code** ← `sourceId` from `account-number` col, BUT account-number resets per year (1..6), so the **code** is `fromLabel`/`slug` of the account name (stable across years); account-number → `ord`.
- **measure code** ← `fromLabel` on the balancing-item / aggregate name: `(D1)`→D1, `(D2-D3)`→D2_D3, `(P3)`→P3, `(B8g)`→B8G, `(P51g)` etc.; unlabelled → slug.
- **side codelist:** `{U:'Uses/გამოყენება', R:'Resources/რესურსები'}` — a curated 2-member codelist (constant).
- **attribute:** `obs_attribute.seqPos` ← aggregate-number (display ordering inside an account).

### 4.3 REGIONAL_GVA (file 3) — WIDE + STACKED, ka-only  ← the hard one
- **DSD non-time dims:** `geo` (region), `sector`/`activity`, `measure=GVA constant`.
- **shape:** `repeatingBlocks` — a new op the interpreter must support:
  - **Block A** (rows 1–13): `wide-melt` of region × year; emit `geo=<region-id>`, `sector=_T` (all-activities total), `measure=GVA`. The trailing Total-GDP row → `geo=_T` (whole country) per §9-D.
  - **Blocks B+** (each preceded by a spacer row whose col-B id selects the region): for block with region-id *r*, `wide-melt` of activity × year; emit `geo=<r>`, `sector=<activity-id-or-slug>`, `measure=GVA`.
  - The interpreter detects a block boundary by the spacer-row predicate (`name empty AND col-B is a bare integer`) and re-reads the `name|id|<years>` header that follows.
- **geo code** ← `sourceId` (col-B region id) for Block A; the block's selector id for Blocks B+. **geo label (ka)** ← cleaned region name (stripNewlines). **geo label (en)** ← curated ka→en map (§9-A).
- **sector code** ← `sourceId` (activity id in sub-table col B) — note ids are sparse/non-contiguous (1,3,6,7,8,12,15,16) and some rows have blank id ("სხვა დანარჩენი"/Other → reserve code `OTH`). label(en) ← curated activity map.
- **measure:** single `GVA` (constant); unit mln GEL.

---

## 5. Code-from-label extraction (deterministic, SSOT)

**Rule (one canonical regex, applied by the `fromLabel` op):**
```
SDMX_CODE_RE = /\(([A-Z][A-Z0-9]*(?:[._-][A-Z0-9]+)*)\)\s*$/
```
- Lifts a trailing bracketed token of upper-case letters/digits with `. _ -` separators: `(D1)`→`D1`, `(D2-D3)`→`D2-D3`→ normalise to `D2_D3`, `(P3)`→`P3`, `(B8g)`→`B8G` (upper-cased), `(B1GQ)`→`B1GQ`.
- The **display label** = the label with the matched `(…)` stripped and trimmed → stored as ka/en in `RawDisplayRow.display`.
- **Normalisation:** separators `-`/`.`/space inside the code → `_`; upper-case. So `(D2-D3)` and a future `(D2_D3)` collapse to one code (idempotent, no dup classifier).
- **Fallback for unlabelled items (`fallback:'slug'`):** deterministic = `transliterate(en_label) | slug-of-ka-if-no-en`, kebab, ASCII, max 40 chars, collision-suffixed `_2`. **Deterministic, never random** — re-ingest produces the same code (idempotency requirement). The slug seed is the **English** label where a bilingual sheet exists (stable across ka spelling tweaks); ka-only file 3 uses a transliteration table (flag: needs the curated activity map anyway, so prefer the curated code there).

**Why a single rule, not per-file regex:** SSOT + Constructor-ready. A curator authoring a new template references `codeRule: {kind:'fromLabel', pattern:'SDMX_CODE_RE'}` by name; the platform owns the one pattern.

---

## 6. Bilingual classifier_display

- Files 1 & 2: **GEO + ENG sheets are row-aligned mirrors** (verified: identical row count, identical id/structure). The mapping joins them by **row index within a block** → one `RawClassifierRow` (code) + two `RawDisplayRow` (locale=ka, locale=en). The value is taken from EITHER sheet (identical); the labels from each.
- File 3: ka only → see §9-A curated map. Until that map is provided, en falls back to ka (Postel: render something) BUT flagged `display.metadata.enProvisional=true` so the gap is visible, never silent.
- Locale codes come from `config.locale` (the validate filter already reads this as SSOT — `fetchActiveLocales`), not a hardcoded `['ka','en']`.

---

## 7. The seam + arrow (where it lives)

**A — Adapter at the HTTP boundary (the decision).** New module `apps/api/src/ingest/xlsx/` (sibling of conform/validate, INSIDE the ingest bounded context):
- `template-mapping.ts` — the `TemplateMapping` types + the op registry + `runTemplateMapping(spec, workbook): BronzePayload` (pure, no DB, no Fastify).
- `mappings/geostat-*.mapping.json` — the 3 authored specs (data, not code).
- `read-workbook.ts` — the ONLY place `import xlsx` appears (Anti-Corruption boundary; SheetJS confined here).
- A route `POST /api/ingest/xlsx` (multipart or raw `application/octet-stream` + `?mapping=<id>`), mirroring `displaysRoutes` exactly: parse → `runTemplateMapping` → `createSubmission({kind, format:'xlsx-rows', payload})`. **Reuses the one authoritative `createSubmission`** (SSOT, no second bronze writer).

**Dependency arrow (Law 3) — respected:** the adapter lives in `apps/api` (outermost), imports `xlsx` (a leaf dep) and the ingest contracts; it imports NOTHING from `packages/react`. `xlsx@0.18.5` must be **promoted from the pnpm store to a declared `apps/api` dependency** (it is currently undeclared — a supply-chain smell to fix, §10 step 1).

**B — Output sink (two, both valid, non-exclusive):**
1. **Live path (recommended for the end-to-end proof):** adapter → `createSubmission` → worker → publish → gold `stats.*` → the cube/bootstrap serve endpoints → the live geostat front renders. This is the same end-to-end proof already in use.
2. **Committed-seed path (optional):** `runTemplateMapping` run offline writes `*.bundle.json` files (the `format:'bundle'` shape `seed.ts`/`seed-pipeline.ts` expect) for CI seeding without a workbook. This RESURRECTS the `ops/seed-data/` story the memory describes (currently absent) — only build it if the team wants file-committed seeds; otherwise the live path is sufficient and the workbook in `DATA/` is the SSOT.

**Why NOT in `packages/core`:** core is the pure engine (Law 3 innermost-but-contracts). Excel reading is I/O + a vendor SDK → it belongs in the adapter ring (`apps/api`), exactly as `fromSDMX` was meant to be "the only adapter boundary" (Law 5) — we generalise that: **the Excel→bronze adapter IS an adapter boundary of the same class.** The engine stays pure.

---

## 8. Validation (DQAF) + fitness functions

The existing conform/validate filters already cover **schema-level** DQAF (UNKNOWN_DATASET / DIM_KEY_MISMATCH / UNKNOWN_DIM / UNKNOWN_CODE / ILLEGAL_COMBINATION / INVALID_TIME / INVALID_VALUE / MISSING_LABEL …). This ADR ADDS **statistical-integrity** checks as new closed-vocabulary issue codes (extend the `IssueCode` union in `ingest/types.ts`):

- `BALANCE_MISMATCH` (warn) — ACCOUNTS_SEQUENCE: for each account, Σ(Uses) and Σ(Resources) of a balancing closure must reconcile within ε (T-account double-entry). Verified feasible from the data (each account's closing balancing item appears as the opening Resource of the next).
- `IDENTITY_MISMATCH` (warn) — GDP_ANNUAL: the three approaches must agree (verified r10=r15=r18 all = 22148.65… in 2010) within ε; and the production identity Σ(components) − imports = GDP holds.
- `TOTAL_RECONCILE` (warn) — REGIONAL_GVA: Σ(regions, sector=_T) per year ≈ the Total-GDP row; Σ(activities) per region ≈ that region's `_T`.
- Severity = **warn, not error** (DQAF surfaces, never silently drops — Law: "surface issues, don't silently drop"). A curator sees the imbalance with row numbers and decides; publish is not blocked by a rounding-level identity gap, but IS blocked by any schema `error`.
- Tolerance ε is a per-dataset `metadata.balanceEpsilon` (default 0.5 mln GEL), declared, not hardcoded.

**Fitness functions (Evolutionary Architecture — §5/§8 of the skill):**
- **F-1** `runTemplateMapping` is pure: given the 3 fixture workbooks + the 3 specs, byte-stable bronze output (snapshot test). No DB, no network.
- **F-2** Idempotency: ingest the same workbook twice → second publish reports `revised=0 new=0 unchanged=N` (SCD-2 converges; Idempotent Receiver returns 409 on identical bytes).
- **F-3** Arrow: `xlsx` is imported ONLY under `apps/api/src/ingest/xlsx/read-workbook.ts` (eslint `no-restricted-imports` rule); never in `packages/*`.
- **F-4** Code-from-label determinism: the slug fallback is a pure function of the en label (property test: same input → same code, ASCII-only, ≤40 chars).
- **F-5** DSD conformance: every dim emitted by the 3 specs ∈ {measure,time,geo,approach,account,side,sector} (the cube DSD) — a set-membership test against `stats.dataset_dimension`.
- **F-6** Constructor-ready: a `TemplateMapping` round-trips through JSON.parse(JSON.stringify(spec)) and re-runs identically (lossless, serialisable — no functions in the spec).

---

## 9. DECISIONS THE USER MUST MAKE (do not guess — flagged)

- **A. English labels for file-3 regions + activities (ka-only source).**
  **Recommend: a curated ka→en map** committed as `mappings/geostat-regional.en.json` (11 regions + ~10 activities — they have canonical official English names: თბილისი=Tbilisi, აჭარის ა.რ.=Adjara A.R., სამეგრელო-ზემო სვანეთი=Samegrelo-Zemo Svaneti, …; activities ≈ ISIC sections). Rejected: en=ka fallback (renders Georgian text in an English UI — fails WCAG-comprehension + the platform's bilingual promise). **User must supply/approve the ~21 English strings**, OR accept the provisional fallback (flagged, not silent).

- **B. Replace the current seed, or additive re-ingest?**
  **Recommend: additive re-ingest as a NEW release/vintage (ADR-0025).** The 3 datasets already exist with the same DSD; the workbook is the authoritative source, so a re-ingest should appear as a new publication-event (preserving the prior vintage for as-of). Rejected: destructive replace (loses revision history; violates SCD-2's reason for being). **User confirms: is the current seed data identical to these workbooks (then this is a no-op convergence) or a correction (then a real new release with revised rows)?**

- **C. `(+) / (−) / (=)` sign-marker semantics.**
  **Recommend: presentation/structural role, NOT a value sign.** Verified arithmetically (GDP identity holds with stored values UNSIGNED; the minus lives in the identity, imports stored positive). Becomes `obs_attribute.contribution_role ∈ {add,subtract,total}`. Rejected: multiplying `(−)` into obs_value (would double-count the sign and break the identity). **User confirms** this matches GeoStat's intent (it does, per the data).

- **D. Totals rows (file-3 Total-GDP, file-1/2 `(=)` balancing totals).**
  **Recommend: keep as explicit aggregate codes** (`geo=_T` / `measure=B1GQ`) tagged `obs_attribute.derivation='total'`, not dropped. Lets a chart show the total AND lets DQAF reconcile. Rejected: drop-as-derived (loses the reconciliation anchor; a user asking "show national GDP" then has no row). **User confirms** they want the totals queryable.

- **E. Year-range divergence (NA/GDP→2024, regional→2021, cube shows→2025).**
  **Recommend: ingest each dataset's native coverage; per-dataset `timeCoverage` already supports it.** No global max-year. The cube's "→2025" is a profile artifact, not data — flag if any 2022–2025 cells are expected but absent (they are, for regional: the file stops at 2021). **User confirms** there is no newer regional file (the filename says 2021-12-22; likely the latest available).

---

## 10. Implementation roadmap (byte-precise, ordered, executable without re-deciding)

> Owner legend: **migration** = the migration agent (schema/issue-code), **impl** = an implementer agent, **architect** = me (specs/ADR), **user** = the 5 decisions in §9. Each step names its fitness net.

**Step 0 — user decisions (§9 A–E).** Owner: **user**. Blocks B (en map), the rest can scaffold in parallel. Net: none (a gate).

**Step 1 — declare the xlsx dependency.** Owner: **impl**. Add `"xlsx": "0.18.5"` to `apps/api/package.json` dependencies; `pnpm install`. Net: build resolves; F-3 eslint rule added (`no-restricted-imports` for `xlsx` outside `ingest/xlsx/read-workbook.ts`).

**Step 2 — the mapping-spec contract + interpreter.** Owner: **impl** to `apps/api/src/ingest/xlsx/template-mapping.ts`:
- `TemplateMapping` + `ShapeSpec`(`long|wide-melt|repeatingBlocks`) + `CodeRule` types (§3).
- op registry: `melt`, `columnsToRows`, `repeatingBlocks`, `fromLabel`(SDMX_CODE_RE §5), `slug`, `clean`, `skipWhen`.
- `runTemplateMapping(spec, sheets): BronzePayload` — pure, no DB, no Fastify, no xlsx import (takes already-read sheet matrices). Net: **F-1** (snapshot), **F-4** (slug determinism), **F-6** (round-trip).

**Step 3 — the workbook reader (ACL boundary).** Owner: **impl** to `apps/api/src/ingest/xlsx/read-workbook.ts`: the ONLY `import xlsx`; `readWorkbook(buffer): Record<sheetName, cell[][]>` with `{ defval:null, raw:true }` (preserve numbers, NOT formatted strings). Net: **F-3**.

**Step 4 — author the 3 mapping specs (data, not code).** Owner: **architect** (I write these; they are the architectural artifact) to `apps/api/src/ingest/xlsx/mappings/`:
- `geostat-gdp-annual.mapping.json` (§4.1)
- `geostat-accounts-sequence.mapping.json` (§4.2)
- `geostat-regional-gva.mapping.json` (§4.3) + `geostat-regional.en.json` (from §9-A, after Step 0).
Net: **F-5** (every emitted dim ∈ cube DSD).

**Step 5 — extend the DQAF issue vocabulary.** Owner: **migration** + **impl**. Add `BALANCE_MISMATCH | IDENTITY_MISMATCH | TOTAL_RECONCILE` to `IssueCode` (`ingest/types.ts`) and a new `validateIntegrity(rows, spec)` invoked by the worker for `kind='facts'` (warn-severity). If the `stats_stage.validation_issue.code` column is a DB enum, a migration extends it; if free text, no migration. Net: new fitness test asserting the 2010 GDP identity row produces zero `IDENTITY_MISMATCH`.

**Step 6 — the upload route.** Owner: **impl** to `apps/api/src/routes/ingest/xlsx.ts` (or extend `index.ts`): `POST /api/ingest/xlsx?mapping=<id>` (raw body + content-type, mirroring `displaysRoutes`'s no-multipart decision), curator auth (admin|editor), → `readWorkbook` → `runTemplateMapping` → for each kind (codelists, displays, facts) `createSubmission({format:'xlsx-rows'})`. Order: codelists → displays → facts (the existing dependency order). Net: route test 202 + jobId; **F-2** idempotency (re-POST same file → 409 / unchanged).

**Step 7 — end-to-end proof (the deliverable's close).** Owner: **impl**, scripted:
1. boot api + db (the existing dev compose / test harness).
2. POST the 3 `DATA/*.xlsx` through `/api/ingest/xlsx` (codelists+displays+facts each) → poll each job to `published`.
3. assert gold: `stats.observation` counts per dataset > 0; the 2010 GDP = 22148.65 row present with ka+en display; a regional region (Tbilisi 2010 = 11683.95) present with `sector=_T`.
4. hit the bootstrap/cube serve endpoint the geostat front consumes → assert the dataset renders (the same end-to-end proof already in use, per the task brief).
Net: a `*.e2e.test.ts` that is the regression anchor — re-ingesting the workbooks always reproduces the live render.

**Step 8 — (optional, only if §9-B wants committed seeds) the bundle sink.** Owner: **impl**. A `--emit-bundle` flag on `runTemplateMapping` writes `ops/seed-data/geostat/*.bundle.json` (creating the dir the memory describes but disk lacks), so `seed.ts`/`seed-pipeline.ts` (which reference it) actually have their inputs. Defer unless the team wants file-committed seeds over workbook-as-SSOT.

---

## 11. Consequences

**Gained (ISO 25010):** Maintainability/modifiability (a new GeoStat template = a new JSON spec, zero code — OCP) · Reusability (the interpreter serves every future Excel source) · Reliability (DQAF integrity checks surface real statistical errors; SCD-2 vintaging) · Auditability (every load is a release through the approval gate). **Constructor-readiness** is the headline win: the mapping is data a non-programmer can author (the platform's Phase-2 vision).

**Traded/cost:** one new vendor dep (`xlsx`, now declared + scanned) · the `repeatingBlocks` op is bespoke to GeoStat's stacked-table idiom (justified: file 3 is real and the op is generic — any stacked workbook benefits) · the curated ka→en region/activity map is manual data the user must supply once.

**Rejected alternatives:**
1. **Bespoke per-file parser scripts** (one `parseGdp.ts`, `parseRegional.ts` …). Rejected: not Constructor-ready (logic in code), Shotgun-Surgery on every new drop, violates Law 2/8.
2. **Parse Excel inside the worker** (branch `parseBronze` on `format`). Rejected: puts a vendor SDK + I/O in the queue-drain hot path; the worker's contract is "JSON blob → rows" (verified) and the `displaysRoutes` precedent already parses at the boundary. Keeps the worker pure and the bronze blob the canonical SSOT.
3. **A general spreadsheet-to-anything mapping engine** (full Frictionless + arbitrary transforms). Rejected (YAGNI): build the 4 ops the 3 real files need (`melt`, `columnsToRows`, `repeatingBlocks`, `fromLabel`); add ops when the 2nd real template demands them (the §8 platform-vs-YAGNI balance).
4. **Drop totals + treat signs as value signs.** Rejected: breaks the GDP identity (verified arithmetically) and removes the DQAF reconciliation anchor.
