/**
 * Decides whether a cleanup photo still shows too much garbage. The detection service measures
 * what percent of the picture the garbage covers; a photo is accepted when that is BELOW the limit.
 */

import { makeTranslate, type Translate } from '../i18n/config'

export type GarbageVerdict = { ok: true } | { ok: false; message: string }

/** Accepted only when garbage covers less than `maxPercent` of the picture and fewer than `maxItems` items are found. */
export function garbageVerdict(
  coveragePercent: number,
  maxPercent: number,
  detections = 0,
  maxItems = Infinity,
  t: Translate = makeTranslate({}),
): GarbageVerdict {
  if (!Number.isFinite(coveragePercent) || coveragePercent < 0) {
    return { ok: false, message: t('We could not check this photo. Please try again.') }
  }
  // Garbage is many small items, so the share of the picture stays low even for a dirty place:
  // a photo is also refused when the model finds too many separate items.
  if (detections >= maxItems) {
    return {
      ok: false,
      message: t(
        'Garbage is still visible in this photo ({count} items found). Please clean the area, then take the photo again. The ticket is not done yet.',
        { count: detections },
      ),
    }
  }
  if (coveragePercent < maxPercent) return { ok: true }
  return {
    ok: false,
    message: t(
      'Garbage is still visible in this photo (about {percent}% of the picture). Please clean the area, then take the photo again. The ticket is not done yet.',
      { percent: Math.round(coveragePercent) },
    ),
  }
}
