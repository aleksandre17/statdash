// ── Stats datasource plugin builder ──────────────────────────────────────────
//
//  Registers the 'stats' kind with the engine's store-builder registry.
//  Call registerStoreBuilders() once at app boot (setupRegistrations.ts).
//
//  Descriptor shape expected by the builder:
//    { id: 'gdp', kind: 'stats', url: string, params: { datasetCode: string, nonTimeDims: string[] } }
//
//  Hexagonal: dynamic imports keep stats-api + ExternalStore out of the static/api bundles.
//

import { registerStoreBuilder } from '@geostat/react/engine'

export function registerStoreBuilders(): void {
  registerStoreBuilder('stats', async (config) => {
    const base        = config.url ?? (import.meta.env.VITE_API_STATS_URL ?? 'http://localhost:3001')
    const datasetCode = (config.params?.datasetCode as string) ?? config.id
    const nonTimeDims = (config.params?.nonTimeDims as string[]) ?? []

    const [{ fetchDatasetObs, fetchDimClassifiers }, { ExternalStore }] = await Promise.all([
      import('./stats-api'),
      import('@geostat/engine'),
    ])

    const [observations, ...classifierArrays] = await Promise.all([
      fetchDatasetObs(base, datasetCode),
      ...nonTimeDims.map((dim) => fetchDimClassifiers(base, dim)),
    ])

    const classifiers = Object.fromEntries(
      nonTimeDims.map((dim, i) => [dim, classifierArrays[i]]),
    )

    return new ExternalStore(observations, { classifiers })
  })
}
