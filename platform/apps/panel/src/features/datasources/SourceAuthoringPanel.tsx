// ── SourceAuthoringPanel — ADD / TEST / BROWSE / SAVE a data source (M2) ──────
//
//  The Constructor source-authoring seam: lets a non-programmer create a live
//  data source with ZERO code change. Reuses the EXISTING infrastructure end to
//  end — no parallel system:
//    • KIND pick    → registeredKinds() from @statdash/react/engine (OCP: a new
//                     registered kind appears in the picker with no edit here).
//    • configure    → schema-driven per kind: 'static' reuses JsonDataField (V2)
//                     for the inline rows; 'stats' PICKS a cube from
//                     cubeApi.datasets() (Law 2 — never hand-type a code) + a url.
//    • TEST         → testSource(descriptor) — the kind's registered capability.
//    • BROWSE       → getSourceMetadata(descriptor) — dims/measures, normalized
//                     across kinds so this panel renders both identically.
//    • SAVE         → createDataSource / updateDataSource thunks → the EXISTING
//                     /api/config/data-sources CRUD route. A passing Test marks
//                     the source `connected` so the runner boots it.
//
//  The wire `type` ⇄ store `kind` translation is the shared SSOT
//  (typeForKind in @statdash/plugins/datasources) — not re-derived here.
//
import { useState, useMemo, useEffect } from 'react'
import {
  Box, Typography, Button, Chip, Divider, Alert, CircularProgress,
  FormControl, InputLabel, MenuItem, Select, TextField, Stack,
} from '@mui/material'
import ScienceIcon from '@mui/icons-material/Science'
import TravelExploreIcon from '@mui/icons-material/TravelExplore'
import SaveIcon from '@mui/icons-material/Save'
import {
  registeredKinds, getStoreCapabilities, getSourceMetadata, testSource,
} from '@statdash/react/engine'
import { typeForKind } from '@statdash/plugins/datasources'
import type {
  DatasourceInstanceConfig, SourceMetadata, SourceTestResult, Observation,
} from '@statdash/engine'
import { cubeApi, type CubeDatasetRow } from '../../lib/cubeApi'
import { createDataSource, updateDataSource } from '../../store/api-actions'
import type { DataSourceDef } from '../../types/constructor'
import { JsonDataField } from '../data-layer/editors/JsonDataField'

// ── Draft model — the editable form state for one source ──────────────────────
//
//  Held kind-agnostic: `name`, `kind`, `url`, and the opaque `params` (the JSONB
//  `config`). The kind-specific form writes into `params`; the descriptor +
//  persisted body are both derived from this one draft (single source of truth).
interface SourceDraft {
  name:   string
  kind:   string
  url:    string
  params: Record<string, unknown>
}

export interface SourceAuthoringPanelProps {
  /** The source being edited, or null to ADD a new one. */
  existing: DataSourceDef | null
  /** Called after a successful save (create or update) with the saved id. */
  onSaved:  (id: string) => void
}

/** The store kind a persisted source maps to (inverse of typeForKind). */
function kindOf(existing: DataSourceDef): string {
  // 'rest'→'stats', 'static'→'static' (the SSOT table). Fall back to the wire
  // type itself so an unknown type still shows *something* (fail-soft).
  return existing.type === 'rest' ? 'stats' : existing.type === 'static' ? 'static' : existing.type
}

function initialDraft(existing: DataSourceDef | null, kinds: string[]): SourceDraft {
  if (existing) {
    return { name: existing.name, kind: kindOf(existing), url: existing.url ?? '', params: existing.config ?? {} }
  }
  return { name: '', kind: kinds[0] ?? '', url: '', params: {} }
}

