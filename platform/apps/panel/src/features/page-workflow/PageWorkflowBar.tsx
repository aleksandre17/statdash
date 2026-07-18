// ── PageWorkflowBar — the draft→publish workflow toolbar (page lifecycle UI) ──
//
//  The usable end-to-end product surface over the proven author→render loop:
//    Pages   → open the PageBrowser (list / open / create)
//    Save    → guarded PUT (C5 save-guard runs BEFORE the call; blocking issues
//              render inline via SaveIssueList — shift-left, never a silent fail)
//    Publish → admin-gated POST; a 403 surfaces as a clear "needs publisher/admin"
//              state (the server FSM owns lifecycle; we only REFLECT it)
//    History → the append-only version list
//  The status badge reflects the SERVER FSM (draft/published) + the unsaved-edits
//  flag. One toolbar, registry/store-driven — no per-page-type branching.
//
import { useState } from 'react'
import { Box, Button, Stack, Alert, Snackbar } from '@mui/material'
import SaveIcon from '@mui/icons-material/Save'
import PublishIcon from '@mui/icons-material/Publish'
import HistoryIcon from '@mui/icons-material/History'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import { useActivePage } from '../../store/constructor.store'
import { usePageLifecycle, useSaveStatus, usePublishStatus } from '../../store/constructor.selectors'
import { useConstructorStore } from '../../store/constructor.store'
import { savePage, publishPage } from '../../store/api-actions'
import { PageStatusBadge } from './PageStatusBadge'
import { SaveIssueList } from './SaveIssueList'
import { PageBrowser } from './PageBrowser'
import { VersionHistoryDialog } from './VersionHistoryDialog'
import { useActiveLocales } from '../../inspector/useActiveLocales'
import type { Locale } from '../../types/constructor'

// Bilingual chrome strings (Law 4 — same local-map + t() seam as PageBrowser /
// the rest of the studio chrome; the topbar sat in English beside the Georgian
// rail, breaking WCAG 3.1.2 language-of-parts coherence).
const T = {
  pages:          { ka: 'გვერდები',            en: 'Pages' },
  history:        { ka: 'ისტორია',             en: 'History' },
  saveDraft:      { ka: 'მონახაზის შენახვა',   en: 'Save draft' },
  publish:        { ka: 'გამოქვეყნება',        en: 'Publish' },
  draftSaved:     { ka: 'მონახაზი შენახულია',  en: 'Draft saved' },
  publishForbid:  { ka: 'გამოსაქვეყნებლად უფლება არ გაქვთ. სთხოვეთ გამომქვეყნებელს ან ადმინს.', en: 'You do not have permission to publish. Ask a publisher or admin to publish this page.' },
} as const
const tt = (k: keyof typeof T, locale: Locale) => T[k][locale] ?? T[k].en

export function PageWorkflowBar() {
  const locale       = useActiveLocales()[0] ?? 'ka'
  const page         = useActivePage()
  const pageId       = page?.id ?? null
  const lifecycle    = usePageLifecycle(pageId)
  const saveStatus   = useSaveStatus(pageId)
  const publishState = usePublishStatus(pageId)
  const selectNode   = useConstructorStore((s) => s.selectNode)

  const [browserOpen, setBrowserOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [busy,        setBusy]        = useState(false)

  const handleSave = async () => {
    if (!pageId) return
    setBusy(true)
    await savePage(pageId)
    setBusy(false)
  }

  const handlePublish = async () => {
    if (!pageId) return
    setBusy(true)
    await publishPage(pageId)
    setBusy(false)
  }

  // Publish is only meaningful once a clean draft exists; a dirty page must be
  // saved first (the latest version, not the editor buffer, is what publishes).
  const canPublish = pageId != null && lifecycle != null && !lifecycle.dirty

  return (
    <Box data-testid="page-workflow-bar">
      <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
        <Button size="small" variant="outlined" startIcon={<FolderOpenIcon />}
          onClick={() => setBrowserOpen(true)} data-testid="open-pages">
          {tt('pages', locale)}
        </Button>

        <PageStatusBadge lifecycle={lifecycle} />

        <Box sx={{ flex: 1 }} />

        <Button size="small" variant="outlined" startIcon={<HistoryIcon />}
          onClick={() => setHistoryOpen(true)} disabled={!pageId} data-testid="open-history">
          {tt('history', locale)}
        </Button>
        <Button size="small" variant="contained" startIcon={<SaveIcon />}
          onClick={handleSave} disabled={!pageId || busy} data-testid="save-page">
          {tt('saveDraft', locale)}
        </Button>
        <Button size="small" variant="contained" color="success" startIcon={<PublishIcon />}
          onClick={handlePublish} disabled={!canPublish || busy} data-testid="publish-page">
          {tt('publish', locale)}
        </Button>
      </Stack>

      {/* Save-guard block: which node/field/check failed (shift-left). */}
      {saveStatus && saveStatus.issues.length > 0 && (
        <Box sx={{ mt: 1.5 }}>
          <SaveIssueList issues={saveStatus.issues} onSelectNode={selectNode} />
        </Box>
      )}

      {/* Non-guard save failure (network/server). */}
      {saveStatus?.error && (
        <Alert severity="warning" sx={{ mt: 1.5 }} data-testid="save-error">{saveStatus.error}</Alert>
      )}

      {/* Publish 403 — needs the publisher/admin role (server-owned, reflected). */}
      {publishState?.forbidden && (
        <Alert severity="warning" sx={{ mt: 1.5 }} data-testid="publish-forbidden">
          {tt('publishForbid', locale)}
        </Alert>
      )}
      {publishState && !publishState.forbidden && publishState.error && (
        <Alert severity="warning" sx={{ mt: 1.5 }} data-testid="publish-error">{publishState.error}</Alert>
      )}

      {/* Transient success affordance. */}
      <Snackbar
        open={saveStatus?.saved === true}
        autoHideDuration={2500}
        message={tt('draftSaved', locale)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />

      <PageBrowser open={browserOpen} onClose={() => setBrowserOpen(false)} />
      <VersionHistoryDialog pageId={pageId} open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </Box>
  )
}
