---
title: Bootstrap Phase B (geostat SiteManifest from Postgres)
status: Designed
date: 2026-06-22
authors: architect
migrated_from: project_bootstrap_phase_b (orig. ADR-0026 Phase B)
---

# ADR-018 — Bootstrap Phase B: DB extraction of geostat content [orig. ADR-0026 Phase B]

**Status:** Designed (Phase A done — endpoint + client fetch with local fallback live). Extends the bootstrap-runner ADR (Phase A, now `ADR-0026-bootstrap-runner.md`) and is extended by ADR-017 (Phase C).

## Context

`GET /api/bootstrap` should return the real geostat `SiteManifest` from the DB, not a local `buildManifest()`. Phase A found three structural gaps that are Phase-B blockers: (1) a publish-state gap (provisioned pages return zero from bootstrap because `is_published` is never flipped), (2) a nav shape mismatch (offline `NavEntry[]` with color/icon/anchors vs the relational `nav_item` rows), and (3) a label-encoding mismatch (geostat nav uses bare Georgian strings, but `nav_item.label` is a `LocaleString` JSONB with a V14 locale-completeness trigger).

## Decision

- **Extract geostat content into `config.*` DB rows** (site_config key/value + page_version) so bootstrap serves the real manifest.
- **Store nav as a single `site_config.nav` JSONB blob (verbatim `NavEntry[]`)**, NOT in the relational `nav_item` tree — the runner's `NavEntry` is a richer presentation blob, and `site_config` has no locale trigger. `nav_item` stays as the Constructor's future authoring model (expand-contract).
- **Make publish a property of the provisioning upsert** (upsertPage publishes the version it appends and demotes siblings when `status='published'`), not a separate API call.

## Rejected Alternatives

1. **Store geostat nav in the relational `nav_item` tree** — REJECTED: byte-parity is impossible (shape mismatch — no color/icon/anchors), and bare Georgian labels would violate the V14 locale-completeness trigger (no `en`). The `site_config.nav` blob is lossless and trigger-free.
2. **Keep publish as a separate `POST /:id/publish` call after provisioning** — REJECTED: provisioning never calls it, so provisioned pages return zero from bootstrap; publish must be a property of the provisioning upsert (fail-safe, one path).

## Consequences

- Positive: bootstrap serves the real geostat manifest from the DB; nav round-trips losslessly; provisioned pages are actually published; `nav_item` remains for the future Constructor authoring model.
- Negative / cost: adds a `site_config.nav` blob that duplicates (for now) what `nav_item` will later own — an accepted expand-contract intermediate.

---

## Detailed Record (preserved verbatim from architect memory)

> Migrated from `.claude/agent-memory/architect/`. Backend/DB ADR family (see ADR-016, ADR-017).


# ADR-0026 Phase B — DB extraction of geostat content (the SiteManifest from Postgres)

Extends [[bootstrap-runner-adr]]. Status: Designed 2026-06-22. Phase A done (endpoint + client fetch w/ local fallback live).

