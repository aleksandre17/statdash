// ── FiltersDrawer — page-level FilterSchema authoring surface [V0 · SL-5] ──────
//
//  The ADR's "Data/Filters drawer": authors the page's filter bars + their
//  controls (ParamDefs) — the single biggest Constructor coverage gap ("a
//  statistical dashboard IS its filters"). It surfaces the CORE need (build the
//  bars + controls) and reuses the EXISTING machinery end-to-end:
//
//    • each control is edited through the generic <Inspector> (via ParamDefEditor
//      + filterParamSchemaSource) — NO bespoke per-control form, NO 2nd engine;
//    • the dimension `key` and cube-bound defaults bind to the cube-profile
//      (EnumRefField) — the author PICKS, never types a raw code (Law 2);
//    • edits write the engine-canonical FilterSchemaInput straight into
//      page.meta.filterSchema, which the page round-trip already carries LOSSLESS
//      (canvasPageAdapter structural pass-through, P-3) — validateConfig unaffected.
//
//  ── The Placement Law gate (SL-5 — the first REAL page-scope escalation) ───────
//  The full authoring surface (every bar, every control's ParamDefEditor expanded)
//  is WORKSPACE-weight — the whole page FilterSchema is a §3.1 rich sub-document
//  (`filterPlacement`). Stacking it in the page dock beneath the page panes is the
//  reported cram. So the drawer no longer renders its body straight into the dock:
//  it derives its container from the Placement Law and, when the verdict is
//  `focus-view` AND an escalation host is present (the StudioShell dock), it renders
//  a COMPACT AFFORDANCE that escalates the full body OUT to a focus-view screen —
//  the same DIP port SL-4 built (`useFocusEscalation`), the SELF-BOUND variant (the
//  body re-sources its own live store state, so no host field binding is needed).
//  With no host (isolation, or already inside the focus-view) or a light/empty
//  pipeline, it renders the body inline exactly as before — fail-soft, zero regression.
//
//  YAGNI (this slice): the advanced top-level keys crossValidate /
//  context / computed are PRESERVED verbatim (setBarParams never touches them) but
//  not yet authored here — surfacing the bars + ParamDefs is the core "build the
//  filters" need. A later slice adds their builders behind the same Inspector seam.
//
import {
  Box, Typography, Paper, IconButton, Divider, Stack, Tooltip,
} from '@mui/material'
import DeleteIcon       from '@mui/icons-material/Delete'
import ArrowUpwardIcon  from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import FilterAltIcon    from '@mui/icons-material/FilterAlt'
import { SummaryCardView } from '../../inspector/controls/SummaryCard'
import { ParamDefEditor } from './ParamDefEditor'
import { moveItem, type BarView } from './filterSchemaModel'
import { makeParamNode } from './paramFactory'
import { useFilterBarAuthoring } from './useFilterBarAuthoring'
import { filtersPipelineContainer } from './filterPlacement'
import { AddControl } from './AddControl'
import { useFocusEscalation } from '../../inspector/focusEscalation'
import type { Locale } from '../../types/constructor'

const T = {
  filters:   { en: 'Filters',        ka: 'ფილტრები' },
  configure: { en: 'Configure',      ka: 'კონფიგურაცია' },
  bars:      { en: 'bars',           ka: 'ზოლი' },
  controls:  { en: 'controls',       ka: 'კონტროლი' },
} as const
const t = (k: keyof typeof T, locale: Locale) => T[k][locale] ?? T[k].en

export interface FiltersDrawerProps {
  /** UI locale for the affordance chrome (the body keeps its own ka labels). */
  locale?: Locale
}

/** Total control count across all bars — the affordance summary metric. */
function controlCount(bars: BarView[]): number {
  return bars.reduce((n, b) => n + b.params.length, 0)
}

