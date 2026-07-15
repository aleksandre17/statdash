// ── capability-requirement.ts — a DECLARED data prerequisite the gate reads (Law 1) ──
//
//  The declared answer to "what must the active dataset expose for this element to
//  render?" — read GENERICALLY by the Constructor capability gate (apps/panel
//  `capabilityGate`), never by sniffing a node's concrete type or hardcoding a
//  dimension name. A choropleth declares `requires: { conceptRole: 'geo' }`; the gate
//  keeps it only when some profile dimension carries that DECLARED SDMX concept role.
//  This is the peer of `suggestPanels`' role read — the requirement is a semantic role
//  on the DATA, not the dimension's code (Law 1: no privileged dimensions). A second
//  tenant with a different geo role declares its own value and the SAME gate passes it
//  with zero code (OCP). Open for extension: a new prerequisite = a new optional field
//  here + a new generic clause in `profileSupports`, the element declarations unchanged.
//
//  Own-file rationale: a cohesive, independently-referenced declaration (mirrors
//  nav-contribution / variant-meta), re-exported through slice-meta so every
//  `@statdash/react/engine` import site is byte-identical.
//
export interface CapabilityRequirement {
  /**
   * A DECLARED SDMX concept role the active dataset must expose on at least one
   * dimension for this element to render (e.g. 'geo' for a map/choropleth). Read
   * generically by the capability gate against `CubeProfileDimension.conceptRole`
   * — never a hardcoded dimension name or a concrete node-type sniff.
   */
  conceptRole?: string
}
