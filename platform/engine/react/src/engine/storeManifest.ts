// ── storeManifest.ts ──────────────────────────────────────────────────────────
//
//  Phase-2 factory: JSON datasource descriptors → live DataStore map.
//
//  Pattern: Grafana datasource provisioning (type → plugin → handler).
//           Consistent with modeRegistry / formatterRegistry / EngineRegistry.
//
//  Phase 1 (now):   No kinds registered; app still builds stores imperatively.
//                   `buildStoreManifest([])` returns `{}` safely.
//  Phase 2 (later): App registers 'external' | 'api' | 'stats' builders at boot.
//                   `bootstrapSite()` calls `buildStoreManifest(manifest.datasources)`.
//

import type { DatasourceInstanceConfig, DataStore } from '@geostat/engine'

/**
 * Factory that builds a DataStore for one datasource descriptor.
 * The optional `signal` is forwarded from the caller — builders may use it
 * to abort in-flight network requests when the consumer cancels bootstrap.
 */
export type StoreBuilderFn = (config: DatasourceInstanceConfig, signal?: AbortSignal) => Promise<DataStore>

const _registry = new Map<string, StoreBuilderFn>()

/**
 * Register a factory for a datasource kind.
 * Call once at app boot (e.g. in setupRegistrations.ts).
 *
 * @param kind  The DatasourceInstanceConfig.kind this factory handles.
 * @param fn    Async factory — receives the full descriptor, returns a DataStore.
 *
 * @example
 *   registerStoreBuilder('external', async ({ id, params }) => new ExternalStore(...))
 */
export function registerStoreBuilder(kind: string, fn: StoreBuilderFn): void {
  _registry.set(kind, fn)
}

/**
 * Build a live store map from JSON datasource descriptors.
 *
 * Phase 2 entry point. Called after the site manifest is fetched:
 *   const stores = await buildStoreManifest(manifest.datasources)
 *
 * Throws on unknown kinds (fail-fast — misconfiguration is always a bug).
 */
export async function buildStoreManifest(
  datasources: DatasourceInstanceConfig[],
  signal?:     AbortSignal,
): Promise<Record<string, DataStore>> {
  if (datasources.length === 0) return {}
  const entries = await Promise.all(
    datasources.map(async (ds) => {
      const builder = _registry.get(ds.kind)
      if (!builder) {
        throw new Error(
          `[buildStoreManifest] No StoreBuilder registered for kind '${ds.kind}' (id='${ds.id}'). ` +
          `Register one via registerStoreBuilder('${ds.kind}', fn) at app boot.`,
        )
      }
      return [ds.id, await builder(ds, signal)] as const
    }),
  )
  return Object.fromEntries(entries)
}
