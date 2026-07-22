// ── semantic-colors — the named core color SSOT (token-cohesion allowlisted) ─────
//
//  Growth-sign +/- semantic encoding colors, emitted onto EngineRow JSON — a wire
//  format parsed where `var()` is INVALID (SVG attrs / JS color math), so these two
//  values are hex seeds by necessity. They are UNIVERSAL up/down data semantics
//  (green=growth, red=decline — the sign rule every finance/statistics surface
//  shares), never a tenant brand: a brand accent resolves via `--color-accent` at
//  the render layer and a brand hex here is a leak (the token-cohesion fitness
//  fails any OTHER literal in this file).
//
//  This file discharges the allowlist's own follow-up ("promote to a named core
//  color SSOT"): `GrowthResolver` (registry/resolvers.ts) and the growth fold
//  (data/desugar.ts) both reference THESE names — the sign→color rule has ONE home,
//  so the two emissions can never diverge byte-wise (FF-PIPELINE-EQUIV depends on
//  that identity).
//
/** Positive growth (≥ 0) — universal "up" green. */
export const GROWTH_POSITIVE_COLOR = '#00A896'
/** Negative growth (< 0) — universal "down" red. */
export const GROWTH_NEGATIVE_COLOR = '#E76F51'
