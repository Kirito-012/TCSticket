import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536000],
  ['month', 2592000],
  ['week', 604800],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
]

const rtfCache = new Map<string, Intl.RelativeTimeFormat>()
function relativeFormatter(locale: string) {
  let rtf = rtfCache.get(locale)
  if (!rtf) {
    rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'narrow' })
    rtfCache.set(locale, rtf)
  }
  return rtf
}

/**
 * "3 hr. ago" style text. Pass the person's language (`locale`, e.g. 'hi-IN') and the translated
 * "just now" to have it in their language; without them it is English.
 */
export function timeAgo(date: Date | string, options?: { locale?: string; justNow?: string }) {
  const rtf = relativeFormatter(options?.locale ?? 'en')
  const justNow = options?.justNow ?? 'just now'
  const seconds = Math.round((new Date(date).getTime() - Date.now()) / 1000)
  const abs = Math.abs(seconds)

  if (abs < 60) return justNow

  for (const [unit, secondsInUnit] of UNITS) {
    if (abs >= secondsInUnit) {
      return rtf.format(Math.round(seconds / secondsInUnit), unit)
    }
  }
  return justNow
}

export function initialsFor(name: string | null | undefined) {
  const parts = (name ?? '').trim().split(/\s+/)
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}
