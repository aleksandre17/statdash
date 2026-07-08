---
name: new-node-registration-checklist
description: Every place a NEW page-canvas node type must be registered so all gates go green — incl. the generated page-config.schema.json drift test (hand-patch when gen:schema can't run)
metadata:
  type: project
---

Adding a new node type (e.g. AR-40 `featured-slider`) requires touching **all** of
these or a fitness/typecheck fails:

**Runtime + catalog (barrels):**
- `nodes/<type>/default/{Node.ts,meta.ts,Shell.tsx,Skeleton.tsx,*.css,index.ts}` + `nodes/<type>/index.ts` (`export * from './default'`).
- `nodes/index.ts` — `export * as <camel> from './<type>'` (this is what `setupRegistrations` iterates → registerSlice → registerNodeType; Shell/Skeleton wire automatically).
- `registry.ts`, `catalog.ts` (both the `export { META … }` line AND the `import … Meta` + the `PALETTE_META` array), `authoring-metas.ts` (import + `AUTHORING_METAS` array).

**Generated JSON-Schema wire face** (`packages/contracts/schema/page-config.schema.json`):
- `packages/react/scripts/emit-page-config-schema.ts` — import + its `ALL_METAS` array (real `gen:schema` source).
- The committed `page-config.schema.json` — add a `node_<type>__default` $def AND an AnyNode `oneOf` `$ref`. The `page-config-schema.fitness` **drift test** (`live=generatePageConfigSchema(); expect(live).toEqual(committed)`) compares in-memory generation to the committed file. `toEqual` is **order-sensitive for arrays only** (the `oneOf` lists), NOT for `$defs` object keys — place the `$ref` at the SAME index palette order yields (right after the sibling registered before it); the `$def` can sit anywhere. $def body must match `buildNodeDef`: props from PropSchema first (`{title:<label.en>, description:"<proptype> field", default?, type}`), then `type`(const)/id/variant/data/view/children, `required:["type"]`, `additionalProperties:true`. If you can't run `pnpm gen:schema` (deep worktree), hand-patch — it's mechanical and the drift test verifies it exactly.

**Three node fitness corpora** (each imports a fixed META list + an `ALL_METAS` array — add to all three):
`nodes/__tests__/defaults-guard.fitness.test.ts`, `schema-completeness.fitness.test.ts`, `page-config-schema.fitness.test.ts`.

Keep the insert POSITION consistent across emit-script + fitness corpora + committed schema (all right after the same sibling) so palette order agrees everywhere.

See `.claude/kit/feedback/feedback_windows_worktree_pitfalls.md` for running gates from a deep worktree.
