---
name: chrome-shell-mechanisms
description: "The ChromeConfig ISP seam (thin shared base + per-element PropSchema), why chrome shells must null-guard chromeConfig (resolveChrome mounts ALL registered slots), and per-entry nav authoring. Consolidated distillate."
metadata:
  type: project
---

> Consolidated 2026-07-22 from 3 sibling files (chrome-config-seam, failsoft-chrome-and-app-boundary,
> panel-nav-chrome-authorable).

## ChromeConfig ISP seam
Element-specific chrome config lives on the ELEMENT's `meta.ts` PropSchema, never the shared
`ChromeConfig` base (`packages/react/src/context/ChromeConfig.ts`), which holds ONLY cross-cutting
fields: `logoUrl`, `logoAlt`, `localeLabels`, `copyright`. Migrated single-consumer fields to their
owning element: `brandTitle`/`sectionsLabel` → inner-sidebar meta; `socialLinks` → app-header meta;
`footerLinks` → app-footer meta (their `*Def` types are NOT re-exported from `@statdash/react` —
plugins own them, arrow forbids react→plugins).

**Runtime data flow:** provisioning `chrome` blob's per-slot `config` → DB `site_config.chrome` →
bootstrap pass-through → `SiteProvider chrome` → `useSiteChrome()` → `ChromeSlot`/`resolveChrome` →
`ChromeSlotConfigProvider` → `useSlotConfig<T>()`. Shells read the base via `useChromeConfig()`,
element config via `useSlotConfig<T>()`.

**The gate:** `platform/tests/chrome-config.fitness.test.ts` — F1 (base = allowlist exactly), F2/F3
(no allow-listed field is single-consumer unless a declared SITE SINGLETON — `logoUrl`/`logoAlt`/
`localeLabels` are single-consumer today but kept as true singletons; only `copyright` is genuinely
≥2-consumer). Adding a field to ChromeConfig fails the build unless justified this way.

**Latent seam defect fixed along the way:** `ChromeSlot` resolved per-slot `config` all-or-nothing
(`pageEntry ?? siteEntry`), so a VARIANT-only page override shadowed the site-level slot config →
sidebar brand rendered empty. Fixed to resolve per-facet down the chain:
`pickConfig(page) ?? pickConfig(site) ?? {}`.

## Why chrome shells MUST null-guard chromeConfig
**Non-obvious root fact:** `packages/react/src/engine/resolveChrome.ts` iterates
`chromeRegistry.listSlotMeta()` — EVERY registered chrome slot — NOT the site `manifest.chrome`
map. So a chrome shell mounts to its `'default'` variant even when the manifest sets `chrome:{}`
(the ADR-0028 fail-soft `emptyManifest()` path). A shell that dereferences `useChromeConfig()`
fields unconditionally crashes there — the historical break was `AppHeaderShell` doing
`t(config.logoAlt)` on `undefined` → `resolveLocaleString` reads `undefined['en']` → throw → (no
boundary) the whole tree unmounts to a blank page.

**How to apply:** any NEW chrome shell MUST guard `useChromeConfig()` reads (`config.x &&`/`?.`);
keep neutral literals OUT of shared shells (Law 4) — the brand-free state is the OMITTED element,
not an English string. The app-root catch-all is `AppErrorBoundary` (mechanism-only, fallback
INJECTED as a prop so packages/react stays literal-free); `apps/geostat` wraps every render path
with a neutral self-contained `AppUnavailable` (inline styles, no i18n/token dependency — the
failure may have taken those down too). Guards: `app-header.failsoft.fitness.test.tsx`
(FF-CHROME-FAILSOFT) + `AppErrorBoundary.test.tsx`.

## Nav made per-entry authorable (closed the "can't touch the left-bar nav" dead end)
`NavEditor` had add/reorder/delete but no per-entry edit — added `updateNavItem(id, patch)`
(history-tracked) + an inline per-row editor (label ka/en + target-page select), one row open at a
time. Order stays drag-reorder.

**THE persistence-integrity boundary (real gap, not faked):** the `/nav` wire (`NavRow`/
`NavCreateBody`/`NavUpdateBody` + server + `fromApiSite`) carries ONLY `label`/`page_id`/`ord`/
`parent_id`/`depth` — there is NO `icon` and NO `hidden`/visibility column. So per-entry ICON and
VISIBILITY are NOT persistable end-to-end; shipping controls for them would be a fake
un-persistable UI (least-astonishment violation). The runtime `NavEntry` renders a hardcoded icon
(`canvasSiteChrome.ts CANVAS_NAV_ICON='document'`, empty color) because of this gap. Root fix
(cross-lane, not done) = add `icon`/`hidden` nav-schema columns + wire adapters through
`packages/contracts` + the runner's nav aggregation, THEN author them.

Chrome reachability: `ChromePalette` lives in `PagesSiteSurface` (chrome is SITE furniture, not
page content) — see [[project_panel_canvas_chromeconfig_defect]] PART C. Selecting it opens
`ChromeInspectorPanel` in the RightDock via the already-wired chrome-selection arm.
