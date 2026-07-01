---
name: overnight-validation-on-server
description: Validate the real stack on the user's Linux/Docker server (SSH+kit) — don't assume "no local Docker = can't run"; real runs catch bugs mocks never will
metadata:
  type: feedback
---

When something "can't run locally" (no local Docker, etc.), do NOT conclude it can't be validated. The user HAS a Linux server (192.168.1.199) with Docker + the geostat-kit ops architecture (SSH config at `ops/config/ssh/config`, host alias `geostat-deploy`). Run the real validation there.

**Why:** The user explicitly pushed back — "we HAVE a Linux server with Docker, what's the problem?" — after I assumed the DB/stack couldn't be exercised. Running it for real on the server caught **11 bugs that mocks/unit tests never would have**: TimescaleDB generated-column-as-partition, multi-event transition-table triggers, Flyway placeholder on a `${from}` comment, cross-dim seed parent_codes, a REAL product bug (bigint→JS-string ordinality breaking cube classify), a false-green parity guard, etc. The platform was beautifully tested but had never *run* end-to-end.

**How to apply:** For any infra/DB/Docker-shaped validation, use the server: isolate the work (own `statdash-net` network + `statdash-*` container names so the running reference-project containers are untouched), build/run there, and prove it. Pattern that worked: push to `main` → SSH pull in `/tmp/statdash-build` → `docker build` → run container on `statdash-net` wired to the cube → hit `/health` + `/api/bootstrap` → run `verify-parity` through an `ssh -L` tunnel. The full-stack-in-one-network proof was the user's recurring acceptance question. Secrets (`ops/config/ssh/id_rsa`, `google-credentials.json`, `.env.prod`) are gitignored/local-only — never commit them. Pairs with [[verify-board-empirically]].
