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
import type { DataSpec, DimVal, EncodingSpec, TransformStep } from '@statdash/engine'
import { PipelineBuilder } from '../editors/query/PipelineBuilder'
import { PipelineStepGridView } from '../pipeline-preview/PipelineStepGrid'
import { MetricPalette } from '../../../discovery/MetricPalette'
import { usePipelineSourceRows } from '../pipeline-preview/usePipelineSourceRows'
import { useGridLabels } from '../pipeline-preview/useGridLabels'
import { buildStepInputOffer, stepInputRows, type StepInputOffer } from '../pipeline-preview/stepInput'
import { AS_OF_SOURCE, AUTHOR_HIDDEN_FIELDS } from '../pipeline-preview/pipelinePreview'
import { GeneratedQueryPane } from './GeneratedQueryPane'
import { VerbPalette } from './VerbPalette'
import {
  fromWorkbenchModel, governedWhere, isGovernedHead, isHeadBound, isStewardHead,
  promoteHeadToMetric, stewardHeadMeasure, toWorkbenchModel, withGovernedMetric,
  withGovernedWhere, withStewardCube,
} from './workbenchModel'
import { GetHead } from './GetHead'
import { GetGrainEditor } from './GetGrainEditor'
import { PromoteMetric } from './PromoteMetric'
import { useRole } from '../../../studio/useRole'
import { useDataSources } from '../../../store/constructor.store'
import { storeKeyForDataset } from '../../../discovery/cubeProfile.store'
import { useActiveLocales } from '../../../inspector/useActiveLocales'
import type { Locale } from '../../../types/constructor'
import './workbench.css'

/** A neutral encoding for the source hook when there is no shaped model yet (its result
 *  is unused in that branch — the hook must still be called unconditionally). */
const EMPTY_ENCODING: EncodingSpec = { label: '' }

/** The grain editor offers from the SOURCE browse rows — the INPUT to the first tail step
 *  (`stepInput(0)` derives to AS_OF_SOURCE, the head's browse output). */
const GRAIN_STEP = 0

export interface DataWorkbenchProps {
  /** The element's DataSpec (the escalation binds this live from the store). */
  value:    DataSpec | undefined
  /** Write the whole next DataSpec back (always a `pipeline` — the emission flip). */
  onChange: (next: DataSpec) => void
}

