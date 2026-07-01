---
name: reference-result-not-impl
description: A visual reference/screenshot defines the RESULT to match, never the implementation — reach it via clean canonical architecture, never hardcode-to-match
metadata:
  type: feedback
---

A visual reference (screenshot, existing version, competitor) specifies the **result we want** — what the charts/tables/UI should LOOK like — **not how to build it**. "We want it to look like the screens" must NEVER be satisfied by dropping quality.

**Why:** the owner stated this explicitly during the render-pipeline planning (2026-07-01): the screenshots in `scriness/` are the visual target, but "the fact that we want it that way doesn't mean we drop the quality." Matching a reference by hardcoding, per-screen special-casing, or duplicating a primitive the core already owns is exactly the drift that caused the regressions (lossy axis hack, two rival choropleth engines, effects lost in a "byte-identical" migration).

**How to apply:** the RESULT must equal the reference; the PATH must be our highest-concept architecture — declarative/config-driven, DRY/SSOT, no hardcoding, no anti-patterns, no bad blueprints, conditional logics (visibleWhen/perspective/effects) covered. Always **refine/elevate the EXISTING code (Strangler)** to the best concept — never rewrite-from-scratch and never hardcode-to-match the picture. Put this on every render/UI board item as a standing Definition-of-Done, and have chief-engineer filter for hardcode/DRY/anti-patterns. See [[elevate-dont-patch-proactive-design]], [[adapt-architecture-to-best-concept]], [[visual-parity-verification]], [[guardian-of-canon]].
