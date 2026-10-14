import 'server-only'

import type { LocationRules } from '@/lib/geo'

function readNumber(raw: string | undefined, fallback: number, min: number, max: number) {
  const n = Number(raw)
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback
}

/**
 * How close a Zone Inspector must be to the ticket's spot for a photo to count, and how rough a
 * phone location reading may be. Defaults: 10 m and 20 m. Change them without touching code with
 * the RESOLVE_RADIUS_METERS and RESOLVE_MAX_ACCURACY_METERS settings.
 */
export function resolveRules(): LocationRules {
  return {
    radiusMeters: readNumber(process.env.RESOLVE_RADIUS_METERS, 10, 1, 1000),
    maxAccuracyMeters: readNumber(process.env.RESOLVE_MAX_ACCURACY_METERS, 20, 1, 500),
  }
}
