// ── Provisioning loader — file-based, GitOps config ingestion [P2-5] ──────────
//
// The Phase-1 → Phase-2 switch documented in apps/geostat/src/data/site-manifest.ts:
// where Phase 1 builds the SiteManifest from TypeScript imports, this loader lets
// the same artifacts (pages, nav, data sources) be authored as JSON/YAML files in
// a directory and upserted into config.* on boot. Config-in-files = reproducible
// deploys: the repo is the single source of truth, every boot re-applies it, so a
// fresh environment converges on the committed state.
//
// PIPELINE (Pipe-and-Filter): discover → parse/normalize → upsert. Discovery and
// parsing live in ./parse.ts; the idempotent upserts in ./upsert.ts; the shared
// contracts in ./types.ts. This file is only the orchestrator.

import { discoverFiles, parseFile } from './parse.js'
import { upsertPage, upsertDataSource, upsertNavItem, upsertSiteConfig, upsertContentConstraint } from './upsert.js'
import { resolveDir, errMsg } from './util.js'
import {
  consoleLogger,
  type PgPool, type ProvisioningOptions, type ProvisioningReport,
  type ProvisioningManifest, type ApplyCtx, type UpsertOutcome,
} from './types.js'

export type {
  PgPool, PgClient, QueryResult, ProvisioningLogger,
  ProvisioningManifest, ProvisioningOptions, ProvisioningReport,
  PageProvision, NavItemProvision, DataSourceProvision, SiteConfigProvision,
  ContentConstraintProvision, ContentConstraintMemberProvision,
  ResourceResult, UpsertOutcome, LocaleString,
} from './types.js'

/**
 * Boot entry point. Reads every *.json / *.yaml / *.yml file in `dir`, parses each
 * into a ProvisioningManifest (or a single page config), and upserts the declared
 * resources idempotently. Returns a report (also logged).
 *
 * FAIL-SOFT (graceful degradation): one malformed file is recorded in `failures`
 * and skipped; the rest still apply. A missing directory is a no-op (provisioning
 * is optional for boot). A failure inside a DB transaction rolls that resource
 * back and is recorded; it does not abort the whole run.
 */
export async function runProvisioning(
  pg: PgPool,
  opts: ProvisioningOptions = {},
): Promise<ProvisioningReport> {
  const dir = resolveDir(opts.dir ?? './provisioning')
  const dryRun = opts.dryRun ?? false
  const log = opts.logger ?? consoleLogger

  const report: ProvisioningReport = {
    dir, dryRun, files: 0, parsed: 0, results: [], failures: [],
  }

  const files = await discoverFiles(dir, log)
  if (files === null) {
    log.info({ dir }, 'provisioning: directory not found, skipping')
    return report
  }
  report.files = files.length

  for (const file of files) {
    let manifest: ProvisioningManifest
    try {
      manifest = await parseFile(file)
    } catch (err) {
      report.failures.push({ file, error: errMsg(err) })
      log.error({ file, error: errMsg(err) }, 'provisioning: failed to parse file')
      continue
    }
    report.parsed++
    await applyManifest(pg, manifest, { dryRun, log }, report)
  }

  log.info({ dir, dryRun, ...summarize(report) }, 'provisioning: complete')
  return report
}

/**
 * Apply one manifest. Order is deliberate: siteConfig → pages → dataSources → nav.
 * Site-level settings first (no dependency, but they describe the site the rest
 * populates); then pages and data sources; nav last — an internal nav item resolves
 * its target by page slug, so a page provisioned in the same run already exists when
 * nav is applied. (Site-level nav lives as a site_config 'nav' blob per ADR-0026;
 * the relational navItems path stays for the Constructor's authoring model.)
 */
async function applyManifest(
  pg: PgPool,
  manifest: ProvisioningManifest,
  ctx: ApplyCtx,
  report: ProvisioningReport,
): Promise<void> {
  for (const entry of manifest.siteConfig ?? []) {
    report.results.push(await upsertSiteConfig(pg, entry, ctx))
  }
  for (const page of manifest.pages ?? []) {
    report.results.push(await upsertPage(pg, page, ctx))
  }
  for (const src of manifest.dataSources ?? []) {
    report.results.push(await upsertDataSource(pg, src, ctx))
  }
  // Authored allowed cube regions (ADR-0027). Datasets come from migrations/seed,
  // not the manifest, so this has no intra-manifest ordering dependency.
  for (const cc of manifest.contentConstraints ?? []) {
    report.results.push(await upsertContentConstraint(pg, cc, ctx))
  }
  for (const nav of manifest.navItems ?? []) {
    report.results.push(await upsertNavItem(pg, nav, ctx))
  }
}

function summarize(report: ProvisioningReport): Record<UpsertOutcome | 'failures', number> {
  const base: Record<UpsertOutcome | 'failures', number> = {
    created: 0, updated: 0, unchanged: 0, skipped: 0, failures: report.failures.length,
  }
  for (const r of report.results) base[r.outcome]++
  return base
}
