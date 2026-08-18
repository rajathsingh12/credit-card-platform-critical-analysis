import { describe, it, expect } from 'vitest'
import {
  isPublishable,
  classifyFeeBand,
  isIssuerOwnedUrl,
  validateEvidence,
  ISSUER_DOMAINS,
} from './evidence'

describe('isPublishable', () => {
  it('accepts officially-documented', () => {
    expect(isPublishable('officially-documented')).toBe(true)
  })

  it('accepts statement-verified', () => {
    expect(isPublishable('statement-verified')).toBe(true)
  })

  it('rejects inferred', () => {
    expect(isPublishable('inferred')).toBe(false)
  })

  it('rejects community-reported', () => {
    expect(isPublishable('community-reported')).toBe(false)
  })
})

describe('classifyFeeBand', () => {
  it('treats a null fee as no-fee', () => {
    expect(classifyFeeBand(null)).toBe('no-fee')
  })

  it('treats a zero fee as no-fee', () => {
    expect(classifyFeeBand(0)).toBe('no-fee')
  })

  it('treats any fee below the premium threshold as mid-tier', () => {
    expect(classifyFeeBand(1)).toBe('mid-tier')
    expect(classifyFeeBand(49900)).toBe('mid-tier')
    expect(classifyFeeBand(499999)).toBe('mid-tier')
  })

  it('treats the premium threshold and above as premium', () => {
    expect(classifyFeeBand(500000)).toBe('premium')
    expect(classifyFeeBand(6000000)).toBe('premium')
  })
})

describe('isIssuerOwnedUrl', () => {
  it('matches the issuer apex domain', () => {
    expect(isIssuerOwnedUrl('HDFC Bank', 'https://www.hdfcbank.com/personal/pay/cards')).toBe(true)
  })

  it('matches a subdomain of the issuer domain', () => {
    expect(isIssuerOwnedUrl('SBI Card', 'https://files.sbicard.com/terms.pdf')).toBe(true)
  })

  it('rejects a third-party domain', () => {
    expect(isIssuerOwnedUrl('HDFC Bank', 'https://technofino.in/threads/hdfc-regalia')).toBe(false)
  })

  it('rejects a lookalike domain that merely ends with the issuer name', () => {
    expect(isIssuerOwnedUrl('HDFC Bank', 'https://nothdfcbank.com/regalia')).toBe(false)
  })

  it('rejects an unknown issuer', () => {
    expect(isIssuerOwnedUrl('Bank of Nowhere', 'https://bankofnowhere.com/card')).toBe(false)
  })

  it('rejects a malformed url', () => {
    expect(isIssuerOwnedUrl('HDFC Bank', 'not a url')).toBe(false)
  })
})

describe('validateEvidence', () => {
  it('accepts officially-documented backed by the issuer domain', () => {
    expect(
      validateEvidence({
        issuer: 'Axis Bank',
        evidenceStatus: 'officially-documented',
        sourceUrl: 'https://www.axisbank.com/retail/cards/credit-card',
      })
    ).toEqual({ ok: true })
  })

  it('rejects officially-documented backed by a third-party url', () => {
    const result = validateEvidence({
      issuer: 'Axis Bank',
      evidenceStatus: 'officially-documented',
      sourceUrl: 'https://cardinsider.com/axis-magnus',
    })
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.error).toMatch(/issuer/)
  })

  it('rejects community-reported that claims an issuer url', () => {
    const result = validateEvidence({
      issuer: 'Axis Bank',
      evidenceStatus: 'community-reported',
      sourceUrl: 'https://www.axisbank.com/retail/cards/credit-card',
    })
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.error).toMatch(/community/)
  })

  it('accepts community-reported from a forum', () => {
    expect(
      validateEvidence({
        issuer: 'Axis Bank',
        evidenceStatus: 'community-reported',
        sourceUrl: 'https://www.technofino.in/community/threads/axis-magnus',
      })
    ).toEqual({ ok: true })
  })

  it('accepts statement-verified from any origin', () => {
    expect(
      validateEvidence({
        issuer: 'Axis Bank',
        evidenceStatus: 'statement-verified',
        sourceUrl: 'https://www.axisbank.com/statement-sample',
      })
    ).toEqual({ ok: true })
  })

  it('rejects a non-https url', () => {
    const result = validateEvidence({
      issuer: 'Axis Bank',
      evidenceStatus: 'statement-verified',
      sourceUrl: 'http://www.axisbank.com/insecure',
    })
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.error).toMatch(/https/)
  })

  it('rejects a malformed url', () => {
    const result = validateEvidence({
      issuer: 'Axis Bank',
      evidenceStatus: 'statement-verified',
      sourceUrl: 'axisbank',
    })
    expect(result.ok).toBe(false)
  })
})

describe('ISSUER_DOMAINS', () => {
  it('covers at least five issuers', () => {
    expect(Object.keys(ISSUER_DOMAINS).length).toBeGreaterThanOrEqual(5)
  })

  it('stores bare hostnames, not urls', () => {
    for (const domain of Object.values(ISSUER_DOMAINS)) {
      expect(domain).not.toMatch(/[:/]/)
    }
  })
})
