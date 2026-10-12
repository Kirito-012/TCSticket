const formatter = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  // A fixed zone, so the server and the browser print the same text (no hydration mismatch) and
  // everyone sees the time as it was on the ground, in India.
  timeZone: 'Asia/Kolkata',
})

/** "12 Oct 2026, 3:42 pm" — empty text when there is no time. */
export function formatUploadTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : formatter.format(date)
}

const dateOnly = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
})
const timeOnly = new Intl.DateTimeFormat('en-IN', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: 'Asia/Kolkata',
})

/** The date and the time as separate pieces, so they can be styled differently. */
export function formatUploadParts(
  iso: string | null | undefined,
): { date: string; time: string } | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return { date: dateOnly.format(d), time: timeOnly.format(d) }
}
