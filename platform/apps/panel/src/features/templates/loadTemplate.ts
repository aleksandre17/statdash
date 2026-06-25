// ── loadTemplate — turn a chosen config into a new, persisted page (V7) ──────
//
//  The bridge from "author picked a starter / generated a dashboard" to "a real
//  page in the store". PURE projection + the EXISTING persistence path:
//    1. stamp the chosen NodePageConfig with the new page's identity (id/path)
//    2. fromNodePageConfig → the flat CanvasPage the store holds (the SAME
//       adapter every loaded page goes through — no parallel hydration)
//    3. createPage (the SAME thunk PageBrowser's "New page" uses) — which runs
//       the C5 save-guard (migrate-identity + round-trip + per-node-valid +
//       locale-complete) BEFORE the server write and sets the page active.
//
//  So a template/generated page reaches the store through the identical gate a
//  hand-built page does — a starter cannot bypass validation (the V7 additive
//  invariant: templates/generated configs are VALID configs).
//
import type { NodePageConfig } from '@statdash/react/engine'
import { fromNodePageConfig } from '../../canvas/canvasPageAdapter'
import { createPage } from '../../store/api-actions'
import type { CanvasPage } from '../../types/constructor'

/** Derive a url-safe slug (server requires ^[a-z0-9-]+$). Mirrors PageBrowser. */
export function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

/**
 * Project a chosen page config (a starter template or a generated dashboard)
 * onto a freshly-named page and hydrate it into the store's flat model. PURE —
 * no persistence — so it is unit-testable in isolation and reused by createFromTemplate.
 *
 * The config's placeholder `id`/`path` are REPLACED with the new page's slug-
 * derived identity, and every descendant node keeps its (template-stable) id —
 * so two pages from the same starter never collide at the page level.
 */
export function hydrateTemplate(
  config: NodePageConfig,
  title: { ka: string; en: string },
  slug: string,
): CanvasPage {
  const stamped = { ...(config as unknown as Record<string, unknown>), id: slug, path: slug }
  return fromNodePageConfig(stamped as unknown as NodePageConfig, title)
}

/**
 * Create + persist a page from a chosen config through the standard createPage
 * path (save-guard + server write + activate). Returns the created page.
 * Throws SaveGuardError if the produced config fails the guard (which it must
 * not, for a committed starter / a profile-bound generation — the fitness tests
 * pin that). Used by the gallery's pick handler and the data-first generate.
 */
export async function createFromTemplate(
  config: NodePageConfig,
  title: { ka: string; en: string },
): Promise<CanvasPage> {
  const slug = slugify(title.en || title.ka) || 'page'
  const page = hydrateTemplate(config, title, slug)
  // createPage takes Omit<CanvasPage,'id'> — it assigns the server id; the slug
  // carries the addressable path. Strip our placeholder id so the server owns it.
  const { id: _placeholderId, ...rest } = page
  return createPage(rest)
}
