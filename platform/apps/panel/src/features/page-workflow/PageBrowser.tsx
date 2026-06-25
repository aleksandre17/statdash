// ── PageBrowser — list / open / create pages (page lifecycle entry point) ─────
//
//  The Constructor's page dashboard: browse the pages the store knows (loaded
//  from GET /pages on boot), OPEN one for authoring (openPage → GET /:id hydrate),
//  or CREATE a new page (createPage → POST /pages). Each row shows the
//  server-reflected lifecycle so the author sees draft/published at a glance.
//
import { useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  List, ListItemButton, ListItemText, Divider, TextField, Box, Stack, Alert,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import WidgetsIcon from '@mui/icons-material/Widgets'
import { usePages } from '../../store/constructor.store'
import { useConstructorStore } from '../../store/constructor.store'
import { openPage, createPage } from '../../store/api-actions'
import { PageStatusBadge } from './PageStatusBadge'
import { TemplateGallery } from '../templates'

export interface PageBrowserProps {
  open:    boolean
  onClose: () => void
}

// Derive a url-safe slug from a free-text title (server requires ^[a-z0-9-]+$).
function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export function PageBrowser({ open, onClose }: PageBrowserProps) {
  const pages     = usePages()
  const lifecycle = useConstructorStore((s) => s.lifecycle)
  const [creating, setCreating] = useState(false)
  const [titleKa,  setTitleKa]  = useState('')
  const [titleEn,  setTitleEn]  = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const [busy,     setBusy]     = useState(false)
  const [gallery,  setGallery]  = useState(false)

  const handleOpen = async (id: string) => {
    setBusy(true)
    await openPage(id)
    setBusy(false)
    onClose()
  }

  const handleCreate = async () => {
    if (!titleKa.trim()) { setError('Title (ka) is required'); return }
    const slug = slugify(titleEn || titleKa)
    if (!slug) { setError('Could not derive a valid slug from the title'); return }
    setBusy(true)
    setError(null)
    try {
      const page = await createPage({
        title:   { ka: titleKa.trim(), en: (titleEn || titleKa).trim() },
        slug,
        nodeIds: [],
        nodes:   {},
      })
      useConstructorStore.getState().setActivePage(page.id)
      setTitleKa(''); setTitleEn(''); setCreating(false)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth aria-labelledby="page-browser-title">
      <DialogTitle id="page-browser-title">Pages</DialogTitle>
      <DialogContent dividers>
        {pages.length === 0 ? (
          <Box sx={{ py: 2, color: 'text.secondary' }}>No pages yet — create one to start.</Box>
        ) : (
          <List dense data-testid="page-browser-list">
            {pages.map((p) => (
              <ListItemButton key={p.id} onClick={() => handleOpen(p.id)} disabled={busy} data-testid={`page-row-${p.id}`}>
                <ListItemText primary={p.title.ka || p.slug} secondary={`/${p.slug}`} />
                <PageStatusBadge lifecycle={lifecycle[p.id] ?? null} />
              </ListItemButton>
            ))}
          </List>
        )}

        <Divider sx={{ my: 2 }} />

        {!creating ? (
          <Stack direction="row" spacing={1}>
            {/* Templates-first (ADR V7 "never start blank") — the PRIMARY path. */}
            <Button
              variant="contained" startIcon={<WidgetsIcon />}
              onClick={() => setGallery(true)} data-testid="template-gallery-open"
            >
              From template
            </Button>
            {/* Blank page — the escape hatch for an author who wants an empty canvas. */}
            <Button startIcon={<AddIcon />} onClick={() => { setCreating(true); setError(null) }} data-testid="new-page-toggle">
              Blank page
            </Button>
          </Stack>
        ) : (
          <Stack spacing={2} data-testid="new-page-form">
            <TextField label="Title (ka)" value={titleKa} size="small" required
              onChange={(e) => setTitleKa(e.target.value)} inputProps={{ 'aria-label': 'New page title (ka)' }} />
            <TextField label="Title (en)" value={titleEn} size="small"
              onChange={(e) => setTitleEn(e.target.value)} inputProps={{ 'aria-label': 'New page title (en)' }} />
            {error && <Alert severity="error">{error}</Alert>}
            <Stack direction="row" spacing={1}>
              <Button variant="contained" onClick={handleCreate} disabled={busy} data-testid="create-page-confirm">Create</Button>
              <Button onClick={() => { setCreating(false); setError(null) }} disabled={busy}>Cancel</Button>
            </Stack>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>

      {/* Templates-first gallery — picking/generating a page closes both dialogs
          (createFromTemplate has already set the new page active). */}
      <TemplateGallery open={gallery} onClose={() => setGallery(false)} onCreated={onClose} />
    </Dialog>
  )
}
