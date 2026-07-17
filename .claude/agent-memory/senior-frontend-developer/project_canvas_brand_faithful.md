---
name: canvas-brand-faithful
description: Brand-in-manifest (AR-52 W1) — the portable themeOverrides brand channel + the ONE @statdash/styles apply mechanism (buildThemeVars/applyThemeOverrides) the canvas AND runner share, dark-safe; Law-5 fix retiring baked [data-tenant] brand CSS
metadata:
  type: project
---

The chrome-BRAND half of canvas faithfulness (AR-52 W1, commit d6faff8). Sibling of
[[project_panel_canvas_chromeconfig_defect]] PART E (that thread = chrome reach/render;
this = chrome brand).

**Root cause (Law-5 erosion):** the site's accent family was baked into the runner APP
as `[data-tenant="geostat"]` CSS (`apps/geostat/src/shared/styles/index.css` +
`main.tsx` `dataset.tenant='geostat'`), NOT carried in portable config. The Constructor
canvas only has config → no brand input → it painted the panel's Strata tool-skin
(accent `#14508C`), never the published GeoStat blue (`#0080BE`).

**Fix = brand-in-manifest, ONE shared apply mechanism both the canvas and runner use.**

## The SSOT mechanism — `@statdash/styles/utils/themeVars.ts` (NEW)
- `buildThemeVars(...layers)` — `{tokenKey→value}[]` → `{--css-var→value}` (framework-
  neutral `Record<string,string>`; maps via `TOKENS_CATALOG[key].cssVar`; later layers
  win; skips empty/unknown). `cssVarName`, `themeOverridesCss`, `applyThemeOverrides`.
- Was originally `apps/panel/src/studio/themeVars.ts`; MOVED to styles so the runner can
  share it WITHOUT importing apps/panel (Law 3 — neither app imports the other). The
  panel file now RE-EXPORTS `cssVarName`/`buildThemeVars` from styles (importers:
  StudioShell, muiTheme, StyleSurface — unchanged). Exported from styles `index.ts`.
- **GOTCHA: keep styles tenant-generic** — `no-tenant-content.fitness` (packages/react)
  scans packages/styles for `/geostat/i` with an EMPTY allowlist. Comments say "the
  runner app", NEVER the tenant name.

## DARK-SAFE apply (the key design nuance)
`applyThemeOverrides(overrides, doc?)` maintains ONE `<style id="statdash-theme-
overrides">:root{…}</style>` in head. The selector is a SINGLE `:root` (specificity
0,1,0) DELIBERATELY — it LOSES to `[data-theme=dark]` (0,2,0), so a light-tuned brand
map never freezes the dark cascade (the [[project_geostat_tenant_dark_cascade_gap]]
trap, designed around). Idempotent (updates textContent, never stacks); removes the
element on empty/undefined map. NOTE: StudioShell's inline `:root:root` is 0,2,0 and
would TIE/beat dark — that's why the runner uses a single-`:root` STYLESHEET rule, not
inline. In light: the injected rule (appended at runtime, later source order) wins over
the baked `[data-tenant]` base (0,1,0) — same values, so idempotent.

## The wiring (end to end)
- `SiteManifest.themeOverrides?` (`packages/contracts/manifest.ts`, optional/additive) —
  delivery mirror of `SiteDef.themeOverrides` (absent ⇒ brand-neutral default, byte-id).
- `apps/api` bootstrap projects the `themeOverrides` site_config KEY verbatim. **KEY IS
  camelCase `themeOverrides`** — the panel already reads/writes `map.themeOverrides`
  (`lib/api.ts` `fromApiSite`, `store/api-actions.ts` `saveSite`); the `theme_overrides`
  snake-case in old api comments is aspirational, NOT the real key.
- Geostat provisioning `siteConfig` now carries a `themeOverrides` key (accent family,
  mirroring the baked light values) → 8 site_config keys (was 7). The Law-5 fix.
- `apps/geostat/App.tsx` boot: `applyThemeOverrides(manifest.themeOverrides)` before
  first render. STRANGLER: baked `[data-tenant]` CSS still ships as proven fallback.
- CANVAS: `CanvasView` gained `themeVars?: CSSProperties` on `.canvas-root`; StudioShell
  feeds `buildThemeVars(site.themeOverrides)` (the SITE's brand, NOT Strata — Strata
  stays on `:root:root` for the tool + MUI portals). RESIDUAL (flagged): non-brand base
  neutrals (text) still inherit Strata on the canvas — accent/chrome faithfulness exact,
  base neutrals close-not-identical.

## Gates + verify
`chromeFaithful.fitness.test.tsx` (**FF-CHROME-FAITHFUL** — canvas brand ≡ runner brand,
both via the SAME transform; dark-safe; brand-less→byte-identical), styles
`themeVars.test.ts`, `geostat-provisioning.fitness` (8-key set + accent seed).
**LIVE-VERIFY BLOCKED in-env**: no API/DB (panel login 502; running runner :5173 threw
`504 Outdated Optimize Dep` the instant styles/contracts dist rebuilt — empirical proof
a packages change needs the dev-image/dev-server rebuild). E2E live proof needs (a) DB
re-provisioned with the `themeOverrides` seed, (b) geostat dev-image rebuild — the
lead's W1-close steps. Mechanism proven at custom-property level (jsdom can't var()/rect).

See also [[semantic-token-spine]] (the Tier-2 token layer themeOverrides rebinds).
