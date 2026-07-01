---
name: flyway-immutable
description: Never edit an applied Flyway migration file in ops/postgres/migrations — not even comments (checksum break)
metadata:
  type: feedback
---

Never modify a Flyway migration file under `ops/postgres/migrations/` once it may have been applied — including cosmetic/comment-only edits.

**Why:** Flyway records a checksum per migration in `flyway_schema_history`. Any byte change to an applied file (even a comment) makes `flyway migrate`/`validate` fail with a checksum mismatch on every environment where it was already applied — a one-way door with cross-environment blast radius. A `PreToolUse` hook flags these files as Class-M / IRREVERSIBLE for this exact reason.

**How to apply:** Treat `ops/postgres/migrations/V*.sql` as frozen. Schema/data changes go in a NEW versioned migration (expand-contract). Documentation drift in an old migration's comments is left alone or corrected in a doc, never by editing the migration. When a config/infra task touches things referenced by a migration comment (e.g. deleting `ops/postgres/init/`), update the comment ONLY if the migration is unapplied — otherwise report it as a known stale comment. See [[project_ci_db_gating]].
