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
 * Asks the phone for its GPS position (this is what makes the browser ask "Allow location?") and keeps
 * listening, because the first reading is usually rough and GPS gets better as the phone finds more
 * satellites. How it picks the answer:
 *  - readings the phone had cached from before the request are thrown away (they can be old Wi-Fi guesses);
 *  - it stops at once on an excellent reading (5 m or better);
 *  - once a reading is good (20 m or better) it keeps listening for a few more seconds, because the next
 *    readings are usually better, then stops;
 *  - the answer is the average of the best recent readings, weighted by how sure each one was, which
 *    smooths out the jitter of a single reading, and it reports the best accuracy seen;
 *  - a first GPS lock can take 20-40 seconds outdoors, so it waits up to 40 seconds; if all it ever got
 *    was a rough network guess (more than 100 m off) it says so instead of returning that guess.
 */
export function getBestPosition({
  excellentMeters = 5,
  goodMeters = 20,
  settleMs = 6_000,
  timeoutMs = 40_000,
  onProgress,
}: {
  excellentMeters?: number
  goodMeters?: number
  /** How long to keep listening after the first good reading, for a better one. */
  settleMs?: number
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
    const startedAt = Date.now()
    type Reading = { latitude: number; longitude: number; accuracy: number; at: number }
    const readings: Reading[] = []
    let settled = false
    let watchId = -1
    let settleTimer: ReturnType<typeof setTimeout> | undefined

    const bestAccuracy = () => readings.reduce((m, r) => Math.min(m, r.accuracy), Infinity)

    /** Weighted average of the recent readings that are about as good as the best one. */
    function combined(): LocationFix | null {
      if (readings.length === 0) return null
      const best = bestAccuracy()
      const now = Date.now()
      const usable = readings.filter(
        (r) => now - r.at <= 20_000 && r.accuracy <= Math.max(best * 2, goodMeters),
      )
      const pool = usable.length > 0 ? usable : readings.filter((r) => r.accuracy === best)
      let weight = 0
      let latitude = 0
      let longitude = 0
      for (const r of pool) {
        const w = 1 / Math.max(r.accuracy, 1) ** 2
        weight += w
        latitude += r.latitude * w
        longitude += r.longitude * w
      }
      return {
        latitude: latitude / weight,
        longitude: longitude / weight,
        accuracy: best,
        capturedAt: now,
      }
    }

    function finishWithReadings() {
      const fix = combined()
      if (!fix) return finish({ ok: false, reason: 'timeout' })
      if (fix.accuracy > ROUGH_ACCURACY_METERS) {
        return finish({ ok: false, reason: 'rough', accuracy: fix.accuracy })
      }
      finish({ ok: true, fix })
    }

    function finish(outcome: PositionOutcome) {
      if (settled) return
      settled = true
      if (watchId !== -1) navigator.geolocation.clearWatch(watchId)
      clearTimeout(timer)
      clearTimeout(settleTimer)
      resolve(outcome)
    }

    const timer = setTimeout(finishWithReadings, timeoutMs)

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        // A reading the phone made before we asked is not a measurement of where the person is now.
        if (position.timestamp < startedAt - 1_500) return
        const { latitude, longitude, accuracy } = position.coords
        readings.push({ latitude, longitude, accuracy, at: Date.now() })
        onProgress?.(accuracy)
        if (accuracy <= excellentMeters) return finishWithReadings()
        if (accuracy <= goodMeters && settleTimer === undefined) {
          settleTimer = setTimeout(finishWithReadings, settleMs)
        }
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) return finish({ ok: false, reason: 'denied' })
        if (readings.length > 0) return finishWithReadings() // a rough reading is better than none
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
