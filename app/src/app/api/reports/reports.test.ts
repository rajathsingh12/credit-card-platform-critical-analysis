import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { PoolClient } from 'pg'

const queries: string[] = []

const defaultQuery = async (sql: string) => {
  queries.push(sql)
  if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] }
  if (sql.includes('FROM cards WHERE')) return { rows: [{ id: 'card-1' }] }
  if (sql.includes('FROM rule_versions')) return { rows: [{ rule_data: {} }] }
  if (sql.startsWith('INSERT INTO data_leads')) return { rows: [{ id: 'lead-1' }] }
  if (sql.startsWith('INSERT INTO contextual_reports')) {
    return { rows: [{ id: 'report-1', created_at: '2026-08-19T00:00:00.000Z' }] }
  }
  return { rows: [] }
}

const queryMock = vi.fn(defaultQuery)
const mockClient = {
  query: queryMock,
  release: vi.fn(),
} as unknown as PoolClient

vi.mock('@/db/client', () => ({
  pool: { connect: vi.fn(async () => mockClient) },
}))

import { POST } from './route'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/reports', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/reports', () => {
  beforeEach(() => {
    queries.length = 0
    queryMock.mockImplementation(defaultQuery)
  })

  it('card-existence query does not reference rule_data', async () => {
    const res = await POST(makeRequest({ cardId: 'card-1', description: 'looks off' }))
    expect(res.status).toBe(201)
    const cardCheck = queries.find((q) => q.includes('FROM cards WHERE'))
    expect(cardCheck).toBeDefined()
    expect(cardCheck).not.toMatch(/rule_data/)
  })

  it('fetches rule_data from rule_versions when ruleVersionId is supplied', async () => {
    const res = await POST(
      makeRequest({ cardId: 'card-1', ruleVersionId: 'rv-1', description: 'looks off' })
    )
    expect(res.status).toBe(201)
    expect(queries.some((q) => q.includes('FROM rule_versions'))).toBe(true)
  })

  it('returns 400 when description is missing', async () => {
    const res = await POST(makeRequest({ cardId: 'card-1' }))
    expect(res.status).toBe(400)
  })

  it('returns 404 when the card is not found', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      queries.push(sql)
      if (sql.includes('FROM cards WHERE')) return { rows: [] }
      return { rows: [] }
    })
    const res = await POST(makeRequest({ cardId: 'missing', description: 'x' }))
    expect(res.status).toBe(404)
  })
})