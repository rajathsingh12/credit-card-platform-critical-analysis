import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * The route prices from whatever these return, so the tests hand it rows
 * instead of a database. A route fact earns 10 points per ₹100, redeemed at
 * 1 cent per point → ₹10, against a direct rule worth ₹1.
 */
const directRule = {
  id: 'base',
  card_id: 'card-1',
  effective_from: '2026-01-01',
  effective_to: null,
  retracted_at: null,
  evidence_status: 'officially-documented',
  verified_at: '2026-01-01',
  rule_data: { ruleType: 'variable', categories: [], exclusions: [], pointsPerDollar: 1, capPoints: null },
}

function routeFact(retractedAt: string | null) {
  return {
    ...directRule,
    id: 'portal-voucher',
    retracted_at: retractedAt,
    rule_data: {
      ruleType: 'route-fact',
      effectiveMerchantCategory: 'gift-card',
      exclusions: [],
      pointsPerDollar: 10,
      capPoints: null,
      voucherFeeCents: 0,
      capGoverned: false,
    },
  }
}

const scenario = {
  id: 'travel',
  card_id: 'card-1',
  redemption_type: 'travel',
  applicable_categories: [],
  cents_per_point: '1',
  effective_from: '2026-01-01',
  effective_to: null,
  annual_fee_cents: 0,
}

const ruleRows: unknown[] = []

vi.mock('@/db/client', () => ({
  pool: {
    query: (sql: string) => ({
      rows: sql.includes('FROM redemption_scenarios') ? [scenario] : ruleRows,
    }),
  },
}))

vi.mock('@/telemetry/events-db', () => ({
  logEvent: vi.fn(),
  sessionDecisionCount: vi.fn(async () => 0),
}))

import { POST } from './route'

function request() {
  return new NextRequest('http://localhost/api/calculate', {
    method: 'POST',
    body: JSON.stringify({
      cardId: 'card-1',
      amountRupees: 100,
      merchantCategory: 'dining',
      transactionDate: '2026-06-15',
    }),
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  ruleRows.length = 0
})

describe('POST /api/calculate payment strategies', () => {
  it('returns the existing shape and no strategy field when the card has no route', async () => {
    ruleRows.push(directRule)
    const body = await (await POST(request())).json()

    expect(body.result.resolved).toBe(true)
    expect(body.ruleMeta).toHaveProperty('base')
    expect(body).not.toHaveProperty('paymentStrategies')
  })

  it('adds a resolved strategy when a verified route beats the direct payment', async () => {
    ruleRows.push(directRule, routeFact(null))
    const body = await (await POST(request())).json()

    expect(body.result.resolved).toBe(true)
    expect(body.ruleMeta).not.toHaveProperty('portal-voucher')
    expect(body.paymentStrategies).toHaveLength(1)
    expect(body.paymentStrategies[0]).toMatchObject({ resolved: true, rewardValueCents: 1000 })
  })

  it('adds an Unresolved strategy with no reward value when the route fact was retracted', async () => {
    ruleRows.push(directRule, routeFact('2026-06-01T00:00:00Z'))
    const body = await (await POST(request())).json()

    expect(body.paymentStrategies).toHaveLength(1)
    expect(body.paymentStrategies[0].resolved).toBe(false)
    expect(body.paymentStrategies[0]).not.toHaveProperty('rewardValueCents')
  })
})
