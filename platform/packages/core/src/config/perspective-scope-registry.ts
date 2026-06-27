// ── PerspectiveScope-key authoring registry [VISION #3 / SYNTHESIS §1.4] ───────
//
//  The OCP move that keeps `PerspectiveDef.scope` OPEN: every per-perspective effect
//  is a registered scope-KEY carrying an authoring PropSchema, NOT a field on a closed
//  `{ timeBinding, metric }` interface. A new scope door (store/dims/blend/facet) =
//  a registerPerspectiveScopeKey() call + an optional field on the core PerspectiveScope
//  type — the interpreter, the Constructor pane, and the coverage gate are UNCHANGED
//  (true OCP, Law 8). The pane is DRIVEN by this registry: a key appears the moment it
//  registers. The Constructor coverage gate reads listPerspectiveScopeKeys() directly,
//  so the 5th coverage axis (PERSPECTIVE_SCOPE_KEYS) is satisfied BY CONSTRUCTION —
//  no hand-maintained allowlist.
//
//  Mirrors param-schema-registry / visibility-schema-registry / rowspec-schema-registry:
//  core owns the AUTHORING-SCHEMA half (the PropSchema the generic Inspector renders);
//  any runtime "handler" (the ctx-scoping step that APPLIES the key) lives in the data
//  layer (P1), split by responsibility, not by the arrow.
//
//  TWO keys registered at module init (below): `timeBinding` + `metric`. These are the
//  real effects time-mode needs TODAY. The deferred keys are intentionally ABSENT (not
//  a stub) — they register when a real second caller opens the door.

import type { PropSchema } from './prop-schema'

/** A registered perspective-scope key — its id + the authoring PropSchema the Inspector renders. */
export interface PerspectiveScopeKey {
  /** The scope-key name, e.g. 'timeBinding' | 'metric'. Matches a key of PerspectiveDef.scope. */
  key:    string
  /** The authoring PropSchema (the pane's fields for this key). */
  schema: PropSchema
}

const _keys = new Map<string, PerspectiveScopeKey>()

/**
 * Register a perspective-scope key + its authoring PropSchema. Last-write-wins (a
 * plugin/test may override a built-in). A new key registered here becomes fully
 * authorable through the generic Inspector with zero pane code (the coverage
 * guarantee enforced by the PERSPECTIVE_SCOPE_KEYS coverage axis).
 */
export function registerPerspectiveScopeKey(key: string, schema: PropSchema): void {
  _keys.set(key, { key, schema })
}

/** The authoring PropSchema for a scope key, or undefined if none is registered. */
export function getPerspectiveScopeKeySchema(key: string): PropSchema | undefined {
  return _keys.get(key)?.schema
}

/** Sorted list of registered perspective-scope keys — the SSOT the coverage gate enumerates. */
export function listPerspectiveScopeKeys(): string[] {
  return [..._keys.keys()].sort()
}

//  The built-in scope-key authoring schemas (timeBinding + metric) live in the
//  sibling CATALOG file perspective-scope-schemas.ts — the same registry/catalog
//  split as param-schema-registry.ts ⇄ param-schemas.ts. This file is pure logic
//  (no bilingual content); the catalog carries the { ka, en } authoring labels.
//  Registered via the core index side-effect (import './config/perspective-scope-schemas').
