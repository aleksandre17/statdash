---
name: accounts-aggregates-classifier-load
description: Accounts SNA chart empty root cause — store-builder loaded classifiers only from nonTimeDims so the auxiliary `aggregates` classifier ($cl/$d join) never loaded; ACL also dropped metadata.isClosing
metadata:
  type: project
---

The accounts hero `hbar-diverging` + per-account repeat panels rendered empty/label-less because the `aggregates` classifier (joined via `{$cl:'aggregates'}` for isClosing and `{$d:'aggregates'}` for label/color, `on:'measure'`) was NEVER LOADED into the live store. Three compounding seams (all in platform/):

1. **Store-builder loaded classifiers only from `nonTimeDims`** (`packages/plugins/datasources/stats-registrations.ts`). `aggregates` is an AUXILIARY classifier (keyed by measure code, carries isClosing) referenced by `$cl`/`$d` but it is NOT a wire-filter dimension. Fix: load classifiers from `classifierDims` (a SUPERSET of nonTimeDims), unioned with nonTimeDims; the ApiStore still gets `nonTimeDims` for the wire filter. `classifierDims` already existed in the data-source config "for the Constructor's future use" — now it's wired.
2. **The classifier ACL dropped `metadata`** (`packages/plugins/datasources/stats-api.ts` → extracted to new `stats-classifiers.ts` for the 400-line ceiling). `fromStatsClassifiers` mapped only code/label/color/parent; `isClosing`/`account` live in `metadata:{...}`. Added `liftClassifierMetadata` (generic, Law 1) so every scalar metadata key becomes a first-class entry attr the `$cl` join reads. Explicit columns win over same-named metadata keys.
3. Config change: added `"aggregates"` to the accounts `classifierDims` (provisioning JSON + seed-data-sources.ts).

**MISDIAGNOSIS TRAP (cost real time):** I first "fixed" the account dim codes from long (`production-account`) to short (`production`) because `ops/seed-data/geostat/facts/ACCOUNTS_SEQUENCE.bundle.json` used SHORT codes. WRONG — that bundle is STALE. The SSOT is the **canonical workbook** `DATA/canonical/ACCOUNTS_SEQUENCE.xlsx` (read via `apps/api/src/ingest/canonical/read-workbook.ts`): its `CL_ACCOUNT` AND `DATA` sheets BOTH use LONG codes, matching the original config + the live API. Caught by the `config-cube-contract.fitness.test.ts` (validates pinned codes against the workbook CL_<DIM>). Reverted all account-code edits.

**Why / How to apply:** when a `$cl`/`$d` join injects nothing, check whether the joined classifier is a DIMENSION (loaded) or an AUXILIARY classifier (was not). And when an obs-facts bundle disagrees with a config code, the canonical WORKBOOK (+ its fitness test) is the SSOT — not the seed bundle JSON. Run `config-cube-contract.fitness.test.ts` before trusting any dim-code change.
