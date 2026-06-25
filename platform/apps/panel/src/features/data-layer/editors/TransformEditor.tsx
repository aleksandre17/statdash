// ── TransformEditor — type=transform: {source, steps, encoding} [V2] ───────────
//
//  A `transform` DataSpec is the full declarative pipeline (the Vega-Lite transform
//  analogue): a literal `source` (inline rows), a `steps` pipeline, and an
//  `encoding`. This editor REUSES the existing surfaces wholesale — NO rebuild:
//    • steps    → the EXISTING PipelineBuilder (V1 schema-driven step authoring).
//    • encoding → the EXISTING EncodingEditor (the query editor's encoding surface).
//    • source   → JsonDataField (the documented literal-data escape hatch — inline
//                 rows are by definition literal data; YAGNI: a JSON textarea, not
//                 a grid). `pivot` desugars to transform+melt internally (R3), so
//                 this is also the structural home of pivot's pipeline.
//
//  Every edit produces a NEW spec handed up via onChange (immutable, unidirectional
//  — Flux). The spec round-trips losslessly (each sub-editor preserves its slice).
//
import {
  Accordion, AccordionDetails, AccordionSummary, Box, Typography,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import type { DataSpec, DimVal, EncodingSpec, TransformStep } from '@statdash/engine'
import { PipelineBuilder } from './query/PipelineBuilder'
import { EncodingEditor } from './query/EncodingEditor'
import { JsonDataField } from './JsonDataField'

type TransformSpec = Extract<DataSpec, { type: 'transform' }>
type SourceRows = Record<string, DimVal>[]

export interface TransformEditorProps {
  value:    TransformSpec
  onChange: (next: TransformSpec) => void
}

export function TransformEditor({ value, onChange }: TransformEditorProps) {
  const setSource   = (source: SourceRows)        => onChange({ ...value, source })
  const setSteps    = (steps: TransformStep[])    => onChange({ ...value, steps })
  const setEncoding = (encoding: EncodingSpec)    => onChange({ ...value, encoding })

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Section title="წყარო (Source — inline rows)">
        <JsonDataField<SourceRows>
          label="სტატიკური სტრიქონები: Record<string, DimVal>[]"
          hint="ლიტერალური მონაცემები — pipeline-ის შესასვლელი"
          value={value.source}
          onChange={setSource}
        />
      </Section>

      <Section title="ნაბიჯები (Steps)">
        <PipelineBuilder value={value.steps} onChange={setSteps} />
      </Section>

      <Section title="ენკოდინგი (Encoding)">
        <EncodingEditor value={value.encoding} onChange={setEncoding} />
      </Section>
    </Box>
  )
}

// ── Section — Accordion expanded by default (mirrors QuerySpecEditor) ──────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Accordion defaultExpanded disableGutters variant="outlined">
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle2" fontWeight={600}>{title}</Typography>
      </AccordionSummary>
      <AccordionDetails>{children}</AccordionDetails>
    </Accordion>
  )
}
