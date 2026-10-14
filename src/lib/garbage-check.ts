/**
 * Decides whether a cleanup photo still shows too much garbage. The detection service measures
 * what percent of the picture the garbage covers; a photo is accepted when that is BELOW the limit.
 */

export type GarbageVerdict = { ok: true } | { ok: false; message: string }

/** Accepted only when the garbage covers less than `maxPercent` of the picture. */
export function garbageVerdict(coveragePercent: number, maxPercent: number): GarbageVerdict {
  if (!Number.isFinite(coveragePercent) || coveragePercent < 0) {
    return { ok: false, message: 'We could not check this photo. Please try again.' }
  }
  if (coveragePercent < maxPercent) return { ok: true }
  return {
    ok: false,
    message: `Garbage is still visible in this photo (about ${Math.round(coveragePercent)}% of the picture). Please clean the area, then take the photo again. The ticket is not done yet.`,
  }
}
