import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/db/client'
import { BETA_COOKIE } from '@/beta/invite'
import { logEvent } from '@/telemetry/events-db'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const { cardId, ruleVersionId, description, sourceUrl, traceContext } = body ?? {}

  if (!cardId || typeof description !== 'string' || !description.trim()) {
    return NextResponse.json(
      { error: 'cardId and description are required' },
      { status: 400 }
    )
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Verify the card exists.
    const cardCheck = await client.query(`SELECT id, rule_data FROM cards WHERE id = $1`, [cardId])
    if (cardCheck.rows.length === 0) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'card not found' }, { status: 404 })
    }

    // If ruleVersionId provided, fetch its rule_data to populate the data lead.
    let proposedRuleData: unknown = {}
    if (ruleVersionId) {
      const rvCheck = await client.query(
        `SELECT rule_data FROM rule_versions WHERE id = $1 AND card_id = $2`,
        [ruleVersionId, cardId]
      )
      if (rvCheck.rows.length > 0) {
        proposedRuleData = rvCheck.rows[0].rule_data
      }
    }

    const leadSourceUrl = (typeof sourceUrl === 'string' && sourceUrl.trim())
      ? sourceUrl.trim()
      : `contextual-report:${cardId}`

    const leadRes = await client.query(
      `INSERT INTO data_leads (card_id, proposed_rule_data, source_url)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [cardId, JSON.stringify(proposedRuleData), leadSourceUrl]
    )
    const dataLeadId = leadRes.rows[0].id

    const reportRes = await client.query(
      `INSERT INTO contextual_reports (card_id, rule_version_id, trace_context, description, source_url, data_lead_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, created_at`,
      [
        cardId,
        ruleVersionId ?? null,
        traceContext ? JSON.stringify(traceContext) : null,
        description.trim(),
        typeof sourceUrl === 'string' && sourceUrl.trim() ? sourceUrl.trim() : null,
        dataLeadId,
      ]
    )

    await client.query('COMMIT')
    const row = reportRes.rows[0]
    const sessionToken = request.cookies.get(BETA_COOKIE)?.value
    void logEvent({ eventName: 'contextual_report_submitted', sessionToken, payload: { cardId, reportId: row.id } }).catch(() => {})
    return NextResponse.json({ reportId: row.id, dataLeadId, createdAt: row.created_at }, { status: 201 })
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
