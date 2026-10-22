import type { LocationFix } from '@/lib/geo'
import { makeTranslate, type Translate } from '../i18n/config'

/** 850 -> "850 m", 3200 -> "3.2 km". */
export function formatMeters(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)} km` : `${Math.max(1, Math.round(n))} m`
}

/** A reading worse than this (metres) is only a network guess, often kilometres off: never trusted. */
export const ROUGH_ACCURACY_METERS = 100

export type PositionOutcome =
  | { ok: true; fix: LocationFix }
  | { ok: false; reason: 'denied' | 'unavailable' | 'timeout' | 'unsupported' }
  // The page is not served over https, where browsers (iPhones above all) never ask for location.
  | { ok: false; reason: 'insecure' }
  // Only a rough reading came in (Wi-Fi / mobile network, not GPS): too poor to say where the person is.
  | { ok: false; reason: 'rough'; accuracy: number }

/**
 * Asks the phone where it is (this is what makes the browser ask "Allow location?") and keeps
 * listening for a few seconds, because the first reading is usually rough and GPS gets better as the
 * phone finds more satellites. It stops as soon as a reading is good enough, or when time runs out,
 * and then returns the best reading it saw. A first GPS lock can take 20-40 seconds outdoors, so it
 * waits up to 40 seconds; if all it ever got was a rough network guess (more than 100 m off) it says
 * so instead of returning that guess, because such a guess can be kilometres from the real place.
 */
export function getBestPosition({
  goodEnoughMeters = 8,
  timeoutMs = 40_000,
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
  // Safari on iPhone (and every other browser) only shares location with a secure page (https or localhost).
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    return Promise.resolve({ ok: false, reason: 'insecure' })
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
      () =>
        finish(
          !best
            ? { ok: false, reason: 'timeout' }
            : best.coords.accuracy > ROUGH_ACCURACY_METERS
              ? { ok: false, reason: 'rough', accuracy: best.coords.accuracy }
              : fixFrom(best),
        ),
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
        if (best) {
          return finish(
            best.coords.accuracy > ROUGH_ACCURACY_METERS
              ? { ok: false, reason: 'rough', accuracy: best.coords.accuracy }
              : fixFrom(best),
          )
        }
        finish({ ok: false, reason: error.code === error.TIMEOUT ? 'timeout' : 'unavailable' })
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: timeoutMs },
    )
  })
}

/** Plain-words advice for a failed location request. */
export function positionProblemMessage(
  reason: 'denied' | 'unavailable' | 'timeout' | 'unsupported' | 'rough' | 'insecure',
  t: Translate = makeTranslate({}),
  accuracy?: number,
) {
  switch (reason) {
    case 'insecure':
      return t(
        'Location only works on a secure page. Please open this website with https:// and try again.',
      )
    case 'rough':
      return t(
        'We could only find your location roughly (about {accuracy}). Your device is probably using Wi-Fi or the mobile network instead of GPS. Turn on GPS and High accuracy location, go outside where the sky is open, and try again.',
        { accuracy: formatMeters(accuracy ?? ROUGH_ACCURACY_METERS) },
      )
    case 'denied':
      return t(
        'Location is turned off for this website. On iPhone: open Settings, then Privacy & Security, Location Services, Safari Websites, and choose While Using the App. On Android: tap the lock icon next to the web address and set Location to "Allow". Then try again.',
      )
    case 'unsupported':
      return t(
        'This phone or browser cannot share its location, so the photo cannot be checked. Please use a phone with location.',
      )
    case 'timeout':
      return t(
        'We could not find your location in time. Go outside where the sky is open, make sure Location is on, and try again.',
      )
    default:
      return t(
        'We could not read your location. Make sure Location is turned on in your phone settings, then try again.',
      )
  }
}
