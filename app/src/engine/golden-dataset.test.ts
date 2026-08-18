/**
 * Golden dataset test suite.
 * Validates calculation engine against seeded cards with known outcomes.
 * Zero Critical Calculation Errors required for Phase 1 exit.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { db } from '../db/client'
import { cards, ruleVersions, redemptionScenarios } from '../db/schema'
import { calculate } from './calculate'
import type { TransactionContext, RuleVersion, RedemptionScenario } from './types'
import { eq } from 'drizzle-orm'

describe('Golden Dataset — Calculation Validation', () => {
  let hdfc_regalia_id: string
  let axis_magnus_id: string
  let icici_amazon_id: string
  let sbi_simplyclick_id: string
  let amex_platinum_travel_id: string

  beforeAll(async () => {
    // Fetch card IDs for test cases
    const hdfc_regalia = await db.select().from(cards).where(eq(cards.name, 'HDFC Regalia')).limit(1)
    const axis_magnus = await db.select().from(cards).where(eq(cards.name, 'Axis Magnus')).limit(1)
    const icici_amazon = await db.select().from(cards).where(eq(cards.name, 'ICICI Amazon Pay')).limit(1)
    const sbi_click = await db.select().from(cards).where(eq(cards.name, 'SBI SimplyCLICK')).limit(1)
    const amex_plat = await db.select().from(cards).where(eq(cards.name, 'American Express Platinum Travel')).limit(1)

    hdfc_regalia_id = hdfc_regalia[0]?.id
    axis_magnus_id = axis_magnus[0]?.id
    icici_amazon_id = icici_amazon[0]?.id
    sbi_simplyclick_id = sbi_click[0]?.id
    amex_platinum_travel_id = amex_plat[0]?.id

    expect(hdfc_regalia_id).toBeDefined()
    expect(axis_magnus_id).toBeDefined()
    expect(icici_amazon_id).toBeDefined()
    expect(sbi_simplyclick_id).toBeDefined()
    expect(amex_platinum_travel_id).toBeDefined()
  })

  describe('Direct Reward Cards', () => {
    it('HDFC Regalia — base rate on dining', async () => {
      const rules = await db
        .select()
        .from(ruleVersions)
        .where(eq(ruleVersions.cardId, hdfc_regalia_id))

      const ruleVersionsTyped: RuleVersion[] = rules.map(r => ({
        id: r.id,
        cardId: r.cardId,
        effectiveFrom: r.effectiveFrom,
        effectiveTo: r.effectiveTo,
        ruleData: r.ruleData as any,
      }))

      const context: TransactionContext = {
        transactionId: 'txn-001',
        amount: 10000, // ₹100
        merchantCategory: 'dining',
        merchantName: 'Cafe Coffee Day',
        transactionDate: '2025-06-15',
      }

      const result = calculate(context, ruleVersionsTyped)

      expect(result.resolved).toBe(true)
      if (result.resolved) {
        // 4 points per dollar × 100 cents / 100 = 4 points
        expect(result.rewardsEarned).toBe(400)
        expect(result.ruleApplied).toBe(ruleVersionsTyped[0].id)
      }
    })

    it('HDFC Regalia — exclusion on fuel', async () => {
      const rules = await db
        .select()
        .from(ruleVersions)
        .where(eq(ruleVersions.cardId, hdfc_regalia_id))

      const ruleVersionsTyped: RuleVersion[] = rules.map(r => ({
        id: r.id,
        cardId: r.cardId,
        effectiveFrom: r.effectiveFrom,
        effectiveTo: r.effectiveTo,
        ruleData: r.ruleData as any,
      }))

      const context: TransactionContext = {
        transactionId: 'txn-002',
        amount: 5000,
        merchantCategory: 'fuel',
        merchantName: 'Indian Oil',
        transactionDate: '2025-06-15',
      }

      const result = calculate(context, ruleVersionsTyped)

      expect(result.resolved).toBe(true)
      if (result.resolved) {
        expect(result.rewardsEarned).toBe(0)
        expect(result.ruleApplied).toBe(null)
      }
    })

    it('ICICI Amazon Pay — bonus on online', async () => {
      const rules = await db
        .select()
        .from(ruleVersions)
        .where(eq(ruleVersions.cardId, icici_amazon_id))

      const ruleVersionsTyped: RuleVersion[] = rules.map(r => ({
        id: r.id,
        cardId: r.cardId,
        effectiveFrom: r.effectiveFrom,
        effectiveTo: r.effectiveTo,
        ruleData: r.ruleData as any,
      }))

      const context: TransactionContext = {
        transactionId: 'txn-003',
        amount: 20000, // ₹200
        merchantCategory: 'online',
        merchantName: 'Amazon.in',
        transactionDate: '2025-06-15',
      }

      const result = calculate(context, ruleVersionsTyped)

      expect(result.resolved).toBe(true)
      if (result.resolved) {
        // 5 points per dollar × 200 cents / 100 = 1000 points
        expect(result.rewardsEarned).toBe(1000)
      }
    })

    it('SBI SimplyCLICK — cap enforcement', async () => {
      const rules = await db
        .select()
        .from(ruleVersions)
        .where(eq(ruleVersions.cardId, sbi_simplyclick_id))

      const ruleVersionsTyped: RuleVersion[] = rules.map(r => ({
        id: r.id,
        cardId: r.cardId,
        effectiveFrom: r.effectiveFrom,
        effectiveTo: r.effectiveTo,
        ruleData: r.ruleData as any,
      }))

      const context: TransactionContext = {
        transactionId: 'txn-004',
        amount: 50000, // ₹500
        merchantCategory: 'online',
        merchantName: 'Flipkart',
        transactionDate: '2025-06-15',
      }

      const result = calculate(context, ruleVersionsTyped)

      expect(result.resolved).toBe(true)
      if (result.resolved) {
        // Uncapped: 10 × 500 / 100 = 5000, but cap is 1000
        expect(result.rewardsEarned).toBe(1000)
        const trace = result.trace.entries.find(e => e.applied)
        expect(trace?.assumptions).toContain('points capped at 1000 (uncapped value was 5000)')
      }
    })
  })

  describe('Variable Reward Cards', () => {
    it('Axis Magnus — variable reward with redemption scenario', async () => {
      const rules = await db
        .select()
        .from(ruleVersions)
        .where(eq(ruleVersions.cardId, axis_magnus_id))

      const scenarios = await db
        .select()
        .from(redemptionScenarios)
        .where(eq(redemptionScenarios.cardId, axis_magnus_id))

      const ruleVersionsTyped: RuleVersion[] = rules.map(r => ({
        id: r.id,
        cardId: r.cardId,
        effectiveFrom: r.effectiveFrom,
        effectiveTo: r.effectiveTo,
        ruleData: r.ruleData as any,
      }))

      const scenariosTyped: RedemptionScenario[] = scenarios.map(s => ({
        id: s.id,
        cardId: s.cardId,
        redemptionType: s.name,
        applicableCategories: [],
        effectiveFrom: '2025-01-01',
        effectiveTo: null,
        centsPerPoint: 1.0,
        annualFeeCents: 1000000,
      }))

      const context: TransactionContext = {
        transactionId: 'txn-005',
        amount: 10000, // ₹100
        merchantCategory: 'dining',
        merchantName: 'Restaurant',
        transactionDate: '2025-06-15',
      }

      const result = calculate(context, ruleVersionsTyped, scenariosTyped)

      expect(result.resolved).toBe(true)
      if (result.resolved) {
        // 12 points per dollar × 100 / 100 = 1200 points
        expect(result.rewardsEarned).toBe(1200)
        expect(result.scenarioApplied).toBe(scenariosTyped[0].id)
        // 1200 points × 1.0 cents/point = 1200 cents
        // Annual fee amortized: 1000000 / 12 = 83333 cents/month
        // Net: 1200 - 83333 = -82133
        expect(result.netReturnCents).toBe(1200 - Math.round(1000000 / 12))
      }
    })

    it('American Express Platinum Travel — variable with membership rewards', async () => {
      const rules = await db
        .select()
        .from(ruleVersions)
        .where(eq(ruleVersions.cardId, amex_platinum_travel_id))

      const scenarios = await db
        .select()
        .from(redemptionScenarios)
        .where(eq(redemptionScenarios.cardId, amex_platinum_travel_id))

      const ruleVersionsTyped: RuleVersion[] = rules.map(r => ({
        id: r.id,
        cardId: r.cardId,
        effectiveFrom: r.effectiveFrom,
        effectiveTo: r.effectiveTo,
        ruleData: r.ruleData as any,
      }))

      const scenariosTyped: RedemptionScenario[] = scenarios.map(s => ({
        id: s.id,
        cardId: s.cardId,
        redemptionType: s.name,
        applicableCategories: [],
        effectiveFrom: '2025-01-01',
        effectiveTo: null,
        centsPerPoint: 0.5,
        annualFeeCents: 350000,
      }))

      const context: TransactionContext = {
        transactionId: 'txn-006',
        amount: 100000, // ₹1000
        merchantCategory: 'travel',
        merchantName: 'Make My Trip',
        transactionDate: '2025-06-15',
      }

      const result = calculate(context, ruleVersionsTyped, scenariosTyped)

      expect(result.resolved).toBe(true)
      if (result.resolved) {
        // 1 point per dollar × 1000 / 100 = 1000 points
        expect(result.rewardsEarned).toBe(1000)
        expect(result.scenarioApplied).toBe(scenariosTyped[0].id)
        // 1000 points × 0.5 cents = 500 cents
        // Fee: 350000 / 12 = 29166.67 → 29167
        expect(result.netReturnCents).toBe(500 - Math.round(350000 / 12))
      }
    })
  })

  describe('Edge Cases', () => {
    it('Zero amount transaction', async () => {
      const rules = await db
        .select()
        .from(ruleVersions)
        .where(eq(ruleVersions.cardId, hdfc_regalia_id))

      const ruleVersionsTyped: RuleVersion[] = rules.map(r => ({
        id: r.id,
        cardId: r.cardId,
        effectiveFrom: r.effectiveFrom,
        effectiveTo: r.effectiveTo,
        ruleData: r.ruleData as any,
      }))

      const context: TransactionContext = {
        transactionId: 'txn-007',
        amount: 0,
        merchantCategory: 'dining',
        merchantName: 'Free Sample',
        transactionDate: '2025-06-15',
      }

      const result = calculate(context, ruleVersionsTyped)

      expect(result.resolved).toBe(true)
      if (result.resolved) {
        expect(result.rewardsEarned).toBe(0)
      }
    })

    it('Transaction before effective date', async () => {
      const rules = await db
        .select()
        .from(ruleVersions)
        .where(eq(ruleVersions.cardId, hdfc_regalia_id))

      const ruleVersionsTyped: RuleVersion[] = rules.map(r => ({
        id: r.id,
        cardId: r.cardId,
        effectiveFrom: r.effectiveFrom,
        effectiveTo: r.effectiveTo,
        ruleData: r.ruleData as any,
      }))

      const context: TransactionContext = {
        transactionId: 'txn-008',
        amount: 10000,
        merchantCategory: 'dining',
        merchantName: 'Restaurant',
        transactionDate: '2024-01-01', // Before 2025-01-01
      }

      const result = calculate(context, ruleVersionsTyped)

      expect(result.resolved).toBe(true)
      if (result.resolved) {
        expect(result.rewardsEarned).toBe(0)
        expect(result.ruleApplied).toBe(null)
      }
    })

    it('Fractional points floor correctly', async () => {
      const rules = await db
        .select()
        .from(ruleVersions)
        .where(eq(ruleVersions.cardId, hdfc_regalia_id))

      const ruleVersionsTyped: RuleVersion[] = rules.map(r => ({
        id: r.id,
        cardId: r.cardId,
        effectiveFrom: r.effectiveFrom,
        effectiveTo: r.effectiveTo,
        ruleData: r.ruleData as any,
      }))

      const context: TransactionContext = {
        transactionId: 'txn-009',
        amount: 123, // ₹1.23 — odd amount
        merchantCategory: 'dining',
        merchantName: 'Cafe',
        transactionDate: '2025-06-15',
      }

      const result = calculate(context, ruleVersionsTyped)

      expect(result.resolved).toBe(true)
      if (result.resolved) {
        // 4 points/dollar × 123 cents / 100 = 4.92 → floor to 4
        expect(result.rewardsEarned).toBe(4)
      }
    })
  })

  describe('Critical Calculation Error Detection', () => {
    it('All seeded cards have at least one rule version', async () => {
      const allCards = await db.select().from(cards)

      for (const card of allCards) {
        const rules = await db
          .select()
          .from(ruleVersions)
          .where(eq(ruleVersions.cardId, card.id))

        expect(
          rules.length,
          `Card ${card.name} (${card.issuer}) has no rule versions`
        ).toBeGreaterThan(0)
      }
    })

    it('All rule versions have valid effective dates', async () => {
      const allRules = await db.select().from(ruleVersions)

      for (const rule of allRules) {
        expect(rule.effectiveFrom).toBeTruthy()
        expect(new Date(rule.effectiveFrom).toString()).not.toBe('Invalid Date')

        if (rule.effectiveTo) {
          expect(new Date(rule.effectiveTo).toString()).not.toBe('Invalid Date')
          expect(rule.effectiveTo >= rule.effectiveFrom).toBe(true)
        }
      }
    })

    it('All rule_data has required fields', async () => {
      const allRules = await db.select().from(ruleVersions)

      for (const rule of allRules) {
        const rd = rule.ruleData as any

        expect(rd.ruleType).toBeDefined()
        expect(['direct', 'variable'].includes(rd.ruleType)).toBe(true)
        expect(Array.isArray(rd.categories)).toBe(true)
        expect(Array.isArray(rd.exclusions)).toBe(true)
        expect(typeof rd.pointsPerDollar).toBe('number')
        expect(rd.pointsPerDollar).toBeGreaterThan(0)
        expect(rd.capPoints === null || typeof rd.capPoints === 'number').toBe(true)
      }
    })

    it('Variable reward cards have redemption scenarios', async () => {
      const variableRules = await db.select().from(ruleVersions)

      for (const rule of variableRules) {
        const rd = rule.ruleData as any

        if (rd.ruleType === 'variable') {
          const scenarios = await db
            .select()
            .from(redemptionScenarios)
            .where(eq(redemptionScenarios.cardId, rule.cardId))

          expect(
            scenarios.length,
            `Variable rule ${rule.id} for card ${rule.cardId} has no redemption scenarios`
          ).toBeGreaterThan(0)
        }
      }
    })

    it('Coverage requirements met', async () => {
      const allCards = await db.select().from(cards)

      const issuers = new Set(allCards.map(c => c.issuer))
      expect(issuers.size, 'Must cover at least 5 issuers').toBeGreaterThanOrEqual(5)

      const networks = new Set(allCards.map(c => c.network))
      expect(networks.size, 'Must cover at least 3 networks').toBeGreaterThanOrEqual(3)

      expect(allCards.length, 'Must seed at least 30 cards').toBeGreaterThanOrEqual(30)
      expect(allCards.length, 'Must seed at most 40 cards').toBeLessThanOrEqual(40)
    })
  })
})
