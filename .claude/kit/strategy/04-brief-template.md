# 04 — Brief Template & Pre-Brief Discipline

> The ONE place the brief format lives. Loaded by Sonnet when writing a brief; loaded by Opus/Haiku for output format.
> Sibling files: `03-opus-mandate.md` (tier rules + brief-quality self-report), `05-context-protocol.md` (shared writes).
> **Case studies + worked examples → `.claude/strategy/04-A-examples.md`** (load only on first brief of a sprint).

---

## Section A — Pre-Brief Discipline (Sonnet, BEFORE opening Section B)

Complete all lines OUT LOUD (in chat or scratch) — not in your head. Opening Section B before finishing Section A is a process violation. **A.0 comes first — before triage:** you cannot route a task you have not faithfully understood.

```
A.0 Intake Echo:      Intake:       "<user intent + outcome + EVERY explicit constraint, in your words>"
                      User's words: "<task-bearing part of the user's message, unchanged>"
                      → Mismatch caught here costs nothing; caught after an agent runs costs a layer.
                      → Ambiguity that changes routing/brief → ONE sharp question first. Never assume.
A.1 Triage:           [Sonnet alone | Haiku | Opus-f | Opus-b | Opus-review]
A.2 Problem:          "<subject> <verb> <object>."
A.3 Goal:             "After this task: <invariant about system state>."
A.4 Decision Inventory (Opus-f / Opus-b only):
                      D1: <question Opus must answer — genuine architectural/design/DRY>
                      D2: <…>
                      → Empty or mechanics-only → re-triage.
A.5 Confidence-check (Opus-b only):
                      "Am I sending this because Opus's judgment is needed,
                       or because I want a safety net for my own execution?"
                      → Safety net → use Opus-review (B.3) on the finished diff.
```

> A.0 is the mediator's faithful-intake barrier (`01-A-mediator.md` §A). The `User's words` line is carried verbatim into every brief by default (`feedback_verbatim_relay.md`).

### A.1 — Triage rules

| Signal | Executor |
|--------|----------|
| Decisions already in `opus-brief.md` or context; only wiring remains | **Sonnet** (any size) |
| "I can list every architectural call in my head right now" | **Sonnet** or Haiku — NOT Opus |
| Routine, spec clear, templated, zero surprises | **Haiku** |
| Unmade design decisions, smells suspected, DRY mining, first exploration | **Opus `--f`** or **Opus `--b`** |
| Sonnet built it, want judgment scan without re-implementation | **Opus-review** (B.3) |
| Mixed: some decisions made, want smell-check | **Sonnet build → Opus-review** |

### A.2 — Problem-statement verb test

**Allowed verbs:** `is` · `has` · `lacks` · `violates` · `duplicates` · `depends-on`

**Banned verbs (you wrote a solution, not a problem):**
`remove` · `delete` · `extract` · `rename` · `move` · `add` · `replace` · `change` · `update` · `fix` · `refactor` · `migrate`

If your sentence contains a banned verb → rewrite. Examples → `.claude/strategy/04-A-examples.md §A.2`.

### A.3 — Goal-statement form test

Must start with **"After this task:"** followed by a **system-state invariant**.

Forbidden in goal: class names · method names · line numbers · threshold values · library names. Those are implementation — not outcome. Examples → `.claude/strategy/04-A-examples.md §A.3`.

### A.4 — Decision Inventory (replaces old self-test — catches substance, not just form)

Required for Opus-f and Opus-b. Name every **unmade decision** Opus must answer:

```
D1: <question — e.g. "Is the inner computation loop an SRP violation that warrants extraction?">
D2: <question — e.g. "Does this config belong on the properties holder or the feature-specific config?">
```

**Counts as a decision:** SRP/DIP/OCP/DRY questions · boundary questions · platform-lib placement · "are there smells I haven't seen?" (always counts).

**Does NOT count:** which file, which line, which import, which API method. Those are execution mechanics — Sonnet handles them.

**Empty or mechanics-only → re-triage.** Sonnet build (optionally with Opus-review B.3 afterward). Worked case study → `.claude/strategy/04-A-examples.md §A.5`.

### A.5 — Confidence-check (Opus-b only)

> "Am I sending this because Opus's judgment is needed, or because I want a safety net?"
- **Judgment needed** → Opus `--b`.
- **Safety net** → Sonnet builds + Opus-review (B.3). Worked case study → `.claude/strategy/04-A-examples.md §A.5`.

---

## Section B.1 — Opus Brief Template

```
--b OR --f

Read: .claude/kit/B.md
Read: .claude/context/opus-brief.md
Read: .claude/session/context.md

Problem:     [A.2 — one sentence, allowed verbs only]
Goal:        [A.3 — "After this task: <invariant>"]
Constraints: [What must stay true. Only place to be specific about files/APIs/laws.]
Context:     [What Sonnet already found. What NOT to revisit.]

