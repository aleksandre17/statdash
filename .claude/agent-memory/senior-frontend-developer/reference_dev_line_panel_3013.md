---
name: dev-line-panel-3013
description: The :3013 dev-line panel container (statdash-dev-panel-full) — how it resolves packages/*, and the whole-src-sync recipe to live-proof a packages/core change (the "cp the dist" recipe is WRONG for this line)
metadata:
  type: reference
---

The current authoring live-proof surface (0082 pipeline waves, verified W-P3 2026-07-18)
is NOT the old :3002/:3003 tenant setup ([[render-path-browser-verify]]). It is a single
vite-dev panel container on a remote host.

**Topology.** Remote host `statdash-dev` (192.168.1.199), reached via MSYS2 ssh alias
`geostat-deploy` (needs `export PATH="/c/msys64/usr/bin:$PATH"; export HOME="/c/msys64/home/Test-User"`
— Git's ssh/rsync have a `dup() failed` fd bug). Container `statdash-dev-panel-full`
serves the panel at **:3013** on that host (curl from the host, or probe against
`http://192.168.1.199:3013`, admin/`dev_admin_pw_123`). Two sibling containers
`statdash-stg-panel` / `statdash-panel` also exist — target the `-dev-` one.

**What is bind-mounted vs baked (the load-bearing fact).** ONLY `apps/panel/src` is a
live bind-mount (`ops/scripts/dev-watch-panel.sh --once` rsyncs local→remote, HMR picks
it up, no rebuild). `packages/*` is BAKED into the image AS SOURCE — the panel's vite dev
resolves `@statdash/engine` to `/app/packages/core/**src**` (there is NO `dist` in the
container; package.json `main:./dist` is irrelevant to vite dev). So the debugger memory's
"docker cp the rebuilt **dist** + restart" recipe is WRONG for this line — there is no dist
to cp.

**To live-proof a `packages/core` (or any `packages/*`) change:**
1. The baked src snapshot can be STALE (was Jul-16, pre-`data/relative-coord.ts`). A
   surgical `docker cp` of only your changed files **500s** the whole app — the barrel
   `packages/core/src/index.ts` you push references files the stale snapshot lacks
   (`Failed to resolve import "./data/relative-coord"`). Symptom: `curl :3013` → 500,
   page blank, `docker logs` shows a vite `Internal server error: Failed to resolve import`.
2. Fix = sync the WHOLE package src, self-consistent:
   `tar --exclude='*.test.ts' -C platform/packages/core -cf - src | ssh geostat-deploy "docker exec -i statdash-dev-panel-full sh -c 'cd /app/packages/core && tar -xf -'"`
   then `ssh geostat-deploy "docker restart statdash-dev-panel-full"`.
3. Push individual files INTO the container with
   `cat local | ssh geostat-deploy "docker exec -i <ct> sh -c 'cat > /app/<path>'"`.
4. After restart, the first `/studio/...` load triggers vite optimizeDeps (slow, can
   crash a Playwright page once) — warm it with a `curl` on the host + ~15s before probing.
5. Flag to platform: `packages/*` has no live-sync path; this whole-src tar is a manual
   workaround, and the baked snapshot drifts from the branch.

Probes live in `platform/e2e/probes/`, run from `platform/` (node has @playwright/test
resolvable there, NOT from /tmp). Base URL default `http://192.168.1.199:3013`.

**Playwright + real-browser drive of :3013 (Playwright 1.61.1 + chromium ARE installed in
`platform/node_modules` — an old "not in sandbox" memory was stale).** Existing harness:
`apps/panel/e2e/*.e2e.ts` + `e2e/support/mockApi.ts` (route-intercepts `**/api/**` for a
deterministic governed seed; `seedAuthToken` sets sessionStorage `geostat_panel_token`). Drive the
DEPLOYED line (not local vite) via `apps/panel/e2e/live.config.ts` (no webServer,
`baseURL=$PW_BASE_URL||http://192.168.1.199:3013`): `cd platform/apps/panel && PW_BASE_URL=http://192.168.1.199:3013
npx playwright test --config e2e/live.config.ts`. :3013 is already warm → a drive is ~13s vs ~3min
cold local. Route-interception works cross-origin, so the seed is deterministic against the real
bundle.

**Sync source to :3013 (source-mounted live-watch).** The container mounts host
**`/tmp/statdash-dev-line/platform/apps/panel/src`** → `/app/apps/panel/src` (verify with
`docker inspect statdash-dev-panel-full --format '{{range .Mounts}}{{.Source}} => {{.Destination}}{{println}}{{end}}'`
— an old `/home/administrator/statdash-dev-src/...` path was stale), runs `pnpm --filter
./apps/panel dev` (Vite HMR). Only `apps/panel/src` is mounted this way — packages changes need
the whole-src tar above. Sync via **tar-over-ssh** (Git's ssh works; MSYS2 rsync has a dup()-fd
bug here): `tar czf - -C platform/apps/panel/src . | ssh -F ../ops/config/ssh/config -o
StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null geostat-deploy "tar xzf -
-C /tmp/statdash-dev-line/platform/apps/panel/src"` (HOME=/c/Users/Test-User; ssh config at
repo-root `ops/`, i.e. `../ops` from `platform/`).

**GOTCHA (inotify across bind mount):** a HOST-side tar write to the mount source does NOT fire
the container's Vite (chokidar) watcher — it keeps serving stale in-memory transform. FORCE a
re-transform with a CONTAINER-side content change: `docker exec statdash-dev-panel-full sh -c
'sed -i "1s/^/\/\/ bump-$(date +%s)\n/" /app/apps/panel/src/<file>'`. VERIFY the browser actually
gets the new code by curling the transformed module (`curl -s http://192.168.1.199:3013/src/<path>.ts
| grep <changed-line>`) — do not trust "sync OK" alone; confirm via
`docker logs --since 60s statdash-dev-panel-full`.

**Ports:** prod `statdash-panel`:3003, staging `statdash-stg-panel`:3008 — UNTOUCHABLE; dev
`statdash-dev-panel-full`:3013. Source-mount HMR does not restart the container (uptime stays
continuous — proof prod/staging are untouched).
