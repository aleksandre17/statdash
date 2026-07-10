// ── FiltersDrawer — page-level FilterSchema authoring surface [V0] ─────────────
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
import { ParamDefEditor } from './ParamDefEditor'
import { moveItem } from './filterSchemaModel'
import { makeParamNode } from './paramFactory'
import { useFilterBarAuthoring } from './useFilterBarAuthoring'
import { AddControl } from './AddControl'

export function FiltersDrawer() {
  // The ONE filter-control write-through seam (SSOT) — shared with the D7.3
  // Element-context node bridge, so both surfaces edit page.meta.filterSchema
  // through the identical reducer path (no second copy, no fork).
  const { page, barViews, commitBar } = useFilterBarAuthoring()

  // Page-scoped: RightDock mounts this only when a page is active and owns the single
  // "no page" empty-state — self-suppress here (no duplicate literal, FF-ONE-EMPTYSTATE).
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
