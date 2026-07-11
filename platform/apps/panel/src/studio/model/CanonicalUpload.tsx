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
  | { k: 'staged'; result: CanonicalUploadResult }
  | { k: 'publishing' }
  | { k: 'published' }
  | { k: 'error'; message: string }

/** One staged/published job the upload produced (a `jobIds[]` element of the 202). */
interface UploadJob { kind?: string; jobId?: string; status?: string }

/** The review the 202 carries: the SELF-DECLARED dataset identity + per-job breakdown
 *  + the staged facts job (behind the publish gate). A pure projection of the response —
 *  the panel renders what the source declared; it never parses the format (ADR-040). */
function reviewOf(result: CanonicalUploadResult): {
  datasetCode?: string; jobs: UploadJob[]; factsJobId?: string; versioned: boolean
} {
  const jobs  = Array.isArray(result.jobIds) ? (result.jobIds as UploadJob[]) : []
  const facts = jobs.find((j) => j?.kind === 'facts')
  return {
    datasetCode: typeof result.datasetCode === 'string' ? result.datasetCode : undefined,
    jobs,
    factsJobId:  typeof facts?.jobId === 'string' ? facts.jobId : undefined,
    // versionMint is present ONLY on a governed, versioned DSD-change (dims added to
    // the series key) — a statistics-grade governance event the curator must SEE.
    versioned:   !!result.versionMint && typeof result.versionMint === 'object',
  }
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
      setPhase({ k: 'staged', result })
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

      {phase.k === 'staged' && (() => {
        const review = reviewOf(phase.result)
        return (
          <>
            <Divider />
            <Alert severity="info" data-testid="canonical-staged">
              {en
                ? 'The source self-declared its structure. Review, then publish.'
                : 'წყარომ თავად გამოაცხადა თავისი სტრუქტურა. გადახედე და გამოაქვეყნე.'}
            </Alert>
            {review.datasetCode && (
              <Typography variant="body2" data-testid="canonical-dataset">
                {(en ? 'Dataset: ' : 'დატასეტი: ')}<strong>{review.datasetCode}</strong>
              </Typography>
            )}
            {review.versioned && (
              <Alert severity="warning" data-testid="canonical-version">
                {en
                  ? 'A new dataset VERSION was minted (governed DSD change — dimensions added to the series key).'
                  : 'ახალი დატასეტის ვერსია შეიქმნა (მართული DSD-ცვლილება — განზომილება დაემატა series key-ს).'}
              </Alert>
            )}
            {review.jobs.length > 0 && (
              <Box component="ul" sx={{ m: 0, pl: 2 }} data-testid="canonical-jobs">
                {review.jobs.map((j, i) => (
                  <Typography component="li" variant="caption" key={j.jobId ?? i} color="text.secondary">
                    {(j.kind ?? 'job')} — {(j.status ?? '—')}
                  </Typography>
                ))}
              </Box>
            )}
            {review.factsJobId
              ? (
                <Button
                  variant="contained"
                  data-testid="canonical-publish"
                  onClick={() => { const id = review.factsJobId; if (id) void onPublish(id) }}
                  sx={{ alignSelf: 'flex-start', textTransform: 'none' }}
                >
                  {en ? 'Review & publish facts' : 'გადახედე და გამოაქვეყნე facts'}
                </Button>
              )
              : (
                <Typography variant="caption" color="text.secondary">
                  {en ? 'No facts to publish (reference-only upload).' : 'facts არ არის (მხოლოდ reference).'}
                </Typography>
              )}
          </>
        )
      })()}

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
