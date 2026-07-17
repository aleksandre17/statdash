---
name: live-proof-3013
description: How to real-browser-verify panel UI on the deployed dev line :3013 — Playwright IS installed; source-mount HMR sync recipe
metadata:
  type: reference
---

**Playwright 1.61.1 + chromium ARE installed** in `platform/node_modules` (the old "Playwright CI-only / not in sandbox" memory is STALE). Existing harness: `apps/panel/e2e/*.e2e.ts` + `e2e/support/mockApi.ts` (route-intercepts `**/api/**` for a deterministic governed seed; `seedAuthToken` sets sessionStorage `geostat_panel_token`).

**Drive the DEPLOYED :3013 (not local vite):** `apps/panel/e2e/live.config.ts` (no webServer, `baseURL=$PW_BASE_URL || http://192.168.1.199:3013`). Run: `cd platform/apps/panel && PW_BASE_URL=http://192.168.1.199:3013 npx playwright test --config e2e/live.config.ts`. The :3013 vite is already warm (up hours) → drive is FAST (~13s), unlike a cold local vite (~3min first transform). Route-interception works cross-origin, so the seed is deterministic against the real bundle.

**Sync source to :3013 (source-mounted live-watch):** the `statdash-dev-panel-full` container mounts host **`/tmp/statdash-dev-line/platform/apps/panel/src`** → `/app/apps/panel/src` (VERIFY with `docker inspect statdash-dev-panel-full --format '{{range .Mounts}}{{.Source}} => {{.Destination}}{{println}}{{end}}'` — the old `/home/administrator/statdash-dev-src/...` path is STALE/wrong, 2026-07-13), runs `pnpm --filter ./apps/panel dev` (Vite HMR). Only `apps/panel/src` is mounted — packages changes need an image rebuild. Sync via **tar-over-ssh** (Git's ssh works; MSYS2 rsync has the dup()-fd bug here):
`tar czf - -C platform/apps/panel/src . | ssh -F ../ops/config/ssh/config -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null geostat-deploy "tar xzf - -C /tmp/statdash-dev-line/platform/apps/panel/src"` (HOME=/c/Users/Test-User; ssh config is at repo-root `ops/`, i.e. `../ops` from `platform/`).

**GOTCHA (inotify across bind mount):** a HOST-side tar write to the mount source does NOT fire the container's Vite (chokidar) watcher — Vite keeps serving its STALE in-memory transform and NO `hmr update` line appears. FORCE a re-transform with a CONTAINER-side content change: `docker exec statdash-dev-panel-full sh -c 'sed -i "1s/^/\/\/ bump-$(date +%s)\n/" /app/apps/panel/src/<file>'` (a real content edit fires inotify from inside the namespace). VERIFY the browser actually gets the new code by curling the transformed module: `curl -s http://192.168.1.199:3013/src/<path>.ts | grep <the-changed-line>` — do NOT trust "sync OK" alone. Confirm pickup via `docker logs --since 60s statdash-dev-panel-full` (HMR update lines, no compile error).

**Ports:** prod `statdash-panel`:3003, staging `statdash-stg-panel`:3008 — UNTOUCHABLE; dev `statdash-dev-panel-full`:3013. Source-mount HMR does NOT restart the container (uptime stays continuous) — that IS the before/after proof prod/staging are untouched.

**Node vs jsdom:** node/jsdom `import.meta.url` is not a `file:` URL — don't `fileURLToPath` in panel vitest; and `?raw` CSS resolves to '' (see [[css_fitness]]/vitest-raw memories). For a CSS-invariant, assert the render-structure (one `.summary-card`, no `<textarea>`) instead of scanning the .css.
