---
name: feedback-maximal-orthogonality
description: "Maximal decoupling" means orthogonality (independent axes, authored once), NOT axis-count or unused generality; defer a capability until a real consumer exists
metadata:
  type: feedback
---

When the owner asks for "maximal" / "more" decoupling, the proven answer is ORTHOGONALITY — each concern an independent axis whose values vary freely, the artifact authored once, views derived by the product — NOT duplication and NOT shipping unused axes.

**Why:** the reference systems (SDMX FREQ⊥TIME_PERIOD, Tableau discrete/continuous, Vega-Lite timeUnit, Cube granularity) are "maximal" precisely by REFUSING to multiply views; a flat fused enum or an unused speculative axis grows multiplicatively and invites copy-paste drift (shotgun surgery / speculative generality §11). The owner's "maximal" is about correctness of decoupling, not the number of knobs wired today.

**How to apply:** (1) Build an axis only when it has a REAL consumer in the actual data/requirements — check the seed/DSD/roadmap before building; no empty cathedrals. (2) An axis WITH live consumers (e.g. selection-type: point+window both ship today) gets built now; an axis with NONE (e.g. grain: all data annual) is deferred behind a named door on an already-open seam. (3) Removing a wart that costs nothing (closed union → open string) is still worth doing even when inert. (4) Always red-team for surviving fused literals (`=== 'year'`, two-arm `{year,range}` unions) — they hide in template/badge primitives. See [[project-time-mode-decision]].
