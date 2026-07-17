---
name: no-external-special-case-self
description: Owner caught the lead's own hotfix violating ADR-038 — per-type branches belong at the type's declared seam (core), never inline in a consumer, even under deploy pressure
metadata:
  type: feedback
---

When the lead self-executes a fix, the SAME Bounded Element bar applies as for agents: a
`def.type === '…'` branch inline in a consumer (hook/shell/harness) is an EXTERNAL
per-type special-case — forbidden (ADR-038 / FF-NO-EXTERNAL-SPECIAL-CASE) even when the
fix content is correct and the gate is green.

**Why:** 2026-07-16 — the multi-select ctx-fold regression fix landed as an inline type
branch in `useFilterState` + a hand-replicated fold in the api equiv harness. Owner
reviewed the diff line-by-line and challenged it ("we never hardcode / patch; agnostic,
growth-oriented, SOLID"). The correct form was `toCtxValue(def, raw)` in core beside
`autoParse` (its dual: typed surface vs ctx wire scalar) — the ONE per-type
discrimination site, co-located with the ParamDef union; all consumers stay generic
projections and replica drift becomes impossible.

**How to apply:** before committing any self-executed fix, run the same standards
pre-check routed work gets: "is this discrimination at the type's declared seam, or am I
scattering it into a consumer because it's faster?" Deploy pressure is not an exemption.
The owner reads diffs — placement flaws will be caught; catch them first. Related:
[[strict-solid-per-element]] (user memory), ADR-038, FF-NO-EXTERNAL-SPECIAL-CASE.
