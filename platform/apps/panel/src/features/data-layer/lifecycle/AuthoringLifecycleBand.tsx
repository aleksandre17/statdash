// ── AuthoringLifecycleBand — draft → publish → history, ONE band (C3) ──────────────
//
//  The Authoring Lifecycle chrome (DESIGN-0104 §2·C3): the amber draft chip that the
//  retired authoring-hold GRADUATED into, plus the explicit Publish / Discard actions
//  and the revision History door. ONE component, placed by declaration in both zooms
//  (lifecycleBandPlacement) — never hand-mounted per host.
//
//  Honest states only (Law 11 — «the canvas never lies»): the chip counts REAL
//  unpublished changes; Publish drives the VALIDATED PUT and a 422 renders its
//  `violations[]` AT-field in Georgian (never a toast-and-swallow); a restore refused
//  for lack of admin says so honestly (403 → «admin required»), never a fake success.
//
//  Draft/publish state is read reactively from the two lifecycle stores; the actions are
//  the api-action thunks (the same component-calls-thunk idiom the panel already uses).
//
import { useCallback, useState } from 'react'
import {
  Box, Chip, Button, Collapse, Typography, CircularProgress, Alert, Divider,
} from '@mui/material'
import HistoryIcon from '@mui/icons-material/History'
import PublishIcon from '@mui/icons-material/Publish'
import UndoIcon from '@mui/icons-material/Undo'
import RestoreIcon from '@mui/icons-material/Restore'
import type { RevisionSummary, ConfigViolation } from '@statdash/contracts'
import { useDataSpecDraft } from '../../../store/dataSpecDraft.store'
import { useDataSpecPublish } from '../../../store/dataSpecPublish.store'
import {
  publishDataSpec, discardDataSpec, fetchDataSpecRevisions, restoreDataSpecRevision,
} from '../../../store/api-actions'
import { isAdminHint } from '../../../lib/auth'
import type { Locale } from '../../../types/constructor'

export interface AuthoringLifecycleBandProps {
  /** The stored DataSpec id (config.data_spec) this lifecycle governs. */
  docId:  string
  locale: Locale
  /** Compact zoom (browser row): chip + inline Publish/Discard, no History door. */
  dense?: boolean
}

/** Georgian/English label for each referential validation class (C3 · ADR-052 §4). */
function checkLabel(check: ConfigViolation['check'], en: boolean): string {
  switch (check) {
    case 'shape':           return en ? 'shape'            : 'სტრუქტურა'
    case 'dataset-exists':  return en ? 'dataset missing'  : 'ნაკრები არ არსებობს'
    case 'dims-subset':     return en ? 'dimension'        : 'განზომილება'
    case 'metric-resolves': return en ? 'metric'           : 'მეტრიკა'
  }
}

