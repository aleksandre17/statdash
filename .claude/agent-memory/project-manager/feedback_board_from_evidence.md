---
name: board-from-evidence
description: Author board/roadmap items from code + existing audit docs, never invented
metadata:
  type: feedback
---

When asked to compile a project board for statdash-platform, derive every item from real evidence: read the code and the existing audit docs (docs/plan/*) rather than inventing plausible-sounding tasks.

**Why:** the user explicitly asked to "read the code to find real gaps, don't invent items" and the project already has rigorous evidence-grounded audits (file:line citations). Inventing items would duplicate or contradict the team's own SSOT.

**How to apply:** for each board item, point at a file/endpoint/test that proves the gap. Cross-check the IMPLEMENTATION-ROADMAP "Shipped" logs against actual code — docs can claim completion that code confirms or contradicts (e.g. ApiStore shows as part of N34 design but is actually unwired). Run tsc + vitest to ground correctness items.
