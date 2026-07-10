// ── App-header slice META + per-element config schema ──────────────────
//
//  STRICT SOLID — the header owns its element-specific config here, NOT on
//  the shared ChromeConfig base (ISP/OCP). socialLinks is read by THIS shell
//  alone, so it lives on THIS element's PropSchema — the same per-slice seam
//  every other slice kind already uses. New element = new schema; the base is
//  never widened (Open/Closed).
//
import type { ChromeSliceMeta } from '@statdash/react/engine'
import { defineSchema, type AssertSchemaCovers, type Expect } from '../../../schema-contract'

// ── SocialLinkDef — one social-media link rendered in the header actions ──
//
//  Owned by the header (its sole consumer), not the shared chrome base.
export interface SocialLinkDef {
  href:  string
  label: string       // aria-label for accessibility
  icon:  string       // SVG path d attribute
  fill?: boolean      // true = filled, false = stroked
}

// ── AppHeaderConfig — the per-instance config shape this shell reads ─────
//
//  Injected by ChromeRegion for slot="AppHeader" from the manifest's
//  chrome["AppHeader"].config. Absent ⇒ the shell omits the social row.
//
//  `showNav` gates the primary top-nav row (the same useSiteNav() SSOT the
//  inner sidebar also consumes). It defaults to `true` (expand/contract —
//  existing configs keep their nav); a tenant that surfaces the site nav
//  ONLY in the sidebar / hero cards sets `showNav: false` to suppress the
//  redundant header duplicate WITHOUT emptying the shared nav SSOT (which
//  would also strip the sidebar). Declarative per-tenant, no render-code
//  deletion — other tenants keep the header nav.
export interface AppHeaderConfig {
  socialLinks?: SocialLinkDef[]
  showNav?:     boolean
}

// ── SocialLinkItemSchema — the per-LINK nested schema (D7.2 / ADR-022) ───────
//  Structured authoring for a header social link. `icon` is the raw SVG path `d`
//  string (matching SocialLinkDef.icon: string); `label` is the aria-label.
export const SocialLinkItemSchema = defineSchema([
  { field: 'href',  type: 'string',  label: { ka: 'ბმული',        en: 'URL' }, required: true },
  { field: 'label', type: 'string',  label: { ka: 'წარწერა (aria)', en: 'Label (aria)' }, required: true },
  { field: 'icon',  type: 'string',  label: { ka: 'SVG იკონა (path d)', en: 'SVG icon (path d)' }, required: true },
  { field: 'fill',  type: 'boolean', label: { ka: 'შევსებული', en: 'Filled' } },
])

// FF-SCHEMA-COMPLETE depth (tier c): 1:1 with SocialLinkDef's editable keys.
export type _SocialLinkCovers = Expect<AssertSchemaCovers<SocialLinkDef, typeof SocialLinkItemSchema>>

// ── AppHeaderSchema — Constructor/Inspector property descriptors ────────
export const AppHeaderSchema = defineSchema([
  {
    field: 'socialLinks',
    type:  'array',
    label: { ka: 'სოციალური ბმულები', en: 'Social Links' },
    itemSchema: SocialLinkItemSchema,
    itemLabel: 'label',
  },
  {
    field: 'showNav',
    type:  'boolean',
    label: { ka: 'ზედა ნავიგაციის ჩვენება', en: 'Show top navigation' },
  },
])

export const META: ChromeSliceMeta = {
  sliceType:     'chrome',
  slot:          'AppHeader',
  key:           'default',
  label:         { ka: 'სრული სათაური', en: 'Full Header' },
  icon:          'layout-template',
  schema:        AppHeaderSchema,
  version:       1,
  defaultRegion: 'top',
  defaultOrder:  10,
  i18n: {
    ka: { 'nav-label': 'მთავარი ნავიგაცია' },
    en: { 'nav-label': 'Main navigation' },
  },
}
