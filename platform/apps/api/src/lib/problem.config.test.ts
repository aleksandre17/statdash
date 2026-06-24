// ── configValidationProblem — RFC 9457 wire contract (ADR §5) ──────────────────
//
//  configValidationProblem wraps the engine's validateConfig result into the SAME
//  `validation` problem kind + `issues` extension as a Zod failure, so a client
//  parses ONE wire contract for every validation failure. This suite proves that
//  using the SAME shared corpus (INVALID_CONFIGS) the engine fitness test pins —
//  one corpus, three faces, no copy-drift.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  validateConfig,
  INVALID_CONFIGS,
  corpusAllTypes,
  registerNodeType,
  _resetNodeTypes,
  type ValidationError,
} from '@statdash/engine'
import { configValidationProblem } from './problem.js'
import { PROBLEM_CONTENT_TYPE, PROBLEM_URN_PREFIX } from '@statdash/contracts'

describe('configValidationProblem — application/problem+json + issues', () => {
  // The corpus VALID/UNKNOWN_NODE_TYPE cases need the registry populated exactly
  // as the engine fitness test does, so validateConfig produces the same errors.
  beforeEach(() => {
    _resetNodeTypes()
    for (const t of corpusAllTypes()) registerNodeType(t)
  })
  afterEach(() => { _resetNodeTypes() })

  it('produces the validation problem kind with the RFC 9457 type URN + 400 status', () => {
    const errors = validateConfig(INVALID_CONFIGS[0].config)
    const problem = configValidationProblem(errors)
    const body = problem.toProblemDetails('/api/config/pages')

    // Same kind/type/status/title as a Zod validation failure (one wire contract).
    expect(body.type).toBe(`${PROBLEM_URN_PREFIX}validation`)
    expect(body.status).toBe(400)
    expect(problem.status).toBe(400)
    expect(typeof body.title).toBe('string')
    // The api serializes this kind as application/problem+json (registry-owned).
    expect(PROBLEM_CONTENT_TYPE).toBe('application/problem+json')
  })

  it('carries the engine ValidationError[] as the `issues` extension member', () => {
    const errors = validateConfig(INVALID_CONFIGS[1].config)
    const body = configValidationProblem(errors).toProblemDetails()
    const issues = body.issues as ValidationError[]

    expect(Array.isArray(issues)).toBe(true)
    expect(issues.length).toBeGreaterThan(0)
    // Each issue is the engine's machine-readable shape (path/code/message/severity).
    for (const i of issues) {
      expect(typeof i.path).toBe('string')
      expect(typeof i.code).toBe('string')
      expect(typeof i.message).toBe('string')
      expect(['error', 'warning', 'info']).toContain(i.severity)
    }
  })

  it('every INVALID corpus case maps to a non-empty `issues` set (SSOT corpus)', () => {
    for (const c of INVALID_CONFIGS) {
      const issues = configValidationProblem(validateConfig(c.config))
        .toProblemDetails().issues as ValidationError[]
      expect(issues.length, `corpus case: ${c.label}`).toBeGreaterThan(0)
      // The case's documented code appears in the issues (the engine + api agree).
      expect(issues.map((i) => i.code)).toContain(c.expectCode)
    }
  })
})
