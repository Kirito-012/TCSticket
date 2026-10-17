/**
 * Decides whether a cleanup photo still shows too much garbage. The detection service measures
 * what percent of the picture the garbage covers; a photo is accepted when that is BELOW the limit.
 */

export type GarbageVerdict = { ok: true } | { ok: false; message: string }

/** Accepted only when garbage covers less than `maxPercent` of the picture and fewer than `maxItems` items are found. */
export function garbageVerdict(
  coveragePercent: number,
  maxPercent: number,
  detections = 0,
  maxItems = Infinity,
): GarbageVerdict {
  if (!Number.isFinite(coveragePercent) || coveragePercent < 0) {
    return { ok: false, message: 'We could not check this photo. Please try again.' }
  }
  // Garbage is many small items, so the share of the picture stays low even for a dirty place:
  // a photo is also refused when the model finds too many separate items.
  if (detections >= maxItems) {
    return {
      ok: false,
      message: `Garbage is still visible in this photo (${detections} items found). Please clean the area, then take the photo again. The ticket is not done yet.`,
    }
  }
  if (coveragePercent < maxPercent) return { ok: true }
  return {
    ok: false,
    message: `Garbage is still visible in this photo (about ${Math.round(coveragePercent)}% of the picture). Please clean the area, then take the photo again. The ticket is not done yet.`,
  }
}
