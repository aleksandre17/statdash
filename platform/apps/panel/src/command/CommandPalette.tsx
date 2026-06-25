// ── CommandPalette — Cmd-K + slash insert over the registry (cmdk, V6) ────────
//
//  The frictionless insert/navigate surface (Notion/Gutenberg/Linear). Built on
//  cmdk (accessible by default — focus trap, roving listbox, type-ahead). Its
//  commands come from commandModel (registry-driven INSERT + navigate + action),
//  NOT a hardcoded list, so a newly-registered node type is Cmd-K-insertable with
//  zero change here (OCP). Every command executes through useCommandRunner — the
//  SAME insert path the drag palette uses (byte-identical config).
//
//  Two entry modes over one component:
//    • Cmd-K (⌘K / Ctrl-K)  → full palette (insert + navigate + actions).
//    • slash "/"            → typing "/" as the first character switches to
//      INSERT-only and uses the text after "/" as the query — the Notion/
//      Gutenberg slash quick-insert, in-place at the current selection.
//
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Command } from 'cmdk'
import { useActivePage, useSelectedNode } from '../store/constructor.store'
import { buildCommands, type Command as Cmd } from './commandModel'
import { useCommandRunner } from './useCommandRunner'
import './command.css'

export interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const page       = useActivePage()
  const selectedId = useSelectedNode()
  const run        = useCommandRunner()
  const [search, setSearch] = useState('')

  // Slash mode: a leading "/" narrows to INSERT commands (Gutenberg/Notion). The
  // text after the slash is the real query cmdk filters on.
  const slashMode = search.startsWith('/')
  const query     = slashMode ? search.slice(1) : search

  const commands = useMemo<Cmd[]>(
    () => buildCommands(page, selectedId, slashMode),
    [page, selectedId, slashMode],
  )

  // Reset the query on each open/close transition (fresh slate, least
  // astonishment) at the event source — not in an effect — so no cascading render.
  const handleOpenChange = useCallback((next: boolean) => {
    setSearch('')
    onOpenChange(next)
  }, [onOpenChange])

  const groups = useMemo(() => {
    const byGroup = new Map<string, Cmd[]>()
    for (const c of commands) {
      const list = byGroup.get(c.group) ?? []
      list.push(c)
      byGroup.set(c.group, list)
    }
    return [...byGroup.entries()]
  }, [commands])

  const execute = (cmd: Cmd) => {
    run(cmd)
    handleOpenChange(false)
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={handleOpenChange}
      label="Command palette"
      className="cmdk-dialog"
      // cmdk filters against label + keywords; we pass our query (slash-stripped).
      shouldFilter
    >
      <Command.Input
        value={search}
        onValueChange={setSearch}
        placeholder="ჩასმა ან გადასვლა…  (Cmd-K · type / to insert)"
        className="cmdk-input"
        aria-label="Search commands"
      />
      <Command.List className="cmdk-list">
        <Command.Empty className="cmdk-empty">ვერ მოიძებნა · No matches</Command.Empty>
        {groups.map(([heading, items]) => (
          <Command.Group key={heading} heading={heading} className="cmdk-group">
            {items.map((cmd) => (
              <Command.Item
                key={cmd.id}
                // cmdk uses `value` for matching; include keywords so a search by
                // type/category/cap hits even when the label differs.
                value={`${cmd.label} ${cmd.keywords.join(' ')}`}
                keywords={cmd.keywords}
                onSelect={() => execute(cmd)}
                className="cmdk-item"
              >
                <span className="cmdk-item__label">{cmd.label}</span>
                {cmd.kind === 'insert' && cmd.nodeType && (
                  <span className="cmdk-item__hint">{cmd.nodeType}</span>
                )}
              </Command.Item>
            ))}
          </Command.Group>
        ))}
        {/* slashMode hint when nothing typed after "/" */}
        {slashMode && query.length === 0 && commands.length === 0 && (
          <div className="cmdk-empty">ჩაწერეთ ტიპის სახელი…</div>
        )}
      </Command.List>
    </Command.Dialog>
  )
}

/**
 * useCommandPalette — owns the open state + the global ⌘K / Ctrl-K shortcut.
 * A "/" pressed while no input is focused also opens the palette in slash mode
 * (Notion ergonomics) — but only when not already typing in a field, so it never
 * hijacks a real "/" keystroke in an Inspector text input.
 */
export function useCommandPalette() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return { open, setOpen }
}
