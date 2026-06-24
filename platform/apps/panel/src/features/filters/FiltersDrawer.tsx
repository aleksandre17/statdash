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
//  YAGNI (this slice): the advanced top-level keys effects / crossValidate /
//  context / computed are PRESERVED verbatim (setBarParams never touches them) but
//  not yet authored here — surfacing the bars + ParamDefs is the core "build the
//  filters" need. A later slice adds their builders behind the same Inspector seam.
//
import {
  Box, Typography, Paper, IconButton, MenuItem, Select, Divider, Stack, Tooltip,
} from '@mui/material'
import AddIcon          from '@mui/icons-material/Add'
import DeleteIcon       from '@mui/icons-material/Delete'
import ArrowUpwardIcon  from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import FilterAltIcon    from '@mui/icons-material/FilterAlt'
import type { FilterSchemaInput, ParamNode, ParamDefType } from '@statdash/engine'
import { useConstructorStore, useActivePage } from '../../store/constructor.store'
import { ParamDefEditor } from './ParamDefEditor'
import { toBarViews, setBarParams } from './filterSchemaModel'
import { makeParamNode, PARAM_TYPE_OPTIONS } from './paramFactory'

// Move item at `from` to `to` in a fresh array (bounds-safe; no-op if out of range).
function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr
  const next = [...arr]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export function FiltersDrawer() {
  const page          = useActivePage()
  const updatePage    = useConstructorStore((s) => s.updatePage)
  const markPageDirty = useConstructorStore((s) => s.markPageDirty)

  const pageId = page?.id ?? null
  const schema = page?.meta?.filterSchema as FilterSchemaInput | undefined
  const barViews = toBarViews(schema)

  // Commit a bar's edited control list back into page.meta.filterSchema. The
  // React Compiler memoizes this; reading page/schema from the render scope is
  // safe (the component re-renders — and this closure is re-created — on every
  // store change to the active page).
  const commitBar = (barId: string, params: ParamNode[]) => {
    if (!pageId || !page) return
    const nextSchema = setBarParams(schema, barId, params)
    updatePage(pageId, { meta: { ...page.meta, filterSchema: nextSchema } })
    markPageDirty(pageId)
  }

  if (!page) {
    return (
      <Box sx={{ p: 2, color: 'text.disabled' }}>
        <Typography variant="body2">გვერდი არ არის არჩეული</Typography>
      </Box>
    )
  }

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

// ── AddControl — pick a ParamDef type → append a seeded control ────────────────
//  The type list is the engine SSOT (PARAMDEF_TYPES) — exactly the set Coverage
//  Fitness #1 enumerates, so every authorable type is addable here.
function AddControl({ onAdd }: { onAdd: (type: ParamDefType) => void }) {
  // Selecting a type appends a seeded control and resets the picker to its
  // placeholder (a controlled empty value) — one gesture, no extra button.
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <AddIcon fontSize="small" color="action" aria-hidden />
      <Select
        size="small"
        displayEmpty
        sx={{ minWidth: 200 }}
        inputProps={{ 'aria-label': 'add control' }}
        value=""
        onChange={(e) => { const v = e.target.value as ParamDefType; if (v) onAdd(v) }}
      >
        <MenuItem value="" disabled>+ კონტროლის დამატება…</MenuItem>
        {PARAM_TYPE_OPTIONS.map((t) => (
          <MenuItem key={t} value={t}>{t}</MenuItem>
        ))}
      </Select>
    </Stack>
  )
}
