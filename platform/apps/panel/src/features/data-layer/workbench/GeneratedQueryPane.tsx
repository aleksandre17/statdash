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
import { useRole } from '../../../studio/useRole'
import { useMetricCatalog } from '../../../discovery/useMetricCatalog'
import { buildColumnLabels, type ColumnLabelResolver } from '../pipeline-preview/columnLabels'
import type { Locale } from '../../../types/constructor'
import { describeAuthorSteps, describeStewardDetail } from './generatedQuery'
import { sourceMeasure, type WorkbenchModel } from './workbenchModel'

export interface GeneratedQueryPaneProps {
  model:  WorkbenchModel
  locale: Locale
}

export function GeneratedQueryPane({ model, locale }: GeneratedQueryPaneProps) {
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
        measure:    sourceMeasure(model.head),
        locale,
      })

  const steps = describeAuthorSteps(model, resolve, locale)

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

      {/* Empty — no metric bound and no steps: an honest hint, never a vestigial
          "Get: (pick a metric)" one-liner (SPEC §9 / Law 11). */}
      {steps.length === 0 && (
        <Typography variant="body2" color="text.secondary" data-testid="gq-empty">
          {en
            ? 'Bind a governed metric to begin — the query will build here as you add steps.'
            : 'დასაწყებად მიაბით მართული მეტრიკა — query აქ აიწყობა ნაბიჯების დამატებისას.'}
        </Typography>
      )}

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
      {role === 'steward' && <StewardWireTruth model={model} locale={locale} />}
    </Box>
  )
}

// ── StewardWireTruth — the STORED artifact + the labeled assembly + lowered ObsQuery
//    (steward-only door, card 0112 §R4 dialect-honesty fix, D5) ─────────────────────────
//
//  The stored artifact renders FIRST, byte-true, under an honest dialect label — never
//  again the `desugarToPipeline` assembly standing in for it (the measured lie: `query`→
//  `pipeline`, 7→8 steps, zero marker). The assembly renders SECOND, ONLY when it diverges
//  from the stored bytes (a stored `pipeline` coincides with its own assembly — one pane,
//  no redundant duplicate, no marker noise), always labeled a PROJECTION.
function StewardWireTruth({ model, locale }: { model: WorkbenchModel; locale: Locale }) {
  const en = locale === 'en'
  const detail = describeStewardDetail(model, locale)
  // STRUCTURAL divergence (key-order-insensitive) — never byte-comparison: a stored
  // pipeline that round-tripped Postgres jsonb differs from the assembly only in key
  // order and is the SAME artifact (one block, no phantom "lowered" duplicate).
  const diverges = !detail.dialect.coincide
  return (
    <Box data-testid="gq-steward" sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Typography variant="caption" color="text.disabled">
        {en ? 'Steward — wire truth' : 'სტიუარდი — რეალური query'}
      </Typography>
      <WireBlock
        label={en
          ? `Stored artifact (${detail.dialect.stored})`
          : `შენახული ჩანაწერი (${detail.dialect.stored})`}
        body={detail.storedJson}
        testid="gq-json"
      />
      {diverges && (
        <WireBlock
          label={en
            ? 'Lowered — engine desugarToPipeline'
            : 'დაშლილი — engine desugarToPipeline'}
          body={detail.canonicalJson}
          testid="gq-canonical-json"
        />
      )}
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
          sx={{
            m: 0, p: 1, bgcolor: 'action.hover', color: 'text.primary', borderRadius: 1,
            // Law 11 in our own instrument: a declared note ALWAYS has height — never the
            // zero-height void the owner caught («ჩნდება და სიმაღლე არ აქვს»).
            minHeight: '2.5em', fontSize: 11, overflow: 'auto', fontFamily: 'monospace',
          }}
        >
          {body}
        </Box>
      </AccordionDetails>
    </Accordion>
  )
}
