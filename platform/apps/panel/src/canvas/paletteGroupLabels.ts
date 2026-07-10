// ── paletteGroupLabels — localized palette structural labels (AR-49 M4 Wave 1) ─
//
//  The peer of studio/rail.ts SURFACE_HEADINGS, for the Insert palette: the group
//  headings + the InsertSurface section overlines were hardcoded English literals
//  ("Recommended"/"Data panels"/"Layout"/"Content", "ბლოკები"/"გარსი") — English
//  structural labels leaking into a KA UI (audit finding #7). This is the ONE table
//  those labels live in, resolved at the render seam by the active locale, so the
//  palette never bakes a bare UI string (FF-PALETTE-META-DRIVEN).
//
//  Group KEYS are registry-derived (the capability partition in paletteEntries.ts);
//  only the human HEADING per key is localized here — a new group key = one row.
//
import type { Locale } from '../types/constructor'

/** Localized heading per palette group key (machine key → bilingual heading). */
export const PALETTE_GROUP_LABELS: Record<string, Record<Locale, string>> = {
  recommended: { ka: 'რეკომენდებული',      en: 'Recommended' },
  data:        { ka: 'მონაცემთა პანელები',  en: 'Data panels' },
  layout:      { ka: 'განლაგება',           en: 'Layout' },
  content:     { ka: 'კონტენტი',            en: 'Content' },
}

/**
 * Resolve a palette group heading for the active locale. Falls back to the English
 * heading, then the raw machine key — never renders empty (graceful degradation).
 */
export function paletteGroupHeading(key: string, locale: Locale): string {
  const bag = PALETTE_GROUP_LABELS[key]
  return bag?.[locale] ?? bag?.en ?? key
}

/** The InsertSurface section overlines (blocks vs app-shell chrome), localized. */
export const INSERT_SECTION_LABELS: Record<'blocks' | 'chrome', Record<Locale, string>> = {
  blocks: { ka: 'ბლოკები', en: 'Blocks' },
  chrome: { ka: 'გარსი',   en: 'Chrome' },
}

// ── Leaf-selection hint (Wave 1 / M4.1 Thread A) ──────────────────────────────
//
//  When a LEAF node is selected (a block that accepts no child blocks — e.g. a
//  filter-bar, hero, chart), the context-aware palette honestly offers NO node
//  tile and pivots the author to the right tier: its content is edited in the
//  Inspector (its own props / the filterSchema), not by nesting a child node. This
//  is guidance-by-affordance (the §1.5 doctrine), never a block — a legal insert
//  stays reachable by selecting a container or clearing the selection.
//
export const PALETTE_LEAF_HINT: {
  title: Record<Locale, string>
  body:  Record<Locale, string>
} = {
  title: {
    ka: 'ეს ბლოკი შვილობილ ბლოკებს არ იღებს',
    en: 'This block takes no child blocks',
  },
  body: {
    ka: 'მისი შიგთავსი დაარედაქტირეთ ინსპექტორში (მარჯვენა პანელი).',
    en: 'Edit its content in the Inspector (right panel).',
  },
}
