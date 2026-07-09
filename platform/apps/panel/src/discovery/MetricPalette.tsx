// ── MetricPalette — browsable governed metric catalog + bind affordance (M0) ──
//
//  AR-49 M0 item 9 — the author's PRIMARY data affordance: a browsable, searchable
//  view of the GOVERNED metric catalog (the semantic layer's define-vs-curate
//  promise), sitting BESIDE the untouched 3-step wizard. It reuses the panel's
//  existing discovery infra with no new mechanism:
//    • catalog     → useMetricCatalog()  (the semantic-layer peer of useActiveProfile)
//    • labels/units→ metricOptions/readCatalogLabel pure resolvers (spec §2.2)
//    • bind write  → metricBinding (schema-driven, byte-identical — spec §3)
//    • drag        → native HTML5 dataTransfer (metricDrag), the SAME mechanism
//                     NodePalette uses; drops onto a canvas node frame
//
//  Two gestures, ONE write (spec §4.3): (1) DRAG a metric tile onto a block on the
//  canvas, (2) SELECT a block + CLICK/ENTER a metric (the a11y/keyboard path). Both
//  converge on the host's onBind → metricBinding write. No block gains a special
//  "bound" state; the metric-id in its measure field IS the binding.
//
//  Accessibility (WCAG 2.1 AA, Law 9): a labelled region; a labelled search box;
//  metrics grouped in <section>s with headings and a <ul>/<li> list; each tile a
//  real <button> (keyboard operable, drag is an enhancement, never the only path);
//  a polite live region announces bind results and the current target hint; the
//  empty/loading/error states are informative text, never a crash.
//
import { useMemo, useState, useId } from 'react'
import {
  Box, Paper, TextField, Typography, InputAdornment,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import DatasetLinkedIcon from '@mui/icons-material/DatasetLinked'
import type { MetricDef } from '@statdash/engine'
import type { Locale } from '../types/constructor'
import { useMetricCatalog } from './useMetricCatalog'
import { readCatalogLabel } from './semanticCatalogOptions'
import { writeMetricDrag } from './metricDrag'

export interface MetricPaletteProps {
  /**
   * Bind the chosen metric to the host's current target block (the host resolves
   * WHICH block — typically the selected node — and performs the byte-identical
   * write via metricBinding). Absent ⇒ click-bind is inert (drag still works).
   */
  onBind?: (metricId: string) => void
  /**
   * Whether a click will bind right now (a bindable block is selected). Drives the
   * tile affordance + the announced feedback. Drag is always available regardless.
   */
  canBind?: boolean
  /**
   * Human hint about the current bind target, announced politely when a click
   * cannot bind (e.g. "აირჩიეთ მონაცემთა ბლოკი მეტრიკის მისაბმელად"). Optional.
   */
  bindHint?: string
  /** Active locale for governed labels/units. Defaults to 'ka' (panel primary). */
  locale?: Locale
}

/** A metric ready to render: its id, resolved label + unit, and grouping key. */
interface MetricTile {
  id:        string
  label:     string
  unit:      string
  /** The datasource group this metric belongs to (or the ungrouped bucket). */
  group:     string
  /** Lowercased haystack for search (label + unit + id). */
  haystack:  string
}

const UNGROUPED = '—'

/** Resolve the catalog map to grouped, search-filtered tiles (pure, memoised). */
function buildTiles(
  metrics: Record<string, MetricDef>,
  locale: Locale,
  query: string,
): { group: string; tiles: MetricTile[] }[] {
  const q = query.trim().toLowerCase()
  const all: MetricTile[] = Object.entries(metrics)
    .map(([id, def]) => {
      const label = readCatalogLabel(def.label, locale, id)
      const unit  = def.unit ? readCatalogLabel(def.unit, locale, '') : ''
      return {
        id,
        label,
        unit,
        group:    def.dataSource ?? UNGROUPED,
        haystack: `${label} ${unit} ${id}`.toLowerCase(),
      }
    })
    .filter((t) => (q ? t.haystack.includes(q) : true))
    .sort((a, b) => a.id.localeCompare(b.id))

  const byGroup = new Map<string, MetricTile[]>()
  for (const t of all) {
    const bucket = byGroup.get(t.group) ?? []
    bucket.push(t)
    byGroup.set(t.group, bucket)
  }
  return [...byGroup.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, tiles]) => ({ group, tiles }))
}

