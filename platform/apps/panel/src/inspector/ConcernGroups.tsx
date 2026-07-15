// ── ConcernGroups — the REFINE canon's concern-grouped SPINE (root Law 11) ────────
//
//  The Authoring Canon's REFINE moment, extracted to ONE reusable surface so EVERY
//  selection — the whole node AND a drilled PART (band item / column / nested object)
//  — is organized by the SAME concern taxonomy, never a flat re-mush.
//
//    CONTENT · DATA · STYLE · LAYOUT · BEHAVIOR
//
//  This component owns ONLY the invariant STRUCTURE the canon demands:
//    • the canonical CONCERN_ORDER walk, empties self-dropping (never a blank box);
//    • the collapsible <fieldset>/<legend> disclosure grammar (WCAG), token-calm;
//    • progressive disclosure — CONTENT + DATA open, refinement concerns fold, with a
//      per-group user override.
//  WHAT fills each concern (a plain field list, a node's rich facets, a drilled item's
//  fields under a DrillContext) is the caller's `renderBucket` — so the whole-node
//  inspector, the band-item drill, and the nested-item drill share this spine with no
//  parallel mechanism (Law 1 · OCP · FF-CONCERN-GROUPED). Pure over its `buckets`
//  input (bucketByConcern) — a new field/facet lands in its declared concern for free.
//
import { useState } from 'react'
import type { LocaleString } from '@statdash/react/engine'
import {
  CONCERN_ORDER, CONCERN_LABELS, CONCERN_OPEN_BY_DEFAULT,
  type ConcernBucket, type FieldConcern,
} from './concern'
import { readLocale } from './localeString'
import type { Locale } from '../types/constructor'
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

// ── ConcernGroups — the CONCERN_ORDER walk + progressive disclosure ────────────────
export interface ConcernGroupsProps {
  /** The pre-bucketed, plane-filtered concerns (bucketByConcern). */
  buckets:      Map<FieldConcern, ConcernBucket>
  /** Active locale — resolves the bilingual concern headings (Law 4). */
  locale:       Locale
  /** DOM-id namespace for each group's disclosure body (unique per surface). */
  idBase:       string
  /** The caller renders one concern's body (fields / facets / drilled item form). */
  renderBucket: (bucket: ConcernBucket, concern: FieldConcern) => React.ReactNode
}

export function ConcernGroups(
  { buckets, locale, idBase, renderBucket }: ConcernGroupsProps,
): React.ReactElement {
  // Progressive disclosure — the concern default (CONTENT + DATA open) with a per-group
  // user override. Keyed by concern so re-selecting a different element re-defaults.
  const [openOverride, setOpenOverride] = useState<Map<FieldConcern, boolean>>(() => new Map())
  const isOpen = (c: FieldConcern) =>
    openOverride.has(c) ? openOverride.get(c)! : CONCERN_OPEN_BY_DEFAULT.has(c)
  const toggle = (c: FieldConcern) =>
    setOpenOverride((prev) => new Map(prev).set(c, !isOpen(c)))

  return (
    <>
      {CONCERN_ORDER.map((concern) => {
        const b = buckets.get(concern)
        // Empty concern self-drops — never a blank labelled box (the owner's law).
        if (!b || (b.fields.length === 0 && b.facets.length === 0)) return null
        return (
          <ConcernGroup
            key={concern}
            concern={concern}
            heading={label(CONCERN_LABELS[concern], locale)}
            open={isOpen(concern)}
            onToggle={() => toggle(concern)}
            idBase={`${idBase}-${concern}`}
          >
            {renderBucket(b, concern)}
          </ConcernGroup>
        )
      })}
    </>
  )
}
