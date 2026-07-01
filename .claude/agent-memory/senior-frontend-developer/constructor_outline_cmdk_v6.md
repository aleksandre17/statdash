---
name: constructor-outline-cmdk-v6
description: V6 Outline tree (Webflow Navigator) + Cmd-K/slash insert (cmdk) over the SAME flat store in apps/panel — insert/move engine, byte-identical-insert SSOT
metadata:
  type: project
---

V6 of the Constructor roadmap: structural navigation + frictionless insert over the unified `CanvasNode` flat store in `apps/panel`, all additive + byte-identical config.

**Why:** ADR `adr_constructor_vision_north_star.md` V6 (Webflow Navigator + Notion/Gutenberg/Linear insert) — the "easy for a non-programmer" navigation/insert layer over the existing WYSIWYG canvas.

**How to apply / what landed:**
- **Insert/move engine (the SSOT):** `store/constructor.pages.ts` now has `insertNodePatch(s, pageId, node, parentId, index?)` + `moveNodePatch(s, pageId, nodeId, parentId, index?)` — the SINGLE path every surface mutates the flat store through (palette drop, Cmd-K, slash, Outline). Container addressing is uniform: `parentId === pageId` ⇒ page `nodeIds`; else ⇒ `node.childIds`. `moveNodePatch` detaches from wherever the id lives + re-attaches; refuses self/descendant nest (isDescendant guard). Store actions `insertNode`/`moveNode` (history-composed) + selector `useActivePageId`.
- **Byte-identity SSOT:** `canvas/insertNode.ts` — `makeNode(type, id, variant?)` builds the CanvasNode (`{id,type,props:getDefaults,childIds:[]}`, byte-identical to the old palette drop), `nestAccepts(parentType, childType)` is the registry slot-`accepts` contract shared by Outline drag + palette drop, `resolveInsertParent(page, selectedId, type)` decides container from selection. PageStep.handleDrop was refactored to use makeNode+insertNode (eliminated the old addNode-then-updateNode(childIds) re-parent dance).
- **Outline (`outline/`):** `outlineModel.buildOutlineRows(page, collapsed)` flat→depth-stamped rows (aria-level/posinset/setsize); `OutlineTree` (role=tree, @dnd-kit sortable over flattened rows, arrow-key roving nav, collapse/expand view-state, bidirectional selection via store); `OutlineItem` (role=treeitem — spread dnd `attributes`/`listeners` FIRST then override role/tabIndex/aria so tree pattern wins; the `role`/`tabIndex` dup is a TS2783 error otherwise). Type chip hidden when label===type (avoids dup-text + getByText ambiguity).
- **Cmd-K (`command/`):** ADOPTED `cmdk` dep (catalog `^1.0.0`, resolves 1.1.1; uses `Command.Dialog/Input/List/Group/Item/Empty`). `commandModel` builds commands from `getPaletteEntries()` (insert, OCP) + navigate + delete/duplicate; `slashMode` narrows to insert-only. `useCommandRunner` executes via makeNode+insertNode (same path = byte-identical). `useCommandPalette` owns ⌘K/Ctrl-K global shortcut. Reset search in onOpenChange handler NOT useEffect (set-state-in-effect is a lint error in panel).
- **Slash:** folded into CommandPalette — leading "/" in the cmdk input switches to insert-only + uses the remainder as query (YAGNI slice, no free-form inline-canvas editor).
- **Mounted** in `PageStep`: grid widened to `200px 200px 1fr 280px` (palette | Outline | canvas | inspector) + ⌘K button + `<CommandPalette>`.

**Fitness test (the invariant):** `command/insertByteIdentity.fitness.test.ts` — for EVERY registered type, palette-path insert config === Cmd-K-path insert config (`JSON.stringify` equality, fixed id). +28 tests (1357→1385). check-laws does NOT scan apps/panel (only packages/) so panel i18n strings are unchecked there; the lone check-laws fail is pre-existing in `packages/core/config/param-schemas.ts`, not V6.
