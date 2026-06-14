# tokens.ts

> Reference example (TypeScript) — documentation, not compiled source.

```ts
/**
 * SiteManifest.tokens — CSS variable injection model
 *
 * Two layers of CSS variables:
 *
 *   tokens.css (shared/styles/tokens.css)  — base defaults, checked into source, same for all tenants
 *   manifest.tokens                        — runtime overrides, from DB per tenant (Phase 2)
 *
 * Precedence (standard CSS cascade):
 *   tokens.css:     :root { --geostat-color-primary: #005A9C }   ← stylesheet rule
 *   manifest.tokens: document.documentElement.style              ← inline style on :root → wins
 *   component scoped: element.style or .class --override          ← always wins (more specific)
 *
 * applyTokens() — pre-React bootstrap utility (NOT inside React, NOT in SiteProvider).
 *   document.documentElement.style.setProperty(k, v) per entry.
 *   Synchronous. Called before createRoot — no FOUC even on Phase 2 API fetch.
 */

import { applyTokens }           from '@geostat/react'
import { fetchSiteManifest }     from '../src/data/site-manifest'


// ═══════════════════════════════════════════════════════════════════════════
// main.tsx — bootstrap pattern
// ═══════════════════════════════════════════════════════════════════════════

async function bootstrap() {
  // Phase 1: returns static manifest synchronously
  // Phase 2: fetch('/api/site') → same shape, zero React change
  const manifest = await fetchSiteManifest()

  // ← before createRoot: tokens on :root before first React paint
  applyTokens(manifest.tokens ?? {})

  // React renders with tokens already in place
  // createRoot(document.getElementById('root')!).render(<App manifest={manifest} />)
}


// ═══════════════════════════════════════════════════════════════════════════
// tokens.css — base defaults (source, same for all tenants)
// ═══════════════════════════════════════════════════════════════════════════
//
// src/shared/styles/tokens.css:
//
//   :root {
//     --geostat-color-primary:   #005A9C;   /* Geostat brand blue */
//     --geostat-color-secondary: #E8F0F8;
//     --geostat-color-text:      #1A1A2E;
//     --geostat-color-surface:   #FFFFFF;
//     --geostat-color-border:    #D0D7E1;
//
//     --geostat-chart-color-1:   #005A9C;
//     --geostat-chart-color-2:   #E8812A;
//     --geostat-chart-color-3:   #2CA74B;
//     --geostat-chart-color-4:   #E03B3B;
//
//     --geostat-font-base:       'BPG Arial', Arial, sans-serif;
//     --geostat-font-mono:       'Courier New', monospace;
//
//     --geostat-radius-sm:       4px;
//     --geostat-radius-md:       8px;
//     --geostat-spacing-unit:    8px;
//   }


// ═══════════════════════════════════════════════════════════════════════════
// manifest.tokens — runtime overrides
// ═══════════════════════════════════════════════════════════════════════════

// Phase 1 — static override (same for all sessions, checked in or env-driven)
const STATIC_TOKENS: Record<string, string> = {
  '--geostat-color-primary': '#005A9C',
}

// Phase 2 — per-tenant from DB (Constructor stores this JSON, backend serves it)
const TENANT_TOKENS_EXAMPLE: Record<string, string> = {
  '--geostat-color-primary':   '#C8102E',   // tenant brand red
  '--geostat-color-secondary': '#FFF0F2',
  '--geostat-chart-color-1':   '#C8102E',
  '--geostat-chart-color-2':   '#8B0000',
}

// Calling applyTokens with tenant tokens at bootstrap:
//   applyTokens(TENANT_TOKENS_EXAMPLE)
//   → document.documentElement.style.setProperty('--geostat-color-primary', '#C8102E')
//   → document.documentElement.style.setProperty('--geostat-color-secondary', '#FFF0F2')
//   All components reading var(--geostat-color-primary) immediately see '#C8102E'.

// Updating tokens at runtime (e.g. tenant switches brand mid-session):
//   applyTokens(newTenantTokens)
//   → setProperty overwrites existing values in place
//   → no React re-render needed — CSS variable change is synchronous DOM update


// ═══════════════════════════════════════════════════════════════════════════
// Validation — applyTokens skips invalid keys
// ═══════════════════════════════════════════════════════════════════════════

// applyTokens({ 'primary': '#005A9C' })
//   → console.warn('applyTokens: key "primary" must start with "--", skipping')
//   → setProperty NOT called — no broken inline style injected

// applyTokens({ '--geostat-color-primary': '#005A9C', 'font-size': '14px' })
//   → '--geostat-color-primary' applied ✅
//   → 'font-size': warn + skip ✅  (only --keys are CSS custom properties)


// ═══════════════════════════════════════════════════════════════════════════
// How components use tokens
// ═══════════════════════════════════════════════════════════════════════════
//
// Components reference CSS variables — they never call applyTokens or read manifest.tokens.
// Token change is transparent: CSS re-evaluates automatically.
//
// In component CSS:
//   .section-header { color: var(--geostat-color-primary); }
//   .card           { border-radius: var(--geostat-radius-md); }
//
// In toApexOptions (chart colors):
//   colors: [
//     'var(--geostat-chart-color-1)',
//     'var(--geostat-chart-color-2)',
//     ...
//   ]
//   // ApexCharts resolves CSS variables at render time — tenant token change = chart recolors.
//   // output.palette (data-driven) overrides this when ChartRenderer sets it explicitly.


// ═══════════════════════════════════════════════════════════════════════════
// What NOT to do
// ═══════════════════════════════════════════════════════════════════════════

// Constructor live preview — no conflict:
//   Canvas preview = iframe of actual app (see SKELETON.md: "canvas preview = iframe of actual app").
//   Constructor changes token → iframe refresh → new bootstrap → applyTokens(newTokens) → preview updates.
//   Same pattern as Grafana panel preview and Builder.io canvas — iframe refresh on config change.
//   No special reactive mechanism needed in the app itself.

// ❌ applyTokens inside SiteProvider useLayoutEffect:
//    SRP: context provision ≠ DOM mutation. SiteProvider's job is React context, not :root styling.
//    useLayoutEffect runs after first render — brief FOUC on slow connections.
//    Fix: call applyTokens before createRoot (bootstrap, not React lifecycle).

// ❌ applyTokens inside a React component render or effect (other than bootstrap):
//    Any component calling setProperty on :root = global side effect from a local component.
//    If tokens need to update reactively → call applyTokens at the manifest-fetch call site,
//    not inside a component.

// ❌ Hardcoding CSS variable values in component code instead of tokens.css:
//    const color = '#005A9C'   ← bypasses token system, tenant override won't work
//    const color = 'var(--geostat-color-primary)'   ← correct

// ❌ Storing non-CSS-custom-property keys in manifest.tokens:
//    { 'color': '#005A9C' }   ← invalid, applyTokens warns + skips
//    { '--geostat-color-primary': '#005A9C' }   ← correct

// declare to satisfy type check:
declare const document: { getElementById(id: string): Element | null }
declare const React: unknown
```
