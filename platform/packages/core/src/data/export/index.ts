// ── export/ barrel [N16] ───────────────────────────────────────────────
//
//  Side-effect: registers built-in export formats (csv, sdmx-json).
//  Plugin / app layer may register additional formats (xlsx, png, svg).
//
//  Usage:
//    import { registerExport, listExportFormats, getExportFormat } from '@statdash/engine'
//    registerExport('xlsx', { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: 'xlsx', label: 'Excel', serialize: myXlsxFn })
//

import { registerExport }    from './registry'
import { serializeCsv }      from './formats/csv'
import { serializeSdmxJson } from './formats/sdmx-json'

registerExport('csv', {
  mime:      'text/csv',
  ext:       'csv',
  label:     'CSV',
  serialize: serializeCsv,
})

registerExport('sdmx-json', {
  mime:      'application/json',
  ext:       'json',
  label:     'SDMX-JSON',
  serialize: serializeSdmxJson,
})

// ── Public exports ─────────────────────────────────────────────────────
export type { ExportMeta, SerializeFn, ExportFormat } from './types'
export { registerExport, getExportFormat, listExportFormats } from './registry'
