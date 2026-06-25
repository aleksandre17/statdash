// ── source-descriptor.ts — the persisted-row ⇄ store-kind mapping SSOT (M2) ───
//
//  The DB `config.data_source` row speaks the WIRE vocabulary
//  (`type: 'sdmx-json' | 'rest' | 'static'`, the CHECK constraint). The engine
//  store-builder registry speaks the STORE-KIND vocabulary
//  (`kind: 'static' | 'stats' | …`, the source-mode discriminant). These are two
//  different alphabets and the translation between them is a CONTRACT shared by:
//    • the geostat runner boot (fetch-store-manifest: row → descriptor → store),
//    • the panel Constructor source-authoring UI (form → descriptor → test/browse
//      + the `{type,config}` it persists via the CRUD route).
//  One SSOT for that translation, BELOW both apps (Law 3) — neither app forks it.
//
//  OCP: SOURCE_KIND_BY_TYPE is the single table. A new wire `type` → store `kind`
//  is one row here; both the runner and the Constructor pick it up with no edit.
//
//  Law 2 (declarative): the descriptor is pure JSON (id/kind/url/params) — no
//  functions. `static` carries inline `params.values`; `stats` carries
//  `params.datasetCode`/`nonTimeDims` + the live `url`.

import type { DatasourceInstanceConfig } from '@statdash/engine'

/** The wire `type` values — mirrors the data_source_type_chk CHECK constraint. */
export type SourceWireType = 'sdmx-json' | 'rest' | 'static'

/**
 * Wire `type` → store `kind`. The live stats cube is persisted as `type='rest'`
 * (a REST endpoint) and builds the registered 'stats' kind; inline literal data
 * is persisted as `type='static'` and builds the 'static' kind. An author-supplied
 * remote url is persisted as `type='sdmx-json'` and builds the 'href' kind — the
 * fetch-a-remote-document mode (D-HREF). All three have live builders (open for
 * extension: a new wire type → kind is one row here).
 *
 * Naming note: the `sdmx-json` wire type predates the spectrum (it was the
 * documented external-SDMX-endpoint mode); it now carries the GENERIC 'href' kind
 * (any remote url + a `format` parser — json/csv/…, not only SDMX-JSON). The wire
 * label is retained to avoid a CHECK-constraint migration; the kind is generic.
 */
export const SOURCE_KIND_BY_TYPE: Record<SourceWireType, string | null> = {
  rest:         'stats',
  static:       'static',
  'sdmx-json':  'href',
}

/** The store kind a wire `type` builds, or null when no builder exists yet. */
export function kindForType(type: string): string | null {
  return SOURCE_KIND_BY_TYPE[type as SourceWireType] ?? null
}

/**
 * The wire `type` to PERSIST a given store `kind` as — the inverse the
 * Constructor uses when SAVING an authored source (the author picks a kind from
 * the registered kinds; the CRUD route stores a wire `type`). Derived from the
 * one SOURCE_KIND_BY_TYPE table, so the two directions can never drift. Returns
 * undefined for a kind with no wire `type` (not author-persistable yet).
 */
export function typeForKind(kind: string): SourceWireType | undefined {
  const entry = (Object.entries(SOURCE_KIND_BY_TYPE) as [SourceWireType, string | null][])
    .find(([, k]) => k === kind)
  return entry?.[0]
}

/**
 * Map one persisted source (its identity + wire fields) to the JSON datasource
 * descriptor the registered builder/capabilities understand. Returns `undefined`
 * when the type has no live kind (skip it — don't fail the manifest).
 *
 * `id` is the storeKey page nodes reference. `config` is the row's JSONB
 * (`datasetCode`/`nonTimeDims` for stats; `values`/`classifiers`/`display` for
 * static), forwarded VERBATIM as `params` (Postel's Law — liberal in, the
 * builder reads what it needs). The `url` is carried for network kinds; for
 * `static` it is irrelevant (the builder never reads it).
 */
export function toSourceDescriptor(
  source: { name: string; type: string; url?: string | null; config?: Record<string, unknown> },
  fallbackBaseUrl?: string,
): DatasourceInstanceConfig | undefined {
  const kind = kindForType(source.type)
  if (kind === null) return undefined
  return {
    id:     source.name,
    kind,
    url:    source.url ?? fallbackBaseUrl ?? undefined,
    params: source.config ?? {},
  }
}
