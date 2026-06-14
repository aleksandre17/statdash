// ── Page Registry — Track A ────────────────────────────────────────────
//
//  Single source of truth for all NodePageConfig pages.
//  Imports from src/pages/ (new format) — old features/ pages replaced.
//
//  Phase 2 drop-in:
//    Replace loadPage() body with:
//      const res = await fetch(`/api/pages/${id}`)
//      return res.ok ? res.json() : null
//    No other changes needed.
//
import type { NodePageConfig } from '@geostat/react/engine'
import { LANDING_CONFIG }      from '../../pages/landing.config'
import { GDP_PAGE }            from '../../pages/gdp.config'
import { ACCOUNTS_PAGE }       from '../../pages/accounts.config'
import { REGIONAL_PAGE }       from '../../pages/regional.config'

const ALL_PAGES: NodePageConfig[] = [LANDING_CONFIG, GDP_PAGE, ACCOUNTS_PAGE, REGIONAL_PAGE]

// ── loadPage ──────────────────────────────────────────────────────────

export async function loadPage(id: string): Promise<NodePageConfig | null> {
  await Promise.resolve()   // yield — matches async API contract
  return ALL_PAGES.find(p => p.id === id) ?? null
}

// ── listPages ─────────────────────────────────────────────────────────

export function listPages(): NodePageConfig[] {
  return ALL_PAGES
}