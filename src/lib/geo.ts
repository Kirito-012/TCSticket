/**
 * Distance and "is this person at the place?" logic, shared by the server (which decides) and the
 * browser (which only warns early, so nobody uploads a photo that will be refused).
 */

import { makeTranslate, type Translate } from '../i18n/config'

export type LatLon = { latitude: number; longitude: number }

/** A reading of the person's phone location. `capturedAt` is a time in milliseconds. */
export type LocationFix = LatLon & { accuracy: number; capturedAt: number }

const EARTH_RADIUS_METERS = 6_371_008.8

const toRadians = (degrees: number) => (degrees * Math.PI) / 180

/** Straight-line distance between two points on the ground, in metres (haversine). */
export function distanceMeters(a: LatLon, b: LatLon): number {
  const dLat = toRadians(b.latitude - a.latitude)
  const dLon = toRadians(b.longitude - a.longitude)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)))
}

export type LocationRules = {
  /** How close to the ticket's point the person must be. */
  radiusMeters: number
  /** A reading less accurate than this is not trusted (the phone is still finding the satellites). */
  maxAccuracyMeters: number
}

/**
 * Phone clocks can be a few minutes off, so a reading only has to be recent, not instant.
 * This is a sanity check against a re-sent old reading, not a security boundary.
 */
export const MAX_FIX_AGE_MS = 10 * 60 * 1000

export type LocationVerdict =
  | { ok: true; distanceMeters: number }
  | {
      ok: false
      reason: 'no-location' | 'invalid' | 'stale' | 'inaccurate' | 'too-far'
      distanceMeters?: number
      accuracyMeters?: number
    }

const inRange = (n: unknown, min: number, max: number): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max

/**
 * Is the person (at `fix`) close enough to `target`?
 *
 * "Too far" is decided first when even the best case is out of reach (the distance is bigger than
 * the radius plus the reading's own error) — there is no point asking someone 400 m away to wait for
 * a better signal. Otherwise a reading that is too rough is "inaccurate", and only a good reading
 * that is simply outside the radius is "too far".
 */
export function evaluateLocation(
  target: LatLon,
  fix: Partial<LocationFix> | null | undefined,
  rules: LocationRules,
  now: number = Date.now(),
): LocationVerdict {
  if (!fix || fix.latitude == null || fix.longitude == null) {
    return { ok: false, reason: 'no-location' }
  }
  if (
    !inRange(fix.latitude, -90, 90) ||
    !inRange(fix.longitude, -180, 180) ||
    !inRange(fix.accuracy, 0, 1_000_000)
  ) {
    return { ok: false, reason: 'invalid' }
  }
  if (
    !inRange(fix.capturedAt, 0, Number.MAX_SAFE_INTEGER) ||
    Math.abs(now - fix.capturedAt) > MAX_FIX_AGE_MS
  ) {
    return { ok: false, reason: 'stale' }
  }

  const distance = distanceMeters(target, { latitude: fix.latitude, longitude: fix.longitude })
  const accuracy = fix.accuracy

  if (distance > rules.radiusMeters + accuracy) {
    return { ok: false, reason: 'too-far', distanceMeters: distance, accuracyMeters: accuracy }
  }
  if (accuracy > rules.maxAccuracyMeters) {
    return { ok: false, reason: 'inaccurate', distanceMeters: distance, accuracyMeters: accuracy }
  }
  if (distance > rules.radiusMeters) {
    return { ok: false, reason: 'too-far', distanceMeters: distance, accuracyMeters: accuracy }
  }
  return { ok: true, distanceMeters: distance }
}

/**
 * Plain-words message for a refused location check (shown to the Surveyor). Pass the translate
 * function to have it in the person's language; without it the message is English.
 */
export function verdictMessage(
  verdict: LocationVerdict,
  rules: LocationRules,
  t: Translate = makeTranslate({}),
): string {
  if (verdict.ok) return ''
  const m = (n: number | undefined) =>
    n === undefined
      ? ''
      : n >= 1000
        ? `${(n / 1000).toFixed(1)} km`
        : `${Math.max(1, Math.round(n))} m`
  switch (verdict.reason) {
    case 'too-far':
      // A reading that is itself kilometres off says little about the distance: say so.
      if ((verdict.accuracyMeters ?? 0) > 100) {
        return t(
          'You are about {distance} from the place, but your location is only accurate to about {accuracy}, so this may be wrong. Turn on GPS, stand in the open, and try again.',
          { distance: m(verdict.distanceMeters), accuracy: m(verdict.accuracyMeters) },
        )
      }
      return t(
        'You are about {distance} from the place. Go to the marked spot (within {radius} m) and take the photo again. The ticket is not done yet.',
        { distance: m(verdict.distanceMeters), radius: rules.radiusMeters },
      )
    case 'inaccurate':
      return t(
        "Your phone's location is not accurate enough yet (about {accuracy}). Stand outside in the open for a moment, then try again.",
        { accuracy: m(verdict.accuracyMeters) },
      )
    case 'stale':
      return t('Your location reading is out of date. Please try again.')
    case 'invalid':
    case 'no-location':
    default:
      return t(
        'We could not read your location. Please allow location for this website, then try again.',
      )
  }
}
