---
name: project-canonical-parser
description: ADR-0031 Wave 1 canonical-workbook parser core — apps/api/src/ingest/canonical/* (PURE deserializer of DATA/canonical/*.xlsx → existing bronze contract)
metadata:
  type: project
---

ADR-0031 (architect: adr_ingestion_build_ready.md) builds a generic, self-describing canonical-workbook parser as the PRIMARY steady-state ingest. The legacy per-template TemplateMapping (ADR-0030) is demoted to SECONDARY (legacy→canonical offline converter, lives at REPO-ROOT `work/legacy-to-canonical/*`, reaches xlsx via store).

**Why:** the canonical workbook (STRUCTURE + CL_<DIM> + DATA tidy sheets) is SDMX-lite interchange — a new dataset = a new workbook, ZERO code (OCP headline). Constructor moat: workbook is data a non-programmer authors.

**How to apply (engine-specialist owns the parser core, Wave 1):**
- Files: `apps/api/src/ingest/canonical/{read-workbook,types,parse,ops,registry}.ts` + `__tests__/{parse.fitness,registry}.test.ts`.
- xlsx@0.18.5 is a DIRECT pin in apps/api/package.json (NOT catalog — api-only, ACL-confined). F-3 eslint rule in platform/eslint.config.js bans `xlsx` everywhere in apps/api EXCEPT read-workbook.ts (proven: probe import errors).
- DSD SSOT = STRUCTURE.dimensions row (Law 1, ORDERED, never hardcode time/geo). `name_<lang>` cols ∩ ctx.activeLocales (F-LANG, no hardcoded ka/en). Attribute cols (seq_pos, contribution_role) → obsAttribute generically.
- Emits the EXISTING bronze contract from `apps/api/src/ingest/types.ts` (RawObsRow/RawClassifierRow/RawDisplayRow) — do NOT redefine. dimKey keys == DSD non-time dims so validateObs set-equality passes by construction.
- read-workbook uses `{ defval:null, raw:true, header:1, blankrows:false }` — numbers stay numbers (obsValue, seq_pos), empty = null.
- Verified obs counts: ACCOUNTS_SEQUENCE 415, GDP_ANNUAL 288, REGIONAL_GVA 1554. classifierCount 27/21/etc.
- `reference`/`dsdRef` codelist resolution = NOT_IMPLEMENTED SEAM-DEFER stubs (registry.ts) — type union carries the case, resolver built on trigger.
- Fitness tests are PURE (no DB), run unconditionally. Fixtures located by walking UP from test dir until `DATA/canonical` found (NOT brittle ../../../ — repo root is ABOVE platform/).

**Other agents own (do NOT touch):** validate.ts/submit.ts RuleSpec, types.ts IssueCode extension, rules/, serialize/, routes/ingest/canonical.ts route. Wave dependency: 0 → 1(this) → 2 → 3 → 5.
