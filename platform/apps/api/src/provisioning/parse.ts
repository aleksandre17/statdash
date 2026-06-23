// ── Provisioning — discover + parse + normalize (Pipe-and-Filter stages) ──────
// File IO and format detection. Output: a normalized ProvisioningManifest per
// file. No DB access — the upserters consume what this produces.

import { readdir, readFile } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { load as parseYaml } from 'js-yaml'
import type {
  ProvisioningLogger, ProvisioningManifest, PageProvision,
  NavItemProvision, DataSourceProvision, SiteConfigProvision, LocaleString,
  ContentConstraintProvision, ContentConstraintMemberProvision,
} from './types.js'
import {
  isObject, isLocaleString, asArray, pickString, pickStatus, slugFromPath, errMsg,
} from './util.js'

const SUPPORTED = new Set(['.json', '.yaml', '.yml'])

/**
 * Discover supported files in `dir`, sorted for a deterministic apply order.
 * Returns null when the directory does not exist (a no-op boot, not an error).
 */
export async function discoverFiles(dir: string, log: ProvisioningLogger): Promise<string[] | null> {
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    log.error({ dir, error: errMsg(err) }, 'provisioning: cannot read directory')
    return null
  }
  return entries
    .filter((name) => SUPPORTED.has(extname(name).toLowerCase()))
    .sort()
    .map((name) => join(dir, name))
}

/**
 * Read + parse a file into a manifest. JSON and YAML parse to the same object
 * model; then we detect the format:
 *   { version: 1, ... }  → manifest (multi-resource)
 *   otherwise            → a single NodePageConfig (must carry a slug/id/path)
 */
export async function parseFile(file: string): Promise<ProvisioningManifest> {
  const raw = await readFile(file, 'utf8')
  const ext = extname(file).toLowerCase()
  const doc: unknown = ext === '.json' ? JSON.parse(raw) : parseYaml(raw)

  if (!isObject(doc)) throw new Error('file is not an object at its root')

  if ((doc as { version?: unknown }).version === 1) {
    return normalizeManifest(doc)
  }
  return { version: 1, pages: [pageFromConfig(doc)] }
}

function normalizeManifest(doc: Record<string, unknown>): ProvisioningManifest {
  return {
    version:     1,
    pages:       asArray(doc.pages).map(asPageProvision),
    navItems:    asArray(doc.navItems).map(asNavProvision),
    dataSources: asArray(doc.dataSources).map(asDataSourceProvision),
    // Additive (Postel): manifests without a siteConfig section yield [].
    siteConfig:  asArray(doc.siteConfig).map(asSiteConfigProvision),
    contentConstraints: asArray(doc.contentConstraints).map(asContentConstraintProvision),
  }
}

/**
 * Treat a raw object as a page config. Identity (slug/title) is taken from
 * top-level fields if present, else derived from the config's own id/path/title.
 * The whole object is stored as the config tree.
 */
function pageFromConfig(doc: Record<string, unknown>): PageProvision {
  const slug = pickString(doc.slug) ?? pickString(doc.id) ?? slugFromPath(pickString(doc.path))
  if (!slug) throw new Error('page config has no slug, id, or path to derive a slug from')

  const title: LocaleString = isLocaleString(doc.title) ? doc.title : { ka: slug }

  return {
    slug,
    title,
    config:    doc,
    dataSpecs: asArray(doc.dataSpecs),
    status:    pickStatus(doc.status),
  }
}

// ── Boundary validators (Postel's law) ────────────────────────────────────────

export function asPageProvision(v: unknown): PageProvision {
  if (!isObject(v)) throw new Error('pages[] entry is not an object')
  const slug = pickString(v.slug) ?? pickString(v.id)
  if (!slug) throw new Error('pages[] entry is missing a slug')
  if (!isLocaleString(v.title)) throw new Error(`page '${slug}' is missing a title locale map`)
  if (v.config === undefined) throw new Error(`page '${slug}' is missing config`)
  return {
    slug,
    title:     v.title,
    config:    v.config,
    dataSpecs: asArray(v.dataSpecs),
    status:    pickStatus(v.status),
  }
}

