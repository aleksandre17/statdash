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
import { DEFAULT_PAGE_TYPE } from '../../canvas/canvasPageAdapter'
import { PageStatusBadge } from './PageStatusBadge'
import { TemplateGallery } from '../templates'
import { useActiveLocales } from '../../inspector/useActiveLocales'
import type { Locale } from '../../types/constructor'

export interface PageBrowserProps {
  open:    boolean
  onClose: () => void
}

// Bilingual chrome strings (Law 4 — `ka` is the panel's primary authoring locale,
// following the local-map + t() pattern the studio chrome uses (RightDock/FocusView)).
const T = {
  pages:        { ka: 'გვერდები',                                 en: 'Pages' },
  noPages:      { ka: 'ჯერ გვერდი არ არის — შექმენით ერთი დასაწყებად.', en: 'No pages yet — create one to start.' },
  fromTemplate: { ka: 'შაბლონიდან',                               en: 'From template' },
  blankPage:    { ka: 'ცარიელი გვერდი',                           en: 'Blank page' },
  titleKa:      { ka: 'სათაური (ka)',                             en: 'Title (ka)' },
  titleEn:      { ka: 'სათაური (en)',                             en: 'Title (en)' },
  newTitleKa:   { ka: 'ახალი გვერდის სათაური (ka)',               en: 'New page title (ka)' },
  newTitleEn:   { ka: 'ახალი გვერდის სათაური (en)',               en: 'New page title (en)' },
  create:       { ka: 'შექმნა',                                   en: 'Create' },
  cancel:       { ka: 'გაუქმება',                                 en: 'Cancel' },
  close:        { ka: 'დახურვა',                                  en: 'Close' },
  titleReq:     { ka: 'სათაური (ka) სავალდებულოა',                en: 'Title (ka) is required' },
  slugErr:      { ka: 'სათაურიდან სწორი slug ვერ გამოვიდა',       en: 'Could not derive a valid slug from the title' },
  createFailed: { ka: 'შექმნა ვერ მოხერხდა',                      en: 'Create failed' },
} as const
const t = (k: keyof typeof T, locale: Locale) => T[k][locale] ?? T[k].en

// Derive a url-safe slug from a free-text title (server requires ^[a-z0-9-]+$).
function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

// Display a page path with exactly ONE leading slash — a stored slug may or may not
// already carry one, so `/${slug}` double-slashed ('//regional') for some rows and
// stayed single ('/landing') for others. Normalize both to a single '/'.
function pagePath(slug: string): string {
  return '/' + slug.replace(/^\/+/, '')
}

export function PageBrowser({ open, onClose }: PageBrowserProps) {
  const pages     = usePages()
  const locale    = useActiveLocales()[0] ?? 'ka'
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
    if (!titleKa.trim()) { setError(t('titleReq', locale)); return }
    const slug = slugify(titleEn || titleKa)
    if (!slug) { setError(t('slugErr', locale)); return }
    setBusy(true)
    setError(null)
    try {
      const page = await createPage({
        // A blank page starts as the default kind — the author can retype it via
        // the page Inspector once page-kind authoring lands (never a hidden default).
        type:    DEFAULT_PAGE_TYPE,
        title:   { ka: titleKa.trim(), en: (titleEn || titleKa).trim() },
        slug,
        nodeIds: [],
        nodes:   {},
      })
      useConstructorStore.getState().setActivePage(page.id)
      setTitleKa(''); setTitleEn(''); setCreating(false)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('createFailed', locale))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth aria-labelledby="page-browser-title">
      <DialogTitle id="page-browser-title">{t('pages', locale)}</DialogTitle>
      <DialogContent dividers>
        {pages.length === 0 ? (
          <Box sx={{ py: 2, color: 'text.secondary' }}>{t('noPages', locale)}</Box>
        ) : (
          <List dense data-testid="page-browser-list">
            {pages.map((p) => (
              <ListItemButton key={p.id} onClick={() => handleOpen(p.id)} disabled={busy} data-testid={`page-row-${p.id}`}>
                <ListItemText primary={p.title[locale] || p.title.ka || p.slug} secondary={pagePath(p.slug)} />
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
              {t('fromTemplate', locale)}
            </Button>
            {/* Blank page — the escape hatch for an author who wants an empty canvas. */}
            <Button startIcon={<AddIcon />} onClick={() => { setCreating(true); setError(null) }} data-testid="new-page-toggle">
              {t('blankPage', locale)}
            </Button>
          </Stack>
        ) : (
          <Stack spacing={2} data-testid="new-page-form">
            <TextField label={t('titleKa', locale)} value={titleKa} size="small" required
              onChange={(e) => setTitleKa(e.target.value)} inputProps={{ 'aria-label': t('newTitleKa', locale) }} />
            <TextField label={t('titleEn', locale)} value={titleEn} size="small"
              onChange={(e) => setTitleEn(e.target.value)} inputProps={{ 'aria-label': t('newTitleEn', locale) }} />
            {error && <Alert severity="error">{error}</Alert>}
            <Stack direction="row" spacing={1}>
              <Button variant="contained" onClick={handleCreate} disabled={busy} data-testid="create-page-confirm">{t('create', locale)}</Button>
              <Button onClick={() => { setCreating(false); setError(null) }} disabled={busy}>{t('cancel', locale)}</Button>
            </Stack>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('close', locale)}</Button>
      </DialogActions>

      {/* Templates-first gallery — picking/generating a page closes both dialogs
          (createFromTemplate has already set the new page active). */}
      <TemplateGallery open={gallery} onClose={() => setGallery(false)} onCreated={onClose} />
    </Dialog>
  )
}