User directive (verbatim): [the task-bearing part of the user's message, unchanged.
                            DEFAULT field — present whenever the user's words carry intent/
                            constraint/correction. Ground truth; check the Problem/Goal against it.
                            Omit ONLY for a purely Sonnet-originated task with no user content.]

[If doctrine question: Read also: .claude/kit/strategy/03-opus-mandate.md]
[If first brief of sprint: Read also: .claude/strategy/04-A-examples.md]
```

> **No "Task:" or "Implementation plan:" field.** Problem + Goal + Constraints is the complete specification. Opus decides.
> **Output format** (Brief-Quality + Token Log Append) lives in `.claude/kit/B.md`. No separate Changed Files block — paths go in Token Log Append line.

---

## Section B.2 — Haiku Brief (minimum form)

Haiku does NOT load mandate or strategy files. Minimum brief:

```
Read: .claude/context/opus-brief.md (only §Current State)
Shell: dangerouslyDisableSandbox: true on ALL calls.

Task: [exact, mechanical instruction — no judgement required]
Files: [enumerate the exact files to touch]
Validation: [exact command to run]

End your output with:
## Changed Files
- apps/service/src/.../File.java:42   ← repo-relative paths only
## Tokens used: ~N,NNN
Append to .claude/session/token-log.md (or surface for Sonnet if blocked):
[HH:MM] haiku <task-id> tokens=~N files=<N> → repo-relative/path:line, ...
```

If the Haiku brief would need an exception clause or "use judgement" line → escalate to Sonnet.

---

## Section B.3 — Opus Review Brief

Use when Sonnet has built a change and wants Opus's judgment scan **without re-implementation**. A.5 answered "safety net" → this is the right mode.

```
--review

Read: .claude/kit/INDEX.md
Read: .claude/context/opus-brief.md
Read: .claude/session/context.md
Shell: dangerouslyDisableSandbox: true on ALL PowerShell and Bash calls.

Mode: REVIEW (no file edits — observations only)

Diff scope: [repo-relative paths Opus should examine]

Review focus: [1–3 specific questions, e.g.:
               - "Is the new <NewComponent> shape clean, or does the
                  cross-cutting pass live in the wrong layer?"
               - "Does anything here duplicate logic in <ExistingComponent>?"
               - "Is there a one-body violation — should anything be in platform-*?"]

Out-of-scope: [optional — areas already verified, do not re-check]

End your output with:

## Review findings
### Tier 1 — recommended fixes (Sonnet applies)
- <repo-relative path>:<line> — <smell/DRY/anti-pattern + one-line reason>

### Tier 2 — flagged for User/Sonnet decision
- [RADICAL CHANGE block if applicable]

### Clean (no findings in scope)
- <areas reviewed and judged clean>

## Brief quality (Opus assessment)
Opus appends this epilogue — canonical format in `B.md` §Brief quality (not restated here).

## Tokens used: ~N,NNN

## Token Log Append (surface for Sonnet if write blocked)
[HH:MM] opus-review <task-id> tokens=~N,NNN files=0-reviewed-N → repo-relative/path, ...
```

**Why review mode is separate from `--b`:** different cost profile (no implementation tokens), different output (observations only), different brief shape (the diff IS the context — no Problem/Goal reframing needed), different mental model (judge, don't build).

---

## Section C — Why this structure

The failure mode is not lack of knowledge about "no prescriptive briefs." Sonnet reads that rule every session and still writes them — because when the implementation is clear in Sonnet's head, the prescriptive form is the natural next step. Rules cannot override reflex.

Structure can. When:
- There is no `Task:` field → steps cannot be injected
- A.2 bans implementation verbs → prescriptive language is detectable on screen as typed
- A.3 requires a state invariant → naming a class/method = visible red flag
- A.4 self-test asks "could someone find a different solution?" → pre-solved tasks route to Haiku

The wrong form becomes mechanically detectable, not just "discouraged."

---

## Section D — Anti-patterns this template blocks

| Failure mode | Old state | Structural barrier |
|---|---|---|
| Steps in "Task" field | Open text field | No Task field exists |
| Prescriptive verbs in problem | "Check for line numbers" reminder | A.2 verb allowlist — banned verbs visible as typed |
| Goal = my chosen fix | Advice to say "remove concept" | A.3 form test — classes/methods in goal = RED FLAG |
| Pre-solved task sent to Opus | Decision table (post-hoc) | A.1 + A.4 force triage before template opens |
| No feedback loop | Sonnet hopes to self-notice | Opus reports brief quality in every output |

---

## Section E — No double processing

- Sonnet processes files → brief includes: `Context: Already found by Sonnet: [X].`
- Opus builds → Sonnet **spot-checks only** (does not re-process)
- Follow-ups → **SendMessage** to same Opus agent (not new Agent call = expensive re-read)
