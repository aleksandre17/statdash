---
name: api-image-and-validate-local
description: api Dockerfile uses pnpm deploy (not hand-COPY) for symlink-free runtime; pnpm validate:local is the live-DB one-shot
metadata:
  type: project
---

Two operational facts about the api image + the first-real-run one-shot.

**Why (image):** the workspace uses pnpm's default ISOLATED linker (`platform/.npmrc`: `shamefully-hoist=false`, no `node-linker` override → the `.pnpm` virtual store). `node_modules/@statdash/*` and external deps are SYMLINKS into `.pnpm`. A hand-picked `COPY node_modules` + package dirs into the runtime stage cannot reliably reproduce that symlink web → dangling links → MODULE_NOT_FOUND at boot. That was the flagged runtime-resolution fragility.

**How to apply (image):**
- `platform/apps/api/Dockerfile` production stage now ships ONLY a `pnpm --filter @statdash/api --prod --legacy deploy /deploy` output: a flattened, self-contained dir with every dep (workspace pkgs per their `files:['dist']` + external prod deps) INLINED, no `.pnpm`/symlinks. Runtime = `COPY --from=build /deploy ./` + `node dist/index.js` + `USER node`.
- Deploy target is `/deploy` (OUTSIDE the `/app` workspace) — pnpm 9 refuses a target nested in the project.
- `--legacy` is required: pnpm 9 gates `deploy` for workspace:* deps behind it unless inject-workspace-packages is on.
- Prereq order kept: engine+api `dist` are built in the build stage BEFORE deploy (deploy copies built dist, never source).
- All three workspace deps (`@statdash/contracts|expr|engine`) declare `files:['dist']` + `exports` resolving to `dist/*.js` — that's what makes deploy's copy correct.

**Why (validate:local):** closes the #1 standing risk — 29 migrations + the whole data layer had never run against a real Postgres. The 33 DB-gated tests `describe.skip` unless `DATABASE_URL` is set (`const suite = DATABASE_URL ? describe : describe.skip`).

**How to apply (validate:local):**
- `pnpm validate:local` (script `bash ops/scripts/validate-local.sh`, + `.ps1` mirror) is an 8-stage fail-fast one-shot: network+PG up → Flyway migrate V1→V29 + R__ seed → build:engine → seed cube → `pnpm test` with DATABASE_URL exported (33 DB-gated proofs un-skip) → API one-shot + /health → verify-parity → teardown (`--keep`/`-Keep` to leave up).
- It reads `ops/config/db/.env` (auto-created from `.env.example`) for DB identity; PG port published to 127.0.0.1 so host Node steps use `localhost`.
- Uses the existing infra compose (`ops/compose/infra/...`) under a dedicated project `statdash-validate`; flyway run is `up --abort-on-container-exit --exit-code-from flyway flyway`.
- Mirrors `.github/workflows/ci.yml` (which is STALE — references old `@geostat/api` scope + `geostat` DB creds; current scope is `@statdash/*`, DB `statdash`).
- Baseline confirmed 2026-06-23: `pnpm -C platform test` = 918 passed / 33 skipped (the 33 are exactly the DB-gated proofs validate:local un-skips). See [[geostat-deploy-model]].
