// ── PipelineResolver — the `pipeline` DataSpec resolver [ADR-046 · SPEC §1.3] ──────
//
//  The ONE canonical data-manipulation grammar: an ordered `pipe` whose HEAD is a
//  store-aware `source` read and whose TAIL is the existing pure transform verbs. The
//  resolver is the ONLY place that knows the head is store-aware (mirroring how the
//  MetricResolver/PointSeriesResolver own the store-aware primitives) — it reads the
//  source, then runs `applyPipeline` over the pure tail (the SAME `applyStep` every
//  other pipe uses, unchanged). Additive via `registerSpec` (OCP — the interpreter is
//  untouched; a new discriminant = one registered resolver).
//
//  The source head read LOWERS ONTO THE EXISTING PATHS — no new store port, no new
//  evaluator (SPEC §1.1). Each of the three `source` variants delegates to the
//  registered resolver for its equivalent legacy spec, so the read is BYTE-IDENTICAL
//  to that spec by construction:
//    • governed (metrics + grain) → the `metric` resolver (resolveMeasureRef + the M2
//      grain algebra) — the author-plane governed read.
//    • steward   (raw ObsQuery)   → the `query` resolver (storeObs + resolveQueryMeasures
//      + the effectiveBounds post-fetch clamp) — byte-identical to QueryResolver.
//    • inline    (literal rows)   → the rows as-is (read-free — the `transform` case).
//
//  Arrow-clean (core → data + registry only). Declarative spec in, neutral EngineRow[]
//  out; encoding happens at the renderer boundary.
//

import type { EngineRow }         from '../data/encoding'
import type { DataSpec, PipelineSpec, PipeStep, SourceStep } from '../config/data-spec'
import type { SectionContext }    from '../core/context'
import type { DataStore }         from '../data/store'
import type { TransformStep }     from '../data/transform'
import { applyPipeline }          from '../data/transform'
import type { SpecResolver }      from './engine'
import { defaultRegistry }        from './engine'

/** Read the store for a `source` head, delegating to the equivalent legacy resolver. */
function readSource(head: SourceStep | undefined, ctx: SectionContext, store: DataStore): EngineRow[] {
  if (!head || head.op !== 'source') return []   // honest empty — an unbound/malformed head reads nothing

  // Governed (author plane): a MetricSpec by another name — delegate to the `metric`
  // resolver so the governed read uses the SAME measure resolution + grain algebra. Built
  // by rest-spread (drop `op`, keep the generic grain) so no privileged-dim key literal
  // is typed here (Law 1 / FF-NO-PRIVILEGED-LITERAL — the grain keys stay generic).
  if ('metrics' in head) {
    const { op: _op, ...grain } = head
    const metricSpec: DataSpec = { type: 'metric', ...grain }
    return defaultRegistry.spec('metric')?.resolve(metricSpec, ctx, store) ?? []
  }

  // Steward: a raw ObsQuery (+ optional clamp) — delegate to the `query` resolver so the
  // read + post-fetch time clamp are byte-identical to QueryResolver. QueryResolver
  // ignores `encoding` in resolve(), so a placeholder satisfies the type.
  if ('query' in head) {
    const querySpec: DataSpec = {
      type: 'query', query: head.query, encoding: { label: 'id' },
      fromDim: head.clamp?.fromDim, toDim: head.clamp?.toDim, timeDimension: head.clamp?.timeDimension,
    }
    return defaultRegistry.spec('query')?.resolve(querySpec, ctx, store) ?? []
  }

  // Inline: literal rows (subsumes transform.source) — read-free.
  return head.rows as EngineRow[]
}

export class PipelineResolver implements SpecResolver<PipelineSpec> {
  readonly type = 'pipeline' as const

  resolve(spec: PipelineSpec, ctx: SectionContext, store: DataStore): EngineRow[] {
    const head: PipeStep | undefined = spec.pipe[0]
    const sourceRows = readSource(head as SourceStep | undefined, ctx, store)

    // Tail = the pure transform verbs after the head. `source` is head-only, so the
    // tail is TransformStep[] by construction; the identity handler makes a stray
    // `source` a safe no-op regardless (see transform/index.ts).
    const tail = spec.pipe.slice(1) as TransformStep[]
    if (!tail.length) return sourceRows
    return applyPipeline(sourceRows, tail, {
      classifiers: store.classifiers, display: store.display, section: ctx,
    })
  }
}
