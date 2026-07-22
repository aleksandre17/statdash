# ADR-052 — Authoring Lifecycle: the revision log + validated-PUT seam (door #2)

- **Status:** Proposed (E0 opening design check — owner approves the shape at E0 review before any build)
- **Date:** 2026-07-22 · **Author:** database-architect (Refinement A, card 0104 wave E0)
- **Decides:** door #2 of `DESIGN-0104-elevation-reference-class.md` (§2·C3, §4 E0 row, §8 Refinement A) — the api-side storage mechanics that the accepted doc carried as an **unverified assumption**. This ADR turns that assumption into verified fact and pins the wire contract.
- **Scope:** design-only. No code, no migration applied. The build lands in wave E0.
- **Stands on:** V3 `config` schema (the existing `config.page_version` append-only precedent), the RFC 9457 Problem seam (`lib/problem.ts` + `@statdash/contracts/problem.ts`), the ratified multi-tenancy seam (`project-multi-tenancy`, `stats.dataset.tenant_id` V6 nullable placeholder), Laws 6/7/9, expand-contract (Ambler/Sadalage).

---

## 1. Ground truth — how config documents are stored today (verified, file:line)

The `config` schema (`ops/postgres/migrations/V3__config_tables.sql`) holds five document families. **Two distinct write disciplines already coexist** — and the corruption incidents landed squarely on the un-versioned one.

| Document | Table(s) | Write path (route) | History today? | Validation today? |
|---|---|---|---|---|
| **page** | `config.page` (identity) + `config.page_version` (append-only snapshots) | `pages.ts:213` PUT — identity UPDATE **+ append a new `page_version`** in one txn | **YES** — `page_version` is append-only; `version_number` trigger-assigned (`V3:85` `assign_version_number()`); `is_published` flag; `GET /:id/versions` (`pages.ts:299`); `POST /:id/publish` (`pages.ts:316`) | **YES** — `guardConfig` runs engine `validateConfig`, REJECT mode on (`pages.ts:24` `ENFORCE_CONFIG_VALIDATION = true`), 400 `configValidationProblem` |
| **data_spec** | `config.data_spec` | `data-specs.ts:60` PUT — **destructive UPDATE** via `buildSetClause`, only `updated_at` trigger bump | **NO — prior body overwritten in place** | **NO** — Zod envelope only (`spec: z.record(z.unknown())`, `data-specs.ts:11`); the spec JSON is opaque |
| **data_source** | `config.data_source` | `data-sources.ts:56` PUT — **destructive UPDATE** via `buildSetClause` | **NO — prior body overwritten in place** | **NO** — Zod envelope only |
| **site_config** | `config.site_config` (TEXT key/JSONB value) | `site.ts` PUT + provisioning `upsertSiteConfig` (`upsert.ts:306`, per-id catalog merge for `metrics`/`dimensions`) | **NO** | partial |
| **nav_item** | `config.nav_item` | `nav.ts` | **NO** | — |

**Who calls PUT.** Every `config.*` route is behind Bearer-JWT (`config/index.ts:17` `authPlugin`). The **panel** is the interactive caller; **provisioning** (`provisioning/upsert*.ts`, git-authored, boot-time) is the second writer and writes through its **own** idempotent, change-gated path (never the HTTP PUT): `upsertDataSource` (`upsert-data-source.ts:21`) and `upsertPage` (`upsert.ts:130`) both `SELECT … FOR UPDATE` then write only on a real `jsonEqual` change.

**Root cause of the incidents, located.** `config.data_spec` and `config.data_source` have **no history and no referential validation** — a PUT overwrites the prior body in place, and the only prior-state that survived a bad write was git provisioning (the `datasetCode` flip; the 8 orphan 0-row scratch specs). The fix is not a patch on the write; it is to **give these documents the discipline `config.page` already has** — append-only revisions + a validation gate — as **one grammar** (C3), not a second bespoke mechanism per table.

**Error contract in place (reuse, do not reinvent).** RFC 9457 `Problem` (`lib/problem.ts:105`) + `ProblemDetails` in `@statdash/contracts` (`problem.ts:37`). A **422** precedent already exists — `accounting-identity` (`problem.ts:78`) carries a machine-readable `violations[]` extension member (§3.2). Referential existence probes have a shared helper: `relationExists` (`lib/relation-exists.ts:43`).

---

## 2. The revision record contract (door #2 — the thing the owner approves)

One record type, doc-kind-agnostic, append-only. **Lives in `packages/contracts`** (`src/revision.ts`) — it crosses the api↔panel boundary (panel reads history/restore; api writes it), which is exactly what the innermost zero-dep contracts layer is for (same rationale as `ProblemDetails`).

