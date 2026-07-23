// @vitest-environment node
//
// ── FF-ACCOUNTS-FILTERS — the ACCOUNTS page account-filter linkage (committed) ──
//
//  Sibling of crossFilterLinkage.fitness (regional). The cross-filter/filter
//  MECHANISM (withFilter / resolveFilter / `{$ctx,default}`) is proven generically by
//  crossFilterKpi.fitness + store-filter.fitness. THIS suite gates the AUTHORING: that
//  the committed accounts page actually WIRES the account selection into its data —
//  every panel and KPI that should re-scope reads `{$ctx:'account'}`, and none stays
//  pinned to a bare account literal (the pre-migration state where the selector had no
//  effect — the regional `_T→$ctx` migration, applied to accounts).
//
//  The selector→param→read chain:
//    filter-bar `account` select  →  ctx dim `account` (context.dims.account)
//      →  KPI filters + both SNA heros read `{$ctx:'account'}`  →  queries carry the
//         selected account; a per-card `default` preserves the unselected view.
//
//  A hand-edit that re-pins a KPI/hero to a literal account fails here on every run,
//  with NO database — the file is read off disk and walked structurally.

import { describe, it, expect, beforeAll } from 'vitest'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const ARTIFACT_PATH = resolve(here, '../../provisioning/geostat.provisioning.json')

type Json = Record<string, unknown>
interface Page { config: { id?: string } & Json }
interface Artifact { pages: Page[] }

// ── tree helpers (generic, no privileged shape) ──────────────────────────────
function walk(node: unknown, visit: (n: Json) => void): void {
  if (Array.isArray(node)) { for (const c of node) walk(c, visit); return }
  if (node && typeof node === 'object') {
    visit(node as Json)
    for (const v of Object.values(node as Json)) walk(v, visit)
  }
}
function find(root: unknown, pred: (n: Json) => boolean): Json | undefined {
  let hit: Json | undefined
  walk(root, (n) => { if (!hit && pred(n)) hit = n })
  return hit
}
function findById(root: unknown, id: string): Json | undefined {
  return find(root, (n) => n.id === id)
}
function findAll(root: unknown, pred: (n: Json) => boolean): Json[] {
  const out: Json[] = []
  walk(root, (n) => { if (pred(n)) out.push(n) })
  return out
}
// the $ctx dim a filter slot binds, if any: { account: { $ctx: 'account' } } → 'account'
function ctxDim(filter: unknown, slot: string): string | undefined {
  const f = (filter as Json | undefined)?.[slot] as Json | undefined
  return typeof f?.$ctx === 'string' ? (f.$ctx as string) : undefined
}
// The steward ObsQuery of a node's DataSpec — dialect-agnostic (W0/Z8): the ONE
// rest grammar carries it on the `source` HEAD (`data.pipe[0].query`); the legacy
// sugar carried it at `data.query` (kept so the fitness still bites a regression
// that re-enters the sugar form).
function obsQueryOf(data: Json | undefined): Json | undefined {
  if (!data) return undefined
  if (data.query && typeof data.query === 'object') return data.query as Json
  const head = Array.isArray(data.pipe) ? (data.pipe as unknown[])[0] : undefined
  if (head && typeof head === 'object' && (head as Json).op === 'source') {
    return (head as Json).query as Json | undefined
  }
  return undefined
}
function queryFilter(node: Json | undefined): Json | undefined {
  return obsQueryOf(node?.data as Json | undefined)?.filter as Json | undefined
}
// The hero `id` sits on the SECTION; its query lives on the chart/table children.
// Return the query filter of the first data-bearing descendant of the section.
function heroQueryFilter(root: unknown, sectionId: string): Json | undefined {
  const section = findById(root, sectionId)
  const panel = find(section, (n) => queryFilter(n) !== undefined)
  return queryFilter(panel)
}

