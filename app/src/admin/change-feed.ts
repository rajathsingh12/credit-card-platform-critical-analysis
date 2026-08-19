import type { Pool } from 'pg'
import { toIsoDate } from '../catalog/db-mapping'

export type ChangeType = 'published' | 'retracted' | 'redemption-scenario-added'

export type ChangeFeedEntry = {
  changeType: ChangeType
  ruleVersionId?: string
  redemptionScenarioId?: string
  cardId: string
  cardName: string
  effectiveFrom: string
  timestamp: string
}

export type ChangeFeed = {
  feedDate: string
  sinceDate: string
  changes: ChangeFeedEntry[]
}

export function changeFeedLabel(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export async function generateChangeFeed(
  pool: Pool,
  sinceDate: Date,
  untilDate: Date
): Promise<ChangeFeed> {
  const sinceDateStr = changeFeedLabel(sinceDate)
  const untilDateStr = changeFeedLabel(untilDate)

  const publishedRes = await pool.query<{
    rv_id: string
    card_id: string
    card_name: string
    effective_from: string | Date
    created_at: string | Date
  }>(
    `
    SELECT
      rv.id AS rv_id,
      rv.card_id,
      c.name AS card_name,
      rv.effective_from,
      rv.created_at
    FROM rule_versions rv
    INNER JOIN cards c ON c.id = rv.card_id
    WHERE rv.created_at > $1 AND rv.created_at <= $2
    ORDER BY rv.created_at
  `,
    [sinceDate, untilDate]
  )

  const retractedRes = await pool.query<{
    rv_id: string
    card_id: string
    card_name: string
    effective_from: string | Date
    retracted_at: string | Date
  }>(
    `
    SELECT
      rv.id AS rv_id,
      rv.card_id,
      c.name AS card_name,
      rv.effective_from,
      rv.retracted_at
    FROM rule_versions rv
    INNER JOIN cards c ON c.id = rv.card_id
    WHERE rv.retracted_at > $1 AND rv.retracted_at <= $2
    ORDER BY rv.retracted_at
  `,
    [sinceDate, untilDate]
  )

  const scenariosRes = await pool.query<{
    rs_id: string
    card_id: string
    card_name: string
    effective_from: string | Date
    created_at: string | Date
  }>(
    `
    SELECT
      rs.id AS rs_id,
      rs.card_id,
      c.name AS card_name,
      rs.effective_from,
      rs.created_at
    FROM redemption_scenarios rs
    INNER JOIN cards c ON c.id = rs.card_id
    WHERE rs.created_at > $1 AND rs.created_at <= $2
    ORDER BY rs.created_at
  `,
    [sinceDate, untilDate]
  )

  const changes: ChangeFeedEntry[] = []

  for (const row of publishedRes.rows) {
    changes.push({
      changeType: 'published',
      ruleVersionId: row.rv_id,
      cardId: row.card_id,
      cardName: row.card_name,
      effectiveFrom: toIsoDate(row.effective_from),
      timestamp: new Date(row.created_at).toISOString(),
    })
  }

  for (const row of retractedRes.rows) {
    changes.push({
      changeType: 'retracted',
      ruleVersionId: row.rv_id,
      cardId: row.card_id,
      cardName: row.card_name,
      effectiveFrom: toIsoDate(row.effective_from),
      timestamp: new Date(row.retracted_at).toISOString(),
    })
  }

  for (const row of scenariosRes.rows) {
    changes.push({
      changeType: 'redemption-scenario-added',
      redemptionScenarioId: row.rs_id,
      cardId: row.card_id,
      cardName: row.card_name,
      effectiveFrom: toIsoDate(row.effective_from),
      timestamp: new Date(row.created_at).toISOString(),
    })
  }

  changes.sort((a, b) => a.timestamp.localeCompare(b.timestamp))

  return {
    feedDate: untilDateStr,
    sinceDate: sinceDateStr,
    changes,
  }
}
