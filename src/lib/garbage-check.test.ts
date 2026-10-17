import { describe, expect, it } from 'vitest'
import { garbageVerdict } from './garbage-check'

describe('garbageVerdict', () => {
  it('accepts a clean photo', () => {
    expect(garbageVerdict(0, 15)).toEqual({ ok: true })
  })

  it('accepts anything below the limit', () => {
    expect(garbageVerdict(14.99, 15).ok).toBe(true)
    expect(garbageVerdict(3.2, 15).ok).toBe(true)
  })

  it('refuses exactly at the limit and above it ("less than 15%" is accepted)', () => {
    expect(garbageVerdict(15, 15).ok).toBe(false)
    expect(garbageVerdict(15.01, 15).ok).toBe(false)
    expect(garbageVerdict(60, 15).ok).toBe(false)
  })

  it('tells the inspector how much garbage is visible and that the ticket is not done', () => {
    const v = garbageVerdict(22.4, 15)
    expect(v.ok).toBe(false)
    if (!v.ok) {
      expect(v.message).toContain('22%')
      expect(v.message).toContain('not done yet')
    }
  })

  it('uses whatever limit it is given', () => {
    expect(garbageVerdict(20, 25).ok).toBe(true)
    expect(garbageVerdict(20, 10).ok).toBe(false)
  })

  it('refuses a photo with too many separate items even when the share is small', () => {
    expect(garbageVerdict(3, 5, 4, 5).ok).toBe(true)
    const v = garbageVerdict(3, 5, 5, 5)
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.message).toContain('5 items')
    expect(garbageVerdict(3, 5, 12, 5).ok).toBe(false)
  })

  it('does not trust a nonsense reading', () => {
    expect(garbageVerdict(Number.NaN, 15).ok).toBe(false)
    expect(garbageVerdict(-5, 15).ok).toBe(false)
  })
})
