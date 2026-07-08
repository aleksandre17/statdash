---
name: feedback-conform-engine-types
description: When a panel/UI task spec contradicts a published @statdash/engine type, the engine type wins — emit type-valid config, not the literal spec field
metadata:
  type: feedback
---

When a UI task spec describes a field/shape that contradicts the actual `@statdash/engine` type, conform to the engine type, not the prose.

**Why:** Engine types are the published contract between Constructor and renderer (root Laws 2/3). A field the type doesn't have would never typecheck and never run — emitting it is a fake solution. The panel's whole purpose is to generate engine-valid `DataSpec`.

**How to apply:** Two cases hit while building the DataSpec editor (`apps/panel/src/features/data-layer/`):
- Spec said FilterStepForm = `{op:'filter', expr:string}`. Engine `filter` op has **no** `expr` — it is `{op:'filter', where: Record<field, FilterValue>}`. Built a `where`-row editor instead.
- Spec said EncodingEditor `pct` toggles bare-string vs `{of}`. Engine `EncodingSpec.pct` is `{of}|{sumOf}|{field}` — no bare string. Mapped "direct field" mode → `{field}`, "of" mode → `{of}`.

In both cases the editor still delivers the spec's *intent* through the type-correct shape. Note it in the final report so the discrepancy is visible to the reviewer.
