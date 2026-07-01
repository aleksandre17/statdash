---
name: failsoft-chrome-and-app-boundary
description: WHY chrome shells must null-guard chromeConfig (resolveChrome mounts ALL registered slots, not the site chrome map) + the two-layer fail-soft guarantee (shell guard + AppErrorBoundary)
metadata:
  type: project
---

The ADR-0028 fail-soft guarantee (runner boots to `emptyManifest()` when `/api/bootstrap` is unreachable) is fitness-locked in two layers.

**Non-obvious root fact:** `packages/react/src/engine/resolveChrome.ts` iterates `chromeRegistry.listSlotMeta()` — EVERY registered chrome slot — NOT the site `manifest.chrome` map. So a chrome shell (app-header, footer, sidebar, locale-switcher) mounts to its `'default'` variant even when the manifest sets `chrome:{}`. Consequence: any chrome shell that dereferences `useChromeConfig()` fields UNCONDITIONALLY will crash on `emptyManifest()`'s `chromeConfig:{}`. The historical break was `AppHeaderShell` doing `t(config.logoAlt)` on `undefined` → `resolveLocaleString` reads `undefined['en']` (`packages/core/src/i18n/types.ts` resolveLocaleString) → throw → (no boundary) whole tree unmounts to a blank page.

**Why:** de-tenanting made the offline/unconfigured fallback a first-class boot path; a shell that assumes brand identity is always present breaks it.

**How to apply:** any NEW chrome shell MUST guard its `useChromeConfig()` reads (footer/sidebar/locale-switcher already use `config.x &&` / `?.`; app-header now gates the brand block on `Boolean(config.logoUrl && config.logoAlt)`). Keep neutral literals OUT of shared shells (Law 4) — the brand-free state is the omitted element, not an English string in the shell. The app-root catch-all is `AppErrorBoundary` (`packages/react/src/components`, exported from `@statdash/react`) — a mechanism-only class boundary whose fallback is INJECTED as a prop (so the agnostic react layer stays literal-free); `apps/geostat` App.tsx wraps every render path with a neutral self-contained `AppUnavailable` (inline styles, no i18n/token dependency — the failure may have taken those down). Guards: `app-header.failsoft.fitness.test.tsx` (FF-CHROME-FAILSOFT) + `AppErrorBoundary.test.tsx`. Related: [[render_path_browser_verify]].
