import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/db/client'
import { calculate } from '@/engine/calculate'
import { toEngineRuleVersion, toEngineScenario } from '@/catalog/db-mapping'
import type { TransactionContext } from '@/engine/types'
import { validateCalculateInput } from './validate'

export { validateCalculateInput } from './validate'
export type { CalculateRequest } from './validate'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const validation = validateCalculateInput(body)

  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const { cardId, amountRupees, merchantName, merchantCategory, transactionDate } = validation.data
  const amountPaise = Math.round(amountRupees * 100)

  const [rulesResult, scenariosResult] = await Promise.all([
    pool.query(
      `SELECT id, card_id, effective_from, effective_to, rule_data
       FROM rule_versions
       WHERE card_id = $1`,
      [cardId]
    ),
    pool.query(
      `SELECT rs.id, rs.card_id, rs.redemption_type, rs.applicable_categories,
              rs.cents_per_point, rs.effective_from, rs.effective_to,
              c.annual_fee_cents
       FROM redemption_scenarios rs
       JOIN cards c ON c.id = rs.card_id
       WHERE rs.card_id = $1`,
      [cardId]
    ),
  ])

  const rules = rulesResult.rows.map(toEngineRuleVersion)
  const scenarios = scenariosResult.rows.map(toEngineScenario)

  const context: TransactionContext = {
    transactionId: `txn-${Date.now()}`,
    amount: amountPaise,
    merchantCategory,
    merchantName,
    transactionDate,
  }

  const result = calculate(context, rules, scenarios)

  return NextResponse.json({ result })
}
