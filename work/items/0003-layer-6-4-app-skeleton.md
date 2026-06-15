---
id: "0003"
title: "6.4: App bootstrap skeleton (no blank-screen flash)"
status: done
class: G
priority: P2
owner: —
links:
  - docs/plan/roadmap-phase-5-6.md
---
**Goal** — `apps/geostat/src/app/App.tsx:13` returns `null` during bootstrap.
Replace with `<AppSkeleton />` so first paint shows a loading skeleton (matching
the ONS/Eurostat loading standard the platform already follows per-page via PageSkeleton).

**DoD**
- [ ] No blank-screen flash on cold load; a skeleton renders during bootstrap.
- [ ] `AppSkeleton` follows the `PageSkeleton` pattern in `PageLoader.tsx`.
- [ ] `npx tsc --noEmit` = 0 errors.

**Notes** — Closes gap #32. XS effort (<30 min). No Class-M trigger.