export function DataWorkbench({ value, onChange }: DataWorkbenchProps) {
  const locales = useActiveLocales() as Locale[]
  const locale = (locales[0] ?? 'ka') as Locale
  const en = locale === 'en'
  const isSteward = useRole() === 'steward'
  // Session sources — the datasetCode→storeKey SSOT for the raw-cube pick (0089). The picked
  // cube's storeKey is frozen onto the steward head so its browse reads that cube's own store.
  const sources = useDataSources()

  // The step whose live output the grid shows. Default = the Get read (AS_OF_SOURCE) —
  // browse-first (E1): data is on screen before any tail step.
  const [asOfStep, setAsOfStep] = useState<number>(AS_OF_SOURCE)

  // Lower the accepted spec to the canonical pipeline view. A spec the workbench does not
  // shape (row-list/timeseries/growth/…) is declared honestly rather than painted broken
  // (Law 11) — those keep their own front-doors (the value-cell specs, W-P5a finding).
  const model = toWorkbenchModel(value)

  // ── ONE source read, lifted (SPEC §3.2 / P-OFFER) ──────────────────────────────────
  //  Resolved ONCE here (never a 2nd fetch): the grid and the step-editor OFFERS both
  //  derive from THESE rows. The hooks are called unconditionally (before the honest
  //  non-shaped early-return) — their result is unused when there is no model.
  const source = usePipelineSourceRows(model?.head, model?.encoding ?? EMPTY_ENCODING)
  const { isAuthor, columnLabel, cellLabel, locale: gridLocale } = useGridLabels(model?.head)

  // The P-OFFER provider: the OFFER (governed columns + distinct member values) for the
  // tail step at `index`, over its INPUT rows (= the previous step's output — the SAME
  // ONE derivation path the grid uses). No rows yet, or a prior step throws mid-authoring
  // → `undefined` so the step form degrades to the honest free-text fallback (Law 11).
  const stepInput = (index: number): StepInputOffer | undefined => {
    if (!model || source.status !== 'ok') return undefined
    try {
      const rows = stepInputRows(source.sourceRows, model.tail, index, source.pipeCtx)
      return buildStepInputOffer({
        rows,
        columnLabel,
        cellLabel,
        hiddenFields: isAuthor ? AUTHOR_HIDDEN_FIELDS : undefined,
        locale: gridLocale,
      })
    } catch {
      return undefined
    }
  }

  if (!model) {
    // ADR-049 P2a Lane 1 — the KIND-AGNOSTIC door lands here for a spec the workbench does
    // not yet shape (row-list / timeseries / growth / ratio-list). The binding is ADOPTED
    // intact (the caller never wiped it); this pane declares that honestly (Law 11) AND
    // offers a governed metric bind to START a pipeline — so the un-gated door is a LIVE
    // path forward, not a dead room. Binding a metric emits the spine (the ⛔ emission flip),
    // an explicit author gesture, exactly like a legacy `query` converts on active edit.
    return (
      <Box className="data-workbench data-workbench--empty" data-testid="data-workbench-nonquery" sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Typography variant="body2" color="text.secondary">
          {en
            ? 'This element has no pipeline yet. Bind a governed metric to start building one.'
            : 'ამ ელემენტს ჯერ პაიპლაინი არ აქვს. ასაგებად მიაბით მართული მეტრიკა.'}
        </Typography>
        <MetricPalette
          locale={locale}
          canBind
          bindHint={en ? 'Bind a governed metric' : 'მიაბით მართული მეტრიკა'}
          onBind={(metricId) =>
            onChange(fromWorkbenchModel(withGovernedMetric(
              { head: { op: 'source', metrics: [] }, tail: [], encoding: { label: 'label' } },
              metricId,
            )))}
        />
      </Box>
    )
  }

  const bound = isHeadBound(model.head)
  const setTail = (tail: TransformStep[]) => onChange(fromWorkbenchModel({ ...model, tail }))
  const pickMetric = (metricId: string) => onChange(fromWorkbenchModel(withGovernedMetric(model, metricId)))
  // 0089 · ADR-046 Addendum 3: the picked raw cube declares its OWN store home on the head
  // (datasetCode→storeKey via the session-source SSOT), so the browse reads THAT cube's store,
  // not the page's (the cross-cube lying-grid fix). Undefined storeKey ⇒ head declares no home.
  const pickCube = (datasetCode: string, measures: string[]) =>
    onChange(fromWorkbenchModel(withStewardCube(model, measures, storeKeyForDataset(sources, datasetCode))))
  const promote = (metricId: string) => onChange(fromWorkbenchModel(promoteHeadToMetric(model, metricId)))
  const setGrain = (where: Partial<Record<string, DimVal>>) =>
    onChange(fromWorkbenchModel(withGovernedWhere(model, where)))

  // The promotion loop (E2) is offered ONLY for a bound STEWARD raw head — a raw read whose
  // destiny is a governed fact. A governed head is already promoted; an unbound head has
  // nothing to promote. `stewardMeasure` is the single code the promotion governs.
  const stewardMeasureRaw = stewardHeadMeasure(model.head)
  const stewardMeasure = Array.isArray(stewardMeasureRaw) ? stewardMeasureRaw[0] : stewardMeasureRaw
  const canPromote = isSteward && bound && isStewardHead(model.head) && !!stewardMeasure

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
          {/* The source picker — governed metrics (author + steward) + raw cubes (steward
              lens only, plane law). The AUTHOR never sees the raw tab (FF-AUTHOR-NO-QUERY). */}
          <GetHead locale={locale} onPickMetric={pickMetric} onPickCube={pickCube} />

          {/* The read-level grain «წაკითხვის არე» (SPEC §3.2) — a bound GOVERNED head's
              `where` pins, OFFERED from the source browse. Grain-∅ browse is the default. */}
          {bound && isGovernedHead(model.head) && (
            <GetGrainEditor
              where={governedWhere(model.head)}
              onChange={setGrain}
              input={stepInput(GRAIN_STEP)}
              locale={locale}
            />
          )}

          {/* The promotion loop (E2) — a bound raw/steward head can become a governed metric. */}
          {canPromote && stewardMeasure && (
            <PromoteMetric
              measure={stewardMeasure}
              locales={locales}
              locale={locale}
              onPromoted={promote}
            />
          )}
        </Box>

        <PipelineBuilder
          value={model.tail}
          onChange={setTail}
          selectedStep={asOfStep}
          onSelectStep={setAsOfStep}
          renderAddStep={(addStep) => <VerbPalette onAdd={addStep} />}
          stepInput={stepInput}
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
        <PipelineStepGridView model={model} asOfStep={asOfStep} source={source} />
      </Box>

      {/* ── RIGHT — the generated query + EXPLAIN seam (E4). The pane owns its own
          labelled `region` (WCAG); this wrapper is layout only. ───────────────────── */}
      <Box className="data-workbench__pane data-workbench__query" data-testid="workbench-query">
        <GeneratedQueryPane model={model} locale={locale} />
      </Box>
    </Box>
  )
}
