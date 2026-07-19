// ── insertNode — the single, byte-identical node-insert path (V6) ─────────────
//
//  Every insert surface funnels through here: the palette drop (CanvasOverlay),
//  the Cmd-K command palette, the slash-insert, and the Outline's "+" affordance.
//  Because they all build the node the SAME way and write it through the SAME
//  store reducer, an insert via Cmd-K produces a CanvasNode byte-identical to an
//  insert via the palette — the V6 invariant the fitness test asserts.
//
//  Two pure pieces + one orchestrator:
//    makeNode(type, id)        build the CanvasNode (id + registry defaults + no children)
//    nestAccepts(parent, type) the registry's accepts contract for a nest
//    resolveInsertPlan(...)     HOW a type lands given the current selection —
//                              direct nest, auto-wrap into a container, or a
//                              guided hint (never a hidden no-op / invalid tree)
//  The component layer supplies the id factory and the store action; this module
//  owns the "what shape + where" decision so it cannot drift between surfaces.
//
import { nodeRegistry, isNodeContainer, slotAdmits } from '@statdash/react/engine'
import type { PlacementOp, PartInsertOp, NodeSeed } from '@statdash/react/engine'
import type { CanvasNode, CanvasPage } from '../types/constructor'

/**
 * The canonical page-level content container an auto-wrap creates. When a type is
 * not directly page-acceptable, the insert wraps it in a `section` (page → section
 * → type) — the document-editor "insert anything, the tool builds the structure"
 * rule (Notion/Gutenberg). The wrap is only offered when the registry contracts
 * actually permit it (nestAccepts guards below), so this constant names the
 * PREFERENCE, never bypasses the accept contract.
 */
export const AUTOWRAP_CONTAINER = 'section'

/**
 * Build a fresh CanvasNode for `type`, seeding props from the slice registry's
 * defaults (open registry — a newly-registered type is insertable the moment it
 * is registered). Byte-identical to the node the palette drop has always built.
 */
export function makeNode(type: string, id: string, variant?: string): CanvasNode {
  const props = { ...(nodeRegistry.getDefaults(type, variant) ?? {}) }
  return {
    id,
    type,
    ...(variant && variant !== 'default' ? { variant } : {}),
    props,
    childIds: [],
  }
}

/**
 * Whether `parentType` is a NODE-TREE drop target at all — the leaf/container
 * discriminant, now DERIVED from the declared parts (ADR-041 Phase 6, `isNodeContainer`):
 * a node accepts child NODES iff it declares ≥1 `slot`-residence part field. No kind /
 * flag is read to answer this containment question (FF-DERIVED-CONTAINMENT). The page
 * root (no parentType) is always a top-level target. A LEAF (chart, hero) declares no
 * slot part → not a target — even if it declares an empty `slots` object (hero:
 * `slots:{}` → zero slot parts). A `value`/`sourced` wrapper (kpi-strip items,
 * filter-bar controls) is a wrapper-by-contract but NOT a node-tree container: its
 * parts are values/projections, not draggable nodes, so it is correctly not a target.
 * Byte-identical to the retired `canHaveChildren` read (proven corpus-wide by the
 * plugins FF-DERIVED-CONTAINMENT gate: `canHaveChildren === true ⟺ declares a slot part`).
 */
export function isDropTarget(parentType: string | undefined): boolean {
  if (!parentType) return true                       // page root — top-level target
  const meta = nodeRegistry.getMeta(parentType)
  return meta != null && isNodeContainer(meta)
}

/**
 * Whether `childType` may be nested under `parentType`. Two questions, both from
 * already-declared meta (no new field, no packages change):
 *   1. Is the parent a drop target at all?  → declares a `slot` part (isDropTarget)
 *   2. Which child types may it hold?        → the slot's DECLARED content model
 *      (`slotAdmits`: identity `accepts` ∪ capability `acceptsCaps`; empty ⇒ any)
 *
 * Step 2 is the capability-accepts grammar (HTML5 content model): a section admits any
 * child DECLARING the `flow` capability, never a hardcoded type list — so a NEW content
 * block is placeable by declaration alone (OCP · FF-CAPABILITY-ACCEPTS). The child's caps
 * are resolved from ITS registered meta, so this reads both sides of the contract from the
 * registry (no per-type branch).
 *
 * Previously step 1 was skipped — a slot-less parent returned `true`, conflating
 * "leaf (accepts nothing)" with "open container (accepts anything)" and causing
 * the insert resolver to silently redirect an incompatible insert to page top.
 * Gating on `isDropTarget` FIRST fixes that silent-fail at the root: a leaf is
 * never a nest target, so the palette never offers (and the router never redirects)
 * an incompatible tile. The single SSOT shared by the Outline drag, the palette
 * drop, the ⌘K insert, and the context-aware palette filter (M4.1 Thread A).
 */
