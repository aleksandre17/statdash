---
name: server-deploy-build-context
description: Deploy server builds from a git clone that tracks only main — local unpushed commits silently don't reach server image builds; push first
metadata:
  type: project
---

The deploy server (ssh host `geostat-deploy`, 192.168.1.199) builds images from a git clone at `/tmp/statdash-build`. That clone's git config fetches/tracks **only `main`** — a feature branch has no remote-tracking ref there, so `git fetch && git reset --hard origin/<feat>` fails and the context silently stays at an OLD commit.

**Why:** This caused the version-mint fix (`8e9cb27`) to be missing from a rebuilt staging image even though it was committed — the fix was LOCAL/unpushed, so the server's build never had it (diagnosed as a "stale image" twice). Recovery: `git fetch origin <feat-branch> && git reset --hard FETCH_HEAD`.

**How to apply:** Before expecting any server rebuild (staging or prod) to include a local fix: (1) `git push origin <branch>` first; (2) on the server, fetch the branch EXPLICITLY by name (`git fetch origin <branch> && git reset --hard FETCH_HEAD`), don't rely on `origin/<branch>` existing. Runbook paths are relative to the pnpm root `platform/` (e.g. real path `platform/apps/api/...`). The server's `docker-compose` (hyphen) is actually v5.x despite the "v1" assumption. Single-origin: prod geostat/panel images build with EMPTY `VITE_API_URL`/`VITE_API_STATS_URL` (relative `/api`). Live-demo cutover pattern that worked: backup (`pg_dump -Fc`, verify restorable) → prove on an isolated `statdash-stg-*` twin (seed-neutralized, real ingest, Playwright probe) → flyway clean+migrate with R__ seed neutralized (note: Flyway 10 `clean` only drops the `public` schema unless `-schemas` lists `config,stats,stats_stage` — else DROP SCHEMA … CASCADE) → ingest the 3 canonical workbooks via the live route (GDP needs `?datasetVersion=` for its 4-dim governed mint) → probe live. See [[server-overnight-validation]] if present.

**Deploy MECHANISM = KIT/OPS, not ad-hoc SSH (owner mandate 2026-07-01).** Server deploys go THROUGH the kit ops tooling — the manifest-driven deploy drivers (`geostat api|geostat|panel deploy` / `... compose --prod up`) and the `ops/` compose (per-module `docker-compose.{yml,prod,override}.yml`, `statdash-net`). Do NOT hand-roll raw `ssh`+`docker`+`git` sequences for the deploy; drive it via the kit (health-gate + image-rollback are built into the node drivers). Known toolkit gaps existed (node-vite remote tar-scope, gen_server_compose context) — check they're resolved for the module being deployed. Local Docker is UNAVAILABLE on the owner's machine → the SSH server is the ONLY stack-validation path (don't re-ask about local docker).
