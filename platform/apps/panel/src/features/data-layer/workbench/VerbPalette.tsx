// ── VerbPalette — the 7-verb "+add step" palette (W-P3 · ADR-046 · SPEC §1.2/§3.1) ─
//
//  Replaces the flat op dropdown IN THE WORKBENCH (the legacy editors keep their
//  dropdown — Strangler). The author picks an INTENT-VERB (Get/Filter/Aggregate/
//  Derive/Reshape/Combine/Sort), not one of ~19 op tags. The concrete op is a
//  progressive-disclosure detail INSIDE the verb: clicking a verb inserts its default
//  op (SPEC §1.2 — Aggregate→aggregate, …); a "choose specific" disclosure reveals the
//  verb's other ops. The verb→op grouping is a PROJECTION of the engine registry's
//  `category` field (`buildVerbPalette`) — never a hand-list.
//
//  Valid-by-default (pre-note #3): every insert goes through `addStep` → `defaultStep`,
//  which now yields a VALID minimal step (a derive carries a placeholder `as`) — the
//  grid + canvas stay green the moment a step lands.
//
//  WCAG (Law 9): the trigger is a labelled button (aria-haspopup); the palette is a
//  menu of real buttons; the `get` head verb renders honestly disabled (the source is
//  already the pipeline's first step). Bilingual ka/en.
//
import { useState } from 'react'
import {
  Box, Button, Collapse, IconButton, Popover, Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import StorageIcon from '@mui/icons-material/Storage'
import FilterAltIcon from '@mui/icons-material/FilterAlt'
import FunctionsIcon from '@mui/icons-material/Functions'
import CalculateIcon from '@mui/icons-material/Calculate'
import TransformIcon from '@mui/icons-material/Transform'
import CallMergeIcon from '@mui/icons-material/CallMerge'
import SortIcon from '@mui/icons-material/Sort'
import type { StepCategory } from '@statdash/engine'
import { buildVerbPalette, type VerbEntry } from './verbProjection'
import { useActiveLocales } from '../../../inspector/useActiveLocales'
import type { Locale } from '../../../types/constructor'

/** One icon per verb (keyed by the 7-union — a missing key is a compile error). */
const VERB_ICON: Record<StepCategory, typeof StorageIcon> = {
  get:       StorageIcon,
  filter:    FilterAltIcon,
  aggregate: FunctionsIcon,
  derive:    CalculateIcon,
  reshape:   TransformIcon,
  combine:   CallMergeIcon,
  sort:      SortIcon,
}

export interface VerbPaletteProps {
  /** Insert a step for the given op — the builder's own `addStep` (uid-synced). */
  onAdd: (op: string) => void
}

export function VerbPalette({ onAdd }: VerbPaletteProps) {
  const locale = (useActiveLocales()[0] ?? 'ka') as Locale
  const en = locale === 'en'
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const verbs = buildVerbPalette(locale)

  const insert = (op: string) => { if (op) { onAdd(op); setAnchor(null) } }

  return (
    <>
      <Button
        size="small"
        startIcon={<AddIcon />}
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-haspopup="menu"
        aria-expanded={Boolean(anchor)}
        data-testid="add-step-trigger"
      >
        {en ? 'Add step' : 'ნაბიჯის დამატება'}
      </Button>

      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box
          role="menu"
          aria-label={en ? 'Add a step' : 'ნაბიჯის დამატება'}
          data-testid="verb-palette"
          sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 260, maxWidth: 320 }}
        >
          {verbs.map((v) => (
            <VerbCard key={v.category} verb={v} en={en} onInsert={insert} />
          ))}
        </Box>
      </Popover>
    </>
  )
}

// ── VerbCard — one intent verb: icon + word + hint, default-insert + op disclosure ──
function VerbCard({
  verb, en, onInsert,
}: { verb: VerbEntry; en: boolean; onInsert: (op: string) => void }) {
  const [open, setOpen] = useState(false)
  const Icon = VERB_ICON[verb.category]
  const hasChoices = verb.ops.length > 1

  return (
    <Box data-testid={`verb-card-${verb.category}`} sx={{ display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 0.5 }}>
        <Box
          component="button"
          type="button"
          role="menuitem"
          disabled={!verb.insertable}
          onClick={() => onInsert(verb.defaultOp)}
          data-testid={`verb-insert-${verb.category}`}
          sx={{
            flex: 1, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 1,
            p: 1, border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'transparent',
            cursor: verb.insertable ? 'pointer' : 'not-allowed',
            opacity: verb.insertable ? 1 : 0.5,
            '&:hover': verb.insertable ? { bgcolor: 'action.hover', borderColor: 'primary.main' } : {},
          }}
        >
          <Icon fontSize="small" color={verb.insertable ? 'primary' : 'disabled'} />
          <Box>
            <Typography variant="body2" fontWeight={600}>{verb.label}</Typography>
            <Typography variant="caption" color="text.secondary">
              {verb.insertable
                ? verb.hint
                : (en ? 'the source — already the first step' : 'წყარო — უკვე პირველი ნაბიჯია')}
            </Typography>
          </Box>
        </Box>
        {hasChoices && (
          <IconButton
            size="small"
            aria-label={en ? 'Choose a specific operation' : 'აირჩიე კონკრეტული ოპერაცია'}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            data-testid={`verb-more-${verb.category}`}
            sx={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 120ms' }}
          >
            <ExpandMoreIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      {hasChoices && (
        <Collapse in={open} unmountOnExit>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, pl: 3, pt: 0.5 }}>
            {verb.ops.map((o) => (
              <Box
                key={o.op}
                component="button"
                type="button"
                role="menuitem"
                onClick={() => onInsert(o.op)}
                data-testid={`verb-op-${o.op}`}
                sx={{
                  textAlign: 'left', p: 0.5, border: 0, bgcolor: 'transparent', cursor: 'pointer',
                  borderRadius: 1, fontSize: 13, color: 'text.primary',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                {o.label}
              </Box>
            ))}
          </Box>
        </Collapse>
      )}
    </Box>
  )
}
