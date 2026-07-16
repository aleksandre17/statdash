// ── MultiSelect — the owned Radix surface (foundation pattern #1, plural) ─────
//
//  The multi-value sibling of `Select`: an OWNED compound component = unstyled
//  Radix behavior + DTCG-token CSS + a compound API. Radix Select is inherently
//  single-value, so the primitive here is `DropdownMenu` with `CheckboxItem`s —
//  the WAI-ARIA menu pattern Radix ships (roving tabindex, typeahead, keyboard
//  open/dismiss, focus return, `aria-checked` per item) that we must never
//  re-implement. Toggling an item does NOT dismiss the menu (`onSelect`
//  preventDefault — the standard multi-select gesture: pick several, Esc/outside
//  to close). This is a BOUNDED ELEMENT (ADR-038) at the component scale: it
//  hides which primitive it wraps; consumers see `MultiSelect.Root/Trigger/
//  Content/Item/Chip`, never `radix-ui`.
//
//  Home is `packages/react` (the app-agnostic React adapter), NOT a shell/app —
//  any tenant (geostat filter bar, panel inspector, runner chrome) reuses and
//  restyles it for free. Radix is a legitimate dependency of this layer.
//
//  Contract: controlled — `values: string[]` in, `onValuesChange(next)` out.
//  The consumer owns encoding (e.g. the ctx CSV OR-set join/split) and owns the
//  trigger summary (chips) — labels live with the consumer's options, so the
//  trigger renders `children` (chips / summary) or the `placeholder`. Painted
//  ONLY by design tokens; guarded by FF-RADIX-TOKEN-ONLY (the ui/** scan) +
//  its own a11y fitness (menu role + keyboard + aria-checked).
//
import { createContext, forwardRef, useContext, useMemo } from 'react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { DropdownMenu as RadixMenu } from 'radix-ui'
import './MultiSelect.css'

