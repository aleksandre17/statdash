# /board — work-board operations

> Invoke: "/board" · "board" · "show the board" · "add to board" · "pick next". Doctrine: `strategy/11-work-board.md`.

**Read:** every file in `<work_dir>/items/` (frontmatter only, unless one card is the subject).

1. **`/board`** (no args) — regenerate `BOARD.md` from the cards: one kanban table (columns = statuses, rows = `id · title · class · priority · owner`), sorted by priority then id. Flag protocol violations: WIP > 2 · in-progress card with no owner · rejected card with no reason · done card with empty links.
2. **`/board add <title>`** — create the next-id card in `backlog` from `templates/work/item.template.md`; ask only for what's missing (class, priority); Goal/DoD drafted by the lead, confirmed by the user.
3. **`/board pick`** — propose the top `ready` card (priority, then id); on user approval → `in-progress`, set owner, route per Pre-Work Gate.
4. **`/board done <id>` / `/board reject <id> <reason>`** — settle per flow rule 6, then regenerate BOARD.md.

Output: the regenerated board + any violations, nothing else.
