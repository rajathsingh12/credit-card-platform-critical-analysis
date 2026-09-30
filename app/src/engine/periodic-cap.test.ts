import { describe, it, expect } from 'vitest'
import { periodKey, applyPeriodicCap } from './periodic-cap'
import type { PeriodicCapConfig, PeriodicUsageEntry } from './types'

const monthly: PeriodicCapConfig = { period: 'monthly', maxPoints: 1000, resetBasis: 'calendar', timezone: 'Asia/Kolkata' }
const quarterly: PeriodicCapConfig = { period: 'quarterly', maxPoints: 3000, resetBasis: 'calendar', timezone: 'Asia/Kolkata' }
const annual: PeriodicCapConfig = { period: 'annual', maxPoints: 10000, resetBasis: 'calendar', timezone: 'Asia/Kolkata' }

// --- periodKey ---

describe('periodKey', () => {
  it('monthly → YYYY-MM', () => {
    expect(periodKey('2024-06-15', monthly)).toBe('2024-06')
  })

  it('monthly January', () => {
    expect(periodKey('2024-01-01', monthly)).toBe('2024-01')
  })

  it('monthly December', () => {
    expect(periodKey('2024-12-31', monthly)).toBe('2024-12')
  })

  it('quarterly Q1 (Jan)', () => {
    expect(periodKey('2024-01-15', quarterly)).toBe('2024-Q1')
  })

  it('quarterly Q1 (Mar)', () => {
    expect(periodKey('2024-03-31', quarterly)).toBe('2024-Q1')
  })

  it('quarterly Q2 (Apr)', () => {
    expect(periodKey('2024-04-01', quarterly)).toBe('2024-Q2')
  })

  it('quarterly Q3 (Sep)', () => {
    expect(periodKey('2024-09-30', quarterly)).toBe('2024-Q3')
  })

  it('quarterly Q4 (Dec)', () => {
    expect(periodKey('2024-12-25', quarterly)).toBe('2024-Q4')
  })

  it('annual → YYYY', () => {
    expect(periodKey('2024-07-04', annual)).toBe('2024')
  })
})

// --- applyPeriodicCap ---

describe('applyPeriodicCap', () => {
  it('missing usage → missing-usage', () => {
    const result = applyPeriodicCap(100, monthly, undefined, '2024-06')
    expect(result.status).toBe('missing-usage')
    if (result.status === 'missing-usage') {
      expect(result.periodKey).toBe('2024-06')
    }
  })

  it('usage for wrong period → missing-usage', () => {
    const usage: PeriodicUsageEntry = { periodKey: '2024-05', pointsUsed: 500, trusted: true }
    const result = applyPeriodicCap(100, monthly, usage, '2024-06')
    expect(result.status).toBe('missing-usage')
  })

  it('untrusted usage → untrusted', () => {
    const usage: PeriodicUsageEntry = { periodKey: '2024-06', pointsUsed: 800, trusted: false }
    const result = applyPeriodicCap(100, monthly, usage, '2024-06')
    expect(result.status).toBe('untrusted')
    if (result.status === 'untrusted') {
      expect(result.priorUsage).toBe(800)
      expect(result.remaining).toBe(200)
    }
  })

  it('trusted usage with remaining capacity → caps to remaining', () => {
    const usage: PeriodicUsageEntry = { periodKey: '2024-06', pointsUsed: 900, trusted: true }
    // 300 earned this txn, but only 100 remaining
    const result = applyPeriodicCap(300, monthly, usage, '2024-06')
    expect(result.status).toBe('applied')
    if (result.status === 'applied') {
      expect(result.pointsAfterPeriodicCap).toBe(100)
      expect(result.priorUsage).toBe(900)
      expect(result.remaining).toBe(100)
    }
  })

  it('trusted usage under cap → earns full points', () => {
    const usage: PeriodicUsageEntry = { periodKey: '2024-06', pointsUsed: 0, trusted: true }
    const result = applyPeriodicCap(300, monthly, usage, '2024-06')
    expect(result.status).toBe('applied')
    if (result.status === 'applied') {
      expect(result.pointsAfterPeriodicCap).toBe(300)
      expect(result.remaining).toBe(1000)
    }
  })

  it('exactly at cap → earns zero', () => {
    const usage: PeriodicUsageEntry = { periodKey: '2024-06', pointsUsed: 1000, trusted: true }
    const result = applyPeriodicCap(300, monthly, usage, '2024-06')
    expect(result.status).toBe('applied')
    if (result.status === 'applied') {
      expect(result.pointsAfterPeriodicCap).toBe(0)
      expect(result.remaining).toBe(0)
    }
  })

  it('usage exceeds cap (stale data) → earns zero, remaining clamped to 0', () => {
    const usage: PeriodicUsageEntry = { periodKey: '2024-06', pointsUsed: 1200, trusted: true }
    const result = applyPeriodicCap(300, monthly, usage, '2024-06')
    expect(result.status).toBe('applied')
    if (result.status === 'applied') {
      expect(result.pointsAfterPeriodicCap).toBe(0)
      expect(result.remaining).toBe(0)
    }
  })

  it('txnCap already 0 → earns zero regardless of remaining', () => {
    const usage: PeriodicUsageEntry = { periodKey: '2024-06', pointsUsed: 0, trusted: true }
    const result = applyPeriodicCap(0, monthly, usage, '2024-06')
    expect(result.status).toBe('applied')
    if (result.status === 'applied') {
      expect(result.pointsAfterPeriodicCap).toBe(0)
    }
  })
})
