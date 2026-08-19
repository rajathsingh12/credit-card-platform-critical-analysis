import { describe, it, expect } from 'vitest'
import { validateCalculateInput } from './validate'

describe('validateCalculateInput', () => {
  const valid = {
    cardId: 'card-uuid',
    amountRupees: 500,
    merchantName: 'Swiggy',
    merchantCategory: 'dining',
    transactionDate: '2025-06-15',
  }

  it('accepts a fully valid body', () => {
    const r = validateCalculateInput(valid)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.amountRupees).toBe(500)
      expect(r.data).not.toHaveProperty('paymentChannel')
      expect(r.data).not.toHaveProperty('mtdSpend')
    }
  })

  it('accepts a missing merchantName (optional)', () => {
    const { merchantName: _, ...rest } = valid
    const r = validateCalculateInput(rest)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.merchantName).toBe('')
  })

  it('rejects null body', () => {
    expect(validateCalculateInput(null)).toMatchObject({ ok: false })
  })

  it('rejects missing cardId', () => {
    const r = validateCalculateInput({ ...valid, cardId: undefined })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/cardId/)
  })

  it('rejects zero amount', () => {
    const r = validateCalculateInput({ ...valid, amountRupees: 0 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/amountRupees/)
  })

  it('rejects negative amount', () => {
    const r = validateCalculateInput({ ...valid, amountRupees: -10 })
    expect(r.ok).toBe(false)
  })

  it('rejects missing merchantCategory', () => {
    const r = validateCalculateInput({ ...valid, merchantCategory: '' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/merchantCategory/)
  })

  it('rejects a malformed transactionDate', () => {
    const r = validateCalculateInput({ ...valid, transactionDate: '15-06-2025' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/transactionDate/)
  })

  it('rejects a missing transactionDate', () => {
    const r = validateCalculateInput({ ...valid, transactionDate: undefined })
    expect(r.ok).toBe(false)
  })
})
