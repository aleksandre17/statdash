// ── Structural Config Validator — the wire-contract floor (P-1) ─────────
//
//  ADR adr-config-and-render-vision §2-§5, §7. validateConfig is the
//  engine-tier, React-free STRUCTURAL FLOOR for a whole page config. It is
//  the SAME function BOTH apps/api (on save) and packages/react (on render)
//  call — moving the invariant DOWN the dependency arrow to the deepest
//  layer every consumer can legally reach (packages/core). Server and
//  client cannot diverge because they run one function (fitness F1).
//
//  STRUCTURAL FLOOR ONLY (the precise cut, §7.2):
//    - tree well-formedness: every node is an object with a non-empty
//      string `type`; `children`, if present, is an array; NO cycles.
//    - each node's `type` ∈ knownNodeTypes() — SKIPPED when the registry is
//      empty (fail-open, §7.3), so isolated engine/api use never false-rejects.
//    - required base fields: `id` (when present) is a non-empty string; the
//      page root carries `children`; `schemaVersion`, if present, is an integer.
//    - page-root `type` ∈ {inner-page, tab-page, container-page}.
//    - each node's `data` (DataSpec) validated via the existing validateDataSpec.
//
//  NOT here (app-tier RICH SEMANTIC, stays in react/plugins): per-node
//  PropSchema field validation, slot `accepts`, nodeRegistry slice
//  validate() hooks, enum-ref source resolution. Those need the renderer
//  registry — correctly up-tier. Do NOT duplicate them (YAGNI).
//
//  Returns ValidationError[] ([] === valid) — the EXISTING engine model
//  ({path,code,severity}), NOT ProblemDetails: core stays zero-knowledge of
//  the RFC-9457 URN scheme (api-owned). The api wraps results into
//  application/problem+json later. Never throws — errors are collected.
//

import type { DataSpec }        from '../config/data-spec'
import { knownNodeTypes }       from '../registry/nodeTypes'
import { validateDataSpec }     from './pipeline'
import type { ValidationError } from './types'

// ── Structural mirror types (§7.4) ──────────────────────────────────────
//
//  A strict WIDENING of react's NodePageConfig. We do NOT import react's
//  type (the arrow forbids core→react, and the rich type pulls in NodeStyles
//  / ChromeEntry which the validator does not need — it validates SHAPE, not
//  the full typed interface). SSOT is preserved because the mirror is a
//  superset: react's NodePageConfig is assignable to StructuralPageConfig —
//  a react-side type-level fitness test (F4, a later step) pins that the
//  mirror can never drift narrower than the real type.

export interface StructuralNode {
  type:       string
  id?:        string
  children?:  StructuralNode[]
  data?:      unknown
  // NO `[k: string]: unknown` index signature. The mirror must remain a strict
  // WIDENING of react's NodePageConfig (F4, structuralMirror.fitness.test.ts):
  // a string index signature would BREAK that assignability, because plain
  // interfaces (BarNode, FilterBarNode, …) without their own index signature
  // are not assignable to a type that declares one. Extra/rich fields on a real
  // node are simply not constrained here — that is the intended floor (the
  // validator reads only the structural keys above, via explicit casts).
}

export type StructuralPageConfig = StructuralNode & { schemaVersion?: number }

// ── Page-root discriminant set (§7.2) ───────────────────────────────────
//  The three page-root node types. Unlike the open node-type set (injected
//  from react), the page-root kinds ARE a closed structural fact the engine
//  legitimately owns — a config whose root is not one of these is not a page.
const PAGE_ROOT_TYPES = ['inner-page', 'tab-page', 'container-page'] as const

// ── validateConfig ──────────────────────────────────────────────────────

/**
 * Structural-floor validation of a whole page config.
 *
 * @param config - any value (typically a migrated raw JSONB blob).
 * @returns ValidationError[] — empty iff the config passes the structural floor.
 *          Never throws.
 */
