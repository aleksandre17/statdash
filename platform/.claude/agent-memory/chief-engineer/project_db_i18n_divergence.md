---
name: project-db-i18n-divergence
description: Silver-layer ingest validator reimplements i18n completeness against a hardcoded locale list, diverging from the V13/V14 gold contract — approval preview can green-light a submission gold then rejects
metadata:
  type: project
---

The database i18n model (V13/V14 migrations) is complete and registry-driven: `config.locale` is the SSOT, and gold-layer BEFORE INSERT/UPDATE triggers (V14, via the generic `config.enforce_locale_string`) require EVERY active locale present on every LocaleString column.

But the silver-layer ingest validator does NOT honour that contract:
- `platform/apps/api/src/ingest/types.ts:167` hardcodes `KNOWN_LOCALES = ['ka','en']`.
- `platform/apps/api/src/ingest/validate.ts:208` (`validateClassifiers`) only requires "at least one known locale" (MISSING_LABEL), and `validate.ts:267` checks UNKNOWN_LOCALE against the same constant.

**Consequence:** a submission with only `{"ka":...}` passes the approver preview as `canPublish=true`, then HARD-FAILS at publish when the gold trigger rejects it (publish.ts marks the whole submission `failed`). The approval gate lies, and the hardcode contradicts Law 1 (locales are data, not code).

**Why:** silver validation reimplements the rule in TS instead of calling `config.validate_locale_string()` / reading `config.locale`.

**How to apply:** Root-cause fix is to have the silver validator read `config.locale` (active locales) and call the same completeness predicate the gold trigger uses — one rule, both layers. Flag any future ingest/i18n work that re-adds a hardcoded locale list.

**Related (verified 2026-06-22):**
- Codelist SCD-2 is wired but dormant: V6 adds valid_from/valid_to/is_current + uq_classifier_current (V6:128-145) and the comment says "Wired; ETL enforces when a codelist first revises" — but `upsert.ts:36` overwrites label in place (ON CONFLICT DO UPDATE), so no historical row is ever created. History columns exist; nothing writes them.
- Governance audit_log: NOT "just a comment" — `lib/audit-log.ts` is a real, tested AuditLogger PORT with an in-memory ring-buffer impl (createInMemoryAuditLogger). What's missing is only the Postgres-backed persistence: DDL exists solely as a comment at audit-log.ts:16-24, no migration. So the trail is process-lifetime only.
- Ingest publish path emits NO AuditLogger entry (grep of src/ingest finds no log() call) — promotion to gold is recorded only via the V8 DB revision GUC (publish.ts:93 SET LOCAL app.revised_by), not in the governance trail.
- Publish writes gold via per-row await loops (publish.ts:155-161 facts, 236-247 displays; classifiers topo-sort 185-214) — one round-trip per row, not set-based.

See [[project-platform-maturity]].
