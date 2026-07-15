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
import { useMemo, useState } from 'react'
import type { FacetDescriptor, ObjectMeta, LocaleString } from '@statdash/react/engine'
import { nodeRegistry } from '@statdash/react/engine'
import { Inspector } from './Inspector'
import { nodeSchemaSource } from './schemaSource'
import { fixedSchemaSource } from './controls/nestedItemControl.helpers'
import { planesForRole, filterSchemaByPlanes } from './plane'
import {
  CONCERN_ORDER, CONCERN_LABELS, CONCERN_OPEN_BY_DEFAULT,
  bucketByConcern, applicableFacets, type FieldConcern,
} from './concern'
import { readLocale } from './localeString'
import type { CanvasController } from '../studio/useCanvasController'
import type { Role } from '../studio/useRole'
import type { CanvasNode, Locale } from '../types/constructor'
import './ConcernGroupedInspector.css'

// ── Label resolution (active-locale, pure) ────────────────────────────────────────
function label(ls: LocaleString, locale: Locale, fallback = ''): string {
  return readLocale(ls as never, locale) || fallback
}

// ── ConcernGroup — one collapsible, token-themed concern section (WCAG disclosure) ─
//
//  A <fieldset>/<legend> keeps the form-grouping semantics; the legend hosts a
//  disclosure <button aria-expanded> controlling the body region (the SAME proven
//  accordion grammar the Inspector uses, on the global DTCG token spine — calm, not
//  MUI soup). Open-state is view-only; a user toggle overrides the concern default.
//
function ConcernGroup(
  { concern, heading, open, onToggle, idBase, children }: {
    concern:  FieldConcern
    heading:  string
    open:     boolean
    onToggle: () => void
    idBase:   string
    children: React.ReactNode
  },
): React.ReactElement {
  const bodyId = `${idBase}-body`
  return (
    <fieldset className="concern-group" data-concern={concern} data-open={open || undefined}>
      <legend className="concern-group__legend">
        <button
          type="button"
          className="concern-group__toggle"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={onToggle}
        >
          <span className="concern-group__caret" aria-hidden="true" />
          <span className="concern-group__name">{heading}</span>
        </button>
      </legend>
      <div id={bodyId} className="concern-group__body" hidden={!open}>
        {children}
      </div>
    </fieldset>
  )
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

  // Progressive disclosure — the concern default (CONTENT + DATA open) with a per-group
  // user override. Keyed by concern so re-selecting a different element re-defaults.
  const [openOverride, setOpenOverride] = useState<Map<FieldConcern, boolean>>(() => new Map())
  const isOpen = (c: FieldConcern) =>
    openOverride.has(c) ? openOverride.get(c)! : CONCERN_OPEN_BY_DEFAULT.has(c)
  const toggle = (c: FieldConcern) =>
    setOpenOverride((prev) => new Map(prev).set(c, !isOpen(c)))

  const elementName = meta ? label(meta.label as LocaleString, locale, node.type) : node.type

  return (
    <div className="concern-dock" data-testid="concern-dock">
      {/* Calm element identity (replaces the raw MUI Chip) — the deliberate header. */}
      <div className="concern-dock__identity">
        <span className="concern-dock__eyebrow">{elementName}</span>
      </div>

      {CONCERN_ORDER.map((concern) => {
        const b = buckets.get(concern)
        // Empty concern self-drops — never a blank labelled box (the owner's law).
        if (!b || (b.fields.length === 0 && b.facets.length === 0)) return null

        const idBase = `concern-${concern}`
        return (
          <ConcernGroup
            key={concern}
            concern={concern}
            heading={label(CONCERN_LABELS[concern], locale)}
            open={isOpen(concern)}
            onToggle={() => toggle(concern)}
            idBase={idBase}
          >
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
          </ConcernGroup>
        )
      })}
    </div>
  )
}
