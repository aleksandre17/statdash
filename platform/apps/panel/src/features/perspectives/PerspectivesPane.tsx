// ── PerspectivesPane — page-level Perspectives authoring surface [P-final] ─────
//
//  The genuinely-new page-level organism (VISION #3 FULLSTACK §2.2) — the positive
//  replacement for the deleted ByModeEditor authoring need. It is the convergent
//  best-in-class primitive the field research names: a NAMED, ORDERED list of states
//  with a default, each carrying its declarative effect, edited in a dockable pane
//  with a live preview of the active one — Power BI's bookmark-pane IA + Grafana's
//  variables-list editor + Tableau's typed-parameter model + Looker's first-class
//  measure, UNIFIED. `perspective = f(state)` makes the preview always-live (no stale
//  capture — the architectural win over Power BI's bookmark model).
//
//  Page-SCOPED (like FiltersDrawer / PageInspectorPanel): shown regardless of node
//  selection — the page root's PerspectiveAxis is always the implicit element here.
//
//  Reuses EXISTING seams end-to-end (most of P-final is registration, not new code):
//    • the record⇄list adapter (perspectiveModel) — the lossless map⇄node move the
//      Filters surface proved (FiltersDrawer/filterSchemaModel);
//    • the generic Inspector for each PerspectiveDef (PerspectiveDefEditor →
//      perspectiveDefSchemaSource — label/icon + the registry-driven scope fields);
//    • the recursive VisibilityBuilder for when/available (the node "show when" builder);
//    • page.meta.perspectives, carried losslessly by canvasPageAdapter (structural
//      pass-through) — validateConfig unaffected, existing configs byte-identical.
//
//  Accessibility (WCAG 2.1 AA, Law 9): the preview switcher is a role=radiogroup
//  (the active perspective is single-select, keyboard-navigable, not colour-only);
//  every reorder/remove control is a labelled IconButton; the default perspective
//  carries a visible "default" chip AND text, never position alone.
//
import { useState } from 'react'
import {
  Box, Typography, Paper, IconButton, Chip, Divider, Stack, Tooltip, Button,
} from '@mui/material'
import AddIcon           from '@mui/icons-material/Add'
import DeleteIcon        from '@mui/icons-material/Delete'
import ArrowUpwardIcon   from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import LayersIcon        from '@mui/icons-material/Layers'
import type { PerspectiveDef, PerspectivesByParam } from '@statdash/engine'
import { useConstructorStore, useActivePage } from '../../store/constructor.store'
import { useActiveLocales } from '../../inspector/useActiveLocales'
import { readLocale } from '../../inspector/localeString'
import { PerspectiveDefEditor } from './PerspectiveDefEditor'
import {
  toAxisViews, setAxisPerspectives, movePerspective, type PerspectiveAxisView,
} from './perspectiveModel'
import { makePerspectiveDef, DEFAULT_PERSPECTIVE_PARAM } from './perspectiveFactory'
import type { LocaleStringValue } from '../../inspector/localeString'
import type { Locale, PageMeta } from '../../types/constructor'

export function PerspectivesPane() {
  const page          = useActivePage()
  const updatePage    = useConstructorStore((s) => s.updatePage)
  const markPageDirty = useConstructorStore((s) => s.markPageDirty)
  const locales       = useActiveLocales()

  const pageId = page?.id ?? null
  const by     = page?.meta?.perspectives as PerspectivesByParam | undefined
  const axes   = toAxisViews(by)

  // Commit one axis's edited perspective list back into page.meta.perspectives.
  const commitAxis = (param: string, perspectives: PerspectiveDef[]) => {
    if (!pageId || !page) return
    const nextBy   = setAxisPerspectives(by, param, perspectives)
    const nextMeta = { ...page.meta, perspectives: nextBy } as PageMeta
    updatePage(pageId, { meta: nextMeta })
    markPageDirty(pageId)
  }

  // Add the FIRST axis (the common single-axis case) under the engine SSOT param.
  const addFirstAxis = () => {
    commitAxis(DEFAULT_PERSPECTIVE_PARAM, [makePerspectiveDef(locales)])
  }

  if (!page) {
    return (
      <Box sx={{ p: 2, color: 'text.disabled' }}>
        <Typography variant="body2">გვერდი არ არის არჩეული</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }} data-testid="perspectives-pane">
      <Stack direction="row" spacing={1} alignItems="center">
        <LayersIcon fontSize="small" />
        <Typography variant="overline" color="text.secondary">პერსპექტივები</Typography>
      </Stack>

      {axes.length === 0 && (
        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary">
            ამ გვერდს პერსპექტივის ღერძი არ აქვს. დაამატეთ პირველი პერსპექტივა (Year / Range).
          </Typography>
          <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={addFirstAxis}>
            პერსპექტივის დამატება
          </Button>
        </Stack>
      )}

      {axes.map((axis) => (
        <AxisEditor
          key={axis.param}
          axis={axis}
          locales={locales}
          onCommit={(perspectives) => commitAxis(axis.param, perspectives)}
        />
      ))}
    </Box>
  )
}

