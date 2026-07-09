// ── MetricCatalogManager — the Steward's governed-metric list + editor host (M2.2) ─
//
//  AR-49 M2.2 (spec §3.2 region 1, §4). The "define the catalog" region of Model
//  mode: browse the governed metrics, author a new one, edit an existing one, and
//  save — closing the live loop so the Author's MetricPalette reflects it with NO
//  reload (saveSemanticCatalog → registerManifest* → palette invalidate).
//
//  Governance integrity (spec §6): editing shows the BLAST RADIUS ("N blocks across
//  M pages reference this metric") before commit; DELETE is guarded — a referenced
//  metric cannot be deleted out from under its consumers (the consumer list is
//  shown instead). The impact index is a pure read over the loaded pages
//  (metricImpact), reusing the ONE schema-driven bind-target discovery seam.
//
import { useEffect, useMemo, useState } from 'react'
import {
  Box, Stack, Button, Typography, Alert, IconButton, Paper, Divider,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import type { ManifestMetric } from '@statdash/contracts'
import type { Locale } from '../../types/constructor'
import { usePages } from '../../store/constructor.selectors'
import { nodeSchemaSource } from '../../inspector/schemaSource'
import { readCatalogLabel } from '../../discovery/semanticCatalogOptions'
import { useSemanticCatalogStore } from './semanticCatalog.store'
import { saveSemanticCatalog } from './saveSemanticCatalog'
import { computeMetricImpact } from './metricImpact'
import { MetricEditor } from './MetricEditor'

type EditState =
  | { mode: 'list' }
  | { mode: 'new' }
  | { mode: 'edit'; metric: ManifestMetric }

export function MetricCatalogManager({ locale, locales }: { locale: Locale; locales: Locale[] }) {
  const en = locale === 'en'
  const ensure     = useSemanticCatalogStore((s) => s.ensure)
  const status     = useSemanticCatalogStore((s) => s.status)
  const metrics    = useSemanticCatalogStore((s) => s.metrics)
  const upsert     = useSemanticCatalogStore((s) => s.upsertMetric)
  const remove     = useSemanticCatalogStore((s) => s.removeMetric)
  const pages      = usePages()

  useEffect(() => { ensure() }, [ensure])

  const [edit, setEdit] = useState<EditState>({ mode: 'list' })
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ severity: 'success' | 'error' | 'warning'; text: string } | null>(null)
  const [deleteGuard, setDeleteGuard] = useState<{ metric: ManifestMetric; pages: string[] } | null>(null)

  const existingIds = useMemo(() => metrics.map((m) => m.id), [metrics])

  // Blast-radius index for the currently-edited metric (pure read over pages).
  const editImpact = useMemo(() => {
    if (edit.mode !== 'edit') return null
    return computeMetricImpact(pages, edit.metric.id, nodeSchemaSource.getSchema, locale)
  }, [edit, pages, locale])

  const commit = async (metric: ManifestMetric) => {
    upsert(metric)
    setSaving(true)
    const res = await saveSemanticCatalog()
    setSaving(false)
    if (res.ok) {
      setFeedback({ severity: 'success', text: en ? `Saved "${metric.id}" — it is now in the palette.` : `შენახულია „${metric.id}“ — უკვე პალიტრაშია.` })
      setEdit({ mode: 'list' })
    } else if (res.forbidden) {
      setFeedback({ severity: 'error', text: en ? 'Not permitted to save the catalog.' : 'კატალოგის შენახვა აკრძალულია.' })
    } else {
      setFeedback({ severity: 'error', text: res.error ?? (en ? 'Save failed.' : 'შენახვა ვერ მოხერხდა.') })
    }
  }

  const requestDelete = (metric: ManifestMetric) => {
    const impact = computeMetricImpact(pages, metric.id, nodeSchemaSource.getSchema, locale)
    if (impact.blocks > 0) {
      // Delete-guard: referenced metric cannot be removed out from under consumers.
      setDeleteGuard({ metric, pages: impact.pages.map((p) => p.title) })
      return
    }
    void doDelete(metric)
  }

  const doDelete = async (metric: ManifestMetric) => {
    remove(metric.id)
    setSaving(true)
    const res = await saveSemanticCatalog()
    setSaving(false)
    setDeleteGuard(null)
    setFeedback(res.ok
      ? { severity: 'warning', text: en ? `Deleted "${metric.id}" (reload to clear it from the palette).` : `წაშლილია „${metric.id}“ (პალიტრიდან გასაქრობად გადატვირთეთ).` }
      : { severity: 'error', text: res.error ?? (en ? 'Delete failed.' : 'წაშლა ვერ მოხერხდა.') })
  }

  // ── Editor view (new / edit) ────────────────────────────────────────────────
  if (edit.mode !== 'list') {
    const initial = edit.mode === 'edit' ? edit.metric : null
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Button size="small" variant="text" onClick={() => setEdit({ mode: 'list' })} sx={{ alignSelf: 'flex-start' }}>
          {en ? '← Back to catalog' : '← კატალოგში დაბრუნება'}
        </Button>
        {editImpact && editImpact.blocks > 0 && (
          <Alert severity="info" variant="outlined">
            {en
              ? `${editImpact.blocks} block(s) across ${editImpact.pages.length} page(s) reference this metric — a governance change here re-renders them all.`
              : `${editImpact.blocks} ბლოკი ${editImpact.pages.length} გვერდზე იყენებს ამ მეტრიკას — ცვლილება ყველა მათგანს განაახლებს.`}
          </Alert>
        )}
        <MetricEditor
          initial={initial}
          existingIds={existingIds}
          catalogMetrics={metrics}
          locales={locales}
          locale={locale}
          onSave={commit}
          onCancel={() => setEdit({ mode: 'list' })}
        />
        {saving && <Typography variant="caption" color="text.secondary">{en ? 'Saving…' : 'ინახება…'}</Typography>}
      </Box>
    )
  }

  // ── List view ───────────────────────────────────────────────────────────────
  return (
    <Box component="section" aria-label={en ? 'Governed metric catalog' : 'მართული მეტრიკების კატალოგი'}
      sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="overline" color="text.secondary">
          {en ? 'Metric catalog' : 'მეტრიკების კატალოგი'}
        </Typography>
        <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => { setFeedback(null); setEdit({ mode: 'new' }) }}>
          {en ? 'New metric' : 'ახალი მეტრიკა'}
        </Button>
      </Stack>

      {feedback && <Alert severity={feedback.severity} variant="outlined" onClose={() => setFeedback(null)}>{feedback.text}</Alert>}

      {deleteGuard && (
        <Alert severity="error" variant="outlined"
          action={<Button size="small" color="inherit" onClick={() => setDeleteGuard(null)}>{en ? 'OK' : 'დახურვა'}</Button>}>
          {en
            ? `Cannot delete "${deleteGuard.metric.id}" — used on: ${deleteGuard.pages.join(', ')}. Rebind or remove those blocks first.`
            : `„${deleteGuard.metric.id}“ ვერ წაიშლება — გამოიყენება: ${deleteGuard.pages.join(', ')}. ჯერ გადააბით ან წაშალეთ ის ბლოკები.`}
        </Alert>
      )}

      {status === 'loading' && <Typography variant="caption" color="text.secondary">{en ? 'Loading catalog…' : 'კატალოგი იტვირთება…'}</Typography>}
      {status === 'error' && (
        <Alert severity="warning" variant="outlined">
          {en ? 'Catalog unavailable — you can still author against a live cube.' : 'კატალოგი მიუწვდომელია — ავტორინგი მაინც შესაძლებელია.'}
        </Alert>
      )}
      {status === 'ready' && metrics.length === 0 && (
        <Typography variant="caption" color="text.secondary">
          {en ? 'No governed metrics yet — create the first one.' : 'მართული მეტრიკები ჯერ არ არის — შექმენით პირველი.'}
        </Typography>
      )}

      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {metrics.map((m) => (
          <li key={m.id}>
            <Paper variant="outlined" sx={{ p: 0.75, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={600} noWrap>{readCatalogLabel(m.label, locale, m.id)}</Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {m.id}
                  {m.code ? ` · ${Array.isArray(m.code) ? m.code.join(', ') : m.code}` : ''}
                  {m.calc ? ` · ${en ? 'derived' : 'გამოთვლადი'}` : ''}
                </Typography>
              </Box>
              <IconButton size="small" aria-label={`${en ? 'Edit' : 'რედაქტირება'} ${m.id}`} onClick={() => { setFeedback(null); setEdit({ mode: 'edit', metric: m }) }}>
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" aria-label={`${en ? 'Delete' : 'წაშლა'} ${m.id}`} onClick={() => requestDelete(m)}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Paper>
          </li>
        ))}
      </Box>
      <Divider flexItem sx={{ mt: 0.5 }} />
    </Box>
  )
}
