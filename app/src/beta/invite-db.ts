import { pool } from '@/db/client'

export type InviteStatus = 'valid' | 'revoked' | 'not_found'

export interface InviteRow {
  code: string
  createdAt: Date
  revokedAt: Date | null
}

export async function checkInviteCode(code: string): Promise<InviteStatus> {
  const { rows } = await pool.query<{ revoked_at: Date | null }>(
    'SELECT revoked_at FROM invite_codes WHERE code = $1',
    [code]
  )
  if (rows.length === 0) return 'not_found'
  return rows[0].revoked_at ? 'revoked' : 'valid'
}

export async function createInviteCode(code: string): Promise<InviteRow> {
  const { rows } = await pool.query<{ code: string; created_at: Date; revoked_at: Date | null }>(
    'INSERT INTO invite_codes (code) VALUES ($1) RETURNING code, created_at, revoked_at',
    [code]
  )
  return { code: rows[0].code, createdAt: rows[0].created_at, revokedAt: rows[0].revoked_at }
}

export async function revokeInviteCode(code: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    'UPDATE invite_codes SET revoked_at = NOW() WHERE code = $1 AND revoked_at IS NULL',
    [code]
  )
  return (rowCount ?? 0) > 0
}

export async function listInviteCodes(): Promise<InviteRow[]> {
  const { rows } = await pool.query<{ code: string; created_at: Date; revoked_at: Date | null }>(
    'SELECT code, created_at, revoked_at FROM invite_codes ORDER BY created_at DESC'
  )
  return rows.map(r => ({ code: r.code, createdAt: r.created_at, revokedAt: r.revoked_at }))
}
