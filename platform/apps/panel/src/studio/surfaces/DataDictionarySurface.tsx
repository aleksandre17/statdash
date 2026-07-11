import { useEffect, useMemo, useRef, useState, useId } from 'react'
import { Box, Typography, TextField, InputAdornment, Chip, Divider, Link } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import HubOutlinedIcon from '@mui/icons-material/HubOutlined'
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined'
import type { MetricDef } from '@statdash/engine'
import type { Locale } from '../../types/constructor'
import { useMetricCatalog } from '../../discovery/useMetricCatalog'
import { readCatalogLabel, type CatalogDimension } from '../../discovery/semanticCatalogOptions'
import { DataFlowMap } from '../model/DataFlowMap'

// ── DataDictionarySurface — the author-lens READ-ONLY data model view (AR-50 M5b) ─
//
//  The G6 fix ("built ≠ buried"): the whole data-model capability used to be
//  unreachable from a default (author) session — gated behind the Steward lens. It is
//  now a first-class, always-visible rail destination whose CONTENT splits by the role
//  lens (DataModelBody, focusViewRegistry): the Steward sees the full modeler; the
//  AUTHOR sees THIS — a dbt-docs-grade, read-only Data Dictionary of the governed
//  semantic layer. The author can finally SEE what exists (metrics, dimensions,
//  sources) and its provenance/definition, WITHOUT ever meeting the raw query cliff.
//
//  ── Read-only by construction (FF-AUTHOR-NO-QUERY holds) ───────────────────────
//  This is DISCOVERY, not authoring: it references NONE of the raw modeling machinery
//  (no DataModelingPanel / DataSpecEditor / QuerySpecEditor / PivotEditor /
//  TransformEditor, no features/data-layer import) and offers no bind / edit / drag.
//  It reads the SAME governed catalog the author binds against — describeApp().metrics
//  via useMetricCatalog() (the runner-identical view) — and renders it as prose. Metric
//  authoring stays behind the Steward lens; the author path stays metric-first and clean.
//
//  ── Accessibility (WCAG 2.1 AA · Law 9) ───────────────────────────────────────
//  A labelled region; focus lands here on mount (the destination the author navigated
//  INTO); each catalog family is a <section> with a heading and a <ul>/<li> list; a
//  labelled search filters governed nouns; empty/idle/error states are informative
//  text, never a crash. All chrome strings are bilingual (ka/en) — no hardcoded leak.

const T = {
  intro: {
    en: 'The governed data model — the metrics, dimensions and sources you compose with. This is a read-only dictionary; defining the model is the Steward’s workspace.',
    ka: 'მართული მონაცემთა მოდელი — მეტრიკები, განზომილებები და წყაროები, რომლებითაც აწყობთ. ეს არის მხოლოდ-წასაკითხი ცნობარი; მოდელის განსაზღვრა სტიუარდის სამუშაო სივრცეა.',
  },
  search:     { en: 'Search the data model', ka: 'მოძებნე მონაცემთა მოდელში' },
  metrics:    { en: 'Metrics',    ka: 'მეტრიკები' },
  dimensions: { en: 'Dimensions', ka: 'განზომილებები' },
  sources:    { en: 'Sources',    ka: 'წყაროები' },
  calculated: { en: 'Calculated', ka: 'გამოთვლადი' },
  method:     { en: 'Methodology', ka: 'მეთოდოლოგია' },
  ungrouped:  { en: 'Other',      ka: 'სხვა' },
  idle:       { en: 'Loading the catalog…', ka: 'კატალოგი იტვირთება…' },
  empty:      { en: 'No governed metrics are registered yet.', ka: 'მართული მეტრიკები ჯერ არ არის რეგისტრირებული.' },
  noMatch:    { en: 'Nothing matches', ka: 'ვერაფერი მოიძებნა' },
  count:      { en: 'defined', ka: 'განსაზღვრული' },
  metricsIn:  { en: 'metrics', ka: 'მეტრიკა' },
} as const
const tr = (k: keyof typeof T, locale: Locale) => T[k][locale] ?? T[k].en

const UNGROUPED = '—'

/** A metric flattened for read-only display + search. Pure derivation. */
interface MetricRow {
  id:          string
  label:       string
  unit:        string
  format?:     string
  code:        string
  calculated:  boolean
  description?: string
  methodology?: string
  group:       string
  haystack:    string
}

