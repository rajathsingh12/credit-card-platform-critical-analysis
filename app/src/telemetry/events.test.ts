import { describe, it, expect } from 'vitest'
import {
  isValidEventName,
  ALL_EVENT_NAMES,
  CLIENT_EVENT_NAMES,
  SERVER_ONLY_EVENT_NAMES,
} from './events'
import type { BetaEventName } from './events'

describe('isValidEventName', () => {
  it('accepts all defined event names', () => {
    expect(isValidEventName('decision_completed')).toBe(true)
    expect(isValidEventName('session_repeat')).toBe(true)
    expect(isValidEventName('unresolved_outcome_shown')).toBe(true)
    expect(isValidEventName('contextual_report_submitted')).toBe(true)
    expect(isValidEventName('correction_retracted')).toBe(true)
  })

  it('rejects unknown names', () => {
    expect(isValidEventName('click')).toBe(false)
    expect(isValidEventName('')).toBe(false)
    expect(isValidEventName('DECISION_COMPLETED')).toBe(false)
  })

  it('rejects non-strings', () => {
    expect(isValidEventName(null)).toBe(false)
    expect(isValidEventName(undefined)).toBe(false)
    expect(isValidEventName(42)).toBe(false)
  })
})

describe('event-name partition', () => {
  it('splits every union member into exactly one scope', () => {
    const classified = new Set<BetaEventName>([
      ...CLIENT_EVENT_NAMES,
      ...SERVER_ONLY_EVENT_NAMES,
    ])
    expect(classified.size).toBe(ALL_EVENT_NAMES.length)
    for (const name of ALL_EVENT_NAMES) {
      expect(classified.has(name)).toBe(true)
    }
    const overlap = [...CLIENT_EVENT_NAMES].filter((name) =>
      SERVER_ONLY_EVENT_NAMES.has(name),
    )
    expect(overlap).toEqual([])
  })

  it('keeps correction_retracted server-only and out of the client set', () => {
    expect(SERVER_ONLY_EVENT_NAMES.has('correction_retracted')).toBe(true)
    expect(CLIENT_EVENT_NAMES.has('correction_retracted')).toBe(false)
  })
})
