// ── Config Corpus — the shared accept/reject SSOT (fitness F1) ──────────
//
//  ADR adr-config-and-render-vision §7.8 F1. A labelled corpus of VALID and
//  INVALID structural page configs. This is the SINGLE SOURCE OF TRUTH that
//  ALL THREE contract faces reuse to prove they agree:
//    - engine:  validateConfig (config.fitness.test.ts — this layer)
//    - apps/api: the save-guard contract test (a later step)
//    - react:    the structural pre-render gate (a later step)
//  Because all three call the SAME validateConfig, one corpus pins all three.
//
//  Structured as an EXPORTED corpus (not inlined in the test) precisely so
//  the api + react fitness tests can import it without copy-drift.
//
//  Each case carries the placeable node `type`s it uses in `usesTypes`, so a
//  consumer can install exactly that set into the node-type registry (the
//  type-∈-set check is fail-open until the registry is populated — the
//  "unknown type" case relies on a NON-EMPTY registry that omits its type).
//

import type { StructuralPageConfig } from './config'

export interface ValidCase {
  label:     string
  /** Placeable node types referenced — install these to exercise the type check. */
  usesTypes: string[]
  config:    unknown
}

export interface InvalidCase extends ValidCase {
  /** A substring of the expected ValidationError.code (documentation + assertion aid). */
  expectCode: string
}

// ── A minimal, registry-known set the VALID cases stick to ──────────────
//  The fitness test installs exactly these into the node-type registry, so
//  every VALID case passes the (now non-empty) type-∈-set check, while the
//  INVALID "unknown type" case uses a type deliberately OUTSIDE this set.
export const CORPUS_KNOWN_TYPES = [
  'inner-page',
  'tab-page',
  'container-page',
  'section',
  'bar',
  'table',
] as const

// ── VALID configs ───────────────────────────────────────────────────────

export const VALID_CONFIGS: ValidCase[] = [
  {
    label: 'good page — inner-page root with a typed child and a valid DataSpec',
    usesTypes: ['inner-page', 'section', 'bar'],
    config: {
      type: 'inner-page',
      id: 'page-overview',
      schemaVersion: 1,
      children: [
        {
          type: 'section',
          id: 'sec-1',
          children: [
            {
              type: 'bar',
              id: 'bar-1',
              data: { type: 'row-list', rows: [{ code: 'GDP' }] },
            },
          ],
        },
      ],
    } satisfies StructuralPageConfig,
  },
  {
    label: 'good page — empty children array (well-formed leaf page)',
    usesTypes: ['inner-page'],
    config: {
      type: 'inner-page',
      id: 'page-empty',
      children: [],
    } satisfies StructuralPageConfig,
  },
  {
    label: 'good page — tab-page root, no schemaVersion (optional), no id on a child',
    usesTypes: ['tab-page', 'section'],
    config: {
      type: 'tab-page',
      children: [{ type: 'section', children: [] }],
    } satisfies StructuralPageConfig,
  },
  {
    label: 'good page — container-page root with a valid timeseries DataSpec',
    usesTypes: ['container-page', 'table'],
    config: {
      type: 'container-page',
      id: 'page-ts',
      children: [
        {
          type: 'table',
          id: 't1',
          data: { type: 'timeseries', code: 'GDP', years: [2020, 2021, 2022] },
        },
      ],
    } satisfies StructuralPageConfig,
  },
]

// ── INVALID configs ─────────────────────────────────────────────────────

export const INVALID_CONFIGS: InvalidCase[] = [
  {
    label: 'not an object — null page config',
    usesTypes: [],
    expectCode: 'NOT_AN_OBJECT',
    config: null,
  },
  {
    label: 'unknown node type — child type not in the registered set',
    usesTypes: ['inner-page'],
    expectCode: 'UNKNOWN_NODE_TYPE',
    config: {
      type: 'inner-page',
      id: 'p',
      children: [{ type: 'totally-not-registered', id: 'x' }],
    },
  },
  {
    label: 'missing required field — page root has no children',
    usesTypes: ['inner-page'],
    expectCode: 'MISSING_REQUIRED',
    config: { type: 'inner-page', id: 'p' },
  },
  {
    label: 'missing type — a child node lacks `type`',
    usesTypes: ['inner-page'],
    expectCode: 'MISSING_TYPE',
    config: {
      type: 'inner-page',
      id: 'p',
      children: [{ id: 'no-type' }],
    },
  },
  {
    label: 'cyclic children — a node references itself',
    usesTypes: ['inner-page', 'section'],
    expectCode: 'CYCLIC_CHILDREN',
    config: makeCyclic(),
  },
  {
    label: 'malformed DataSpec — row-list with a row missing its code',
    usesTypes: ['inner-page', 'bar'],
    expectCode: 'MISSING_REQUIRED',
    config: {
      type: 'inner-page',
      id: 'p',
      children: [
        { type: 'bar', id: 'b', data: { type: 'row-list', rows: [{ label: 'no code' }] } },
      ],
    },
  },
  {
    label: 'bad page-root type — root is a non-page node type',
    usesTypes: ['section'],
    expectCode: 'INVALID_PAGE_ROOT_TYPE',
    config: { type: 'section', id: 'p', children: [] },
  },
  {
    label: 'wrong children type — children is an object, not an array',
    usesTypes: ['inner-page'],
    expectCode: 'INVALID_CHILDREN',
    config: { type: 'inner-page', id: 'p', children: { not: 'an array' } },
  },
  {
    label: 'invalid schemaVersion — present but not an integer',
    usesTypes: ['inner-page'],
    expectCode: 'INVALID_SCHEMA_VERSION',
    config: { type: 'inner-page', id: 'p', schemaVersion: 1.5, children: [] },
  },
]

/** All node types referenced anywhere in the corpus (for registry install). */
export function corpusAllTypes(): string[] {
  const set = new Set<string>(CORPUS_KNOWN_TYPES)
  for (const c of [...VALID_CONFIGS, ...INVALID_CONFIGS]) {
    for (const t of c.usesTypes) set.add(t)
  }
  // The "unknown type" invalid case must remain OUT of the set, so exclude it.
  set.delete('totally-not-registered')
  return [...set]
}

// A self-referential tree (parent appears in its own children) — built
// imperatively because object literals cannot express a cycle.
function makeCyclic(): unknown {
  const root: Record<string, unknown> = { type: 'inner-page', id: 'p' }
  const child: Record<string, unknown> = { type: 'section', id: 's' }
  child.children = [root]      // child → root → child → … (cycle)
  root.children = [child]
  return root
}
