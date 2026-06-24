// ════════════════════════════════════════════════════════════════════════
// audit-config-validity.ts — backfill audit for the config save-guard flip
// ════════════════════════════════════════════════════════════════════════
//
// ROLE (ADR adr-config-and-render-vision §6): a one-shot, READ-ONLY audit that
//   answers the single question the WARN→REJECT flip waits on:
//     "Is the STORED config corpus already clean against the structural floor?"
//   The save guard (routes/config/pages.ts) runs in WARN mode until this audit
//   reports zero failures; only then is it safe to flip ENFORCE_CONFIG_VALIDATION
//   to true (which starts REJECTING invalid saves) without rejecting configs no
//   worse than what is already persisted.
//
// WHAT IT DOES: over EVERY row in config.page_version, run the EXACT pipeline the
//   save path and the renderer run —
//       validateConfig(migratePageConfig(config))
//   — and report the failing corpus: total versions, # failing, and a sample of
//   the failing {path, code} pairs so the operator can triage before the flip.
//   It writes NOTHING (no DDL, no UPDATE): an audit must never mutate what it
//   audits.
//
// DEPENDENCY: imports validateConfig + migratePageConfig from @statdash/engine —
//   arrow-legal (apps → engine). This is a build-time tool run under tsx, NOT API
//   runtime; the Fastify app never imports it and it never imports the app.
//
// DB-GATED: needs DATABASE_URL (the same precondition as seed.ts). Without it the
//   script exits fast with a clear message — it cannot audit a corpus it cannot read.
//
// USAGE:  DATABASE_URL=… pnpm --filter @statdash/api exec tsx scripts/audit-config-validity.ts
// ════════════════════════════════════════════════════════════════════════

import { Pool } from 'pg'
import { migratePageConfig, validateConfig } from '@statdash/engine'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('[audit-config] DATABASE_URL is required (point it at the migrated database).')
  process.exit(1)
}

// How many failing-sample lines to print (the full failing set could be large;
// a bounded sample is enough to triage before flipping the guard).
const SAMPLE_LIMIT = 20

interface PageVersionRow {
  page_id: string
  version_number: number
  config: unknown
}

interface Failure {
  pageId: string
  version: number
  /** First few {path, code} pairs from the version's validation errors. */
  issues: { path: string; code: string }[]
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: DATABASE_URL })
  try {
    // Every stored version — the audit is over the WHOLE corpus, not just the
    // latest/published version, because the flip rejects on save of ANY config.
    const { rows } = await pool.query<PageVersionRow>(
      `SELECT page_id, version_number, config
         FROM config.page_version
        ORDER BY page_id, version_number`,
    )

    const failures: Failure[] = []
    for (const row of rows) {
      // Mirror the save/read path EXACTLY: migrate first, then validate. A config
      // whose schemaVersion is AHEAD of this build cannot be migrated (migrate
      // throws) — that is itself an audit finding (a future config the current
      // floor cannot assess), surfaced as a distinct pseudo-issue rather than
      // crashing the whole run.
      let migrated: Record<string, unknown>
      try {
        migrated = migratePageConfig(
          (row.config ?? {}) as Record<string, unknown>,
        )
      } catch {
        failures.push({
          pageId: row.page_id,
          version: row.version_number,
          issues: [{ path: '/schemaVersion', code: 'SCHEMA_AHEAD' }],
        })
        continue
      }

      const errors = validateConfig(migrated)
      if (errors.length > 0) {
        failures.push({
          pageId: row.page_id,
          version: row.version_number,
          issues: errors.slice(0, 5).map((e) => ({ path: e.path, code: e.code })),
        })
      }
    }

    // ── Report ────────────────────────────────────────────────────────────
    const total = rows.length
    const failing = failures.length
    console.log('── config validity backfill audit ──────────────────────────')
    console.log(`stored page versions : ${total}`)
    console.log(`failing the floor    : ${failing}`)
    console.log(`clean                : ${total - failing}`)

    if (failing > 0) {
      console.log('')
      console.log(`sample failures (first ${Math.min(SAMPLE_LIMIT, failing)}):`)
      for (const f of failures.slice(0, SAMPLE_LIMIT)) {
        const codes = f.issues.map((i) => `${i.code}@${i.path}`).join(', ')
        console.log(`  page ${f.pageId} v${f.version}: ${codes}`)
      }
      console.log('')
      console.log('CORPUS NOT CLEAN — do NOT flip ENFORCE_CONFIG_VALIDATION yet.')
      // Non-zero exit so CI / an operator can gate the flip on a green audit.
      process.exitCode = 1
    } else {
      console.log('')
      console.log('CORPUS CLEAN — safe to flip ENFORCE_CONFIG_VALIDATION to true.')
    }
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error('[audit-config] unexpected failure:', err)
  process.exit(1)
})
