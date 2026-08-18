import { describe, it, expect } from 'vitest'
import { isValidEventName } from './events'

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
