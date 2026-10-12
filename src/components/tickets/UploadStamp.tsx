import { CalendarClock } from 'lucide-react'
import { formatUploadParts } from '@/lib/format-upload-time'
import { cn } from '@/lib/utils'

/**
 * A highlighted badge showing when a photo was uploaded: the date in bold, the time beside it.
 * `label` (e.g. "Uploaded") goes in front. Renders nothing when there is no time.
 */
export function UploadStamp({
  at,
  label,
  className,
}: {
  at: string | null | undefined
  label?: string
  className?: string
}) {
  const parts = formatUploadParts(at)
  if (!parts) return null
  return (
    <span
      className={cn(
        'inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-lg border border-accent/40 bg-accent-soft px-2.5 py-1.5 text-sm text-accent-strong',
        className,
      )}
    >
      <CalendarClock className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
      {label && <span className="font-medium">{label}</span>}
      <span className="font-bold">{parts.date}</span>
      <span className="font-semibold">· {parts.time}</span>
    </span>
  )
}
