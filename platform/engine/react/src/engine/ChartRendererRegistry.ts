import type { ComponentType } from 'react'
import type { ChartOutput }   from '@geostat/engine'

export interface ChartRendererProps {
  output:         ChartOutput
  onDataHover?:   (dataIndex: number) => void
  onDataLeave?:   () => void
  onDataClick?:   (dataIndex: number) => void
}

export class ChartRendererRegistry {
  private readonly map = new Map<string, ComponentType<ChartRendererProps>>()

  register(type: string | string[], renderer: ComponentType<ChartRendererProps>): this {
    const types = Array.isArray(type) ? type : [type]
    for (const t of types) this.map.set(t, renderer)
    return this
  }

  get(type: string): ComponentType<ChartRendererProps> | undefined {
    return this.map.get(type)
  }

  has(type: string): boolean {
    return this.map.has(type)
  }

  /** Returns registered type keys — useful for Constructor palette. */
  types(): string[] {
    return Array.from(this.map.keys())
  }
}

export const chartRendererRegistry = new ChartRendererRegistry()