---
name: Landing Plugin Refactor — DONE 2026-05-19
description: landing/ deconstructed into 3 self-contained nodes per Grafana/Builder.io pattern. nodes/ dir deleted, CSS split, Node.ts co-located, Skeletons added, i18n fixed.
type: project
---
# Landing Plugin Refactor — DONE (2026-05-19)

## Final Structure

```
plugins/pages/landing/
  hero/default/      LandingHeroNode.ts · LandingHeroShell.tsx · LandingHeroSkeleton.tsx · landing-hero.css · index.ts
  stats/default/     LandingStatsNode.ts · LandingStatsShell.tsx · LandingStatsSkeleton.tsx · landing-stats.css · index.ts
  container/default/ LandingContainerShell.tsx · landing.css · index.ts
  index.ts           export * as hero, stats, container
  types.ts           thin re-export barrel (backward compat for landing.config.ts)
```

## What Changed

- `nodes/` directory deleted — flat tier structure at landing/ level (Grafana pattern)
- monolithic `landing.css` → 3 co-located CSS files (container vars/layout · hero cards · stats carousel)
- monolithic `types.ts` → co-located `[TypeName]Node.ts` per node with Schema + Defaults + Slots + Groups + augmentation
- Skeletons added: `LandingHeroSkeleton` + `LandingStatsSkeleton`
- `META.label` → `LocaleString { ka, en }` on all 3 nodes
- `META.i18n` added — hardcoded `'ნახვა'`/`'წინა'`/`'შემდეგი'` moved to i18n resources
- Shells use `useT('landing-hero')` / `useT('landing-stats')` — zero hardcoded Georgian
- `container/default/index.ts` META: `rootOnly: true` added
- `setupRegistrations.ts`: `import * as LandingNodes from '../plugins/pages/landing'`

**Why:** Grafana/Builder.io pattern — each node is a 100% self-contained unit. Co-located CSS, types, skeleton per node. No shared monolithic files across nodes.

**How to apply:** Any new landing-style nodes follow hero/default/ or stats/default/ as canonical reference.