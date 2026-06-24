import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, dirname, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

// ── Fitness function: the library packages carry no first-tenant CONTENT ──────
//
//  Sibling to no-geostat-scope.fitness.test.ts (which locks the npm SCOPE).
//  This one locks the *content*: statdash-platform is the PLATFORM; `geostat`
//  (Georgia / GEL / Georgian-script labels) is the FIRST TENANT. Law 3 says the
//  library packages (engine, react, charts, plugins, styles) are app-agnostic;
//  Law 1 says no privileged dimensions. Tenant content — Georgian (`ka`) display
//  text, the GEL currency symbol ₾, tenant dataset codes — belongs to TENANT
//  DATA (the obs / classifier / display / unit metadata, the manifest, the
//  config), never baked into a reusable library as a literal.
//
//  Trigger: a Georgian unit string `"მლნ ₾"` was found hardcoded in
//  plugins GeoMap.tsx's tooltip — rendering logic with no data path. The runner
//  (apps/geostat) was proven agnostic but the libraries were never audited. This
//  test makes "the libraries are tenant-agnostic" an ENFORCED invariant: any new
//  Georgian glyph, GEL/₾ currency literal, or tenant dataset code in library
//  *code* (comments stripped) fails the build.
//
//  WHAT IS A LEAK  vs  WHAT IS LEGITIMATE
//  ──────────────────────────────────────
//  Leak     : tenant CONTENT as a literal in logic/rendering — `"მლნ ₾"`,
//             `'GEL'`, `'₾'`, `'GDP_ANNUAL'`, a hardcoded `['ka','en']` default.
//  Legit    : generic engine vocabulary — the `'measure'` / `'value'` field
//             ROLES, a `'time'` concept-role token, the `'en'` neutral fallback,
//             the LocaleString resolution machinery, ParamDef/Spec type names.
//             (These are not tenant data; they are the agnostic grammar.)
//
//  KNOWN RESIDUAL (allowlisted, see ALLOW below): the Constructor palette and
//  i18n catalogs (styles/catalog/*, core spec-catalog, OBS_STATUS_LABELS) ship
//  canonical *bilingual* `{ ka, en }` content. De-coupling that content into a
//  tenant-supplied i18n registry is an architect-owned redesign of the engine's
//  public i18n surface (Class-M) — tracked as residual, NOT silently passed.
//  Everything OUTSIDE that allowlist must be tenant-content-free.

const here         = dirname(fileURLToPath(import.meta.url))
const platformRoot = resolve(here, '..')
const packagesRoot = resolve(platformRoot, 'packages')