```ts
// @statdash/contracts — src/revision.ts (pure types, zero-dep)

/** The config-document families that carry a revision history. */
export type ConfigDocKind = 'data_spec' | 'data_source' | 'site_config' | 'page'

/** A single append-only revision of one config document (full snapshot). */
export interface RevisionRecord {
  id:             string          // UUID — revision identity (PK)
  docKind:        ConfigDocKind   // which config family
  docId:          string          // the document identity (uuid-as-text; TEXT key for site_config)
  revisionNumber: number          // monotonic per (docKind, docId), 1-based, trigger-assigned
  body:           unknown         // the FULL validated document body — restore re-applies this verbatim
  actor:          string | null   // JWT sub, or 'system:provisioning' / 'system:adoption'; null tolerated
  note:           string | null   // optional author message from the publish affordance
  restoredFrom:   string | null   // UUID of the source revision when this row is a restore (lineage, append-only)
  createdAt:      string          // ISO 8601 — append time
  // tenantId is a STORAGE-side seam column (§3), deliberately NOT projected on the wire in single-tenant v1.
}

/** List-view row — body OMITTED for weight (mirrors pages.ts GET /:id/versions). */
export type RevisionSummary = Omit<RevisionRecord, 'body'>
```

**The contract in 5 lines:**
1. **Identity** = `id` (UUID PK). **Logical key** = `(docKind, docId, revisionNumber)` UNIQUE; **ordering** = `revisionNumber` ASC (authoritative; `createdAt` is display-only, immune to clock skew).
2. **Immutable + append-only** — a revision row is never UPDATEd or DELETEd; **restore = a NEW revision** whose `body` is an old body and whose `restoredFrom` points at its source (history is never rewritten).
3. **Full snapshot** — `body` is the complete logical document a PUT can set (`data_spec` → `{name, description, spec, source_id}`; `data_source` → `{name, type, url, config, status}`), so restore is a pure re-apply, no diff replay.
4. **Wire reads:** `GET …/:id/revisions` → `RevisionSummary[]` (no bodies); `GET …/:id/revisions/:revId` → full `RevisionRecord`; restore → `POST …/:id/revisions/:revId/restore` (server re-reads the old body, **re-validates it against today's referential state**, appends a new revision, updates the current row — all in one txn).
5. **Retention:** v1 = keep-all (bodies are small JSON, mirrors `page_version` which never prunes); a keep-last-N / time-window policy is a future additive concern, flagged not built.

---

## 3. Storage design (append-only, additive, reversible)

**One universal table**, generalizing the proven `config.page_version` pattern to every doc kind. New migration `V39__config_revision_log.sql`, purely additive.

```sql
-- V39 (design sketch — not applied)
CREATE TABLE IF NOT EXISTS config.revision (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_kind        TEXT        NOT NULL,
  doc_id          TEXT        NOT NULL,               -- uuid-as-text; TEXT key for site_config
  revision_number INT         NOT NULL,               -- trigger-assigned, monotonic per (doc_kind, doc_id)
  body            JSONB       NOT NULL,               -- full document snapshot
  actor           TEXT,                               -- JWT sub / 'system:*'; nullable
  note            TEXT,
  restored_from   UUID        REFERENCES config.revision(id) ON DELETE SET NULL,
  tenant_id       UUID,                               -- MT seam: nullable placeholder (mirrors V6 stats.dataset.tenant_id)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT revision_doc_kind_chk CHECK (doc_kind IN ('data_spec','data_source','site_config','page')),
  CONSTRAINT revision_unique       UNIQUE (doc_kind, doc_id, revision_number)
);
-- No updated_at: revisions are immutable by design (append-only audit log).

-- Reuse the proven per-parent monotonic-sequence pattern (V3 assign_version_number).
CREATE OR REPLACE FUNCTION config.assign_revision_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.revision_number IS NULL THEN
    SELECT COALESCE(MAX(revision_number), 0) + 1 INTO NEW.revision_number
      FROM config.revision WHERE doc_kind = NEW.doc_kind AND doc_id = NEW.doc_id;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_revision_assign_number BEFORE INSERT ON config.revision
  FOR EACH ROW EXECUTE FUNCTION config.assign_revision_number();

CREATE INDEX IF NOT EXISTS idx_revision_doc    ON config.revision (doc_kind, doc_id, revision_number DESC);
CREATE INDEX IF NOT EXISTS idx_revision_tenant ON config.revision (tenant_id);
```

**Write path (each validated PUT, one transaction — the `pages.ts` PUT shape):**
```
BEGIN
  validate(body)                       -- §4; reject → 422, txn never opens a write
  INSERT INTO config.revision (…)      -- append snapshot; trigger stamps revision_number
  UPDATE config.<doc> SET … WHERE id   -- the current-state row (unchanged read surface)
COMMIT
```
The current row and its revision **move together in one txn** — a crash never leaves a revision without its current row or vice versa (the invariant `pages.ts:213` already upholds for pages).

**`config.page` is deliberately NOT migrated in E0.** Pages already have `config.page_version` with `is_published` semantics that **bootstrap and provisioning depend on** (`upsert.ts:196` promotes the published version; bootstrap reads it). Ripping that into `config.revision` is a destructive, blast-heavy migration — forbidden at E0 and unnecessary. Expand-contract: **the new table serves the un-versioned kinds (`data_spec`, `data_source`, and optionally `site_config`); pages keep `page_version` untouched.** The `RevisionRecord` **contract is universal**: the panel's history UI reads one shape, and pages project `page_version → RevisionRecord` (a thin read-side adapter, `is_published` → an extension the panel already understands). Unifying the two stores (migrating `page_version` into `config.revision` + a separate publish-pointer) is a **named, deferred** future card, not E0. This two-store-one-contract seam is disclosed, not hidden (see SURFACED).

**Tenant seam.** `config.*` tables carry **no `tenant_id` today** (verified: absent from V3; the MT `SCOPED-FACT` set per `project-multi-tenancy` will add it later). The revision table adds `tenant_id UUID` now as a **nullable placeholder**, mirroring the V6 `stats.dataset.tenant_id` precedent (nullable, no FK yet — `stats.agency` does not exist; no RLS enforcement yet — `USING(true)`). Populated from the request's future `app.current_tenant` GUC when MT lands; the column and its index exist now so MT is an additive `USING`-clause swap, not a schema change. `tenant_id` is NOT projected on the wire in single-tenant v1.

---

## 4. The validation seam (the validated PUT)

**Where it sits.** At the **HTTP PUT boundary** of `data_spec` and `data_source` (and later `site_config`), in **one shared validator** (`lib/validate-config-doc.ts`) so the routes cannot drift — the way `guardConfig` already centralizes page-shape validation. It runs **before** the revision INSERT, inside the same txn's guard prologue.

**Trusted vs untrusted writers.** The 422 gate guards **untrusted client input** (the panel PUT). **Provisioning is NOT gated by it** — git-authored, code-reviewed, and the platform's recovery path (Law 7). Provisioning still **appends a revision on a real change** (`actor = 'system:provisioning'`, change-gated exactly like `upsertPage`/`upsertDataSource` today), so the log stays complete and the **per-id catalog merge keeps working** unchanged.

**The four checks (for a `data_spec` PUT):**
1. **Shape** — the spec parses via the engine spec registry (`validateConfig` / `SPEC_CATALOG` — the *same* validator the renderer runs, so server and client cannot diverge; the pages path already proves this seam).
2. **datasetCode exists** — every `datasetCode` the spec references resolves to a real `stats.dataset` row (probe via a catalog lookup; `relationExists` guards the rolling-migration window where the relation may be absent → degrade, don't 500).
3. **source dims ⊆ DSD dims** — a source's declared dimensions are a subset of the referenced dataset's DSD dimensions (`stats.dataset_dimension`). This is the exact check the `datasetCode`-flip incident needed.
4. **metric refs resolve** — every metric id referenced resolves against the governed catalog (`config.site_config` `metrics` key).

**The 422 contract.** A **new Problem kind** `config-invalid` (422 Unprocessable Content — the body is well-formed JSON but its *semantics* reference things that do not exist; the exact shape of the existing `accounting-identity` 422). One kind carries **all four** failure classes as a machine-readable `violations[]` extension member:
```jsonc
// application/problem+json, status 422, type urn:statdash:problem:config-invalid
{ "type":"urn:statdash:problem:config-invalid", "title":"Config document failed validation",
  "status":422, "code":"CONFIG_INVALID",
  "violations":[
    { "check":"dataset-exists", "path":"/spec/query/datasetCode", "ref":"GDP_ANNUAL_X", "detail":"no such dataset" },
    { "check":"dims-subset",    "path":"/spec/source/dims",       "detail":"dim 'foo' not in DSD of GDP_ANNUAL" }
  ] }
```
`check ∈ {'shape'|'dataset-exists'|'dims-subset'|'metric-resolves'}`; `shape` violations embed the engine `ValidationError` fields (`path/code/message/severity`). The panel surfaces `body.violations` in the publish affordance — **never a silent 200 storing corruption** (C3). Factory: one `configInvalid(violations)` helper in `lib/problem.ts` (SSOT, mirrors `accountingIdentityViolation`).

**What it deliberately does NOT validate (scope honesty — Law 11 / the Authoring Canon "the canvas never lies"):**
- **Not emptiness / row-count.** A spec that references a real dataset with valid dims but yields **0 rows** is *structurally valid* — an empty result is an honest canvas state, not stored corruption. The **8 orphan scratch specs** are not stopped by this gate; they are stopped by C3's **other half** — client-side drafts never reach the server until an explicit Publish (no server-side scratch slots). Persistence guards *corruption* (dangling refs, malformed shape), not *emptiness*.
- **Not scope / coverage honesty** (which coordinates actually carry data), **not business meaning**, **not tenant scoping** (single-tenant now).
- **Not cross-document graph consistency beyond direct refs** — a page that references this spec validates on *its own* PUT; this gate validates only the document in hand and the references it *makes*.

---

## 5. Rejected alternatives (storage shape)

1. **Soft-version columns on the doc row** (`revision_number INT` + `prev_body JSONB` on `config.data_spec`). Cheapest, but: no history depth (only the immediately-prior body), cannot restore to an arbitrary point, and it **mutates the live row** — not append-only, so a bad write still overwrites truth. Fails the C3 requirement ("history is append-only, never rewritten"). **Rejected.**
2. **Per-doc version tables** (`data_spec_version`, `data_source_version`, … each mirroring `page_version`). Mirrors the proven precedent exactly, but manufactures **a table + trigger + read path per kind** — a bridge-per-kind that drifts, the anti-pattern Law 10 forbids (extend one grammar, never add a parallel one per kind). The next config family costs a new table. **Rejected** in favor of one polymorphic log.
3. **Event sourcing** (the document is a fold over an append-only event stream; no current-state table). Truthful-by-construction history, but every *read* — bootstrap, provisioning, the renderer — becomes a projection rebuild; the blast radius touches every read path, and merge/replay semantics for config JSON is a project of its own. M-5 overreach for a single-steward panel (the same overreach C3 rejects for "full git-style branching"). The revision log is the **expand-contract floor** a future event model could stand on. **Rejected (YAGNI).**
4. **External audit log only** (reuse `lib/audit-log.ts` for who-changed-what, no body storage). Records the *act* but not the *body* — cannot restore, cannot diff. The audit log stays for governance (actor/action trail); it is not a substitute for versioned bodies. **Rejected as insufficient.**

---

## 6. Rollout (E0 lands this without breaking existing reads / provisioning re-runs)

1. **Migration `V39`** — additive only: `CREATE TABLE IF NOT EXISTS config.revision` + trigger + indexes. **No ALTER/DROP on any existing table.** Zero impact on existing reads at creation time (nothing reads `config.revision` until the new endpoints ship).
2. **Genesis-adoption backfill (recommended, optional).** Seed one revision-0 per existing `data_spec`/`data_source` row, `actor='system:adoption'`, `created_at = row.updated_at`, `body =` the current row — so history is honest-but-non-empty from day one (the V25 genesis-backfill precedent). Idempotent via `ON CONFLICT (doc_kind,doc_id,revision_number) DO NOTHING`. Reads existing rows only; additive; reversible. If skipped, history simply begins at each doc's first post-adoption PUT (also honest).
3. **Contracts type** — add `src/revision.ts` to `@statdash/contracts`, export from the barrel. Pure additive types.
4. **Validator + 422** — add `lib/validate-config-doc.ts` (the four checks) + `configInvalid` factory + the `config-invalid` registry entry in `lib/problem.ts`. Additive.
5. **Wire the PUTs** — `data-specs.ts` PUT and `data-sources.ts` PUT become `validate → append revision → update current` in one txn (replacing the bare `buildSetClause` UPDATE). **`GET /:id` is unchanged** — it still returns the current row from `config.data_spec`; the revision log is a **new sibling read** (`GET /:id/revisions`, `/:id/revisions/:revId`, `POST …/restore`).
6. **Existing reads untouched.** Bootstrap reads `page_version` + `site_config` — never `config.revision`. `config.page` and its PUT are unchanged. The renderer reads current rows. Expand-contract holds.
7. **Provisioning re-runs keep working.** `upsertDataSource` / `upsertPage` / `upsertSiteConfig` keep their change-gated idempotent paths and their **per-id catalog merge** (`upsert.ts:70` `mergeCatalogById`) exactly as-is; the *only* addition is an in-txn revision append **on a real change** (`actor='system:provisioning'`), which is a no-op on an unchanged re-provision (mirrors the existing `jsonEqual` gate) — so re-provisioning stays idempotent and never churns the log.

---

## 7. Migration risk assessment (the irreversibility gate — run FIRST)

- **Reversibility:** HIGH. The migration is `CREATE TABLE`/`CREATE FUNCTION`/`CREATE INDEX` only — fully reversible by `DROP`. The only irreversible artifact is **accumulated revision data**, which is purely additive (dropping it loses history but breaks no read, since no legacy read depends on it). **Class-M, but the gate passes cleanly — LOW blast radius.**
- **Blast radius:** NONE at creation (no existing table altered, no existing read touched). Non-zero only at step 5 (rewiring the two PUTs) — contained to `data_spec`/`data_source` writes, each independently revertable to the current `buildSetClause` UPDATE.
- **The one real hazard:** the revision append and the current-row UPDATE must be **one transaction** (else a crash between them drifts current-state from its log). Mitigation: the `pages.ts:213` BEGIN/COMMIT shape, already proven. Fitness `FF-REVISION-ON-PUT` asserts every successful PUT produced exactly one revision.
- **Genesis backfill hazard:** reads every existing config row — safe and idempotent (`ON CONFLICT DO NOTHING`); if it fails mid-run it is re-runnable.
- **No irreversible one-way door in the storage** — the single program-level one-way door (this contract becoming public once the panel reads it) is the C3 door #2 the owner is approving here; additive/expand-contract, but a later shape change costs a migration, hence owner sign-off at E0.

---

## SURFACED (beyond the asked scope — flag-name-propose)

1. **Two stores behind one contract (page_version vs config.revision).** Disclosed, deliberate, expand-contract-honest — pages keep their richer `is_published` store; the un-versioned kinds get the new log; the panel reads one `RevisionRecord` shape via a page-side projection. **Propose:** a future card `unify page_version → config.revision + publish-pointer` (deferred; needs a bootstrap-safe migration of `is_published`). Not E0.
2. **Prior-art inconsistency in validation status.** Pages' shape-failure throws **400** (`configValidationProblem`, `pages.ts:51`); the new config-doc validator throws **422** (well-formed body, invalid semantics — the correct code). **Propose:** harmonize pages onto the 422 `config-invalid` kind in a later pass (expand-contract; do not touch the page path in E0).
3. **`site_config` in the log.** `site_config` keys on TEXT (not UUID) and already has the provenance-ledger merge (`upsert.ts:41`). The `doc_id TEXT` column accommodates it, but wiring `site_config` PUT into the revision log interacts with the per-id catalog merge — **defer `site_config` revisioning to a follow-up** within E0 or the next wave; land `data_spec` + `data_source` first (they are the incident surface).
4. **RBAC on publish.** Pages gate publish to `admin` (`pages.ts:78` `PUBLISH_ROLES`). A validated-PUT *is* the publish act for specs/sources — decide whether spec/source publish is `admin`-gated too, or open to any write role. **Propose:** mirror the page rule (publish = admin) for consistency; confirm at E0 review.

## UNVERIFIED ASSUMPTIONS

1. **The spec parser exposes datasetCode / source-dims / metric-refs extraction as a callable seam.** The four checks assume the engine can enumerate a spec's referenced `datasetCode`s, source dims, and metric ids from an opaque spec body (`extractDeps` exists per the fitness corpus, `provisioning/extractDeps-corpus.fitness.test.ts`) — the build must confirm `extractDeps` (or a sibling) yields all three ref classes for every spec kind. If a kind hides a ref, its check is a false-pass.
2. **`stats.dataset_dimension` is the authoritative DSD-dims relation for the dims-subset check.** Named from memory (`project-dsd-completeness`); the build must confirm the exact table/column the DSD dims live in before wiring check #3.
3. **The panel's draft model (C3 client-side half) is the actual defense against 0-row scratch specs** — this ADR asserts the validated PUT does NOT stop empty specs and relies on drafts-never-reach-server. That coupling is stated in the accepted design but the panel side is a separate wave; if drafts are not client-only, orphan scratch specs remain possible and a separate "publishable only when bound" policy would be needed (flagged, not designed here).
4. **No concurrent multi-writer contention on a single doc** (single-steward assumption). `revision_number` is trigger-assigned under the row's implicit lock, but true optimistic-concurrency (reject a PUT whose base revision is stale) is **not** in v1 — two panels editing one spec is last-write-wins at the current row (though every write is preserved as a revision). If multi-author lands, add an `If-Match: <revisionNumber>` precondition (expand-contract). Named, not built.
