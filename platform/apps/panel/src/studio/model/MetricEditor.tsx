// ── MetricEditor — the in-tool "define a governed metric" form (M2.2 headline) ──
//
//  AR-49 M2.2 (spec §4). The Steward's non-programmer "define" surface: PICK a
//  dataset + a real SDMX measure from the live cube profile (unit auto-fills), set
//  governance (bilingual label · unit · format · default-dim pins · methodology),
//  and commit — the output is a PURE ManifestMetric (Law 2), byte-identical to a
//  provisioned one. All PICK, never type a code (Law 2 extended to definition).
//
//  Governance integrity (spec §6): the id is IMMUTABLE on edit (FF-ID-IMMUTABLE);
//  the draft is validated against the LIVE cube profile before Save enables
//  (FF-CATALOG-EDIT-SAFE, validateMetric); the manager surfaces the blast radius.
//
//  M3.0 (spec §3): the calc / measure-algebra (derived metric) editor is now LIVE.
//  A "how to define" toggle chooses BASE (pick a dataset measure) vs CALCULATED
//  (compose from other governed metrics via CalcBuilder). A calc metric carries
//  `calc` INSTEAD of `code`; the governance form (id/label/unit/format/methodology/
//  description) is shared. Output is a pure ManifestMetric{calc} the LIVE runtime
//  resolves through the unchanged resolveMeasureRef/resolveMetricValue seam.
//
//  GOVERNANCE (M2.2 close, AR-49): `agg` (default cross-time aggregation) and
//  `description` (bilingual info-affordance) are now carried end to end — the wire
//  contract (ManifestMetric) mirrors them, registerManifestMetrics refines them onto
//  MetricDef, and both surface below. The agg picker is enum-driven off the engine's
//  METRIC_AGG_VALUES SSOT (Law 8 — a new aggregation is a new option with zero code).
//  Absent ⇒ current behavior (Postel). NOTE: metric-level `agg` is governance-only
//  metadata today — resolved through resolveMeasureRef but not yet read by an
//  interpreter; authoring it records the steward's intent for when it is consumed.
//
//  Accessibility (WCAG 2.1 AA, Law 9): every control is labelled; the immutable id
//  states why; validation issues render in a labelled list wired to the form.
//
import { useEffect, useMemo, useState } from 'react'
import {
  Box, Stack, TextField, MenuItem, Button, Typography, Alert,
  FormControl, InputLabel, Select, FormLabel, FormHelperText, IconButton, Divider,
  ToggleButtonGroup, ToggleButton,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import type { ManifestMetric } from '@statdash/contracts'
import { METRIC_AGG_VALUES } from '@statdash/engine'
import type { Locale } from '../../types/constructor'
import { cubeApi, type CubeDatasetRow, type CubeProfile } from '../../lib/cubeApi'
import { useCubeProfileStore } from '../../discovery/cubeProfile.store'
import { readLocale, writeLocale, type LocaleStringValue } from '../../inspector/localeString'
import {
  formatKeyOptions, draftFromMeasure, unitNeedsAttention,
} from './metricDraft'
import { validateMetric, isSaveable, type MetricIssue } from './metricValidation'
import { emptyCalc } from './metricCalc'
import { CalcBuilder } from './CalcBuilder'

export interface MetricEditorProps {
  /** The metric to edit, or null to author a NEW one. */
  initial:       ManifestMetric | null
  /** All catalog metric ids (create-uniqueness check). */
  existingIds:   string[]
  /**
   * The full governed-metric catalog — the operand universe for a CALCULATED metric
   * (M3.0). Optional: absent ⇒ base-metric authoring only (byte-identical M2.2 path).
   */
  catalogMetrics?: ManifestMetric[]
  /** Active locales — drives bilingual inputs + label completeness. */
  locales:       Locale[]
  /** The locale for single-locale UI copy. */
  locale:        Locale
  /** Commit the validated metric to the working copy (manager persists + refreshes). */
  onSave:        (metric: ManifestMetric) => void
  /** Abandon the edit. */
  onCancel:      () => void
}

const EMPTY_LABEL: Record<string, string> = {}

/** One bilingual LocaleString input group — reuses the localeString completeness SSOT. */
function LocaleInputs({
  legend, value, locales, onChange, idBase,
}: {
  legend:   string
  value:    LocaleStringValue
  locales:  Locale[]
  onChange: (next: Record<string, string>) => void
  idBase:   string
}) {
  return (
    <FormControl component="fieldset" variant="standard" sx={{ display: 'block' }}>
      <FormLabel component="legend" sx={{ fontSize: 12 }}>{legend}</FormLabel>
      <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
        {locales.map((loc) => (
          <TextField
            key={loc}
            id={`${idBase}-${loc}`}
            size="small"
            label={loc}
            value={readLocale(value, loc)}
            onChange={(e) => onChange(writeLocale(value, loc, e.target.value, locales))}
            sx={{ flex: 1 }}
          />
        ))}
      </Stack>
    </FormControl>
  )
}

export function MetricEditor({
  initial, existingIds, catalogMetrics = [], locales, locale, onSave, onCancel,
}: MetricEditorProps) {
  const en = locale === 'en'
  const isNew = initial === null

  // Working draft — controlled local state, committed only on Save.
  const [draft, setDraft] = useState<ManifestMetric>(
    () => initial ?? { id: '', label: EMPTY_LABEL },
  )

  // Dataset list (pick, never type — Law 2). Same public surface source authoring uses.
  const [datasets, setDatasets] = useState<CubeDatasetRow[] | null>(null)
  useEffect(() => {
    let alive = true
    cubeApi.datasets()
      .then((rows) => { if (alive) setDatasets(rows) })
      .catch(() => { if (alive) setDatasets([]) })
    return () => { alive = false }
  }, [])

  // Live cube profile for the chosen dataset (Identity-Map cached). Drives the
  // measure + dimension pickers AND the boundary validation.
  const ensureProfile = useCubeProfileStore((s) => s.ensure)
  const profileEntry  = useCubeProfileStore((s) => (draft.dataSource ? s.byCode[draft.dataSource] : undefined))
  useEffect(() => { if (draft.dataSource) ensureProfile(draft.dataSource) }, [draft.dataSource, ensureProfile])
  const profile = profileEntry?.status === 'ready' ? profileEntry.profile : null

  const set = (patch: Partial<ManifestMetric>) => setDraft((d) => ({ ...d, ...patch }))

  // Pick a dataset — clears the measure (a code is dataset-scoped).
  const onPickDataset = (code: string) => set({ dataSource: code, code: undefined })

  // Pick a measure — derive code + pre-fill unit (+ seed label if still blank).
  const onPickMeasure = (measureCode: string) => {
    const measure = profile?.measures.find((m) => m.code === measureCode)
    if (!measure || !draft.dataSource) { set({ code: measureCode }); return }
    const seed = draftFromMeasure(draft.dataSource, measure, locales)
    setDraft((d) => ({
      ...d,
      code: measure.code,
      unit: seed.unit,
      // Only seed the label if the steward has not authored one yet.
      label: hasAnyLabel(d.label) ? d.label : seed.label,
    }))
  }

  const chosenMeasure = profile?.measures.find((m) => m.code === (typeof draft.code === 'string' ? draft.code : undefined))
  const unitWarn = chosenMeasure ? unitNeedsAttention(chosenMeasure.unit) : false

  const isCalc = draft.calc !== undefined

  const issues: MetricIssue[] = useMemo(
    () => validateMetric(draft, {
      profile,
      existingIds: isNew ? existingIds : existingIds.filter((id) => id !== initial?.id),
      isNew,
      activeLocales: locales,
      catalogMetrics,
    }),
    [draft, profile, existingIds, isNew, initial, locales, catalogMetrics],
  )
  const saveable = isSaveable(issues)

  // Switch the "how to define" mode — a calc metric carries `calc` INSTEAD of `code`
  // (exactly one — MetricDef XOR). Switching to CALC drops the base measure picks;
  // switching to BASE drops the algebra. Non-destructive within a mode (kept on toggle).
  const setDefineMode = (mode: 'base' | 'calc') => {
    if (mode === 'calc') {
      setDraft((d) => {
        const { code: _code, dataSource: _ds, ...rest } = d
        return { ...rest, calc: d.calc ?? emptyCalc() }
      })
    } else {
      setDraft((d) => {
        const { calc: _calc, ...rest } = d
        return rest
      })
    }
  }

  const formatChoices = useMemo(() => formatKeyOptions(), [])

  return (
    <Box component="form" onSubmit={(e) => { e.preventDefault(); if (saveable) onSave(draft) }}
      aria-label={en ? 'Metric editor' : 'მეტრიკის რედაქტორი'}
      sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>

      {/* id — IMMUTABLE once created (FF-ID-IMMUTABLE); stored refs bind by id. */}
      <TextField
        size="small"
        label={en ? 'Metric id (immutable)' : 'იდენტიფიკატორი (უცვლელი)'}
        value={draft.id}
        onChange={(e) => set({ id: e.target.value })}
        disabled={!isNew}
        required
        helperText={
          isNew
            ? (en ? 'Lowercase letters, digits, underscore. Cannot change after creation.'
                  : 'პატარა ასოები, ციფრები, ქვედა ხაზი. შექმნის შემდეგ ვერ შეიცვლება.')
            : (en ? 'The id is immutable — rename via a new metric + rebind.'
                  : 'იდენტიფიკატორი უცვლელია — გადაარქვით ახალი მეტრიკით.')
        }
      />

      {/* how to define — BASE (dataset measure) vs CALCULATED (measure-algebra). */}
      <FormControl component="fieldset" variant="standard" sx={{ display: 'block' }}>
        <FormLabel component="legend" sx={{ fontSize: 12 }}>
          {en ? 'How to define' : 'როგორ განისაზღვროს'}
        </FormLabel>
        <ToggleButtonGroup
          size="small" exclusive sx={{ mt: 0.5 }}
          value={isCalc ? 'calc' : 'base'}
          onChange={(_, v) => { if (v) setDefineMode(v) }}
          aria-label={en ? 'Definition mode' : 'განსაზღვრის რეჟიმი'}
        >
          <ToggleButton value="base">{en ? 'From a dataset measure' : 'მონაცემთა საზომიდან'}</ToggleButton>
          <ToggleButton value="calc">{en ? 'Calculated (from other metrics)' : 'გამოთვლადი (სხვა მეტრიკებიდან)'}</ToggleButton>
        </ToggleButtonGroup>
      </FormControl>

      {/* ── CALCULATED metric — the visual measure-algebra builder (M3.0) ── */}
      {isCalc && draft.calc && (
        <CalcBuilder
          calc={draft.calc}
          catalogMetrics={catalogMetrics}
          selfId={draft.id}
          locale={locale}
          onChange={(calc) => set({ calc })}
        />
      )}

      {/* ── BASE metric — dataset + measure pickers (hidden for a calc metric) ── */}
      {!isCalc && (<>
      {/* dataset → dataSource (auto). */}
      <FormControl size="small" fullWidth disabled={datasets === null}>
        <InputLabel id="me-dataset">{en ? 'Dataset (cube)' : 'მონაცემთა ნაკრები (კუბი)'}</InputLabel>
        <Select
          labelId="me-dataset"
          label={en ? 'Dataset (cube)' : 'მონაცემთა ნაკრები (კუბი)'}
          value={draft.dataSource ?? ''}
          onChange={(e) => onPickDataset(e.target.value)}
        >
          {(datasets ?? []).map((d) => (
            <MenuItem key={d.code} value={d.code}>{d.label} ({d.code})</MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* measure → code (+ unit pre-fill). */}
      <FormControl size="small" fullWidth disabled={!draft.dataSource || profileEntry?.status !== 'ready'}>
        <InputLabel id="me-measure">{en ? 'Measure' : 'საზომი'}</InputLabel>
        <Select
          labelId="me-measure"
          label={en ? 'Measure' : 'საზომი'}
          value={typeof draft.code === 'string' ? draft.code : ''}
          onChange={(e) => onPickMeasure(e.target.value)}
        >
          {(profile?.measures ?? []).map((m) => (
            <MenuItem key={m.code} value={m.code}>
              {m.label[locale] ?? m.label['en'] ?? m.code} ({m.code})
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {draft.dataSource && profileEntry?.status === 'loading' && (
        <Typography variant="caption" color="text.secondary">{en ? 'Loading cube profile…' : 'იტვირთება კუბის პროფილი…'}</Typography>
      )}
      {draft.dataSource && profileEntry?.status === 'error' && (
        <Alert severity="warning" variant="outlined">{en ? 'Cube profile unavailable — validation is limited.' : 'კუბის პროფილი მიუწვდომელია — ვალიდაცია შეზღუდულია.'}</Alert>
      )}
      </>)}

      <Divider flexItem />

      {/* label — required bilingual. */}
      <LocaleInputs
        legend={en ? 'Label (required)' : 'დასახელება (სავალდებულო)'}
        value={draft.label}
        locales={locales}
        onChange={(label) => set({ label })}
        idBase="me-label"
      />

      {/* unit — pre-filled from the measure's resolved unit; warn on source:'none'. */}
      <LocaleInputs
        legend={en ? 'Unit' : 'ერთეული'}
        value={draft.unit}
        locales={locales}
        onChange={(unit) => set({ unit })}
        idBase="me-unit"
      />
      {unitWarn && (
        <Alert severity="info" variant="outlined">
          {en ? 'This measure has no resolved unit — please supply one.' : 'ამ საზომს არ აქვს განსაზღვრული ერთეული — გთხოვთ მიუთითოთ.'}
        </Alert>
      )}

      {/* format — enum over the LIVE formatter registry (Law 8, zero-code extend). */}
      <FormControl size="small" fullWidth>
        <InputLabel id="me-format">{en ? 'Display format' : 'ჩვენების ფორმატი'}</InputLabel>
        <Select
          labelId="me-format"
          label={en ? 'Display format' : 'ჩვენების ფორმატი'}
          value={draft.format ?? ''}
          onChange={(e) => set({ format: e.target.value || undefined })}
        >
          <MenuItem value=""><em>{en ? 'None' : 'არცერთი'}</em></MenuItem>
          {formatChoices.map((f) => (<MenuItem key={f} value={f}>{f}</MenuItem>))}
        </Select>
      </FormControl>

      {/* agg — default cross-time aggregation; enum over METRIC_AGG_VALUES (Law 8, no hardcode).
          UI-HONESTY (AR-49 M2 QC): the value is carried-not-consumed today (see file-header
          note) — an honest, non-alarming caption says so, wired via aria-describedby so
          screen-reader users get the same disclosure as sighted stewards. */}
      <FormControl size="small" fullWidth>
        <InputLabel id="me-agg">{en ? 'Default aggregation' : 'ნაგულისხმევი აგრეგაცია'}</InputLabel>
        <Select
          labelId="me-agg"
          label={en ? 'Default aggregation' : 'ნაგულისხმევი აგრეგაცია'}
          value={draft.agg ?? ''}
          aria-describedby="me-agg-help"
          onChange={(e) => set({ agg: (e.target.value || undefined) as ManifestMetric['agg'] })}
        >
          <MenuItem value=""><em>{en ? 'None' : 'არცერთი'}</em></MenuItem>
          {METRIC_AGG_VALUES.map((a) => (<MenuItem key={a} value={a}>{a}</MenuItem>))}
        </Select>
        <FormHelperText id="me-agg-help">
          {en
            ? 'Recorded as governance metadata — not yet applied to charts/KPIs.'
            : 'აღირიცხება როგორც მმართველობის მეტამონაცემი — გრაფიკებზე/KPI-ზე ჯერ არ მოქმედებს.'}
        </FormHelperText>
      </FormControl>

      {/* methodology — provenance ref (flows to the methodology badge, Law 9). */}
      <TextField
        size="small"
        type="url"
        label={en ? 'Methodology URL' : 'მეთოდოლოგიის URL'}
        value={draft.methodology ?? ''}
        onChange={(e) => set({ methodology: e.target.value || undefined })}
        placeholder="https://…"
      />

      {/* description — longer bilingual info-affordance (LocaleString, Law 4). */}
      <LocaleInputs
        legend={en ? 'Description' : 'აღწერა'}
        value={draft.description}
        locales={locales}
        onChange={(description) => set({ description: hasAnyLabel(description) ? description : undefined })}
        idBase="me-description"
      />

      {/* default-dim pins — governed Record<dim, member> (Law 1 generic, no privileged
          dim). BASE-metric only: a calc metric's coordinate pins live per-operand
          (MetricInput.at), so a metric-level default-dims picker would confuse here. */}
      {!isCalc && (
        <DefaultDimPins
          draft={draft}
          profile={profile}
          locale={locale}
          onChange={(dims) => set({ dims })}
        />
      )}

      {/* validation issues — surfaced, wired to the form (a11y). */}
      {issues.length > 0 && (
        <Box component="ul" aria-label={en ? 'Validation' : 'ვალიდაცია'}
          sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {issues.map((iss, i) => (
            <li key={i}>
              <Alert severity={iss.severity} variant="outlined">{iss.message[locale] ?? iss.message.en}</Alert>
            </li>
          ))}
        </Box>
      )}

      <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
        <Button type="submit" variant="contained" size="small" disabled={!saveable}>
          {en ? (isNew ? 'Create metric' : 'Save changes') : (isNew ? 'მეტრიკის შექმნა' : 'ცვლილებების შენახვა')}
        </Button>
        <Button type="button" variant="text" size="small" onClick={onCancel}>
          {en ? 'Cancel' : 'გაუქმება'}
        </Button>
      </Stack>
    </Box>
  )
}

function hasAnyLabel(label: LocaleStringValue): boolean {
  if (!label) return false
  if (typeof label === 'string') return label.trim().length > 0
  return Object.values(label).some((v) => v.trim().length > 0)
}

// ── Default-dim pins — pick a dimension + member from the live profile (Law 1) ──
function DefaultDimPins({
  draft, profile, locale, onChange,
}: {
  draft:    ManifestMetric
  profile:  CubeProfile | null
  locale:   Locale
  onChange: (dims: Record<string, unknown> | undefined) => void
}) {
  const en = locale === 'en'
  const dims = (draft.dims ?? {}) as Record<string, unknown>
  const entries = Object.entries(dims)
  const [newDim, setNewDim] = useState('')
  const [newMember, setNewMember] = useState('')

  const dimList = profile?.dimensions ?? []
  const membersOf = (dimCode: string) => dimList.find((d) => d.code === dimCode)?.members ?? []

  const add = () => {
    if (!newDim || !newMember) return
    onChange({ ...dims, [newDim]: newMember })
    setNewDim(''); setNewMember('')
  }
  const remove = (dimCode: string) => {
    const next = { ...dims }
    delete next[dimCode]
    onChange(Object.keys(next).length > 0 ? next : undefined)
  }

  return (
    <Box>
      <FormLabel component="legend" sx={{ fontSize: 12 }}>
        {en ? 'Default dimension pins' : 'ნაგულისხმევი განზომილებები'}
      </FormLabel>
      <Stack spacing={0.5} sx={{ mt: 0.5 }}>
        {entries.map(([dimCode, member]) => (
          <Stack key={dimCode} direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" sx={{ flex: 1 }}>{dimCode} = {String(member)}</Typography>
            <IconButton size="small" aria-label={`${en ? 'Remove pin' : 'წაშლა'} ${dimCode}`} onClick={() => remove(dimCode)}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Stack>
        ))}
        {profile && (
          <Stack direction="row" spacing={1} alignItems="center">
            <FormControl size="small" sx={{ flex: 1 }}>
              <InputLabel id="me-newdim">{en ? 'Dimension' : 'განზომილება'}</InputLabel>
              <Select labelId="me-newdim" label={en ? 'Dimension' : 'განზომილება'} value={newDim}
                onChange={(e) => { setNewDim(e.target.value); setNewMember('') }}>
                {dimList.map((d) => (<MenuItem key={d.code} value={d.code}>{d.code}</MenuItem>))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ flex: 1 }} disabled={!newDim}>
              <InputLabel id="me-newmember">{en ? 'Member' : 'წევრი'}</InputLabel>
              <Select labelId="me-newmember" label={en ? 'Member' : 'წევრი'} value={newMember}
                onChange={(e) => setNewMember(e.target.value)}>
                {membersOf(newDim).map((m) => (
                  <MenuItem key={m.code} value={m.code}>{m.label[locale] ?? m.code} ({m.code})</MenuItem>
                ))}
              </Select>
            </FormControl>
            <IconButton size="small" aria-label={en ? 'Add pin' : 'დამატება'} onClick={add} disabled={!newDim || !newMember}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Stack>
        )}
      </Stack>
    </Box>
  )
}