function metricCode(def: MetricDef): string {
  if (def.calc) return ''
  if (def.code == null) return ''
  return Array.isArray(def.code) ? def.code.join(', ') : def.code
}

function buildMetricGroups(
  metrics: Record<string, MetricDef>,
  locale: Locale,
  query: string,
): { group: string; rows: MetricRow[] }[] {
  const q = query.trim().toLowerCase()
  const rows: MetricRow[] = Object.entries(metrics)
    .map(([id, def]) => {
      const label = readCatalogLabel(def.label, locale, id)
      const unit  = def.unit ? readCatalogLabel(def.unit, locale, '') : ''
      const code  = metricCode(def)
      const description = def.description ? readCatalogLabel(def.description, locale, '') : undefined
      return {
        id,
        label,
        unit,
        format: def.format,
        code,
        calculated: Boolean(def.calc),
        description,
        methodology: def.methodology,
        group: def.dataSource ?? UNGROUPED,
        haystack: `${label} ${unit} ${id} ${code} ${def.dataSource ?? ''}`.toLowerCase(),
      }
    })
    .filter((r) => (q ? r.haystack.includes(q) : true))
    .sort((a, b) => a.id.localeCompare(b.id))

  const byGroup = new Map<string, MetricRow[]>()
  for (const r of rows) {
    const bucket = byGroup.get(r.group) ?? []
    bucket.push(r)
    byGroup.set(r.group, bucket)
  }
  return [...byGroup.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, groupRows]) => ({ group, rows: groupRows }))
}

interface DimRow { id: string; label: string; code: string; conceptRole?: string; haystack: string }

function buildDimensions(
  dimensions: Record<string, CatalogDimension>,
  locale: Locale,
  query: string,
): DimRow[] {
  const q = query.trim().toLowerCase()
  return Object.entries(dimensions)
    .map(([id, def]) => {
      const label = readCatalogLabel(def.label, locale, def.code)
      return { id, label, code: def.code, conceptRole: def.conceptRole, haystack: `${label} ${id} ${def.code} ${def.conceptRole ?? ''}`.toLowerCase() }
    })
    .filter((d) => (q ? d.haystack.includes(q) : true))
    .sort((a, b) => a.id.localeCompare(b.id))
}

