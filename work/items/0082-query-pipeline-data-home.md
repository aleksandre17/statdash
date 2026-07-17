---
id: "0082"
title: "QUERY AS A VISIBLE PIPELINE + THE RAW-DATA HOME — simple at full power, once and for all"
status: GO (owner-blessed 2026-07-17 verbatim «ნდობას გიცხადებ, გააკეთე»; ADR-046 ACCEPTED; SPEC final incl. lead's §9 elevation; waves W-P0…W-P6 fire serially per WIP=1 — first build wave starts when the integrity cluster (data-truth) lands)
class: M
priority: P0
owner: lead → platform-architect (design) → build agents (waves)
implements: owner 2026-07-17 (verbatim, condensed): «query და pipeline მაქსიმალურად მარტივად და სრული ძალით, დატა-ელემენტებზე · ნედლი დატა ერთხელ და სამუდამოდ გამიჯნე, თავის კანონიკურ ადგილას · დღევანდელი query-აწყობა გაუგებარია (ტეგები, ერთად გამოტანილი) · აწყობისას ნედლი დატა ჩანდეს · და ჩანდეს რა query გამოდის» — Canon C1 continuation
depends_on: ["0072"]
links:
  - docs/architecture/proposals/CAPABILITY-INJECTION-BACKLOG.md   # rec #1 (DQ-on-ingest) folds INTO this data-home concept
  - platform/apps/panel/src/features/data-layer/                  # today's query editors (the confusion to be replaced)
---
**Intent.** The author must build a query as a VISIBLE, STEPPED PIPELINE — seeing the raw data flow through every step and the resulting declarative query alongside — while raw data itself gets ONE canonical home, separated from the semantic model and specs forever. Full power, simple perception, whole standards.

**Reference anchors (Law 4 — adopt whole):** Power Query's step-pipeline with a live grid per step · Grafana's builder↔code duality (the generated query always visible) · Vega-Lite / Tidy-Data transform grammar (declarative verbs: filter/aggregate/derive/pivot) · SDMX (our ObsQuery stays the wire truth) · the W2 governed-noun spine (metrics/dims as vocabulary, never raw codes in the author plane).

**Design deliverables (this card's DoD):** a decided SPEC (not a menu): the pipeline grammar (declarative steps over the ONE evaluator/lowering path) · the data-home IA (raw → governed model → specs → elements as the visible floor plan; DQ expectations declared at the raw floor — backlog rec #1 folds here) · the authoring surface concept (step rail + live grid + generated-query pane; where it lives in the studio IA) · Strangler route from today's tag-based editors · wave decomposition sized for WIP=1 · what is refused and why. Owner sees the concept BEFORE build waves fire.

**Hard boundaries.** Laws 1–3, 10–11 verbatim · one evaluator (@statdash/expr), one lowering path (resolveMeasureRef), ObsQuery stays the only wire query · author plane speaks governed nouns only (FF-AUTHOR-NO-QUERY class holds; the pipeline is the author's power WITHOUT raw-code exposure) · no object-model change · additive/Strangler, the old editors demote only when the new path is journey-proven.
