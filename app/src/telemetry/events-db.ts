import { pool } from '@/db/client'
import type { BetaEvent } from './events'

export async function logEvent(event: BetaEvent): Promise<void> {
  await pool.query(
    `INSERT INTO beta_events (event_name, session_token, payload)
     VALUES ($1, $2, $3)`,
    [event.eventName, event.sessionToken ?? null, JSON.stringify(event.payload)]
  )
}

export async function sessionDecisionCount(sessionToken: string): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM beta_events
     WHERE event_name = 'decision_completed' AND session_token = $1`,
    [sessionToken]
  )
  return parseInt(rows[0].count, 10)
}