export function nestAccepts(parentType: string | undefined, childType: string): boolean {
  if (!parentType) return true                       // page root accepts any top-level node
  if (!isDropTarget(parentType)) return false        // a leaf accepts no child node
  const slots = nodeRegistry.getSlots(parentType)
  if (!slots) return true                            // open container (no explicit slots) → any
  const defs = Object.values(slots)
  if (defs.length === 0) return true
  // Accept if ANY slot admits the type (a node has at most one children list in the flat
  // model; the union of slot content-models is the effective contract). Capability-aware:
  // a slot may gate by identity (`accepts`), by content-category (`acceptsCaps`), or both.
  const childCaps = nodeRegistry.getCaps(childType)
  return defs.some((slot) => slotAdmits(slot, { type: childType, caps: childCaps }))
}

/**
 * Whether — and HOW — `type` can be placed at the PAGE ROOT (nothing selected), the
 * palette's honest insertion context for a blank page (SPEC S2 / §3.3). The page-root
 * palette must offer exactly `page-accepts ∪ canonical-wrap-reachable`, DECLARED from
 * the slot `accepts` contracts (never hardcoded to `section`):
 *   'direct' — the page's own root slots accept the type (section / repeat / …);
 *   'wrap'   — the page accepts the canonical container AND that container accepts the
 *              type (page → section → type, the auto-wrap `resolveInsertPlan` applies);
 *   'blocked'— neither: the type has no single-step home at the page root (a homeless
 *              content block), so the palette honestly omits it (it is reachable once a
 *              container is added — guidance-by-affordance, never a bouncing tile).
 * Pure over TYPES (no page tree), so the palette can classify every registry entry.
 * An absent `pageType` degrades to the permissive page-root (`nestAccepts(undefined)`),
 * preserving isolated-mount behaviour.
 */
export function pageRootInsertability(
  pageType: string | undefined,
  type: string,
): 'direct' | 'wrap' | 'blocked' {
  if (nestAccepts(pageType, type)) return 'direct'
  if (nestAccepts(pageType, AUTOWRAP_CONTAINER) && nestAccepts(AUTOWRAP_CONTAINER, type)) return 'wrap'
  return 'blocked'
}

/**
 * How a newly-inserted `type` lands given the current selection (FF-INSERT-NEVER-
 * CLIFF). A discriminated union so the illegal "insert into a parent that rejects
 * it" state is unrepresentable — every plan is a VALID placement or an explicit
 * guided hint, never a hidden no-op and never an invalid tree:
 *
 *   'direct'  — nest straight into `parentId` (a selected container that accepts
 *               the type, OR the page frame when it directly accepts the type).
 *   'wrap'    — the page does not directly accept the type, but the canonical
 *               container `wrapperType` (which the page DOES accept) accepts it:
 *               create the wrapper under `parentId`, nest the type inside it, in
 *               one undoable action (page → section → type).
 *   'blocked' — no single unambiguous wrapper makes the insert valid (a deeper /
 *               ambiguous structure would be needed); surface a guided hint rather
 *               than invent an ambiguous tree.
 */
export type InsertPlan =
  | { kind: 'direct';  parentId: string }
  | { kind: 'wrap';    wrapperType: string; parentId: string }
  | { kind: 'blocked'; reason: 'no-single-wrapper' }

/** One resolved insert operation — a built node and the container it lands under. */
export interface InsertOp {
  node:     CanvasNode
  parentId: string
}

/**
 * Resolve the insert plan for `type` given the current selection. Mirrors document-
 * editor ergonomics (Notion/Gutenberg "insert anything; the tool builds the needed
 * structure"), reconciled with the Wave-1 contextual filter:
 *   1. a selected CONTAINER that accepts the type → nest directly inside it;
 *   2. else the page frame directly accepts the type → page top-level;
 *   3. else the canonical wrapper (`section`) both fits the page AND accepts the
 *      type → auto-wrap (page → section → type);
 *   4. else → a guided hint (blocked), never an invalid tree or silent no-op.
 *
 * Every branch is registry-validated via `nestAccepts`, so a contract change (a
 * slot widening/narrowing its `accepts`) automatically reshapes the plan — no
 * hardcoded per-type placement list.
 */
