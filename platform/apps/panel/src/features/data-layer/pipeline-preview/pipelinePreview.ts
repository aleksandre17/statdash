// ── pipelinePreview — the pure per-step projection over the ONE engine seam ────
//
//  W-P1 (ADR-046 · SPEC §3.2 / §9 E3, E5). The live per-step data grid's HONEST
//  core: given the SOURCE rows the query's `Get` read produced (resolved ONCE by
//  `usePipelineSourceRows` off the live store), derive the rows AT THE OUTPUT of
//  any selected step by running the pipe PREFIX [0..N] through the EXISTING engine
//  transform seam (`applyPipeline` / `applyStep`) — never a bespoke preview cache
//  (FF-ONE-DERIVATION-PATH, Refusal #6). Step selection is a pure re-slice of the
//  already-resolved source rows: no re-fetch, no cache, instant.
//
//  Everything here is PURE + framework-free (Law: pure data ops, testable): the
//  React hook owns the async source read; this module owns the derivation, the
//  honest cap, and the honest-cell grammar.
//
import type { DimVal, EngineRow, TransformStep, PipelineContext } from '@statdash/engine'
import { applyPipeline } from '@statdash/engine'

/** The platform MISSING-VALUE glyph — the honest stand-in for a no-data cell
 *  (Law 11 / FF-CANVAS-NEVER-LIES; the SAME '—' `resolveTemplate` renders). */
export const MISSING_GLYPH = '—'

/** The honest preview cap (SPEC §9 E3 — Power Query's exact discipline). The grid
 *  shows the first N rows with an honest count note, never a silent truncation. */
export const PREVIEW_CAP = 200

/** The sentinel "as-of" index meaning the SOURCE read (the `Get` step) — the rows
 *  ENTERING the pipe, before any transform. The empty-pipeline browse state (E1). */
export const AS_OF_SOURCE = -1

// ── deriveStepRows — the prefix-run projection (SPEC §9 E5) ─────────────────────
//
//  `asOfStep = AS_OF_SOURCE (-1)` → the source rows untouched (the browse grid).
//  `asOfStep = k (0-based)`       → applyPipeline(source, pipe[0..k]) — the output
//                                   AFTER step k, exactly as the QueryResolver
//                                   composes the full pipe (source → applyPipeline).
//  A prefix run of the WHOLE pipe (`k = pipe.length-1`) is byte-identical to the
//  bound element's rows — same seam, same order, no divergence.
export function deriveStepRows(
  sourceRows: readonly EngineRow[],
  pipe:       readonly TransformStep[],
  asOfStep:   number,
  ctx?:       PipelineContext,
): EngineRow[] {
  if (asOfStep < 0 || pipe.length === 0) return sourceRows as EngineRow[]
  const upto = Math.min(asOfStep + 1, pipe.length)
  return applyPipeline(sourceRows as EngineRow[], pipe.slice(0, upto) as TransformStep[], ctx)
}

// ── capRows — the honest capped preview (SPEC §9 E3) ───────────────────────────
export interface CappedRows {
  /** The first `PREVIEW_CAP` rows — what the grid actually renders. */
  rows:   EngineRow[]
  /** The TRUE total count (before the cap) — the honest note's denominator. */
  total:  number
  /** Whether the cap elided rows (drives the "showing N of M" note). */
  capped: boolean
}

export function capRows(rows: readonly EngineRow[], cap = PREVIEW_CAP): CappedRows {
  const total = rows.length
  return {
    rows:   total > cap ? (rows.slice(0, cap) as EngineRow[]) : (rows as EngineRow[]),
    total,
    capped: total > cap,
  }
}

// ── deriveColumns — the column set, in stable first-seen field order ────────────
//
//  A transform step can add/drop/rename fields, so the column set is derived from
//  the rows themselves (never assumed from the query). First-seen order across the
//  scanned rows is stable + deterministic (the order fields appear in the row bags).
export function deriveColumns(rows: readonly EngineRow[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const row of rows) {
    for (const k of Object.keys(row)) {
      if (!seen.has(k)) { seen.add(k); out.push(k) }
    }
  }
  return out
}

// ── The honest-cell grammar for the grid (Law 11) ──────────────────────────────
//
//  A subset of the engine's Cell ValueState, projected to what a preview grid can
//  observe from a resolved row value: `ok` (a real value, INCLUDING a genuine 0)
//  or `no-data` (null/undefined — an honest '—', never a fabricated 0). The async
//  `loading`/`error`/`unbound` states are GRID-level (the whole read), carried by
//  `PreviewStatus`, not per-cell.
export type GridCellState = 'ok' | 'no-data'

export interface GridCell {
  state: GridCellState
  /** The display text — '—' for no-data, the honest value (incl. "0") for ok. */
  text:  string
}

/** Localize a possibly-tagged LocaleString row cell to a display string (rows carry
 *  bilingual `$d`-join labels at runtime). Scalars pass through; an object bag
 *  resolves active → en → first arm; never "[object Object]", never blank. */
function localizeCellValue(value: DimVal, locale: string): string {
  if (typeof value === 'object' && value !== null) {
    const bag = value as Record<string, string>
    return bag[locale] ?? bag['en'] ?? Object.values(bag)[0] ?? ''
  }
  return String(value)
}

/**
 * The honest render of ONE row cell. `null`/`undefined` → a declared no-data '—'
 * (never a fake 0); a genuine numeric 0 → the honest text "0" in the `ok` state.
 */
export function toGridCell(value: DimVal | null | undefined, locale = 'ka'): GridCell {
  if (value === null || value === undefined || value === '') {
    return { state: 'no-data', text: MISSING_GLYPH }
  }
  return { state: 'ok', text: localizeCellValue(value, locale) }
}
