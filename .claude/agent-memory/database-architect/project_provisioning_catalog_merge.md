---
name: provisioning-catalog-merge
description: AR-49 M2.2 data-safety — provisioning MERGES site_config.metrics/dimensions per entry-id (existing wins) instead of wholesale replace, so re-provision never wipes steward-authored catalog entries
metadata:
  type: project
---

`config.site_config.metrics` and `config.site_config.dimensions` are the AR-49 semantic catalog a Studio **Steward authors IN-TOOL** (`PUT /api/config/site`, SPEC-authoring-reconception-M2 decision #4). Provisioning seeds the SAME keys, so a naive re-provision (wholesale value replace) would clobber steward-authored metrics/dimensions on every boot.

**Fix (landed in `apps/api/src/provisioning/upsert.ts`):** `upsertSiteConfig` now branches on `GOVERNED_CATALOG_KEYS = {metrics, dimensions}`. For those keys with an existing value it calls `mergeCatalogById(stored, provisioned)` — a **per-`id` union, existing wins**: every stored entry kept verbatim (steward entries survive), each provisioned entry appended ONLY when its `id` is absent. Identity field is `id` for both catalogs. Every OTHER site_config key keeps wholesale last-write-wins replace (unchanged). Fresh-seed (create) path writes provisioned verbatim.

**Why per-id merge over plain seed-if-absent (§14.4 offered both):** seed-if-absent at whole-key granularity freezes the catalog after first boot (a new provisioning metric never lands). Per-id merge is strictly better — data-safe AND still seeds genuinely-new provisioning entries after the key exists.

**Accepted trade-off (documented in code + SPEC §4.3/§14.4):** a provisioning UPDATE to an entry whose `id` already exists in the DB will NOT apply while that id is present (existing/steward wins). Per-entry provenance/versioning that would let provisioning + stewards co-own an id is the later relational-table concern — **AR-47** (expand-contract from the JSON blob). See [[governed-dimension-catalog]] for the seed shape.

**Safety edges:** if either side is not an array (corrupt/legacy value), `mergeCatalogById` returns null and the upsert SKIPS with a warn (never clobbers). Id-less provisioned entries are skipped (not appended) to keep re-provision idempotent — governed entries are id-bearing by contract (config-cube-contract).

**Proof:** `apps/api/src/provisioning/loader.test.ts` — steward metric survives re-provision (→ unchanged), new provisioning metric seeds while steward entry preserved (→ updated), steward-edited same-id metric not overwritten, non-governed keys still fully replace. No live DB needed (FakePg). Change is api-only, additive, no contract/wire change.
