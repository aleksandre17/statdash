---
id: "0001"
title: "D-1: Remove Georgian literals from CascadeSelect (engine/react)"
status: done
class: G
priority: P2
owner: —
links:
  - docs/audit/2026-06-15-law-violations.md
---
**Goal** — `engine/react/src/components/filters/CascadeSelect.tsx` carries hardcoded Georgian strings
`დონე ${n}` (aria-label) and `ყველა` ("All") as in-component fallbacks (L40, L42).
This violates Law 4 (react-agnostic): the agnostic layer silently inherits Geostat's locale.

Root cause: the component was authored with a convenience fallback in the Geostat product
locale (`ka`) instead of staying locale-neutral. Any non-`ka` consumer renders Georgian labels
by default — closed against new locales (OCP break).

**DoD**
- [ ] `placeholders`/`allLabel` are injected props (required or resolved via `useT`); no Georgian string remains in the component body.
- [ ] The one caller (geostat app or plugins/) supplies the Georgian values explicitly.
- [ ] `npx tsc --noEmit` = 0 errors.
- [ ] CI fitness function gate: `engine/react/src/**` must contain zero `[Ⴀ-ჿ]` codepoints (add to `law_patterns` in `project.json`).

**Notes**
Fix: either (a) make `placeholders`/`allLabel` required props (fail-fast — make illegal states unrepresentable),
or (b) route through existing `useT` i18n token in SiteContext. Option (a) is simpler and lets the
typing enforce the invariant. Georgian text moves to plugins/ or the app i18n catalog. Two-way door.
Related: D-2 is the same erosion shape — both should land in one PR.
