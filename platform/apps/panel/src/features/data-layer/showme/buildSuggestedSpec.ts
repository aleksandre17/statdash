// ── buildSuggestedSpec — a populated DataSpec from a panel suggestion (V5) ────
//
//  Show-Me's "insert a fit-for-the-data chart" payload: a PanelSuggestion (from
//  the existing suggestPanels) + the profile → a POPULATED `query` DataSpec with
//  a bound measure + encoding. The author clicks one suggested chart and gets a
//  ready DataSpec — never hand-writing an ObsQuery (ADR V5).
//
//  Law 2 (pick-don't-type): every code in the produced spec comes from the
//  PROFILE — the suggestion's `basis` dimension and the first measure. No code is
//  invented or typed.
//
//  Byte-identical: the produced spec is the SAME `query` shape the
//  DataSpecEditor/QuerySpecEditor emit (type:'query', query.measure: string[],
//  encoding with bare-string channels) — Show-Me is a faster way to reach a
//  config the typed editors could also produce, not a new config dialect.
//
import type { DataSpec } from '@statdash/engine'
import type { CubeProfile } from '../../../lib/cubeApi'
import type { PanelSuggestion } from '../../../discovery/suggestPanels'

/**
 * Build a populated `query` DataSpec for a suggestion. The measure is the
 * profile's first measure (the suggestion exists only when ≥1 measure is
 * present); the encoding label binds the suggestion's basis dimension (the axis
 * that drove the suggestion — time for timeseries, the geo/hierarchy/compare dim
 * otherwise) and value binds the measure. Returns null when the profile lacks a
 * measure to bind (defensive — suggestPanels would not have produced a
 * measure-bearing suggestion, but the builder stays total).
 */
export function buildSuggestedSpec(
  suggestion: PanelSuggestion,
  profile: CubeProfile,
): DataSpec | null {
  const firstMeasure = (profile.measures ?? [])[0]?.code
  if (!firstMeasure) return null

  // The label axis: the suggestion's basis when it is a dimension; else the
  // first dimension; else the measure code (degenerate — a single-series strip).
  const dims = profile.dimensions ?? []
  const basisIsDim = dims.some((d) => d.code === suggestion.basis)
  const labelField = basisIsDim ? suggestion.basis : dims[0]?.code ?? firstMeasure

  return {
    type: 'query',
    query: { measure: [firstMeasure] },
    pipe: [],
    encoding: { label: labelField, value: firstMeasure },
  }
}
