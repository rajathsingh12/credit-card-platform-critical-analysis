import { describe, it, expect } from 'vitest'
import { generateInviteCode, isValidCodeFormat } from './invite'

describe('generateInviteCode', () => {
  it('returns a 24-char hex string', () => {
    expect(generateInviteCode()).toMatch(/^[0-9a-f]{24}$/)
  })

  it('returns unique values', () => {
    expect(generateInviteCode()).not.toBe(generateInviteCode())
  })
})

describe('isValidCodeFormat', () => {
  it('accepts valid 24-char hex', () => {
    expect(isValidCodeFormat('a'.repeat(24))).toBe(true)
    expect(isValidCodeFormat('0123456789abcdef01234567')).toBe(true)
  })

  it('rejects non-hex chars', () => {
    expect(isValidCodeFormat('z'.repeat(24))).toBe(false)
  })

  it('rejects wrong length', () => {
    expect(isValidCodeFormat('abc')).toBe(false)
    expect(isValidCodeFormat('a'.repeat(25))).toBe(false)
  })

  it('rejects non-string', () => {
    expect(isValidCodeFormat(123)).toBe(false)
    expect(isValidCodeFormat(null)).toBe(false)
    expect(isValidCodeFormat(undefined)).toBe(false)
  })
})
