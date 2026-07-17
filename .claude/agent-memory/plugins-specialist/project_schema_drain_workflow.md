---
name: schema-drain-workflow
description: Draining a panel PropSchema (SCHEMA_TODO → declared fields) — nested-itemSchema pattern, gen:schema artifact, tsc/getByTestId gotchas
metadata:
  type: project
---

Draining an under-declared element schema so the generic Inspector authors its full
contract (ADR-038 · FF-ELEMENT-DECLARES-CONTRACT). The chart drain (ChartNode.ts) is
the reference; these are the non-obvious steps.

**Why:** an element under-declares → sparse dock. The fix is DECLARE (schema data) +
let the GENERIC projection read it — never a per-type inspector branch.

**How to apply:**
- Nested objects/arrays are authored by declaring them `type:'object'|'array'` WITH a
  structured `itemSchema` → the generic `ObjectControl`/`ArrayOfControl` drill-editor
  (packages: `apps/panel/src/inspector/controls/NestedItemControl.tsx`) handles them,
  zero element-specific code. Mirror gauge's pattern: ONE `defineSchema` const PER
  nested level (`AxisItemSchema`, `AxesItemSchema`…), each with a co-located
  `Expect<AssertSchemaCovers<EngineType, typeof XSchema>>`, referenced as
  `itemSchema: XSchema`. Drain to SCALAR leaves — a bare `object`/`array` with no
  itemSchema is an "opaque leaf" the `schema-completeness.fitness` depth gate flags
  (must add itemSchema OR argue it in that test's `OPAQUE_BY_DESIGN`).
- The top-level compile gate is `_XCovers = Expect<AssertSchemaCovers<Node, typeof
  Schema, Todo>>`. Draining = shrink `Todo` toward empty; empty Todo means a new
  engine render-input left undeclared fails `tsc`. `EditableKeys` excludes NodeBase
  system keys (fieldConfig/dataLinks/view/…) and NodeDef[] slots — so those need no
  schema field. Over-covering never breaks the FORWARD-only assert.
- Field→control resolution (`FieldControlRegistry.resolve`, the generic reader):
  coverage:'localized'|LocaleString→LocaleField · enum-ref→EnumRefField ·
  options→SelectControl · object/array+itemSchema→Object/ArrayOfControl ·
  string/number/boolean/color by type · else→SummaryCard. Bilingual text = `type:
  'LocaleString', coverage:'localized'`. `showWhen` supports ONLY `lhs === rhs`
  (single equality, `prop-visibility.ts`) — no OR/includes; a `{$ctx}` ref lhs
  degrades to hidden.

**Gotchas (all hit live):**
- ANY schema change ⇒ regenerate the served artifact: `pnpm gen:schema` (→ writes
  `packages/contracts/schema/page-config.schema.json`), else
  `page-config-schema.fitness` (live==committed) fails. Commit the artifact.
- A top-level `object`+itemSchema field mounts a nested `<Inspector>`
  (`ObjectFormScreen`), so several `data-testid="inspector"` coexist → singular
  `getByTestId('inspector')` throws "multiple elements". Use `getAllByTestId`.
- In fitness tests, `new Set(Schema.map(f=>f.field))` infers a Set of the LITERAL
  field union (defineSchema preserves literals) → `.has(someString)` is a tsc error.
  Widen: `new Set<string>(...)`.
- `packages/plugins` has NO tsconfig (built by tsup). Its `_XCovers` asserts are
  typechecked transitively via the apps (`tsconfig paths` map `@statdash/plugins` →
  SOURCE). Authoritative type gate = root `npx tsc -b --force` after deleting
  `*.tsbuildinfo`. Plugins `.fitness.test.ts` files are vitest-only (not tsc'd).
