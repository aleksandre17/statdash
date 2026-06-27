// ── storeManifest.ts ──────────────────────────────────────────────────────────
//
//  Phase-2 factory: JSON datasource descriptors → live DataStore map.
//
//  Pattern: Grafana datasource provisioning (type → plugin → handler).
//           Consistent with perspectiveRegistry / formatterRegistry / EngineRegistry.
//
//  Phase 1 (now):   No kinds registered; app still builds stores imperatively.
//                   `buildStoreManifest([])` returns `{}` safely.
//  Phase 2 (later): App registers 'external' | 'api' | 'stats' builders at boot.
//                   `bootstrapSite()` calls `buildStoreManifest(manifest.datasources)`.
//

import type {
  DatasourceInstanceConfig, DataStore, SourceMetadata, SourceTestResult,
} from '@statdash/engine'

/**
 * Factory that builds a DataStore for one datasource descriptor.
 * The optional `signal` is forwarded from the caller — builders may use it
 * to abort in-flight network requests when the consumer cancels bootstrap.
 */
export type StoreBuilderFn = (config: DatasourceInstanceConfig, signal?: AbortSignal) => Promise<DataStore>

/**
 * Optional authoring capabilities a datasource kind may register alongside its
 * builder (M2 — the Constructor source-authoring seam). The BUILD path
 * (`StoreBuilderFn`) is what bootstrap needs; these two are what the *visual
 * builder* needs to let a non-programmer add/test/browse a source BEFORE it is
 * saved + booted:
 *
 *   • `getMetadata`   — introspect the source's STRUCTURE (dims/measures) so the
 *                       Constructor can BROWSE what it offers. The source-tier
 *                       analogue of the cube-profile, normalized across kinds.
 *   • `testConnection` — VALIDATE the source (the dataset resolves / the api is
 *                       reachable / the inline values are well-formed) and report
 *                       ok/error to the author.
 *
 * Both are OPTIONAL: a kind with neither is still buildable (just not
 * browsable/testable in the Constructor) — graceful degradation, not a hard
 * requirement. A new kind that implements them lights up the authoring UI with
 * ZERO UI edit (OCP — the panel asks `getStoreCapabilities(kind)`).
 */
export interface StoreCapabilities {
  getMetadata?:    (config: DatasourceInstanceConfig, signal?: AbortSignal) => Promise<SourceMetadata>
  testConnection?: (config: DatasourceInstanceConfig, signal?: AbortSignal) => Promise<SourceTestResult>
}

const _registry     = new Map<string, StoreBuilderFn>()
const _capabilities = new Map<string, StoreCapabilities>()

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
 * Register the optional authoring capabilities (getMetadata / testConnection) for
 * a datasource kind (M2). Call once at app boot, alongside registerStoreBuilder.
 * Additive + idempotent — a kind that never calls this simply has no authoring
 * capabilities, and `getStoreCapabilities(kind)` returns an empty bundle.
 *
 * @example
 *   registerStoreCapabilities('static', {
 *     getMetadata:    async (cfg) => deriveStructureFromValues(cfg.params?.values),
 *     testConnection: async (cfg) => ({ ok: hasWellFormedValues(cfg) }),
 *   })
 */
export function registerStoreCapabilities(kind: string, caps: StoreCapabilities): void {
  _capabilities.set(kind, caps)
}

/**
 * The authoring capability bundle for a kind, or an empty bundle if the kind
 * registered none. Constructor entry point: the Sources panel reads this to
 * decide whether Test / Browse are available for the picked kind (OCP — the
 * panel never hardcodes which kinds are testable/browsable).
 */
export function getStoreCapabilities(kind: string): StoreCapabilities {
  return _capabilities.get(kind) ?? {}
}

/**
 * Introspect one source's structure (dims/measures) for browsing. Dispatches to
 * the kind's registered `getMetadata`. Throws fail-fast if the kind has no
 * builder at all (misconfiguration); returns `undefined` when the kind is real
 * but registered no `getMetadata` (browsing simply unavailable — degrade, don't
 * throw).
 */
export async function getSourceMetadata(
  config: DatasourceInstanceConfig,
  signal?: AbortSignal,
): Promise<SourceMetadata | undefined> {
  if (!_registry.has(config.kind)) {
    throw new Error(
      `[getSourceMetadata] No StoreBuilder registered for kind '${config.kind}'. ` +
      `Register one via registerStoreBuilder('${config.kind}', fn) at app boot.`,
    )
  }
  const caps = _capabilities.get(config.kind)
  return caps?.getMetadata ? caps.getMetadata(config, signal) : undefined
}

/**
 * Validate one source. Dispatches to the kind's registered `testConnection`.
 * Returns `undefined` when the kind registered no `testConnection` (testing
 * unavailable for this kind — the UI hides the Test action rather than failing).
 */
export async function testSource(
  config: DatasourceInstanceConfig,
  signal?: AbortSignal,
): Promise<SourceTestResult | undefined> {
  if (!_registry.has(config.kind)) {
    throw new Error(
      `[testSource] No StoreBuilder registered for kind '${config.kind}'. ` +
      `Register one via registerStoreBuilder('${config.kind}', fn) at app boot.`,
    )
  }
  const caps = _capabilities.get(config.kind)
  return caps?.testConnection ? caps.testConnection(config, signal) : undefined
}

/**
 * List every datasource kind that has a registered StoreBuilder.
 *
 * Constructor entry point: feeds the `datasourceKinds` axis of describeApp()
 * (the datasource-kind picker). Mirrors perspectiveRegistry.list() / listTransformOps()
 * — registries expose what they hold so the visual builder sees only what is
 * registered. Returns [] in a bare test/node env where no builders are booted.
 */
export function registeredKinds(): string[] {
  return [..._registry.keys()]
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
