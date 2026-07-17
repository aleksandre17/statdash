---
id: "0075"
title: "W5 — PUBLISH CLOSES THE LOOP: pages as gestures (create/rename/nav/publish) + the public-render walk (J6)"
status: BLOCKED on 0074
class: M
priority: P0
owner: — (senior/apex build agent, Opus)
implements: STUDY-authoring-canon-circle-break §W5 — the owner's "pages don't work" residue, closed as a journey
depends_on: ["0074"]
links:
  - docs/architecture/proposals/STUDY-authoring-canon-circle-break.md
---
**Intent.** The last stretch of the spine: an author creates a page, names it bilingually, wires it into nav, composes (W1–W4 powers), publishes — and the PUBLIC runner renders it. Today the pieces exist (page workflow FSM, versions, publish routes, bottom page-strip, PagesSiteSurface) but the loop has never been walked as one gesture chain, and the strip vs Pages-surface duality needs reconciling to one model.

**The outcome that counts.** J6 end-to-end on the real stack: Studio (:3013) → api → published page rendered on the public runner line — with draft/publish states honest in the Studio (PUBLISH button truthfully enabled/disabled, version history reachable), page create/rename/delete/nav-wire each a working gesture, ONE page-selection model (strip and surface project the same store).

**Known facts.** `features/page-workflow/` (PageWorkflowBar, VersionHistoryDialog, status badge) exist; `constructor.lifecycle`/`pageWorkflow` tests green in jsdom; the dev line has the full api+db; the runner line renders provisioned sites. The gap is the LIVE walk + whatever it flushes out (expect boot-wiring class defects — jsdom has masked this class before).

**Hard boundaries.** No new persistence surface; the append-only page_version FSM + atomic publish stay the SSOT. Whatever J6 flushes out gets root-cause fixes, not walk-arounds.

**DoD.** `FF-JOURNEY-J6` (live Playwright: create→compose→publish→public render asserts the page's own content) green · deployed · owner walks it himself.
