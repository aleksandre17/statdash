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
