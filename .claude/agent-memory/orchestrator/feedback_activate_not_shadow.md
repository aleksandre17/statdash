---
name: activate-not-shadow
description: Owner wants architecture ACTIVATED + done PROPERLY (real routing), not shadow-hedged or shortcut — cautious-invisible + crude = dissatisfaction
metadata:
  type: feedback
---
**Rule:** the owner wants big architectural work **switched ON and visible**, and done the **proper canonical way** — NOT built in shadow/behind default-off flags and NOT via convenient shortcuts. "Real but invisible" and "works but crude" both read as failure to him.

**Why (owner, 2026-07-11, dissatisfied with the AR-49/AR-50 overnight run):** Two concrete grievances, both fair:
1. **Fable's rearchitecture was invisible.** The object-model + config-compiled reactive graph were built in SHADOW mode / behind a default-OFF promotion flag, and the ⛔ switches (V3 render-switch, R2/R3 kpi/hero contracts) were HELD for caution — so nothing user-facing changed and the owner "saw nothing done." The whole point of building it was to ACTIVATE it. When an equivalence gate (FF-PROMOTION-LOSSLESS, FF-GRAPH-PARITY) is GREEN, FIRE the switch — shadow-forever defeats the purpose. (Ties to [[fire-authorized-oneway-doors]].)
2. **The Focus-View "separate route" was a SHORTCUT.** `FocusView.tsx` implemented "navigate out to a new page" as a SCREEN-STATE takeover (conditional render swap), NOT real routing — its own comment admits it punted on react-router "for no gain at this step" (no URL, no browser-back, no deep-link). The owner: "couldn't you have made the ROUTING [properly] instead of it being so crude?" Notion/Sanity (the cited models) use REAL routes. The shortcut was the wrong call.

**How to apply:** for architectural work — (a) build it, prove equivalence, then ACTIVATE it (fire the gated switch, flip the flag on) so it's live + visible; don't leave the platform's real improvements in shadow. (b) Do the canonical form (real routing = react-router URLs/back/deep-link, not a state-machine swap), even if it's "a larger change" — the owner explicitly prefers the larger-but-correct over the smaller-but-crude. Reconciles the earlier [[canon-dod-incidents]] caution (don't ship false-green) with: caution ≠ leaving it invisible. Verify green, then SHIP it visible + proper.
