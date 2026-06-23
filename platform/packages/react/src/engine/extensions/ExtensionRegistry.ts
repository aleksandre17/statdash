import type { ExtensionPoint, Contribution } from './ExtensionPoint'

export class ExtensionRegistry {
  // Keyed by point.id (string) — HMR-safe
  private readonly contributions = new Map<string, Contribution<unknown, unknown>[]>()

  contribute<T, Ctx>(point: ExtensionPoint<T>, contribution: Contribution<T, Ctx>): this {
    const list = this.contributions.get(point.id) ?? []
    list.push(contribution as Contribution<unknown, unknown>)
    list.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
    this.contributions.set(point.id, list)
    return this
  }

  resolve<T, Ctx>(point: ExtensionPoint<T>, host: Ctx): T[] {
    const list = this.contributions.get(point.id) as Contribution<T, Ctx>[] | undefined
    if (!list) return []
    return list.filter(c => c.when?.(host) ?? true).map(c => c.render(host))
  }
}
