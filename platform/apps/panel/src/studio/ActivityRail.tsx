import { Box, Tooltip, IconButton } from '@mui/material'
import { RAIL_ENTRIES } from './rail'
import type { StudioSurface, Locale } from '../types/constructor'

// ── ActivityRail — the summonable-surface icon rail (Webflow IA) ──────────────
//
//  A vertical <nav> of icon buttons that swap the LEFT-dock surface — never a
//  route, never a step (spec §2.1). The active surface is marked aria-current.
//  The rail renders the flat RAIL_ENTRIES table: every destination — including the
//  Data-model destination — is ALWAYS visible (AR-50 M5b). The role lens splits the
//  data-model destination's CONTENT (author→dictionary, steward→modeler), never the
//  rail's visibility, so no entry is hidden by role (FF-ROLE-IS-LENS / FF-DATA-
//  REACHABLE). Every button is natively keyboard-reachable (Tab) and has an
//  accessible name (WCAG 2.1 AA — 4.1.2).
export interface ActivityRailProps {
  active:    StudioSurface
  onSelect:  (surface: StudioSurface) => void
  locale:    Locale
}

export function ActivityRail({ active, onSelect, locale }: ActivityRailProps) {
  return (
    <nav aria-label={locale === 'en' ? 'Studio surfaces' : 'სტუდიოს ზედაპირები'} className="studio-rail">
      <Box role="list" sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, p: 0.5 }}>
        {RAIL_ENTRIES.map((entry) => {
          const Icon = entry.icon
          const isActive = entry.id === active
          const label = entry.label[locale]
          return (
            <Box role="listitem" key={entry.id}>
              <Tooltip title={label} placement="right">
                <IconButton
                  className="studio-rail__btn"
                  data-active={isActive || undefined}
                  aria-label={label}
                  aria-current={isActive ? 'true' : undefined}
                  onClick={() => onSelect(entry.id)}
                  size="large"
                >
                  <Icon />
                </IconButton>
              </Tooltip>
            </Box>
          )
        })}
      </Box>
    </nav>
  )
}
