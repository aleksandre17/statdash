---
title: No Privileged Element / Capability Nav
status: Proposed
date: 2026-06-24
authors: architect (Opus)
migrated_from: adr_no_privileged_element_capability_nav
---

# ADR-014 — No Privileged Element / Capability Nav

**Status:** Proposed (P0–P5).

## Context

Only `navUtils` hardcodes concrete node types (`section` / `georgraph` / `row`) to build navigation — a privileged-element violation of the engine's otherwise open, registry-driven model. `DefaultSectionShell` is a misnamed fallback, and section anchor-nav is coupled to those specific types rather than to a capability.

## Decision

- **Nav-contributor + nav-transparent capabilities + a registry-driven visitor.** A node declares (via capability) that it contributes a nav entry or is nav-transparent; `navUtils` walks the registry by capability instead of matching hardcoded types.
- **Generalize the anchor model:** `SectionNavContext` becomes a generic anchor-nav context; `DefaultSectionShell` is recognized as a generic fallback, not a privileged type.

## Rejected Alternatives

1. **Keep hardcoded node-type checks in `navUtils` (status quo)** — REJECTED: the one remaining privileged-element violation; a new registered node cannot participate in nav without editing `navUtils` (closed to extension).
2. **Introduce a privileged `Section` base type that owns nav** — REJECTED: re-privileges an element and couples nav to inheritance; a capability + registry visitor keeps nav open and composition-based.

## Consequences

- Positive: nav becomes registry-driven and open (a new node opts into nav via a capability); no hardcoded node types remain.
- Negative / cost: a migration of `navUtils` to the capability visitor; existing section types must declare the capability.
- Fitness function: `FF-NO-PRIVILEGED-NODE`.

---

## Detailed Record (preserved verbatim from architect memory)

> Migrated from `.claude/agent-memory/architect/`.


# ADR — No Privileged Element: Capability-Driven Nav + Shared-Layer De-Privileging

Status: PROPOSED (2026-06-24). Design-only. Mirrors the existing presentation-projector registry / registerStoreBuilder / FieldControlRegistry / NodeRegistry.caps discipline.

**Why:** Law 1 (no privileged dimensions, applied to plugin elements) + OCP + Law 8. `packages/react/src/engine/navUtils.ts` HARDCODES plugin node-type literals (`'section'`, `'georgraph'`, `'row'`) in the GENERIC nav extractor, and section-specific code lives in the shared `packages/react` layer instead of the section plugin. A new nav-contributing node cannot participate without EDITING the engine. Same smell class already fixed for presentation projectors and store-builders.

**How to apply:** When touching navUtils, NodeRegistry caps, or any shared-layer file that names a plugin node type, route behavior through a declared capability + registry loop — never a `type === '<x>'` branch. New nav node = declare a cap, engine untouched.

## Audit verdict (conclusive)
Only ONE production file in shared layers (`packages/react/src/**`, `packages/core/src/**`) hardcodes plugin node-type literals: `navUtils.ts` L46/L57/L73 (`section`, `georgraph`, `row`). Everything else flagged is a FALSE POSITIVE:
- `core/src/**` `type===` hits = genuine framework discriminated unions (ParamDef, DataSource, ObsQuery) — legit vocabulary.
- `generatePageConfigSchema.ts` `PAGE_ROOT_TYPES = ['inner-page','tab-page','container-page']` + `types/node.ts` page-root union = structural page-tree root discriminant (engine structurally requires a root). ALLOWLISTED in the fitness fn, justified.
- `types/node.ts:41,72` `'chart'|'table'` = ViewParams view-toggle mode enum (which view shows first), NOT a node-type privilege.
- `core/config/section.ts` = the data-pipeline SectionContext (generic concept), NOT the section node.
- `nodeWalk.ts` = the EXISTING generic walker (zero hardcoded types) — proof the generic approach works; it is the precedent navUtils ignored.

