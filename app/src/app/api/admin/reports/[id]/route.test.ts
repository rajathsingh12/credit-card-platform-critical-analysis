import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const traceContext = { step: 'calc-trace', ruleKey: 'rewards.dining.rate' }

const reportWithRule = {
  id: 'report-1',
  description: 'dining rate looks wrong',
  source_url: 'https://cardinsider.com/axis-magnus',
  trace_context: traceContext,
  created_at: '2026-08-19T00:00:00.000Z',
  card_id: 'card-1',
  card_name: 'Magnus',
  card_issuer: 'Axis Bank',
  card_network: 'Mastercard',
  rule_version_id: 'rv-1',
  rule_version_rule_data: { rewards: { dining: { rate: 10 } } },
  rule_version_effective_from: '2026-01-01',
  rule_version_effective_to: null,
  rule_version_retracted_at: null,
  rule_version_created_at: '2026-01-01T00:00:00.000Z',
  verification_record_id: 'vr-1',
  evidence_status: 'officially-documented',
  verified_at: '2026-08-01T00:00:00.000Z',
  verification_notes: 'issuer page',
}

const reportWithoutRule = {
  ...reportWithRule,
  id: 'report-2',
  rule_version_id: null,
  rule_version_rule_data: null,
  rule_version_effective_from: null,
  rule_version_effective_to: null,
  rule_version_retracted_at: null,
  rule_version_created_at: null,
  verification_record_id: null,
  evidence_status: null,
  verified_at: null,
  verification_notes: null,
}

type Row = Record<string, unknown>

const queryMock = vi.fn(async (sql: string): Promise<{ rows: Row[] }> => {
  if (sql.includes('FROM contextual_reports')) {
    if (sql.includes('$1')) return { rows: [reportWithRule] }
    return { rows: [] }
  }
  return { rows: [] }
})

vi.mock('@/db/client', () => ({
  pool: { query: vi.fn((sql: string) => queryMock(sql)) },
}))

import { GET } from './route'

function makeRequest(id: string) {
  return new NextRequest(`http://localhost/api/admin/reports/${id}`, { method: 'GET' })
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

describe('GET /api/admin/reports/[id]', () => {
  beforeEach(() => {
    queryMock.mockImplementation(async (sql: string): Promise<{ rows: Row[] }> => {
      if (sql.includes('FROM contextual_reports')) return { rows: [reportWithRule] }
      return { rows: [] }
    })
  })

  it('joins card, rule version, and verification record for a seeded report', async () => {
    const res = await GET(makeRequest('report-1'), ctx('report-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.report.id).toBe('report-1')
    expect(body.report.card).toEqual({
      id: 'card-1',
      name: 'Magnus',
      issuer: 'Axis Bank',
      network: 'Mastercard',
    })
    expect(body.report.ruleVersion).toEqual({
      id: 'rv-1',
      ruleData: { rewards: { dining: { rate: 10 } } },
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
      retractedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    expect(body.report.verificationRecord).toEqual({
      id: 'vr-1',
      evidenceStatus: 'officially-documented',
      verifiedAt: '2026-08-01T00:00:00.000Z',
      notes: 'issuer page',
    })
  })

  it('returns the exact stored trace_context', async () => {
    const res = await GET(makeRequest('report-1'), ctx('report-1'))
    const body = await res.json()
    expect(body.report.traceContext).toEqual(traceContext)
  })

  it('returns a null ruleVersion when the report has no rule version', async () => {
    queryMock.mockImplementation(async (sql: string): Promise<{ rows: Row[] }> => {
      if (sql.includes('FROM contextual_reports')) return { rows: [reportWithoutRule] }
      return { rows: [] }
    })
    const res = await GET(makeRequest('report-2'), ctx('report-2'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.report.ruleVersion).toBeNull()
    expect(body.report.verificationRecord).toBeNull()
    expect(body.report.card.id).toBe('card-1')
  })

  it('returns 404 for a missing report', async () => {
    queryMock.mockImplementation(async (): Promise<{ rows: Row[] }> => ({ rows: [] }))
    const res = await GET(makeRequest('missing'), ctx('missing'))
    expect(res.status).toBe(404)
  })

  it('selects trace_context from contextual_reports', async () => {
    const calls: string[] = []
    queryMock.mockImplementation(async (sql: string): Promise<{ rows: Row[] }> => {
      calls.push(sql)
      return { rows: [reportWithRule] }
    })
    await GET(makeRequest('report-1'), ctx('report-1'))
    const reportQuery = calls.find((q) => q.includes('FROM contextual_reports'))
    expect(reportQuery).toMatch(/cr\.trace_context/)
    expect(reportQuery).toMatch(/LEFT JOIN rule_versions rv ON rv\.id = cr\.rule_version_id/)
  })
})