// ── StudioEmptyState — the ONE empty-state doctrine (AR-49 M4 Wave 0) ──────────
//
//  The shell used to inline the same "no page / no selection / blank page" copy in
//  five places (canvas, Layers, and 3× stacked in the Inspector). That is a DRY
//  violation AND a UX defect: on a stranded boot the Inspector printed "No page
//  selected" three times in a column. This is the SINGLE home for that copy — every
//  surface renders one of three discriminated kinds through this component, so the
//  message is emitted by exactly one component and never stacks (FF-ONE-EMPTYSTATE).
//
//  Kinds (discriminated — a new kind is a new case, not a new inline literal):
//    • no-pages     — the tool has no pages yet → a Create-page CTA (primary path).
//    • page-blank   — a page is active but empty → an Insert CTA (add the first block).
//    • no-selection — a node-inspector with nothing selected → ONE quiet hint (no CTA).
//    • site-context — a project-scope surface (Site / Style) owns the LEFT dock, so the
//                     right inspector's default page tree would double the authoring
//                     context → ONE quiet hint pointing to the left panel (AR-52: one
//                     clear authoring focus; Least Astonishment). No CTA.
//
//  Accessibility (WCAG 2.1 AA, Law 9): the region carries an accessible name; the CTA
//  is a real <button> with a bilingual accessible name; the quiet hint is plain text
//  (no false "action" affordance). Copy is bilingual (LocaleString discipline, Law 4).
//
import { Box, Typography, Button } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import ViewModuleIcon from '@mui/icons-material/ViewModule'
import PostAddIcon from '@mui/icons-material/PostAdd'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined'
import type { SvgIconComponent } from '@mui/icons-material'
import type { Locale } from '../types/constructor'

export type StudioEmptyStateKind = 'no-pages' | 'page-blank' | 'no-selection' | 'site-context'

interface EmptyStateCopy {
  icon:      SvgIconComponent
  title:     Record<Locale, string>
  body:      Record<Locale, string>
  /** The CTA label — absent ⇒ a quiet hint with no action affordance. */
  action?:   Record<Locale, string>
}

// The SSOT copy catalog — no other component may inline these strings (FF-ONE-EMPTYSTATE).
const COPY: Record<StudioEmptyStateKind, EmptyStateCopy> = {
  'no-pages': {
    icon:   DescriptionOutlinedIcon,
    title:  { en: 'No pages yet',            ka: 'გვერდები ჯერ არ არის' },
    body:   { en: 'Create your first page to start composing.', ka: 'შექმენით პირველი გვერდი, რომ დაიწყოთ აწყობა.' },
    action: { en: 'Create a page',           ka: 'გვერდის შექმნა' },
  },
  'page-blank': {
    icon:   PostAddIcon,
    title:  { en: 'This page is empty',      ka: 'ეს გვერდი ცარიელია' },
    body:   { en: 'Insert a block to begin.', ka: 'დაამატეთ ბლოკი დასაწყებად.' },
    action: { en: 'Insert a block',          ka: 'ბლოკის დამატება' },
  },
  'no-selection': {
    icon:   ViewModuleIcon,
    title:  { en: 'Nothing selected',        ka: 'არაფერია არჩეული' },
    body:   { en: 'Select an element to edit its properties.', ka: 'აირჩიეთ ელემენტი მისი პარამეტრების რედაქტირებისთვის.' },
    // No action — the node inspector's empty state is a quiet hint, not a CTA.
  },
  'site-context': {
    icon:   TuneOutlinedIcon,
    title:  { en: 'Editing site settings',   ka: 'საიტის პარამეტრების რედაქტირება' },
    body:   {
      en: 'Site-wide controls are in the left panel. Select an element on the canvas to inspect it here.',
      ka: 'საიტის პარამეტრები მარცხენა პანელშია. აირჩიეთ ელემენტი ტილოზე, რომ აქ დაათვალიეროთ.',
    },
    // No action — a quiet orientation hint; the authoring focus is the left dock.
  },
}

export interface StudioEmptyStateProps {
  kind:      StudioEmptyStateKind
  locale:    Locale
  /**
   * Invoked by the primary CTA. Omit for a kind with no action (no-selection), or
   * when the host surface has no action to offer — the CTA is then not rendered.
   */
  onAction?: () => void
  /**
   * Fill the host's full height and center within it (fill-by-construction). The
   * right dock passes this so the "nothing selected / no pages" state occupies the
   * whole content region instead of a short island above a void (FF-RIGHTDOCK-FILLS).
   */
  fill?:     boolean
}

export function StudioEmptyState({ kind, locale, onAction, fill = false }: StudioEmptyStateProps) {
  const copy  = COPY[kind]
  const Icon  = copy.icon
  const title = copy.title[locale] ?? copy.title.en
  const body  = copy.body[locale] ?? copy.body.en
  const actionLabel = copy.action ? (copy.action[locale] ?? copy.action.en) : null

  return (
    <Box
      role="note"
      aria-label={title}
      data-empty-state-kind={kind}
      sx={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', textAlign: 'center', gap: 1,
        color: 'text.disabled', p: 3,
        ...(fill ? { flex: 1, minHeight: 0, height: '100%' } : null),
      }}
    >
      <Icon sx={{ fontSize: 40 }} />
      <Typography variant="body2" fontWeight={600} color="text.secondary">{title}</Typography>
      <Typography variant="caption">{body}</Typography>
      {actionLabel && onAction && (
        <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={onAction} sx={{ mt: 0.5 }}>
          {actionLabel}
        </Button>
      )}
    </Box>
  )
}
