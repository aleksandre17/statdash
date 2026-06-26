// ── IngestResultPanel — the 202 outcome + the curator-approval action ──────────
//
//  The success surface of a canonical upload, split out of ExcelUpload (one concern
//  per file). It renders the 202 result: the dataset code, the auto-published
//  reference data (codelists/displays already in gold), and the approval-gated FACTS —
//  staged until the curator confirms. DQAF integrity rules surface here as non-blocking
//  WARN issues (methodology transparency before approve — Law 9).
//
//  A11y: color is never the only signal (every chip pairs an icon + text); the success
//  state is an Alert (role=alert) so a screen reader announces the publish outcome.
//
import {
  Box, Typography, Button, Chip, Alert, CircularProgress, Stack, Divider,
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import HourglassTopIcon from '@mui/icons-material/HourglassTop'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import type {
  CanonicalUploadResult, IngestKindJob, IngestJobView,
} from '../../lib/ingestApi'

/** The subset of the upload FSM this panel reacts to (it only shows post-202). */
export type ResultPhase = 'result' | 'approving' | 'done'

export interface IngestResultPanelProps {
  result:    CanonicalUploadResult
  factsJob:  IngestKindJob | null
  jobView:   IngestJobView | null
  phase:     ResultPhase
  onApprove: () => void
}

export function IngestResultPanel({
  result, factsJob, jobView, phase, onApprove,
}: IngestResultPanelProps) {
  const published = result.jobIds.filter((j) => j.kind !== 'facts')
  const warnCount = jobView?.issuesBySeverity.warn ?? 0

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="subtitle2">მონაცემთა ნაკრები:</Typography>
        <Chip size="small" color="primary" variant="outlined" label={result.datasetCode} />
      </Box>

      {/* Published reference data (codelists/displays) — auto, already in gold. */}
      {published.length > 0 && (
        <Box>
          <Typography variant="caption" color="text.secondary">საცნობარო მონაცემები (გამოქვეყნდა)</Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mt: 0.5 }}>
            {published.map((j) => (
              <Chip
                key={j.jobId}
                size="small" color="success" variant="outlined"
                icon={<CheckCircleIcon />}
                label={j.kind}
              />
            ))}
          </Stack>
        </Box>
      )}

      <Divider />

      {/* The facts — the approval-gated DATA. Staged until the curator publishes. */}
      {factsJob ? (
        phase === 'done' ? (
          <Alert severity="success" variant="outlined" icon={<CheckCircleIcon />}>
            მონაცემები ჩაიტვირთა ✓
          </Alert>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip size="small" color="warning" variant="outlined" icon={<HourglassTopIcon />} label="facts — staged" />
              <Typography variant="caption" color="text.secondary">
                მონაცემები მზადაა დასადასტურებლად
              </Typography>
            </Box>

            {/* DQAF integrity rules surface as WARN — show them (they do NOT block). */}
            {warnCount > 0 && (
              <Alert severity="warning" variant="outlined" icon={<WarningAmberIcon />}>
                {warnCount} გაფრთხილება მონაცემთა ხარისხის შესახებ — გამოქვეყნებას არ აბრკოლებს.
              </Alert>
            )}

            <Button
              variant="contained"
              disabled={phase === 'approving'}
              startIcon={phase === 'approving' ? <CircularProgress size={16} color="inherit" /> : <CheckCircleIcon />}
              onClick={onApprove}
            >
              დადასტურება და გამოქვეყნება
            </Button>
          </Box>
        )
      ) : (
        <Typography variant="body2" color="text.secondary">
          ფაქტობრივი მონაცემები არ იყო — მხოლოდ საცნობარო მონაცემები განახლდა.
        </Typography>
      )}
    </Box>
  )
}
