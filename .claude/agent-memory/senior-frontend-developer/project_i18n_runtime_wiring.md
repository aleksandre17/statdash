---
name: i18n-runtime-wiring
description: "The registerManifestI18n shared runner+panel boot seam (year-select KA fix, card 0093b) + the accessible-name i18n class (card 0093) — [object Object] aria from a LocaleString flattened into a bare-string slot, useTSafe, and the render-leak gate's attribute blind spot. Consolidated distillate."
metadata:
  type: project
---

> Consolidated 2026-07-22 from 2 sibling files (manifest-i18n-shared-seam,
> chrome-accessible-name-i18n). See [[project_i18n_map]] for the catalog mechanism itself
> (ADR-019); this file covers the CONSUMER-side fixes it enabled + a related integrity class.

## registerManifestI18n as the shared boot seam (card 0093b)
The chain that fixed "year-select aria = hardcoded English on a KA page" WITHOUT baking Georgian
into library code:
- The app-agnostic plugin `controls/year-select/default/index.ts` META carries ONLY the en-neutral
  baseline `i18n:{en:{label:'Year'}}` (English is the neutral source language, Law 3). The tenant
  Georgian label lives in the geostat provisioning catalog under the `year-select` namespace,
  bilingual (both arms — the catalog is the bilingual SSOT; provisioning fitness requires every
  namespace/key present in ALL active locales).
- A filter control's shell reads `useT('year-select')('label')` as the fallback when no explicit
  `config.label` is authored (was a hardcoded `'Year'`).
- **Panel parity (the load-bearing part):** the panel Constructor's `bootstrapCatalog.ts` fetched
  `/api/bootstrap` and registered metrics+dimensions but NOT i18n, so the :3013 studio canvas
  resolved control labels only from plugin META, never a tenant catalog. Adding
  `registerManifestI18n(manifest.i18n)` there means the live canvas previews a tenant's authored
  locale chrome exactly as the runner renders it (AR-52 canvas-never-lies) — without it, moving a
  label out of the plugin would have regressed the studio's ka aria back to the English default.
- **Live-deploy dependency:** showing a new catalog entry live needs a remote provisioning re-seed
  (backend deploy) — frontend src-sync alone cannot show it.

## The accessible-name i18n integrity class (card 0093)
**The `[object Object]` ROOT is a TYPE issue, not a render bug.** `SocialLinkDef.label` was typed
bare `string`; provisioning authored a `{ka,en}` LocaleString into it; `aria-label={social.label}`
flattened the object. Fix at the contract: widen the field to `LocaleString` +
`coverage:'localized'` and resolve at the render seam `aria-label={t(social.label)}` — never
`.toString()`. Same seam as body copy, see [[project_i18n_map]] AR-26.

**The render-leak gate had a BLIND SPOT — it scanned `container.textContent` only.** An
`aria-label`/`title`/`alt` lives in an ATTRIBUTE, never in `textContent`, so
`FF-RENDER-NO-LOCALE-LEAK` rendered the offending header but never SAW the `[object Object]`.
Fix that closes the CLASS: also collect the accessible-name attributes (`aria-label`, `title`,
`alt`, `placeholder`, `aria-description`) across every page×locale and assert no `[object Object]`
+ no leaked Georgian on `/en`. The `.locale-switcher` subtree is excluded from both scans (it
renders endonyms by design).

**`useTSafe` — the non-throwing `useT` twin** (`packages/react/.../SiteContext.tsx`). `useT` calls
`useLocale`, which THROWS outside `<SiteProvider>`. `NodeErrorBoundary` is the last line of
defense and can fire ABOVE or without a provider (boot crash / isolated story), so its localized
fallback needs a safe resolver — `useTSafe(ns)` reads locale from context when present, else lets
i18next resolve its own language. Symmetric with `useResolveLocaleSafe`. Any context-optional
chrome showing i18n strings must use it, not `useT`.

**Studio topbar** (`PageWorkflowBar.tsx`) localizes via the panel's own local `T={key:{ka,en}}`
map + `useActiveLocales()[0]` — NOT the plugin `useT`/`registerSlice` path (that's runtime chrome).
Same pattern as `PageBrowser`.

**Dark table-header contrast (WCAG 1.4.3), found in the same sweep:** `.data-table th` used
`--color-text-faint` (tuned for `--color-surface`), but the header sits on the lighter
`--color-surface-raised` → 4.28:1 in dark, an AA fail. `--color-text-muted` is the correct
mode-aware pair (5.09:1 dark / 5.28:1 light). Rule of thumb: a muted label ON a raised/sunken
surface needs `-muted`, not `-faint` (`-faint` only clears AA on the base surface). See
[[project_dark_mode_theming]].