export function DataDictionarySurface({ locale }: { locale: Locale }) {
  const catalog = useMetricCatalog()
  const [query, setQuery] = useState('')
  const searchId = useId()

  // Focus lands in the destination on mount (WCAG 2.1 AA · 2.4.3) — the author
  // navigated INTO this screen; put keyboard/AT focus where the content is.
  const regionRef = useRef<HTMLDivElement>(null)
  useEffect(() => { regionRef.current?.focus() }, [])

  const metricGroups = useMemo(
    () => (catalog.status === 'ready' ? buildMetricGroups(catalog.metrics, locale, query) : []),
    [catalog, locale, query],
  )
  const dimensions = useMemo(
    () => (catalog.status === 'ready' ? buildDimensions(catalog.dimensions, locale, query) : []),
    [catalog, locale, query],
  )

  const totalMetrics = catalog.status === 'ready' ? Object.keys(catalog.metrics).length : 0

  const statusHint =
    catalog.status === 'idle'  ? tr('idle', locale)
    : catalog.status === 'error' ? `${tr('empty', locale)} (${catalog.message})`
    : totalMetrics === 0 ? tr('empty', locale)
    : null

  const en = locale === 'en'

  return (
    <Box
      ref={regionRef}
      tabIndex={-1}
      role="region"
      aria-label={en ? 'Data dictionary' : 'მონაცემთა ცნობარი'}
      data-testid="data-dictionary"
      sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, outline: 'none', maxWidth: 880 }}
    >
      <Typography variant="body2" color="text.secondary">{tr('intro', locale)}</Typography>

      <TextField
        id={searchId}
        size="small"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={tr('search', locale)}
        label={tr('search', locale)}
        disabled={catalog.status !== 'ready' || totalMetrics === 0}
        sx={{ maxWidth: 420 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
          ),
        }}
      />

      {statusHint && (
        <Typography variant="caption" color="text.secondary" data-testid="data-dictionary-status">
          {statusHint}
        </Typography>
      )}

      {catalog.status === 'ready' && totalMetrics > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* ── Data flow — the pipeline, made visible (AR-49 M4.3 · Move 3) ──────
              The SAME projection the Steward's Model home renders, in its READ-ONLY
              lens (no `onOpenMetric`): the non-modeler SEES source → dataset/spec →
              metric → used-by. This subsumes the old standalone "Sources" chip list
              (sources are now the flow's origin column) — one pipeline concept, one
              surface, two lenses (SPEC §3.3). Shares this view's search query. */}
          <DataFlowMap locale={locale} query={query} />

          {/* ── Metrics — grouped by source; each a read-only definition ────────── */}
          <Box component="section" aria-label={tr('metrics', locale)} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <SectionHeading icon={<HubOutlinedIcon fontSize="small" />} text={`${tr('metrics', locale)} · ${totalMetrics} ${tr('count', locale)}`} />
            {metricGroups.length === 0 && (
              <Typography variant="caption" color="text.secondary">{tr('noMatch', locale)}: „{query}“</Typography>
            )}
            {metricGroups.map(({ group, rows }) => (
              <Box key={group} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  {group === UNGROUPED ? tr('ungrouped', locale) : group}
                </Typography>
                <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {rows.map((r) => (
                    <li key={r.id}>
                      <Box
                        data-testid={`dict-metric-${r.id}`}
                        sx={{
                          border: '1px solid', borderColor: 'divider', borderRadius: 1,
                          p: 1, display: 'flex', flexDirection: 'column', gap: 0.25,
                          bgcolor: 'background.paper',
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
                          <Typography variant="body2" fontWeight={600}>{r.label}</Typography>
                          {r.unit && <Typography variant="caption" color="text.secondary">{r.unit}</Typography>}
                          {r.calculated && <Chip size="small" label={tr('calculated', locale)} sx={{ height: 18 }} />}
                        </Box>
                        {r.description && (
                          <Typography variant="caption" color="text.secondary">{r.description}</Typography>
                        )}
                        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 0.25 }}>
                          <Meta k="id" v={r.id} />
                          {r.code && <Meta k="code" v={r.code} />}
                          {r.format && <Meta k="format" v={r.format} />}
                          {r.methodology && (
                            <Link href={r.methodology} target="_blank" rel="noreferrer" variant="caption">
                              {tr('method', locale)}
                            </Link>
                          )}
                        </Box>
                      </Box>
                    </li>
                  ))}
                </Box>
              </Box>
            ))}
          </Box>

          {/* ── Dimensions — the governed axes (read-only) ─────────────────────── */}
          {dimensions.length > 0 && (
            <>
              <Divider flexItem />
              <Box component="section" aria-label={tr('dimensions', locale)} sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                <SectionHeading icon={<CategoryOutlinedIcon fontSize="small" />} text={`${tr('dimensions', locale)} · ${dimensions.length} ${tr('count', locale)}`} />
                <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {dimensions.map((d) => (
                    <li key={d.id}>
                      <Box
                        data-testid={`dict-dimension-${d.id}`}
                        sx={{
                          border: '1px solid', borderColor: 'divider', borderRadius: 1,
                          p: 1, display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap',
                          bgcolor: 'background.paper',
                        }}
                      >
                        <Typography variant="body2" fontWeight={600}>{d.label}</Typography>
                        <Meta k="id" v={d.id} />
                        <Meta k="code" v={d.code} />
                        {d.conceptRole && <Meta k="role" v={d.conceptRole} />}
                      </Box>
                    </li>
                  ))}
                </Box>
              </Box>
            </>
          )}
        </Box>
      )}
    </Box>
  )
}

function SectionHeading({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      <Box sx={{ color: 'primary.main', display: 'inline-flex' }}>{icon}</Box>
      <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.4 }}>{text}</Typography>
    </Box>
  )
}

/** A read-only key·value metadata chip pair (monospace value for ids/codes). */
function Meta({ k, v }: { k: string; v: string }) {
  return (
    <Typography variant="caption" color="text.secondary">
      <Box component="span" sx={{ opacity: 0.7 }}>{k}: </Box>
      <Box component="span" sx={{ fontFamily: 'monospace' }}>{v}</Box>
    </Typography>
  )
}
