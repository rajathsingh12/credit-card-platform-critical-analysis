import { describe, it, expect } from 'vitest'
import { isPendingLead, validateLeadForApproval, validateLeadForRejection } from './gate'

describe('isPendingLead', () => {
  it('returns true only for a pending lead', () => {
    expect(isPendingLead({ status: 'pending' })).toBe(true)
    expect(isPendingLead({ status: 'approved' })).toBe(false)
    expect(isPendingLead({ status: 'rejected' })).toBe(false)
  })
})

describe('validateLeadForApproval', () => {
  it('returns ok for a pending lead with verification attached', () => {
    const result = validateLeadForApproval({
      status: 'pending',
      verification_record_id: 'vr-uuid',
    })
    expect(result).toEqual({ ok: true })
  })

  it('fails when lead is already approved', () => {
    const result = validateLeadForApproval({
      status: 'approved',
      verification_record_id: 'vr-uuid',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('approved')
  })

  it('fails when lead is rejected', () => {
    const result = validateLeadForApproval({
      status: 'rejected',
      verification_record_id: 'vr-uuid',
    })
    expect(result.ok).toBe(false)
  })

  it('fails when verification_record_id is null', () => {
    const result = validateLeadForApproval({
      status: 'pending',
      verification_record_id: null,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('verification record')
  })
})

describe('validateLeadForRejection', () => {
  it('returns ok for a pending lead with a non-empty reason', () => {
    const result = validateLeadForRejection({ status: 'pending' }, 'outdated source')
    expect(result).toEqual({ ok: true })
  })

  it('fails when lead is not pending', () => {
    const result = validateLeadForRejection({ status: 'approved' }, 'some reason')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('approved')
  })

  it('fails when reason is an empty string', () => {
    const result = validateLeadForRejection({ status: 'pending' }, '')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('required')
  })

  it('fails when reason is whitespace only', () => {
    const result = validateLeadForRejection({ status: 'pending' }, '   ')
    expect(result.ok).toBe(false)
  })

  it('fails when reason is not a string', () => {
    const result = validateLeadForRejection({ status: 'pending' }, undefined)
    expect(result.ok).toBe(false)
  })
})
