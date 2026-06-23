// ── JSON primitives — the vocabulary of every wire/storage contract ───────────
//
//  A boundary contract is, by definition, JSON-serializable: it must round-trip
//  through JSON.stringify/parse with no functions, no class instances. These
//  aliases name that constraint so contract fields read as intent, not as a bare
//  `Record<string, unknown>` that could mean anything.

/** Any value that survives a JSON round-trip. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

/** A JSON object whose inner shape is owned by another layer and treated opaquely here. */
export type JsonRecord = Record<string, unknown>
