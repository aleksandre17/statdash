---
title: Runner-chrome i18n via the manifest i18n catalog
status: Accepted
date: 2026-07-04
authors: senior-frontend
extends: ADR-017 (geostat de-tenant Phase C), ADR-0026 (bootstrap runner), AR-37 (i18n leak-proof gates)
---

# ADR-020 — Runner-chrome i18n via the manifest i18n catalog

**Status:** Accepted (implemented on `feat/runner-chrome-i18n`).

## Context

The de-tenanted geostat runner (ADR-017) ships a small set of GENERIC framework UI-chrome
strings under the i18next `feedback` namespace — consumed by shared components that live in
the library layer, not in the tenant config:

- `packages/react` `EmptyState` — `empty.title` ("No data"), `empty.desc`
- `packages/react` `ExportBar` — `export.toolbar` ("Export data"), `export.download` ("Download {{fmt}}")
- `apps/geostat` `SharePermalinkButton` extension — `share.permalink` ("Copy permalink")

These are registered EN-ONLY by `apps/geostat/src/i18n/feedback.ts` (`registerFeedbackI18n`).
Every OTHER chrome/node/panel/control namespace (`AppHeader`, `LocaleSwitcher`, `section`,
`kpi-strip`, `filter-bar`, …) is bilingual because its catalog rides `SliceMeta.i18n` /
`ChromeSliceMeta.i18n`, registered by `registerSlice` under the slot namespace (AR-37 P1).
The `feedback` namespace is the ONE namespace not registered through a slice — so it had no
path to a tenant locale, and rendered **English on `/ka`** (EmptyState → "No data",
ExportBar → "Export data", the permalink button title → "Copy permalink").

The runner's own `feedback.ts` comment already PROMISED the fix ("Tenant locales … arrive at
boot from the manifest i18n catalog"), and `SiteManifest.i18n` (`I18nConfig`) was the intended
carrier — but that catalog path was **declared and never wired**. `I18nConfig` carried only
`{ locales, defaultLocale, fallbackLocale }`; there was no translation catalog on the wire and
nothing loaded one into i18next at boot.

The prior note flagged baking `ka` into the runner as a "one-way door / erosion" risk. That
framing conflated *Georgian script* with *tenant content*. **Georgian is a tenant LOCALE, not
Geostat brand.** A future `fr`/`de` statistical agency would inherit Georgian baggage if the
runner baked in `ka`. The generic runner must stay locale-neutral (en baseline only); tenant
locales for generic chrome must arrive per-tenant from the manifest.

## Decision

**Extend the manifest `i18n` blob with an optional `catalog` field carrying the i18next
resource shape, load it into i18next at boot, and author the `feedback` namespace bilingually
in provisioning. The runner keeps ONLY its en baseline.**

1. **Wire shape (the one-way-door commitment):** `I18nConfig.catalog?` — an
   `I18nCatalog = Record<locale, Record<namespace, Record<key, string>>>`. This IS i18next's
   native `Resource` shape (locale-outer), adopted whole (Law 4) — zero impedance with
   `addResourceBundle`. It is an ADDITIVE, backward-compatible field on the renderer-owned i18n
   blob: `packages/contracts` still types `i18n` as opaque `JsonRecord`, so **no api code
   changes** — the bootstrap route passes `site_config.i18n` through verbatim (Postel), and old
   manifests with no `catalog` still boot (the en baseline covers them).

2. **Boot load (runner):** `registerManifestI18n(i18n)` iterates `catalog` and calls
   `i18next.addResourceBundle(locale, ns, keys, /*deep*/ true, /*overwrite*/ true)` — the tenant
   catalog is authoritative. It runs in `App`'s bootstrap effect alongside `registerFormatters`
   (both are "manifest data → registry" seams), before the first render. It is LOCALE-AGNOSTIC
   (Law 1): it iterates whatever locales/namespaces the manifest declares — never references
   `ka`/`en` by name.

3. **Baseline becomes gap-fill, not clobber:** `registerFeedbackI18n` switches from
   `addResources` (overwrites) to `addResourceBundle(en, 'feedback', keys, false, false)` — the
   en baseline now only FILLS GAPS and never clobbers a tenant-provided value. This makes the
   load order between the baseline (in the lazy renderer chunk) and the catalog (in the eager
   boot effect) irrelevant: baseline never wins over the catalog, catalog always wins over the
   baseline. Correct fallback-layer semantics.

4. **Tenant authoring (provisioning):** `geostat.provisioning.json` `site_config.i18n` gains a
   `catalog` block with `en` + `ka` arms for the `feedback` namespace. Georgian lives in the
   provisioning artifact (a tenant-content home that the `no-tenant-content` gate does not scan;
   `check-laws` Law 4 scans only `packages/core`) — NOT in the runner. Zero erosion.

5. **Gate (regression-proof):** `authoring-locale-complete.fitness.test.ts` gains INV3
   (catalog completeness): every `(namespace, key)` pair present in ANY locale of the catalog
   must be present in EVERY active locale as a non-empty string, and the catalog must localize
   at least one pair (non-vacuous floor). An en-only `feedback` namespace — the original bug —
   now FAILS the gate. Self-maintaining: a new framework-chrome namespace added to any locale is
   automatically required in all locales.

## Rejected Alternatives

1. **Bake `ka` into the runner's `feedback.ts`.** REJECTED — Georgian is a tenant locale, not
   universal-platform content; a non-Georgian tenant would inherit Georgian chrome. Violates
   ADR-017 (pure generic runner) and Law 1 (no privileged/tenant literals in library/runner
   code). This is the erosion the prior note rightly feared — the manifest catalog avoids it.

2. **Move `feedback` strings into a `ChromeSliceMeta.i18n` and register via `registerSlice`
   (the AR-37 P1 chrome pattern).** REJECTED — `EmptyState`/`ExportBar` are shared
   `packages/react` components and `SharePermalinkButton` is an app-tier extension; none is a
   registered slice. Forcing them under a slice would require inventing a synthetic "feedback
   slice" with no node/panel/chrome identity — a parallel mechanism, not the standard one.

3. **A separate `GET /api/i18n/:locale` catalog endpoint (lazy per-locale fetch).** REJECTED —
   ADR-0026 composes the whole site in ONE atomic bootstrap read; a second round-trip
   contradicts that pattern and adds a boot waterfall for a handful of keys. Inlining the small
   catalog in the manifest is the cheaper, atomic choice.

## Consequences

- **Positive:** `/ka` now renders every generic chrome string in Georgian; the runner stays
  locale-neutral (en baseline only); ANY future framework-chrome namespace localizes through the
  same catalog with no new mechanism (Law 8 — open for extension); zero api code change; old
  manifests keep booting (backward-compatible / expand-contract); the leak is now a structural
  red test.
- **Reversibility:** MOST reversible option — the catalog is additive; removing it degrades to
  the en baseline, never breaks a stored manifest. The one-way-door concern is neutralized: the
  commitment is only "the i18n blob MAY carry an i18next-shaped catalog", the most conservative
  possible schema extension.
- **Cost / accepted trade-off:** the provisioning `en` arm duplicates the runner's en baseline.
  This is deliberate: the baseline is the OFFLINE/emptyManifest fallback (renders before any
  manifest exists), the catalog is the ONLINE tenant-authored copy. They serve different failure
  modes; the gap-fill baseline semantics keep them from fighting.
