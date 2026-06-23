// ── Style composition utilities ───────────────────────────────────────
//
//  mergeStyles     — deep merge: b fills gaps in a; conditions concatenated
//  overrideStyles  — alias for mergeStyles (b wins on all conflicts)
//  pickStyles      — project a subset of keys
//  omitStyles      — exclude specific keys
//

import type { NodeStyles } from '../types'

// Deep-merge two NodeStyles objects.
// b's defined values override a's; conditions arrays are concatenated.
export function mergeStyles(a: NodeStyles, b: NodeStyles): NodeStyles {
  const result: Record<string, unknown> = { ...a }
  for (const key of Object.keys(b) as (keyof NodeStyles)[]) {
    const bVal = b[key]
    if (bVal === undefined) continue
    if (key === 'conditions') {
      result.conditions = [...(a.conditions ?? []), ...(b.conditions ?? [])]
    } else {
      result[key] = bVal
    }
  }
  return result as NodeStyles
}

// Alias: apply patch on top of base. Patch values win on conflict.
export function overrideStyles(base: NodeStyles, patch: Partial<NodeStyles>): NodeStyles {
  return mergeStyles(base, patch as NodeStyles)
}

// Project a subset of style properties.
export function pickStyles<K extends keyof NodeStyles>(
  styles: NodeStyles,
  keys:   K[],
): Pick<NodeStyles, K> {
  const result = {} as Pick<NodeStyles, K>
  for (const k of keys) {
    if (styles[k] !== undefined) result[k] = styles[k] as Pick<NodeStyles, K>[K]
  }
  return result
}

// Exclude specific style properties.
export function omitStyles<K extends keyof NodeStyles>(
  styles: NodeStyles,
  keys:   K[],
): Omit<NodeStyles, K> {
  const result = { ...styles } as Record<string, unknown>
  for (const k of keys) delete result[k as string]
  return result as Omit<NodeStyles, K>
}