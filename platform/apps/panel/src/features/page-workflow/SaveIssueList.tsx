// ── SaveIssueList — inline render of save-guard blocking issues ───────────────
//
//  The save→publish gate UX: when validatePageForSave blocks a save, the author
//  must see WHICH node/field/check failed, in plain language, so they can fix it
//  without leaving the canvas (shift-left, Principle of Least Astonishment). Pure
//  presentation over the SaveIssue[] the guard already produces — grouped by the
//  four checks so a batch of issues reads as a checklist, not a wall.
//
import { Alert, AlertTitle, Box, Chip, List, ListItem, ListItemText, Typography } from '@mui/material'
import type { SaveIssue, SaveCheck } from '../../save/saveGuard'

// Human labels for each guard check (no hardcoded copy at call sites).
const CHECK_LABEL: Record<SaveCheck, string> = {
  'migrate-identity': 'Schema / migration',
  'round-trip':       'Serialization round-trip',
  'per-node-valid':   'Field validation',
  'locale-complete':  'Translations',
}

const CHECK_ORDER: SaveCheck[] = ['per-node-valid', 'locale-complete', 'round-trip', 'migrate-identity']

export interface SaveIssueListProps {
  issues: SaveIssue[]
  /** Deep-link a clicked issue to its node so the author jumps to the field. */
  onSelectNode?: (nodeId: string) => void
}

export function SaveIssueList({ issues, onSelectNode }: SaveIssueListProps) {
  if (issues.length === 0) return null

  const byCheck = new Map<SaveCheck, SaveIssue[]>()
  for (const issue of issues) {
    const list = byCheck.get(issue.check) ?? []
    list.push(issue)
    byCheck.set(issue.check, list)
  }

  return (
    <Alert severity="error" role="alert" data-testid="save-issues" sx={{ alignItems: 'flex-start' }}>
      <AlertTitle>
        Cannot save — fix {issues.length} issue{issues.length === 1 ? '' : 's'}
      </AlertTitle>
      {CHECK_ORDER.filter((c) => byCheck.has(c)).map((check) => (
        <Box key={check} sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
            {CHECK_LABEL[check]}
          </Typography>
          <List dense disablePadding>
            {byCheck.get(check)!.map((issue, i) => (
              <ListItem
                key={`${check}-${i}`}
                disableGutters
                sx={{ cursor: issue.nodeId && onSelectNode ? 'pointer' : 'default' }}
                onClick={() => issue.nodeId && onSelectNode?.(issue.nodeId)}
                data-testid="save-issue"
              >
                <ListItemText
                  primary={issue.message}
                  secondary={
                    issue.field ? (
                      <Chip size="small" variant="outlined" label={issue.field} sx={{ mt: 0.5 }} />
                    ) : null
                  }
                  slotProps={{ secondary: { component: 'div' } }}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      ))}
    </Alert>
  )
}
