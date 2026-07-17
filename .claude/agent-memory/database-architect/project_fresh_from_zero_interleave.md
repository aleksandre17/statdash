---
name: fresh-from-zero-interleave
description: Why a single uncapped flyway migrate DIES at V33 on a fresh DB — SUPERSEDED by the beforeEachMigrate callback (ADR-035, LIVE-PROVEN 2026-07-11); the interleave history is kept below as context
metadata:
  type: project
---

**RESOLVED 2026-07-11 (commits ce67fa2 + 48792bb, LIVE-PROVEN on `statdash-dev`).**
The interleave below is SUPERSEDED. Root-cause fix = a Flyway callback
`ops/postgres/migrations/beforeEachMigrate.sql` that idempotently seeds the
geo+sector+account STRUCTURAL codelist members (exact canonical CL_* ka/en labels+ord,
FLAT/parent_code NULL) BEFORE V33. Guards: `to_regclass('stats.classifier')` + a
`parent_code`-column existence check → the seed body runs ONLY from the pass after V23
(so the V23 code_path trigger + V18/V24 acyclicity + V14 completeness are already live).
Seed FLAT ⇒ no seed-time parent/code_path interdependency; V33 §5c/§6b stamp the `_T`
roll-up + §4 the account order, exactly as on prod. Existence-guarded (WHERE NOT EXISTS on
current member) ⇒ never compares labels, never revises/deletes ⇒ pure no-op on prod/
staging; checksum-neutral (a callback is NOT in the version chain ⇒ `flyway validate` stays
green — proven). **Seed all THREE dims, not just geo:** in the collapsed migrate→ingest
order V33 §4(account)/§6(sector) would silently no-op on absent members and lose those
corrections permanently — geo alone only stops the RAISE. `bringup-fresh.sh` collapses to
`flyway migrate (uncapped) → ingest (all 3, additive)`; `docker-compose.dev.yml` drops
`-target=32`. LIVE PROOF (fresh volume, statdash-dev): uncapped migrate → V38 exit 0
(callback fired per-migration); ingest → **2479 obs** (GDP 399 + ACCOUNTS 415 + REGIONAL
1665, 4-dim GDP=22148.65); classifiers CONVERGED (geo current stayed 13, 0 duplicate
current members); :3012/:3013 render real GDP; re-run validate green + no-op; prod+staging
untouched (uptimes only grew). Canonical CL_GEO=_T+R2..R12(11), CL_SECTOR=_T+9 acts,
CL_ACCOUNT=6; all parent BLANK in the workbook (hierarchy is V33's job). See
[[project-db-state]], [[demo-classifier-data]].

--- historical context (the pre-callback interleave analysis) below ---

**Fact:** A single uncapped `flyway migrate` on a FRESH volume dies at **V33**, so no line
(incl. prod) had a proven deterministic fresh-from-zero FULL-DATA boot. Prod only survived
by INCREMENTAL migration (V33 applied on a day canonical data already existed).

**Root cause (precise — the brief's "V33→V34 inversion" framing is imprecise):**
- V33 does NOT depend on V34. V33 dies on its own section-7 `DO` block:
  `IF n_geo_regions < 11 THEN RAISE EXCEPTION 'expected >=11 regions parented to _T, found 0'`.
  Geo `R2..R12` / sector activities / account codes are **created only by the canonical
  REGIONAL_GVA / ACCOUNTS_SEQUENCE ingest** — V5 seeds only geo GE/GE-TB/GE-KA. Migrations
  run BEFORE ingest → at V33 time n_geo_regions=0 → RAISE.
- Real shape: the batch V33..V34 is **straddled by two ingests** — V33 needs REGIONAL/
  ACCOUNTS ingest to have run; GDP ingest needs **V34** (the 4-dim DSD widen) to have run.
  One pre-ingest flyway pass can't satisfy both.

**Impossibility result:** V33..V38 are applied+immutable (checksum-stable law). Any new
migration is ≥V39 → runs AFTER V33 → cannot stop V33's first-pass RAISE. So NO purely-
additive migration fixes a single-pass fresh boot. Brief options (a) guard-V33 and (c)
decouple-V33/V34 both EDIT applied migrations → forbidden. (b) post-ingest R__/Vnn alone
doesn't stop the RAISE. **The fix is orchestration-level, not a migration.**

**Fix (ADR-035) — deterministic migrate/ingest interleave:**
1. `flyway migrate -target=32` (all structure/config/auth/provisioning; 32 = last before V33)
2. ingest REGIONAL_GVA + ACCOUNTS_SEQUENCE (creates geo _T+R2..R12, sector, account members)
3. `flyway migrate` uncapped (V33 now passes; V34 widens GDP 4-dim; V35..V38)
4. ingest GDP_ANNUAL (4-dim facts vs widened DSD)
Idempotent (migrations no-op, ingest 409-converges). No migration body touched → prod/
staging validate stays green. Same orchestrator fixes prod fresh-recovery.

**Where implemented:** `ops/scripts/bringup-fresh.sh` (the interleave orchestrator, self-
contained flyway-docker + ingest); `ops/scripts/ingest-canonical.sh` made phase-aware via
`INGEST_DATASETS` env (default all 3; anchor asserts scoped by `_selected`). Codified law:
**a versioned migration may not assert on / depend on ingest-produced data** — V33 violated
it; route around via interleave, forbid going forward. See [[demo-classifier-data]],
[[schema-ssot]].

**Verification gap (honest):** the live boot-proof (fresh TimescaleDB → interleave → V38 +
observation>0) needs a container runtime — schema needs the `timescaledb` extension +
hypertables (V1/V4), vanilla PG can't run it. Authoring host had NO docker/podman/psql/
TimescaleDB; server is off-limits. Boot-proof pending a container host. Driver PURE logic
IS proven locally (ingest-canonical.test.sh green + INGEST_DATASETS selection smoke).

**2026-07-11 root-cause pass (sharpened findings — lead wanted the ROOT fix, not the interleave):**
- **Only ONE of V33's four §7 assertions is ingest-dependent.** n_agg=19 / n_agg_closing=6 (V33
  self-seeds §2) and n_geo_iso_live=0 (V33 §5b retires the V5-seeded GE-TB/GE-KA) are all SELF-
  CONTAINED. §4 (account order) + §6 (sector parent) are UPDATEs that no-op when members absent —
  they do NOT assert. The SOLE fresh-boot RAISE is **n_geo_regions>=11** (geo _T + R2..R12). So the
  minimal root fix = pre-seed geo `_T + R2..R12` as STRUCTURAL reference members (SDMX codelist =
  structure = migration's job per V7's own law), moving them off ingest → ingest becomes additive.
- **`claimed_at` trap CONFIRMED — the current bringup-fresh.sh is itself broken at Phase 2.**
  worker.ts `claimNext` writes `SET status='parsing', claimed_at=now()` (line ~85); `claimed_at` is
  added by **V37** (nullable). At `-target=32` the column is absent → the claim UPDATE errors → the
  submission never drains → 0 members created → Phase 3 V33 still RAISEs. The interleave is DOUBLY
  broken on a truly-fresh DB (needs an ever-growing set of >V32 worker columns pre-applied). This is
  the live-proof fallout the brief cited; do NOT keep patching the interleave.
- **The immutability wall is real; the ONE forward-only lever that runs BEFORE V33 without editing it
  = a Flyway CALLBACK.** All migrations ≤V32 are immutable; any new migration is ≥V39 → runs AFTER
  V33 → cannot stop V33's first-pass RAISE. On a fresh single pass, the only things that execute
  before V33 are V1..V32 (frozen) + Flyway callbacks. So a `beforeEachMigrate.sql` callback co-located
  in `ops/postgres/migrations/` (auto-discovered by any flyway pointed at that `locations`, checksum-
  neutral — callbacks aren't in the version chain), guarded `to_regclass('stats.classifier') IS NOT
  NULL`, that idempotently seeds geo `_T + R2..R12`, is the ONLY pure-forward mechanism. Caveat: it
  runs before V23 (code_path trigger) on a fresh DB, so parent/code_path interactions MUST be proven
  on a real TimescaleDB. It is a migration-EXECUTION-CONTRACT change (introduces the first callback in
  this repo) → needs lead ratification + a fresh-DB proof before landing. Alternatives: Flyway
  `baseline` for fresh installs (canonical but contradicts "single uncapped migrate replays to V38"),
  or keep the interleave + generalize the worker-column self-heal (brief's accepted fallback).
- **Container runtime STILL ABSENT (verified 2026-07-11: docker/podman/psql all "command not found").**
  The brief's fresh-local-DB proof is BLOCKED → hard STOP per the brief; did NOT commit any fix, did
  NOT touch the server. Direction (callback vs baseline vs interleave) is the lead's call; implement +
  prove once a container host is authorized.
