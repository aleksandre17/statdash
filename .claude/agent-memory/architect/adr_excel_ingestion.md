---
name: adr-excel-ingestion
description: ADR-0030 — canonical declarative Excel→SDMX-cube ingestion (mapping spec standard, 3 GeoStat NA DSDs, code-from-label, DQAF validation, upload-time adapter seam feeding the existing Staged Submission Pipeline)
metadata:
  type: project
---

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
