import { describe, it, expect } from 'vitest'
import { registerExport, getExportFormat, listExportFormats } from './registry'

// Trigger built-in registration side-effects
import './index'

describe('export registry — contract', () => {
  it('built-in formats csv and sdmx-json are registered', () => {
    const formats = listExportFormats()
    expect(formats).toContain('csv')
    expect(formats).toContain('sdmx-json')
  })

  it('each built-in format has required fields', () => {
    for (const id of ['csv', 'sdmx-json']) {
      const fmt = getExportFormat(id)
      expect(fmt, `format '${id}' should be registered`).toBeDefined()
      expect(typeof fmt!.mime,      `'${id}'.mime`     ).toBe('string')
      expect(typeof fmt!.ext,       `'${id}'.ext`      ).toBe('string')
      expect(typeof fmt!.label,     `'${id}'.label`    ).toBe('string')
      expect(typeof fmt!.serialize, `'${id}'.serialize`).toBe('function')
    }
  })

  it('registering a new format makes it available', () => {
    const stub = {
      mime:      'application/octet-stream',
      ext:       'bin',
      label:     'Binary',
      serialize: () => '',
    }
    registerExport('__test_bin__', stub)
    expect(getExportFormat('__test_bin__')).toBe(stub)
    expect(listExportFormats()).toContain('__test_bin__')
  })

  it('registering an existing id overwrites the previous handler (last-write-wins)', () => {
    const first  = { mime: 'text/plain', ext: 'txt', label: 'First',  serialize: () => 'first'  }
    const second = { mime: 'text/plain', ext: 'txt', label: 'Second', serialize: () => 'second' }
    registerExport('__test_overwrite__', first)
    registerExport('__test_overwrite__', second)
    expect(getExportFormat('__test_overwrite__')!.serialize([], {})).toBe('second')
  })
})
