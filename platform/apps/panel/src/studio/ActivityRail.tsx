import { Box, Tooltip, IconButton } from '@mui/material'
import { visibleRailEntries } from './rail'
import type { StudioSurface, Locale } from '../types/constructor'
import type { Role } from './useRole'

// ── ActivityRail — the summonable-surface icon rail (Webflow IA) ──────────────
//
//  A vertical <nav> of icon buttons that swap the LEFT-dock surface — never a
//  route, never a step (spec §2.1). The active surface is marked aria-current.
//  The rail renders the entries VISIBLE under the current role lens
//  (`visibleRailEntries(role)`): in `author` the Steward-only Model slot is absent;
//  in `steward` it appears as an ordinary, keyboard-reachable entry — role is a
//  lens on the SAME document, not a permission (FF-ROLE-IS-LENS). Every button is
//  natively keyboard-reachable (Tab) and has an accessible name (WCAG 2.1 AA — 4.1.2).
export interface ActivityRailProps {
  active:    StudioSurface
  onSelect:  (surface: StudioSurface) => void
  locale:    Locale
  /** The role lens (read by StudioShell through useRole — the single seam). */
  role:      Role
}

export function ActivityRail({ active, onSelect, locale, role }: ActivityRailProps) {
  return (
    <nav aria-label={locale === 'en' ? 'Studio surfaces' : 'სტუდიოს ზედაპირები'} className="studio-rail">
      <Box role="list" sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, p: 0.5 }}>
        {visibleRailEntries(role).map((entry) => {
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
