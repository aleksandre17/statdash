---
name: project-sql-migrations-location
description: Postgres migrations live at REPO-ROOT ops/, not under platform/ops/
metadata:
  type: project
---

The Flyway-style SQL migrations (`V1__…`–`V9__…`) and `init/` scripts live at the
**repo root** `national-accounts/ops/postgres/migrations/`, NOT under
`platform/ops/`. There is no `platform/ops` directory.

**Why:** The DB is provisioned at the repo level (shared by the whole stack);
`platform/` is the pnpm workspace for app/library code only — see
[[project-workspace-root]].

**How to apply:** When a task references a migration by `platform/ops/...`, the
real path is `C:\Users\Test-User\WebstormProjects\national-accounts\ops\postgres\migrations\`.
`config.*` tables are defined in `V3__config_tables.sql`.
