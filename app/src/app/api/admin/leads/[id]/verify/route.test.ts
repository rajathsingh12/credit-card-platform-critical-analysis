import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { PoolClient } from 'pg'

const queries: string[] = []

const pendingLead = {
  id: 'lead-1',
  source_url: 'https://cardinsider.com/axis-magnus',
  status: 'pending',
  issuer: 'Axis Bank',
}

const defaultQuery = async (sql: string) => {
  queries.push(sql)
  if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] }
  if (sql.includes('FROM data_leads dl')) return { rows: [pendingLead] }
  if (sql.startsWith('INSERT INTO sources')) return { rows: [{ id: 'source-1' }] }
  if (sql.startsWith('INSERT INTO verification_records')) {
    return { rows: [{ id: 'vr-1', evidence_status: 'officially-documented', verified_at: '2026-08-19T00:00:00.000Z' }] }
  }
  return { rows: [] }
}

const queryMock = vi.fn(defaultQuery)
const mockClient = {
  query: queryMock,
  release: vi.fn(),
} as unknown as PoolClient

vi.mock('@/db/client', () => ({
  pool: {
    query: vi.fn(async (sql: string) => queryMock(sql)),
    connect: vi.fn(async () => mockClient),
  },
}))

import { POST } from './route'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/admin/leads/lead-1/verify', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

const ctx = { params: Promise.resolve({ id: 'lead-1' }) }

async function callPost(body: unknown) {
  return POST(makeRequest(body), ctx)
}

function withLead(lead: Partial<typeof pendingLead>) {
  queryMock.mockImplementation(async (sql: string) => {
    queries.push(sql)
    if (sql.includes('FROM data_leads dl')) return { rows: [{ ...pendingLead, ...lead }] }
    return defaultQuery(sql)
  })
}

describe('POST /api/admin/leads/[id]/verify', () => {
  beforeEach(() => {
    queries.length = 0
    queryMock.mockImplementation(defaultQuery)
  })

  it('rejects officially-documented against a non-issuer url with 422', async () => {
    const res = await callPost({ evidenceStatus: 'officially-documented' })
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toMatch(/issuer/)
    expect(queries.some((q) => q.includes('INSERT INTO verification_records'))).toBe(false)
  })

  it('accepts officially-documented against the issuer domain', async () => {
    withLead({ source_url: 'https://www.axisbank.com/retail/cards/credit-card' })
    const res = await callPost({ evidenceStatus: 'officially-documented' })
    expect(res.status).toBe(201)
  })

  it('rejects community-reported that cites the issuer domain with 422', async () => {
    withLead({ source_url: 'https://www.axisbank.com/retail/cards/credit-card' })
    const res = await callPost({ evidenceStatus: 'community-reported' })
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toMatch(/community/)
  })

  it('joins the issuer from cards via card_id', async () => {
    await callPost({ evidenceStatus: 'statement-verified' })
    const leadQuery = queries.find((q) => q.includes('FROM data_leads dl'))
    expect(leadQuery).toMatch(/JOIN cards c ON c\.id = dl\.card_id/)
    expect(leadQuery).toMatch(/c\.issuer AS issuer/)
  })

  it('returns 400 for an unknown evidenceStatus', async () => {
    const res = await callPost({ evidenceStatus: 'bogus' })
    expect(res.status).toBe(400)
  })

  it('returns 404 when the lead is missing', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      queries.push(sql)
      if (sql.includes('FROM data_leads dl')) return { rows: [] }
      return { rows: [] }
    })
    const res = await callPost({ evidenceStatus: 'statement-verified' })
    expect(res.status).toBe(404)
  })

  it('rejects a non-pending lead with 422 via the gate', async () => {
    withLead({ status: 'approved' })
    const res = await callPost({ evidenceStatus: 'statement-verified' })
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toContain('not pending')
    expect(queries.some((q) => q.includes('INSERT INTO verification_records'))).toBe(false)
  })
})