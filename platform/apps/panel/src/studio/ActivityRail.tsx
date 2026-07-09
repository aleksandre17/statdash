import { Box, Tooltip, IconButton, Badge } from '@mui/material'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import { RAIL_ENTRIES } from './rail'
import type { StudioSurface, Locale } from '../types/constructor'

// ── ActivityRail — the summonable-surface icon rail (Webflow IA) ──────────────
//
//  A vertical <nav> of icon buttons that swap the LEFT-dock surface — never a
//  route, never a step (spec §2.1). The active surface is marked aria-current;
//  the LOCKED Model slot is a disabled button with a lock badge + "M2" tooltip
//  (rendered, never selectable). Every button is natively keyboard-reachable
//  (Tab) and has an accessible name (WCAG 2.1 AA — 4.1.2).
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
          const isActive = !entry.locked && entry.id === active
          const label = entry.label[locale]
          const tooltip = entry.locked
            ? `${label} — ${locale === 'en' ? 'coming in M2' : 'M2-ში'}`
            : label
          return (
            <Box role="listitem" key={entry.id}>
              <Tooltip title={tooltip} placement="right">
                {/* span wrapper so a disabled button still shows its tooltip */}
                <span>
                  <IconButton
                    className="studio-rail__btn"
                    data-active={isActive || undefined}
                    aria-label={tooltip}
                    aria-current={isActive ? 'true' : undefined}
                    disabled={entry.locked}
                    onClick={() => { if (!entry.locked) onSelect(entry.id) }}
                    size="large"
                  >
                    {entry.locked
                      ? (
                        <Badge overlap="circular" badgeContent={<LockOutlinedIcon sx={{ fontSize: 12 }} />}>
                          <Icon />
                        </Badge>
                      )
                      : <Icon />}
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          )
        })}
      </Box>
    </nav>
  )
}
