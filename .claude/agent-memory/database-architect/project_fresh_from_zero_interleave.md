---
name: fresh-from-zero-interleave
description: Why a single uncapped flyway migrate DIES at V33 on a fresh DB, and the migrate/ingest interleave (ADR-035) that fixes fresh-from-zero full-data boot forward-safely
metadata:
  type: project
---

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