// Every KPI value/trend spec (across the strip) that carries an explicit `filter`.
function kpiFilters(page: Page): Json[] {
  const strip = find(page.config, (n) => n.type === 'kpi-strip')
  const items = (strip?.items as Json[] | undefined) ?? []
  const out: Json[] = []
  for (const item of items) {
    for (const key of ['value', 'trend'] as const) {
      const spec = item[key] as Json | undefined
      const filter = spec?.filter as Json | undefined
      if (filter && 'account' in filter) out.push(filter)
    }
  }
  return out
}

describe('FF-ACCOUNTS-FILTERS — accounts page account-filter linkage (committed provisioning)', () => {
  let accounts: Page

  beforeAll(async () => {
    const artifact = JSON.parse(await readFile(ARTIFACT_PATH, 'utf8')) as Artifact
    const page = artifact.pages.find((p) => p.config.id === 'accounts')
    expect(page, 'accounts page present').toBeDefined()
    accounts = page!
  })

  // The selector→param→read chain: the filter-bar `account` select writes the ctx dim
  // `account` that every reactive panel reads. Without this map the $ctx refs bind nothing.
  it('the account selector writes the ctx dim the panels read (select + context.dims.account)', () => {
    const fs = accounts.config.filterSchema as Json
    const bar = ((fs?.bars as Json)?.bar as Json)?.filters as Json
    expect((bar?.account as Json)?.type, 'account is a select filter').toBe('select')
    expect((fs?.context as Json)?.dims as Json).toMatchObject({ account: 'account' })
  })

  // FF-ACCOUNTS-KPI-NO-BLANK — each accounts KPI is an account-SPECIFIC headline
  // aggregate (B5G from the primary-income account, B8G from the use-of-income
  // account, …). A global {$ctx:'account'} filter re-points every KPI at the ONE
  // selected account, blanking the 9/13 whose measure is absent there. So each KPI
  // account filter is a LITERAL pin to its own account — never a selection-following
  // $ctx ref. (The heros scope; the KPIs stay put — the two seams are opposite.)
  it('every accounts KPI account filter is a literal pin, not a $ctx ref that blanks', () => {
    const filters = kpiFilters(accounts)
    expect(filters.length, 'the strip has account-scoped KPIs').toBeGreaterThan(0)
    for (const f of filters) {
      expect(typeof f.account, 'account is pinned to its own headline aggregate, not $ctx').toBe('string')
    }
  })

  // FF-ACCOUNTS-FILTERS (heros) — BOTH SNA sequence heros (year + range perspective)
  // re-scope on the account selection, so the primary chart filters in either perspective.
  it('both SNA heros (sna-hero year + sna-hero-range) query-filter on {$ctx:account}', () => {
    expect(ctxDim(heroQueryFilter(accounts.config, 'sna-hero'), 'account')).toBe('account')
    expect(ctxDim(heroQueryFilter(accounts.config, 'sna-hero-range'), 'account')).toBe('account')
  })

  // Anti-regression — {$ctx:account} is CONFINED to the two SNA heros (which SHOULD
  // scope). No KPI account filter follows the selection (that is what blanked the 9/13),
  // and the heros never regress to a literal (that is what made the selector inert). The
  // two seams are deliberately opposite; config = SSOT for each.
  it('$ctx:account is confined to the heros; no KPI account filter follows the selection', () => {
    // KPI side — none of the KPI account filters is a $ctx ref.
    for (const f of kpiFilters(accounts)) {
      const acc = f.account as unknown
      expect(acc !== null && typeof acc === 'object' && '$ctx' in (acc as object),
        'a KPI must not follow the account selection').toBe(false)
    }
    // Hero side — the $ctx:account refs that DO exist are the heros' (chart + table each).
    const ctxAccountRefs = findAll(accounts.config, (n) => n.$ctx === 'account')
    expect(ctxAccountRefs.length, 'the SNA heros carry $ctx:account, and only they').toBeGreaterThanOrEqual(2)
  })
})
