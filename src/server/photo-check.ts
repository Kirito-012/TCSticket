import 'server-only'

import { logger } from '@/lib/logger'

export type PhotoCheckResult =
  | { status: 'ok'; coveragePercent: number; detections: number }
  | { status: 'unavailable'; reason: string }
  /** No detection service is set up (PHOTO_CHECK_URL is empty): the garbage check is switched off. */
  | { status: 'off' }

function readNumber(raw: string | undefined, fallback: number, min: number, max: number) {
  const n = Number(raw)
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback
}

/**
 * The garbage check's settings.
 *  - PHOTO_CHECK_URL: where the detection service is (empty = the check is off).
 *  - PHOTO_MAX_GARBAGE_PERCENT: a photo is accepted when garbage covers LESS than this (default 15).
 *  - PHOTO_CHECK_STRICT=true: if the service cannot be reached, refuse the photo instead of
 *    accepting it unchecked (default: accept, and mark it "not checked").
 */
export function photoRules() {
  return {
    enabled: Boolean(process.env.PHOTO_CHECK_URL),
    maxGarbagePercent: readNumber(process.env.PHOTO_MAX_GARBAGE_PERCENT, 15, 1, 100),
    strict: process.env.PHOTO_CHECK_STRICT === 'true',
  }
}

/** Sends the photo to the detection service and reads back how much of it is garbage. */
export async function checkPhotoForGarbage(file: File): Promise<PhotoCheckResult> {
  const base = process.env.PHOTO_CHECK_URL
  if (!base) return { status: 'off' }

  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/check-photo`, {
      method: 'POST',
      headers: {
        'content-type': file.type || 'image/jpeg',
        ...(process.env.PHOTO_CHECK_KEY ? { 'x-api-key': process.env.PHOTO_CHECK_KEY } : {}),
      },
      body: Buffer.from(await file.arrayBuffer()),
      signal: AbortSignal.timeout(60_000),
    })
    if (!res.ok) {
      logger.error({ status: res.status }, 'The photo check service refused the photo')
      return { status: 'unavailable', reason: `service answered ${res.status}` }
    }
    const data = (await res.json()) as { coverage_percent?: number; detections?: number }
    if (typeof data.coverage_percent !== 'number' || !Number.isFinite(data.coverage_percent)) {
      return { status: 'unavailable', reason: 'unreadable answer' }
    }
    return {
      status: 'ok',
      coveragePercent: data.coverage_percent,
      detections: typeof data.detections === 'number' ? data.detections : 0,
    }
  } catch (err) {
    logger.error({ err }, 'Could not reach the photo check service')
    return { status: 'unavailable', reason: 'could not reach the service' }
  }
}
