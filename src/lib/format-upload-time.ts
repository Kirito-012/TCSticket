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
