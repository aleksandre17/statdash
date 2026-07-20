---
name: dev-deploy-topology-gap
description: Dev :3013 container bakes packages/* into its image and mounts ONLY panel/src — panel-only rsync never deploys engine/packages changes (false-RED trap for live verification)
metadata:
  type: project
---

The dev line container `statdash-dev-panel-full` (host geostat-deploy 192.168.1.199, served :3013) bind-mounts **only** `/tmp/statdash-dev-line/platform/apps/panel/src → /app/apps/panel/src`. Every `packages/*` (core=`@statdash/engine`, react, charts, plugins, contracts, expr) is **baked into the image** at `/app/packages/*` and is NOT updated by `ops/scripts/dev-watch-panel.sh` (which rsyncs panel/src only).

**Consequence (verified 2026-07-20, ADR-051 DU4 Step A walk):** a change that spans panel + an engine capability deploys HALF. Step A's `toWorkbenchModel` (panel) calls `desugarToPipeline` (engine) and accepts iff the spec folds to `pipeline`. The container's baked `desugar.ts` predated the DU4a/b fold → `desugarToPipeline(timeseries|growth)` returned identity → folded kinds fell to the DU3 **fallback lane**, not the three panes. The panel-only recipe produced a false-RED: the feature looked broken but was only half-deployed.

**Why:** `git log` showed the engine fold committed (cc090228 DU4a, 952b230b DU4b) — devs assume "committed = live on dev", but dev's engine reflects the last image BUILD, not HEAD.

**How to apply:** Before verifying ANY behavior that depends on `packages/*` on dev :3013, confirm the container's copy is current — `ssh geostat-deploy "docker exec statdash-dev-panel-full grep -n <marker> /app/packages/<pkg>/src/<file>"`. To deploy a package change without an image rebuild: rsync it to the host stage (`/tmp/statdash-dev-line/platform/packages/<pkg>/src`, same MSYS2 rsync env as dev-watch-panel.sh) then `docker cp <host>/. statdash-dev-panel-full:/app/packages/<pkg>/src` and `docker restart`. A container RECREATE reverts to the stale image. Related: [[kit-false-green-classes]], [[verification-is-manual]].
