---
id: "0010"
title: "DECISION O-2: transform/pivot warm = nested query reqs"
status: backlog
class: DECISION
priority: P0
owner: —
implements: SPEC §5 O-2, §1 C2
blocks: ["0017", "0029"]
links:
  - platform/work/SPEC-render-pipeline-target.md
---
**Decision needed** — For `transform`/`pivot` DataSpec types that today return `[]` from `extractRequirements` (`spec.ts:228-230`): confirm their warm requirements are exactly the requirements of the **nested `query`/base read** the pipe consumes.

**Reasoned DEFAULT (build this unless told otherwise)** — **Yes.** A pipe transforms already-fetched rows; the fetch is the `query` under it. Warm = the nested query's reqs.

**Escalation clause** — If ANY pipe op issues its own secondary store read (e.g. a lookup that hits the store rather than a codelist), the owner must name it — that op needs its own requirement contribution, or C2-c will (correctly) flag it as a provably-not-read-free violation.

**Reversibility** — Two-way door (extractor logic; adding a secondary-read contribution later is additive).

**Blocks** — 0017 (C2 warm-contract guard), 0029 (E8 SNA pivot — its spec may lower to `pivot`/`transform`).

**Owner action (~2 min)** — Confirm nested-query = warm set, OR name any pipe op that hits the store directly.

**Standing DoD (applies to the dependent build items):** rendered result must match `scriness/` achieved ONLY through highest-concept architecture — no hardcoding, no anti-patterns, no DRY violations; declarative/config-driven; conditional logics covered; SSOT; refine/elevate EXISTING code (Strangler) — never rewrite-from-scratch or hardcode-to-match the screenshot. "Look like the screens" must NEVER be met by dropping quality.
