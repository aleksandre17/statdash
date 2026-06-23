// ── Inner-sidebar slice META + per-element config schema ───────────────
//
//  STRICT SOLID — the inner-sidebar owns its element-specific config here,
//  NOT on the shared ChromeConfig base (ISP/OCP). brandTitle + sectionsLabel
//  are read by THIS shell alone; they are authoring fields of THIS element,
//  so they live on THIS element's PropSchema — the same per-slice seam every
//  other slice kind (nodes/panels/controls) already uses.
//
//  New chrome element = a new meta.ts + its own schema. The shared base is
//  never widened (Open/Closed). The Inspector renders this schema generically
//  (no per-element UI), and the runner injects the authored values as the
//  slot's per-instance `config`, read by the shell via useSlotConfig().
//
import type { ChromeSliceMeta, PropSchema } from '@statdash/react/engine'
import type { LocaleString }                from '@statdash/engine'

// ── InnerSidebarConfig — the per-instance config shape this shell reads ──
//
//  Injected by ChromeSlot for slot="InnerSidebar" from the manifest's
//  chrome["InnerSidebar"].config. Both fields optional: an absent value ⇒
//  the shell omits the element rather than hardcoding any locale.
export interface InnerSidebarConfig {
  /** Wordmark shown in the sidebar header (e.g. the site name). */
  brandTitle?:    LocaleString
  /** Heading above the section-nav list (e.g. "Sections"). */
  sectionsLabel?: LocaleString
}

// ── InnerSidebarSchema — Constructor/Inspector property descriptors ─────
//
//  Both fields are LocaleString authored per-locale: coverage:'localized'
//  marks them for the Inspector's per-locale inputs + gold-completeness
//  enforcement at authoring time.
export const InnerSidebarSchema: PropSchema = [
  {
    field:    'brandTitle',
    type:     'LocaleString',
    coverage: 'localized',
    label:    { ka: 'ბრენდის სათაური', en: 'Brand Title' },
  },
  {
    field:    'sectionsLabel',
    type:     'LocaleString',
    coverage: 'localized',
    label:    { ka: 'სექციების სათაური', en: 'Sections Label' },
  },
]

export const META: ChromeSliceMeta = {
  sliceType:     'chrome',
  slot:          'InnerSidebar',
  key:           'default',
  label:         { ka: 'ნავიგაციის პანელი', en: 'Navigation Sidebar' },
  icon:          'sidebar',
  schema:        InnerSidebarSchema,
  version:       1,
  defaultRegion: 'inline',
  defaultOrder:  0,
}
