---
name: store-cube-region-scoping
description: Stats store builder scopes wire-dim classifiers to the dataset's actualRegion; dev DB carries TWO sector vocabularies (data-governance flag)
metadata:
  type: project
---

Since 2026-07-16 (portal review round 2), the 'stats' store builder
(`platform/packages/plugins/datasources/stats-registrations.ts`) constrains each
WIRE dim's classifier to the realised member set of the dataset's cube
`actualRegion` (profile fetch, V26 SSOT) via core `constrainClassifier`
(`packages/core/src/data/codelist.ts`) — ancestors kept, fail-open on degraded
profile/empty realised set, auxiliary classifiers (e.g. accounts `aggregates`)
untouched.

**Why:** the classifier endpoint is dim-GLOBAL and the dev DB's `sector` dim
holds TWO current vocabularies — seed-bundle short codes (AGRI/MANUF/…, the ones
facts realise) AND numeric-NACE codes seeded by
`ops/postgres/migrations/beforeEachMigrate.sql` for the canonical-workbook
ingest (`DATA/canonical/REGIONAL_GVA.xlsx` CL_SECTOR uses 1/3/6/…/OTH). The
regional sector multi-select showed every category twice. FLAGGED to the lead as
a data-governance item: the two vocabularies still coexist in the DB; the store
scoping makes the UI follow the observations whichever way it is reconciled.

**How to apply:** duplicate/foreign options in ANY dim selector → check the
dim-global codelist vs the dataset's realised region first, never patch the
control. If facts ever migrate to the numeric-NACE vocabulary, options flip
automatically — no UI change needed.
