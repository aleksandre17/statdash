---
name: config-api-contract
description: Shape & quirks of the @statdash/api /api/config endpoints the panel Constructor talks to
metadata:
  type: reference
---

Constructor config API (Fastify, default `http://localhost:3001`, prefix `/api/config`). Source of truth: `platform/apps/api/src/routes/config/*.ts`. Panel client: `platform/apps/panel/src/lib/api.ts`.

Envelope: success `{ data: T }`; error `{ error, message? }` + non-200.

**Non-obvious contract details (verified against route source):**
- `data-sources` type enum is `'sdmx-json' | 'rest' | 'static'` (NOT `'sdmx'`) — matches `data_source_type_chk`. The domain `DataSourceType` was fixed to match.
- `POST /data-sources` body takes `url?` (optional, not nullable); `PUT` takes `url` nullable. Rows return `url: string | null`.
- `pages`: GET `/pages` lists non-archived; GET `/pages/:id` LEFT JOINs the latest `page_version` (config + data_specs live in the version, not the page row). POST returns only `{ id }`; PUT returns `{ id, version_number? }` and appends a new immutable version. DELETE is a soft archive (`status:'archived'`).
- `site` is a key/value upsert map (`config.site_config`) — PUT echoes back the body (write body typed `SiteConfigMap = Record<string,unknown>`). GET `/site` returns `SiteConfigResponse` (`@statdash/contracts`): the open settings map PLUS server-projected `activeLocales: string[]` (ORDERED, `config.locale WHERE is_active ORDER BY ord, code`) + `defaultLocale: string` (is_default, fallback activeLocales[0]). These two are derived on read, NOT stored in the blob (SSOT = config.locale registry). Nav is a SEPARATE resource (`config.nav_item`), returned as a tree ordered by `depth, ord`. `fromApiSite` builds `SiteDef.nav` from nav rows (keeping only `page_id != null`) AND maps `activeLocales` onto `SiteDef.activeLocales` (string-filtered).
- `SiteDef.activeLocales` (panel domain) is the active-locale SSOT for LocaleString authoring. `useActiveLocales` narrows it to the known `Locale` union (`['ka','en']`), falling back to default-first `orderLocales(defaultLocale)` when empty/unknown (mock-data path / older payload). The old hardcoded `PLATFORM_LOCALES` seam is CLOSED. NOTE: `api-actions.ts` save-guard still builds its active set via `orderLocales(defaultLocale)`, not `site.activeLocales` — a deliberate non-expansion; revisit when a non-ka/en locale ships.
- Canvas tree (`nodeIds` + `nodes`) is serialized into the page version's `config` object (`toApiPage`/`fromApiPage`), not separate columns.

**How to apply:** treat `spec`/`config` payloads as opaque `Record<string,unknown>` (Law 1/2 — never narrow to stat dimensions, never put functions in config). The store stays synchronous; async lives in `store/api-actions.ts` thunks (optimistic write-through, no rollback yet — Phase 3).
