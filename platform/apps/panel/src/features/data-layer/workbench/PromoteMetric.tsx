// ── PromoteMetric — the raw→governed promotion loop (0084 §2 · E2) ─────────────
//
//  ADR-046 E2 · SPEC §9 (the Looker/dbt/Superset promotion path): a workbench whose head
//  is a RAW/steward read can be PROMOTED into the governed semantic layer — the author
//  proposes a governed metric from the shaped read (id · bilingual name · unit), the steward
//  metric-definition seam blesses it, and the head is REPLACED by the governed ref. This is
//  the loop that FEEDS the semantic layer (raw work is strong, but its destiny is a governed
//  fact reusable across pages — Floor 2, ADR-046).
//
//  ── REUSE, no new pipeline (0084 mandate) ──────────────────────────────────────
//  The definition seam is the EXISTING one: draftFromMeasure (unit pre-fill) → the
//  semanticCatalog working copy (upsertMetric) → saveSemanticCatalog (PUT + register +
//  palette invalidate). We do NOT re-roll a metric pipeline. On a blessed save the head is
//  replaced by `{op:'source', metrics:[id]}` (promoteHeadToMetric) — byte-identical to the
//  raw head it replaced (FF-PROMOTE-ROUNDTRIP: a governed BASE metric whose `code` = the raw
//  head's measure browses IDENTICALLY to the steward obs read).
//
//  SAFE-SAVE: the working copy is HYDRATED (ensure) before upsert — saving an un-hydrated
//  copy would PUT only the new metric and wipe the catalog. Promotion gates on 'ready'.
//
//  Steward-lens only (the raw head can only exist behind the steward lens). WCAG (Law 9):
//  a labelled disclosure, labelled bilingual inputs, save state announced, errors inline.
//
import { useEffect, useMemo, useState } from 'react'
import {
  Box, Button, Stack, TextField, Typography, Alert, FormControl, FormLabel, Collapse,
} from '@mui/material'
import UpgradeIcon from '@mui/icons-material/Upgrade'
import type { ManifestMetric } from '@statdash/contracts'
import type { Locale } from '../../../types/constructor'
import { useDataSources } from '../../../store/constructor.store'
import { useActiveProfile, profileOrNull } from '../../../discovery/useActiveProfile'
import { pickActiveDatasetCode } from '../../../discovery/cubeProfile.store'
import { readLocale, writeLocale, type LocaleStringValue } from '../../../inspector/localeString'
import { unitToLocaleString, isValidMetricId, slugifyMetricId } from '../../../studio/model/metricDraft'
import { useSemanticCatalogStore } from '../../../studio/model/semanticCatalog.store'
import { saveSemanticCatalog } from '../../../studio/model/saveSemanticCatalog'

export interface PromoteMetricProps {
  /** The raw head's measure code being promoted (the governed metric's `code`). */
  measure:    string
  /** Active locales — drives the bilingual name/unit inputs + completeness. */
  locales:    Locale[]
  /** The locale for single-locale UI copy. */
  locale:     Locale
  /** Called with the blessed metric id once the catalog save succeeds — replace the head. */
  onPromoted: (metricId: string) => void
}

function hasAnyLabel(v: LocaleStringValue): boolean {
  if (!v) return false
  if (typeof v === 'string') return v.trim().length > 0
  return Object.values(v).some((s) => s.trim().length > 0)
}

/** One bilingual LocaleString input group (mirrors MetricEditor's LocaleInputs, DRY). */
function LocaleInputs({ legend, value, locales, onChange, idBase }: {
  legend: string; value: LocaleStringValue; locales: Locale[]
  onChange: (next: Record<string, string>) => void; idBase: string
}) {
  return (
    <FormControl component="fieldset" variant="standard" sx={{ display: 'block' }}>
      <FormLabel component="legend" sx={{ fontSize: 12 }}>{legend}</FormLabel>
      <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
        {locales.map((loc) => (
          <TextField
            key={loc} id={`${idBase}-${loc}`} size="small" label={loc}
            value={readLocale(value, loc)}
            onChange={(e) => onChange(writeLocale(value, loc, e.target.value, locales))}
            sx={{ flex: 1 }}
          />
        ))}
      </Stack>
    </FormControl>
  )
}

