// ── DataWorkbench — the three-pane authoring surface (W-P2/W-P5b · SPEC §3) ────────
//
//  ADR-046 · SPEC §3 (the surface). The Power-Query-class editor that replaces the
//  tag-zoo: ONE surface, THREE panes, ALWAYS visible together —
//    • STEP RAIL   (left)   — the applied-steps: the Get HEAD (an ACTIVE governed-metric
//                             picker — browse-first, SPEC §3.4/§9 E1) + PipelineBuilder
//                             over the pure TAIL (dnd-kit keyboard-reorderable rail).
//    • LIVE GRID   (center) — PipelineStepGrid: the browse rows the source head produces
//                             + each tail step's output (real width — the CRAFT fix).
//    • GENERATED   (right)  — the live declarative query + the EXPLAIN seam (E4).
//                  QUERY
//
//  ── The spine is canonical INSIDE the workbench (W-P5b) ────────────────────────────
//  The surface speaks the ONE `pipeline` spine. It accepts BOTH a legacy `query` (via its
//  desugared view) AND a native `pipeline` — `toWorkbenchModel` lowers either to the
//  canonical {head, tail, encoding}, so the rail/grid/query-pane never branch on the
//  discriminant. Every WRITE emits `pipeline` (`fromWorkbenchModel`) — the ⛔ W-P5
//  emission flip; an active edit of a legacy `query` converts it to the spine (safe:
//  query≡pipeline byte-identical at resolve time).
//
//  ── The Get card is the ACTIVE HEAD, not a tail step (SPEC §3.4) ───────────────────
//  Get = "pick a governed metric" (MetricPalette in the rail). Choosing shows the data
//  immediately (E1 browse-first). The author never starts from "choose a spec type" —
//  the 8-type discriminant Select is ABSENT here.
//
//  Controlled: `value` in (the element's DataSpec), `onChange` out (the next `pipeline`).
//  WCAG (Law 9): three labelled `region`s; the rail keyboard-reorderable; the grid a real
//  table; the query pane a labelled region. Bilingual ka/en.
//
import { useState } from 'react'
import { Box, Chip, Typography } from '@mui/material'
import type { DataSpec, TransformStep } from '@statdash/engine'
import { PipelineBuilder } from '../editors/query/PipelineBuilder'
import { PipelineStepGrid } from '../pipeline-preview/PipelineStepGrid'
import { AS_OF_SOURCE } from '../pipeline-preview/pipelinePreview'
import { GeneratedQueryPane } from './GeneratedQueryPane'
import { VerbPalette } from './VerbPalette'
import {
  fromWorkbenchModel, isHeadBound, toWorkbenchModel, withGovernedMetric,
} from './workbenchModel'
import { MetricPalette } from '../../../discovery/MetricPalette'
import { useActiveLocales } from '../../../inspector/useActiveLocales'
import type { Locale } from '../../../types/constructor'
import './workbench.css'

export interface DataWorkbenchProps {
  /** The element's DataSpec (the escalation binds this live from the store). */
  value:    DataSpec | undefined
  /** Write the whole next DataSpec back (always a `pipeline` — the emission flip). */
  onChange: (next: DataSpec) => void
}

export function DataWorkbench({ value, onChange }: DataWorkbenchProps) {
  const locale = (useActiveLocales()[0] ?? 'ka') as Locale
  const en = locale === 'en'

  // The step whose live output the grid shows. Default = the Get read (AS_OF_SOURCE) —
  // browse-first (E1): data is on screen before any tail step.
  const [asOfStep, setAsOfStep] = useState<number>(AS_OF_SOURCE)

  // Lower the accepted spec to the canonical pipeline view. A spec the workbench does not
  // shape (row-list/timeseries/growth/…) is declared honestly rather than painted broken
  // (Law 11) — those keep their own front-doors (the value-cell specs, W-P5a finding).
  const model = toWorkbenchModel(value)
  if (!model) {
    return (
      <Box className="data-workbench data-workbench--empty" data-testid="data-workbench-nonquery" sx={{ p: 3, color: 'text.secondary' }}>
        <Typography variant="body2">
          {en
            ? 'This element has no pipeline yet. Bind a governed metric to start.'
            : 'ამ ელემენტს ჯერ პაიპლაინი არ აქვს. დასაწყებად მიაბით მართული მეტრიკა.'}
        </Typography>
      </Box>
    )
  }

  const bound = isHeadBound(model.head)
  const setTail = (tail: TransformStep[]) => onChange(fromWorkbenchModel({ ...model, tail }))
  const pickMetric = (metricId: string) => onChange(fromWorkbenchModel(withGovernedMetric(model, metricId)))

  return (
    <Box className="data-workbench" data-testid="data-workbench">
      {/* ── LEFT — the applied-steps rail (Power Query) ──────────────────────────── */}
      <Box
        component="section"
        role="region"
        className="data-workbench__pane data-workbench__rail"
        aria-label={en ? 'Steps' : 'ნაბიჯები'}
        data-testid="workbench-rail"
      >
        <Typography variant="overline" color="text.secondary">{en ? 'Steps' : 'ნაბიჯები'}</Typography>

        {/* Head = Get: the ACTIVE governed-metric picker (browse-first, E1). Choosing a
            metric puts data on screen immediately. Selecting the chip shows the source
            (Get) output in the grid. */}
        <Box className="data-workbench__get" data-testid="workbench-get" sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <Chip
            size="small"
            clickable
            data-testid="pipe-source-chip"
            label={bound ? (en ? 'Get (source)' : 'წყარო (Get)') : (en ? 'Get — pick a metric' : 'წყარო — აირჩიეთ მეტრიკა')}
            color="primary"
            variant={asOfStep === AS_OF_SOURCE ? 'filled' : 'outlined'}
            aria-pressed={asOfStep === AS_OF_SOURCE}
            onClick={() => setAsOfStep(AS_OF_SOURCE)}
            sx={{ alignSelf: 'flex-start' }}
          />
          <MetricPalette
            locale={locale}
            canBind
            bindHint={en ? 'Pick a governed metric for the source' : 'აირჩიეთ მართული მეტრიკა წყაროსთვის'}
            onBind={pickMetric}
          />
        </Box>

        <PipelineBuilder
          value={model.tail}
          onChange={setTail}
          selectedStep={asOfStep}
          onSelectStep={setAsOfStep}
          renderAddStep={(addStep) => <VerbPalette onAdd={addStep} />}
        />
      </Box>

      {/* ── CENTER — the live per-step grid, real width ──────────────────────────── */}
      <Box
        component="section"
        role="region"
        className="data-workbench__pane data-workbench__grid"
        aria-label={en ? 'Live data' : 'ცოცხალი მონაცემები'}
        data-testid="workbench-grid"
      >
        <Typography variant="overline" color="text.secondary">{en ? 'Live data' : 'ცოცხალი მონაცემები'}</Typography>
        <PipelineStepGrid model={model} asOfStep={asOfStep} />
      </Box>

      {/* ── RIGHT — the generated query + EXPLAIN seam (E4). The pane owns its own
          labelled `region` (WCAG); this wrapper is layout only. ───────────────────── */}
      <Box className="data-workbench__pane data-workbench__query" data-testid="workbench-query">
        <GeneratedQueryPane model={model} locale={locale} />
      </Box>
    </Box>
  )
}
