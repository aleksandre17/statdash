---
name: contextual-relevance-canon
description: Panel-wide UI canon — show ONLY the active element's everything; drill-in progressive disclosure, never all-expanded lists
metadata:
  type: feedback
---
The panel holds a hard UI canon: **"only what's needed / only the ACTIVE one's everything shows."** A collection of rich items is NEVER rendered with every item's full editor expanded at once. Instead: a LIST of collapsed summary rows → click one → a focused per-item editor + a breadcrumb back; the others stay hidden. Recursion drills "maximally all the way in" (nested array/object sub-fields are drill rows, one unified breadcrumb per root, arbitrary depth), and only the deepest active level is ever rendered.

**Why:** The owner enforces this contextual-relevance / progressive-disclosure principle EVERYWHERE (the left/right docks, the canvas selection, and — as of D7.1b — the nested-item editor). It is the same principle Sanity Studio, Framer array controls, and Figma "enter instance" use. An all-expanded editor that dumps every field of every item on screen is a concept regression the owner catches on sight.

**How to apply:** Any time you build or review a UI that edits a collection of non-trivial items (array-of-objects, repeatable groups, multi-panel selections), default to drill-in disclosure, not simultaneous expansion. Drill state is component-local UI state (like the canvas selection), never config. Keep add/remove/reorder on the list level; move focus into the drilled level; give the breadcrumb keyboard-reachable crumb buttons that navigate up (WCAG 2.1 AA). See [[css-architecture-colocation-bem]] for the accompanying class-naming rule.
