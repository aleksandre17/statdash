// ── ConcernGroupedInspector — the REFINE moment (root Law 11 · the calm dock) ─────
//
//  The Authoring Canon's REFINE surface made real. The whole-node inspector is no
//  longer a flat, tangled property dump (the owner's crisis: "everything nauseatingly
//  mushed", "you can't tell what means what, where"). Every authorable thing for the
//  selected element — the node's own declared fields AND its universal FACETS (data /
//  style / interactions / visibility) — is projected into ONE of five CONCERNS and
//  rendered as a collapsible group, in ONE canonical order:
//
//    CONTENT · DATA · STYLE · LAYOUT · BEHAVIOR
//
//  So the author sees a deliberate, legible surface where each field's MEANING is
//  obvious from the group it sits in. Progressive disclosure ("see only what's needed
//  at that moment"): CONTENT + DATA open, the refinement concerns fold. An empty
//  concern self-drops (never a blank labelled box).
//
//  GENERIC by construction (Law 1 — never an `if type===`): a node field DECLARES its
//  `concern` (PropField.concern, absent ⇒ content); a facet's concern is its declared
//  app-tier mapping. This component groups by those declarations — a new field/facet
//  lands in its concern automatically (OCP / FF-CONCERN-GROUPED). It reuses the plane
//  lens (author sees author-plane only — root Law 11) and the SAME generic Inspector +
//  FieldControlRegistry the flat dock used, so every rich control (StyleField, the
//  DataFacet pipeline, EventsField, nested-item drills) renders unchanged.
//
//  Scope: the WHOLE-NODE element selection (the reference REFINE surface — the owner's
//  screenshot). A bounded PART drill (band item / chrome region) and the page context
//  keep the existing flat section path (DockBody) — a bounded, reversible Strangler
//  increment; the part-drill concern grouping is a flagged follow-up.
//
import { useMemo } from 'react'
import type { FacetDescriptor, ObjectMeta, LocaleString } from '@statdash/react/engine'
import { nodeRegistry } from '@statdash/react/engine'
import { Inspector } from './Inspector'
import { nodeSchemaSource } from './schemaSource'
import { fixedSchemaSource } from './controls/nestedItemControl.helpers'
import { planesForRole, filterSchemaByPlanes } from './plane'
import { bucketByConcern, applicableFacets } from './concern'
import { ConcernGroups } from './ConcernGroups'
import { readLocale } from './localeString'
import type { CanvasController } from '../studio/useCanvasController'
import type { Role } from '../studio/useRole'
import type { CanvasNode, Locale } from '../types/constructor'
import './ConcernGroupedInspector.css'

// ── Label resolution (active-locale, pure) ────────────────────────────────────────
function label(ls: LocaleString, locale: Locale, fallback = ''): string {
  return readLocale(ls as never, locale) || fallback
}

// ── The one facet render (whole-node) — the generic Inspector over the facet contract ─
function FacetControl(
  { facet, meta, node, patchProp }: {
    facet: FacetDescriptor; meta: ObjectMeta; node: CanvasNode
    patchProp: (field: string, next: unknown) => void
  },
): React.ReactElement {
  return (
    <Inspector
      node={node}
      schemaSource={fixedSchemaSource(facet.contract(meta), [])}
      onChange={patchProp}
      idPrefix={`insp-facet-${facet.id}`}
    />
  )
}

// ── ConcernGroupedInspector ────────────────────────────────────────────────────────
export interface ConcernGroupedInspectorProps {
  node:       CanvasNode
  controller: CanvasController
  locale:     Locale
  role?:      Role
}

export function ConcernGroupedInspector(
  { node, controller, locale, role }: ConcernGroupedInspectorProps,
): React.ReactElement {
  const { patchProp } = controller

  const meta = useMemo(
    () => nodeRegistry.getMeta(node.type, node.variant) as ObjectMeta | undefined,
    [node.type, node.variant],
  )

  // The node's OWN declared fields, plane-filtered (author never sees system plumbing).
  const schema = useMemo(
    () => filterSchemaByPlanes(nodeSchemaSource.getSchema(node), planesForRole(role)),
    [node, role],
  )
  const facets = useMemo(() => (meta ? applicableFacets(meta, role) : []), [meta, role])
  const buckets = useMemo(() => bucketByConcern(schema, facets), [schema, facets])

  const elementName = meta ? label(meta.label as LocaleString, locale, node.type) : node.type

  return (
    <div className="concern-dock" data-testid="concern-dock">
      {/* Calm element identity (replaces the raw MUI Chip) — the deliberate header. */}
      <div className="concern-dock__identity">
        <span className="concern-dock__eyebrow">{elementName}</span>
      </div>

      {/* The whole-node concern spine (shared with the drilled part/item path). Each
          concern's body = the node's own fields (a plain list) THEN its universal
          facets (rich controls), both through the SAME generic Inspector/facet path. */}
      <ConcernGroups buckets={buckets} locale={locale} idBase="concern" renderBucket={(b, concern) => (
        <>
          {/* The node's own fields of this concern — a plain field list (no nested
              accordion; the concern group IS the section). */}
          {b.fields.length > 0 && (
            <Inspector
              node={node}
              schemaSource={fixedSchemaSource(b.fields, [])}
              onChange={patchProp}
              idPrefix={`insp-${concern}`}
            />
          )}
          {/* The universal facets of this concern — each a rich control (StyleField,
              the DataFacet pipeline, EventsField) via the SAME generic Inspector. */}
          {meta && b.facets.map((facet) => (
            <FacetControl
              key={facet.id}
              facet={facet}
              meta={meta}
              node={node}
              patchProp={patchProp}
            />
          ))}
        </>
      )} />
    </div>
  )
}
