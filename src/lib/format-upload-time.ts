// A fixed zone, so the server and the browser print the same text (no hydration mismatch) and
// everyone sees the time as it was on the ground, in India.
const TIME_ZONE = 'Asia/Kolkata'

type Formatters = {
  full: Intl.DateTimeFormat
  date: Intl.DateTimeFormat
  time: Intl.DateTimeFormat
}
const cache = new Map<string, Formatters>()

/** The three formatters for a language (cached; building them is the slow part). */
function formattersFor(locale: string): Formatters {
  let found = cache.get(locale)
  if (!found) {
    found = {
      full: new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: TIME_ZONE,
      }),
      date: new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: TIME_ZONE,
      }),
      time: new Intl.DateTimeFormat(locale, {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: TIME_ZONE,
      }),
    }
    cache.set(locale, found)
  }
  return found
}

/** "12 Oct 2026, 3:42 pm" — empty text when there is no time. `locale` is e.g. 'hi-IN'. */
export function formatUploadTime(iso: string | null | undefined, locale = 'en-IN'): string {
  if (!iso) return ''
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : formattersFor(locale).full.format(date)
}

/** The date and the time as separate pieces, so they can be styled differently. */
export function formatUploadParts(
  iso: string | null | undefined,
  locale = 'en-IN',
): { date: string; time: string } | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const f = formattersFor(locale)
  return { date: f.date.format(d), time: f.time.format(d) }
}
