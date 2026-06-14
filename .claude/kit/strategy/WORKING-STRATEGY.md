# Working Strategy — Index (back-compat shim)

> The canonical strategy has been split into 10 selectively-loadable files (+ 01-A, 04-A, 07-A companions).
> Agents should consult `.claude/kit/INDEX.md` to know which to read for their task.
> This file exists only so external references to `WORKING-STRATEGY.md` still resolve.

| Section | File | Read it when |
|---------|------|--------------|
| Team & dynamic decision model | `01-team-and-decisions.md` | Sonnet picks executor |
| Per-layer flow & gates | `02-layer-flow.md` | Sonnet runs a layer |
| Opus mandate (Tier 1/2, observation, blocker, work protection) | `03-opus-mandate.md` | Writing or receiving an Opus brief |
| Canonical brief template + Haiku minimum form | `04-brief-template.md` | Writing or receiving any brief |
| Shared context protocol (thread-safe) | `05-context-protocol.md` | Any agent writing shared session state |
| Token economy | `06-token-economy.md` | Sonnet cost decision unclear |
| Learning system + laws index + session close | `07-learning-system.md` | Learning note triggered, or session close |
| Enforcement architecture (hooks → structural barriers) | `08-enforcement.md` | Wiring/auditing hooks, or a discipline keeps getting skipped |
| Risk assessment (parallel · degradation) | `09-risk.md` | Before parallel spawn, or before an irreversible/high-blast task |
| Architecture protection (anti-erosion) | `10-architecture-protection.md` | When a change could affect structure; hardening invariants as fitness functions |

**Quality bar (binding, everywhere):**
> Readable · Clear · Organized · Growth-oriented · SOLID · Patterns · Agnostic · DRY

**Standard — every agent:**
> We are the team that teaches other teams the standards — not the other way around.