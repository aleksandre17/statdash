---
id: "0057"
title: "Land FF-NO-EXTERNAL-SPECIAL-CASE — the missing gate that keeps per-type projectors out of generic layers"
status: done
resolution: "Landed as platform/apps/panel/src/canvas/noExternalSpecialCase.fitness.test.ts. Two teeth: NEGATIVE (generic selection/overlay/inspector sources carry no per-type literal / no registerNodeProjector / nodeProjection; the reverted module does not exist) + POSITIVE (band selection derives from the declared itemSchema — proven on a synthetic schema AND on the real registered kpi-strip schema). Guard proven to BITE. Green on HEAD."
class: M
priority: P1
owner: —
implements: ADR-038 Bounded-Element Law — machine-enforced no-external-special-case invariant
depends_on: ["0056"]
links:
  - docs/architecture/decisions/ADR-038-bounded-element-law.md
---
**Goal** — Add the fitness function that ADR-038 needs but does not yet have (grepped the ~200-name FF suite — absent). It fails: **(a)** any projector/registry keyed by a concrete node-type that holds a bespoke `toNode` value→node lowering in the generic canvas/inspector/engine layers (the exact 0056 anti-pattern), and asserts **(b)** positively, that every authorable value-band array field is authored via its declared `itemSchema` (which `nodeRegistry.getSchema('kpi-strip')` already satisfies).

**Why** — FF-ELEMENT-DECLARES-CONTRACT already exists, STRONGER, as `FF-SCHEMA-COMPLETE` (`packages/plugins/nodes/__tests__/schema-completeness.fitness.test.ts`) — do NOT duplicate it (Law 6). The COMPLEMENTARY gate — "no external per-type special-casing" — is the one missing. Landing it after 0056 locks the law so the reverted anti-pattern cannot return.

**DoD**
- [ ] FF exists + registered in the CI fitness suite.
- [ ] Verified RED against the a43b3c6 projector pattern (pre-revert or a fixture), GREEN on HEAD post-0056.
- [ ] Placed to avoid the documented Vitest-4 `__dirname`-as-workspace-root hazard and NOT inside a racing directory.
- [ ] `tsc -b --force` EXIT 0.

**Notes** — Lands AFTER 0056 so it locks a clean tree rather than fighting an in-flight edit. Structural/source-scanning test — mind the workspace-root injection ([[vitest-workspace-dirname]] in project memory).
