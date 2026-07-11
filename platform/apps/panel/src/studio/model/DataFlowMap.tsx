// ── DataFlowMap — the Data-Flow Spine, made VISIBLE (AR-49 M4.3 · Move 3) ───────
//
//  The owner's repeated grievance: "pipelines STILL not visible". The modeling
//  machinery is rich but buried behind the Model lens, so a non-modeler could never
//  SEE how a number reaches a panel. This component is the fix: a legible, left-to-
//  right FLOW MAP — `source → dataset/spec → metric → used-by` — that makes the
//  pipeline a first-class, prominent artifact (the Grafana/Observable standard:
//  the pipeline is visible at the point of use, never an admin dead-end).
//
//  It is a pure PROJECTION (Law 2, `FF-FLOWMAP-IS-PROJECTION`): every node is read
//  from registries we already own — the governed catalog (`useMetricCatalog` →
//  describeApp), the Layer-1 DataSource registry (kind/status badges), and the
//  loaded pages via `computeMetricImpact` (the used-by reverse index — the SAME seam
//  the metric editor's governance banner uses, so the two can never disagree). No new
//  stored graph, no second truth. `projectDataFlow` is the pure read-model behind it.
//
//  ── Two lenses, ONE surface (SPEC §3.3) ────────────────────────────────────────
//  Interactive (steward): a metric node is a button → `onOpenMetric(id)` opens its
//  editor in place (never a dead end). Read-only (author): the SAME map, no callbacks,
//  no actionable controls — the non-modeler still SEES the flow. Visibility ≠
//  editability: the M3 honesty boundary holds (FF-AUTHOR-NO-QUERY) — this component
//  references NONE of the raw query/pivot/transform machinery.
//
//  ── Accessibility + data integrity (WCAG 2.1 AA · Law 9) ───────────────────────
//  A labelled region; each source is a <section> with a heading; each flow is a list
//  item; provenance rides as TEXT badges (unit · agency/methodology · calc ·
//  additivity), never colour-only. Arrows are decorative (aria-hidden). Idle/empty/
//  error states are informative text, never a crash. All chrome strings bilingual.
//  (Runtime provenance — preliminary / last-updated — is data-time, not catalog-time,
//  so it is NOT fabricated here; it belongs on the rendered panel's integrity badge.)
//
import { useMemo } from 'react'
import { Box, Typography, Chip, Tooltip, Link, Button } from '@mui/material'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined'
import HubOutlinedIcon from '@mui/icons-material/HubOutlined'
import FunctionsOutlinedIcon from '@mui/icons-material/FunctionsOutlined'
import type { Locale } from '../../types/constructor'
import { usePages } from '../../store/constructor.selectors'
import { useDataSources } from '../../store/constructor.selectors'
import { useMetricCatalog } from '../../discovery/useMetricCatalog'
import { nodeSchemaSource } from '../../inspector/schemaSource'
import { projectDataFlow, type FlowMetricNode, type FlowSourceGroup } from './dataFlow'

const T = {
  title:      { en: 'Data flow', ka: 'მონაცემთა ნაკადი' },
  intro:      { en: 'How every governed number reaches a panel — source to metric to where it is used. Projected live from the data model; nothing is stored twice.', ka: 'როგორ აღწევს ყოველი მართული რიცხვი პანელამდე — წყაროდან მეტრიკამდე და სად გამოიყენება. ცოცხლად აგებულია მონაცემთა მოდელიდან.' },
  colSource:  { en: 'Source',       ka: 'წყარო' },
  colSpec:    { en: 'Data · spec',  ka: 'მონაცემი · სპეც' },
  colMetric:  { en: 'Metric',       ka: 'მეტრიკა' },
  colUsedBy:  { en: 'Used by',      ka: 'გამოყენება' },
  unsourced:  { en: 'No source declared', ka: 'წყარო არ არის მითითებული' },
  metrics:    { en: 'metrics',      ka: 'მეტრიკა' },
  derived:    { en: 'derived',      ka: 'გამოთვლადი' },
  method:     { en: 'methodology',  ka: 'მეთოდოლოგია' },
  usedByN:    { en: 'used by',      ka: 'იყენებს' },
  blocks:     { en: 'blocks',       ka: 'ბლოკი' },
  onPages:    { en: 'pages',        ka: 'გვერდი' },
  notUsed:    { en: 'not yet used', ka: 'ჯერ არ გამოიყენება' },
  open:       { en: 'Open metric editor', ka: 'მეტრიკის რედაქტორის გახსნა' },
  idle:       { en: 'Loading the data model…', ka: 'მონაცემთა მოდელი იტვირთება…' },
  empty:      { en: 'No governed metrics are registered yet — the flow appears once the data model is defined.', ka: 'მართული მეტრიკები ჯერ არ არის — ნაკადი გამოჩნდება მოდელის განსაზღვრის შემდეგ.' },
  error:      { en: 'The data model is unavailable', ka: 'მონაცემთა მოდელი მიუწვდომელია' },
  summary:    { en: 'flow', ka: 'ნაკადი' },
} as const
const tr = (k: keyof typeof T, locale: Locale) => T[k][locale] ?? T[k].en

