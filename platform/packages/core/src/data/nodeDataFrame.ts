// Typed result frame — rows + schema.
// Grafana analogue: DataFrame.
// Placed in engine/core so all render targets (api, html, pdf) share one type.

import type { FieldSchema } from './fieldSchema'
import type { EngineRow }   from './encoding'

export interface NodeDataFrame {
  schema:      { fields: FieldSchema[] }
  rows:        EngineRow[]
  /** Total row count before any rowLimit was applied (P2-1 pagination). */
  totalRows?:  number
  /** True when rows were truncated by rowLimit and more data exists. */
  truncated?:  boolean
}
