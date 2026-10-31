import { describe, expect, it } from 'vitest'
import { distanceMeters, evaluateLocation, verdictMessage, type LocationRules } from './geo'

const place = { latitude: 29.924566, longitude: 78.080471 } // a real drone-photo position
const rules: LocationRules = { radiusMeters: 5, maxAccuracyMeters: 20 }
const NOW = 1_800_000_000_000

/** A point `meters` due north of the place (1 degree of latitude is about 111,195 m). */
const north = (meters: number) => ({
  latitude: place.latitude + meters / 111_195,
  longitude: place.longitude,
})
const fix = (over: Record<string, unknown> = {}) => ({
  ...north(0),
  accuracy: 4,
  capturedAt: NOW,
  ...over,
})

describe('distanceMeters', () => {
  it('is zero for the same point', () => {
    expect(distanceMeters(place, place)).toBeCloseTo(0, 6)
  })

  it('measures short distances to within a few centimetres', () => {
    expect(distanceMeters(place, north(5))).toBeCloseTo(5, 1)
    expect(distanceMeters(place, north(100))).toBeCloseTo(100, 1)
  })

  it('knows a degree of latitude is about 111 km', () => {
    const d = distanceMeters({ latitude: 29, longitude: 78 }, { latitude: 30, longitude: 78 })
    expect(d).toBeGreaterThan(111_000)
    expect(d).toBeLessThan(111_400)
  })

  it('is the same in both directions', () => {
    const a = distanceMeters(place, north(37))
    expect(distanceMeters(north(37), place)).toBeCloseTo(a, 9)
  })
})

describe('evaluateLocation', () => {
  it('accepts someone standing on the spot', () => {
    const v = evaluateLocation(place, fix(), rules, NOW)
    expect(v.ok).toBe(true)
  })

  it('accepts someone just inside the radius and refuses just outside it', () => {
    expect(evaluateLocation(place, fix({ ...north(4.9) }), rules, NOW).ok).toBe(true)
    const outside = evaluateLocation(place, fix({ ...north(5.5) }), rules, NOW)
    expect(outside.ok).toBe(false)
    expect(!outside.ok && outside.reason).toBe('too-far')
  })

  it('refuses someone far away and does not show the distance', () => {
    const v = evaluateLocation(place, fix({ ...north(120) }), rules, NOW)
    expect(v.ok).toBe(false)
    if (!v.ok) {
      expect(v.reason).toBe('too-far')
      expect(v.distanceMeters).toBeCloseTo(120, 0)
      expect(verdictMessage(v, rules)).not.toContain('120')
      expect(verdictMessage(v, rules)).toContain('within 5 m')
      expect(verdictMessage(v, rules)).toContain('not done yet')
    }
  })

  it('says "too far" even when the signal is rough, if the person is clearly elsewhere', () => {
    const v = evaluateLocation(place, fix({ ...north(400), accuracy: 60 }), rules, NOW)
    expect(!v.ok && v.reason).toBe('too-far')
  })

  it('asks for a better signal when the reading is too rough to trust', () => {
    const v = evaluateLocation(place, fix({ ...north(3), accuracy: 35 }), rules, NOW)
    expect(!v.ok && v.reason).toBe('inaccurate')
    if (!v.ok) expect(verdictMessage(v, rules)).toContain('not accurate enough')
  })

  it('treats a missing or broken reading as "no location"', () => {
    expect(evaluateLocation(place, null, rules, NOW)).toMatchObject({
      ok: false,
      reason: 'no-location',
    })
    expect(evaluateLocation(place, {}, rules, NOW)).toMatchObject({
      ok: false,
      reason: 'no-location',
    })
    expect(evaluateLocation(place, fix({ latitude: 123 }), rules, NOW)).toMatchObject({
      reason: 'invalid',
    })
    expect(evaluateLocation(place, fix({ accuracy: Number.NaN }), rules, NOW)).toMatchObject({
      reason: 'invalid',
    })
  })

  it('refuses an old reading', () => {
    const old = evaluateLocation(place, fix({ capturedAt: NOW - 60 * 60 * 1000 }), rules, NOW)
    expect(!old.ok && old.reason).toBe('stale')
    // A phone clock a couple of minutes off is fine.
    expect(evaluateLocation(place, fix({ capturedAt: NOW - 2 * 60 * 1000 }), rules, NOW).ok).toBe(
      true,
    )
  })

  it('uses whatever radius it is given', () => {
    const wide = { radiusMeters: 25, maxAccuracyMeters: 30 }
    expect(evaluateLocation(place, fix({ ...north(20) }), wide, NOW).ok).toBe(true)
  })
})
