import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/db/client'
import { calculate } from '@/engine/calculate'
import { toEngineRuleVersion, toEngineScenario, toIsoDate } from '@/catalog/db-mapping'
import type { TransactionContext, CalcResult } from '@/engine/types'
import { validateCalculateInput } from './validate'
import { BETA_COOKIE } from '@/beta/invite'
import { logEvent, sessionDecisionCount } from '@/telemetry/events-db'

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
      `SELECT rv.id, rv.card_id, rv.effective_from, rv.effective_to, rv.rule_data,
              rv.retracted_at, vr.evidence_status, vr.verified_at
       FROM rule_versions rv
       JOIN verification_records vr ON vr.id = rv.verification_record_id
       WHERE rv.card_id = $1`,
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

  const ruleMeta: Record<string, { evidenceStatus: string; sourceDate: string; retractedAt: string | null }> = {}
  for (const row of rulesResult.rows) {
    ruleMeta[row.id] = {
      evidenceStatus: row.evidence_status,
      sourceDate: toIsoDate(row.verified_at),
      retractedAt: row.retracted_at ? new Date(row.retracted_at).toISOString() : null,
    }
  }

  const context: TransactionContext = {
    transactionId: `txn-${Date.now()}`,
    amount: amountPaise,
    merchantCategory,
    merchantName,
    transactionDate,
  }

  const raw = calculate(context, rules, scenarios)

  // If the applied rule has been retracted, override to unresolved so the UI reflects the correction.
  let result: CalcResult = raw
  if (raw.ruleApplied && ruleMeta[raw.ruleApplied]?.retractedAt && raw.resolved) {
    result = {
      resolved: false,
      transactionId: raw.transactionId,
      reason: 'The rule used for this calculation has been retracted due to a correction.',
      rewardsEarned: raw.rewardsEarned,
      ruleApplied: raw.ruleApplied,
      trace: raw.trace,
    }
  }

  const sessionToken = request.cookies.get(BETA_COOKIE)?.value
  void emitDecisionEvents(sessionToken, cardId, result)

  return NextResponse.json({ result, ruleMeta })
}

async function emitDecisionEvents(
  sessionToken: string | undefined,
  cardId: string,
  result: CalcResult
): Promise<void> {
  try {
    const prior = sessionToken ? await sessionDecisionCount(sessionToken) : 0
    await logEvent({ eventName: 'decision_completed', sessionToken, payload: { cardId, resolved: result.resolved } })
    if (!result.resolved) {
      await logEvent({ eventName: 'unresolved_outcome_shown', sessionToken, payload: { cardId, reason: result.reason } })
    }
    if (prior > 0 && sessionToken) {
      await logEvent({ eventName: 'session_repeat', sessionToken, payload: { priorDecisions: prior } })
    }
  } catch {
    // telemetry is non-critical
  }
}
