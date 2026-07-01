# /rotate — session-log rotation playbook

> Invoke: "/rotate" · "rotate the log" · triggered by the stop-check size nudge. Keeps the session
> layer "load exactly what is necessary": the HOT head stays at the hook-read paths; cold/older layers
> move out. Companion to kit `05` (context protocol) rotation policy — this is its mechanical form.
> Hooks read `.claude/session/context.md`, `.claude/session/token-log.md`, `.claude/session/mode` at
> EXACT paths — rotation only TRIMS them, never moves them.

## When to rotate
- `context.md` grows past ~15KB (roughly a screen of handoff + a few layers), OR
- `token-log.md` accumulates more than the current period (a new session/day), OR
- a layer transition completes and the referenced work is committed, OR
- the stop-check size nudge fires at session close.

## Steps
1. **context.md** — keep the HOT head (the most recent `RESUME HERE` / handoff block, ≤ ~15KB).
   Move the older/landed layers verbatim to `docs/layers/<YYYY-MM-DD>-context-cold-log.md` (tracked
   knowledge). Leave a one-line pointer at the bottom of `context.md` naming the layer file. Delete
   nothing — cold content is relocated, never dropped.
2. **token-log.md** — keep the current period's ledger. Move the prior/closed-period detail to
   `.claude/session/archive/token-log-<YYYY-MM-DD>.md` (gitignored cold scratch), then reset the hot
   ledger to a fresh header + a pointer to the archive slice.
3. **Durable extract first (kit `05`)** — before clearing, ensure any durable decision from the cold
   content is captured in `.claude/context/opus-brief.md §Current State` (the auto-injected resume) or
   a memory file. Rotation moves history to cold storage; it must not lose a live decision.
4. **Verify** — `context.md` ≤ ~15KB; `token-log.md` ≈ one period; hooks still read the three session
   paths; `python .claude/kit/tools/doctor.py` bloat check no longer flags these two files.

## Invariant — rotate trims, never relocates the hook paths (binding)
`context.md`, `token-log.md`, `mode` stay at `.claude/session/`. Cold layers land in `docs/layers/`
(tracked) and `.claude/session/archive/` (gitignored). Nothing is deleted — every rotated byte is
reachable from the pointer left behind. SSOT: the durable decision lives in `opus-brief`/memory, the
narrative log lives in the layer/archive, the hot file holds only what the next resume needs now.
