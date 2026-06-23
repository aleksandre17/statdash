// ── SDMX-JSON serializer [N16] ────────────────────────────────────────
//
//  Produces simplified SDMX-JSON 1.0 (generic dataset).
//  Fields map to observation-level dimensions/attributes.
//  Compatible with OECD / Eurostat SDMX-JSON consumers.
//
//  Reference: https://github.com/sdmx-twg/sdmx-json
//

import type { EngineRow } from '../../encoding'
import type { ExportMeta } from '../types'

export function serializeSdmxJson(rows: EngineRow[], meta: ExportMeta): string {
  const fields = meta.fields ?? (rows.length > 0 ? Object.keys(rows[0]) : [])
  const labels = meta.labels ?? {}

  const dimensions = fields.map((f, i) => ({
    id:          f,
    name:        labels[f] ?? f,
    keyPosition: i,
    values:      [...new Set(rows.map(r => String(r[f] ?? '')))].map(v => ({ id: v, name: v })),
  }))

  // Encode each row as a key-string → [value] observation map
  // Key = colon-joined dimension index positions
  const observations: Record<string, (string | number | null)[]> = {}
  for (const row of rows) {
    const key = fields.map(f => {
      const dimDef = dimensions.find(d => d.id === f)
      return dimDef ? dimDef.values.findIndex(v => v.id === String(row[f] ?? '')) : 0
    }).join(':')
    const value = typeof row['value'] === 'number' ? row['value'] : null
    observations[key] = [value]
  }

  const dataset = {
    header: {
      id:       meta.title ?? 'EXPORT',
      test:     false,
      prepared: new Date().toISOString(),
      sender:   { id: 'STATDASH', name: 'StatDash Export' },
    },
    structure: {
      dimensions: { observation: dimensions },
      attributes: { observation: [] },
    },
    dataSets: [
      {
        action:       'Information',
        observations,
      },
    ],
  }

  return JSON.stringify(dataset, null, 2)
}
