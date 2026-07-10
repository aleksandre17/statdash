// ── FilterBarControlsBridge — configure a filter-bar node's controls IN PLACE ──
//  (AR-49 D7.3 — the filter-bar control DRILL BRIDGE)
//
//  THE GAP IT CLOSES. A filter-bar NODE is a placeholder: its only prop is
//  `barIds` (which named bars to render; absent ⇒ all). The CONTROLS themselves
//  (the selects/ranges the owner wants to "configure a specific one" of) live in a
//  SEPARATE page tier — `page.meta.filterSchema.bars[barId].filters` — authored by
//  the Page-context <FiltersDrawer>. Before D7.3 nothing bridged "I selected this
//  bar" → "here are its controls": selecting the node showed only a raw `barIds`
//  array. This bridge is that missing reach.
//
//  THE BRIDGE (a REACH, not a new capability — no stored shape changes). When a
//  filter-bar node is selected, this resolves the node's `barIds` against the page
//  filterSchema (absent ⇒ every bar) and surfaces those bars' controls RIGHT HERE,
//  in the Element context:
//    • each control is a collapsed SUMMARY ROW (the D7.1b drill canon — only the
//      ACTIVE one's everything shows), with reorder + remove;
//    • clicking a row DRILLS IN to that specific control's editor (the existing
//      <ParamDefEditor> / filterParamSchemaSource — the SAME generic Inspector),
//      with a breadcrumb (Filter Bar › [control]) back to the list; focus moves
//      into the drilled control (WCAG: the drill is a context change);
//    • add / remove / reorder from the node context too.
//
//  WRITE-THROUGH TO THE SSOT (no denormalization). Every edit goes through
//  `useFilterBarAuthoring().commitBar` — the IDENTICAL reducer path the Page drawer
//  uses. The node's `barIds` is never written here; controls are never copied onto
//  the node. The one source of truth stays page.meta.filterSchema.bars[…].filters.
//
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Box, Typography, Paper, IconButton, Stack, Tooltip, Divider, Breadcrumbs, Link,
} from '@mui/material'
import DeleteIcon        from '@mui/icons-material/Delete'
import ArrowUpwardIcon   from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ChevronRightIcon  from '@mui/icons-material/ChevronRight'
import FilterAltIcon     from '@mui/icons-material/FilterAlt'
import type { ParamDefType } from '@statdash/engine'
import type { CanvasNode, Locale } from '../../types/constructor'
import { ParamDefEditor } from './ParamDefEditor'
import { moveItem } from './filterSchemaModel'
import { makeParamNode } from './paramFactory'
import { useFilterBarAuthoring } from './useFilterBarAuthoring'
import { AddControl } from './AddControl'

const T = {
  filters:  { en: 'Filter Bar',                     ka: 'ფილტრების პანელი' },
  controls: { en: 'Controls',                       ka: 'კონტროლები' },
  noBars:   { en: 'This bar references no filter bars in the page yet. Add a bar in the Page › Filters tab.',
              ka: 'ამ პანელს ჯერ არცერთი ფილტრის ზოლი არ აქვს მიბმული. ზოლი დაამატე გვერდის › ფილტრების ჩანართში.' },
  noCtrls:  { en: 'No controls yet.',               ka: 'კონტროლები ჯერ არ არის.' },
  configure:{ en: 'Configure',                       ka: 'კონფიგურაცია' },
  up:       { en: 'Move up',                          ka: 'ზემოთ' },
  down:     { en: 'Move down',                        ka: 'ქვემოთ' },
  remove:   { en: 'Remove control',                   ka: 'კონტროლის წაშლა' },
  back:     { en: 'Back to controls',                 ka: 'კონტროლებთან დაბრუნება' },
} as const
const t = (k: keyof typeof T, locale: Locale) => T[k][locale] ?? T[k].en

/** The drilled control coordinate — a (barId, key) address into the filterSchema. */
interface Drill { barId: string; key: string }

export interface FilterBarControlsBridgeProps {
  /** The selected filter-bar node (read-only — its `barIds` resolves the bars). */
  node:    CanvasNode
  locale?: Locale
}

