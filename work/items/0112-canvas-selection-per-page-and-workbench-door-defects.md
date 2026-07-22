---
id: "0112"
title: "Owner triple-report (2026-07-22 evening): canvas clicks only on GDP page(?) · pipeline-node workbench opens EMPTY · exiting the workbench makes the visual VANISH"
status: ready
class: G
priority: P0
owner: lead → chief-engineer (repro) → root-cause → fix
links:
  - work/items/0109-canvas-editor-freeze-and-active-area-misplacement.md   # closed today — different root; re-check per page anyway
  - work/items/0104-data-workspace-unification-and-capability-restoration.md
---
**Goal** — Owner (verbatim): «მგონი მარტო ჯდპ-ის გვერდზე მუშაობს კანვასი. დანარჩენებზე რომ გადავდივარ არც ეკლიკებათ. და ისეთ ნოდებზე რომელსაც პაიპლაინი აქვს, რომ შედიხარ იქ მონაცემი არ გხვდება წორკბენჩი. რომ გამოხვალ კიდევ ქრება ვიზუალი». Three symptoms:
- **S1** canvas selection allegedly works ONLY on the GDP page; other pages don't take clicks at all. (Today's 0109 re-verify passed 5/5 on REGIONAL — so either stale bundle on the owner's browser, a per-page difference, or a navigation-order effect. Reproduce across ALL pages, fresh + after switching.)
- **S2** a node WITH a pipeline spec → enter its data (inspector door → workbench) → the workbench shows NO data. (Suspect the inspector-door path — `DataFacetField` keeps the lazy workbench + seeds differently than the Specs floor; also the E0 draft-store rehydration.)
- **S3** exiting the workbench back to the canvas → the node's VISUAL disappears. (Suspect today's E0 api-actions reshape / draft-optimistic state clearing the in-session spec — a possible SAME-DAY regression; treat as top suspect and check pre-E0 behavior in git if needed.)

**DoD** — per-symptom repro verdict (incl. exact page/node/gesture) → root cause (file:line; explicitly answer "did today's E0/E1/0109 commits cause S2/S3?") → root fix → guard → live re-walk → owner confirms.
