// ── PageDataSnapshot boundary contract ────────────────────────────────────────
//
//  The engine produces a RICH PageDataSnapshot (renderPageToJSON in
//  @statdash/react/engine) describing the full resolved node tree. The api PERSISTS
//  it opaquely (snapshot-store) and reads exactly ONE field — `generatedAt` — so it
//  depends only on that invariant, not the engine's internal structure (a clean
//  Anti-Corruption Layer). Before this package the api re-declared the type name;
//  now both sides reference one boundary shape.
//
//  `SnapshotEnvelope` is the MINIMAL contract the persistence/delivery boundary
//  agrees on: a generation timestamp + an opaque blob. The engine's rich
//  PageDataSnapshot is assignable to it (it has `generatedAt: string` and an index
//  signature is not required because the engine type is a known superset consumed
//  via structural assignment at the boundary). The api stores `SnapshotEnvelope`
//  and never needs the engine's internal types compiled into its NodeNext build.

/**
 * The boundary view of a page-data snapshot: a generation timestamp plus an opaque
 * payload. The engine's full PageDataSnapshot satisfies this. Persist/transport
 * against THIS; reach for the engine's rich type only where the tree is actually
 * walked (the renderer), never at the storage boundary.
 */
export interface SnapshotEnvelope {
  /** ISO 8601 timestamp of snapshot generation — the one field the boundary reads. */
  generatedAt: string
  /** The rest of the snapshot, opaque at this boundary (renderer-owned structure). */
  [key: string]: unknown
}
