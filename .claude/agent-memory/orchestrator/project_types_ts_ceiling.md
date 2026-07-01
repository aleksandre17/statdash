---
name: types-ts-ceiling
description: engine/react types.ts is near the 400-line hard ceiling — decomposition required before adding more interface fields
metadata:
  type: project
---

`engine/react/src/engine/types.ts` hit ~398/400 lines after N44 added `RenderContext.theme?`. The post-edit hook enforces a 400-line hard ceiling.

**Why:** N37 adds 3 more fields (scope on ViewParams, compareRows/compareLabel on RenderContext) — will push past 400. N41 still needs to add `auth?: AuthContext` to RenderContext.

**How to apply:** Before any agent writes to `types.ts`, instruct it to split the file first. Recommended decomposition:
- `types/node.ts` — NodeBase, NodeDef, ViewParams, NodeTypeMap
- `types/context.ts` — RenderContext, SectionContext refs
- `types/slice.ts` — SliceMeta, SlotDef, PropSchema, PropertyGroup
- `types/index.ts` — re-exports all three (barrel)

The agent should perform the split as the FIRST action, verify tsc=0, then add the new field in the appropriate sub-file.

**Status:** Not yet split as of 2026-06-17. N41 launch must include decomposition instructions.