export function AuthoringLifecycleBand({ docId, locale, dense = false }: AuthoringLifecycleBandProps) {
  const en = locale === 'en'
  const draft = useDataSpecDraft(docId)
  const pub   = useDataSpecPublish(docId)

  const changeCount = draft?.changeCount ?? 0
  const dirty       = changeCount > 0
  const publishing  = pub?.phase === 'publishing'
  const admin       = isAdminHint()

  const [historyOpen, setHistoryOpen] = useState(false)
  const [revisions, setRevisions] = useState<RevisionSummary[] | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Load the revision history EVENT-DRIVEN (on door-open + after a publish/restore that
  // appended one) — not via an effect (React: "you might not need an effect"; a fetch
  // triggered by a user action belongs in the handler, never a synchronous effect setState).
  const loadHistory = useCallback(async () => {
    setLoadingHistory(true)
    const rows = await fetchDataSpecRevisions(docId)
    // Newest-first (authoritative order is revisionNumber; createdAt is display-only).
    setRevisions([...rows].sort((a, b) => b.revisionNumber - a.revisionNumber))
    setLoadingHistory(false)
  }, [docId])

  const toggleHistory = () => {
    const next = !historyOpen
    setHistoryOpen(next)
    if (next) void loadHistory()
  }

  const publish = () => {
    void publishDataSpec(docId).then(() => { if (historyOpen) void loadHistory() })
  }
  const restore = (revId: string) => {
    void restoreDataSpecRevision(docId, revId).then(() => { if (historyOpen) void loadHistory() })
  }

  // ── The honest status line (aria-live) ─────────────────────────────────────────
  const statusText = publishing
    ? (en ? 'Publishing…' : 'ქვეყნდება…')
    : pub?.phase === 'published'
      ? (en ? 'Published' : 'გამოქვეყნებულია')
      : dirty
        ? (en ? `Draft — ${changeCount} change${changeCount === 1 ? '' : 's'}` : `მონახაზი — ${changeCount} ცვლილება`)
        : (en ? 'No unpublished changes' : 'გამოუქვეყნებელი ცვლილება არ არის')

  return (
    <Box
      role="group"
      aria-label={en ? 'Authoring lifecycle' : 'ავტორინგის სასიცოცხლო ციკლი'}
      data-testid="authoring-lifecycle-band"
      sx={{ display: 'flex', flexDirection: 'column', gap: dense ? 0.5 : 0.75, minWidth: 0 }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        {/* The chip — honest state, from the same honest-state vocabulary (Law 11 §1.5). */}
        {dirty ? (
          <Chip
            size="small" color="warning" variant="filled"
            data-testid="lifecycle-draft-chip"
            label={en ? `Draft — ${changeCount} change${changeCount === 1 ? '' : 's'}` : `მონახაზი — ${changeCount} ცვლილება`}
          />
        ) : pub?.phase === 'published' ? (
          <Chip
            size="small" color="success" variant="outlined"
            data-testid="lifecycle-published-chip"
            label={en ? 'Published' : 'გამოქვეყნებულია'}
          />
        ) : null}

        {publishing && <CircularProgress size={16} aria-hidden />}

        {/* Publish — the explicit gesture that ends the auto-save era. Any write role. */}
        <Button
          size="small" variant="contained" color="primary"
          startIcon={<PublishIcon fontSize="small" />}
          data-testid="lifecycle-publish"
          disabled={!dirty || publishing}
          onClick={publish}
        >
          {en ? 'Publish' : 'გამოქვეყნება'}
        </Button>

        {/* Discard — drop the draft, restore the published base (client-side). */}
        {dirty && (
          <Button
            size="small" variant="outlined" color="inherit"
            startIcon={<UndoIcon fontSize="small" />}
            data-testid="lifecycle-discard"
            disabled={publishing}
            onClick={() => discardDataSpec(docId)}
          >
            {en ? 'Discard' : 'გაუქმება'}
          </Button>
        )}

        {/* History door — the revision log (full zoom only; the compact row stays quiet). */}
        {!dense && (
          <Button
            size="small" variant="text" color="inherit"
            startIcon={<HistoryIcon fontSize="small" />}
            data-testid="lifecycle-history-toggle"
            aria-expanded={historyOpen}
            onClick={toggleHistory}
          >
            {en ? 'History' : 'ისტორია'}
          </Button>
        )}
      </Box>

      {/* Honest status, announced. The compact (row) zoom leans on the chip alone — the
          full head zoom carries the spelled-out, aria-live status line. */}
      {!dense && (
        <Typography
          variant="caption" color="text.secondary"
          role="status" aria-live="polite" data-testid="lifecycle-status"
        >
          {statusText}
        </Typography>
      )}

      {/* ── 422 config-invalid — the failing checks AT their fields, never swallowed ──── */}
      {pub?.phase === 'error' && pub.violations && pub.violations.length > 0 && (
        <Box
          role="alert"
          data-testid="lifecycle-violations"
          sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}
        >
          <Typography variant="caption" color="error" fontWeight={600}>
            {en
              ? `Publish rejected — ${pub.violations.length} problem${pub.violations.length === 1 ? '' : 's'} to fix:`
              : `გამოქვეყნება უარყოფილია — გამოსასწორებელია ${pub.violations.length} პრობლემა:`}
          </Typography>
          {pub.violations.map((v, i) => (
            <Alert key={i} severity="error" variant="outlined" data-testid="lifecycle-violation" sx={{ py: 0, fontSize: 12 }}>
              <Typography component="span" variant="caption" fontWeight={600}>{checkLabel(v.check, en)}</Typography>
              {v.path && (
                <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                  {v.path}
                </Typography>
              )}
              <Typography variant="caption" component="div">{v.detail}</Typography>
            </Alert>
          ))}
        </Box>
      )}

      {/* A transport / non-validation failure — honest, never fake-saved. */}
      {pub?.phase === 'error' && !pub.violations && pub.error && (
        <Alert severity="error" variant="outlined" data-testid="lifecycle-error" sx={{ py: 0, fontSize: 12 }}>
          {pub.error}
        </Alert>
      )}

      {/* A restore refused for lack of admin — honest 403, never reimplemented. */}
      {pub?.phase === 'forbidden' && (
        <Alert severity="warning" variant="outlined" data-testid="lifecycle-forbidden" sx={{ py: 0, fontSize: 12 }}>
          {en ? 'Restore needs an admin role.' : 'აღდგენას სჭირდება ადმინის უფლება.'}
        </Alert>
      )}

      {/* ── The revision history door ─────────────────────────────────────────────── */}
      {!dense && (
        <Collapse in={historyOpen} unmountOnExit>
          <Box
            data-testid="lifecycle-history"
            sx={{ mt: 0.5, border: 1, borderColor: 'divider', borderRadius: 1, p: 1, maxHeight: 260, overflow: 'auto' }}
          >
            {loadingHistory ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
                <CircularProgress size={14} aria-hidden />
                <Typography variant="caption">{en ? 'Loading history…' : 'ისტორია იტვირთება…'}</Typography>
              </Box>
            ) : revisions && revisions.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {!admin && (
                  <Typography variant="caption" color="text.secondary" data-testid="lifecycle-restore-hint">
                    {en ? 'Restore is admin-only.' : 'აღდგენა ხელმისაწვდომია მხოლოდ ადმინისთვის.'}
                  </Typography>
                )}
                {revisions.map((r, i) => (
                  <Box key={r.id}>
                    {i > 0 && <Divider sx={{ my: 0.5 }} />}
                    <Box
                      data-testid={`lifecycle-revision-${r.revisionNumber}`}
                      sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600}>
                          #{r.revisionNumber}
                          <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                            {r.actor ?? (en ? 'system' : 'სისტემა')}
                          </Typography>
                        </Typography>
                        <Typography variant="caption" color="text.secondary" component="div">
                          {new Date(r.createdAt).toLocaleString(en ? 'en' : 'ka')}
                          {r.note ? ` · ${r.note}` : ''}
                          {r.restoredFrom ? (en ? ' · restored' : ' · აღდგენილი') : ''}
                        </Typography>
                      </Box>
                      <Button
                        size="small" variant="outlined" color="inherit"
                        startIcon={<RestoreIcon fontSize="small" />}
                        data-testid={`lifecycle-restore-${r.revisionNumber}`}
                        disabled={!admin || publishing}
                        onClick={() => restore(r.id)}
                      >
                        {en ? 'Restore' : 'აღდგენა'}
                      </Button>
                    </Box>
                  </Box>
                ))}
              </Box>
            ) : (
              <Typography variant="caption" color="text.secondary">
                {en ? 'No revisions yet.' : 'ჯერ არ არის რევიზიები.'}
              </Typography>
            )}
          </Box>
        </Collapse>
      )}
    </Box>
  )
}
