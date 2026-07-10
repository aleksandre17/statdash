// ── targets/nodeWalk.ts — RE-EXPORT of the consolidated core walker ──────────
//
//  CONSOLIDATED INTO CORE [AR-49 V2 / ADR-024 §3]. This generic node-tree walker
//  was born here (extracted from api.ts + warm.ts — Law 5, one concern one home),
//  but it is PURE and STRUCTURAL: no registry, no React, no DOM. V2's `compilePage`
//  (core) must walk the SAME tree the render / warm / api targets walk, so the single
//  source of truth now lives in `packages/core/src/graph/nodeWalk.ts` (arrow-clean —
//  core cannot import react, and the walker never needed to).
//
//  This file stays as a RE-EXPORT so every existing importer (api.ts, warm.ts,
//  navUtils.ts, nodeWalk.test.ts) keeps its `./nodeWalk` / `./targets/nodeWalk`
//  import path byte-identical — the consolidation is invisible to consumers.

export {
  isNodeObject,
  collectChildNodes,
  DATA_CARRYING_KEYS,
} from '@statdash/engine'
export type { GenericNode } from '@statdash/engine'