## Shared-layer section files — verdicts
- `theme/defaults/DefaultSectionShell.tsx` — MISNAMED generic fallback (pass-through `<>{children.rendered}</>`). It is NOT section-specific. Verdict: GENERALIZE → rename `DefaultPassthroughShell` (or `UnregisteredTypeFallback`); it is the unregistered-type fallback, not a section default. The REAL section shell already lives in `plugins/nodes/section/default/SectionShell.tsx`.
- `context/SectionNavContext.tsx` — section-named but is the GENERIC scroll-spy / active-anchor nav context (IntersectionObserver over `NavSection[]`). It is nav-infrastructure, not section-node code. Verdict: KEEP in react but RENAME `AnchorNavContext` / `useAnchorNav` (drop the "Section" privilege in the name). Consumes generic `NavSection`, no section knowledge.
- `styles/section-card.css` — IF section-card-specific visuals → MOVE into `plugins/nodes/section/default/` (section already owns `section.css` there; this is a duplicate/legacy split). IF generic card primitive → move to `packages/styles`. Inspect first.
- `components/sections/` — DOES NOT EXIST (brief was stale). No action.
- DUPLICATION FOUND: section shell/skeleton/css/meta already correctly exist in `plugins/nodes/section/default/` (SectionShell.tsx, SectionSkeleton.tsx, section.css, meta.ts). The shared-layer `DefaultSectionShell` is a leftover misnamed fallback, not a second real shell.

## The nav fix — two capabilities (mirror presentation-projector registry)
The `transparent` cap ALREADY exists (wrap node; renderNode.ts expands it). But `row` is NOT transparent (real DOM container) — so reuse is wrong. Need a distinct nav cap.

1. **`nav-contributor` cap** — a node that contributes a nav section. Declared in its META (`caps: ['nav-contributor']`) + a small `navContribution` descriptor on the registry meta describing HOW to read its id/title/navMode (default: `anchor??id`, `title`, `view.visibleWhen`). section + georgraph declare this; engine reads it generically.
2. **`nav-transparent` cap** (descend-for-nav) — a real-DOM container (row) whose children the nav extractor should traverse even though the container itself contributes no section. Distinct from render `transparent` (no-DOM flatten).

`navUtils` becomes a generic visitor: for each child, if registry `getCaps(type)` includes `nav-contributor` → emit section via its declared reader; if includes `nav-transparent` → recurse into children/items (reuse `collectChildNodes` from nodeWalk.ts). ZERO type literals. New nav node = declare cap. Engine free of plugin imports (reads registry, not plugins — arrow respected).

Registry surface: add `NavContribution` reader descriptor to NodeRegistry meta + `getNavContribution(type,variant)`; OR encode reader as a registered `navReader` function keyed by type (like errorFallback). Prefer meta-descriptor (JSON-ish, Constructor-introspectable) with a default reader when only the cap (no custom descriptor) is declared.

## Fitness function — FF-NO-PRIVILEGED-NODE (un-regressable)
New `packages/react/src/engine/no-privileged-node.fitness.test.ts` (mirror no-tenant-content.fitness.test.ts). Source-scans `packages/react/src/engine/**` + `packages/core/src/**` for `type === '<literal>'` / `'<literal>'` matching any REGISTERED plugin node type. ALLOWLIST = ONLY structural framework types, each justified: `inner-page`,`tab-page`,`container-page`,`page` (page-root discriminant). Asserts navUtils references `getCaps`/registry, NOT `'section'`/`'row'`/`'georgraph'`. A second test registers a throwaway nav-contributor node and asserts extractNavSections picks it up with zero navUtils edit (proves the OCP seam — same shape as presentation.fitness.test.ts (c)).

## Migration (Strangler-Fig, byte-identical, green each phase)
- P0: add `nav-contributor` + `nav-transparent` to NodeCap/CAPS + NavContribution meta + getNavContribution on NodeRegistry. No behavior change.
- P1: section/georgraph META declare `nav-contributor`; row META declares `nav-transparent`. (Additive.)
- P2: rewrite navUtils to the generic registry-driven visitor (reuse collectChildNodes). Keep the OLD hardcoded path behind nothing — swap in one commit, snapshot-identical nav list.
- P3: rename DefaultSectionShell → fallback; rename SectionNavContext → AnchorNavContext (codemod consumers: PanelLayout, SiteRenderer, html.tsx, theme/defaults, context types).
- P4: relocate/inspect section-card.css.
- P5: land FF-NO-PRIVILEGED-NODE; allowlist frozen + justified.

## Product calls to flag
- `nav-transparent` vs reusing render `transparent`: confirmed DISTINCT (row has DOM). Reversible.
- NavContribution reader as meta-descriptor vs registered fn: lean descriptor (Constructor-introspectable). Two-way door.

Related: [[adr_element_config_schema_seam]] (per-slice schema, ISP), [[project_charts_split_8_1]] (two-registry split precedent), [[adr_constructor_phase2]] (open store model, kill enum).
