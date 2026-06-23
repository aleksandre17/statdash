// ── Fitness function — committed geostat provisioning artifact invariants ─────
//
// ADR-0026 Phase B, decision 3: slug === config.id, enforced at BOTH generation
// (the export script's fail-fast) AND here, as a NO-DB fitness test over the
// committed artifact. This is the cheap, always-on gate: if anyone hand-edits the
// generated JSON (or the export script regresses) so a page's slug diverges from
// its config.id, the index page + nav targets silently break — this test catches
// it without a database, on every run.
//
// Needs no DATABASE_URL: it reads the committed file off disk and asserts pure
// structural invariants. (The DB round-trip equivalence is the parity suite in
// bootstrap-parity.fitness.test.ts, which skips without a live DB.)

import { describe, it, expect, beforeAll } from 'vitest'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
// src/provisioning → apps/api/provisioning/geostat.provisioning.json
const ARTIFACT_PATH = resolve(here, '../../provisioning/geostat.provisioning.json')

interface PageEntry { slug: string; title: Record<string, string>; config: { id?: unknown }; status?: string }
interface SiteEntry { key: string; value: unknown }
interface Artifact  { version: number; pages: PageEntry[]; siteConfig: SiteEntry[] }

describe('committed geostat provisioning artifact (ADR-0026 Phase B)', () => {
  let artifact: Artifact

  beforeAll(async () => {
    artifact = JSON.parse(await readFile(ARTIFACT_PATH, 'utf8')) as Artifact
  })

  it('is a version-1 ProvisioningManifest with pages and siteConfig', () => {
    expect(artifact.version).toBe(1)
    expect(Array.isArray(artifact.pages)).toBe(true)
    expect(artifact.pages.length).toBeGreaterThan(0)
    expect(Array.isArray(artifact.siteConfig)).toBe(true)
  })

  // DECISION 3 — the load-bearing invariant.
  it('every page slug === config.id (decision 3)', () => {
    for (const page of artifact.pages) {
      expect(typeof page.config.id).toBe('string')
      expect(page.slug).toBe(page.config.id)
    }
  })

  it('every page is provisioned as published (so bootstrap returns it)', () => {
    for (const page of artifact.pages) {
      expect(page.status).toBe('published')
    }
  })

  it('carries the 6 site_config keys (decision 1)', () => {
    const keys = artifact.siteConfig.map((s) => s.key).sort()
    expect(keys).toEqual(
      ['chrome', 'chrome_config', 'i18n', 'index_page_id', 'modes', 'nav'].sort(),
    )
  })

  it('index_page_id points at a provisioned page id (the renderer index route resolves)', () => {
    const indexEntry = artifact.siteConfig.find((s) => s.key === 'index_page_id')
    const indexId = indexEntry?.value
    expect(typeof indexId).toBe('string')
    const pageIds = new Set(artifact.pages.map((p) => p.config.id))
    expect(pageIds.has(indexId as string)).toBe(true)
  })
})
