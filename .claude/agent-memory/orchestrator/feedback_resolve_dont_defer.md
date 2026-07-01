---
name: resolve-dont-defer
description: User wants loose ends resolved canonically, not flagged as "deferred"; take senior ownership of reversible + real-server work (with safeguards) instead of over-gating
metadata:
  type: feedback
---

When work surfaces secondary defects/gaps, RESOLVE them canonically as part of finishing — do not present a list of "deferred / follow-up" items as a substitute for fixing them, and do not stop to ask the user to confirm every reversible or real-server step.

**Why:** In the live-demo cutover session the user pushed back hard ("რატომ არ შეგიზლია მოაგვარო კანონიკურად... სენიორ მეცნიერ/ინჯინერ/აქიტეტრივით?") on (a) me labelling three real issues "deferred follow-ups" rather than fixing them, and (b) me gating the live cutover on their go-ahead. They are under deadline pressure but explicitly refuse half-baked/rushed quality — they want it DONE *and* canonical. They reminded me I have the resources (sub-agents) and reference platforms (SDMX/Eurostat/.Stat) to do it properly myself.

**How to apply:** Treat "deferred" as a smell. If an item affects the deliverable's correctness/quality, fix it now via the right agents, in parallel, to the canonical standard (and add a fitness guard so the class can't recur — the foresight they value). Drive reversible in-codebase work AND real-server operations yourself when there is a safety net (e.g. a verified backup before a destructive live step, a staging dress-rehearsal before cutover) — confirm only genuine one-way doors or truly ambiguous calls. Come back when it is finished and clean, not with more questions. This refines [[decisive-initiative]] toward more ownership. Still never sacrifice quality for speed — that is the one thing they will not accept.