export function MetricPalette({ onBind, canBind = false, bindHint, locale = 'ka' }: MetricPaletteProps) {
  const catalog = useMetricCatalog()
  const [query, setQuery] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const searchId = useId()

  const groups = useMemo(
    () => (catalog.status === 'ready' ? buildTiles(catalog.metrics, locale, query) : []),
    [catalog, locale, query],
  )

  const total = catalog.status === 'ready' ? Object.keys(catalog.metrics).length : 0

  const bind = (tile: MetricTile) => {
    if (canBind && onBind) {
      onBind(tile.id)
      setAnnouncement(`მეტრიკა მიბმულია: ${tile.label}`)
    } else {
      setAnnouncement(bindHint ?? 'აირჩიეთ ბლოკი მეტრიკის მისაბმელად')
    }
  }

  // ── Non-ready states — informative, never a crash (graceful degradation) ──
  const statusHint =
    catalog.status === 'idle'  ? 'კატალოგი იტვირთება…'
    : catalog.status === 'error' ? `კატალოგი მიუწვდომელია: ${catalog.message}`
    : total === 0 ? 'მეტრიკები არ არის რეგისტრირებული'
    : null

  return (
    <Box
      component="section"
      aria-label="მეტრიკების პალიტრა"
      data-testid="metric-palette"
      sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <DatasetLinkedIcon color="primary" fontSize="small" />
        <Typography variant="overline" color="text.secondary">მეტრიკები</Typography>
      </Box>

      {/* Search — labelled for AT; filters governed labels, units and ids. */}
      <TextField
        id={searchId}
        size="small"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="ძებნა…"
        label="მეტრიკის ძებნა"
        disabled={catalog.status !== 'ready' || total === 0}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
          ),
        }}
      />

      {/* Polite live region — announces bind results + target hints (a11y). */}
      <Box aria-live="polite" role="status" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
        {announcement}
      </Box>

      {statusHint && (
        <Typography variant="caption" color="text.secondary" data-testid="metric-palette-status">
          {statusHint}
        </Typography>
      )}

      {catalog.status === 'ready' && total > 0 && groups.length === 0 && (
        <Typography variant="caption" color="text.secondary">
          ვერ მოიძებნა: „{query}“
        </Typography>
      )}

      {groups.map(({ group, tiles }) => {
        const headingId = `${searchId}-grp-${group}`
        return (
          <Box component="section" key={group} aria-labelledby={headingId} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography id={headingId} variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              {group === UNGROUPED ? 'სხვა' : group}
            </Typography>
            <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {tiles.map((tile) => (
                <li key={tile.id}>
                  <Paper
                    component="button"
                    type="button"
                    variant="outlined"
                    draggable
                    data-testid={`metric-tile-${tile.id}`}
                    data-metric-id={tile.id}
                    onClick={() => bind(tile)}
                    onDragStart={(e: React.DragEvent) => writeMetricDrag(e.dataTransfer, tile.id)}
                    aria-label={
                      `მეტრიკა: ${tile.label}${tile.unit ? ` · ${tile.unit}` : ''}` +
                      (canBind ? ' — დააჭირეთ მისაბმელად' : '')
                    }
                    sx={{
                      textAlign: 'start', width: '100%', cursor: 'grab',
                      p: 0.75, display: 'flex', flexDirection: 'column', gap: 0.25,
                      bgcolor: 'background.paper', font: 'inherit',
                      '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                      '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
                    }}
                  >
                    <Typography variant="body2" fontWeight={600} noWrap>{tile.label}</Typography>
                    {tile.unit && (
                      <Typography variant="caption" color="text.secondary" noWrap>{tile.unit}</Typography>
                    )}
                  </Paper>
                </li>
              ))}
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}