export function resolveInsertPlan(
  page: CanvasPage,
  selectedId: string | null | undefined,
  type: string,
): InsertPlan {
  // 1. A selected container that can legally hold the type → nest directly.
  if (selectedId) {
    const selected = page.nodes[selectedId]
    if (selected && nestAccepts(selected.type, type)) {
      return { kind: 'direct', parentId: selected.id }
    }
  }
  // 2. Page/frame level: the page's OWN root kind directly accepts the type →
  //    top-level insert. Read per-page (`page.type`), never a privileged literal:
  //    a landing/tab/container page root accepts what THAT root's slots accept.
  if (nestAccepts(page.type, type)) {
    return { kind: 'direct', parentId: page.id }
  }
  // 3. Auto-wrap into the canonical container the page accepts AND that accepts
  //    the type (page → section → type), one undoable action.
  if (
    nestAccepts(page.type, AUTOWRAP_CONTAINER) &&
    nestAccepts(AUTOWRAP_CONTAINER, type)
  ) {
    return { kind: 'wrap', wrapperType: AUTOWRAP_CONTAINER, parentId: page.id }
  }
  // 4. No single unambiguous wrapper makes it valid → guided hint.
  return { kind: 'blocked', reason: 'no-single-wrapper' }
}

/**
 * Compile an insert plan into the ordered node-insert operations a surface applies
 * through the store's batched `insertNodes` (ONE history entry). The id factory is
 * called once per created node IN ORDER, so two surfaces that share the same
 * factory sequence produce byte-identical results — the V6 invariant, now covering
 * the auto-wrap (a ⌘K wrap == a palette wrap). A 'blocked' plan compiles to no ops
 * (the caller surfaces the guided hint instead).
 */
export function planInserts(
  plan: InsertPlan,
  type: string,
  makeId: () => string,
  variant?: string,
): InsertOp[] {
  if (plan.kind === 'blocked') return []
  if (plan.kind === 'direct') {
    return [{ node: makeNode(type, makeId(), variant), parentId: plan.parentId }]
  }
  // wrap: build the wrapper first (its id is the child's parent), then the child.
  const wrapper = makeNode(plan.wrapperType, makeId())
  const child   = makeNode(type, makeId(), variant)
  return [
    { node: wrapper, parentId: plan.parentId },
    { node: child,   parentId: wrapper.id },
  ]
}

// ── planPresetInserts — the composed-preset insert path (ADR-049 P2b · ADR-050 R2) ──
//
//  The preset-insert peer of `planInserts`. A preset is a partial element declaration
//  (`NodeSeed` — a pure-config sub-tree). This expands that seed into the SAME ordered
//  `InsertOp[]` the batched `insertNodes` reducer commits (ONE history entry), so a
//  dropped preset lands bound + pre-wired as a single undoable action. Three properties
//  keep the V6 byte-identical insert invariant EXACT (`makeNode`/`resolveInsertPlan`
//  stay UNTOUCHED — this is a pure sibling builder over them):
//
//    1. Placement is SHARED — the preset ROOT flows through the caller's existing
//       `resolveInsertPlan(page, sel, seed.type)` (→ direct / wrap / blocked), so a
//       preset obeys `nestAccepts`/`slotAdmits` identically to a bare tile and the
//       never-cliff guarantee extends to presets for free.
//    2. The node build OVERLAYS `makeNode` — each seed node is `makeNode(type, id,
//       variant)` then overlaid `props = { ...getDefaults, ...seed.props }` (+ data/view
//       folded to their node-body keys). A seed of just `{ type }` produces a node
//       BYTE-IDENTICAL to today's palette drop (FF-PRESET-DEGENERATE-IDENTITY).
//    3. Ids are assigned in FIXED PRE-ORDER via the SAME `makeId` factory (wrapper →
//       root → children depth-first), mirroring how `planInserts`' wrap branch assigns
//       wrapper-then-child — so two surfaces inserting the same preset produce
//       byte-identical trees. `childIds` are left EMPTY on every built node: the
//       parent↔child link is expressed ONLY by each op's `parentId`, and the reducer
//       wires `childIds` from it (`insertNodePatch`) — exactly as `planInserts` does.

/**
 * Build one seed node (overlaying `makeNode`) and, depth-first, its children — pushing
 * each as an `InsertOp` in PRE-ORDER (parent before child, so the folding reducer sees
 * the parent present before nesting under it). Returns the built node's id (its
 * children's `parentId`). `childIds` stay `[]` — the reducer derives them from `parentId`.
 */
