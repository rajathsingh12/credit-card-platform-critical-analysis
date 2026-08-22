import { describe, it, expect } from 'vitest'
import { toggleItem } from './home-client'

describe('toggleItem', () => {
  it('adds a key that is absent', () => {
    expect(Array.from(toggleItem(new Set(), 'a'))).toEqual(['a'])
  })

  it('removes a key that is present', () => {
    expect(Array.from(toggleItem(new Set(['a']), 'a'))).toEqual([])
  })

  it('leaves the other keys alone when adding', () => {
    expect(Array.from(toggleItem(new Set(['a', 'b']), 'c')).sort()).toEqual(['a', 'b', 'c'])
  })

  it('leaves the other keys alone when removing', () => {
    expect(Array.from(toggleItem(new Set(['a', 'b', 'c']), 'b')).sort()).toEqual(['a', 'c'])
  })

  it('does not mutate the input set', () => {
    const original = new Set(['a'])
    toggleItem(original, 'a')
    toggleItem(original, 'b')
    expect(Array.from(original)).toEqual(['a'])
  })

  it('returns a new set even when the contents are unchanged in size', () => {
    const original = new Set(['a'])
    expect(toggleItem(original, 'b')).not.toBe(original)
  })

  it('round-trips back to the starting contents', () => {
    const start = new Set(['a', 'b'])
    const there = toggleItem(start, 'c')
    const back = toggleItem(there, 'c')
    expect(Array.from(back).sort()).toEqual(['a', 'b'])
  })
})
