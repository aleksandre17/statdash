# renderer-section.md

> Reference example (TypeScript) — documentation, not compiled source.

```tsx
/**
 * Example — SectionShell (correct pattern)
 *
 * Demonstrates:
 * - Shell = NodeRenderer directly: (def, ctx, children) => ReactNode
 * - NO indirection through ctx.theme.shells — engine calls Shell directly
 * - Component wrapper pattern: hooks live in inner React component
 * - Role toggle: generic — never hardcodes 'chart'/'table'
 * - Token-driven CSS: zero brand in code, var(--color-primary) etc.
 * - ctx.view reads — NEVER def.view (engine resolves ExprVal at step 4)
 */

import { useState }    from 'react'
import type { SectionNode, RenderContext, ChildrenArg, NodeRenderer } from '@geostat/react'

// ── plugins/nodes/section/SectionShell.tsx ───────────────────────────────────
//
// NodeRenderer = plain function. NOT a React component.
// Engine calls this as: Shell(def, ctx, children) — no hooks allowed.
// Delegate immediately to inner React component which can use hooks.
//
// Token-driven: CSS uses var(--color-primary), var(--color-border) etc.
// Constructor sets manifest.tokens → applyTokens() → CSS :root → this shell recolors.
// No brand name in this file. Any org can use it as-is.

export const SectionShell: NodeRenderer<SectionNode> = (
  def:      SectionNode,
  ctx:      RenderContext,
  children: ChildrenArg,
) => <SectionControl def={def} ctx={ctx} children={children} />
// ← inner component owns all hooks and state


// ── Inner component — React component, hooks valid ───────────────────────────

function SectionControl({ def, ctx, children }: {
  def:      SectionNode
  ctx:      RenderContext
  children: ChildrenArg
}) {
  // ctx.view = engine resolved ExprVal → ResolvedViewParams at step 4
  // NEVER read def.view directly — it's still ExprVal (unresolved)
  const view = ctx.view

  // Role toggle — collect distinct roles from children
  // Generic: works for 'chart'+'table', 'map'+'table', 'annual'+'quarterly' — any strings
  // no role → child always visible | has role → visible only if role === activeRole
  const roles = [...new Set(
    children.defs.map(d => d.layout?.role).filter((r): r is string => !!r)
  )]
  const [activeRole, setActiveRole] = useState<string | undefined>(roles[0])

  return (
    <section className="section">
      <div className="section__header">
        {view.subtitle && (
          <p className="section__subtitle">{view.subtitle}</p>
        )}

        {roles.length > 1 && (
          <div className="section__toggle" role="group">
            {roles.map(role => {
              const label = children.defs.find(d => d.layout?.role === role)?.layout?.label ?? role
              return (
                <button
                  key={role}
                  className={`toggle-btn ${role === activeRole ? 'toggle-btn--active' : ''}`}
                  onClick={() => setActiveRole(role)}
                >
                  {label}
                </button>
              )
            })}
          </div>
        )}

        {view.exportable && (
          <button className="section__export-btn">გადმოწერა</button>
        )}
      </div>

      {/* ALL children always rendered — CSS controls visibility. No remount on toggle. */}
      {children.rendered.map((child, i) => {
        const role = children.defs[i].layout?.role
        const visible = !role || role === activeRole
        return (
          <div key={i} className={`section__view ${visible ? 'section__view--visible' : 'section__view--hidden'}`}>
            {child}
          </div>
        )
      })}
    </section>
  )
}

// ── CSS: token-driven, zero brand ────────────────────────────────────────────
//
// plugins/nodes/section/SectionShell.css:
//
//   .section {
//     border-left: 3px solid var(--color-accent);     ← token, not hardcoded
//     padding: var(--spacing-md);
//     background: var(--color-surface);
//   }
//   .section__subtitle {
//     color: var(--color-text-secondary);
//     font-size: var(--font-size-sm);
//   }
//   .toggle-btn {
//     background: transparent;
//     border: 1px solid var(--color-border);
//     color: var(--color-text);
//   }
//   .toggle-btn--active {
//     background: var(--color-primary);
//     color: var(--color-on-primary);
//   }
//   .section__view--hidden { display: none; }
//   .section__view--visible { display: contents; }
//
// manifest.tokens sets:
//   { '--color-primary': '#005A9C', '--color-accent': '#E8812A', ... }  ← Geostat
//   { '--color-primary': '#003F87', '--color-accent': '#C8102E', ... }  ← ENstat
//   Same shell. Different site. Zero code change.


// ── SectionSkeleton — separate export, NOT in META ───────────────────────────
//
// Skeleton is a function → cannot be in META (not JSON-serializable).
// registerSlice adds it to nodeRegistry separately.

export function SectionSkeleton({ layout }: { layout?: { span?: string } }) {
  return (
    <div className={`node-skeleton node-skeleton--section node-skeleton--${layout?.span ?? 'default'}`}>
      <div className="node-skeleton__header" />
      <div className="node-skeleton__body" />
    </div>
  )
}


// ── plugins/nodes/section/index.ts ───────────────────────────────────────────
//
// import { SectionShell    } from './SectionShell'
// import { SectionSkeleton } from './SectionShell'
// export { SectionShell    as Shell    }
// export { SectionSkeleton as Skeleton }
// export const META: NodeSliceMeta = {
//   type:     'section',
//   variant:  'default',
//   label:    'სექცია',
//   icon:     'layout-section',
//   category: 'layout',
//   schema: {
//     type: 'object',
//     properties: {
//       view: { type: 'object', properties: {
//         subtitle:   { type: 'string' },
//         hero:       { type: 'boolean' },
//         exportable: { type: 'boolean' },
//       }}
//     }
//   },
//   preview: '/previews/section.png',
// }
// META is JSON: JSON.parse(JSON.stringify(META)) === META ✅
// Skeleton NOT in META — function, not JSON-serializable. registerSlice handles it.


// ── Anti-patterns ─────────────────────────────────────────────────────────────

// ❌ OLD pattern — theme dispatch (removed):
// const Shell = ctx.theme.shells['section']  // shells no longer in ThemeConfig
// ✅ Shell IS the renderer — engine calls it directly (nodeRegistry.get('section', 'default'))

// ❌ Reading def.view directly:
// const subtitle = evalExpr(def.view?.subtitle, ctx.scope)  // engine already did this!
// ✅ ctx.view.subtitle — already a string | undefined

// ❌ Hooks in NodeRenderer body:
// export const SectionShell: NodeRenderer = (def, ctx, children) => {
//   const [open, setOpen] = useState(true)  // crash: renderer is a plain function call
// }
// ✅ delegate to inner component immediately (SectionControl above)

// ❌ Brand in shell:
// <section className="geostat-section">  // hardcoded org name
// ✅ <section className="section">  // neutral name, token CSS provides the brand

// ❌ Hardcoded colors:
// .section { border-left: 3px solid #005A9C; }  // ENstat → wrong color
// ✅ .section { border-left: 3px solid var(--color-accent); }  // token-driven

// declare for type-checking this example:
declare const ReactNode: unknown
declare interface CustomNode extends import('@geostat/react').NodeBase { indicator: string; storeId?: string }
declare const DataStore: unknown
declare const DataRow: unknown
declare const DimVal: unknown
declare const Skeleton: () => unknown
```