// Georgian (Mkhedruli + extensions) Unicode block.
const GEORGIAN = /[Ⴀ-ჿ]/
// GEL currency symbol (lari) + the ISO code as a standalone token + tenant
// dataset codes. Word-bounded so 'angle'/'gemel' etc. never false-match GEL.
const GEL_SYMBOL   = /₾/                       // ₾
const GEL_CODE     = /\bGEL\b/
const TENANT_CODES = /\bGDP_ANNUAL\b/
// Tenant brand wordmark in Georgian script (GeoStat = საქსტატი). Brand identity
// is never library content — it belongs in ChromeConfig (the manifest).
const BRAND_KA     = /საქსტატი/
// A hardcoded Georgian-first locale literal — the first tenant's locale set
// baked in instead of taken from the manifest / ctx.
const KA_LOCALE_LITERAL = /\[\s*['"]ka['"]\s*,\s*['"]en['"]\s*\]|\[\s*['"]en['"]\s*,\s*['"]ka['"]\s*\]/

// Strip // line comments and /* … */ block comments so documentation glyphs
// (e.g. a JSDoc `e.g. 'მლნ ₾'`) are not flagged — only live code is scanned.
// Naive but sufficient: library source has no regex/string literals that embed
// comment delimiters alongside forbidden tokens.
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')   // block comments
    .replace(/(^|[^:])\/\/.*$/gm, '$1') // line comments (avoid http:// via the [^:])
}

const SCANNED_EXT = new Set(['.ts', '.tsx'])

// Not live library source: tests, stories, fixtures legitimately use sample
// tenant data; vitest config/setup are build plumbing. All excluded by design.
//
// NOTE: packages are NOT uniformly under a `src/` dir — `plugins` is organised
// by feature folders (nodes/, panels/, chrome/, …) and `expr` keeps source at
// its root. So we scan ALL .ts/.tsx under packages/ and exclude by pattern,
// rather than requiring a `/src/` segment (which would have skipped the entire
// plugins package — exactly where the GeoMap leak lived).
function isExcludedFile(relPath: string): boolean {
  return (
    /\.(test|spec|stories)\.[tj]sx?$/.test(relPath) ||
    /(^|\/)vitest\.(config|setup)\.[tj]s$/.test(relPath) ||
    relPath.includes('__tests__/') ||
    relPath.includes('__fixtures__/') ||
    relPath.includes('__mocks__/')
  )
}

// ── Two tiers of enforcement ──────────────────────────────────────────────
//
//  TIER 1 — hard-forbidden EVERYWHERE in library code (incl. catalogs):
//    GEL currency (₾ / GEL), tenant dataset codes, the GeoStat brand wordmark,
//    a hardcoded `['ka','en']` locale literal. These are never legitimate in a
//    reusable library — currency + brand are tenant identity, the locale set is
//    manifest data.
//
//  TIER 2 — Georgian SCRIPT, forbidden in rendering / logic source only.
//    The known architect-owned residual is the Constructor palette + i18n
//    CATALOG class: the engine ships canonical *bilingual* `{ ka, en }` content
//    (provenance.ts docstring; per-slice meta.ts `i18n`/`label`; *Node.ts
//    PropSchema field labels). That content is the engine i18n machinery working
//    as designed; de-coupling it into a tenant-supplied i18n registry is an
//    engine-public-API redesign (Class-M) owned by the architect. It is
//    allowlisted for TIER 2 (Georgian) but STILL subject to TIER 1.
//
//  isCatalogClass: a file is catalog content if it is an explicit ALLOW entry,
//  a per-slice `meta.ts`, or a `*Node.ts` schema descriptor.

const ALLOW = new Set(
  [
    'packages/core/src/spec-catalog.ts',
    // Transform-op authoring catalog — the SAME class as spec-catalog.ts: a
    // Constructor descriptor carrying bilingual PropField labels the Inspector
    // renders. Not rendering/logic code; an i18n catalog (V1 transform StepForms).
    'packages/core/src/data/transform/op-schemas.ts',
    // ParamDef authoring catalog — the SAME class as op-schemas.ts: a Constructor
    // descriptor carrying bilingual PropField labels the Inspector renders to
    // author page-level filter controls. Not rendering/logic code; an i18n catalog
    // (V0 page-level FilterSchema authoring).
    'packages/core/src/config/param-schemas.ts',
    'packages/core/src/core/provenance.ts',
    'packages/styles/src/catalog/typography.ts',
    'packages/styles/src/catalog/primitives.ts',
    'packages/styles/src/catalog/motion.ts',
    'packages/styles/src/catalog/layout.ts',
    'packages/styles/src/catalog/data-color.ts',
    'packages/styles/src/catalog/color.ts',
    'packages/expr/ops-catalog.ts',
    'packages/expr/refs-catalog.ts',
  ].map((p) => p.split('/').join(sep)),
)

function isCatalogClass(rel: string, relUnix: string, raw: string): boolean {
  if (ALLOW.has(rel)) return true
  if (/(^|\/)meta\.ts$/.test(relUnix)) return true       // per-slice palette + i18n
  if (/Node\.ts$/.test(relUnix)) return true             // PropSchema descriptors
  // Chrome slices declare their palette META in index.ts (ChromeSliceMeta).
  // Identify by the SliceMeta type annotation rather than path, so only true
  // catalog descriptors (not arbitrary barrels) are exempted.
  if (/(^|\/)index\.ts$/.test(relUnix) && /:\s*\w*SliceMeta\b/.test(raw)) return true
  return false
}

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git'])

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) return []
      return walk(resolve(dir, e.name))
    }
    const dot = e.name.lastIndexOf('.')
    if (dot < 0 || !SCANNED_EXT.has(e.name.slice(dot))) return []
    return [resolve(dir, e.name)]
  })
}