// ── AxisEditor — one PerspectiveAxis: the ordered list + add + preview ─────────

function AxisEditor({
  axis, locales, onCommit,
}: {
  axis:     PerspectiveAxisView
  locales:  Locale[]
  onCommit: (perspectives: PerspectiveDef[]) => void
}) {
  const { param, perspectives } = axis
  // The active perspective for the preview switcher — defaults to perspectives[0]
  // (the SSOT default). Local UI state: which perspective the author is previewing.
  const [activeId, setActiveId] = useState<string>(perspectives[0]?.id ?? '')
  const locale = locales[0] ?? 'en'

  return (
    <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}
           data-testid={`perspective-axis-${param}`}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography variant="subtitle2">URL param:</Typography>
        <Chip size="small" label={param} variant="outlined" />
      </Stack>

      {perspectives.map((def, i) => (
        <Paper key={def.id} variant="outlined" sx={{ p: 1.5 }} data-testid={`perspective-row-${def.id}`}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="caption" sx={{ flex: 1 }}>
              <strong>{readLocale(def.label as LocaleStringValue, locale) || def.id}</strong> · {def.id}
            </Typography>
            {/* perspectives[0] is the default (one SSOT, LOW-1) — flagged, not by position alone. */}
            {i === 0 && (
              <Chip size="small" color="primary" data-testid={`perspective-default-${def.id}`}
                label={{ ka: 'ნაგულისხმევი', en: 'default' }[locale] ?? 'default'} />
            )}
            <Tooltip title="ზემოთ">
              <span>
                <IconButton size="small" aria-label="move up" disabled={i === 0}
                  onClick={() => onCommit(movePerspective(perspectives, i, i - 1))}>
                  <ArrowUpwardIcon fontSize="inherit" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="ქვემოთ">
              <span>
                <IconButton size="small" aria-label="move down" disabled={i === perspectives.length - 1}
                  onClick={() => onCommit(movePerspective(perspectives, i, i + 1))}>
                  <ArrowDownwardIcon fontSize="inherit" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="წაშლა">
              <IconButton size="small" color="error" aria-label="remove perspective"
                onClick={() => onCommit(perspectives.filter((_, j) => j !== i))}>
                <DeleteIcon fontSize="inherit" />
              </IconButton>
            </Tooltip>
          </Stack>

          {/* Schema-driven label/icon/scope + when/available — the SAME generic Inspector. */}
          <PerspectiveDefEditor
            def={def}
            onChange={(next) => onCommit(perspectives.map((d, j) => (j === i ? next : d)))}
          />
        </Paper>
      ))}

      <Divider />
      <Button size="small" startIcon={<AddIcon />}
        onClick={() => onCommit([...perspectives, makePerspectiveDef(locales)])}>
        პერსპექტივის დამატება
      </Button>

      {/* ── Preview switcher (Framer variant-chip row) — the always-live active one ── */}
      {perspectives.length > 0 && (
        <>
          <Divider />
          <Stack spacing={0.5}>
            <Typography variant="caption" color="text.secondary">გადახედვა (active)</Typography>
            <Stack direction="row" spacing={1} role="radiogroup" aria-label="active perspective preview">
              {perspectives.map((def) => (
                <Chip
                  key={def.id}
                  size="small"
                  role="radio"
                  aria-checked={activeId === def.id}
                  label={readLocale(def.label as LocaleStringValue, locale) || def.id}
                  color={activeId === def.id ? 'primary' : 'default'}
                  variant={activeId === def.id ? 'filled' : 'outlined'}
                  onClick={() => setActiveId(def.id)}
                />
              ))}
            </Stack>
          </Stack>
        </>
      )}
    </Paper>
  )
}
