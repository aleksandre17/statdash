// ── PipelineDataGrid — the WCAG live data table (SPEC §3.2 / §3.5) ─────────────
//
//  The PURE presentational grid: a real accessibility data table (Law 9) — a
//  <caption> naming the current step, <th scope="col"> governed headers, honest
//  cells ('—' for no-data, never a fabricated 0 — Law 11 / FF-CANVAS-NEVER-LIES),
//  and an honest capped-count note (SPEC §9 E3). It is store-free + hook-free — it
//  renders a resolved view-model, so its states are deterministically testable and
//  W-P2 can re-home it verbatim. Bilingual (ka/en).
//
//  Loading is a DISTINCT declared state from empty (async trap #10): a `loading`
//  read shows a labelled busy note (role=status), never the empty-table affordance.
//
import { Box, Typography } from '@mui/material'
import type { EngineRow } from '@statdash/engine'
import { toGridCell } from './pipelinePreview'
import type { ColumnLabelResolver } from './columnLabels'
import type { PreviewStatus } from './usePipelineSourceRows'

export interface PipelineDataGridProps {
  status:      PreviewStatus
  /** The already-capped rows (first N). */
  rows:        EngineRow[]
  /** The TRUE total (pre-cap) — the honest note's denominator. */
  total:       number
  capped:      boolean
  columns:     string[]
  columnLabel: ColumnLabelResolver
  /** The current step's name — the table <caption> (SPEC §3.5). */
  caption:     string
  locale:      string
}

export function PipelineDataGrid({
  status, rows, total, capped, columns, columnLabel, caption, locale,
}: PipelineDataGridProps) {
  const en = locale === 'en'

  // ── Declared non-OK states — each honest, none a silent blank ─────────────────
  if (status === 'unbound') {
    return (
      <StateNote testid="pipeline-grid-unbound">
        {en ? 'Pick a governed metric to see its data' : 'აირჩიეთ მართული მეტრიკა მონაცემების სანახავად'}
      </StateNote>
    )
  }
  if (status === 'loading') {
    return (
      <StateNote testid="pipeline-grid-loading" role="status" busy>
        {en ? 'Loading data…' : 'მონაცემები იტვირთება…'}
      </StateNote>
    )
  }
  if (status === 'error') {
    return (
      <StateNote testid="pipeline-grid-error" role="alert">
        {en ? 'Could not read the data' : 'მონაცემების წაკითხვა ვერ მოხერხდა'}
      </StateNote>
    )
  }
  if (status === 'unavailable') {
    return (
      <StateNote testid="pipeline-grid-unavailable" role="status">
        {en ? 'Live data unavailable — connect a cube to preview' : 'ცოცხალი მონაცემები მიუწვდომელია — მიაბით კუბი'}
      </StateNote>
    )
  }
  // status === 'ok' but no rows — an HONEST empty result (bound, no observations),
  // distinct from the loading state above.
  if (rows.length === 0) {
    return (
      <StateNote testid="pipeline-grid-empty">
        {en ? 'No rows at this step' : 'ამ ნაბიჯზე სტრიქონები არ არის'}
      </StateNote>
    )
  }

  const countNote = capped
    ? (en ? `Showing ${rows.length} of ${total} rows` : `ნაჩვენებია ${rows.length} / ${total} სტრიქონი`)
    : (en ? `${total} rows` : `${total} სტრიქონი`)

  return (
    <Box data-testid="pipeline-grid" sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Box sx={{ overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
        <Box
          component="table"
          sx={{
            borderCollapse: 'collapse', width: '100%', fontSize: 12,
            '& th, & td': { border: 1, borderColor: 'divider', px: 1, py: 0.5, textAlign: 'left', whiteSpace: 'nowrap' },
            '& thead th': { bgcolor: 'grey.100', fontWeight: 600, position: 'sticky', top: 0 },
          }}
        >
          <Box component="caption" sx={{ captionSide: 'top', textAlign: 'left', px: 1, py: 0.5, fontWeight: 600, fontSize: 12 }}>
            {caption}
          </Box>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c} scope="col">{columnLabel(c)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {columns.map((c) => {
                  const cell = toGridCell(row[c] as never, locale)
                  return (
                    <td key={c} data-cell-state={cell.state}>
                      {cell.state === 'no-data'
                        ? <span aria-label={en ? 'no data' : 'მონაცემი არ არის'}>{cell.text}</span>
                        : cell.text}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </Box>
      </Box>
      <Typography variant="caption" color="text.secondary" data-testid="pipeline-grid-count">
        {countNote}
      </Typography>
    </Box>
  )
}

// ── StateNote — a labelled declared-state affordance (icon-free text; Law 9) ────
function StateNote({
  children, testid, role, busy,
}: { children: React.ReactNode; testid: string; role?: string; busy?: boolean }) {
  return (
    <Box
      data-testid={testid}
      role={role}
      aria-busy={busy || undefined}
      sx={{
        p: 2, border: 1, borderColor: 'divider', borderRadius: 1,
        bgcolor: 'grey.50', color: 'text.secondary', fontSize: 12, textAlign: 'center',
      }}
    >
      {children}
    </Box>
  )
}
