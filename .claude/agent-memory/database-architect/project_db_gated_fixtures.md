---
name: db-gated-fixtures
description: Live-DB fitness tests must satisfy V14 LocaleString completeness, V28 published projection, and SCD-2 txn-time semantics in their fixtures
metadata:
  type: project
---

The DB-gated fitness suites (apps/api/src/**/*.fitness.test.ts and the live-DB
integration tests) run against a real TimescaleDB where triggers/projections
FIRE — unlike the old mock runs. Fixtures must be live-DB-valid:

- **V14 LocaleString completeness**: any INSERT into a guarded column
  (stats.dimension/classifier/dataset.label, config.page.title,
  config.nav_item.label, stats.unit_measure.label) MUST carry BOTH active
  locales `{ka, en}`, non-empty. `{"en":...}`-only trips
  config.enforce_locale_string. NOTE: stats.concept(_scheme), stats.category(_scheme),
  stats.content_constraint are DELIBERATELY NOT wired to the trigger (labels
  default '{}', filled by provisioning) — completing them is defensive, not required.
- **V28 published projection**: cube-profile / classify / catalog / bootstrap
  read through stats.dataset_published (status IN published,deprecated). A fixture
  dataset defaults to 'draft' and 404s from discovery — insert it with
  status='published', valid_from=now() (or call stats.set_dataset_status).
- **SCD-2 as-of reads**: stats.classifier valid_from/valid_to are stamped with
  now() = transaction_timestamp(), CONSTANT for the whole txn. An open+close in
  one txn has ZERO-width validity, so an as-of read can't sit between a seed and
  its revision. Fixtures must push the seeded valid_from into the past
  (now() - interval) to give the window real width.

**Why:** these tests first ran against the live cube 2026-06 and 13 failed purely
on fixture/data validity (triggers don't fire in mocks).
**How to apply:** when writing or fixing a DB-gated test, make the SETUP satisfy
these three, never weaken the assertion. See [[concept-role-ssot]] for the
related real-data gap.
