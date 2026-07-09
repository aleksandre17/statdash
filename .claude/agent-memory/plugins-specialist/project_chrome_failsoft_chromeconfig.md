---
name: chrome-failsoft-chromeconfig
description: useChromeConfig folds an ABSENT chromeConfig to EMPTY_CHROME_CONFIG sentinel (never throws); every chrome shell is fail-soft brand-free
metadata:
  type: project
---

Chrome shells fail SOFT on an absent chromeConfig — a chrome shell must not
hard-crash on absent OPTIONAL context.

`useChromeConfig()` (packages/react/src/context/SiteContext.tsx) returns
`ctx.chromeConfig ?? EMPTY_CHROME_CONFIG` — it does NOT throw when a SiteProvider
carries no chromeConfig. `EMPTY_CHROME_CONFIG` is a frozen `{}` sentinel exported
from `context/ChromeConfig.ts` (NOT on the public `@statdash/react` barrel — kept
module-scoped, no consumer needed it yet). The hook STILL throws when called
OUTSIDE a SiteProvider (genuine misuse, consistent with every other site hook).

**Why:** An absent chromeConfig is indistinguishable, to every consumer, from the
sanctioned app-tier offline-fallback `chromeConfig: {}` (geostat `emptyManifest()`,
site-manifest.ts). Every shell already guards every field — AppHeader `hasBrand`
logo guard, footer/sidebar `config.copyright &&`, locale-switcher
`config.localeLabels?.[l]`. So folding absent→empty makes EVERY chrome-less mount
valid (Law 8 reusable correctness). Same Postel posture as `useResolveLocaleSafe`.

**How to apply:** The Constructor's live canvas (apps/panel CanvasView) mounts a
SiteProvider WITHOUT chromeConfig — that is now VALID, no chromeConfig prop needed.
The `packages/react` `no-tenant-content.fitness.test.ts` gate is STRICT: no
`/geostat/i` token may appear in packages/react — even in a comment. When
documenting the offline-fallback equivalence in that layer, say "app-tier
offline-fallback manifest", never name the tenant.

Regression nets: `packages/plugins/chrome/chrome-config-optional.fitness.test.tsx`
(every chrome shell renders brand-free without chromeConfig) + `packages/react/
src/context/useChromeConfig.fitness.test.tsx` (hook contract: sentinel + frozen +
still-throws-outside-provider). See [[shell-render-testing]].

Related OPEN gap (same class, engine layer, NOT fixed): `interpretKpis`
(packages/core/src/data/kpi.ts) does `specs.filter(...)` and throws on undefined
specs — a kpi-strip node with no specs crashes into NodeErrorBoundary. Guard =
`specs ?? []`. Engine-layer owner, route via architect.
