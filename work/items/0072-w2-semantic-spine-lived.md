---
id: "0072"
title: "W2 — THE SEMANTIC SPINE, LIVED: data-first front door · dictionary→canvas bind · migrate the corpus onto governed handles"
status: BLOCKED on 0071
class: M
priority: P0
owner: — (senior/apex build agent, Opus)
implements: STUDY-authoring-canon-circle-break §F3/§W2 (Canon C1) — the owner's "everything starts from raw data; it's stuffed in somewhere", verbatim
depends_on: ["0071"]
links:
  - docs/architecture/proposals/STUDY-authoring-canon-circle-break.md
  - work/authoring-truth/07-model.png   # the read-only cul-de-sac; hasUpload:false on default lens
---
**Intent.** The platform's spine — raw data → governed semantic model → bound elements — must be the LIVED journey, not just the architecture. Today (live-probed): onboarding is buried behind Model→lens-flip; the Data Dictionary lists 17 metrics ("11 never used") but cannot bind anything to the canvas; DataFlowMap is exiled full-screen; live page elements carry raw coordinate configs with EMPTY metric selects — D5 (ADR-042) stalled at "mechanism shipped, adoption pending".

**The outcome that counts.** (1) Onboarding raw data is ONE intentful step from the shell (front door, no lens burial — the lens still governs WHO can publish, not WHERE the door is). (2) A metric drags from the Dictionary/palette onto a canvas element and binds (dnd-kit — align with W4's one-transport direction). (3) The EXISTING page corpus migrates onto metric handles (the stalled Strangler second half): every bindable element on live pages gets its governed ref; raw coordinate/DataSpec editors demote to steward plane. (4) `FF-DATA-BOUNDED` + `FF-AUTHOR-NO-QUERY` BITE on the corpus, not just on intentions. (5) DataFlowMap embeds as the Data home's orientation.

**Known facts.** MetricPalette + `bindMetric` seam exist (`useCanvasController`, `discovery/`); `metricDrag.ts` already speaks dnd-kit; `resolveMeasureRef` is the ONE lowering path (FF-BIND-PARITY proves byte-identity); provisioning holds the corpus configs; AR-51 CanonicalUpload is real and works — it is buried, not broken.

**Hard boundaries.** Governance lens PRESERVED (D-DA1: author binds, steward defines) — one-step journey, zero-step governance is refused. Dependency arrow unchanged. Corpus migration is expand-contract: config byte-compat until the flip, each page render-verified (chart==table parity where same-section).

**DoD.** Journeys **J1 (upload→published cube), J2 (define metric), J4 (bind via governed noun)** each walked LIVE on :3013 against the real api/db · corpus scan: 0 author-plane raw-source configs · deployed · owner shown.
