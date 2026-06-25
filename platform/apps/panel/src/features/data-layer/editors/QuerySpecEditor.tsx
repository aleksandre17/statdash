import {
  Accordion, AccordionDetails, AccordionSummary, Box, Typography,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import type { DataSpec, EncodingSpec, ObsQuery, TransformStep } from '@statdash/engine'
import { MeasureSelector } from './query/MeasureSelector'
import { FilterBuilder } from './query/FilterBuilder'
import { PipelineBuilder } from './query/PipelineBuilder'
import { EncodingEditor } from './query/EncodingEditor'
import { FieldWells } from '../fieldwells/FieldWells'

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
      {/* PRIMARY binding UX (ADR V5): drag field chips into the measure +
          encoding wells. Writes the SAME ObsQuery.measure / EncodingSpec the
          advanced editors below produce (byte-identical) — the UX is the
          improvement, not the output. */}
      <Section title="ველების მიბმა (Field Wells)">
        <FieldWells value={value} onChange={onChange} />
      </Section>

      <Section title="ფილტრები (filter)">
        <FilterBuilder
          value={(value.query.filter ?? {}) as Record<string, unknown>}
          onChange={(filter) => setQuery({ filter: filter as ObsQuery['filter'] })}
        />
      </Section>

      <Section title="პაიპლაინი (Transform Steps)">
        <PipelineBuilder value={value.pipe ?? []} onChange={setPipe} />
      </Section>

      {/* ADVANCED fallback (progressive disclosure): the typed measure +
          encoding editors. Collapsed by default — field-wells are the primary
          path; these stay for power users / channels the wells don't expose. */}
      <Section title="გაფართოებული (Advanced) — ხელით რედაქტირება">
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              მაჩვენებლები (measure)
            </Typography>
            <MeasureSelector
              value={readMeasures(value.query.measure)}
              onChange={(codes) => setQuery({ measure: codes })}
            />
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              ენკოდინგი (encoding)
            </Typography>
            <EncodingEditor value={value.encoding} onChange={setEncoding} />
          </Box>
        </Box>
      </Section>
    </Box>
  )
}

// ── Section — Accordion. The advanced one starts collapsed (progressive
//    disclosure); the rest stay expanded by default. ───────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const advanced = title.startsWith('გაფართოებული')
  return (
    <Accordion defaultExpanded={!advanced} disableGutters variant="outlined">
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle2" fontWeight={600}>{title}</Typography>
      </AccordionSummary>
      <AccordionDetails>{children}</AccordionDetails>
    </Accordion>
  )
}