## THREE structural gaps found in Phase A code (NOT optional — Phase B blockers)
1. **publish-state gap.** provisioning upsertPage inserts page_version with is_published=false (DB default) + sets config.page.status='published'. Bootstrap query needs BOTH p.status='published' AND v.is_published. Result today: a provisioned page returns ZERO from bootstrap. Only POST /:id/publish (config/pages.ts) flips is_published; provisioning never calls it. → FIX: upsertPage must publish the version it just appended (set is_published on the new/latest version, demote siblings) when status='published'. Make publish a property of the provisioning upsert, not a separate API call.
2. **nav shape mismatch.** offline buildManifest emits NavEntry[] = {id,path,color,label,icon,items:[{label,anchor}]} (flat, section anchors). bootstrap emits raw config.nav_item rows {id,parent_id,page_id,label,href,ord,depth}. nav_item has NO color/icon/path/anchor sub-items. Byte-parity is IMPOSSIBLE without reconciliation. → DECISION: store the full NavEntry shape in nav_item.metadata JSONB (add column) OR store nav as a single site_config 'nav' JSONB blob. CHOSE: nav as site_config.nav JSONB blob (NavEntry[] verbatim) — the nav_item relational tree is the Constructor's FUTURE authoring model; the runner's NavEntry (with anchors/color/icon) is richer than nav_item and is a presentation blob today. Bootstrap reads site_config.nav, falls back to nav_item CTE only if absent. This is expand-contract: nav_item stays for the Constructor; runner gets a lossless blob now.
3. **label encoding mismatch.** geostat NAV + page configs use BARE STRINGS for Georgian ('მთლიანი შიდა პროდუქტი'), not {ka,en} LocaleString bags. config.nav_item.label is LocaleString JSONB + V14 enforces locale completeness (every active locale non-empty). Storing geostat nav in nav_item would VIOLATE the V14 completeness trigger (no 'en'). → Another reason nav goes in site_config.nav (no locale trigger there) as the verbatim blob. Page configs already store bare strings inside page_version.config (opaque JSONB, no per-key trigger) — fine.

## DECISIONS

