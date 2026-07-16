// ── MultiSelectShell — the multi-select filter control, on the owned surface ──
//
//  Renders the `multi-select` ParamDef through the OWNED `MultiSelect` compound
//  (packages/react ui foundation: Radix menu CheckboxItems + DTCG-token paint +
//  chip summary) — replacing the bare checkbox fieldset. The wire contract is
//  unchanged: the filter state carries the ctx CSV OR-set convention
//  ('C,F' — splitMultiValue SSOT), split/joined ONLY here at the edge.
//
import { useFilter, useCurrentStore, useResolveLocaleSafe, MultiSelect } from '@statdash/react'
import { resolveOptions }                               from '@statdash/engine'
import type { ParamMultiSelectNode }                    from '@statdash/engine'

const EMPTY_CTX = { dims: {} }

export function MultiSelectShell({ filterKey, config }: { filterKey: string; config: ParamMultiSelectNode }) {
  const { state, set } = useFilter()
  const store          = useCurrentStore()
  // i18n boundary: resolve LocaleString option/legend labels to the active locale
  // (no-op on plain strings) — never let a {en,ka} reach text as "[object Object]".
  const t       = useResolveLocaleSafe()
  const raw     = state[filterKey] ?? ''
  const current = raw ? raw.split(',').filter(Boolean) : []

  // The canonical resolver — static · inline $d/$cl · query · api sources alike
  // (the same path SelectShell walks); static-only fallback without a store.
  const options = store
    ? resolveOptions(config.options, store, EMPTY_CTX)
    : config.options.type === 'static' ? config.options.items : []
  const labelOf = (v: string) => {
    const opt = options.find((o) => String(o.value) === v)
    return opt ? t(opt.label) : v
  }

  // Cap the trigger summary to a couple of chips + a "+N" overflow token, so a
  // large selection stays on ONE line (the fixed-height sticky bar can't grow to
  // hold a wrapping chip run). "+N" is locale-neutral — no i18n catalog entry
  // needed. The full selection is always visible in the open list (checked rows).
  const MAX_TRIGGER_CHIPS = 2
  const shownChips    = current.slice(0, MAX_TRIGGER_CHIPS)
  const overflowCount = current.length - shownChips.length

  return (
    <MultiSelect.Root
      values={current}
      onValuesChange={(next) => set(filterKey, next.join(','))}
    >
      <MultiSelect.Trigger
        className="filter-control__multiselect"
        aria-label={t(config.label)}
        placeholder={config.emptyLabel !== undefined ? t(config.emptyLabel) : t(config.label)}
      >
        {shownChips.map((v) => (
          <MultiSelect.Chip key={v}>{labelOf(v)}</MultiSelect.Chip>
        ))}
        {overflowCount > 0 && (
          <MultiSelect.Chip className="ui-multiselect__chip--count">+{overflowCount}</MultiSelect.Chip>
        )}
      </MultiSelect.Trigger>
      <MultiSelect.Content>
        {options.map((opt) => {
          const v = String(opt.value)
          return (
            <MultiSelect.Item key={v} value={v}>
              {t(opt.label)}
            </MultiSelect.Item>
          )
        })}
      </MultiSelect.Content>
    </MultiSelect.Root>
  )
}
