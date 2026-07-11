// ── MetricSpecEditor — type=metric: the metric-first SemanticQuery author pane [AR-50 M-SQ] ─
//
//  The authoring surface for the `metric` DataSpec discriminant — the METRIC-FIRST
//  author path made visual. Where every OTHER DataSpec editor binds at the physical
//  code/ObsQuery level, this one composes GOVERNED NOUNS: the author PICKS one+ governed
//  metrics (from the same catalog MetricPalette/EnumRefField bind against — no fork) and
//  chooses a GRAIN (generic `by` dims + a first-class `time` affordance), optionally
//  pinning `where` coordinates. It emits a pure-data MetricSpec; the engine's
//  MetricResolver LOWERS it onto the M2 grain algebra (calc metrics re-derive at grain,
//  SNA-correct). This is Constructor-simple: pick nouns, never write a query (Law 2).
//
//  ── Governed, not raw (FF-AUTHOR-NO-QUERY line) ────────────────────────────────
//  The metric/dim pickers read the GOVERNED catalog (useMetricCatalog → describeApp),
//  the runner-identical registry view. Composing governed nouns IS the author path; this
//  pane pulls in NONE of the raw modeler machinery (QuerySpecEditor/TransformEditor/…).
//  freeSolo is the MetricRef escape hatch only (a raw code stays typeable — the union
//  documents "metric-id OR raw code"), governed picks are the primary, first-class path.
//
//  ── Law 1 (no privileged dims) ─────────────────────────────────────────────────
//  `by` is a generic multi-dim picker. `time` is the FIRST-CLASS time affordance, but its
//  axis `dim` is a SELECTABLE dimension (defaulting to the TIME_DIM SSOT convention, never
//  a hardcoded special-case) — grain = by ⊕ time.dim, exactly as the resolver computes it.
//
//  ── Law 9 (a11y + i18n) ────────────────────────────────────────────────────────
//  Every control is labelled + keyboard-operable (MUI Autocomplete/Switch). Strings are
//  bilingual (ka/en), driven by the session's primary active locale (useActiveLocales) —
//  no hardcoded single-locale leak. Empty/idle/error catalog degrades to a hint + freeSolo
//  entry, never a crash.
//
import { useMemo, useState } from 'react'
import {
  Autocomplete, Box, Button, FormControlLabel, IconButton, Switch,
  TextField, Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import type { DataSpec, DimVal } from '@statdash/engine'
import { TIME_DIM } from '@statdash/engine'
import { useMetricCatalog } from '../../../discovery/useMetricCatalog'
import { metricOptions, dimensionOptions } from '../../../discovery/semanticCatalogOptions'
import { useActiveLocales } from '../../../inspector/useActiveLocales'
import { YearsField } from './YearsField'

type MetricSpec = Extract<DataSpec, { type: 'metric' }>

export interface MetricSpecEditorProps {
  value:    MetricSpec
  onChange: (next: MetricSpec) => void
}

/** A where-pin as an ordered editable row (Object key order is not authorable UI). */
interface PinRow { dim: string; value: string }

/** Coerce a typed pin value: a finite numeric string → number, else the raw string. */
function coercePin(raw: string): DimVal {
  const t = raw.trim()
  if (t === '') return ''
  const n = Number(t)
  return Number.isFinite(n) && t === String(n) ? n : t
}

export function MetricSpecEditor({ value, onChange }: MetricSpecEditorProps) {
  const locale = useActiveLocales()[0] ?? 'ka'
  const en = locale === 'en'
  const catalog = useMetricCatalog()

  // ── Governed vocabulary (no fork — the runner-identical registry view) ──────────
  const ready = catalog.status === 'ready'
  const metricOpts = useMemo(
    () => (ready ? metricOptions(catalog.metrics, locale) : []),
    [ready, catalog, locale],
  )
  const dimOpts = useMemo(
    () => (ready ? dimensionOptions(catalog.dimensions, locale) : []),
    [ready, catalog, locale],
  )
  const metricIds = useMemo(() => metricOpts.map((o) => o.value), [metricOpts])
  const dimIds    = useMemo(() => dimOpts.map((o) => o.value), [dimOpts])
  const metricLabel = useMemo(() => new Map(metricOpts.map((o) => [o.value, o.label])), [metricOpts])
  const dimLabel    = useMemo(() => new Map(dimOpts.map((o) => [o.value, o.label])), [dimOpts])

  // Time-axis dim options: the governed dims plus the TIME_DIM convention (so the
  // author can always express "over time" even before a time dim is catalogued).
  const timeDimIds = useMemo(
    () => (dimIds.includes(TIME_DIM) ? dimIds : [TIME_DIM, ...dimIds]),
    [dimIds],
  )

  // ── Emit helpers — always a CLEAN MetricSpec (empty optionals omitted) ─────────
  const setMetrics = (metrics: string[]) => onChange({ ...value, metrics })

  const setBy = (by: string[]) => {
    const next = { ...value }
    if (by.length > 0) next.by = by
    else delete next.by
    onChange(next)
  }

  const timeOn = value.time != null
  const timeDim = value.time?.dim ?? TIME_DIM

  const toggleTime = (on: boolean) => {
    const next = { ...value }
    if (on) next.time = { dim: timeDim, ...(value.time ?? {}) }
    else delete next.time
    onChange(next)
  }

  const setTimeDim = (dim: string) =>
    onChange({ ...value, time: { ...(value.time ?? {}), dim: dim || TIME_DIM } })

  const setTimeRange = (years: readonly number[] | 'all') => {
    const td = { ...(value.time ?? { dim: timeDim }) }
    if (years === 'all') delete td.range
    else td.range = years
    onChange({ ...value, time: td })
  }

  // where ↔ ordered pin rows. Pins are LOCAL editing state: a Record<string,DimVal>
  // cannot hold an in-progress empty-dim row (no key), so the rows live here and only
  // the COMPLETE (non-empty-dim) pins are projected into the emitted `where` (Law 2 —
  // pure data out). Seeded once from value.where (round-trips a hand-authored spec).
  const [pins, setPinsState] = useState<PinRow[]>(
    () => Object.entries(value.where ?? {}).map(([dim, v]) => ({ dim, value: String(v ?? '') })),
  )
  const setPins = (rows: PinRow[]) => {
    setPinsState(rows)
    const next = { ...value }
    const where: Record<string, DimVal> = {}
    for (const r of rows) if (r.dim.trim() !== '') where[r.dim.trim()] = coercePin(r.value)
    if (Object.keys(where).length > 0) next.where = where
    else delete next.where
    onChange(next)
  }
  const addPin    = () => setPins([...pins, { dim: '', value: '' }])
  const removePin = (i: number) => setPins(pins.filter((_p, idx) => idx !== i))
  const updatePin = (i: number, patch: Partial<PinRow>) =>
    setPins(pins.map((p, idx) => (idx === i ? { ...p, ...patch } : p)))

  const catalogHint =
    catalog.status === 'idle'  ? (en ? 'Catalog loading…' : 'კატალოგი იტვირთება…')
    : catalog.status === 'error' ? (en ? 'Catalog unavailable — you can still type ids' : 'კატალოგი მიუწვდომელია — id-ს აკრეფა მაინც შეიძლება')
    : metricIds.length === 0    ? (en ? 'No governed metrics registered — type a metric id' : 'მართული მეტრიკები არ არის — აკრიფეთ id')
    : null

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* ── Metrics (required) — the governed noun picker ───────────────────────── */}
      <Box>
        <Autocomplete
          multiple
          freeSolo
          size="small"
          options={metricIds}
          value={value.metrics}
          onChange={(_e, v) => setMetrics(v as string[])}
          getOptionLabel={(id) => metricLabel.get(id) ?? id}
          renderInput={(params) => (
            <TextField
              {...params}
              label={en ? 'Metrics (governed)' : 'მეტრიკები (მართული)'}
              placeholder={en ? 'Pick a governed metric…' : 'აირჩიეთ მართული მეტრიკა…'}
              helperText={
                catalogHint ??
                (en ? 'One governed series per metric — re-derived at the chosen grain'
                    : 'თითო მართული სერია მეტრიკაზე — გადაითვლება არჩეულ grain-ზე')
              }
            />
          )}
        />
      </Box>

      {/* ── Grain: by dims (generic — Law 1) ────────────────────────────────────── */}
      <Box>
        <Autocomplete
          multiple
          freeSolo
          size="small"
          options={dimIds}
          value={value.by ?? []}
          onChange={(_e, v) => setBy(v as string[])}
          getOptionLabel={(id) => dimLabel.get(id) ?? id}
          renderInput={(params) => (
            <TextField
              {...params}
              label={en ? 'Group by (grain)' : 'დაჯგუფება (grain)'}
              placeholder={en ? 'Add a grain dimension…' : 'დაამატეთ grain-განზომილება…'}
              helperText={
                en ? 'Generic grain axes — one row per distinct tuple. Empty ⇒ a scalar per metric.'
                   : 'გენერიკ grain-ღერძები — თითო სტრიქონი უნიკალურ კომბინაციაზე. ცარიელი ⇒ სკალარი.'
              }
            />
          )}
        />
      </Box>

      {/* ── First-class time affordance (its dim is selectable — Law 1) ─────────── */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <FormControlLabel
          control={<Switch checked={timeOn} onChange={(e) => toggleTime(e.target.checked)} />}
          label={en ? 'Over time' : 'დროის მიხედვით'}
        />
        {timeOn && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pl: 1 }}>
            <Autocomplete
              freeSolo
              size="small"
              options={timeDimIds}
              value={timeDim}
              onChange={(_e, v) => setTimeDim((v as string) ?? TIME_DIM)}
              onInputChange={(_e, v, reason) => { if (reason === 'input') setTimeDim(v) }}
              getOptionLabel={(id) => dimLabel.get(id) ?? id}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={en ? 'Time axis dimension' : 'დროის ღერძის განზომილება'}
                  helperText={
                    en ? 'The grain axis that carries time (joins the grain).'
                       : 'grain-ის ღერძი, რომელიც დროს ატარებს.'
                  }
                />
              )}
            />
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                {en ? 'Time range (years)' : 'დროის დიაპაზონი (წლები)'}
              </Typography>
              <YearsField
                value={
                  Array.isArray(value.time?.range)
                    ? (value.time!.range as readonly number[])
                    : 'all'
                }
                onChange={setTimeRange}
              />
            </Box>
          </Box>
        )}
      </Box>

      {/* ── where pins (generic coordinate narrowing — Law 1) ───────────────────── */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {en ? 'Filter pins (where — optional)' : 'ფილტრი (where — არჩევითი)'}
        </Typography>
        {pins.map((pin, i) => (
          <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Autocomplete
              freeSolo
              size="small"
              sx={{ width: 180 }}
              options={dimIds}
              value={pin.dim}
              onChange={(_e, v) => updatePin(i, { dim: (v as string) ?? '' })}
              onInputChange={(_e, v, reason) => { if (reason === 'input') updatePin(i, { dim: v }) }}
              getOptionLabel={(id) => dimLabel.get(id) ?? id}
              renderInput={(params) => (
                <TextField {...params} label={en ? 'Dimension' : 'განზომილება'} />
              )}
            />
            <TextField
              size="small"
              label={en ? 'Pinned value' : 'დაფიქსირებული მნიშვნელობა'}
              value={pin.value}
              onChange={(e) => updatePin(i, { value: e.target.value })}
              sx={{ flex: 1 }}
            />
            <IconButton
              size="small"
              aria-label={en ? `Remove pin ${i + 1}` : `ფილტრის წაშლა ${i + 1}`}
              onClick={() => removePin(i)}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        ))}
        <Box>
          <Button size="small" startIcon={<AddIcon />} onClick={addPin}>
            {en ? 'Add pin' : 'ფილტრის დამატება'}
          </Button>
        </Box>
      </Box>
    </Box>
  )
}
