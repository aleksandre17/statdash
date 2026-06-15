---
id: "0005"
title: "6.2: Extract inline SVG icons + hardcoded aria-labels from plugin shells"
status: done
class: G
priority: P2
owner: —
links:
  - docs/plan/roadmap-phase-5-6.md
---
**Goal** — Plugin shells contain no inline SVG markup and no hardcoded locale strings.
Icons → shared icon module; UI strings → useT('section').

**Scope**
- plugins/nodes/section/default/SectionShell.tsx:120-133 — inline info-icon and
  chevron SVGs → engine/react/src/components/icons.tsx (shared module, already exists).
- Hardcoded Georgian aria-labels ('ხედის გადართვა', 'ინფორმაცია') → useT('section').
- Audit other shells for same pattern.

**DoD**
- [ ] No inline SVG icon definitions in section shell.
- [ ] No hardcoded locale string in shell aria-labels; all via useT.
- [ ] `npx tsc --noEmit` = 0 errors.

**Notes** — Closes gap #31 (i18n/icons half). S effort (1-2h).
