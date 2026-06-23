// ── PageStatusBadge — reflects the SERVER lifecycle FSM (never client-derived) ─
//
//  Shows the page's current lifecycle state as the server reports it (draft /
//  published / archived) plus the two derived authoring affordances: a "Modified"
//  flag when there are unsaved edits, and a "Published version is live" hint when
//  the latest persisted version is the published one. WCAG: status is conveyed by
//  TEXT, not colour alone (no colour-only signal).
//
import { Chip, Stack, Tooltip } from '@mui/material'
import CloudDoneIcon from '@mui/icons-material/CloudDone'
import EditNoteIcon from '@mui/icons-material/EditNote'
import DescriptionIcon from '@mui/icons-material/Description'
import ArchiveIcon from '@mui/icons-material/Archive'
import type { PageLifecycle, PageStatus } from '../../store/constructor.lifecycle'

const STATUS_META: Record<PageStatus, { label: string; color: 'default' | 'success' | 'warning'; icon: React.ReactElement }> = {
  draft:     { label: 'Draft',     color: 'warning', icon: <DescriptionIcon fontSize="small" /> },
  published: { label: 'Published', color: 'success', icon: <CloudDoneIcon fontSize="small" /> },
  archived:  { label: 'Archived',  color: 'default', icon: <ArchiveIcon fontSize="small" /> },
}

export interface PageStatusBadgeProps {
  lifecycle: PageLifecycle | null
}

export function PageStatusBadge({ lifecycle }: PageStatusBadgeProps) {
  if (!lifecycle) return null
  const meta = STATUS_META[lifecycle.status]

  return (
    <Stack direction="row" spacing={1} alignItems="center" data-testid="page-status">
      <Tooltip title={`Lifecycle: ${meta.label}`}>
        <Chip
          size="small"
          color={meta.color}
          icon={meta.icon}
          label={meta.label}
          data-testid="page-status-chip"
          aria-label={`Page status: ${meta.label}`}
        />
      </Tooltip>
      {lifecycle.versionNumber != null && (
        <Chip size="small" variant="outlined" label={`v${lifecycle.versionNumber}`} aria-label={`Version ${lifecycle.versionNumber}`} />
      )}
      {lifecycle.dirty && (
        <Chip
          size="small"
          color="info"
          variant="outlined"
          icon={<EditNoteIcon fontSize="small" />}
          label="Unsaved changes"
          data-testid="page-dirty"
        />
      )}
    </Stack>
  )
}
