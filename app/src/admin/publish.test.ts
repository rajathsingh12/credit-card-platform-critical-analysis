import { describe, it, expect } from 'vitest'
import { validateEffectiveFrom, validateEvidenceStandard } from './publish'

describe('validateEffectiveFrom', () => {
  it('accepts an ISO calendar date', () => {
    expect(validateEffectiveFrom('2025-01-01')).toEqual({ ok: true })
  })

  it('rejects a missing value', () => {
    expect(validateEffectiveFrom(undefined).ok).toBe(false)
    expect(validateEffectiveFrom(null).ok).toBe(false)
  })

  it('rejects a non-string', () => {
    expect(validateEffectiveFrom(20250101).ok).toBe(false)
  })

  it('rejects a wrongly formatted date', () => {
    expect(validateEffectiveFrom('01-01-2025').ok).toBe(false)
    expect(validateEffectiveFrom('2025-1-1').ok).toBe(false)
  })

  it('rejects a date that does not exist', () => {
    expect(validateEffectiveFrom('2025-02-30').ok).toBe(false)
    expect(validateEffectiveFrom('2025-13-01').ok).toBe(false)
  })
})

describe('validateEvidenceStandard', () => {
  it('accepts officially-documented', () => {
    expect(validateEvidenceStandard('officially-documented')).toEqual({ ok: true })
  })

  it('accepts statement-verified', () => {
    expect(validateEvidenceStandard('statement-verified')).toEqual({ ok: true })
  })

  it('rejects inferred', () => {
    const result = validateEvidenceStandard('inferred')
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.error).toMatch(/inferred/)
  })

  it('rejects community-reported', () => {
    expect(validateEvidenceStandard('community-reported').ok).toBe(false)
  })

  it('rejects a missing evidence status', () => {
    expect(validateEvidenceStandard(null).ok).toBe(false)
  })

  it('rejects an unrecognised evidence status', () => {
    expect(validateEvidenceStandard('vibes').ok).toBe(false)
  })
})
