// ── showWhen — thin re-export of the engine's config-semantics SSOT ─────────
//
//  P1 (DESIGN-authoring-schema-ssot §3/§4). This file USED to carry a byte-
//  identical fork of the engine's showWhen evaluator + dot-path get/set. Those
//  bodies are now the single SSOT in `packages/core/src/config/{prop-path,
//  prop-visibility}.ts`, re-exported through `@statdash/react/engine`. This module
//  is retained ONLY to keep the panel's local import path (`./showWhen`) and its
//  local `isVisible` name stable for the Inspector + editors — no logic lives here.
//
//  `evalShowWhen` is the engine's name; the panel has always called it `isVisible`
//  locally, so we alias it. `getAtPath` / `setAtPath` pass straight through.
//
export { getAtPath, setAtPath, evalShowWhen as isVisible } from '@statdash/react/engine'
