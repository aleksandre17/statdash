// ── Provisioning — pure utilities (no IO, no DB) ──────────────────────────────
// Boundary narrowing (Postel's law) + canonical JSON equality for change
// detection. Pure functions: trivially unit-testable, shared by parse + upsert.

import { isAbsolute, resolve } from 'node:path'
import type { LocaleString, PageProvision } from './types.js'

export function resolveDir(dir: string): string {
  return isAbsolute(dir) ? dir : resolve(process.cwd(), dir)
}

export function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function isLocaleString(v: unknown): v is LocaleString {
  return isObject(v) && Object.values(v).every((x) => typeof x === 'string')
}

export function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

export function pickString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

export function pickStatus(v: unknown): PageProvision['status'] | undefined {
  return v === 'draft' || v === 'published' || v === 'archived' ? v : undefined
}

export function slugFromPath(path?: string): string | undefined {
  if (!path) return undefined
  const seg = path.replace(/^\/+|\/+$/g, '').split('/').pop()
  return seg && seg.length > 0 ? seg : undefined
}

export function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

// ── Canonical JSON equality (stable deep-equality for change detection) ────────

/** True when a and b serialize identically with keys sorted (order-insensitive). */
export function jsonEqual(a: unknown, b: unknown): boolean {
  return canonical(a) === canonical(b)
}

function canonical(v: unknown): string {
  return JSON.stringify(sortKeys(v))
}

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys)
  if (isObject(v)) {
    return Object.keys(v)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = sortKeys(v[k])
        return acc
      }, {})
  }
  return v
}
