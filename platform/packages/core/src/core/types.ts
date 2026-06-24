import type { ExprVal, DimVal } from '@statdash/expr'
import type { DataSpec }        from '../config/data-spec'

/**
 * Engine-level data-lookup ops — extend @statdash/expr ExprVal with data access.
 * Resolved by evalNodeDerive; never serialised as plain ExprVal.
 *
 * tree-field: find a row where row['id'] or row['value'] matches ref, extract field.
 * map-field:  treat first row as a code→DimVal map, look up String(ref).
 */
export type DataLookupOp =
  | { op: 'tree-field'; data: DataSpec; ref: ExprVal; field: string; fallback?: DimVal }
  | { op: 'map-field';  data: DataSpec; ref: ExprVal; field: string; fallback?: DimVal }

/** Engine derive entry — pure @statdash/expr expression OR data-access op. */
export type DeriveEntry = ExprVal | DataLookupOp

/**
 * Ordered list of key→expr pairs evaluated top-to-bottom.
 * Each key is immediately available as {$derived: key} in subsequent entries.
 * Structural superset of @statdash/expr DeriveMap; adds DataLookupOp variants.
 */
export type NodeDeriveMap = Array<{ key: string; expr: DeriveEntry }>