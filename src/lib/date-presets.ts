/**
 * Quick date choices for the Admin ticket filters (Today, Yesterday, Last 7 / 30 days), shared by
 * the wide inline filter row and the phone filter sheet. Each is a from/to pair counted back from
 * today, as local calendar days (YYYY-MM-DD). Plain data and functions — safe in client code.
 */

const DAY_MS = 24 * 60 * 60 * 1000

/** A local calendar day as YYYY-MM-DD, `daysAgo` days before today. */
export function isoDaysAgo(daysAgo: number) {
  const d = new Date(Date.now() - daysAgo * DAY_MS)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const DATE_PRESETS = [
  { label: 'Today', from: () => isoDaysAgo(0), to: () => isoDaysAgo(0) },
  { label: 'Yesterday', from: () => isoDaysAgo(1), to: () => isoDaysAgo(1) },
  { label: 'Last 7 days', from: () => isoDaysAgo(6), to: () => isoDaysAgo(0) },
  { label: 'Last 30 days', from: () => isoDaysAgo(29), to: () => isoDaysAgo(0) },
]

/** The preset that exactly matches a from/to pair, if any. */
export function activeDatePreset(from: string, to: string) {
  return DATE_PRESETS.find((p) => p.from() === from && p.to() === to)
}
