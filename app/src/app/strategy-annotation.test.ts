import { describe, it, expect } from 'vitest'
import type { ComposedStrategy } from '@/strategy/compose'
import { strategyAnnotation } from './strategy-annotation'

const trace = { transactionId: 't', entries: [] }

describe('strategyAnnotation', () => {
  it('labels a resolved strategy as an optimization on the same card and shows its value', () => {
    const strategy: ComposedStrategy = {
      resolved: true, strategyId: 'route', kind: 'route', rewardValueCents: 1500, legs: [], legResults: [], trace,
    }
    const note = strategyAnnotation(strategy)
    expect(note.label).toBe('Strategy on this card, not a different card')
    expect(note.text).toContain('₹15.00')
  })

  it('shows an Unresolved strategy with its reason and no amount', () => {
    const strategy: ComposedStrategy = {
      resolved: false, strategyId: 'route', kind: 'route', blockingLegId: 'voucher-purchase', reason: 'leg "voucher-purchase" is not verified', legResults: [], trace,
    }
    const note = strategyAnnotation(strategy)
    expect(note.text).toContain('not verified')
    expect(note.text).toContain('cash value unknown')
    expect(note.text).not.toContain('₹')
  })
})
