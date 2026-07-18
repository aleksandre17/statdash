---
name: manifest-i18n-shared-seam
description: registerManifestI18n moved to @statdash/react as the shared runner+panel boot seam; year-select ka label lives in the tenant catalog, not plugin META (Law 3); config-label-completeness exempts the catalog subtree
metadata:
  type: project
---

Card 0093b (Law-3 remedy for the year-select KA aria). The chain that fixes
"year-select aria = hardcoded English on a KA page" WITHOUT baking Georgian into
library code:

**The split (mirrors feedback.ts).** The app-agnostic plugin
`packages/plugins/controls/year-select/default/index.ts` META carries ONLY the
en-neutral baseline `i18n: { en: { label: 'Year' } }` — English is the neutral
source language, the only baseline a library file may carry (Law 3). The tenant
Georgian label lives in the geostat provisioning catalog
(`apps/api/provisioning/geostat.provisioning.json` → siteConfig `i18n.catalog`)
under the `year-select` namespace, BILINGUAL (both en+ka arms — the catalog is the
bilingual SSOT; the api provisioning fitness gates require every catalog
namespace/key present in ALL active locales).

**The shared seam.** `registerManifestI18n` now lives in **@statdash/react**
(`src/i18n/registerManifestI18n.ts`, exported from index) — the i18n sibling of
`registerManifestMetrics/Dimensions` (which live in @statdash/engine). It sits in
react, not the pure engine, because i18next is a UI concern (optional peer). It
loads `i18n.catalog` via `addResourceBundle(locale, ns, keys, deep=true,
overwrite=true)`. geostat's `apps/geostat/src/i18n/manifest-catalog.ts` is now a
thin re-export. **@statdash/react is locale-agnostic-gated**: no `'ka'` literal and
no Georgian codepoints even in COMMENTS (post-edit-laws hook), and no `/geostat/i`
token even in comments (the react no-tenant-content.fitness). Word the docs
neutrally ("the tenant runner", "a localized label").

**Panel parity (the load-bearing part).** The panel Constructor's
`apps/panel/src/store/bootstrapCatalog.ts` fetched /api/bootstrap and registered
metrics+dimensions but NOT i18n — so the :3013 studio canvas resolved control
labels only from plugin META (registerSliceI18n), never a tenant catalog. I added
`registerManifestI18n(manifest.i18n)` to bootstrapCatalog so the live canvas
previews a tenant's authored locale chrome exactly as the runner renders it
(AR-52: the canvas never lies). Without this, moving the ka label out of the
plugin would have regressed the studio's ka aria to 'Year'. The panel i18n
resources are otherwise ONLY filled by slice metas (`boot/initI18n.ts`).

**config-label-completeness catalog exemption (root cause, not symptom).**
`apps/api/src/provisioning/config-label-completeness.fitness.test.ts` treats any
leaf key in `DISPLAY_KEYS` (incl. `label`) as a LocaleString bag needing an
`{en,ka}` leaf. The i18next `catalog` subtree is shaped locale-OUTER
(`catalog[locale][ns][key]=string`), so a `label` leaf there is NOT a bag — its
cross-locale completeness is authoring-locale-complete.fitness's job. Added
`catalog` to BINDING_SEGMENTS so the two gates' models don't collide. (The
`feedback` namespace never tripped this only because its keys aren't DISPLAY_KEYS.)

**Live deploy dependency (flagged, NOT done).** :3013 showing 'წელი' requires the
remote API /api/bootstrap to carry the new catalog entry — a remote provisioning
RE-SEED (backend deploy). As of 2026-07-18 the remote bootstrap returns
`ka.year-select: None`. Frontend src-sync alone cannot show 'წელი'; the catalog is
the SSOT. See [[project_runner_chrome_i18n_adr019]], [[project_chrome_accessible_name_i18n]].
