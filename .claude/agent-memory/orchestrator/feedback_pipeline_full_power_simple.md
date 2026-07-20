---
name: pipeline-full-power-simple
description: Standing mandate — the data pipeline must do EVERYTHING the arsenal can (full capability parity) AND the UI must be simple enough for a non-programmer to fully master; simple AND powerful; free to adopt reference-class libraries
metadata:
  type: feedback
---
The data pipeline (the ONE data spine, ADR-051 / 0102) must satisfy TWO non-negotiables at once:
1. **Full capability** — anything our arsenal (engine/data layer) can do must be expressible as a pipeline step and reachable in the one workspace. Zero capability left outside the pipeline. No gaps.
2. **Radical simplicity** — the interface must be so simple that a NON-PROGRAMMER can fully master it (no raw JSON, offer-driven, progressive disclosure, live preview, plain-language verbs). "Simple AND powerful."

**Why:** owner (2026-07-20), on the ADR-051 unified-data-workspace program: "whatever we have in the arsenal, the pipeline should be able to do everything, and the interface simple enough that a user masters it fully even if not a programmer. Use an additional package/library if needed. I want a result — simple and powerful, built on the core of platforms/frameworks with huge experience."

**How to apply:** (a) the owner EXPLICITLY authorized adopting reference-class packages/libraries where they help (visual pipeline/query builder, expression/formula editor with autocomplete, high-grade data grid) — evaluate adopt-vs-build honoring the dependency arrow + agnostic core + Law 4 (adopt standards whole). (b) Every DU wave and any new verb is judged against BOTH axes: does it add/keep full capability AND stay non-programmer-simple? (c) Before going deep into DU4/DU6, run the capability-completeness audit (every arsenal op → a pipeline verb) so we never ship a beautiful-but-incomplete pipeline. Extends [[capability-injection-pipeline]] and the craft bar [[craft-completeness-bar]]; serves [[project_canonical_panel_ia]].