// The flow grid: spec → metric → used-by (the source is the group). The two `auto`
// columns hold the decorative arrows; the same template on the header + every row
// keeps the columns aligned into a genuine left-to-right pipeline.
const FLOW_COLS = 'minmax(120px, 1fr) 24px minmax(180px, 1.5fr) 24px minmax(120px, 1fr)'

export interface DataFlowMapProps {
  locale: Locale
  /**
   * Interactive lens: open a metric's editor. Present ⇒ metric nodes are buttons
   * (steward, never a dead end); ABSENT ⇒ the map is read-only (author). This ONE
   * prop is the whole lens split — same component, two projections (SPEC §3.3).
   */
  onOpenMetric?: (metricId: string) => void
  /** Optional shared search — filters the flow by metric label / id / code / source. */
  query?: string
}

export function DataFlowMap({ locale, onOpenMetric, query }: DataFlowMapProps) {
  const catalog     = useMetricCatalog()
  const pages       = usePages()
  const dataSources = useDataSources()
  const en = locale === 'en'

  const model = useMemo(() => {
    if (catalog.status !== 'ready') return null
    return projectDataFlow({
      metrics:     catalog.metrics,
      pages,
      getSchema:   nodeSchemaSource.getSchema,
      dataSources,
      locale,
      query,
    })
  }, [catalog, pages, dataSources, locale, query])

  return (
    <Box
      component="section"
      role="region"
      aria-label={tr('title', locale)}
      data-testid="data-flow-map"
      sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}
    >
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.4 }}>
          {tr('title', locale)}
        </Typography>
        {model && model.totalMetrics > 0 && (
          <Typography variant="caption" color="text.secondary" data-testid="data-flow-summary">
            {en
              ? `${model.totalMetrics} ${tr('metrics', locale)} · ${model.totalSources} ${tr('colSource', locale).toLowerCase()}(s)${model.unusedMetrics > 0 ? ` · ${model.unusedMetrics} ${tr('notUsed', locale)}` : ''}`
              : `${model.totalMetrics} ${tr('metrics', locale)} · ${model.totalSources} წყარო${model.unusedMetrics > 0 ? ` · ${model.unusedMetrics} ${tr('notUsed', locale)}` : ''}`}
          </Typography>
        )}
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 760 }}>
        {tr('intro', locale)}
      </Typography>

      {/* Fail-soft status branches — never a crash. */}
      {catalog.status === 'idle' && (
        <Typography variant="caption" color="text.secondary" data-testid="data-flow-status">{tr('idle', locale)}</Typography>
      )}
      {catalog.status === 'error' && (
        <Typography variant="caption" color="text.secondary" data-testid="data-flow-status">
          {tr('error', locale)} ({catalog.message})
        </Typography>
      )}
      {model && model.totalMetrics === 0 && (
        <Typography variant="caption" color="text.secondary" data-testid="data-flow-status">{tr('empty', locale)}</Typography>
      )}

      {model && model.totalMetrics > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {model.sources.map((source) => (
            <SourceFlowGroup
              key={source.id}
              source={source}
              locale={locale}
              onOpenMetric={onOpenMetric}
            />
          ))}
        </Box>
      )}
    </Box>
  )
}

// ── One source group: the origin header + its metric flows ──────────────────────
function SourceFlowGroup({
  source, locale, onOpenMetric,
}: { source: FlowSourceGroup; locale: Locale; onOpenMetric?: (id: string) => void }) {
  const en = locale === 'en'
  return (
    <Box
      component="section"
      aria-label={source.unsourced ? tr('unsourced', locale) : source.id}
      data-testid={`flow-source-${source.id}`}
      sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, overflow: 'hidden', bgcolor: 'background.paper' }}
    >
      {/* Origin header — the source node (Law 9 badges: kind + connection status). */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.25, py: 0.75, bgcolor: 'action.hover', flexWrap: 'wrap' }}>
        <StorageOutlinedIcon fontSize="small" sx={{ color: source.unsourced ? 'text.disabled' : 'primary.main' }} />
        <Typography variant="subtitle2" sx={{ fontFamily: source.unsourced ? undefined : 'monospace' }}>
          {source.unsourced ? tr('unsourced', locale) : source.id}
        </Typography>
        {source.kind && <Chip size="small" variant="outlined" label={source.kind} sx={{ height: 20 }} />}
        {source.status && source.status !== 'idle' && (
          <Chip
            size="small"
            variant="outlined"
            color={source.status === 'connected' ? 'success' : source.status === 'error' ? 'error' : 'default'}
            label={source.status}
            sx={{ height: 20 }}
          />
        )}
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" color="text.secondary">
          {source.metrics.length} {tr('metrics', locale)}
          {source.usedByBlocks > 0 && ` · ${source.usedByBlocks} ${tr('blocks', locale)}`}
        </Typography>
      </Box>

      {/* Column sub-header — aligned to the flow template. */}
      <Box
        aria-hidden
        sx={{ display: 'grid', gridTemplateColumns: FLOW_COLS, columnGap: 0.5, alignItems: 'center', px: 1.25, pt: 1, pb: 0.25 }}
      >
        <ColHead>{tr('colSpec', locale)}</ColHead>
        <span />
        <ColHead>{tr('colMetric', locale)}</ColHead>
        <span />
        <ColHead>{tr('colUsedBy', locale)}</ColHead>
      </Box>

      <Box component="ul" role="list" sx={{ listStyle: 'none', m: 0, px: 1.25, pb: 1.25, pt: 0, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {source.metrics.map((m) => (
          <Box
            component="li"
            key={m.id}
            data-testid={`flow-metric-${m.id}`}
            sx={{ display: 'grid', gridTemplateColumns: FLOW_COLS, columnGap: 0.5, alignItems: 'center' }}
          >
            {/* Data · spec cell — codes (base) or input refs (derived). */}
            <SpecCell metric={m} locale={locale} />
            <FlowArrow />
            {/* Metric cell — the governed noun + provenance badges. */}
            <MetricCell metric={m} locale={locale} onOpenMetric={onOpenMetric} />
            <FlowArrow />
            {/* Used-by cell — the blast radius (never a dead end when 0: surfaced). */}
            <UsedByCell metric={m} locale={locale} en={en} />
          </Box>
        ))}
      </Box>
    </Box>
  )
}

