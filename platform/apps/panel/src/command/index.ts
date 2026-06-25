// ── command — Cmd-K + slash command palette (cmdk, V6) ────────────────────────
//
//  Frictionless insert/navigate over the open node registry. INSERT commands are
//  derived from the registry (OCP), executed through the SAME insert path the
//  drag palette uses (byte-identical config). Slash "/" narrows to insert-only.
//
export { CommandPalette } from './CommandPalette'
export { useCommandPalette } from './useCommandPalette'
export { useCommandRunner } from './useCommandRunner'
export {
  buildCommands, insertCommands, navigateCommands, actionCommands,
} from './commandModel'
export type { Command, CommandKind } from './commandModel'
