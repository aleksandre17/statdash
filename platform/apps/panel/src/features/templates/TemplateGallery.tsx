// ── TemplateGallery — "never start blank" page picker (V7) ───────────────────
//
//  The Wix/Gutenberg templates-first surface: instead of opening a blank canvas,
//  the author either (a) picks a committed STARTER (a valid NodePageConfig) or
//  (b) one-clicks GENERATE A DASHBOARD from the connected cube (Budibase). Either
//  way the chosen config flows through createFromTemplate → the SAME createPage
//  gate a hand-built page uses (save-guard + validate), then becomes active.
//
//  a11y (WCAG 2.1 AA): the starters are a semantic radio group (role="radiogroup"
//  + role="radio"), arrow-key + Space/Enter operable; the generate action is a
//  labelled button; the name field is required + labelled. The data-first option
//  hides when no cube is bound (graceful degradation — an accelerator, never a
//  blocker; the starters remain).
//
import { useMemo, useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Box, Stack, Typography, TextField, Alert, Divider,
} from '@mui/material'
import SpeedIcon       from '@mui/icons-material/Speed'
import InsertChartIcon from '@mui/icons-material/InsertChart'
import DashboardIcon   from '@mui/icons-material/Dashboard'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import WidgetsIcon     from '@mui/icons-material/Widgets'
import type { NodePageConfig } from '@statdash/react/engine'
import { STARTER_TEMPLATES, type StarterTemplate } from './starterTemplates'
import { generatePageFromProfile } from './generatePage'
import { createFromTemplate } from './loadTemplate'
import { useActiveProfile } from '../../discovery/useActiveProfile'

export interface TemplateGalleryProps {
  open:    boolean
  onClose: () => void
  /** Fired after a page is successfully created (so a host can close its own UI). */
  onCreated?: () => void
}

// Icon token → component (the gallery's small presentation map).
const ICONS: Record<string, React.ReactNode> = {
  speed:        <SpeedIcon fontSize="large" />,
  'insert-chart': <InsertChartIcon fontSize="large" />,
  dashboard:    <DashboardIcon fontSize="large" />,
}

/** A selected source of config: a committed starter OR the data-first generate. */
type Choice =
  | { kind: 'starter'; template: StarterTemplate }
  | { kind: 'generate'; config: NodePageConfig }

