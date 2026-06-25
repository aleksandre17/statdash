// ── Provisioning — idempotent data_source upsert (one concern) ────────────────
//
// Split from upsert.ts (one-body hygiene): the config.data_source upserter the
// geostat client + panel read at boot to build their store manifest. Transactional
// and idempotent like its siblings; depends only on the narrow PgPool port.

import type { PgPool, ApplyCtx, ResourceResult, UpsertOutcome, DataSourceProvision } from './types.js'
import { jsonEqual, errMsg } from './util.js'

/**
 * Upsert a data source by name. V3 has no UNIQUE on name, so the conflict key is
 * emulated with SELECT … FOR UPDATE inside the transaction (no check-then-write
 * race against concurrent boots).
 *
 * url = NULL when omitted (single-origin reverse-proxy topology — the client uses
 * its own relative `/api` base). status defaults to 'connected' so the public
 * GET /api/data-sources (which filters status='connected') surfaces the row; the
 * DB column default ('idle') is deliberately NOT relied on. Re-provisioning an
 * unchanged row (incl. the manually-seeded ones) reconciles to 'unchanged'.
 */
export async function upsertDataSource(pg: PgPool, src: DataSourceProvision, ctx: ApplyCtx): Promise<ResourceResult> {
  const key = src.name
  if (ctx.dryRun) {
    ctx.log.info({ name: key, type: src.type }, 'provisioning[dry-run]: would upsert data source')
    return { kind: 'dataSource', key, outcome: 'skipped', reason: 'dry-run' }
  }

  // url: OMITTED ⇒ NULL. Single-origin reverse-proxy topology — the client uses its
  // own relative `/api` base when url is null; localhost here would break the SPA.
  const url = src.url ?? null
  // A declared source is meant to be live: default to 'connected' (mirrors a page
  // defaulting to 'published'). The DB column default is 'idle', which the public
  // GET /api/data-sources filters out — so leaving status unset would render the
  // source invisible. We set it explicitly rather than rely on the column default.
  const status = src.status ?? 'connected'
  const config = JSON.stringify(src.config ?? {})

  const client = await pg.connect()
  try {
    await client.query('BEGIN')
    const { rows: existing } = await client.query<{
      id: string; type: string; url: string | null; config: unknown; status: string
    }>(
      `SELECT id, type, url, config, status FROM config.data_source WHERE name = $1 FOR UPDATE`,
      [key],
    )
    let outcome: UpsertOutcome
    if (existing[0]) {
      const cur = existing[0]
      // Change-detection short-circuit (mirrors page/siteConfig): an unchanged row —
      // including the manually-seeded ones already at url=NULL, status='connected' —
      // reconciles to 'unchanged' with no write churn (and no updated_at trigger fire).
      const unchanged =
        cur.type === src.type &&
        cur.url === url &&
        cur.status === status &&
        jsonEqual(cur.config, src.config ?? {})
      if (unchanged) {
        await client.query('COMMIT')
        ctx.log.info({ name: key, outcome: 'unchanged' }, 'provisioning: data source')
        return { kind: 'dataSource', key, outcome: 'unchanged' }
      }
      await client.query(
        `UPDATE config.data_source SET type = $2, url = $3, config = $4, status = $5 WHERE id = $1`,
        [cur.id, src.type, url, config, status],
      )
      outcome = 'updated'
    } else {
      await client.query(
        `INSERT INTO config.data_source (name, type, url, config, status) VALUES ($1, $2, $3, $4, $5)`,
        [key, src.type, url, config, status],
      )
      outcome = 'created'
    }
    await client.query('COMMIT')
    ctx.log.info({ name: key, outcome }, 'provisioning: data source')
    return { kind: 'dataSource', key, outcome }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    ctx.log.error({ name: key, error: errMsg(err) }, 'provisioning: data source failed')
    return { kind: 'dataSource', key, outcome: 'skipped', reason: errMsg(err) }
  } finally {
    client.release()
  }
}
