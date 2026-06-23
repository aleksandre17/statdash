import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// ── Fitness function: @statdash/contracts MUST stay zero-dependency ────────────
//
//  contracts is the innermost layer (contracts ← everything). If it ever imports a
//  workspace package or React, it stops being a safe shared home — the api could no
//  longer depend on it without dragging a frontend graph across the dependency
//  arrow. This test fails the build the moment such an import appears.

const here       = dirname(fileURLToPath(import.meta.url))
const pkgJsonRaw = readFileSync(resolve(here, '../package.json'), 'utf8')
const pkgJson    = JSON.parse(pkgJsonRaw) as {
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = resolve(dir, e.name)
    if (e.isDirectory()) return sourceFiles(full)
    if (e.name.endsWith('.test.ts')) return []
    if (e.name.endsWith('.ts')) return [full]
    return []
  })
}

describe('@statdash/contracts purity', () => {
  it('declares NO runtime or peer dependencies', () => {
    expect(pkgJson.dependencies ?? {}).toEqual({})
    expect(pkgJson.peerDependencies ?? {}).toEqual({})
  })

  it('imports nothing from a workspace package, React, or an engine internal', () => {
    const offenders: string[] = []
    // Match any non-relative import that is not a Node builtin used by tooling.
    const importRe = /\bfrom\s+['"]([^'".][^'"]*)['"]/g
    for (const file of sourceFiles(here)) {
      const src = readFileSync(file, 'utf8')
      let m: RegExpExecArray | null
      while ((m = importRe.exec(src)) !== null) {
        const spec = m[1]
        // Allow Node builtins (node:*) — none expected in shipped types, but harmless.
        if (spec.startsWith('node:')) continue
        offenders.push(`${file}: ${spec}`)
      }
    }
    expect(offenders).toEqual([])
  })
})
