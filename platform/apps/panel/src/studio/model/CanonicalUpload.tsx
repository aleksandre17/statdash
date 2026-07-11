import { useRef, useState } from 'react'
import { Box, Button, Typography, Alert, CircularProgress, Divider } from '@mui/material'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import { uploadCanonical, publishCanonicalJob, type CanonicalUploadResult } from '../../lib/api'
import type { Locale } from '../../types/constructor'

// ── CanonicalUpload — front-plane raw-data ingestion (AR-51 / ADR-040) ──────────
//
//  The steward's "onboard data" affordance, brought to the FRONT (owner: everything
//  starts with raw-data upload). Flow = ADR-040's review→confirm (Flatfile / Power
//  Query pattern, never a blind commit):
//    upload a canonical workbook → the source SELF-DECLARES its DSD (parsed
//    server-side) → reference data auto-publishes, FACTS are STAGED → the steward
//    REVIEWS → PUBLISH (the FSM's gated publish) → observations live.
//  The panel is FORMAT-AGNOSTIC (ADR-040): it never parses the workbook — it ships
//  the bytes to the agnostic ingestion port and renders what the source declared.
//  Reuses the existing canonical route + FSM (front-plane only, no backend rebuild).

type Phase =
  | { k: 'idle' }
  | { k: 'uploading' }
  | { k: 'staged'; result: CanonicalUploadResult; factsJobId?: string }
  | { k: 'publishing' }
  | { k: 'published' }
  | { k: 'error'; message: string }

/** Best-effort read of the staged facts jobId from the 202 `{ jobIds }` envelope. */
function factsJobIdOf(result: CanonicalUploadResult): string | undefined {
  const jobIds = result.jobIds as Record<string, unknown> | undefined
  const facts = jobIds?.facts ?? (result.factsJobId as unknown)
  return typeof facts === 'string' ? facts : undefined
}

export function CanonicalUpload({ locale }: { locale: Locale }) {
  const en = locale === 'en'
  const inputRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>({ k: 'idle' })

  async function onFile(file: File) {
    setPhase({ k: 'uploading' })
    try {
      const bytes  = await file.arrayBuffer()
      const result = await uploadCanonical(bytes)
      setPhase({ k: 'staged', result, factsJobId: factsJobIdOf(result) })
    } catch (e) {
      setPhase({ k: 'error', message: e instanceof Error ? e.message : (en ? 'Upload failed' : 'ატვირთვა ვერ მოხერხდა') })
    }
  }

  async function onPublish(jobId: string) {
    setPhase({ k: 'publishing' })
    try {
      await publishCanonicalJob(jobId)
      setPhase({ k: 'published' })
    } catch (e) {
      setPhase({ k: 'error', message: e instanceof Error ? e.message : (en ? 'Publish failed' : 'გამოქვეყნება ვერ მოხერხდა') })
    }
  }

  const busy = phase.k === 'uploading' || phase.k === 'publishing'

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }} data-testid="canonical-upload">
      <Typography variant="subtitle2">{en ? 'Onboard data' : 'მონაცემების ატვირთვა'}</Typography>
      <Typography variant="caption" color="text.secondary">
        {en
          ? 'Upload a canonical workbook — it self-declares its structure (DSD); review, then publish.'
          : 'ატვირთე კანონიკური workbook — ის თავად აცხადებს სტრუქტურას (DSD); გადახედე და გამოაქვეყნე.'}
      </Typography>

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/octet-stream"
        style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = '' }}
      />
      <Button
        variant="outlined"
        startIcon={<UploadFileIcon />}
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        sx={{ alignSelf: 'flex-start', textTransform: 'none' }}
      >
        {en ? 'Choose workbook…' : 'აირჩიე workbook…'}
      </Button>

      {busy && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={16} />
          <Typography variant="caption">
            {phase.k === 'uploading'
              ? (en ? 'Parsing + staging…' : 'იპარსება + staging…')
              : (en ? 'Publishing…' : 'ქვეყნდება…')}
          </Typography>
        </Box>
      )}

      {phase.k === 'staged' && (
        <>
          <Divider />
          <Alert severity="info" data-testid="canonical-staged">
            {en
              ? 'Staged — reference data published, facts awaiting your confirm.'
              : 'Staged — reference მონაცემები გამოქვეყნდა, facts ელოდება დადასტურებას.'}
          </Alert>
          {phase.factsJobId
            ? (
              <Button
                variant="contained"
                data-testid="canonical-publish"
                onClick={() => { if (phase.factsJobId) void onPublish(phase.factsJobId) }}
                sx={{ alignSelf: 'flex-start', textTransform: 'none' }}
              >
                {en ? 'Review & publish' : 'გადახედე და გამოაქვეყნე'}
              </Button>
            )
            : (
              <Typography variant="caption" color="text.secondary">
                {en ? 'No facts job to publish (reference-only upload).' : 'facts-job არ არის (მხოლოდ reference).'}
              </Typography>
            )}
        </>
      )}

      {phase.k === 'published' && (
        <Alert severity="success" data-testid="canonical-published">
          {en ? 'Published — observations are live.' : 'გამოქვეყნდა — მონაცემები ცოცხალია.'}
        </Alert>
      )}

      {phase.k === 'error' && (
        <Alert severity="error" data-testid="canonical-error">{phase.message}</Alert>
      )}
    </Box>
  )
}