export function validateConfig(config: unknown): ValidationError[] {
  const errors: ValidationError[] = []
  const known  = knownNodeTypes()
  const failOpen = known.length === 0   // empty registry ⇒ skip type-∈-set check

  // ── Page root must be an object before we can read `type` ─────────────
  if (!isPlainObject(config)) {
    errors.push({
      path: '',
      code: 'NOT_AN_OBJECT',
      message: 'Page config must be an object.',
      severity: 'error',
    })
    return errors
  }

  // ── schemaVersion (page root only) ────────────────────────────────────
  if ('schemaVersion' in config) {
    const sv = (config as { schemaVersion?: unknown }).schemaVersion
    if (typeof sv !== 'number' || !Number.isInteger(sv)) {
      errors.push({
        path: '/schemaVersion',
        code: 'INVALID_SCHEMA_VERSION',
        message: 'schemaVersion must be an integer when present.',
        severity: 'error',
      })
    }
  }

  // ── Page-root type discriminant ───────────────────────────────────────
  const rootType = (config as { type?: unknown }).type
  if (typeof rootType === 'string'
      && rootType.length > 0
      && !(PAGE_ROOT_TYPES as readonly string[]).includes(rootType)) {
    errors.push({
      path: '/type',
      code: 'INVALID_PAGE_ROOT_TYPE',
      message: `Page root type must be one of ${PAGE_ROOT_TYPES.join(', ')} — got '${rootType}'.`,
      severity: 'error',
    })
  }

  // ── Page root must carry children (§7.2) ──────────────────────────────
  if (!('children' in config)) {
    errors.push({
      path: '/children',
      code: 'MISSING_REQUIRED',
      message: 'Page root must declare children.',
      severity: 'error',
    })
  }

  // ── Walk the tree (cycle-safe) ────────────────────────────────────────
  //  walk() takes `unknown` and re-narrows internally; pass the object directly
  //  (no StructuralNode cast — the mirror no longer has an index signature).
  walk(config, '', errors, known, failOpen, new Set())

  return errors
}

// ── Recursive node walk ─────────────────────────────────────────────────

function walk(
  node: unknown,
  path: string,
  errors: ValidationError[],
  known: string[],
  failOpen: boolean,
  ancestors: Set<object>,
): void {
  if (!isPlainObject(node)) {
    errors.push({
      path: path || '/',
      code: 'NOT_AN_OBJECT',
      message: 'Node must be an object.',
      severity: 'error',
    })
    return
  }

  // Cycle guard — a node that references an ancestor (shared/circular ref).
  if (ancestors.has(node)) {
    errors.push({
      path: path || '/',
      code: 'CYCLIC_CHILDREN',
      message: 'Cyclic node reference detected — the config tree must be acyclic.',
      severity: 'error',
    })
    return
  }

  // ── type: non-empty string ────────────────────────────────────────────
  const type = (node as { type?: unknown }).type
  if (type === undefined || type === null) {
    errors.push({
      path: joinPath(path, 'type'),
      code: 'MISSING_TYPE',
      message: 'Node is missing a `type`.',
      severity: 'error',
    })
  } else if (typeof type !== 'string' || type.length === 0) {
    errors.push({
      path: joinPath(path, 'type'),
      code: 'INVALID_TYPE_FIELD',
      message: 'Node `type` must be a non-empty string.',
      severity: 'error',
    })
  } else if (!failOpen && !known.includes(type)) {
    // Fail-open: only enforced once the registry has been populated.
    errors.push({
      path: joinPath(path, 'type'),
      code: 'UNKNOWN_NODE_TYPE',
      message: `Unknown node type: '${type}'. Known types: ${known.join(', ')}`,
      severity: 'error',
    })
  }

  // ── id: non-empty string when present ─────────────────────────────────
  if ('id' in node) {
    const id = (node as { id?: unknown }).id
    if (typeof id !== 'string' || id.length === 0) {
      errors.push({
        path: joinPath(path, 'id'),
        code: 'INVALID_ID',
        message: 'Node `id` must be a non-empty string when present.',
        severity: 'error',
      })
    }
  }

  // ── data: DataSpec — reuse the existing validateDataSpec ───────────────
  if ('data' in node && (node as { data?: unknown }).data != null) {
    const dataPath = joinPath(path, 'data')
    const data = (node as { data?: unknown }).data
    if (!isPlainObject(data) || typeof (data as { type?: unknown }).type !== 'string') {
      errors.push({
        path: dataPath,
        code: 'INVALID_VALUE',
        message: 'Node `data` (DataSpec) must be an object with a string `type`.',
        severity: 'error',
      })
    } else {
      // Re-path the engine DataSpec errors under this node's data pointer.
      const result = validateDataSpec(data as DataSpec, dataPath)
      for (const e of result.errors) errors.push(e)
    }
  }

  // ── children: array of nodes, recursed cycle-safe ─────────────────────
  if ('children' in node && (node as { children?: unknown }).children !== undefined) {
    const children = (node as { children?: unknown }).children
    if (!Array.isArray(children)) {
      errors.push({
        path: joinPath(path, 'children'),
        code: 'INVALID_CHILDREN',
        message: 'Node `children` must be an array when present.',
        severity: 'error',
      })
    } else {
      const nextAncestors = new Set(ancestors).add(node)
      children.forEach((child, i) => {
        walk(child, `${joinPath(path, 'children')}/${i}`, errors, known, failOpen, nextAncestors)
      })
    }
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** JSON-pointer-ish path join: '' + 'type' → '/type'; '/children/0' + 'data' → '/children/0/data'. */
function joinPath(base: string, key: string): string {
  return `${base}/${key}`
}
