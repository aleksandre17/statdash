---
name: commit-full-set-not-scoped
description: After an agent, `git status` the FULL changed set and verify it matches the agent's reported file list before committing — a dir-scoped `git add` can miss files and deploy a broken import.
metadata:
  type: feedback
---
When committing an agent's work, do NOT rely on a dir-scoped `git add <dirs>` — it silently misses files the agent created OUTSIDE those exact dirs. **`git status --short` the full changed set, cross-check it against the agent's reported file list, then add** (still guarding junk like scriness/docx/agent-memory).

**Why:** hit TWICE. (1) `crossFilterLinkage.fitness` lived in `apps/api/src/provisioning` — a `packages/`-scoped add missed it (a grep saved it). (2) 2026-07-13 — a slice's `tokenCatalogOptions.ts` was in `apps/panel/src/discovery/` and `PropSchemaForm.tsx` in `packages/react/src/components/`; my `git add` scoped `inspector/`+`engine/` and missed both → the DEPLOYED checkout lacked them → Vite `Failed to resolve import` → **blank panel / 500 on :3013**. tsc+vitest were green LOCALLY (files present) — the gap only shows on a clean checkout/deploy.

**How to apply:** (1) after an agent, `git status --short <touched top-dirs>` and reconcile with the "Files" section of its report — every reported new/modified file must be staged. (2) The live render-verify is the backstop: a package/panel deploy MUST be render-verified (not just HTTP 200) — `work/verify-reform-3013.mjs` caught this exact 500 (blank body + consoleErrors 500). "Fixed" = live-verified. See [[panel-live-boot-verification]], [[self-execute-when-known]].
