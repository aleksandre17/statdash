---
name: data-source-provisioning
description: config.data_source boot provisioning — status MUST be written 'connected' (DB default is 'idle' which the public read hides); url MUST be NULL for single-origin
metadata:
  type: project
---

Boot provisioning of `config.data_source` (the rows geostat front + panel read via `GET /api/data-sources` to build their store manifest) lives in the file-based provisioning pipeline, NOT in a one-off script.

- SSOT: `apps/api/provisioning/geostat.provisioning.json` → `dataSources[]` (gdp/accounts/regional). Applied on boot by `runProvisioning` (index.ts after `app.ready()`).
- Per-concern upserter split out to `apps/api/src/provisioning/upsert-data-source.ts` (re-exported from `upsert.ts` to keep the `./upsert.js` import surface stable). The 400-line bloat hook forces one-concern-per-file.
- `seed-data-sources.ts` remains for the standalone path.

**Why (two load-bearing gotchas):**
- **status**: V3 column default is `'idle'`, but the public route filters `WHERE status='connected'`. So the provisioning path MUST write `status` explicitly (defaults to `'connected'` in upsertDataSource, mirroring a page defaulting to `'published'`). Relying on the column default → invisible source.
- **url=NULL**: single-origin reverse-proxy topology — SPAs call api same-origin via relative `/api`; `toSourceDescriptor` uses a NULL url to fall back to the front's relative base. NEVER localhost. Omit `url` in the manifest → parser yields undefined → upserter writes NULL.

**How to apply:** when touching data-source seeding/provisioning, preserve both invariants. The no-DB fitness gate `geostat-provisioning.fitness.test.ts` asserts url==null + status==connected + datasetCode/nonTimeDims on the committed artifact; the idempotency/upsert behavior is in `loader.data-source.test.ts`. Idempotency: unchanged row (type/url/config/status) short-circuits to 'unchanged' (jsonEqual on config), so manually-seeded rows reconcile with zero writes. Related: [[api-shared-seams]], [[scd2-classifier-writers]].
