// ── nav-contribution — how a `nav-contributor` node is read for the nav list ──
//
//  A META DESCRIPTOR (JSON-ish, Constructor-introspectable) that names — by
//  config field path — WHERE the nav extractor reads a contributor's id, title
//  and nav-mode. It carries NO behaviour and NO node-type knowledge: the engine
//  reads these field paths off the raw node generically, so a new nav node only
//  declares the `nav-contributor` cap (+ optionally this descriptor to override
//  the defaults) — the extractor is never edited (OCP / Law 1 / Law 8).
//
//  Mirrors the presentation-projector descriptor discipline: the shared layer
//  knows the PROTOCOL (read id/title/mode), each node owns its specifics behind
//  the registry. When a node declares only the cap (no descriptor), the engine
//  applies DEFAULT_NAV_CONTRIBUTION — id `anchor ?? id`, title `title`, nav-mode
//  from `view.visibleWhen`.
//

export interface NavContribution {
  /**
   * Ordered candidate field paths for the section id. The first path whose
   * value on the raw node is a string wins. Default: `['anchor', 'id']`
   * (anchor overrides id when present, else id).
   */
  idFields?:   string[]
  /** Field path for the section title. Default: `'title'`. */
  titleField?: string
  /**
   * Field path to the `VisibilityExpr` whose `eq` against the time-mode key
   * yields the nav-mode (which mode the section belongs to). Default:
   * `'view.visibleWhen'`.
   */
  modeField?:  string
}

/**
 * Default reader applied when a node declares the `nav-contributor` cap but no
 * explicit `navContribution` descriptor. Encodes the historical hardcoded
 * behaviour (`anchor ?? id`, `title`, `view.visibleWhen`) so the generic path
 * is byte-identical to the legacy section/georgraph special-case.
 */
export const DEFAULT_NAV_CONTRIBUTION: Required<NavContribution> = {
  idFields:   ['anchor', 'id'],
  titleField: 'title',
  modeField:  'view.visibleWhen',
}