export function FilterBarControlsBridge({ node, locale = 'en' }: FilterBarControlsBridgeProps) {
  const { page, barViews, commitBar } = useFilterBarAuthoring()

  // Resolve the node's `barIds` against the page filterSchema — the bridge. Absent
  // ⇒ every bar (mirrors the renderer's DefaultFilterBarShell semantics exactly).
  const barIds = node.props.barIds as string[] | undefined
  const bars = useMemo(
    () => (barIds ? barViews.filter((b) => barIds.includes(b.id)) : barViews),
    [barViews, barIds],
  )

  // Drill target (component-local UI state — like the canvas selection, never
  // config). null ⇒ the controls list; set ⇒ that specific control's editor.
  const [drill, setDrill] = useState<Drill | null>(null)

  // Resolve the drilled control against the LIVE bars; if it vanished (undo/redo,
  // external edit, remove) fall back to the list — never an editor over a ghost.
  // Pure-render derivation (no setState-in-effect), the D7.1b clamp discipline.
  const active = useMemo(() => {
    if (!drill) return null
    const bar = bars.find((b) => b.id === drill.barId)
    const idx = bar ? bar.params.findIndex((p) => p.key === drill.key) : -1
    return bar && idx >= 0 ? { bar, idx, param: bar.params[idx] } : null
  }, [drill, bars])

  // Focus moves INTO the drilled control (WCAG 2.1 — the drill is a context change).
  const editorRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (active && editorRef.current) {
      editorRef.current
        .querySelector<HTMLElement>('input, select, textarea, button, [tabindex]:not([tabindex="-1"])')
        ?.focus()
    }
  }, [active?.bar.id, active?.param.key]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!page) return null

  // ── Drilled: ONE control's editor + a breadcrumb back (only the active one) ───
  if (active) {
    const { bar, idx, param } = active
    const showBar = bars.length > 1
    return (
      <Box data-testid="filter-bar-node-controls" sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Breadcrumbs aria-label={t('back', locale)} separator={<ChevronRightIcon fontSize="small" />}>
          <Link
            component="button"
            type="button"
            underline="hover"
            color="inherit"
            onClick={() => setDrill(null)}
          >
            {t('filters', locale)}
          </Link>
          {showBar && <Typography color="text.secondary">{bar.id}</Typography>}
          <Typography color="text.primary" aria-current="page">
            {param.type} · {param.key}
          </Typography>
        </Breadcrumbs>
        <Divider />
        <Box ref={editorRef} data-testid={`param-${param.key}`}>
          <ParamDefEditor
            param={param}
            onChange={(next) => commitBar(bar.id, bar.params.map((p, j) => (j === idx ? next : p)))}
          />
        </Box>
      </Box>
    )
  }

  // ── List: the node's bars, each control a collapsed drill row ─────────────────
  return (
    <Box data-testid="filter-bar-node-controls" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <FilterAltIcon fontSize="small" />
        <Typography variant="overline" color="text.secondary">{t('controls', locale)}</Typography>
      </Stack>

      {bars.length === 0 ? (
        <Typography variant="body2" color="text.secondary">{t('noBars', locale)}</Typography>
      ) : (
        bars.map(({ id: barId, params }) => (
          <Paper key={barId} variant="outlined" sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}
                 data-testid={`filter-bar-${barId}`}>
            {bars.length > 1 && <Typography variant="subtitle2">{barId}</Typography>}

            {params.length === 0 ? (
              <Typography variant="body2" color="text.secondary">{t('noCtrls', locale)}</Typography>
            ) : (
              params.map((param, i) => (
                <Stack key={param.key} direction="row" spacing={0.5} alignItems="center"
                       data-testid={`param-row-${param.key}`}>
                  {/* The drill affordance — click to configure THIS specific control. */}
                  <Box
                    component="button"
                    type="button"
                    onClick={() => setDrill({ barId, key: param.key })}
                    aria-label={`${t('configure', locale)} ${param.key}`}
                    sx={{
                      flex: 1, display: 'flex', alignItems: 'center', gap: 1, minWidth: 0,
                      textAlign: 'left', bgcolor: 'transparent', border: 0, cursor: 'pointer',
                      px: 1, py: 0.75, borderRadius: 1, color: 'inherit', font: 'inherit',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <Typography variant="caption" noWrap sx={{ flex: 1 }}>
                      <strong>{param.type}</strong> · {param.key}
                    </Typography>
                    <ChevronRightIcon fontSize="small" aria-hidden />
                  </Box>
                  <Tooltip title={t('up', locale)}>
                    <span>
                      <IconButton size="small" aria-label={`${t('up', locale)}: ${param.key}`} disabled={i === 0}
                        onClick={() => commitBar(barId, moveItem(params, i, i - 1))}>
                        <ArrowUpwardIcon fontSize="inherit" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title={t('down', locale)}>
                    <span>
                      <IconButton size="small" aria-label={`${t('down', locale)}: ${param.key}`} disabled={i === params.length - 1}
                        onClick={() => commitBar(barId, moveItem(params, i, i + 1))}>
                        <ArrowDownwardIcon fontSize="inherit" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title={t('remove', locale)}>
                    <IconButton size="small" color="error" aria-label={`${t('remove', locale)}: ${param.key}`}
                      onClick={() => commitBar(barId, params.filter((_, j) => j !== i))}>
                      <DeleteIcon fontSize="inherit" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              ))
            )}

            <Divider sx={{ my: 0.5 }} />
            <AddControl onAdd={(type: ParamDefType) => {
              const seeded = makeParamNode(type)
              commitBar(barId, [...params, seeded])
              setDrill({ barId, key: seeded.key }) // create → drill straight in
            }} />
          </Paper>
        ))
      )}
    </Box>
  )
}
