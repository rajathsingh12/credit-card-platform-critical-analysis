#!/usr/bin/env tsx
/**
 * Honours the deletion promises the beta notice makes to invitees.
 *
 *   npm run stop-request -- <code>   one invitee asks to stop: revoke the code and
 *                                    delete their usage records (the notice promises
 *                                    this within 7 days)
 *   npm run stop-request -- --purge-all
 *                                    the beta has ended: delete every usage record and
 *                                    every invite code (the notice promises this within
 *                                    30 days of the beta verdict)
 *
 * The notice says reports are kept, unattributed, as the catalog's correction record —
 * so contextual_reports is never touched here. Its only link to an invitee was the
 * contextual_report_submitted event, which this deletes.
 *
 * The code-to-name list lives outside the database, in the steward's off-git notes.
 * Strike the invitee's entry there in the same pass; nothing in this script can reach it.
 */

import { Pool } from 'pg'
import { withTransaction } from '../src/db/transaction'

async function stopRequest(pool: Pool, code: string) {
  const result = await withTransaction(pool, async (client) => {
    const events = await client.query(
      `DELETE FROM beta_events WHERE session_token = $1`,
      [code]
    )
    const revoked = await client.query(
      `UPDATE invite_codes SET revoked_at = NOW() WHERE code = $1 AND revoked_at IS NULL`,
      [code]
    )
    const known = await client.query(`SELECT 1 FROM invite_codes WHERE code = $1`, [code])
    return {
      eventsDeleted: events.rowCount ?? 0,
      codeRevoked: (revoked.rowCount ?? 0) > 0,
      codeKnown: known.rowCount === 1,
    }
  })

  console.log(`Stop request for ${code}:`)
  console.log(`  usage records deleted: ${result.eventsDeleted}`)
  console.log(
    `  code: ${result.codeRevoked ? 'revoked' : result.codeKnown ? 'already revoked' : 'not found'}`
  )
  console.log(`\nReports submitted by this invitee are now unattributed.`)
  console.log(`Strike the code-to-name entry in the steward list — that file is not in git.`)
}

async function purgeAll(pool: Pool) {
  const result = await withTransaction(pool, async (client) => {
    const events = await client.query(`DELETE FROM beta_events`)
    const codes = await client.query(`DELETE FROM invite_codes`)
    return {
      eventsDeleted: events.rowCount ?? 0,
      codesDeleted: codes.rowCount ?? 0,
    }
  })

  console.log(`Beta close:`)
  console.log(`  usage records deleted: ${result.eventsDeleted}`)
  console.log(`  invite codes deleted:  ${result.codesDeleted}`)
  console.log(`\nReports are kept and now carry no invitee link.`)
  console.log(`Delete the code-to-name list by hand — that file is not in git.`)
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is not set')
    process.exit(1)
  }

  const args = process.argv.slice(2).filter((a) => a !== '--')
  const purge = args.includes('--purge-all')
  const code = args.find((a) => !a.startsWith('--'))

  if (!purge && !code) {
    console.error('usage: npm run stop-request -- <code>')
    console.error('       npm run stop-request -- --purge-all')
    process.exit(1)
  }
  if (purge && code) {
    console.error('pass either a code or --purge-all, not both')
    process.exit(1)
  }

  const pool = new Pool({ connectionString: url })
  try {
    if (purge) await purgeAll(pool)
    else await stopRequest(pool, code as string)
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
