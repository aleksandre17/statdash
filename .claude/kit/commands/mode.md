# /mode — operating-mode switch

> Invoke: "/mode" (show current + options) · "/mode `<name>`" · "switch to `<name>` mode". Sets the session's working posture for the whole team. SessionStart re-injects it on resume.

## Modes
| mode | posture | the lead… |
|---|---|---|
| **build** (default) | normal execution | full loop: pick → route → build → review → close |
| **plan** | design only, **no code edits** | produces cards · roadmap · architecture proposals · ADRs; dispatches **no** editing agents |
| **review** | scrutiny | drives `/audit` · `/review` · `/verify`; read-heavy; findings → cards |
| **strict** | maximum enforcement | every change gated · more clarifying questions · prefers reversible steps — for high-stakes / irreversible work |
| **fast** | minimal ceremony | trivial, **reversible** tasks only · fewer questions · lighter relay |

## How
- `/mode` (no arg) → report the current mode (from `.claude/session/mode`, default `build`) + the table; ask which.
- `/mode <name>` → adopt it now for the session **and** persist for resume: write the word via Bash — `echo <name> > .claude/session/mode`. Confirm in one line. (Reject an unknown name; list the valid five.)

## Invariant — a mode is a posture, never a bypass (binding)
No mode disables the hard guards: laws (`post-edit-laws`), Class-M gate, architecture rules, bloat block, the Intake Gate standards pre-check, or principled refusal. **`fast` reduces questions and ceremony, never safety** — a law/architecture violation still BLOCKS in every mode. **`plan` only adds a restriction** (no edits); it never removes one. Switching mode never lowers the quality bar (`06`: Quality → Learning → Tokens).
