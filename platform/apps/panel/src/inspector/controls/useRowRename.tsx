// ── useRowRename — the glance-weight RENAME micro-edit for a nested-item row ────
//  (AR-49 SL-3, SPEC-studio-shell-layout §3.2 — nested-item · glance → POPOVER)
//
//  Renaming ONE array row (its `itemLabel` field) is a single, transient property:
//  by the Placement Law it is `glance`-weight and pops OUT into the SL-3
//  <EditPopover>, anchored to the row — it never drills into the whole item form
//  (that would be the form-weight dock-drill) nor takes over the dock. This is the
//  §3.2 example verbatim ("recolor, rename"), and it is the ONE genuine glance path
//  that proves the container (SL-4/SL-5 route the rest).
//
//  Extracted from NestedItemControl as its own concern (one-body hygiene): the
//  ArrayListScreen owns the per-row summary + reorder; this owns the rename overlay
//  (draft state, commit semantics, the popover). Reusable by any array level.
//
import { useState } from 'react'
import type { ReactNode } from 'react'
import { TextField } from '@mui/material'
import { getAtPath, setAtPath } from '../showWhen'
import { EditPopover, type EditPopoverCloseReason } from '../../studio/EditPopover'
import type { Locale } from '../../types/constructor'

interface RowRenameOptions {
  items:     unknown[]
  /** The item field a row title comes from; rename is offered ONLY when defined. */
  itemLabel: string | undefined
  locale:    Locale
  /** Resolve a row's current display title (active-locale) — for the draft + header. */
  titleOf:   (index: number) => string
  onEmit:    (next: unknown[]) => void
}

interface RowRenameHandle {
  /** Open the rename popover for row `index`, anchored to its trigger element. */
  openRename: (index: number, anchorEl: HTMLElement) => void
  /** The (portalled) popover node — render it once at the array-screen root. */
  popover:    ReactNode
}

interface RenameState { index: number; anchorEl: HTMLElement; draft: string }

export function useRowRename({
  items, itemLabel, locale, titleOf, onEmit,
}: RowRenameOptions): RowRenameHandle {
  const [rename, setRename] = useState<RenameState | null>(null)

  const openRename = (index: number, anchorEl: HTMLElement) =>
    setRename({ index, anchorEl, draft: titleOf(index) })

  const closeRename = (reason: EditPopoverCloseReason) => {
    // Least Astonishment (Nielsen): Esc CANCELS the edit; commit (Enter) / click-away
    // KEEPS it — the conventional text-edit dismissal model.
    if (rename && reason !== 'escape' && itemLabel) {
      const cur = getAtPath(items[rename.index], itemLabel)
      // Preserve the field's shape: a LocaleString record keeps its other locales
      // (write ONLY the active one); a plain string stays a string — no data dropped.
      const nextVal = cur && typeof cur === 'object' && !Array.isArray(cur)
        ? { ...(cur as Record<string, unknown>), [locale]: rename.draft }
        : rename.draft
      onEmit(items.map((it, i) => (i === rename.index ? setAtPath(it, itemLabel, nextVal) : it)))
    }
    setRename(null)
  }

  const popover = (
    <EditPopover
      open={rename !== null}
      anchorEl={rename?.anchorEl ?? null}
      title={rename ? `Rename — ${titleOf(rename.index)}` : 'Rename'}
      onClose={closeRename}
    >
      <TextField
        autoFocus
        fullWidth
        size="small"
        variant="outlined"
        value={rename?.draft ?? ''}
        onChange={(e) => setRename((r) => (r ? { ...r, draft: e.target.value } : r))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); closeRename('commit') }
        }}
        inputProps={{ 'aria-label': 'Name' }}
      />
    </EditPopover>
  )

  return { openRename, popover }
}
