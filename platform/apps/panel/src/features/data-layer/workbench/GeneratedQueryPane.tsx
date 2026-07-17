// ── GeneratedQueryPane — the right pane: the "resulting query visible" want (E4) ──
//
//  W-P2 (ADR-046 · SPEC §3.3 / §3.4 / §9 E4). Grafana's builder↔code duality made a
//  pane: the live-updating declarative pipeline the author is building, read top-to-
//  bottom — which doubles as the per-element EXPLAIN/lineage seam (E4: no separate
//  lineage viewer is ever built). Read-only by default in the author plane.
//
//  THE PLANE LAW (ADR-041 §PLANE / SPEC §3.4):
//    • AUTHOR — a friendly, GOVERNED, bilingual rendering: each step as a verb + the
//      governed nouns it consumes. NEVER a raw code / ObsQuery / JSON (FF-AUTHOR-NO-
//      QUERY) — the model (`describeAuthorSteps`) resolves every noun through the
//      governed catalog and never touches the lowered query, so it cannot leak one.
//    • STEWARD — additionally the raw DataSpec JSON + the lowered ObsQuery (wire truth),
//      behind a disclosure (progressive disclosure — the builder stays primary).
//
//  WCAG (Law 9): a labelled `region`, the steps a real ordered list, the steward JSON
//  in labelled disclosures. Read-only text — no color-only meaning. Bilingual ka/en.
//
import { Accordion, AccordionDetails, AccordionSummary, Box, Typography } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import type { DataSpec } from '@statdash/engine'
import { useRole } from '../../../studio/useRole'
import { useMetricCatalog } from '../../../discovery/useMetricCatalog'
import { buildColumnLabels, type ColumnLabelResolver } from '../pipeline-preview/columnLabels'
import type { Locale } from '../../../types/constructor'
import { describeAuthorSteps, describeStewardDetail } from './generatedQuery'

type QuerySpec = Extract<DataSpec, { type: 'query' }>

export interface GeneratedQueryPaneProps {
  spec:   QuerySpec
  locale: Locale
}

export function GeneratedQueryPane({ spec, locale }: GeneratedQueryPaneProps) {
  const en = locale === 'en'
  const role = useRole()
  const catalog = useMetricCatalog()

  // The GOVERNED resolver — the SAME catalog the live grid's headers speak. Until the
  // catalog is ready, fall back to the honest field name (never a fabricated label).
  const resolve: ColumnLabelResolver = catalog.status !== 'ready'
    ? (field: string) => field
    : buildColumnLabels({
        metrics:    catalog.metrics,
        dimensions: catalog.dimensions,
        query:      spec.query,
        locale,
      })

  const steps = describeAuthorSteps(spec, resolve, locale)

  return (
    <Box
      component="section"
      role="region"
      aria-label={en ? 'Generated query' : 'გენერირებული query'}
      data-testid="generated-query"
      sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
    >
      <Typography variant="overline" color="text.secondary">
        {en ? 'Generated query' : 'გენერირებული query'}
      </Typography>

      {/* AUTHOR plane — the friendly governed declarative rendering (read-only). */}
      <Box
        component="ol"
        data-testid="gq-steps"
        sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 0.75 }}
      >
        {steps.map((s, i) => (
          <Box
            component="li"
            key={i}
            data-testid="gq-step"
            data-op={s.op}
            sx={{
              borderLeft: 2, borderColor: 'primary.light', pl: 1, py: 0.25,
              display: 'flex', flexDirection: 'column', gap: 0.25,
            }}
          >
            <Typography variant="body2" fontWeight={600}>{s.verb}</Typography>
            {s.nouns.length > 0 && (
              <Typography variant="caption" color="text.secondary">
                {(en ? 'uses: ' : 'იყენებს: ') + s.nouns.join(', ')}
              </Typography>
            )}
          </Box>
        ))}
      </Box>

      {/* STEWARD plane — the wire truth (raw spec + lowered ObsQuery), disclosed. */}
      {role === 'steward' && <StewardWireTruth spec={spec} locale={locale} />}
    </Box>
  )
}

// ── StewardWireTruth — the raw DataSpec + lowered ObsQuery (steward-only door) ──────
function StewardWireTruth({ spec, locale }: { spec: QuerySpec; locale: Locale }) {
  const en = locale === 'en'
  const detail = describeStewardDetail(spec)
  return (
    <Box data-testid="gq-steward" sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Typography variant="caption" color="text.disabled">
        {en ? 'Steward — wire truth' : 'სტიუარდი — რეალური query'}
      </Typography>
      <WireBlock label={en ? 'DataSpec (raw)' : 'DataSpec (ნედლი)'} body={detail.json} testid="gq-json" />
      <WireBlock label={en ? 'Lowered ObsQuery' : 'დაბლა-გატანილი ObsQuery'} body={detail.obsQuery} testid="gq-obsquery" />
    </Box>
  )
}

function WireBlock({ label, body, testid }: { label: string; body: string; testid: string }) {
  return (
    <Accordion disableGutters variant="outlined">
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="caption" fontWeight={600}>{label}</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Box
          component="pre"
          data-testid={testid}
          sx={{ m: 0, p: 1, bgcolor: 'grey.100', borderRadius: 1, fontSize: 11, overflow: 'auto', fontFamily: 'monospace' }}
        >
          {body}
        </Box>
      </AccordionDetails>
    </Accordion>
  )
}
