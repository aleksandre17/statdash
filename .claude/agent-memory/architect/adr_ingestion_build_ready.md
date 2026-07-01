---
name: adr-ingestion-build-ready
description: ADR-0031 — THE build-ready consolidated design for the generic, self-describing canonical-workbook parser + ingestion. Reads STRUCTURE+CL_*+DATA workbooks (no per-file mapping), emits the existing bronze contract (RawObsRow/RawClassifierRow/RawDisplayRow), feeds createSubmission → the existing Staged Submission Pipeline (conform/validate/publish/SCD-2). Bakes in 6 canonicalization improvements as real seams (OCP self-describe, codelist/DSD declare-OR-reference registry+versioning, validation-as-data VTL-ready RuleSpec, W3C PROV provenance, data-contract compat-check BACKWARD/FORWARD/FULL, SIMS/ESMS metadata slot + reserved Serializer/QuerySpec ports). Byte-precise parallelizable wave roadmap with BAKE-NOW vs YAGNI-SEAM markers + nothing-missed edge-case checklist. Consolidates ADR-0030 (excel-ingestion), the schema-evolution rules, and the North-Star.
metadata:
  type: project
---

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