### 1. site_config schema for the 6 keys (5 in prompt + nav)
config.site_config stays key/value (key TEXT PK, value JSONB). Phase B writes these rows (value = JSONB):
- `index_page_id` → "landing"  (JSON string)
- `chrome`        → GLOBAL_CHROME  ({"AppBanner":"hidden"})
- `chrome_config` → CHROME_CONFIG  (brand blob: logoUrl/logoAlt/localeLabels/socialLinks/copyright/footerLinks)
- `i18n`          → I18N_CONFIG  ({locales,defaultLocale,fallbackLocale})
- `modes`         → LOCAL_MODES  (ModeDef[])
- `nav`           → NAV  (NavEntry[] verbatim — see gap #2)
Validation: keep the endpoint's pick()+validate guards (already there). i18n.locales must AGREE with config.locale: add a fitness/CI assertion that every code in site_config.i18n.locales exists & is_active in config.locale, and i18n.defaultLocale === the is_default locale. config.locale stays SSOT for "what languages exist"; site_config.i18n is the runner's projection of it (derive, don't diverge). Do NOT add a DB FK (i18n is a blob); enforce via the parity/fitness test.

### 2. EXTRACTION MECHANISM — chose (a) export script → provisioning JSON, with extensions
A committed Node/tsx script (apps/geostat side or a scripts/ dir that can import the geostat configs) that:
  - imports buildManifest()'s SOURCES (listPages(), NAV, GLOBAL_CHROME, CHROME_CONFIG, I18N_CONFIG, LOCAL_MODES, LOCAL_INDEX_PAGE_ID),
  - emits ONE ProvisioningManifest JSON (version:1) containing pages[] (slug=config.id, title from config or derived, config=the NodeDef tree, status:'published') + a NEW siteConfig[] section + nav as site_config.nav,
  - writes it to the provisioning dir (committed to git).
Then the normal boot-time loader seeds it. DB becomes SSOT after; Phase C deletes the TS.
WHY (a) not (b)/(c): (b) seed-migration hand-inserts = not auditable, drifts from TS, re-authoring by hand. (c) seed.ts is the STATS-cube ETL (different concern, different lifecycle, retired when Java backend lands) — bolting config onto it violates SoC. (a) reuses the PROVEN serialization (P3-1 lossless round-trip), is idempotent via the existing upserters, re-runnable, and produces a committed artifact a human can diff/review = auditable + repeatable. Mirrors the existing export.ts (DB→manifest); this is the TS→manifest inverse. One-time GENERATE, but the script stays in-repo so re-generation after a TS edit (pre-Phase-C) is one command.
Format extension: ProvisioningManifest gains optional siteConfig?: Array<{key,value}> (Postel: existing files w/o it unaffected).

### 3. slug === config.id — ENFORCE the contract
Manifest pages keyed by config.id; indexPageId points at id-space; provisioning upserts by slug; bootstrap re-keys pages by migrated config.id. So slug MUST equal config.id or the index page (and nav page targets) break. Chosen: ENFORCE slug===config.id (the example files already follow it). Enforcement = (a) the export script asserts page.slug === config.id and throws if not (fail-fast at generation), AND (b) a fitness test over committed provisioning JSON asserting slug===config.id for every page. Do NOT add a page-id column (YAGNI; slug already is the stable id) and do NOT re-key the manifest by slug (config.id is the renderer's identity; usePageById(indexPageId) reads id-space).

### 4. Loader changes (concrete)
- upsertPage: when status==='published', after appending the version, set is_published on the latest version + demote siblings (same UPDATE as POST /:id/publish) IN THE SAME TX. This is the gap-#1 fix and makes provisioned pages actually appear in bootstrap.
- New upsertSiteConfig(pg, {key,value}, ctx): INSERT … ON CONFLICT (key) DO UPDATE SET value, idempotent (site_config has key PK already — real UNIQUE, simpler than the FOR-UPDATE emulation the others need). jsonEqual short-circuit for unchanged.
- types.ts: add SiteConfigProvision {key:string; value:unknown}; ProvisioningManifest.siteConfig?: SiteConfigProvision[].
- parse.ts: normalizeManifest maps doc.siteConfig → asSiteConfigProvision (validate key is non-empty string; value any JSON).
- loader.ts applyManifest: apply siteConfig BEFORE pages (no dep, but keeps site-level first). Order: siteConfig → pages → dataSources → nav.
- PageProvision already carries status; export script sets 'published'.

### 5. Phase B fitness function — the parity test
A test that, against a fresh migrated DB + runProvisioning(generated dir), calls the bootstrap composition and asserts the resulting SiteManifest is EQUIVALENT to local buildManifest(). NOT raw byte-equality (nav rekeying, schemaVersion injected by API, page forward-migration, datasources from data_source rows differ). Define equivalence as a CANONICAL projection: deep-equal on {indexPageId, pages (by id, migrated both sides), nav (NavEntry[]), chrome, chromeConfig, i18n, modes}; datasources compared separately (they come from config.data_source seeded by seed-data-sources, already covered). The test is the contract that DB extraction is lossless. Run it in CI. Pair with the i18n↔config.locale agreement assertion (decision #1).

### 6. Sequencing + reversibility
1. Loader changes (gap-#1 publish fix + upsertSiteConfig + format) — additive, tested in isolation. Reversible (code).
2. Write + run export script → commit generated provisioning JSON. Reversible (delete the JSON; loader never deletes DB rows but a fresh DB re-converges).
3. Stand up the parity fitness test (decision #5). GATE: dryRun the provisioning in CI first (loader already supports dryRun).
4. Flip geostat VITE_SITE_MODE=api against the seeded DB; the local buildManifest() fallback stays (Phase A gate) so any failure degrades to local. GATE: env flag flips back.
Reversibility: everything Phase B is two-way until Phase C deletes the TS sources. Keep the git tag pre-Phase-C (per ADR). The export script + committed JSON mean re-generation is always possible from the TS until Phase C.

## BLAST RADIUS
- Loader publish-fix touches upsertPage — used by ALL file provisioning (incl. example.page.json) + tested. Changing is_published behavior affects what bootstrap returns. Mitigated: behavior change is "provisioned published pages now actually publish" (the intended fix); draft-status pages unaffected.
- site_config new rows: bootstrap already reads + defaults them; writing real values only REMOVES the "served defaults" log path. No consumer breaks.
- nav-in-site_config: bootstrap must learn to read site_config.nav (NavEntry[] blob) and emit it as manifest.nav, falling back to the nav_item CTE if absent. This is a bootstrap endpoint change (small) — without it, parity fails (gap #2). Constructor's nav_item authoring path untouched.
- No migration needed (site_config key/value already exists; nav as blob avoids a nav_item schema change). config.locale untouched.
- Export script imports geostat src — build-time only (like seed.ts importing raw.ts); no runtime arrow violation.
