// ── FilterControlRegistry — controlType → FilterControlSlice dispatch ───
//
//  Registry + Strategy pattern for filter controls.
//  FilterBarShell dispatches to this — zero knowledge of specific control types.
//  New control type: write Shell + codec + register → works everywhere. No engine change.
//
//  FilterControlSlice shape matches plugins/controls/{type}/index.ts exports.
//  Platform standard: Grafana QueryEditor, Builder.io input components.
//

import type { ComponentType }   from 'react'
import type { FilterControlMeta } from './types'

export interface FilterCodec<T> {
  toUrl:     (v: T) => string
  fromUrl:   (s: string | null) => T | null
  isEmpty:   (v: T | null) => boolean
  normalize: (raw: unknown) => T
}

export interface FilterControlSlice<C = unknown, V = unknown> {
  META:         FilterControlMeta
  Shell:        ComponentType<{ filterKey: string; config: C }>
  defaultValue: (config: C) => V
  codec:        FilterCodec<V>
  validate?:    (v: V, config: C) => string | null
  formatValue?: (v: V) => string
}

export class FilterControlRegistry {
  private map = new Map<string, FilterControlSlice>()

  register(slice: FilterControlSlice): void {
    this.map.set(slice.META.controlType, slice)
  }

  get(controlType: string): FilterControlSlice | undefined {
    return this.map.get(controlType)
  }

  has(controlType: string): boolean {
    return this.map.has(controlType)
  }

  types(): string[] {
    return [...this.map.keys()]
  }
}

export const filterControlRegistry = new FilterControlRegistry()