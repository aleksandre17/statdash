---
id: "0109"
title: "Canvas editor: intermittent freeze + active/selection area lands on the wrong region (owner report 2026-07-22)"
status: ready
class: G
priority: P0
owner: lead → chief-engineer (repro dossier) → debugger (root cause) → fix
links:
  - work/items/0104-data-workspace-unification-and-capability-restoration.md
---
**Goal** — Owner (verbatim): «ეს ცანვას რედაქტორიც არ მუშაობს, ზოგჯერ იჭედება, ზოგჯერ არასწორად ედება აქტიურის არეალი». Two symptoms on the studio canvas: (1) intermittent freeze/jam; (2) the active/selected element's highlight region lands on the WRONG area. Reproduce live → characterize (which gestures, which elements, deterministic vs racy) → debugger root-cause BEFORE any fix (journey rule).

**DoD** — repro dossier with gestures+screenshots → named root cause (file:line) → root fix → regression guard (fitness or e2e) → live re-walk clean → owner sees it work.

**Notes** — Owner-found = process failure logged (the canvas had no recent proactive walk). Suspect classes to check (not conclusions): selection-overlay geometry vs scroll/zoom transforms (active-area offset class); long-task/render-storm or event-loop starvation on the freeze (the FetchScheduler/0092 lineage is at the data seam, canvas freeze may be render-side). DU2 killed one freeze cause (courier) — this is a DIFFERENT, still-live one.
