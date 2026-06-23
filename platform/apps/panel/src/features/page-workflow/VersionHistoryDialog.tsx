// ── VersionHistoryDialog — append-only page version history (GET /:id/versions) ─
//
//  The page lifecycle is version-backed: every save appends an immutable version,
//  publish promotes one. This dialog surfaces that audit trail (newest first) so
//  the author can see the history and which version is live. Read-only — restore
//  is a future capability (the server keeps every version immutable).
//
import { useEffect, useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  List, ListItem, ListItemText, Chip, CircularProgress, Box, Typography,
} from '@mui/material'
import { fetchVersions } from '../../store/api-actions'
import type { PageVersionRow } from '../../lib/api'

export interface VersionHistoryDialogProps {
  pageId: string | null
  open:   boolean
  onClose: () => void
}

export function VersionHistoryDialog({ pageId, open, onClose }: VersionHistoryDialogProps) {
  // Key the loaded rows to the request that produced them. While the loaded key
  // does not match the open page, we are loading — so the reset is DERIVED from
  // the key mismatch, not set synchronously in the effect (no cascading render).
  const [loaded, setLoaded] = useState<{ key: string; rows: PageVersionRow[] } | null>(null)
  const requestKey = open && pageId ? pageId : null
  const rows = loaded && loaded.key === requestKey ? loaded.rows : null

  useEffect(() => {
    if (!requestKey) return
    let active = true
    void fetchVersions(requestKey).then((r) => { if (active) setLoaded({ key: requestKey, rows: r }) })
    return () => { active = false }
  }, [requestKey])

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth aria-labelledby="version-history-title">
      <DialogTitle id="version-history-title">Version history</DialogTitle>
      <DialogContent dividers>
        {rows === null ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress size={24} aria-label="Loading versions" />
          </Box>
        ) : rows.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No versions yet.</Typography>
        ) : (
          <List dense data-testid="version-list">
            {rows.map((v) => (
              <ListItem key={v.id} disableGutters secondaryAction={
                v.is_published ? <Chip size="small" color="success" label="Published" /> : null
              }>
                <ListItemText
                  primary={`Version ${v.version_number}`}
                  secondary={new Date(v.created_at).toLocaleString()}
                />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
