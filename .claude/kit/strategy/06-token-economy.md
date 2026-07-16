# 06 — Token Economy

> Loaded by Sonnet when a cost / agent-choice decision is unclear. ~40 lines.
> Sibling files: `01-team-and-decisions.md` (the executor matrix), `03-opus-mandate.md` (brief efficiency).

---

## Priority chain (binding)

**Quality → Learning → Tokens.** Token savings are never justified if they reduce Senior standard output quality or shortcut a learning moment.

### Why these never actually conflict — rework is the real token sink

The apparent quality-vs-tokens trade is an illusion measured over a single step. Over the whole project the cheapest path *is* the highest-quality-first-pass path, because the alternative — ship it slightly wrong, discover it later, re-load the same context, redo the dependent work — pays for the same ground **twice or more**.

**Universal rule (every agent — Sonnet, Opus, Haiku): fix-on-sight.** When you are already on a path and see a problem, the marginal cost to fix it now is the diff; the cost to leave it is a second dedicated traversal later plus possible rework of whatever was built on top. "I saw it — fix it now, because later is expensive" is a *token* decision as much as a quality one. The mediator routes, and every agent works, to minimise total project tokens — which means minimising rework, not minimising the current step. (Discovered-problem handling + dependency ordering: `03` Observation Duty.)

---

## Optimization levers (ranked)

| Lever | Impact | Why |
|-------|--------|-----|
| **Opus Living Brief** (`opus-brief.md`) | Highest | Eliminates per-session context re-provision |
| **`context.md` blackboard** | High | Eliminates agent re-work across runs |
| **`token-log.md` summary** | High | Sonnet reads ledger tail instead of full transcripts |
| **Gate 1** (brief quality) | High | Wrong direction = most expensive mistake |
| **Selective loading (`INDEX.md` map)** | High | No agent reads strategy files it doesn't need |
| **SendMessage for follow-ups** | Medium | Reuses agent context; new Agent = re-read everything |
| **Sonnet alone** | Medium | Medium task = no Opus needed |
| **Haiku** | Medium | Templated task = minimum context, minimum output |
| **Lean reads** | Low | Only files this task needs |
| **Scripts** (`ops/scripts/`) | Low | Repetitive ops → script, run via Haiku or directly |

---

## Haiku criterion

> "Could a junior dev write every line in 10 minutes with zero surprises?" → Haiku.
> One moment of "hmm..." → Sonnet or Opus.

**Setup cost check:** If Haiku setup cost ≥ Sonnet doing it directly → skip Haiku, use Sonnet.

---

## Selective-load discipline

Before spawning any agent, Sonnet asks: **"What is the minimum file set this agent needs?"**

Use the loading map in `.claude/kit/INDEX.md`. Default-load only:
- `opus-brief.md` (current state)
- `context.md` (in-progress)
- Plus the strategy file(s) the brief explicitly requires

If the brief lists 4+ strategy files, the task is probably too large — split it.

---

## Measured burn anatomy (audited 2026-07-17 — owner escalation)

Ground truth from real transcripts (`token-log.md` RUN lines now carry it):
- **Spawn fixed cost ≈ 16–24k input** (harness + tools + def + MEMORY.md + CLAUDE.md + packet). Unavoidable per agent; ~0 for the lead doing it inline.
- **The burn is IN-RUN, not at spawn:** peaks 60k→213k, driven by (a) wholesale reads of heavy files (a 57KB memory map ≈ 15k tokens; a 32KB kit file ≈ 9k), (b) **turn-churn** — 125–246 API calls per run, each re-sending the whole context (cache discounts price, never context size or the lost-in-the-middle dilution).

### Binding budgets (enforced by the `⚠ CTX-BURN` ledger alarm at 120k)
- **Peak-context norm ≈ 80k** for a standard run; crossing 120k = a defect of the brief (too broad), the packet (too thin), or the agent's read discipline — audit which, then fix the SOURCE.
- **Routing threshold:** work the lead can finish in **≲15 tool calls on knowledge it already holds** stays with the lead — a spawn's fixed cost + inevitable re-grounding beats no delegation only ABOVE that line. (Judgment-density still routes UP regardless — a cheap wrong decision is the most expensive token sink of all.)
- **Turn budget:** batch independent reads/searches in ONE turn; an agent averaging >60 API calls without a proportional deliverable is churning, not thinking.