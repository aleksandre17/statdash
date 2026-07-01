---
name: chrome-config-seam
description: Thin ChromeConfig base + per-element chrome PropSchema seam (ISP/OCP) and the fitness gate that freezes it
metadata:
  type: project
---

Element-specific chrome config lives on the ELEMENT's `meta.ts` PropSchema, never on the shared `ChromeConfig` base (ISP/OCP). The shared base (`packages/react/src/context/ChromeConfig.ts`) holds ONLY cross-cutting fields: `logoUrl`, `logoAlt`, `localeLabels`, `copyright`.

**Why:** ChromeConfig was bloating with single-consumer fields (brandTitle/sectionsLabel read only by inner-sidebar; socialLinks header-only; footerLinks footer-only). Migrated each to its element's own schema + per-slot config.

**Where the migrated fields now live:**
- `brandTitle`, `sectionsLabel` → `packages/plugins/chrome/inner-sidebar/default/meta.ts` (`InnerSidebarConfig` + `InnerSidebarSchema`)
- `socialLinks` → `packages/plugins/chrome/app-header/default/meta.ts` (`AppHeaderConfig`, owns `SocialLinkDef`)
- `footerLinks` → `packages/plugins/chrome/app-footer/default/meta.ts` (`AppFooterConfig`, owns `FooterLinkDef`)

`SocialLinkDef`/`FooterLinkDef` are NO LONGER re-exported from `@statdash/react` — they belong to plugins (the arrow forbids react importing plugins).

**Runtime data flow (how slot config reaches a shell):** provisioning `chrome` blob's per-slot `config` → DB `site_config.chrome` → bootstrap pass-through → `SiteProvider chrome` → `useSiteChrome()` → `ChromeSlot`/`resolveChrome` → `ChromeSlotConfigProvider` → `useSlotConfig<T>()`. Shells read the base via `useChromeConfig()`, element config via `useSlotConfig<T>()`.

**How to apply:** new chrome element = a new `meta.ts` with its own `PropSchema` + `<Element>Config` type, base UNTOUCHED. LocaleString fields use `coverage:'localized'`.

**The gate (the standing standard):** `platform/tests/chrome-config.fitness.test.ts` — table-driven F1 (base = allowlist exactly) + F2/F3 (no allow-listed field is single-consumer unless a site singleton). Adding a field to ChromeConfig fails the build. The allowlist + `singletons` array in `SHARED_BASE_RULES` is the SSOT.

**Close call (logged judgment):** `logoUrl`/`logoAlt`/`localeLabels` are single-consumer TODAY but kept on the base as true SITE SINGLETONS (one logo / one locale-label map per site, not per-slot authoring). Only `copyright` is genuinely ≥2-consumer (footer + sidebar). The F2 `singletons` exemption encodes this "≥2 consumers OR site singleton" rule.

**Latent seam defect fixed along the way:** `ChromeSlot` resolved per-slot `config` as all-or-nothing (`pageEntry != null ? pickConfig(pageEntry) : pickConfig(siteEntry)`), so a VARIANT-only page override (the inner-page META default `{ InnerSidebar: 'default' }`) shadowed the site-level slot config → sidebar brand rendered empty. Fixed to resolve config per-facet down the chain: `pickConfig(page) ?? pickConfig(site) ?? {}` (matching `resolveChrome`). End-to-end render test: `apps/geostat/src/data/inner-sidebar-slot-config.test.tsx`.