function buildSeedInserts(
  seed:     NodeSeed,
  parentId: string,
  makeId:   () => string,
  out:      InsertOp[],
): string {
  const node = makeNode(seed.type, makeId(), seed.variant)
  // Overlay declared config onto the registry-default props. A degenerate seed (`{type}`
  // with no overlays) leaves the node byte-identical to `makeNode` — the pinned invariant.
  if (seed.props) node.props = { ...node.props, ...seed.props }
  if (seed.data !== undefined) node.props.data = seed.data   // node-body bind key (props.data)
  // node-body visibility key — MERGED so a pre-wired `visibleWhen` never clobbers a
  // default `view.role` (chart/table) the getDefaults seeded.
  if (seed.view !== undefined) {
    node.props.view = { ...(node.props.view as Record<string, unknown> | undefined), ...seed.view }
  }
  out.push({ node, parentId })
  if (seed.children) {
    for (const child of seed.children) buildSeedInserts(child, node.id, makeId, out)
  }
  return node.id
}

/**
 * Expand a preset `seed` into ordered `InsertOp[]` given a resolved `InsertPlan` for the
 * preset ROOT type. `direct` nests the seed subtree straight under the plan's parent;
 * `wrap` builds the canonical container first (its id becomes the seed root's parent, the
 * same page → section → type hop `planInserts` applies); `blocked` compiles to no ops.
 * The id factory is called once per created node IN PRE-ORDER — byte-identical across
 * surfaces (V6, extended to cover preset inserts).
 */
export function planPresetInserts(
  seed:   NodeSeed,
  plan:   InsertPlan,
  makeId: () => string,
): InsertOp[] {
  if (plan.kind === 'blocked') return []
  const out: InsertOp[] = []
  if (plan.kind === 'wrap') {
    const wrapper = makeNode(plan.wrapperType, makeId())
    out.push({ node: wrapper, parentId: plan.parentId })
    buildSeedInserts(seed, wrapper.id, makeId, out)
  } else {
    buildSeedInserts(seed, plan.parentId, makeId, out)
  }
  return out
}

/**
 * Compile a preset insert into the ONE `PlacementOp` the slot-residence `placePart`
 * commits — the preset peer of `planPlacement`'s insert arm. Shares `placeSlotPart`
 * with every other structural gesture (ONE placement grammar); an empty expansion (a
 * blocked plan) compiles to null (the caller surfaces the guided hint).
 */
export function planPresetPlacement(
  seed:   NodeSeed,
  plan:   InsertPlan,
  makeId: () => string,
): PlacementOp | null {
  const ops = planPresetInserts(seed, plan, makeId)
  return ops.length === 0 ? null : { kind: 'insert', ops: ops as unknown as PartInsertOp[] }
}

// ── PlacementPlan — ONE structural-placement resolver (ADR-042 D2 · generalizes InsertPlan) ──
//
//  `InsertPlan` models "how does a NEW type land" (direct / wrap / blocked). `PlacementPlan`
//  widens it to cover EVERY structural gesture — insert (from the palette) AND move (of an
//  existing node) — so both share ONE resolver and ONE legality path (the ONE `slotAdmits`,
//  via `nestAccepts`). The Outline's Candidate-A/B nest-vs-reorder GUESS is retired: it becomes
//  a RESOLVED, tested plan, byte-identical to the logic it replaces, now shared with every
//  surface (§2.3). `resolvePlacementPlan(page, source?, target, type)` = `resolveInsertPlan`
//  widened: `source` absent ⇒ insert; `source` present ⇒ move (reorder within a container /
//  reparent across containers). Every branch is registry-validated → an invalid tree is
//  unrepresentable (a plan is a valid placement or an explicit `blocked` hint).
//
export type PlacementPlan =
  | { kind: 'direct';   parentId: string }                       // insert: nest straight in (page/container)
  | { kind: 'wrap';     wrapperType: string; parentId: string }  // insert-never-cliff (page → section → t)
  | { kind: 'reorder';  parentId: string; index?: number }       // move: same-container reorder
  | { kind: 'reparent'; parentId: string; index?: number }       // move: into a different container
  | { kind: 'blocked';  reason: string }

/** The container id that currently holds `nodeId` — the page id for a top-level node, else
 *  the parent node whose `childIds` include it. Mirrors `buildOutlineRows`' `parentId`
 *  assignment (structural, collapse-independent), so a page-derived move plan is byte-
 *  identical to the row-derived heuristic it replaces. */
function parentContainerId(page: CanvasPage, nodeId: string): string {
  if (page.nodeIds.includes(nodeId)) return page.id
  return Object.values(page.nodes).find((n) => n.childIds.includes(nodeId))?.id ?? page.id
}

/** A container's node type (undefined for the page root) — the accept-contract lookup key. */
function containerType(page: CanvasPage, parentId: string): string | undefined {
  return parentId === page.id ? undefined : page.nodes[parentId]?.type
}

