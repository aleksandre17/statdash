---
name: adr035-interleave-defect
description: ADR-035 bringup-fresh.sh has a LIVE defect — Phase 2 ingest (capped V32) can't stage because the ingest worker needs submission.claimed_at (V37); DO NOT promote to prod/staging as-is; the fix + how the dev line got real data despite it
metadata:
  type: project
---

`ops/scripts/bringup-fresh.sh` (ADR-035, commit 677778c) is the migrate/ingest interleave meant to bring a FRESH DB to V38-with-data past the V33/V34 ordering defect: `flyway -target=32 → ingest REGIONAL_GVA+ACCOUNTS → flyway (uncapped V33..V38) → ingest GDP_ANNUAL`. It was code-complete + logic-tested 12/12 but NEVER live-proven. The 2026-07-11 live proof on the dev line (statdash-dev) found it is **BROKEN against the real api build**.

**The defect (circular dependency):** Phase 2 ingests at schema V32, but the api's ingest WORKER (`platform/apps/api/src/ingest/worker.ts` `claimNext`, line ~85) unconditionally runs `UPDATE stats_stage.submission SET status='parsing', claimed_at=now()` on EVERY claim. `claimed_at` is added only by **V37** (`V37__submission_claimed_at.sql`, API-02 crash-recovery). At V32 the column is absent → claim throws ("ingest worker: claim failed — column claimed_at does not exist") → submission stalls at `received` → route 500s "did not reach 'staged' within 60s". So: V33 needs ingest-created members → ingest needs the worker → worker needs claimed_at (V37) → V37 sits AFTER V33. Flyway is sequential so V37 can't be applied before V33. The gap is EXACTLY and ONLY claimed_at — every other column the worker/staging path writes (staged_at/staged_count/issue_count/error_detail) is V11 (≤V32). Likely cause: V37/API-02 landed AFTER bringup-fresh.sh was written+logic-tested, silently breaking Phase 2; the logic test never ran against the real api.

**Why:** the mission was to live-prove ADR-035 on the isolated dev line AND give it real data. The proof did its job — it surfaced a real, previously-hidden ordering bug.

**How to apply:**
- **DO NOT promote the interleave to staging/prod bring-up as-committed** — it cannot ingest against the current api. First fix the claimed_at ordering.
- **Minimal fix (recommended):** bringup-fresh.sh Phase 1 must additionally apply the ingest-worker's required post-V32 structural columns BEFORE Phase 2 — concretely, after `migrate -target=32`, run V37's idempotent DDL directly (`ALTER TABLE stats_stage.submission ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ; CREATE INDEX IF NOT EXISTS idx_submission_stranded ON stats_stage.submission (claimed_at) WHERE status='parsing';`). It converges with V37 later ("already exists, skipping"), verified live. Fragile-ish: breaks again if the worker later needs another >V32 column.
- **Deeper root-cause (architect):** eliminate V33's runtime data dependency (make the demo-classifier members self-seed idempotently in a migration) so a plain uncapped `flyway migrate` reaches V38 on a fresh DB and canonical ingest is purely additive fact-loading afterward — removing the interleave (and this claimed_at trap) entirely. V33 is applied+immutable on prod, so this is a new corrective migration → escalate.
- **How the dev line got real data despite the defect (2026-07-11):** applied V37's claimed_at DDL early by hand (the corrected pre-condition), then ran bringup-fresh.sh → all 4 phases green: V38 head, stats.observation=2479 (REGIONAL 1665 + ACCOUNTS 415 + GDP 399), 4-dim GDP anchor 2010=22148.65, idempotent re-run = clean no-op. See [[full-dev-line]], [[fresh-provision-canonical]].
