import type { LocationFix } from '@/lib/geo'

export type PositionOutcome =
  | { ok: true; fix: LocationFix }
  | { ok: false; reason: 'denied' | 'unavailable' | 'timeout' | 'unsupported' }

/**
 * Asks the phone where it is (this is what makes the browser ask "Allow location?") and keeps
 * listening for a few seconds, because the first reading is usually rough and GPS gets better as the
 * phone finds more satellites. It stops as soon as a reading is good enough, or when time runs out,
 * and then returns the best reading it saw.
 */
export function getBestPosition({
  goodEnoughMeters = 8,
  timeoutMs = 15_000,
  onProgress,
}: {
  goodEnoughMeters?: number
  timeoutMs?: number
  /** Called with the accuracy (metres) of each reading, so the screen can show progress. */
  onProgress?: (accuracyMeters: number) => void
} = {}): Promise<PositionOutcome> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return Promise.resolve({ ok: false, reason: 'unsupported' })
  }

  return new Promise((resolve) => {
    let best: GeolocationPosition | null = null
    let settled = false
    let watchId = -1

    function fixFrom(position: GeolocationPosition): PositionOutcome {
      return {
        ok: true,
        fix: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          capturedAt: Date.now(),
        },
      }
    }
    function finish(outcome: PositionOutcome) {
      if (settled) return
      settled = true
      if (watchId !== -1) navigator.geolocation.clearWatch(watchId)
      clearTimeout(timer)
      resolve(outcome)
    }

    const timer = setTimeout(
      () => finish(best ? fixFrom(best) : { ok: false, reason: 'timeout' }),
      timeoutMs,
    )

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (!best || position.coords.accuracy < best.coords.accuracy) best = position
        onProgress?.(position.coords.accuracy)
        if (position.coords.accuracy <= goodEnoughMeters) finish(fixFrom(position))
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) return finish({ ok: false, reason: 'denied' })
        if (best) return finish(fixFrom(best)) // a rough reading is better than none
        finish({ ok: false, reason: error.code === error.TIMEOUT ? 'timeout' : 'unavailable' })
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: timeoutMs },
    )
  })
}

/** Plain-words advice for a failed location request. */
export function positionProblemMessage(
  reason: 'denied' | 'unavailable' | 'timeout' | 'unsupported',
) {
  switch (reason) {
    case 'denied':
      return 'Location is turned off for this website. Tap the lock icon next to the web address, set Location to "Allow", then try again.'
    case 'unsupported':
      return 'This phone or browser cannot share its location, so the photo cannot be checked. Please use a phone with location.'
    case 'timeout':
      return 'We could not find your location in time. Go outside where the sky is open, make sure Location is on, and try again.'
    default:
      return 'We could not read your location. Make sure Location is turned on in your phone settings, then try again.'
  }
}