export function PromoteMetric({ measure, locales, locale, onPromoted }: PromoteMetricProps) {
  const en = locale === 'en'
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The governed home of the raw read: the active dataset (the browse reads the page store).
  const sources     = useDataSources()
  const datasetCode = pickActiveDatasetCode(sources)
  const activeProf  = useActiveProfile()
  const profile     = profileOrNull(activeProf)

  // Hydrate the editable catalog BEFORE any save (safe-save — never wipe the catalog).
  const ensure   = useSemanticCatalogStore((s) => s.ensure)
  const catStatus = useSemanticCatalogStore((s) => s.status)
  // Select the STABLE list ref (a mapping selector returns a fresh array each render →
  // getSnapshot uncached → infinite loop). Derive the id set here instead.
  const catMetrics = useSemanticCatalogStore((s) => s.metrics)
  const existingIds = useMemo(() => catMetrics.map((m) => m.id), [catMetrics])
  useEffect(() => { if (open) ensure() }, [open, ensure])

  // Pre-fill the unit from the raw measure's resolved unit (pick, never type — Law 2).
  const measureDef = profile?.measures.find((m) => m.code === measure)
  const seedUnit = useMemo(
    () => (measureDef ? unitToLocaleString(measureDef.unit, locales) : {}),
    [measureDef, locales],
  )
  const seedLabel = useMemo<Record<string, string>>(
    () => (measureDef ? { ...measureDef.label } : {}),
    [measureDef],
  )

  const [id, setId] = useState('')
  const [label, setLabel] = useState<Record<string, string>>({})
  const [unit, setUnit] = useState<Record<string, string>>({})

  // The EFFECTIVE values: the steward's own edits, else the measure's seed (pre-fill from
  // the resolved unit/label — pick, never type). Derived, not synced via an effect (the seed
  // resolves async; a setState-in-effect would cascade renders). The steward's first edit
  // wins; writeLocale over the seed keeps the other locale pre-filled.
  const effLabel = hasAnyLabel(label) ? label : seedLabel
  const effUnit  = hasAnyLabel(unit)  ? unit  : seedUnit

  const idTaken   = existingIds.includes(id)
  const idValid   = isValidMetricId(id)
  const nameOk    = hasAnyLabel(effLabel)
  const ready     = catStatus === 'ready'
  const canSave   = ready && idValid && !idTaken && nameOk && !saving

  const submit = async () => {
    if (!canSave) return
    setSaving(true); setError(null)
    const metric: ManifestMetric = {
      id,
      code: measure,
      ...(datasetCode ? { dataSource: datasetCode } : {}),
      label: effLabel,
      ...(hasAnyLabel(effUnit) ? { unit: effUnit } : {}),
    }
    // Reuse the definition seam: working-copy upsert → PUT + register + palette invalidate.
    useSemanticCatalogStore.getState().upsertMetric(metric)
    const res = await saveSemanticCatalog()
    setSaving(false)
    if (res.ok) { setOpen(false); onPromoted(id) }
    else setError(res.forbidden
      ? (en ? 'A catalog-authoring permission is required.' : 'საჭიროა კატალოგის რედაქტირების უფლება.')
      : (res.error ?? (en ? 'Promotion failed.' : 'დაწინაურება ვერ მოხერხდა.')))
  }

  return (
    <Box data-testid="promote-metric" sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      <Button
        size="small"
        variant="outlined"
        startIcon={<UpgradeIcon />}
        data-testid="promote-metric-open"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        sx={{ alignSelf: 'flex-start' }}
      >
        {en ? 'Promote to a governed metric' : 'მეტრიკად დაწინაურება'}
      </Button>

      <Collapse in={open} unmountOnExit>
        <Box
          component="form"
          aria-label={en ? 'Promote to metric' : 'მეტრიკად დაწინაურება'}
          onSubmit={(e) => { e.preventDefault(); void submit() }}
          sx={{ display: 'flex', flexDirection: 'column', gap: 1, p: 1, border: 1, borderColor: 'divider', borderRadius: 1 }}
        >
          <Typography variant="caption" color="text.secondary">
            {en
              ? `From the raw read of “${measure}”. Give it a governed name — it becomes a reusable metric.`
              : `ნედლი წყაროდან „${measure}“. მიეცით მართული სახელი — გახდება მრავალჯერ გამოსაყენებელი მეტრიკა.`}
          </Typography>

          <TextField
            size="small"
            label={en ? 'Metric id (immutable)' : 'იდენტიფიკატორი (უცვლელი)'}
            value={id}
            onChange={(e) => setId(slugifyMetricId(e.target.value))}
            required
            error={id.length > 0 && (!idValid || idTaken)}
            helperText={
              idTaken ? (en ? 'This id already exists.' : 'ეს იდენტიფიკატორი უკვე არსებობს.')
              : (en ? 'Lowercase letters, digits, underscore.' : 'პატარა ასოები, ციფრები, ქვედა ხაზი.')
            }
            data-testid="promote-id"
          />

          <LocaleInputs
            legend={en ? 'Name (required)' : 'სახელი (სავალდებულო)'}
            value={effLabel} locales={locales} idBase="promote-label"
            onChange={setLabel}
          />
          <LocaleInputs
            legend={en ? 'Unit' : 'ერთეული'}
            value={effUnit} locales={locales} idBase="promote-unit"
            onChange={setUnit}
          />

          {!ready && catStatus !== 'error' && (
            <Typography variant="caption" color="text.secondary">
              {en ? 'Loading the catalog…' : 'იტვირთება კატალოგი…'}
            </Typography>
          )}
          {catStatus === 'error' && (
            <Alert severity="warning" variant="outlined">
              {en ? 'The governed catalog is unavailable — promotion is disabled.' : 'მართული კატალოგი მიუწვდომელია — დაწინაურება გათიშულია.'}
            </Alert>
          )}
          {error && <Alert severity="error" variant="outlined">{error}</Alert>}

          <Stack direction="row" spacing={1}>
            <Button type="submit" size="small" variant="contained" disabled={!canSave} data-testid="promote-submit">
              {saving ? (en ? 'Promoting…' : 'მიმდინარეობს…') : (en ? 'Promote' : 'დაწინაურება')}
            </Button>
            <Button type="button" size="small" variant="text" onClick={() => setOpen(false)}>
              {en ? 'Cancel' : 'გაუქმება'}
            </Button>
          </Stack>
        </Box>
      </Collapse>
    </Box>
  )
}
