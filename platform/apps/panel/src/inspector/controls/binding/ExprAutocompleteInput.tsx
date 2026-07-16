// ── ExprAutocompleteInput — the schema-aware, accessible expr editor (Retool-class) ─
//
//  A WCAG-2.1 combobox (Law 9) over the binding expr <input>: as the author types a
//  bare identifier, a listbox suggests the GOVERNED nouns + in-scope refs + operators
//  the vocabulary offers; picking one inserts the resolvable token at the caret. An
//  author who ignores it and types a valid expr is unaffected (additive, OCP) — the
//  combobox is a discovery aid layered over the SAME controlled string value.
//
//  ARIA (combobox + listbox pattern): the input owns role=combobox, aria-expanded,
//  aria-controls, aria-autocomplete=list, aria-activedescendant; each option is a
//  role=option with aria-selected. Keyboard: ↓/↑ navigate, Enter/Tab accept, Esc close.
//
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  rankSuggestions,
  tokenAtCaret,
  applySuggestion,
  type BindSuggestion,
} from './bindSuggestions'
import './ExprAutocompleteInput.css'

export interface ExprAutocompleteInputProps {
  id:         string
  value:      string
  onChange:   (next: string) => void
  vocabulary: BindSuggestion[]
  placeholder?: string
  'aria-describedby'?: string
}

export function ExprAutocompleteInput({
  id,
  value,
  onChange,
  vocabulary,
  placeholder,
  'aria-describedby': describedBy,
}: ExprAutocompleteInputProps) {
  const inputRef  = useRef<HTMLInputElement>(null)
  const listId    = useId()
  const optionId  = (i: number) => `${listId}-opt-${i}`

  const [open, setOpen]     = useState(false)
  const [caret, setCaret]   = useState(value.length)
  const [active, setActive] = useState(0)
  // A pending caret to restore imperatively after an insert (controlled value change).
  const pendingCaret = useRef<number | null>(null)

  const token = useMemo(() => tokenAtCaret(value, caret).token, [value, caret])
  const matches = useMemo(() => rankSuggestions(vocabulary, token), [vocabulary, token])

  // Clamp the active option into range DURING render (the match list shrinks as the
  // author types) — never via a setState effect (avoids cascading renders).
  const activeIdx = active >= matches.length ? 0 : active

  // Restore the caret after an insert wrote a new controlled value.
  useEffect(() => {
    if (pendingCaret.current != null && inputRef.current) {
      const pos = pendingCaret.current
      inputRef.current.setSelectionRange(pos, pos)
      pendingCaret.current = null
    }
  })

  const syncCaret = () => {
    const pos = inputRef.current?.selectionStart ?? value.length
    setCaret(pos)
  }

  const pick = (s: BindSuggestion) => {
    const res = applySuggestion(value, caret, s.insert)
    pendingCaret.current = res.caret
    setCaret(res.caret)
    onChange(res.next)
    setOpen(false)
    inputRef.current?.focus()
  }

  const showList = open && matches.length > 0

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) { setOpen(true); return }
      setActive((a) => Math.min(a + 1, matches.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      if (showList && matches[activeIdx]) { e.preventDefault(); pick(matches[activeIdx]) }
    } else if (e.key === 'Tab') {
      if (showList && matches[activeIdx]) { e.preventDefault(); pick(matches[activeIdx]) }
    } else if (e.key === 'Escape') {
      if (open) { e.preventDefault(); setOpen(false) }
    }
  }

  return (
    <div className="insp-expr-ac">
      <input
        ref={inputRef}
        id={id}
        className="insp-bind__expr insp-expr-ac__input"
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList ? optionId(activeIdx) : undefined}
        aria-describedby={describedBy}
        spellCheck={false}
        autoComplete="off"
        placeholder={placeholder ?? 'expression — e.g. year'}
        value={value}
        onChange={(e) => {
          setOpen(true)
          // Read the caret AFTER the value applies (next tick isn't needed — the
          // event target already reflects the new selection).
          setCaret(e.target.selectionStart ?? e.target.value.length)
          onChange(e.target.value)
        }}
        onKeyDown={onKeyDown}
        onKeyUp={syncCaret}
        onClick={() => { syncCaret(); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      />
      {showList && (
        <ul className="insp-expr-ac__list" id={listId} role="listbox">
          {matches.map((s, i) => (
            <li
              key={`${s.kind}:${s.insert}`}
              id={optionId(i)}
              role="option"
              aria-selected={i === activeIdx}
              className={`insp-expr-ac__opt${i === activeIdx ? ' is-active' : ''}`}
              // mousedown fires before blur — pick without losing the input focus.
              onMouseDown={(e) => { e.preventDefault(); pick(s) }}
              onMouseEnter={() => setActive(i)}
            >
              <span className={`insp-expr-ac__kind insp-expr-ac__kind--${s.kind}`}>{s.detail}</span>
              <span className="insp-expr-ac__label">{s.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
