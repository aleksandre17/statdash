// ── newNodeId — the ONE client node-id factory (single id scheme) ────────────
//
//  Every new node the Constructor mints — a page ROOT node, a dropped element, a
//  clone, a preset child — takes its client id from HERE. One factory, one
//  scheme (`node-<base36>`): collision-resistant, human-scannable, and identical
//  for the root node and its children (the root is a node like any other, so it
//  carries a real non-empty id the same way — the invariant both the client
//  save-guard's round-trip and the engine's INVALID_ID guard rely on).
//
//  A page's server IDENTITY is distinct from this: it is assigned by the API on
//  create and read back. The create emission mints a provisional root id here so
//  the config is well-formed BEFORE the server key exists; the first save
//  reconciles the persisted config's root id to the server identity.
//
export const newNodeId = (): string => `node-${Math.random().toString(36).slice(2, 9)}`
