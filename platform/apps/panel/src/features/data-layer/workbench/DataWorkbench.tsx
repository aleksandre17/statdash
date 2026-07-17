// ── DataWorkbench — the three-pane authoring surface (W-P2 · SPEC §3) ─────────────
//
//  ADR-046 · SPEC §3 (the surface). The Power-Query-class editor that replaces the
//  tag-zoo: ONE surface, THREE panes, ALWAYS visible together —
//    • STEP RAIL   (left)   — the applied-steps: the Get head chip + PipelineBuilder
//                             (reused verbatim, dnd-kit keyboard-reorderable rail).
//    • LIVE GRID   (center) — PipelineStepGrid re-homed VERBATIM from W-P1, now with
//                             REAL WIDTH (the CRAFT fix: the grid suffocated in the
//                             320px dock; here it gets the 1fr center column).
//    • GENERATED   (right)  — the live declarative query + the EXPLAIN seam (E4).
//                  QUERY
//
//  ── Where it lives (the IA decision — SPEC §3, "reached when an element needs
//     binding") ──────────────────────────────────────────────────────────────────
//  The workbench is WORKSPACE-weight (three panes, a wide grid). It is NOT crammed
//  into the ~320px inspector dock. It is escalated OUT into the focus-view — the
//  studio's established separate-screen surface for workspace-weight subjects (SL-4):
//  the DATA facet (`props.data`) hands it OUT via `useFocusEscalation`, so it gets the
//  full viewport width without breaking the StudioShell grid, and Back returns loss-
//  free. The entry gesture is the DATA facet's "Open data workbench" (DataFacetField).
//
//  ── The 8-type Select is ABSENT here (SPEC §3.4) ──────────────────────────────────
//  The author starts from Get + a governed metric, never from "choose a spec type" —
//  the discriminant picker (DataSpecEditor) is NOT mounted in the workbench. (It still
//  coexists in the DATA facet's advanced accordion until W-P5's gated demotion.)
//
//  Controlled: `value` in (the element's DataSpec), `onChange` out. Reads its own live
//  locale (so it stays live across the escalation unmount). WCAG (Law 9): three labelled
//  `section` regions; the rail is keyboard-reorderable; the grid is a real table; the
//  query pane is a labelled region. Bilingual ka/en.
//
import { useState } from 'react'
import { Box, Chip, Typography } from '@mui/material'
import type { DataSpec, TransformStep } from '@statdash/engine'
import { PipelineBuilder } from '../editors/query/PipelineBuilder'
import { PipelineStepGrid } from '../pipeline-preview/PipelineStepGrid'
import { AS_OF_SOURCE } from '../pipeline-preview/pipelinePreview'
import { GeneratedQueryPane } from './GeneratedQueryPane'
import { useActiveLocales } from '../../../inspector/useActiveLocales'
import type { Locale } from '../../../types/constructor'
import './workbench.css'

export interface DataWorkbenchProps {
  /** The element's DataSpec (the escalation binds this live from the store). */
  value:    DataSpec | undefined
  /** Write the whole next DataSpec back (the escalation host owns the store write). */
  onChange: (next: DataSpec) => void
}

export function DataWorkbench({ value, onChange }: DataWorkbenchProps) {
  const locale = (useActiveLocales()[0] ?? 'ka') as Locale
  const en = locale === 'en'

  // The step whose live output the grid shows. Default = the Get read (AS_OF_SOURCE) —
  // browse-first (E1): data is on screen before any step. Kept here so the rail
  // selection and the grid stay in one place (lifted from QuerySpecEditor).
  const [asOfStep, setAsOfStep] = useState<number>(AS_OF_SOURCE)

  // The three panes are QUERY-shaped (Get + pipe + generated query). A non-query spec
  // enters via the existing conversion (DataSpecEditor) — declare it honestly rather
  // than paint an empty/broken workbench (Law 11).
  if (!value || value.type !== 'query') {
    return (
      <Box className="data-workbench data-workbench--empty" data-testid="data-workbench-nonquery" sx={{ p: 3, color: 'text.secondary' }}>
        <Typography variant="body2">
          {en
            ? 'This element has no query pipeline yet. Bind a governed metric to start.'
            : 'ამ ელემენტს ჯერ query-პაიპლაინი არ აქვს. დასაწყებად მიაბით მართული მეტრიკა.'}
        </Typography>
      </Box>
    )
  }

  // `spec` is narrowed to the `query` variant by the guard above.
  const spec = value
  const setPipe = (pipe: TransformStep[]) => onChange({ ...spec, pipe })

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
        {/* Head card = Get (the source read). Selecting it shows the browse grid (E1). */}
        <Chip
          size="small"
          clickable
          data-testid="pipe-source-chip"
          label={en ? 'Get (source)' : 'წყარო (Get)'}
          color="primary"
          variant={asOfStep === AS_OF_SOURCE ? 'filled' : 'outlined'}
          aria-pressed={asOfStep === AS_OF_SOURCE}
          onClick={() => setAsOfStep(AS_OF_SOURCE)}
          sx={{ alignSelf: 'flex-start' }}
        />
        <PipelineBuilder
          value={spec.pipe ?? []}
          onChange={setPipe}
          selectedStep={asOfStep}
          onSelectStep={setAsOfStep}
        />
      </Box>

      {/* ── CENTER — the live per-step grid, re-homed VERBATIM with real width ────── */}
      <Box
        component="section"
        role="region"
        className="data-workbench__pane data-workbench__grid"
        aria-label={en ? 'Live data' : 'ცოცხალი მონაცემები'}
        data-testid="workbench-grid"
      >
        <Typography variant="overline" color="text.secondary">{en ? 'Live data' : 'ცოცხალი მონაცემები'}</Typography>
        <PipelineStepGrid spec={spec} asOfStep={asOfStep} />
      </Box>

      {/* ── RIGHT — the generated query + EXPLAIN seam (E4). The pane owns its own
          labelled `region` (WCAG); this wrapper is layout only, so the region is not
          double-nested. ──────────────────────────────────────────────────────────── */}
      <Box className="data-workbench__pane data-workbench__query" data-testid="workbench-query">
        <GeneratedQueryPane spec={spec} locale={locale} />
      </Box>
    </Box>
  )
}
