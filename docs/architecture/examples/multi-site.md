# multi-site.ts

> Reference example (TypeScript) — documentation, not compiled source.

```ts
/**
 * Example — Multi-site: same plugins/, different manifests
 *
 * Core insight: brand is not code.
 *   plugins/ = structural + functional shells (token consumers)
 *   manifest.tokens = brand identity (token values, set by Constructor)
 *
 * New site (ENstat, ArmStat, etc.) = new manifest DB record.
 * Zero new code. Zero new deployments. Same binary.
 *
 * Platform precedents:
 *   Builder.io: same components, different content/styles per space
 *   Grafana:    same plugins, different dashboard JSON per org
 *   WordPress:  same theme, different CSS variables per site (theme.json)
 *   shadcn/ui:  same components, CSS variables per project
 */

import type { SiteManifest } from '@geostat/react'
import { applyTokens }       from '@geostat/react'


// ═══════════════════════════════════════════════════════════════════════════
// Token architecture — two layers
// ═══════════════════════════════════════════════════════════════════════════
//
// Layer 1 — src/shared/styles/tokens.css (checked into source):
//   :root {
//     --color-primary:     #005A9C;   /* default Geostat blue */
//     --color-accent:      #E8812A;
//     --color-text:        #1A1A2E;
//     --color-surface:     #FFFFFF;
//     --color-border:      #D0D7E1;
//     --color-on-primary:  #FFFFFF;
//     --font-base:         'BPG Arial', Arial, sans-serif;
//     --radius-md:         8px;
//     --spacing-md:        16px;
//     /* ... */
//   }
//
// Layer 2 — manifest.tokens (per-site, from Constructor/DB):
//   Applied via applyTokens() BEFORE React mounts — inline styles on :root
//   Inline styles win over stylesheet rules → correct cascade without !important
//   applyTokens({ '--color-primary': '#003F87' })
//   → document.documentElement.style.setProperty('--color-primary', '#003F87')
//
// Result: Layer 2 overrides Layer 1. Components see Layer 2 values automatically.


// ═══════════════════════════════════════════════════════════════════════════
// Manifests per site — all from Constructor DB
// ═══════════════════════════════════════════════════════════════════════════

// Geostat — Georgian Statistics (default deployment)
const GEOSTAT_MANIFEST: Pick<SiteManifest, 'chrome' | 'tokens'> = {
  chrome: {
    AppHeader:  'default',   // full header with logo + nav
    AppSidebar: 'default',   // expanded sidebar
    AppFooter:  'default',
  },
  tokens: {
    '--color-primary':    '#005A9C',   // Geostat blue
    '--color-accent':     '#E8812A',
    '--color-text':       '#1A1A2E',
    '--color-surface':    '#FFFFFF',
    '--font-base':        "'BPG Arial', Arial, sans-serif",
  },
}

// ENstat — Estonian Statistics (same plugins/, different manifest)
const ENSTAT_MANIFEST: Pick<SiteManifest, 'chrome' | 'tokens'> = {
  chrome: {
    AppHeader:  'compact',   // compact header (no sidebar, horizontal nav)
    AppSidebar: 'hidden',    // no sidebar
    AppFooter:  'minimal',
  },
  tokens: {
    '--color-primary':    '#003F87',   // ENstat navy
    '--color-accent':     '#0074D9',
    '--color-text':       '#1A1A2E',
    '--color-surface':    '#F8F9FA',
    '--font-base':        "'Roboto', Arial, sans-serif",   // Estonian sites use Roboto
  },
}

// ArmStat — Armenian Statistics (another deployment)
const ARMSTAT_MANIFEST: Pick<SiteManifest, 'chrome' | 'tokens'> = {
  chrome: {
    AppHeader:  'default',
    AppSidebar: 'collapsed',   // collapsed by default (sidebar icons only)
    AppFooter:  'minimal',
  },
  tokens: {
    '--color-primary':    '#CC0000',   // Armenian red
    '--color-accent':     '#FF6633',
    '--color-text':       '#1A1A2E',
    '--color-surface':    '#FFFFFF',
    '--font-base':        "'Arial', sans-serif",
  },
}

// Constructor brand panel writes tokens to DB per site:
//   UPDATE site_manifests SET tokens = $json WHERE site_id = 'enstat'
// Same UI for all three sites. Zero code change between deployments.


// ═══════════════════════════════════════════════════════════════════════════
// Shell CSS — structural only, token consumers
// ═══════════════════════════════════════════════════════════════════════════
//
// plugins/nodes/section/SectionShell.css:
//
//   /* ZERO hardcoded colors. ZERO org names. Pure token consumption. */
//   .section {
//     border-left: 3px solid var(--color-accent);
//     padding: var(--spacing-md);
//   }
//   .toggle-btn--active {
//     background: var(--color-primary);
//     color: var(--color-on-primary);
//   }
//   .section__subtitle {
//     color: var(--color-text);
//     font-family: var(--font-base);
//   }
//
// Geostat:  --color-primary = #005A9C → blue active toggle
// ENstat:   --color-primary = #003F87 → navy active toggle
// ArmStat:  --color-primary = #CC0000 → red active toggle
// Same CSS. Different tokens. Zero code per org.


// ═══════════════════════════════════════════════════════════════════════════
// Token application — bootstrap pattern
// ═══════════════════════════════════════════════════════════════════════════

async function bootstrapExample() {
  // Same binary. Different API endpoint per deployment.
  // Geostat: /api/site returns GEOSTAT_MANIFEST
  // ENstat:  /api/site returns ENSTAT_MANIFEST (different DB record)
  const manifest = await fetch('/api/site').then(r => r.json()) as SiteManifest

  // Apply BEFORE React — first paint has correct brand colors
  applyTokens(manifest.tokens ?? {})

  // React mounts with tokens already in place → no FOUC, no color flash
  // createRoot(...).render(<App manifest={manifest} />)
}

// applyTokens implementation (engine/react/src/chrome/applyTokens.ts):
//
//   export function applyTokens(tokens: Record<string, string>): void {
//     const root = document.documentElement
//     for (const [key, value] of Object.entries(tokens)) {
//       if (!key.startsWith('--')) {
//         console.warn(`applyTokens: "${key}" must start with "--", skipping`)
//         continue
//       }
//       root.style.setProperty(key, value)
//     }
//   }
//
// Inline styles on :root win over stylesheet rules (higher specificity).
// Synchronous. No React needed. No FOUC.


// ═══════════════════════════════════════════════════════════════════════════
// Constructor token panel — how brand is set
// ═══════════════════════════════════════════════════════════════════════════
//
// Constructor UI: "Brand" tab
//   Color picker → --color-primary
//   Color picker → --color-accent
//   Font selector → --font-base
//   Spacing slider → --spacing-md, --spacing-sm
//   Radius slider → --radius-md
//
// Constructor writes to DB:
//   UPDATE site_manifests
//   SET tokens = '{"--color-primary":"#C8102E","--color-accent":"#FF6633",...}'
//   WHERE site_id = $siteId
//
// On next page load (or live preview iframe refresh):
//   fetchSiteManifest() → manifest.tokens = { '--color-primary': '#C8102E', ... }
//   applyTokens(manifest.tokens) → :root updated
//   All shells recolored → live preview shows new brand ✅
//
// ZERO code involved. Constructor is the brand tool.
// plugins/ shells never know which org is using them.


// ═══════════════════════════════════════════════════════════════════════════
// Anti-patterns
// ═══════════════════════════════════════════════════════════════════════════

// ❌ Brand in shell code:
//    plugins/nodes/section/SectionShell.tsx:
//    <section className="geostat-section">   ← org name hardcoded
//    → ENstat cannot use this shell without code change
//
// ✅ Generic class, token CSS:
//    <section className="section">
//    .section { border-left: 3px solid var(--color-accent); }

// ❌ Brand in plugins/ folder name:
//    plugins/geostat/nodes/section/   ← org name in folder = org owns it
//    → ENstat needs plugins/enstat/nodes/section/ → code per org → not a platform
//
// ✅ Generic folder:
//    plugins/nodes/section/   ← no org ownership
//    manifest.tokens decides brand at runtime

// ❌ Per-org code directories:
//    src/geostat/   ← every new org = new directory = not a platform
//    src/enstat/
//
// ✅ Single codebase + manifests:
//    src/                 ← one bootstrap
//    plugins/             ← one library
//    DB: site_manifests   ← one row per org (Constructor manages)

// ❌ Org-specific ThemeConfig:
//    export const ENSTAT_THEME = mergeTheme(DEFAULT_THEME, { ... })
//    → compile-time brand = can't be changed without redeploy
//
// ✅ Runtime tokens:
//    manifest.tokens → applyTokens() → CSS :root → components update
//    Constructor changes → DB update → page refresh → new brand ✅

// declare for type-checking:
declare const document: { documentElement: { style: { setProperty(k: string, v: string): void } } }
```
