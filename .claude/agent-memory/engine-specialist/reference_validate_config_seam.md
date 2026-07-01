---
name: validate-config-seam
description: The engine-tier structural config validator (validateConfig) — wire-contract floor shared by api + react; node-type registry is fail-open + injection-fed
metadata:
  type: reference
---

`validateConfig(config: unknown): ValidationError[]` lives in `platform/packages/core/src/validation/config.ts` (`@statdash/engine`). `[]` === valid; never throws. It is the STRUCTURAL FLOOR (ADR adr-config-and-render-vision §7), the SAME function BOTH `apps/api` (save) and `packages/react` (render) import — moved to core because it is the deepest layer both can legally reach.

**Boundary (the precise cut):** engine validates SHAPE only — tree well-formedness, `type` non-empty string, `type ∈ knownNodeTypes()`, `id` non-empty when present, page-root `type ∈ {inner-page,tab-page,container-page}`, page root has `children`, `schemaVersion` integer if present, no cycles, and each node's `data` via the existing `validateDataSpec`. RICH per-node PropSchema / slot-accepts / slice-`validate()` hooks stay app-tier in react (they need the renderer registry). Do NOT duplicate them.

**Node-type registry** (`platform/packages/core/src/registry/nodeTypes.ts`): `registerNodeType`/`knownNodeTypes`/`hasNodeType` + `_resetNodeTypes` (test-only). FAIL-OPEN when empty (skips the type-∈-set check, exactly like `validateDataSpec` tolerates an empty spec registry). Core holds NO hardcoded node-type list — react's register-all injects the set at startup (a later wiring step). 

**Shared corpus** `platform/packages/core/src/validation/config-corpus.ts` (`VALID_CONFIGS`/`INVALID_CONFIGS`/`corpusAllTypes`) is the SSOT the later api + react F1 tests must reuse — do not inline-copy. Error codes are named consts in `validation/types.ts` ValidationCode union (NOT_AN_OBJECT, MISSING_TYPE, UNKNOWN_NODE_TYPE, CYCLIC_CHILDREN, INVALID_CHILDREN, INVALID_PAGE_ROOT_TYPE, INVALID_SCHEMA_VERSION, INVALID_ID, INVALID_TYPE_FIELD).

The stale pipeline.ts NOTE about `validatePageTree` belonging in react is RESOLVED in-place (only slice-validate hooks are up-tier; the known-type-SET legitimately lives in core via injection).
