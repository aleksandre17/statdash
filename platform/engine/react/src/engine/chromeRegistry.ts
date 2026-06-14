// ── ChromeRegistry — slot+variant → shell dispatch ─────────────────────
//
//  Grafana panel plugin pattern applied to chrome slots.
//  Chrome shells are () => ReactNode — ZERO PROPS. Data via hooks internally.
//  Constructor: manifest.chrome.AppHeader = 'minimal' → MinimalHeader renders.
//
//  NullChromeSlot: Null Object pattern — slot registered but renders nothing.
//  Use for: hidden sidebars, disabled banners, off slots.
//
import type { ReactNode }         from 'react'
import type { ChromeSliceMeta }  from './types'

type ChromeShell = () => ReactNode

interface ChromeEntry { shell: ChromeShell; meta: ChromeSliceMeta }

export class ChromeRegistry {
  private map = new Map<string, ChromeEntry>()

  register(slot: string, key: string, shell: ChromeShell, meta: ChromeSliceMeta): void {
    this.map.set(`${slot}::${key}`, { shell, meta })
  }

  get(slot: string, key: string): ChromeShell | undefined {
    return this.map.get(`${slot}::${key}`)?.shell
  }

  getMeta(slot: string, key: string): ChromeSliceMeta | undefined {
    return this.map.get(`${slot}::${key}`)?.meta
  }

  has(slot: string, key: string): boolean {
    return this.map.has(`${slot}::${key}`)
  }

  /** All registered slot names — for Constructor chrome editor. */
  list(): string[] {
    const slots = new Set<string>()
    for (const k of this.map.keys()) slots.add(k.split('::')[0])
    return Array.from(slots)
  }

  /** All registered variant keys for a slot — for Constructor variant picker. */
  listVariants(slot: string): string[] {
    const prefix = `${slot}::`
    const keys: string[] = []
    for (const k of this.map.keys()) {
      if (k.startsWith(prefix)) keys.push(k.slice(prefix.length))
    }
    return keys
  }

  /**
   * One meta per unique slot — prefers the 'default' variant, falls back to first registered.
   * Used by resolveChrome to determine defaultRegion + defaultOrder per slot.
   */
  listSlotMeta(): ChromeSliceMeta[] {
    const bySlot = new Map<string, ChromeSliceMeta>()
    for (const [k, { meta }] of this.map) {
      const [slot, key] = k.split('::')
      if (!bySlot.has(slot) || key === 'default') bySlot.set(slot, meta)
    }
    return Array.from(bySlot.values())
  }

  /** All variant meta entries — optionally filtered by slot. For Constructor listing. */
  listMeta(slot?: string): ChromeSliceMeta[] {
    const result: ChromeSliceMeta[] = []
    for (const [k, { meta }] of this.map) {
      if (!slot || k.startsWith(`${slot}::`)) result.push(meta)
    }
    return result
  }
}

export const chromeRegistry = new ChromeRegistry()

/** Null Object — chrome slot registered but renders nothing */
export const NullChromeSlot: ChromeShell = () => null