function scanLibrarySource(): string[] {
  const offenders: string[] = []
  for (const file of walk(packagesRoot)) {
    const rel = relative(platformRoot, file)
    const relUnix = rel.split(sep).join('/')
    if (isExcludedFile(relUnix)) continue

    const raw = readFileSync(file, 'utf8')
    const catalog = isCatalogClass(rel, relUnix, raw)
    const code = stripComments(raw)
    code.split('\n').forEach((line, i) => {
      // TIER 1 — everywhere.
      const tier1 =
        (GEL_SYMBOL.test(line) && 'GEL-symbol(₾)') ||
        (GEL_CODE.test(line) && 'GEL-code') ||
        (TENANT_CODES.test(line) && 'tenant-dataset-code') ||
        (BRAND_KA.test(line) && 'geostat-brand(საქსტატი)') ||
        (KA_LOCALE_LITERAL.test(line) && 'hardcoded-ka-locale-literal')
      // TIER 2 — Georgian script in rendering/logic only (catalogs exempt).
      const tier2 = !catalog && GEORGIAN.test(line) && 'georgian-script'
      const hit = tier1 || tier2
      if (hit) offenders.push(`${relUnix}:${i + 1} [${hit}]: ${line.trim()}`)
    })
  }
  return offenders
}

describe('library packages carry no first-tenant content (Law 1 + Law 3)', () => {
  it('no Georgian script / GEL currency / tenant code in library code (comments + catalogs excluded)', () => {
    expect(scanLibrarySource()).toEqual([])
  })

  // Self-probe: the regexes actually fire on the exact leak that triggered this
  // test, so a future reintroduction of GeoMap's `"მლნ ₾"` cannot pass silently.
  it('PROBE — the detectors fire on the original GeoMap leak literal', () => {
    const leak = '`<strong>${row.label}</strong><br/>${fmtNum(row.value, 0)} მლნ ₾ · ${fmtNum(row.pct ?? 0, 1)}%`'
    const stripped = stripComments(leak)
    expect(GEORGIAN.test(stripped)).toBe(true)
    expect(GEL_SYMBOL.test(stripped)).toBe(true)
  })

  // Self-probe: comment stripping prevents false positives on documentation
  // glyphs (e.g. ChromeConfig's "replaces hardcoded 'ქარ', 'ENG'" comment).
  it('PROBE — documentation glyphs in comments are NOT flagged', () => {
    const docComment = "  // ── Locale display labels — replaces hardcoded 'ქარ', 'ENG'"
    expect(GEORGIAN.test(stripComments(docComment).trim())).toBe(false)
  })

  // Self-probe: TIER 1 (currency / brand / locale literal) fires EVEN inside a
  // catalog file — the allowlist exempts Georgian SCRIPT only, never tenant
  // currency, the GeoStat brand wordmark, or a hardcoded ['ka','en'] default.
  it('PROBE — TIER 1 currency / brand / locale-literal is forbidden everywhere', () => {
    expect(GEL_SYMBOL.test("unit: '₾'")).toBe(true)
    expect(GEL_CODE.test("format: 'GEL'")).toBe(true)
    expect(BRAND_KA.test('© 2026 საქსტატი')).toBe(true)
    expect(KA_LOCALE_LITERAL.test("const locales = ['ka', 'en']")).toBe(true)
    // and a generic 'en' fallback / 'measure' role token is NOT a locale literal
    expect(KA_LOCALE_LITERAL.test("const fallback = 'en'")).toBe(false)
  })
})
