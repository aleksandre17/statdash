// ════════════════════════════════════════════════════════════════════════
// seed-data-sources.ts — config.data_source rows for the geostat client (P3-4)
// ════════════════════════════════════════════════════════════════════════
// One concern, separate from the stats.* cube ETL: the config.data_source rows
// the geostat client reads at boot to build its store manifest. One row per
// dataset; status='connected' so the public GET /api/data-sources surfaces them.
//
// IDEMPOTENCY: config.data_source has NO UNIQUE on `name` (V3), so the upsert
// emulates the conflict key with SELECT … FOR UPDATE inside the transaction —
// the same race-free pattern as provisioning/upsert.ts:upsertDataSource. The
// row lock serializes concurrent seed/boot runs; re-running converges.
//
// config JSONB = exactly what the geostat 'stats' store-builder reads
// (stats-registrations.ts): datasetCode + nonTimeDims. classifierDims is carried
// for the Constructor's future use; the store-builder derives classifiers from
// nonTimeDims today.
// ════════════════════════════════════════════════════════════════════════

import { type PoolClient } from 'pg'

interface DataSourceSeed {
  name:   string
  type:   string
  url:    string | null
  config: Record<string, unknown>
}

const STATS_API_URL = process.env.API_BASE_URL ?? 'http://localhost:3001'

const DATA_SOURCES: DataSourceSeed[] = [
  {
    name: 'gdp', type: 'rest', url: STATS_API_URL,
    config: { datasetCode: 'GDP_ANNUAL', nonTimeDims: ['measure', 'geo'], classifierDims: ['measure', 'geo'] },
  },
  {
    name: 'accounts', type: 'rest', url: STATS_API_URL,
    config: { datasetCode: 'ACCOUNTS_SEQUENCE', nonTimeDims: ['measure', 'account', 'side'], classifierDims: ['measure', 'account', 'side'] },
  },
  {
    name: 'regional', type: 'rest', url: STATS_API_URL,
    config: { datasetCode: 'REGIONAL_GVA', nonTimeDims: ['measure', 'geo', 'sector'], classifierDims: ['measure', 'geo', 'sector'] },
  },
]

export async function seedDataSources(c: PoolClient): Promise<void> {
  console.log('[seed] config.data_source …')
  for (const src of DATA_SOURCES) {
    // SELECT … FOR UPDATE: emulate the missing UNIQUE(name) conflict key without
    // a check-then-write race (V3 has no constraint to ON CONFLICT against).
    const { rows: existing } = await c.query<{ id: string }>(
      `SELECT id FROM config.data_source WHERE name = $1 FOR UPDATE`,
      [src.name],
    )
    if (existing[0]) {
      await c.query(
        `UPDATE config.data_source
            SET type = $2, url = $3, config = $4, status = 'connected'
          WHERE id = $1`,
        [existing[0].id, src.type, src.url, JSON.stringify(src.config)],
      )
    } else {
      await c.query(
        `INSERT INTO config.data_source (name, type, url, config, status)
         VALUES ($1, $2, $3, $4, 'connected')`,
        [src.name, src.type, src.url, JSON.stringify(src.config)],
      )
    }
  }
}
