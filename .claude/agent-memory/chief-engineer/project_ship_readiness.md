---
name: ship-readiness
description: 2026-06-25 final ship-readiness review of statdash-platform — green gate verified real, all prior recon findings resolved, SHIP-READY verdict + deferred-door list
metadata:
  type: project
---

Final ship-readiness review, 2026-06-25. Read-only. Verdict: **SHIP-READY** — no genuine ship-blocker found.

**Why:** User shipping under deadline; needed a real go/no-go, not reassurance. Platform claimed feature-complete (R1–R6, M0–M2, S0–S2, V0–V7, 1454 tests).

**How to apply:** This is the green-gate + resolved-debt snapshot at ship time. Re-verify lint (the historical canary) before trusting any future "green" claim. The deferred doors below are NOT forgotten debt — they are documented one-way doors awaiting a real second caller / prod signal.

**Green gate VERIFIED REAL (measured from platform/, no DATABASE_URL):**
build:engine GREEN · build:geostat GREEN (warnings: bundle>500kB + ineffective-dynamic-import, non-blocking) · build:panel GREEN · typecheck GREEN (exit 0; covers apps/geostat/tsconfig.app.json — the aggregating project ref) · lint GREEN (0 errors, 43 react-refresh warnings accepted) · test GREEN (1410 passed / 44 skipped / 0 failed across 162 files; skips are DATABASE_URL-gated DB fitness tests, verified green on real TimescaleDB per task). The 2026-06-24 lint RED blocker (set-state-in-effect ×2) is RESOLVED.

**ALL prior recon/review findings RESOLVED (verified in code):**
- SCD-2 upsert bug A (multi-level LTREE stale path) + bug B (ON CONFLICT ON CONSTRAINT invalid SQL) — BOTH eliminated by ADR-0023: hierarchy edge moved off churning surrogate parent_id onto stable business-key parent_code + code_path. Textbook expand-contract: V23 (additive, two-way, backfill + parity DO-block) → V24 (one-way, re-points cycle guard FIRST per Chesterton's Fence, renames trigger trg_classifier_no_cycle→trg_classifier_acyclic so 'a'<'c' fires before code_path). upsert.ts:103 now uses inference form `ON CONFLICT (dim_code, code) WHERE is_current`. The ADR one-way-door I escalated was resolved with the correct option (business-key FK).
- First-tenant erosion (GeostatEventMap→PlatformEventMap, geostat-snapshot, GeoStat-blue copy) — cleaned; now only appears in tests/no-tenant-content + no-geostat-scope fitness nets that FORBID the old names.
- georgraph typo — fixed via migration.ts v2→v3 rename (stored configs still load); discriminant is now 'geograph'.
- Save-guard locale SSOT bypass — fixed; api-actions.ts:67/290 now use resolveActiveLocales(site.activeLocales, site.defaultLocale).
- xlsx dead-promise — xlsx now in devDependencies; export registry path real.

**Seams verified load-bearing (not green-by-accident):** validateConfig WARN-mode floor (pages.ts:24 ENFORCE_CONFIG_VALIDATION=false, one-boolean flip seam, deliberate deferral until corpus-audit green) · publish gated to admin on top of JWT (pages.ts:78) · 40 fitness tests assert (schema-completeness toEqual([]), coverage asserts registry>0 + gaps.toEqual([]), insertByteIdentity types>0). Migrations owned by Flyway 10 (ops/compose/infra/services/flyway.yml) — applies V1–V31 + R__ seed, depends_on postgres healthy. api Dockerfile multi-stage, runs USER node. env.ts fail-fast (DATABASE_URL, JWT_SECRET min-32, ADMIN_PASSWORD min-8). NO committed secrets (ops/config/ssh/id_rsa + deploy.env gitignored & untracked; only tracked .env is geostat VITE_API_URL — a public build const).

**DEFERRED DOORS (post-ship, documented, NOT blockers):**
1. V24 carries explicit precondition "DO NOT APPLY IN PROD UNTIL V23 PARITY VERIFIED LIVE." Safe on greenfield (V23 backfill+parity DO-block runs same chain, RAISES on mismatch). On an EXISTING populated DB, sequence V23→parity-period→V24 manually. Deploy-runbook item.
2. EMBED_SECRET has dev default 'dev-secret-change-in-prod' (env.ts:18) — does NOT fail-fast in prod. Embed tokens forgeable if unset. Hardening: make it required when NODE_ENV=production. Non-core feature; not a blocker.
3. ENFORCE_CONFIG_VALIDATION=false (WARN mode) — flip to REJECT after backfill audit (scripts/audit-config-validity.ts) shows stored corpus clean.
4. PUBLISH_ROLES=['admin'] — no dedicated 'publisher' role; additive expand when product needs publish≠admin.
5. SDMX REST API surface still absent (ref-metadata/quality DQAF now PRESENT via V31 + reference-metadata.fitness — was absent at recon). Judge per-tenant gold-plating.
6. Bundle >500kB (geostat/panel) — code-split later; not a ship issue.
