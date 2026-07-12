// ── VisibilitySection — node-level "Show when…" authoring [V4] ─────────────────
//
//  Any node can carry a `view.visibleWhen` VisibilityExpr — the boolean gate that
//  decides whether the node renders (evalVisibility in the engine). This section
//  mounts in the NODE Inspector (mirroring how the FiltersDrawer mounts the page-
//  level filter authoring) and lets the author build that condition tree without
//  JSON, through the recursive VisibilityBuilder.
//
//  No condition ⇒ the node is always visible (the gate is absent). Enabling adds a
//  seed condition; clearing removes `view.visibleWhen` entirely (back to always-on)
//  — additive + lossless: an unedited node never grows a `visibleWhen` key.
//
//  Writes go through the node Inspector's SAME patch path (setAtPath on the node
//  props), so the edit composes with undo/redo and the WYSIWYG re-render exactly
//  like every other node-prop edit.
//
import { Box, Stack, Switch, Typography, FormControlLabel } from '@mui/material'
import VisibilityIcon from '@mui/icons-material/Visibility'
import type { VisibilityExpr } from '@statdash/engine'
import { VisibilityBuilder } from './VisibilityBuilder'
import { makeVisibilityExpr } from './visibilityFactory'

export interface VisibilitySectionProps {
  /** The node's current view.visibleWhen, or undefined (always visible). */
  value:    VisibilityExpr | undefined
  /**
   * Write the next gate. `undefined` clears it (always visible). The parent maps
   * this to a `view.visibleWhen` dot-path patch (or a delete when undefined).
   */
  onChange: (next: VisibilityExpr | undefined) => void
  /**
   * Render the section's own "ჩვენების პირობა" overline heading. Default `true`
   * (self-contained surface, e.g. the ParamDefEditor's filter-scoping section).
   * The VISIBILITY facet passes `false`: the generic Inspector already renders the
   * facet's field label as the single heading, so a second overline is redundant (DRY).
   */
  heading?: boolean
}

export function VisibilitySection({ value, onChange, heading = true }: VisibilitySectionProps) {
  const enabled = value != null

  const toggle = (on: boolean) => {
    if (on) onChange(value ?? makeVisibilityExpr('isset'))
    else    onChange(undefined)
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }} data-testid="visibility-section">
      {heading && (
        <Stack direction="row" spacing={1} alignItems="center">
          <VisibilityIcon fontSize="small" color="action" />
          <Typography variant="overline" color="text.secondary">ჩვენების პირობა</Typography>
        </Stack>
      )}

      <FormControlLabel
        control={<Switch size="small" checked={enabled}
          onChange={(e) => toggle(e.target.checked)}
          inputProps={{ 'aria-label': 'enable visibility condition' }} />}
        label={<Typography variant="body2">პირობით ჩვენება (Show when…)</Typography>}
      />

      {enabled && value && (
        <VisibilityBuilder
          path="root"
          expr={value}
          onChange={(next) => onChange(next)}
        />
      )}
    </Box>
  )
}