/** A container's ordered child-id list (the page top-level, or a node's `childIds`). */
function containerChildOrder(page: CanvasPage, parentId: string): string[] {
  return parentId === page.id ? page.nodeIds : (page.nodes[parentId]?.childIds ?? [])
}

/**
 * Resolve HOW a part lands. `source` absent ⇒ an INSERT of a new `type` (delegates to the
 * KEPT `resolveInsertPlan`, byte-identical — so every insert fitness stays green). `source`
 * present ⇒ a MOVE of the existing node `source`, reproducing the Outline's Candidate-A/B
 * resolution as a resolved plan:
 *   A — nest INTO `target` when it is an accepting container the source isn't already
 *       parented by → reparent at index 0. An EMPTY container is a valid nest-target too
 *       (0102 R1 · the Slice-1 placeholder is now delivered: an empty container renders a
 *       visible drop-affordance on the canvas, so "drop ON the container" unambiguously
 *       means nest-as-child). Disambiguation is by the TARGET: target-is-container → nest;
 *       target-is-leaf → sibling reorder (Candidate B) — deterministic, no childCount guess.
 *   B — else a sibling reorder/reparent within `target`'s container, with the same
 *       drop-below index adjustment the heuristic applied.
 */
export function resolvePlacementPlan(
  page:     CanvasPage,
  source:   string | null | undefined,
  target:   string | null | undefined,
  type:     string,
): PlacementPlan {
  // INSERT — no source node: the KEPT insert resolver (direct / wrap / blocked), verbatim.
  if (!source) return resolveInsertPlan(page, target, type)

  // MOVE — an existing node. `target` is the drop-target row's node id.
  if (!target) return { kind: 'blocked', reason: 'no-target' }
  const overNode = page.nodes[target]
  if (!overNode) return { kind: 'blocked', reason: 'no-target' }
  const targetParentId = parentContainerId(page, target)

  // Candidate A — nest INTO the target (an accepting container the source isn't already in).
  // Empty OR populated: an empty container is a first-class nest-target (0102 R1) — its
  // on-canvas placeholder makes "drop ON it" mean nest-as-child. The `targetParentId !== source`
  // guard still prevents nesting a node inside a container it already parents.
  if (nestAccepts(overNode.type, type) && targetParentId !== source) {
    return { kind: 'reparent', parentId: target, index: 0 }
  }
  // Candidate B — sibling reorder within the target's container (same drop-below adjustment).
  if (nestAccepts(containerType(page, targetParentId), type)) {
    const siblings = containerChildOrder(page, targetParentId)
    const fromIdx  = siblings.indexOf(source)
    let   toIdx    = siblings.indexOf(target)
    if (fromIdx !== -1 && fromIdx < toIdx) toIdx -= 1
    const index = toIdx < 0 ? undefined : toIdx
    return parentContainerId(page, source) === targetParentId
      ? { kind: 'reorder',  parentId: targetParentId, index }
      : { kind: 'reparent', parentId: targetParentId, index }
  }
  return { kind: 'blocked', reason: 'nest-rejected' }
}

/**
 * Compile a resolved `PlacementPlan` into the ONE `PlacementOp` the slot residence's
 * `placePart` commits — the structural-gesture peer of `planInserts`. An INSERT plan
 * (direct / wrap) compiles through `planInserts` (byte-identical node build + id sequence),
 * a MOVE plan (reorder / reparent) into a `move` op over the existing `source`. A `blocked`
 * plan compiles to null (the caller surfaces the guided hint). Opts carry the insert inputs
 * (`type` + id factory + variant) OR the move subject (`source`).
 */
export function planPlacement(
  plan: PlacementPlan,
  opts: { type?: string; makeId?: () => string; variant?: string; source?: string },
): PlacementOp | null {
  if (plan.kind === 'blocked') return null
  if (plan.kind === 'direct' || plan.kind === 'wrap') {
    if (!opts.type || !opts.makeId) return null
    const ops = planInserts(plan, opts.type, opts.makeId, opts.variant)
    // The port treats a node as an OPAQUE record (as `writePart` treats `element`); the
    // concrete CanvasNode rides through verbatim, re-typed at the commit boundary (placeNode).
    return ops.length === 0 ? null : { kind: 'insert', ops: ops as unknown as PartInsertOp[] }
  }
  // reorder / reparent — a move of the existing source node into `parentId` at `index`.
  if (!opts.source) return null
  return { kind: 'move', nodeId: opts.source, parentId: plan.parentId, index: plan.index }
}
