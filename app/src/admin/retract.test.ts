import { describe, it, expect } from 'vitest'
import { validateRetractionReason, validateRuleVersionForRetraction } from './retract'

describe('validateRetractionReason', () => {
  it('accepts a non-empty string', () => {
    expect(validateRetractionReason('incorrect multiplier published')).toEqual({ ok: true })
  })

  it('rejects an empty string', () => {
    expect(validateRetractionReason('').ok).toBe(false)
  })

  it('rejects a whitespace-only string', () => {
    expect(validateRetractionReason('   ').ok).toBe(false)
  })

  it('rejects null', () => {
    expect(validateRetractionReason(null).ok).toBe(false)
  })

  it('rejects undefined', () => {
    expect(validateRetractionReason(undefined).ok).toBe(false)
  })

  it('rejects a number', () => {
    expect(validateRetractionReason(42).ok).toBe(false)
  })
})

describe('validateRuleVersionForRetraction', () => {
  it('accepts an unretracted rule version', () => {
    expect(validateRuleVersionForRetraction({ retracted_at: null })).toEqual({ ok: true })
  })

  it('rejects null (not found)', () => {
    const result = validateRuleVersionForRetraction(null)
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.code).toBe('not-found')
  })

  it('rejects an already-retracted rule version', () => {
    const result = validateRuleVersionForRetraction({ retracted_at: '2026-01-01T00:00:00Z' })
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.code).toBe('already-retracted')
    expect(result.ok === false && result.error).toMatch(/already retracted/)
  })
})