// ── FiltersDrawer — the Placement Law gate (affordance vs inline body) ─────────
export function FiltersDrawer({ locale = 'ka' }: FiltersDrawerProps = {}) {
  const { page, barViews } = useFilterBarAuthoring()
  const escalation = useFocusEscalation()

  // Page-scoped: RightDock mounts this only when a page is active and owns the single
  // "no page" empty-state — self-suppress here (no duplicate literal, FF-ONE-EMPTYSTATE).
  if (!page) return null

  // The derived verdict — never a per-type literal. A populated pipeline is workspace
  // (§3.1 rich sub-document) → focus-view; an empty one stays a light in-dock stub.
  const escalate = escalation && filtersPipelineContainer(barViews) === 'focus-view'

  // In the dock with a workspace pipeline → a compact SUMMARY CARD that hands the full
  // body OUT to a focus-view (SELF-BOUND: the body re-sources its own live store state).
  // This is the SL-5 bespoke affordance RETIRED into the general summary-card grammar
  // (§3.1) — one visual card idiom for every glance projection in the studio.
  if (escalate) {
    return (
      <SummaryCardView
        glyph={<FilterAltIcon fontSize="small" />}
        primary={t('filters', locale)}
        secondary={`${barViews.length} ${t('bars', locale)} · ${controlCount(barViews)} ${t('controls', locale)}`}
        onOpen={() => escalation!.escalate({
          source: 'self-bound',
          title:  T.filters,
          render: () => <FiltersDrawerBody />,
        })}
        openLabel={`${t('configure', locale)} ${t('filters', locale)}`}
        testId="filters-affordance"
      />
    )
  }

  // Inline body — in the focus-view (no host), or a light/empty pipeline in the dock.
  return <FiltersDrawerBody />
}

// ── FiltersDrawerBody — the full authoring surface (bars → controls) ───────────
//
//  Self-bound: it reads/writes page.meta.filterSchema through `useFilterBarAuthoring`
//  directly, so it stays LIVE whether mounted inline in the dock OR in the escalated
//  focus-view screen (the store, not a captured closure, is the source of truth).
//
function FiltersDrawerBody() {
  // The ONE filter-control write-through seam (SSOT) — shared with the D7.3
  // Element-context node bridge, so both surfaces edit page.meta.filterSchema
  // through the identical reducer path (no second copy, no fork).
  const { page, barViews, commitBar } = useFilterBarAuthoring()

  if (!page) return null

  if (barViews.length === 0) {
    return (
      <Box sx={{ p: 2, color: 'text.secondary' }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <FilterAltIcon fontSize="small" />
          <Typography variant="overline">ფილტრები</Typography>
        </Stack>
        <Typography variant="body2">
          ამ გვერდს ფილტრების ზოლი არ აქვს. (ზოლის დამატება — შემდეგი სლაისი.)
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }} data-testid="filters-drawer">
      <Stack direction="row" spacing={1} alignItems="center">
        <FilterAltIcon fontSize="small" />
        <Typography variant="overline" color="text.secondary">ფილტრები</Typography>
      </Stack>

      {barViews.map(({ id: barId, params }) => (
        <Paper key={barId} variant="outlined" sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}
               data-testid={`filter-bar-${barId}`}>
          <Typography variant="subtitle2">{barId}</Typography>

          {params.map((param, i) => (
            <Paper key={param.key} variant="outlined" sx={{ p: 1.5 }}
                   data-testid={`param-${param.key}`}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="caption" sx={{ flex: 1 }}>
                  <strong>{param.type}</strong> · {param.key}
                </Typography>
                <Tooltip title="ზემოთ">
                  <span>
                    <IconButton size="small" aria-label="move up" disabled={i === 0}
                      onClick={() => commitBar(barId, moveItem(params, i, i - 1))}>
                      <ArrowUpwardIcon fontSize="inherit" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="ქვემოთ">
                  <span>
                    <IconButton size="small" aria-label="move down" disabled={i === params.length - 1}
                      onClick={() => commitBar(barId, moveItem(params, i, i + 1))}>
                      <ArrowDownwardIcon fontSize="inherit" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="წაშლა">
                  <IconButton size="small" color="error" aria-label="remove control"
                    onClick={() => commitBar(barId, params.filter((_, j) => j !== i))}>
                    <DeleteIcon fontSize="inherit" />
                  </IconButton>
                </Tooltip>
              </Stack>

              {/* Schema-driven control editor — the SAME generic Inspector. */}
              <ParamDefEditor
                param={param}
                onChange={(next) => commitBar(barId, params.map((p, j) => (j === i ? next : p)))}
              />
            </Paper>
          ))}

          <Divider />
          <AddControl onAdd={(type) => commitBar(barId, [...params, makeParamNode(type)])} />
        </Paper>
      ))}
    </Box>
  )
}
