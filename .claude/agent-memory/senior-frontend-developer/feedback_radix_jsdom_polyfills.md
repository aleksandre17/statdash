---
name: feedback-radix-jsdom-polyfills
description: Radix primitives need 4 jsdom polyfills to open; native→Radix swaps break tests coupled to fireEvent.change on the old native element
metadata:
  type: feedback
---

When a surface migrates MUI/native controls to Radix ([[project-mui-radix-migration]]), two test
realities bite — handle them proactively, not after a red suite.

**Rule 1 — Radix listboxes/popups need jsdom polyfills to OPEN.** A CLOSED Radix Select renders fine
(the trigger is just a `<button>`), but opening needs: `Element.prototype.hasPointerCapture`,
`releasePointerCapture`, `scrollIntoView`, and `ResizeObserver`. The panel harness
(`apps/panel/vitest.setup.ts`) now stubs all four globally. For `packages/react` tests (default env
`node`; opt into jsdom per-file with `// @vitest-environment jsdom`), stub them in the test file's
`beforeAll` — the setup only injects jest-dom. Open a select in a test with `trigger.focus()` +
`fireEvent.keyDown(trigger, { key: 'ArrowDown' })`, then commit by `fireEvent.click(option)`
(keyboard Enter is flaky in jsdom — no real focus/highlight). Assert the ARIA contract via
`getByRole('combobox', { name })` + `findByRole('listbox')` + `getAllByRole('option')`.

**Why:** jsdom doesn't implement Pointer Capture / scroll / resize observation; Radix uses them.

**Rule 2 — a native→Radix swap breaks any test that drove the old native element.** Tests doing
`fireEvent.change(select, { target: { value } })` on a native `<select>` FAIL after the swap (there's
no `<select>` — it's a button + portalled listbox). Migrate them to the open+pick gesture (Rule 1).
The control keeps its `id` on the trigger button, so `getElementById`/existence assertions still pass.

**How to apply:** Before swapping a control, grep the test suite for `fireEvent.change` / native-select
queries on it and migrate those, and ensure the harness has the polyfills. Also: `packages/react` is
the app-AGNOSTIC layer — `no-tenant-content.fitness.test.ts` forbids the literal "geostat" (any tenant
name) anywhere in its source, INCLUDING comments. Say "a second tenant / runner chrome", never name one.