export function asNavProvision(v: unknown): NavItemProvision {
  if (!isObject(v)) throw new Error('navItems[] entry is not an object')
  if (!isLocaleString(v.label)) throw new Error('navItems[] entry is missing a label locale map')
  return {
    label:    v.label,
    href:     pickString(v.href),
    pageSlug: pickString(v.pageSlug),
    ord:      typeof v.ord === 'number' ? v.ord : undefined,
  }
}

export function asSiteConfigProvision(v: unknown): SiteConfigProvision {
  if (!isObject(v)) throw new Error('siteConfig[] entry is not an object')
  const key = pickString(v.key)
  if (!key) throw new Error('siteConfig[] entry is missing a key')
  // value is any JSON (string/object/array/number/bool); only `undefined` (the
  // key absent) is rejected — null is a legitimate stored value.
  if (!('value' in v) || v.value === undefined) {
    throw new Error(`siteConfig '${key}' is missing a value`)
  }
  return { key, value: v.value }
}

export function asContentConstraintProvision(v: unknown): ContentConstraintProvision {
  if (!isObject(v)) throw new Error('contentConstraints[] entry is not an object')
  const datasetCode = pickString(v.datasetCode)
  if (!datasetCode) throw new Error('contentConstraints[] entry is missing a datasetCode')
  // role is fixed to 'allowed' (the only authorable role; 'actual' is the derived
  // view). Reject any other value rather than silently coercing — fail fast.
  if (v.role !== undefined && v.role !== 'allowed') {
    throw new Error(`content constraint '${datasetCode}' has invalid role '${String(v.role)}' (only 'allowed' is authorable)`)
  }
  const members = asArray(v.members).map((m) => asContentConstraintMember(m, datasetCode))
  if (members.length === 0) {
    throw new Error(`content constraint '${datasetCode}' has no members`)
  }
  return {
    datasetCode,
    role:    'allowed',
    label:   isLocaleString(v.label) ? v.label : undefined,
    members,
  }
}

function asContentConstraintMember(v: unknown, datasetCode: string): ContentConstraintMemberProvision {
  if (!isObject(v)) throw new Error(`content constraint '${datasetCode}' has a non-object member`)
  const dimCode = pickString(v.dimCode)
  const code = pickString(v.code)
  if (!dimCode || !code) {
    throw new Error(`content constraint '${datasetCode}' member is missing dimCode/code`)
  }
  let when: ContentConstraintMemberProvision['when']
  if (v.when !== undefined) {
    if (!isObject(v.when)) throw new Error(`content constraint '${datasetCode}' member '${dimCode}=${code}' has a non-object when`)
    const whenDim = pickString(v.when.dimCode)
    const whenCode = pickString(v.when.code)
    if (!whenDim || !whenCode) {
      throw new Error(`content constraint '${datasetCode}' member '${dimCode}=${code}' has an incomplete when`)
    }
    if (whenDim === dimCode) {
      throw new Error(`content constraint '${datasetCode}' member '${dimCode}=${code}' conditions on its own dimension`)
    }
    when = { dimCode: whenDim, code: whenCode }
  }
  return { dimCode, code, when }
}

export function asDataSourceProvision(v: unknown): DataSourceProvision {
  if (!isObject(v)) throw new Error('dataSources[] entry is not an object')
  const name = pickString(v.name)
  if (!name) throw new Error('dataSources[] entry is missing a name')
  const type = pickString(v.type)
  if (type !== 'sdmx-json' && type !== 'rest' && type !== 'static') {
    throw new Error(`data source '${name}' has invalid type '${String(type)}'`)
  }
  return {
    name,
    type,
    url:    pickString(v.url),
    config: isObject(v.config) ? v.config : {},
  }
}
