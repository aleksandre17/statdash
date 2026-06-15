import type { DataProvider } from 'react-admin'
import {
  configApi,
  fromApiDataSource,
  fromApiDataSpec,
  fromApiPage,
} from '../lib/api'

// RA's DataProvider verbs are each parametrically generic over their RecordType,
// so a hand-written heterogeneous resolver cannot satisfy the signature without a
// boundary cast. We author the resolver with concrete types, then assert the
// shape once at the export — the idiomatic pattern for custom RA providers. The
// per-resource `data` bodies are validated server-side (Zod) at the API edge.
type Body = Record<string, unknown>

// ── React Admin DataProvider over the config API ─────────────────────────────
//
//  Resources: data-sources, data-specs, pages. Maps RA's CRUD verbs onto
//  configApi + the row→domain adapters. Unused RA verbs are stubbed (the
//  Constructor never lists by reference or batches).
//
//  This is the RA-facing read/write surface. The Zustand store + api-actions
//  thunks are the Constructor's own session state — separate concern, same API.

const provider = {
  getList: async (resource: string) => {
    switch (resource) {
      case 'data-sources': {
        const data = (await configApi.dataSources.list()).map(fromApiDataSource)
        return { data, total: data.length }
      }
      case 'data-specs': {
        const data = (await configApi.dataSpecs.list()).map(fromApiDataSpec)
        return { data, total: data.length }
      }
      case 'pages': {
        const data = await configApi.pages.list()
        return { data, total: data.length }
      }
      default:
        return { data: [], total: 0 }
    }
  },

  getOne: async (resource: string, { id }: { id: string | number }) => {
    const key = String(id)
    switch (resource) {
      case 'data-sources':
        return { data: fromApiDataSource(await configApi.dataSources.get(key)) }
      case 'data-specs':
        return { data: fromApiDataSpec(await configApi.dataSpecs.get(key)) }
      case 'pages':
        return { data: fromApiPage(await configApi.pages.get(key)) }
      default:
        throw new Error(`Unknown resource: ${resource}`)
    }
  },

  create: async (resource: string, { data }: { data: Body }) => {
    switch (resource) {
      case 'data-sources':
        return { data: fromApiDataSource(await configApi.dataSources.create(data as never)) }
      case 'data-specs':
        return { data: fromApiDataSpec(await configApi.dataSpecs.create(data as never)) }
      case 'pages':
        return { data: { ...data, id: (await configApi.pages.create(data as never)).id } }
      default:
        throw new Error(`Unknown resource: ${resource}`)
    }
  },

  update: async (resource: string, { id, data }: { id: string | number; data: Body }) => {
    const key = String(id)
    switch (resource) {
      case 'data-sources':
        return { data: fromApiDataSource(await configApi.dataSources.update(key, data)) }
      case 'data-specs':
        return { data: fromApiDataSpec(await configApi.dataSpecs.update(key, data)) }
      case 'pages':
        return { data: { ...data, id: (await configApi.pages.update(key, data)).id } }
      default:
        throw new Error(`Unknown resource: ${resource}`)
    }
  },

  delete: async (resource: string, { id }: { id: string | number }) => {
    const key = String(id)
    switch (resource) {
      case 'data-sources':
        await configApi.dataSources.delete(key)
        return { data: { id } }
      case 'data-specs':
        await configApi.dataSpecs.delete(key)
        return { data: { id } }
      case 'pages':
        await configApi.pages.delete(key)
        return { data: { id } }
      default:
        throw new Error(`Unknown resource: ${resource}`)
    }
  },

  // ── Stubs for RA verbs the Constructor does not use ───────────────────────
  getMany: async () => ({ data: [] }),
  getManyReference: async () => ({ data: [], total: 0 }),
  updateMany: async () => ({ data: [] }),
  deleteMany: async () => ({ data: [] }),
}

export const dataProvider = provider as unknown as DataProvider
