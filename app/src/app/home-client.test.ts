import { describe, it, expect } from 'vitest'
import type { CalcResult } from '@/engine/types'
import { toggleItem, rankResults } from './home-client'

type Input = Parameters<typeof rankResults>[0][number]
const trace = { transactionId: 't', entries: [] }
const card = (id: string) => ({ id, name: id, issuer: 'X', rewardCurrency: 'points' })
const resolved = (id: string, netReturnCents: number | null): Input => ({
  card: card(id),
  ruleMeta: {},
  result: { resolved: true, transactionId: 't', rewardsEarned: 1, ruleApplied: null, scenarioApplied: null, netReturnCents, annualFeeAmortizedCents: null, trace } satisfies CalcResult,
})
const unresolved = (id: string): Input => ({
  card: card(id),
  ruleMeta: {},
  result: { resolved: false, transactionId: 't', reason: 'no scenario', rewardsEarned: 1, ruleApplied: 'r', trace } satisfies CalcResult,
})

describe('rankResults', () => {
  it('orders resolved by net return desc, then direct rewards, then unresolved', () => {
    const out = rankResults([unresolved('u'), resolved('low', 100), resolved('direct', null), resolved('high', 500)])
    expect(out.map(r => r.card.id)).toEqual(['high', 'low', 'direct', 'u'])
    expect(out.map(r => r.rank)).toEqual([1, 2, 3, 4])
  })

  it('derives shortfall from the winner; winner and no-value rows get null', () => {
    const out = rankResults([resolved('low', 100), resolved('direct', null), resolved('high', 500), unresolved('u')])
    expect(out.map(r => r.shortfallCents)).toEqual([null, -400, null, null])
  })

  it('returns an empty list for no results', () => {
    expect(rankResults([])).toEqual([])
  })
})

describe('toggleItem', () => {
  it('adds a key that is absent', () => {
    expect(Array.from(toggleItem(new Set(), 'a'))).toEqual(['a'])
  })

  it('removes a key that is present', () => {
    expect(Array.from(toggleItem(new Set(['a']), 'a'))).toEqual([])
  })

  it('leaves the other keys alone when adding', () => {
    expect(Array.from(toggleItem(new Set(['a', 'b']), 'c')).sort()).toEqual(['a', 'b', 'c'])
  })

  it('leaves the other keys alone when removing', () => {
    expect(Array.from(toggleItem(new Set(['a', 'b', 'c']), 'b')).sort()).toEqual(['a', 'c'])
  })

  it('does not mutate the input set', () => {
    const original = new Set(['a'])
    toggleItem(original, 'a')
    toggleItem(original, 'b')
    expect(Array.from(original)).toEqual(['a'])
  })

  it('returns a new set even when the contents are unchanged in size', () => {
    const original = new Set(['a'])
    expect(toggleItem(original, 'b')).not.toBe(original)
  })

  it('round-trips back to the starting contents', () => {
    const start = new Set(['a', 'b'])
    const there = toggleItem(start, 'c')
    const back = toggleItem(there, 'c')
    expect(Array.from(back).sort()).toEqual(['a', 'b'])
  })
})
