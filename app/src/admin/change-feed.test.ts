import { describe, it, expect } from 'vitest'
import { changeFeedLabel, generateChangeFeed } from './change-feed'
import type { Pool } from 'pg'

const NOW = new Date('2026-08-18T10:00:00.000Z')
const SINCE = new Date('2026-08-11T10:00:00.000Z')

describe('changeFeedLabel', () => {
  it('returns the ISO date portion', () => {
    expect(changeFeedLabel(NOW)).toBe('2026-08-18')
  })
})

describe('generateChangeFeed', () => {
  it('returns correct envelope with dates', async () => {
    const mockPool = {
      query: async () => ({ rows: [] }),
    } as unknown as Pool

    const result = await generateChangeFeed(mockPool, SINCE, NOW)
    expect(result.feedDate).toBe('2026-08-18')
    expect(result.sinceDate).toBe('2026-08-11')
    expect(result.changes).toEqual([])
  })

  it('collects published rule versions', async () => {
    const mockPool = {
      query: async (sql: string) => {
        if (sql.includes('rv.created_at >')) {
          return {
            rows: [
              {
                rv_id: 'rv-new',
                card_id: 'card-1',
                card_name: 'Regalia Gold',
                effective_from: '2026-09-01',
                created_at: '2026-08-15T12:00:00.000Z',
              },
            ],
          }
        }
        return { rows: [] }
      },
    } as unknown as Pool

    const result = await generateChangeFeed(mockPool, SINCE, NOW)
    expect(result.changes).toHaveLength(1)
    expect(result.changes[0]).toMatchObject({
      changeType: 'published',
      ruleVersionId: 'rv-new',
      cardId: 'card-1',
      cardName: 'Regalia Gold',
      effectiveFrom: '2026-09-01',
      timestamp: '2026-08-15T12:00:00.000Z',
    })
  })

  it('collects retracted rule versions', async () => {
    const mockPool = {
      query: async (sql: string) => {
        if (sql.includes('rv.retracted_at >')) {
          return {
            rows: [
              {
                rv_id: 'rv-old',
                card_id: 'card-1',
                card_name: 'Regalia Gold',
                effective_from: '2025-01-01',
                retracted_at: '2026-08-16T14:00:00.000Z',
              },
            ],
          }
        }
        return { rows: [] }
      },
    } as unknown as Pool

    const result = await generateChangeFeed(mockPool, SINCE, NOW)
    expect(result.changes).toHaveLength(1)
    expect(result.changes[0]).toMatchObject({
      changeType: 'retracted',
      ruleVersionId: 'rv-old',
      cardId: 'card-1',
      cardName: 'Regalia Gold',
      effectiveFrom: '2025-01-01',
      timestamp: '2026-08-16T14:00:00.000Z',
    })
  })

  it('collects new redemption scenarios', async () => {
    const mockPool = {
      query: async (sql: string) => {
        if (sql.includes('FROM redemption_scenarios')) {
          return {
            rows: [
              {
                rs_id: 'rs-new',
                card_id: 'card-1',
                card_name: 'Regalia Gold',
                effective_from: '2026-09-01',
                created_at: '2026-08-17T16:00:00.000Z',
              },
            ],
          }
        }
        return { rows: [] }
      },
    } as unknown as Pool

    const result = await generateChangeFeed(mockPool, SINCE, NOW)
    expect(result.changes).toHaveLength(1)
    expect(result.changes[0]).toMatchObject({
      changeType: 'redemption-scenario-added',
      redemptionScenarioId: 'rs-new',
      cardId: 'card-1',
      cardName: 'Regalia Gold',
      effectiveFrom: '2026-09-01',
      timestamp: '2026-08-17T16:00:00.000Z',
    })
  })

  it('sorts changes by timestamp', async () => {
    const mockPool = {
      query: async (sql: string) => {
        if (sql.includes('rv.created_at >')) {
          return {
            rows: [
              {
                rv_id: 'rv-second',
                card_id: 'card-1',
                card_name: 'Regalia Gold',
                effective_from: '2026-09-01',
                created_at: '2026-08-15T12:00:00.000Z',
              },
            ],
          }
        }
        if (sql.includes('rv.retracted_at >')) {
          return {
            rows: [
              {
                rv_id: 'rv-first',
                card_id: 'card-1',
                card_name: 'Regalia Gold',
                effective_from: '2025-01-01',
                retracted_at: '2026-08-13T10:00:00.000Z',
              },
            ],
          }
        }
        if (sql.includes('FROM redemption_scenarios')) {
          return {
            rows: [
              {
                rs_id: 'rs-third',
                card_id: 'card-1',
                card_name: 'Regalia Gold',
                effective_from: '2026-09-01',
                created_at: '2026-08-17T16:00:00.000Z',
              },
            ],
          }
        }
        return { rows: [] }
      },
    } as unknown as Pool

    const result = await generateChangeFeed(mockPool, SINCE, NOW)
    expect(result.changes).toHaveLength(3)
    expect(result.changes[0].changeType).toBe('retracted')
    expect(result.changes[1].changeType).toBe('published')
    expect(result.changes[2].changeType).toBe('redemption-scenario-added')
  })

  it('emits both published and retracted for a version created and retracted in-window', async () => {
    const mockPool = {
      query: async (sql: string) => {
        if (sql.includes('rv.created_at >')) {
          return {
            rows: [
              {
                rv_id: 'rv-same-window',
                card_id: 'card-1',
                card_name: 'Regalia Gold',
                effective_from: '2026-09-01',
                created_at: '2026-08-15T12:00:00.000Z',
              },
            ],
          }
        }
        if (sql.includes('rv.retracted_at >')) {
          return {
            rows: [
              {
                rv_id: 'rv-same-window',
                card_id: 'card-1',
                card_name: 'Regalia Gold',
                effective_from: '2026-09-01',
                retracted_at: '2026-08-15T13:00:00.000Z',
              },
            ],
          }
        }
        return { rows: [] }
      },
    } as unknown as Pool

    const result = await generateChangeFeed(mockPool, SINCE, NOW)
    expect(result.changes).toHaveLength(2)
    expect(result.changes[0]).toMatchObject({
      changeType: 'published',
      ruleVersionId: 'rv-same-window',
      timestamp: '2026-08-15T12:00:00.000Z',
    })
    expect(result.changes[1]).toMatchObject({
      changeType: 'retracted',
      ruleVersionId: 'rv-same-window',
      timestamp: '2026-08-15T13:00:00.000Z',
    })
  })

  it('emits only retracted for a version published before since and retracted after since', async () => {
    const mockPool = {
      query: async (sql: string) => {
        if (sql.includes('rv.created_at >')) {
          return { rows: [] }
        }
        if (sql.includes('rv.retracted_at >')) {
          return {
            rows: [
              {
                rv_id: 'rv-pre-window',
                card_id: 'card-1',
                card_name: 'Regalia Gold',
                effective_from: '2025-01-01',
                retracted_at: '2026-08-16T14:00:00.000Z',
              },
            ],
          }
        }
        return { rows: [] }
      },
    } as unknown as Pool

    const result = await generateChangeFeed(mockPool, SINCE, NOW)
    expect(result.changes).toHaveLength(1)
    expect(result.changes[0]).toMatchObject({
      changeType: 'retracted',
      ruleVersionId: 'rv-pre-window',
    })
  })

  it('handles Date objects for effective_from and timestamps', async () => {
    const mockPool = {
      query: async (sql: string) => {
        if (sql.includes('rv.created_at >')) {
          return {
            rows: [
              {
                rv_id: 'rv-1',
                card_id: 'card-1',
                card_name: 'Regalia Gold',
                effective_from: new Date('2026-09-01'),
                created_at: new Date('2026-08-15T12:00:00.000Z'),
              },
            ],
          }
        }
        return { rows: [] }
      },
    } as unknown as Pool

    const result = await generateChangeFeed(mockPool, SINCE, NOW)
    expect(result.changes[0].effectiveFrom).toBe('2026-09-01')
    expect(result.changes[0].timestamp).toBe('2026-08-15T12:00:00.000Z')
  })

  it('excludes entries after the until upper bound', async () => {
    const UNTIL = new Date('2026-08-14T00:00:00.000Z')
    const seenSql: string[] = []
    const seenParams: Date[][] = []
    const mockPool = {
      query: async (sql: string, params: Date[]) => {
        seenSql.push(sql)
        seenParams.push(params)
        return { rows: [] }
      },
    } as unknown as Pool

    const result = await generateChangeFeed(mockPool, SINCE, UNTIL)

    expect(seenSql).toHaveLength(3)
    expect(seenSql[0]).toContain('AND rv.created_at <= $2')
    expect(seenSql[1]).toContain('AND rv.retracted_at <= $2')
    expect(seenSql[2]).toContain('AND rs.created_at <= $2')
    for (const params of seenParams) {
      expect(params[0]).toBe(SINCE)
      expect(params[1]).toBe(UNTIL)
    }
    expect(result.feedDate).toBe('2026-08-14')
  })
})
