---
name: api-env-failfast-seam
description: apps/api env.ts is the single boot-time fail-fast seam; how to add prod-gated secrets + how to test boot behavior
metadata:
  type: project
---

`apps/api/src/env.ts` is the ONE env contract: a Zod schema parsed at import time via `schema.parse(process.env)`. Every consumer reads the frozen `env` object — never `process.env` ad-hoc (12-Factor). This is the single fail-fast seam; new env vars and validation belong here, nowhere else.

Secret shapes in this module:
- `JWT_SECRET`/`ADMIN_PASSWORD`/`ADMIN_USERNAME`/`DATABASE_URL` — required in EVERY env (no default).
- `EMBED_SECRET` — the one secret with a dev default; required+strong (≥`SECRET_MIN_LEN`=32, not the dev default) ONLY in production, enforced in a schema-level `.superRefine` keyed on `NODE_ENV`. A `PROD_REQUIRED_SECRETS` array there is the seam: a future dev-default secret is one line, not a new gate.
- `CORS_ORIGIN` has a localhost dev default but is NOT a forgeable-secret class problem (fails closed).

**Why:** ship-hardening found `EMBED_SECRET` had a forgeable prod dev-default; fixed at class level 2026-06-25.

**How to apply:** add prod-gated secrets to `PROD_REQUIRED_SECRETS` in env.ts's superRefine. Test boot behavior in `apps/api/src/env.test.ts` by mutating `process.env` + `vi.resetModules()` + dynamic `import('./env.js')` per case (env parses at import time, so each import is a fresh boot). Promote a `requiredInProd` helper only at the 2nd dev-default secret (currently 1 → YAGNI).