export function SourceAuthoringPanel({ existing, onSaved }: SourceAuthoringPanelProps) {
  // The registered kinds drive the picker (OCP). Computed once — registrations
  // are booted at app start and do not change at runtime.
  const kinds = useMemo(() => registeredKinds().filter((k) => typeForKind(k) !== undefined), [])

  // The caller keys this component on the selected source id (key={id ?? 'new'}),
  // so switching selection REMOUNTS — these initializers re-run fresh. No effect
  // re-seed needed (and none of the set-state-in-effect cascade it would cause).
  const [draft, setDraft] = useState<SourceDraft>(() => initialDraft(existing, kinds))
  const [testResult, setTestResult] = useState<SourceTestResult | null>(null)
  const [metadata, setMetadata]     = useState<SourceMetadata | null>(null)
  const [busy, setBusy]   = useState<'test' | 'browse' | 'save' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const caps = getStoreCapabilities(draft.kind)
  const canTest   = typeof caps.testConnection === 'function'
  const canBrowse = typeof caps.getMetadata === 'function'

  // The descriptor the engine capabilities understand — derived from the draft.
  const descriptor: DatasourceInstanceConfig = {
    id:     draft.name || existing?.id || 'draft',
    kind:   draft.kind,
    url:    draft.url || undefined,
    params: draft.params,
  }

  const patchDraft = (patch: Partial<SourceDraft>) => {
    setDraft((d) => ({ ...d, ...patch }))
    // A config change invalidates a prior test/browse — the author re-runs them.
    setTestResult(null)
    setMetadata(null)
  }

  const handleTest = async () => {
    setBusy('test'); setError(null)
    try {
      const res = await testSource(descriptor)
      setTestResult(res ?? { ok: false, message: 'ამ ტიპს ტესტირება არ აქვს.' })
    } catch (e) {
      setTestResult({ ok: false, message: e instanceof Error ? e.message : 'ტესტი ჩაიშალა' })
    } finally { setBusy(null) }
  }

  const handleBrowse = async () => {
    setBusy('browse'); setError(null)
    try {
      const md = await getSourceMetadata(descriptor)
      setMetadata(md ?? null)
      if (!md) setError('ამ ტიპს მეტამონაცემები არ აქვს.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'მეტამონაცემების წაკითხვა ჩაიშალა')
    } finally { setBusy(null) }
  }

  const handleSave = async () => {
    const type = typeForKind(draft.kind)
    if (!type) { setError('ამ ტიპის წყაროს შენახვა ვერ ხერხდება.'); return }
    if (!draft.name.trim()) { setError('წყაროს სახელი სავალდებულოა.'); return }
    setBusy('save'); setError(null)
    try {
      // A passing test promotes the source to `connected` so the runner boots it.
      const status = testResult?.ok ? ('connected' as const) : undefined
      if (existing) {
        await updateDataSource(existing.id, {
          name: draft.name, type, url: draft.url || undefined, config: draft.params,
          ...(status ? { status } : {}),
        })
        onSaved(existing.id)
      } else {
        const ds = await createDataSource({
          name: draft.name, type, url: draft.url || undefined, config: draft.params,
        })
        if (status) await updateDataSource(ds.id, { status })
        onSaved(ds.id)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'შენახვა ჩაიშალა')
    } finally { setBusy(null) }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h6" fontWeight={600}>
        {existing ? 'წყაროს რედაქტირება' : 'ახალი წყარო'}
      </Typography>

      {/* ── Identity + kind pick (OCP — driven by registeredKinds) ──────────── */}
      <TextField
        size="small" label="სახელი (storeKey)" value={draft.name}
        onChange={(e) => patchDraft({ name: e.target.value })}
        helperText="ამ იდენტიფიკატორით მიაბამენ გვერდები/კვანძები"
      />

      <FormControl size="small" fullWidth disabled={existing !== null}>
        <InputLabel id="src-kind-label">ტიპი (kind)</InputLabel>
        <Select
          labelId="src-kind-label" label="ტიპი (kind)" value={draft.kind}
          onChange={(e) => patchDraft({ kind: e.target.value, params: {} })}
        >
          {kinds.map((k) => (
            <MenuItem key={k} value={k}>{k}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <Divider />

      {/* ── Kind-specific config (schema-driven per kind) ──────────────────── */}
      <KindConfig
        kind={draft.kind}
        url={draft.url}
        params={draft.params}
        onUrlChange={(url) => patchDraft({ url })}
        onParamsChange={(params) => patchDraft({ params })}
      />

      <Divider />

      {/* ── Test / Browse actions ──────────────────────────────────────────── */}
      <Stack direction="row" spacing={1}>
        <Button
          size="small" variant="outlined" startIcon={<ScienceIcon />}
          disabled={!canTest || busy !== null} onClick={handleTest}
        >
          ტესტი
        </Button>
        <Button
          size="small" variant="outlined" startIcon={<TravelExploreIcon />}
          disabled={!canBrowse || busy !== null} onClick={handleBrowse}
        >
          სტრუქტურა
        </Button>
        {busy && <CircularProgress size={20} sx={{ alignSelf: 'center' }} />}
      </Stack>

      {testResult && (
        <Alert severity={testResult.ok ? 'success' : 'error'} variant="outlined">
          {testResult.message ?? (testResult.ok ? 'OK' : 'შეცდომა')}
        </Alert>
      )}

      {metadata && <MetadataView metadata={metadata} />}

      {error && <Alert severity="error" variant="outlined">{error}</Alert>}

      <Divider />

      <Button
        variant="contained" startIcon={<SaveIcon />}
        disabled={busy !== null} onClick={handleSave}
      >
        {existing ? 'განახლება' : 'შენახვა'}
      </Button>
    </Box>
  )
}

// ── KindConfig — the schema-driven, per-kind configuration body ───────────────
//
//  OCP boundary: a new kind adds a case here (or a registered config-schema in a
//  later iteration). Today the two live kinds:
//    'static' → JsonDataField (V2) over the inline `values` rows (Law 2: literal
//               values only — no functions/url/fetch).
//    'stats'  → PICK a cube (cubeApi.datasets) → datasetCode + the live url.
function KindConfig({
  kind, url, params, onUrlChange, onParamsChange,
}: {
  kind:           string
  url:            string
  params:         Record<string, unknown>
  onUrlChange:    (url: string) => void
  onParamsChange: (params: Record<string, unknown>) => void
}) {
  if (kind === 'static') {
    const values = (params.values as Observation[] | undefined) ?? []
    return (
      <JsonDataField<Observation[]>
        label="მონაცემები (inline rows)"
        hint="JSON მასივი — თითო ობიექტი ერთი დაკვირვება; გასაღებები განზომილებებია, value = საზომი"
        value={values}
        onChange={(next) => onParamsChange({ ...params, values: next })}
      />
    )
  }

  if (kind === 'stats') {
    return (
      <StatsConfig
        url={url}
        datasetCode={(params.datasetCode as string) ?? ''}
        nonTimeDims={(params.nonTimeDims as string[]) ?? []}
        onUrlChange={onUrlChange}
        onDatasetChange={(datasetCode) => onParamsChange({ ...params, datasetCode })}
      />
    )
  }

  return (
    <Typography variant="body2" color="text.disabled">
      ამ ტიპის ვიზუალური კონფიგურაცია ჯერ არ არის.
    </Typography>
  )
}

// ── StatsConfig — pick a cube (Law 2: select, never hand-type the code) ───────
function StatsConfig({
  url, datasetCode, onUrlChange, onDatasetChange,
}: {
  url:             string
  datasetCode:     string
  nonTimeDims:     string[]
  onUrlChange:     (url: string) => void
  onDatasetChange: (code: string) => void
}) {
  const [datasets, setDatasets] = useState<CubeDatasetRow[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    cubeApi.datasets()
      .then((rows) => { if (alive) setDatasets(rows) })
      .catch((e) => { if (alive) setLoadError(e instanceof Error ? e.message : 'ჩატვირთვა ვერ მოხერხდა') })
    return () => { alive = false }
  }, [])

  return (
    <Stack spacing={2}>
      <TextField
        size="small" label="API მისამართი (url)" value={url}
        onChange={(e) => onUrlChange(e.target.value)}
        placeholder="http://localhost:3001"
        helperText="ცარიელი = ნაგულისხმევი stats API"
      />

      {loadError && <Alert severity="warning" variant="outlined">{loadError}</Alert>}

      <FormControl size="small" fullWidth disabled={datasets === null && loadError === null}>
        <InputLabel id="cube-pick-label">კუბი (cube)</InputLabel>
        <Select
          labelId="cube-pick-label" label="კუბი (cube)" value={datasetCode}
          onChange={(e) => onDatasetChange(e.target.value)}
        >
          {(datasets ?? []).map((d) => (
            <MenuItem key={d.code} value={d.code}>
              {d.label} <Box component="span" sx={{ color: 'text.disabled', ml: 1 }}>({d.code})</Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Stack>
  )
}

// ── MetadataView — the BROWSE result (dims/measures, normalized per kind) ─────
function MetadataView({ metadata }: { metadata: SourceMetadata }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography variant="overline" color="text.secondary">სტრუქტურა</Typography>
      {metadata.note && (
        <Typography variant="caption" color="text.disabled">{metadata.note}</Typography>
      )}
      <Box>
        <Typography variant="caption" color="text.secondary">განზომილებები</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
          {metadata.dimensions.length === 0
            ? <Typography variant="caption" color="text.disabled">—</Typography>
            : metadata.dimensions.map((d) => (
                <Chip key={d.code} size="small" label={d.label ?? d.code} variant="outlined" />
              ))}
        </Box>
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary">საზომები</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
          {metadata.measures.length === 0
            ? <Typography variant="caption" color="text.disabled">—</Typography>
            : metadata.measures.map((m) => (
                <Chip key={m.code} size="small" color="primary" label={m.label ?? m.code} variant="outlined" />
              ))}
        </Box>
      </Box>
    </Box>
  )
}
