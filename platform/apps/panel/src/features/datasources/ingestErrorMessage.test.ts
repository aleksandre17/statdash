// ── ingestErrorMessage.test — every RFC 9457 code → a friendly, mapped message ─
//
//  The error-contract mapping is pure, so it is pinned directly: each known `code`
//  yields its own specific message + (for PARSE_ISSUES) the per-issue lines; an
//  unknown code degrades to the server's own detail (never a raw blob); an
//  AuthError names the session; a bare Error keeps its message.
//
import { describe, it, expect } from 'vitest'
import { ingestErrorMessage, parseDsdChange } from './ingestErrorMessage'
import { IngestProblem } from '../../lib/ingestApi'
import { AuthError } from '../../lib/auth'

const problem = (status: number, body: Record<string, unknown>) =>
  new IngestProblem(status, { type: 't', title: 'T', status, ...body }, 'fallback')

describe('ingestErrorMessage', () => {
  it('PARSE_ISSUES → headline + per-issue lines', () => {
    const r = ingestErrorMessage(problem(400, {
      code: 'PARSE_ISSUES',
      parseIssues: [{ sheet: 'DATA', message: 'no header' }, { message: 'bad cell' }],
    }))
    expect(r.message).toMatch(/სტრუქტურა არასწორია/)
    expect(r.lines).toEqual(['DATA: no header', 'bad cell'])
  })

  it('DSD_INCOMPATIBLE → names the structure-change reason', () => {
    const r = ingestErrorMessage(problem(400, { code: 'DSD_INCOMPATIBLE', reason: 'dim removed' }))
    expect(r.message).toMatch(/ახალი ვერსია/)
    expect(r.message).toMatch(/dim removed/)
  })

  it('DSD_INCOMPATIBLE with a dimension diff → carries the parsed versionable change', () => {
    const r = ingestErrorMessage(problem(400, {
      code: 'DSD_INCOMPATIBLE',
      datasetCode: 'GDP_BY_SECTOR',
      dimensionsBefore: ['time', 'sector'],
      dimensionsAfter: ['time', 'sector', 'approach'],
      reason: 'richer DSD',
      versioned: false,
    }))
    expect(r.dsdChange).toBeDefined()
    expect(r.dsdChange?.datasetCode).toBe('GDP_BY_SECTOR')
    expect(r.dsdChange?.added).toEqual(['approach'])
    expect(r.dsdChange?.removed).toEqual([])
  })

  it('DSD_INCOMPATIBLE without the diff shape → no dsdChange (flat headline only)', () => {
    const r = ingestErrorMessage(problem(400, { code: 'DSD_INCOMPATIBLE', reason: 'dim removed' }))
    expect(r.dsdChange).toBeUndefined()
  })

  it('ALREADY_PUBLISHED → duplicate message', () => {
    expect(ingestErrorMessage(problem(409, { code: 'ALREADY_PUBLISHED' })).message)
      .toMatch(/უკვე ჩატვირთულია/)
  })

  it('EMPTY_WORKBOOK → no-data message', () => {
    expect(ingestErrorMessage(problem(400, { code: 'EMPTY_WORKBOOK' })).message)
      .toMatch(/ვერ მოიძებნა/)
  })

  it('an unknown code surfaces the server detail, not a blob', () => {
    const r = ingestErrorMessage(problem(400, { code: 'SOME_NEW_CODE', detail: 'specific reason' }))
    expect(r.message).toBe('specific reason')
    expect(r.lines).toEqual([])
  })

  it('AuthError → a session message', () => {
    expect(ingestErrorMessage(new AuthError(401, 'x')).message).toMatch(/სესია/)
  })

  it('a bare Error keeps its message', () => {
    expect(ingestErrorMessage(new Error('boom')).message).toBe('boom')
  })

  it('a non-error value gets a safe generic fallback', () => {
    expect(ingestErrorMessage('weird').message).toMatch(/ვერ მოხერხდა/)
  })
})

describe('parseDsdChange', () => {
  const body = (b: Record<string, unknown>) => ({ type: 't', title: 'T', status: 400, ...b })

  it('diffs after − before into added / removed dimension sets', () => {
    const c = parseDsdChange(body({
      datasetCode: 'D', dimensionsBefore: ['a', 'b'], dimensionsAfter: ['a', 'c'],
    }))
    expect(c).not.toBeNull()
    expect(c?.added).toEqual(['c'])
    expect(c?.removed).toEqual(['b'])
  })

  it('returns null when neither dimension list is present (nothing to version)', () => {
    expect(parseDsdChange(body({ datasetCode: 'D', reason: 'x' }))).toBeNull()
  })

  it('returns null without a datasetCode (cannot target a version)', () => {
    expect(parseDsdChange(body({ dimensionsAfter: ['a'] }))).toBeNull()
  })
})