function ColHead({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, fontSize: 10 }}>
      {children}
    </Typography>
  )
}

function FlowArrow() {
  return (
    <Box aria-hidden sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.disabled' }}>
      <ArrowForwardIcon sx={{ fontSize: 16 }} />
    </Box>
  )
}

function SpecCell({ metric, locale }: { metric: FlowMetricNode; locale: Locale }) {
  const chips = metric.calc ? metric.calcInputs : metric.codes
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center', minWidth: 0 }}>
      {metric.calc && (
        <Tooltip title={tr('derived', locale)}>
          <FunctionsOutlinedIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
        </Tooltip>
      )}
      {chips.length === 0
        ? <Typography variant="caption" color="text.disabled">—</Typography>
        : chips.map((c, i) => (
            <Chip key={`${c}-${i}`} size="small" variant="outlined" label={c} sx={{ height: 20, fontFamily: 'monospace', maxWidth: '100%' }} />
          ))}
    </Box>
  )
}

function MetricCell({
  metric, locale, onOpenMetric,
}: { metric: FlowMetricNode; locale: Locale; onOpenMetric?: (id: string) => void }) {
  const label = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
      <HubOutlinedIcon sx={{ fontSize: 15, color: 'primary.main', flexShrink: 0 }} />
      <Typography variant="body2" fontWeight={600} noWrap title={metric.description ?? metric.label}>
        {metric.label}
      </Typography>
    </Box>
  )
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, minWidth: 0 }}>
      {onOpenMetric
        ? (
          <Button
            size="small"
            variant="text"
            onClick={() => onOpenMetric(metric.id)}
            aria-label={`${tr('open', locale)}: ${metric.label}`}
            data-testid={`flow-open-${metric.id}`}
            sx={{ justifyContent: 'flex-start', textTransform: 'none', p: 0, minWidth: 0, color: 'text.primary' }}
          >
            {label}
          </Button>
        )
        : label}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
        {metric.unit && <Typography variant="caption" color="text.secondary" noWrap>{metric.unit}</Typography>}
        {metric.calc && <Chip size="small" label={tr('derived', locale)} sx={{ height: 17, fontSize: 10 }} />}
        {metric.additivity && metric.additivity !== 'additive' && (
          <Chip size="small" variant="outlined" label={metric.additivity} sx={{ height: 17, fontSize: 10 }} />
        )}
        {metric.methodology && (
          <Link href={metric.methodology} target="_blank" rel="noreferrer" variant="caption">
            {tr('method', locale)}
          </Link>
        )}
      </Box>
    </Box>
  )
}

function UsedByCell({ metric, locale, en }: { metric: FlowMetricNode; locale: Locale; en: boolean }) {
  const { blocks, pages } = metric.usedBy
  if (blocks === 0) {
    return (
      <Tooltip title={en ? 'This metric is not referenced by any block on a loaded page.' : 'ამ მეტრიკას არცერთი ბლოკი არ იყენებს ჩატვირთულ გვერდებზე.'}>
        <Chip size="small" variant="outlined" color="warning" label={tr('notUsed', locale)} sx={{ height: 20, fontSize: 11 }} data-testid={`flow-usedby-${metric.id}`} />
      </Tooltip>
    )
  }
  const pageList = pages.map((p) => p.title).join(', ')
  return (
    <Tooltip title={pageList}>
      <Chip
        size="small"
        color="primary"
        variant="outlined"
        label={`${tr('usedByN', locale)} ${blocks} · ${pages.length} ${tr('onPages', locale)}`}
        sx={{ height: 20, fontSize: 11 }}
        data-testid={`flow-usedby-${metric.id}`}
      />
    </Tooltip>
  )
}
