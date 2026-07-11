# ADR-035 — Fresh-from-zero full-data boot: the migrate/ingest interleave

- Status: Accepted (implementation staged; live boot-proof pending a container host — see "Verification status")
- Date: 2026-07-11
- Deciders: data-architect (per mission-command brief), lead
- Supersedes/relates: ADR-019 (persistent volume), ADR-0031/0032 (canonical ingest as demo-data SSOT, R__ neutralization), the dev/staging `-target=32` workaround

## Context

The bring-up architecture is strictly **two-phase**: `flyway migrate` applies *all*
versioned migrations `V1..V38` **before** any data exists, then the api comes up and a
one-shot **canonical ingest** (`ops/scripts/ingest-canonical.sh`) POSTs the three
canonical workbooks through the real pipeline. The migration lane owns *structure*; the
ingest owns *data* (facts + the ingest-produced classifier members — geo `_T`+`R2..R12`,
sector activities, account codes).

On a **fresh volume** a single uncapped `flyway migrate` **dies at V33**. The current
workaround (staging, dev) is `-target=32` + empty gold: the whole `config.*` tier
(bootstrap / site_config / provisioning / auth) is live, but the observation cube is
empty. **No line — including prod — has a proven deterministic fresh-from-zero
full-data boot.** Prod only ever survived because it was migrated *incrementally over
time* (V33 was applied to prod on a day when the canonical data was already present).
This is real, latent architectural debt: it is also a **prod fresh-recovery risk** (a
from-backup-less rebuild could not reach V38+data deterministically).

### Root cause (precise)

Two independent facts collide:

1. **V33 asserts on ingest-produced data.** `V33__demo_classifier_data.sql` is a
   *corrective* migration. Beyond its self-contained part (the `aggregates` virtual
   classifier), it (a) stamps the SDMX roll-up hierarchy `parent_code='_T'` onto geo
   `R2..R12` and onto the sector activities, (b) stamps `order`/display onto the
   `account` members, and (c) its section-7 `DO` block **hard-`RAISE`s**:

   ```
   IF n_geo_regions < 11 THEN
     RAISE EXCEPTION 'V33: expected >=11 regions parented to _T, found %', n_geo_regions;
   ```

   Those geo `R2..R12` / sector / account members are **not** seeded by any migration —
   V5 seeds only geo `GE`, `GE-TB`, `GE-KA`. `R2..R12`, sector activities and the account
   codes are created **only by the canonical REGIONAL_GVA / ACCOUNTS_SEQUENCE ingest**.
   On a fresh DB at V33 time `n_geo_regions = 0` → `RAISE` → **flyway halts at V33**.

2. **V34 must run before the GDP ingest.** `V34__gdp_dsd_approach_align.sql` widens the
   GDP_ANNUAL DSD from the V5/V7 3-dim `[measure, time, geo]` to the canonical 4-dim
   `[measure, approach, time, geo]`. The canonical GDP workbook is 4-dim; without V34 the
   ingest compat pre-pass rejects it (`DSD_INCOMPATIBLE`). So the **GDP ingest depends on
   V34 having already run**.

The real shape is therefore **not** a "V33→V34 inversion" (V33 does not depend on V34).
It is that the migration batch `V33..V34` is **straddled by two different ingests**:
- V33's corrections need the **REGIONAL/ACCOUNTS** ingest to have *already* run;
- the **GDP** ingest needs V34 to have *already* run.

Within one pre-ingest flyway pass both cannot be satisfied. This is a genuine data/
structure ordering dependency, not a bug in either migration's body.

### Impossibility result (why no additive migration alone fixes it)

The hard floor is **forward-only, checksum-stable**: V33..V38 are applied on prod and may
never be edited. Any *new* migration is versioned `≥ V39` and therefore **executes after
V33**. On a fresh single pass V33 runs first and `RAISE`s — no `V39+` migration can
prevent that. Editing V33 to add a `hasCanonicalData` guard (brief option **a**) or
editing V33+V34 to decouple them (option **c**) both **rewrite an applied migration** and
are forbidden. A post-ingest repeatable/`Vnn` (option **b**) is necessary for a clean
long-term home but **does not by itself stop V33 from `RAISE`-ing** in the first pass.

**Conclusion:** a single uncapped `flyway migrate` then ingest is **architecturally
impossible** to make green on a fresh DB without editing V33. The fix must live at the
**orchestration** layer.

## Decision