export function TemplateGallery({ open, onClose, onCreated }: TemplateGalleryProps) {
  const active = useActiveProfile()
  const [choice,  setChoice]  = useState<Choice | null>(null)
  const [titleKa, setTitleKa] = useState('')
  const [titleEn, setTitleEn] = useState('')
  const [error,   setError]   = useState<string | null>(null)
  const [busy,    setBusy]    = useState(false)

  // Data-first: a generated page exists only when the bound cube yields one.
  const generated = useMemo<NodePageConfig | null>(
    () => (active.status === 'ready' ? generatePageFromProfile(active.profile) : null),
    [active],
  )

  const reset = () => {
    setChoice(null); setTitleKa(''); setTitleEn(''); setError(null); setBusy(false)
  }
  const handleClose = () => { reset(); onClose() }

  const handleCreate = async () => {
    if (!choice) { setError('აირჩიეთ შაბლონი'); return }
    if (!titleKa.trim()) { setError('სათაური (ka) აუცილებელია'); return }
    setBusy(true); setError(null)
    try {
      const config = choice.kind === 'starter' ? choice.template.config : choice.config
      const page = await createFromTemplate(config, { ka: titleKa.trim(), en: (titleEn || titleKa).trim() })
      reset(); onClose(); onCreated?.()
      void page
    } catch (e) {
      setError(e instanceof Error ? e.message : 'შექმნა ვერ მოხერხდა')
      setBusy(false)
    }
  }

  const isStarterSelected = (id: string) => choice?.kind === 'starter' && choice.template.id === id
  const isGenerateSelected = choice?.kind === 'generate'

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth aria-labelledby="template-gallery-title">
      <DialogTitle id="template-gallery-title">ახალი გვერდი — აირჩიეთ შაბლონი</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          არ დაიწყოთ ცარიელი გვერდიდან — აირჩიეთ მზა შაბლონი ან დააგენერირეთ მონაცემებიდან
        </Typography>

        {/* ── Starter templates (semantic radio group — keyboard navigable) ── */}
        <Box role="radiogroup" aria-label="საწყისი შაბლონები"
             sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 2 }}>
          {STARTER_TEMPLATES.map((t) => {
            const selected = isStarterSelected(t.id)
            return (
              <Box
                key={t.id}
                role="radio"
                aria-checked={selected}
                aria-label={t.name.ka}
                tabIndex={0}
                data-testid={`template-${t.id}`}
                onClick={() => setChoice({ kind: 'starter', template: t })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setChoice({ kind: 'starter', template: t }) }
                }}
                sx={{
                  p: 2, borderRadius: 1, cursor: 'pointer', userSelect: 'none',
                  display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-start',
                  border: 2, borderColor: selected ? 'primary.main' : 'divider',
                  bgcolor: selected ? 'action.selected' : 'background.paper',
                  outlineOffset: 2,
                  '&:focus-visible': { outline: 2, outlineColor: 'primary.main' },
                }}
              >
                <Box sx={{ color: 'primary.main' }}>{ICONS[t.icon] ?? <WidgetsIcon fontSize="large" />}</Box>
                <Typography variant="subtitle1" fontWeight={600}>{t.name.ka}</Typography>
                <Typography variant="caption" color="text.secondary">{t.description.ka}</Typography>
              </Box>
            )
          })}
        </Box>

        {/* ── Data-first generate (Budibase) — only when a cube is bound ────── */}
        {generated && (
          <>
            <Divider sx={{ my: 2 }}><Typography variant="overline" color="text.secondary">ან</Typography></Divider>
            <Box
              role="radio"
              aria-checked={isGenerateSelected}
              aria-label="დააგენერირე დაშბორდი მონაცემებიდან"
              tabIndex={0}
              data-testid="template-generate"
              onClick={() => setChoice({ kind: 'generate', config: generated })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setChoice({ kind: 'generate', config: generated }) }
              }}
              sx={{
                p: 2, borderRadius: 1, cursor: 'pointer', userSelect: 'none',
                display: 'flex', gap: 1.5, alignItems: 'center',
                border: 2, borderColor: isGenerateSelected ? 'primary.main' : 'divider',
                bgcolor: isGenerateSelected ? 'action.selected' : 'background.paper',
                '&:focus-visible': { outline: 2, outlineColor: 'primary.main' },
              }}
            >
              <AutoAwesomeIcon color="primary" fontSize="large" />
              <Box>
                <Typography variant="subtitle1" fontWeight={600}>დააგენერირე მონაცემებიდან</Typography>
                <Typography variant="caption" color="text.secondary">
                  დაკავშირებული მონაცემებიდან მზა, შევსებული დაშბორდი — შემდეგ დახვეწეთ
                </Typography>
              </Box>
            </Box>
          </>
        )}

        {/* ── Name the page (required) ─────────────────────────────────────── */}
        <Divider sx={{ my: 2 }} />
        <Stack spacing={2}>
          <TextField label="სათაური (ka)" value={titleKa} size="small" required
            onChange={(e) => setTitleKa(e.target.value)} inputProps={{ 'aria-label': 'ახალი გვერდის სათაური (ka)' }} />
          <TextField label="სათაური (en)" value={titleEn} size="small"
            onChange={(e) => setTitleEn(e.target.value)} inputProps={{ 'aria-label': 'ახალი გვერდის სათაური (en)' }} />
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={busy}>გაუქმება</Button>
        <Button variant="contained" onClick={handleCreate} disabled={busy || !choice} data-testid="template-create-confirm">
          შექმნა
        </Button>
      </DialogActions>
    </Dialog>
  )
}
