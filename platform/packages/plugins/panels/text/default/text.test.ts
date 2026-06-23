// @vitest-environment node
//
// ── Text panel — pure logic unit tests ───────────────────────────────
//
// Tests the micro-renderer and sanitiser in isolation (no React, no DOM).
// Shell rendering smoke tests live in text.render.test.tsx (jsdom).

import { describe, it, expect } from 'vitest'
import { renderMarkdown, sanitise, inlineMarkdown } from './textUtils'

// ── renderMarkdown ─────────────────────────────────────────────────────

describe('renderMarkdown', () => {
  it('renders a heading', () => {
    expect(renderMarkdown('# Hello')).toContain('<h1>Hello</h1>')
  })

  it('renders h2 and h3', () => {
    expect(renderMarkdown('## Section')).toContain('<h2>Section</h2>')
    expect(renderMarkdown('### Sub')).toContain('<h3>Sub</h3>')
  })

  it('renders a paragraph', () => {
    expect(renderMarkdown('Some text')).toContain('<p>Some text</p>')
  })

  it('renders a bullet list', () => {
    const out = renderMarkdown('- Alpha\n- Beta')
    expect(out).toContain('<ul>')
    expect(out).toContain('<li>Alpha</li>')
    expect(out).toContain('<li>Beta</li>')
    expect(out).toContain('</ul>')
  })

  it('closes the list before a following paragraph', () => {
    const out = renderMarkdown('- Item\n\nNext paragraph')
    const listClose = out.indexOf('</ul>')
    const para      = out.indexOf('<p>Next paragraph</p>')
    expect(listClose).toBeGreaterThan(-1)
    expect(para).toBeGreaterThan(listClose)
  })

  it('handles inline bold inside a paragraph', () => {
    expect(renderMarkdown('**bold** text')).toContain('<strong>bold</strong>')
  })

  it('handles inline italic', () => {
    expect(renderMarkdown('*italic* text')).toContain('<em>italic</em>')
  })

  it('handles inline code', () => {
    expect(renderMarkdown('Use `foo()` here')).toContain('<code>foo()</code>')
  })

  it('handles inline link', () => {
    const out = renderMarkdown('[Go here](https://example.com)')
    expect(out).toContain('<a href="https://example.com"')
    expect(out).toContain('Go here</a>')
  })
})

// ── inlineMarkdown ─────────────────────────────────────────────────────

describe('inlineMarkdown', () => {
  it('converts **bold**', () => {
    expect(inlineMarkdown('**foo**')).toBe('<strong>foo</strong>')
  })

  it('converts *italic*', () => {
    expect(inlineMarkdown('*bar*')).toBe('<em>bar</em>')
  })

  it('converts `code`', () => {
    expect(inlineMarkdown('`baz`')).toBe('<code>baz</code>')
  })

  it('converts [label](url)', () => {
    expect(inlineMarkdown('[label](https://x.com)')).toContain('href="https://x.com"')
  })

  it('passes plain text unchanged', () => {
    expect(inlineMarkdown('plain text')).toBe('plain text')
  })
})

// ── sanitise ──────────────────────────────────────────────────────────

describe('sanitise', () => {
  it('strips <script> tags and content', () => {
    const out = sanitise('<p>ok</p><script>alert(1)</script>')
    expect(out).not.toContain('<script>')
    expect(out).not.toContain('alert(1)')
    expect(out).toContain('<p>ok</p>')
  })

  it('strips <style> tags and content', () => {
    const out = sanitise('<p>ok</p><style>body{color:red}</style>')
    expect(out).not.toContain('<style>')
    expect(out).toContain('<p>ok</p>')
  })

  it('strips disallowed tags (e.g. <div>)', () => {
    const out = sanitise('<div><p>text</p></div>')
    expect(out).not.toContain('<div>')
    expect(out).toContain('<p>text</p>')
  })

  it('strips inline event handlers', () => {
    const out = sanitise('<p onclick="alert(1)">text</p>')
    expect(out).not.toContain('onclick')
  })

  it('strips javascript: href on <a>', () => {
    const out = sanitise('<a href="javascript:alert(1)">click</a>')
    expect(out).not.toContain('javascript:')
  })

  it('preserves safe tags: h1–h3, ul, li, strong, em, code, a', () => {
    const html = '<h1>T</h1><ul><li>x</li></ul><strong>b</strong><em>i</em><code>c</code>'
    const out  = sanitise(html)
    expect(out).toContain('<h1>T</h1>')
    expect(out).toContain('<ul>')
    expect(out).toContain('<li>x</li>')
    expect(out).toContain('<strong>b</strong>')
    expect(out).toContain('<em>i</em>')
    expect(out).toContain('<code>c</code>')
  })
})
