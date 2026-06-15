import {
  Accordion, AccordionDetails, AccordionSummary, Box, Typography,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import type { DataSpec, EncodingSpec, ObsQuery, TransformStep } from '@geostat/engine'
import { MeasureSelector } from './query/MeasureSelector'
import { FilterBuilder } from './query/FilterBuilder'
import { PipelineBuilder } from './query/PipelineBuilder'
import { EncodingEditor } from './query/EncodingEditor'

// ── QuerySpecEditor — full query editor (ObsQuery + pipe + encoding) ──────────

type QuerySpec = Extract<DataSpec, { type: 'query' }>

export interface QuerySpecEditorProps {
  value:    QuerySpec
  onChange: (next: QuerySpec) => void
}

// measure is `string | string[]` in ObsQuery — normalize both directions.
function readMeasures(measure: ObsQuery['measure']): string[] {
  return Array.isArray(measure) ? measure : measure ? [measure] : []
}

export function QuerySpecEditor({ value, onChange }: QuerySpecEditorProps) {
  const setQuery = (patch: Partial<ObsQuery>) =>
    onChange({ ...value, query: { ...value.query, ...patch } })

  const setPipe = (pipe: TransformStep[]) => onChange({ ...value, pipe })
  const setEncoding = (encoding: EncodingSpec) => onChange({ ...value, encoding })

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Section title="მოთხოვნა (ObsQuery)">
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <MeasureSelector
            value={readMeasures(value.query.measure)}
            onChange={(codes) => setQuery({ measure: codes })}
          />
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              ფილტრები (filter)
            </Typography>
            <FilterBuilder
              value={(value.query.filter ?? {}) as Record<string, unknown>}
              onChange={(filter) => setQuery({ filter: filter as ObsQuery['filter'] })}
            />
          </Box>
        </Box>
      </Section>

      <Section title="პაიპლაინი (Transform Steps)">
        <PipelineBuilder value={value.pipe ?? []} onChange={setPipe} />
      </Section>

      <Section title="ენკოდინგი (Encoding)">
        <EncodingEditor value={value.encoding} onChange={setEncoding} />
      </Section>
    </Box>
  )
}

// ── Section — Accordion expanded by default ───────────────────────────────────
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
