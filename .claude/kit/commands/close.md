# /close — Session wrap playbook

> Invoke: "wrap up" · "close the session" · end-of-session. Pairs with the Stop hook (which only *warns*; this *does* the work).

**Who:** Sonnet (single writer of durable state).
**Reads:** what changed this session · `opus-brief.md` · `.claude/session/token-log.md`.
**Output:** updated durable state.
**Records (the close checklist):**
1. **`opus-brief §Current State`** updated, ≤ 80 lines — rotate the 4th-oldest layer detail → `<paths.layers_dir>`.
2. **Token-log** line appended (the SessionEnd hook rolls it up).
3. **Learning note** (`07`) if an architectural concept was touched this session — `<paths.learning_dir>`.
4. **`project_debt`** updated — new items found, items closed.
5. **Open threads** named in `§Last Session` so the next resume is clean (the stale-check verifies brief vs repo).
**Done when:** a cold next session could resume correctly from durable files alone.

## Note
Every Nth close (phase end) → run Gate 3 review of token rollup + brief-quality trend (`02`) — the feedback loop's cadence.
