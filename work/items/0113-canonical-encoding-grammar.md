---
id: "0113"
title: "Canonical encoding grammar — replace the toy EncodingSpec with the GoG/Vega-Lite channel grammar (owner observation 2026-07-22)"
status: ready
class: M
priority: P1
owner: lead → architect@fable (study) → owner-visible design review → Strangler build (feeds E2's encoding.edit)
links:
  - docs/architecture/proposals/DESIGN-0104-elevation-reference-class.md   # C1 encoding.edit capability builds ON this
  - docs/architecture/ARCHITECTURE-REGISTRY.md                             # AR-36 encoding-swap vision stands on the same grammar
---
**Goal** — Owner (verbatim): «ის encoding ნაწილი, მგონი საერთოდ არ ასახავს იმას, რაც მას კანონიკურად ეკუთვნის… საერთაშორისო სტანდარტების პაიპლაინ-პლატფორმების encoding გვჭირდება და არა რაღაც შევიწროებული, გაპრიმიტიულებული სათამაშო სტრუქტურა». Law 4 backs it: GoG/Vega-Lite adopted WHOLE. Today's `EncodingSpec` ≈ {x,y,color,label} — no channel typing (Q/O/N/T), no scale/axis/legend declarations, no size/shape/opacity/tooltip/order/detail, no faceting, no per-channel aggregate/bin/sort. Study the gap → design the canonical channel grammar for THIS platform (engine-side, serializable, Constructor-introspectable) → Strangler migration (current 4 fields = a degenerate subset that keeps parsing; additive expansion, byte-identical rendering for existing configs).

**DoD** — study maps current EncodingSpec + charts-adapter reality vs the Vega-Lite channel canon · designed grammar with ≥2 rejected alternatives + migration plan + fitness (existing corpus renders byte-identical through the new grammar's degenerate form) · owner design review · lands BEFORE E2's `encoding.edit` step editor is built (the editor must edit the real grammar, not the toy).

**Notes** — Class M (engine grammar/contract). AR-36 (declarative encoding-swap / OLAP rotate gesture) becomes buildable on this. Charts layer (packages/charts Apex adapter) is the render-side consumer — the grammar must be adapter-agnostic (Law: charts reads tokens/declarations, never the reverse). YAGNI balance: adopt the CHANNEL grammar whole; adopt scale/axis depth to what our chart kinds actually render today + declared extension points (M-5), not the entire Vega-Lite spec surface.
