// ── PlatformCommandMap — typed command union (module augmentation pattern) ──
//
//  Plugins extend via:
//    declare module '@statdash/react' { interface PlatformCommandMap { 'my:cmd': {...} } }
//
//  Same pattern as PlatformEventMap and NodeTypeMap — open discriminated union,
//  no central registry change required for extension.
//

import type { PerspectiveId }   from '@statdash/engine'
import type { DataRow }         from '@statdash/engine'
import type { ExportMeta }      from '@statdash/engine'
import type { ExportFormatId }  from '@statdash/engine'

export interface PlatformCommandMap {
  /** Set one filter param. Replaces ctx.set(key, val). */
  'filter:set':     { key: string; value: string }
  /** Set many filter params atomically. */
  'filter:setMany': { values: Record<string, string> }
  /** Clear one filter param. */
  'filter:clear':   { key: string }
  /** Switch the active perspective. Replaces ctx.perspective.set(id). */
  'perspective:set': { id: PerspectiveId; param?: string }
  /**
   * Navigate / drill. Centralises all navigation from shells.
   * Migrated from the 'drill:down' EventBus event — one consumer = command, not event.
   */
  'nav:drill':      { href: string; target: 'page' | 'url' | 'external'; params?: Record<string, string> }
  /**
   * Export rows programmatically. ExportBar's own handlers are unaffected.
   * `format` is a registry id (ExportFormatId) — the export registry is the
   * SSOT for available formats, not a hand-maintained literal union.
   */
  'data:export':    { format: ExportFormatId; rows: DataRow[]; meta?: ExportMeta }
}

export type CommandType = keyof PlatformCommandMap

/**
 * Discriminated union over all registered command types.
 * Derive the full concrete type for a specific key K:
 *   Command<'filter:set'> → { type: 'filter:set'; key: string; value: string }
 */
export type Command<K extends CommandType = CommandType> =
  { [T in CommandType]: { type: T } & PlatformCommandMap[T] }[K]
