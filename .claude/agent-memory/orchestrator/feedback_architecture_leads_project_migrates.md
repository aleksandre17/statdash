---
name: architecture-leads-project-migrates
description: Build the BEST architecture and adapt the project to IT (Law 7) — never bend the architecture to fit legacy; restructure is authorized; the bar is framework/platform-grade quality.
metadata:
  type: feedback
---
Owner directive (2026-07-13): "ხომ არ გეუბნები მოარგე ამ პროექტს — გეუბნები რასაც დანერგავ, მოარგე პროექტი მას; თუ გინდა საერთოდ გადააწყვე, ოღონდ მოიყვანე პლატფორმის/ფრეიმვორკის დონეზე." = do NOT constrain the architecture to the project's current shape; build the best architecture and MIGRATE the project onto it. Full restructure authorized. The only requirement: reference/framework-grade quality.

**Why:** the lead had been over-conservative — additive/byte-identical/Strangler-expand to avoid touching legacy, which preserved compromised shapes (privileged `section`, a raw-field inspector, non-isolated data). The owner reinforces CLAUDE.md Law 7: architecture leads, code follows.

**How to apply:** the DESTINATION is uncompromised framework-grade — do not keep a legacy shape that erodes the canonical form (de-privilege `section` fully, restructure the inspector to the canonical model, isolate the data layer, unify placement — even if it means real changes, not just projections). Strangler-Fig stays the SAFE *method* (each slice green + REAL-gesture-proven, don't recklessly break the working/deployed platform or the owner's data), but never let "keep it byte-identical" cap the architecture. When a piece needs a real restructure, do it. Pairs with [[full-ownership-reference-grade]], [[global-loose-coupling]], [[verify-gesture-not-load]].
