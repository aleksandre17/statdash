// ── App-header slice META + per-element config schema ──────────────────
//
//  STRICT SOLID — the header owns its element-specific config here, NOT on
//  the shared ChromeConfig base (ISP/OCP). socialLinks is read by THIS shell
//  alone, so it lives on THIS element's PropSchema — the same per-slice seam
//  every other slice kind already uses. New element = new schema; the base is
//  never widened (Open/Closed).
//
import type { ChromeSliceMeta, PropSchema } from '@statdash/react/engine'

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
export interface AppHeaderConfig {
  socialLinks?: SocialLinkDef[]
}

// ── AppHeaderSchema — Constructor/Inspector property descriptors ────────
export const AppHeaderSchema: PropSchema = [
  {
    field: 'socialLinks',
    type:  'array',
    label: { ka: 'სოციალური ბმულები', en: 'Social Links' },
  },
]

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
}
