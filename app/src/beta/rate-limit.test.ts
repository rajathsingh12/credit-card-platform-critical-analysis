import { describe, it, expect } from 'vitest'
import { takeWriteSlot, WRITE_LIMIT_PER_WINDOW } from './rate-limit'

const T0 = 1_700_000_000_000

describe('takeWriteSlot', () => {
  it('allows the first write from a session', () => {
    expect(takeWriteSlot('first', T0)).toBe(true)
  })

  it('allows a session up to the limit and refuses the next one', () => {
    const key = `limit-${T0}`
    for (let i = 0; i < WRITE_LIMIT_PER_WINDOW; i++) {
      expect(takeWriteSlot(key, T0 + i)).toBe(true)
    }
    expect(takeWriteSlot(key, T0 + WRITE_LIMIT_PER_WINDOW)).toBe(false)
  })

  it('counts each session separately, so one code cannot starve another', () => {
    const keyA = `a-${T0}`
    const keyB = `b-${T0}`
    for (let i = 0; i < WRITE_LIMIT_PER_WINDOW; i++) takeWriteSlot(keyA, T0)
    expect(takeWriteSlot(keyA, T0)).toBe(false)
    expect(takeWriteSlot(keyB, T0)).toBe(true)
  })

  it('frees the window once it has elapsed', () => {
    const key = `window-${T0}`
    for (let i = 0; i < WRITE_LIMIT_PER_WINDOW; i++) takeWriteSlot(key, T0)
    expect(takeWriteSlot(key, T0 + 60_001)).toBe(true)
  })
})