// ── Owned glyphs — the component paints its own chevron/check (no icon-lib
//    coupling). Sized in `em` so they track the trigger/item font-size. ────────
function ChevronDownGlyph() {
  return (
    <svg
      viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

function CheckGlyph() {
  return (
    <svg
      viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

const cx = (...parts: Array<string | undefined | false>) => parts.filter(Boolean).join(' ')

// ── Value context — Root holds the controlled selection; Items read/toggle it. ─
interface MultiSelectContextValue {
  values:   readonly string[]
  toggle:   (value: string) => void
}
const MultiSelectContext = createContext<MultiSelectContextValue | null>(null)

function useMultiSelectContext(part: string): MultiSelectContextValue {
  const ctx = useContext(MultiSelectContext)
  if (!ctx) throw new Error(`MultiSelect.${part} must be used inside MultiSelect.Root`)
  return ctx
}

// ── Root — controlled value container + the Radix menu root. ──────────────────
interface RootProps {
  /** The selected values (controlled). */
  values:         readonly string[]
  /** Receives the next selection on every toggle. */
  onValuesChange: (next: string[]) => void
  /** Controlled open state (optional — uncontrolled by default). */
  open?:          boolean
  onOpenChange?:  (open: boolean) => void
  children:       ReactNode
}

function Root({ values, onValuesChange, open, onOpenChange, children }: RootProps) {
  const ctx = useMemo<MultiSelectContextValue>(() => ({
    values,
    toggle: (value) => {
      onValuesChange(
        values.includes(value) ? values.filter((v) => v !== value) : [...values, value],
      )
    },
  }), [values, onValuesChange])

  return (
    <MultiSelectContext.Provider value={ctx}>
      {/* modal=false — a filter control never traps page scroll/interaction. */}
      <RadixMenu.Root open={open} onOpenChange={onOpenChange} modal={false}>
        {children}
      </RadixMenu.Root>
    </MultiSelectContext.Provider>
  )
}

// ── Trigger — the closed control: consumer summary (chips) or placeholder +
//    chevron. A real <button>; Radix stamps aria-haspopup/expanded + data-state. ─
interface TriggerProps extends ComponentPropsWithoutRef<'button'> {
  /** Shown when nothing is selected (or no children given). */
  placeholder?: ReactNode
}

const Trigger = forwardRef<HTMLButtonElement, TriggerProps>(function Trigger(
  { placeholder, className, children, ...rest }, ref,
) {
  const { values } = useMultiSelectContext('Trigger')
  const empty = values.length === 0
  return (
    <RadixMenu.Trigger asChild>
      <button
        ref={ref}
        type="button"
        className={cx('ui-multiselect__trigger', className)}
        data-placeholder={empty && placeholder != null ? '' : undefined}
        {...rest}
      >
        <span className="ui-multiselect__value">
          {empty ? placeholder : children ?? placeholder}
        </span>
        <span className="ui-multiselect__icon" aria-hidden="true">
          <ChevronDownGlyph />
        </span>
      </button>
    </RadixMenu.Trigger>
  )
})

// ── Content — the portalled option surface: popper-positioned, width-matched
//    to the trigger via the Radix CSS var the stylesheet binds. ────────────────
type ContentProps = ComponentPropsWithoutRef<typeof RadixMenu.Content>

const Content = forwardRef<HTMLDivElement, ContentProps>(function Content(
  { className, children, sideOffset = 6, align = 'start', ...rest }, ref,
) {
  return (
    <RadixMenu.Portal>
      <RadixMenu.Content
        ref={ref}
        sideOffset={sideOffset}
        align={align}
        className={cx('ui-multiselect__content', className)}
        {...rest}
      >
        <div className="ui-multiselect__viewport">{children}</div>
      </RadixMenu.Content>
    </RadixMenu.Portal>
  )
})

// ── Item — one toggleable option (Radix CheckboxItem: aria-checked + roving
//    highlight). Selecting toggles WITHOUT dismissing — the multi-select gesture. ─
interface ItemProps extends Omit<
  ComponentPropsWithoutRef<typeof RadixMenu.CheckboxItem>,
  'checked' | 'onCheckedChange' | 'onSelect'
> {
  /** The option's value — membership in Root's `values` = checked. */
  value: string
}

const Item = forwardRef<HTMLDivElement, ItemProps>(function Item(
  { value, className, children, ...rest }, ref,
) {
  const { values, toggle } = useMultiSelectContext('Item')
  return (
    <RadixMenu.CheckboxItem
      ref={ref}
      checked={values.includes(value)}
      onCheckedChange={() => toggle(value)}
      // Keep the menu OPEN across toggles — Esc/outside-click closes it.
      onSelect={(e) => e.preventDefault()}
      className={cx('ui-multiselect__item', className)}
      {...rest}
    >
      <span className="ui-multiselect__checkbox" aria-hidden="true">
        <RadixMenu.ItemIndicator className="ui-multiselect__indicator">
          <CheckGlyph />
        </RadixMenu.ItemIndicator>
      </span>
      <span className="ui-multiselect__item-text">{children}</span>
    </RadixMenu.CheckboxItem>
  )
})

// ── Chip — a presentational selected-value token for the trigger summary.
//    Deliberately NON-interactive (no nested button inside the trigger button —
//    WCAG): deselection happens by unchecking in the open list. ────────────────
function Chip({ className, children, ...rest }: ComponentPropsWithoutRef<'span'>) {
  return (
    <span className={cx('ui-multiselect__chip', className)} {...rest}>
      {children}
    </span>
  )
}

/**
 * The owned compound `MultiSelect` — Radix menu behavior on the DTCG token spine.
 *
 * ```tsx
 * <MultiSelect.Root values={vals} onValuesChange={setVals}>
 *   <MultiSelect.Trigger aria-label="Sectors" placeholder="—">
 *     {vals.map((v) => <MultiSelect.Chip key={v}>{labelOf(v)}</MultiSelect.Chip>)}
 *   </MultiSelect.Trigger>
 *   <MultiSelect.Content>
 *     <MultiSelect.Item value="C">Manufacturing</MultiSelect.Item>
 *   </MultiSelect.Content>
 * </MultiSelect.Root>
 * ```
 */
export const MultiSelect = { Root, Trigger, Content, Item, Chip }