Adopt a **deterministic migrate/ingest interleave** as the canonical fresh-from-zero
bring-up, encoded as one reviewable orchestrator (`ops/scripts/bringup-fresh.sh`) and a
**phase-aware** ingest driver (`INGEST_DATASETS` on `ingest-canonical.sh`):

```
Phase 1  flyway migrate -target=32          # all structure/config/auth/provisioning
Phase 2  INGEST_DATASETS="REGIONAL_GVA ACCOUNTS_SEQUENCE" ingest-canonical.sh
                                             # creates geo _T+R2..R12, sector, account members
Phase 3  flyway migrate                      # uncapped: V33 now passes (data present),
                                             #           V34 widens GDP to 4-dim, V35..V38
Phase 4  INGEST_DATASETS="GDP_ANNUAL" ingest-canonical.sh
                                             # 4-dim GDP facts land against the widened DSD
```

`-target=32` is the last migration strictly *before* the first ingest-dependent
correction (V33) and is chosen as high as possible so the entire config/auth/provisioning
tier is live before Phase 2. Phase-4 GDP is forced last because V34 (its structural
precondition) only exists after Phase 3. This mirrors, and makes runnable+version-
controlled, the manual sequence the dev/staging compose headers already describe in prose.

Everything is idempotent: migrations are idempotent no-ops on re-run; the ingest driver
converges (409 `ALREADY_PUBLISHED` / converged-publish); a second run of the whole
orchestrator is a no-op. No migration body is touched → prod/staging `validate` stays
green.

### Codified law (prevents recurrence)

> **A versioned migration may not assert on, or depend on, ingest-produced data.**
> Structure lives in migrations; data-dependent corrections live in a **post-ingest
> phase** (the ingest pipeline or a post-ingest step). V33 violated this; because it is
> immutable we route around it via the interleave, and forbid the pattern going forward.

## Alternatives rejected

- **(a) Guard V33's assertions behind `hasCanonicalData`.** Rewrites an applied migration
  (checksum break on prod/staging) — forbidden. Also leaves the corrections un-applied on
  a fresh boot unless paired with a post-ingest re-run.
- **(c) Decouple V33/V34 bodies.** Same immutability violation; and V33 does not actually
  depend on V34, so it would not address V33's real (REGIONAL-ingest) dependency.
- **(b) post-ingest repeatable `R__`/`V39` alone.** A good *long-term* home for
  data-dependent corrections, but a later migration still runs inside the same pre-ingest
  flyway pass, so it does not stop V33's first-pass `RAISE`. (Would only work combined with
  a second flyway pass — i.e. the interleave — at which point V33 itself already does the
  correction correctly.)
- **A new `V32.5` structural seed of geo/sector/account members** (so V33 passes on a
  single pass). Requires Flyway `outOfOrder=true` (a gap-allowing footgun) on prod, and
  forks the classifier-member SSOT (migration + ingest both minting the same members).
  Rejected.

## Consequences

- **Positive:** fresh-from-zero reaches **V38 with 4-dim GDP data deterministically**;
  prod gains a proven fresh-recovery path (same orchestrator, prod compose file); no
  migration edits, prod/staging `validate` unaffected; the failure mode is codified as a
  law so no future migration repeats it.
- **Negative / trade-off (ISO 25010 maintainability vs deployability):** the bring-up now
  encodes two magic couplings — the `-target=32` cap and the GDP-last ingest split. These
  are *inherent* to the current immutable ordering, not incidental; they are documented
  here and centralized in one orchestrator so a future migration that adds an ingest
  dependency changes exactly one file. The long-term retirement of this debt is to move
  V33-class corrections into the post-ingest lane (the codified law) so the interleave can
  eventually collapse back to a single `migrate` + single `ingest`.

## Verification status

The live boot-proof (fresh TimescaleDB volume → interleave → `V38` + `stats.observation
> 0`) **requires a container runtime** (the schema needs the `timescaledb` extension +
hypertables from the `timescaledb-ha` image; vanilla Postgres cannot run V1/V4). The host
this was authored on has **no Docker/Podman, no local Postgres/TimescaleDB**, and the
brief forbids touching the server lines. The exact ready-to-run proof commands are in the
brief report and at the foot of `ops/scripts/bringup-fresh.sh`; the boot-proof must be run
on a container-capable host (or the server's isolated dev line, if the operator authorizes
it) before this ADR moves from staged to fully proven.
