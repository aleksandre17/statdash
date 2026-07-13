---
name: verify-gesture-not-load
description: A feature is "done" only when the actual USER GESTURE is proven (select → section appears → edit changes state), NOT when the app merely loads. Render-verify (app renders, 0 errors) ≠ the feature is reachable/usable.
metadata:
  type: feedback
---
Do NOT claim a feature "live/verified" on the strength of a render-verify (the app loads, 0 console errors). That proves the bundle mounts — NOT that the user can REACH and USE the feature. Prove the actual gesture: select the element → the section/control appears → editing it changes the stored state → the canvas reflects it.

**Why:** 2026-07-13 — I shipped FIVE facet slices (style/data/events/chrome/visibility) and called each "live + verified" after `verify-reform-3013.mjs` (app renders, 0 errors). The owner then couldn't find/use CHROME at all: it doesn't render in the authoring canvas (nothing to click) and its only entry is an unlabeled icon (a probe found ZERO "site/chrome" labels). Every agent had explicitly flagged "browser gesture not run in a live browser" and I relayed "live" anyway. Reachability/discoverability is a REAL gap render-verify is blind to.

**How to apply:** (1) when an agent flags "gesture not run," that facet is NOT verified — either require the agent to provide an executable Playwright leg (click→section→edit), or drive it myself (`chromium` login → navigate → click the element → assert the dock section/control exists → edit → assert state change + a screenshot). (2) A probe for the feature's own LABELS is cheap and high-signal (no "chrome/site" text anywhere = unreachable). (3) "Discoverable" is part of done — an unlabeled icon / a select-then-Back-only path is not canonical. (4) After chrome, re-verify the other 4 facets' gestures too — the same blind spot applies. Sharpens [[panel-live-boot-verification]]; pairs with [[commit-full-set-not-scoped]].
