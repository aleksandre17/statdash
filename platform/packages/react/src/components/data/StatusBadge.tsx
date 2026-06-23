// ── StatusBadge — uniform SDMX OBS_STATUS badge [N14] ─────────────────
//
//  Shared across all panel shells: Table, KPI, Chart.
//  Replaces per-shell STATUS_LABELS constants with a single source of truth.
//
//  Usage:
//    <StatusBadge status="p" />         → localised preliminary label
//    <StatusBadge status="e" />         → localised estimated label
//    <StatusBadge status="A" />         → null (normal — not displayed)
//    <StatusBadge status={undefined} /> → null
//
//  Labels are resolved from OBS_STATUS_LABELS in @statdash/engine — locale
//  strings live there (or in the app i18n catalog); this component is
//  locale-agnostic and app-agnostic.
//

import React                 from 'react'
import type { ObsStatus }    from '@statdash/engine'
import { OBS_STATUS_LABELS } from '@statdash/engine'

interface StatusBadgeProps {
  status?: ObsStatus
  /** Additional class names for the badge element. */
  className?: string
}

/**
 * Renders a labelled badge for a non-normal SDMX OBS_STATUS code.
 * Returns null for status 'A' (normal) or when status is absent.
 * IMF / Eurostat / ONS data integrity convention.
 */
export function StatusBadge({ status, className }: StatusBadgeProps): React.ReactElement | null {
  if (!status || status === 'A') return null
  const label = OBS_STATUS_LABELS[status]
  if (!label) return null
  const cls = ['status-badge', `status-badge--${status}`, className].filter(Boolean).join(' ')
  return <span className={cls}>{label}</span>
}
