---
name: detenant-augmentation-seam
description: De-tenant pattern for packages/react+styles — generic open maps extended app-side via `declare module '@statdash/react'`, guarded by a /geostat/i fitness test
metadata:
  type: project
---

The app-agnostic layers (`packages/react`, `packages/styles`) must carry ZERO tenant content (Law 1 / Law 3 de-tenant north-star).

**Pattern for typed extension maps** (mirror `PlatformCommandMap` exactly):
- Declare a generic, empty-of-tenant `interface PlatformXMap` in `packages/react`, exported from the package ROOT (`@statdash/react`) so apps can augment.
- Apps/plugins add specifics via `declare module '@statdash/react' { interface PlatformXMap { 'my:x': {...} } }` (OCP — open for extension, no central edit).
- Examples in-repo: `PlatformCommandMap` (engine/commands/commands.ts), `PlatformEventMap` (events/events.ts), `NodeTypeMap`. The augmentation seam exists even when no app augments it yet (the seam is the contract).

**Why:** First-tenant ("geostat") identity historically leaked in as `GeostatEventMap`, a hardcoded `geostat-snapshot` class, and styles brand copy ("GeoStat blue"). Renamed `GeostatEventMap → PlatformEventMap`; all current events were platform-generic (row:hover, legend:toggle, node:status …) so rename + generic typing sufficed — none moved app-side.

**How to apply:** Configurable literals (e.g. snapshot wrapper class) become a brand-neutral default constant + optional override field on the context type (`SNAPSHOT_WRAPPER_CLASS = 'statdash-snapshot'`, overridable via `StaticRenderContext.snapshotClassName`). DI-boundary comments say "the app tier injects …", never name a tenant app.

**Guard:** `packages/react/src/engine/no-tenant-content.fitness.test.ts` source-scans `packages/react/src/**` + `packages/styles/src/**` and fails on any `/geostat/i` token. Allowlist is intentionally EMPTY. The test file excludes itself (it names the banned token in a negative assertion). See [[registry-over-special-case]] for the sibling "generic over special-case" discipline.
