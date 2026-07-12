// ── builtinFacets — the app's concrete FACET registrations (labels live here) ────
//
//  packages/react owns the generic FACET mechanism (FacetDescriptor + facetRegistry),
//  but is locale-agnostic (Law 4) — so the concrete built-in facets, WITH their
//  bilingual labels, are declared HERE (app tier), exactly as the dock sections and
//  field controls are. Importing this module registers them (idempotent side-effect).
//
//  Slice 1 registers the ONE STYLE facet. A later slice adds DATA/EVENTS/CHROME as
//  MORE register() calls — the dock-section derivation (builtins) is unchanged (OCP).
//
import { facetRegistry, CAPS } from '@statdash/react/engine'
import type { LocaleString } from '@statdash/react/engine'

const STYLE_LABEL: LocaleString = { ka: 'სტილი', en: 'Style' }

let registered = false

/** Idempotently register the platform's built-in facets. Safe from boot + tests. */
export function registerBuiltinFacets(): void {
  if (registered) return
  registered = true

  // ── STYLE (Gap 4) — whole-element token-constrained `view.styles` authoring ──────
  //  Opt-in by the declared `styleable` cap (a signal, not a type read — Law 1). The
  //  contract is a single `type:'style'` field the dock dispatches to StyleField via
  //  FieldControlRegistry; `resolveStyle`/`applyNodeStyles` renders `view.styles` live.
  facetRegistry.register({
    id:          'style',
    order:       40,
    readPath:    'view.styles',
    label:       STYLE_LABEL,
    appliesWhen: (meta) => !!meta.caps?.includes(CAPS.STYLEABLE),
    contract:    () => [{ field: 'view.styles', type: 'style', label: STYLE_LABEL }],
  })
}
