'use client'

import { RotateCcw } from 'lucide-react'
import { useT } from '@/i18n/client'
import { cn } from '@/lib/utils'

/** Shown on a ticket that was finished, then reopened because the drone re-check still saw garbage. */
export function ReopenedBadge({ className }: { className?: string }) {
  const t = useT()
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-danger bg-danger-soft px-3 py-1 text-base font-semibold text-danger',
        className,
      )}
    >
      <RotateCcw className="h-4 w-4" strokeWidth={2.5} aria-hidden />
      {t('Reopened')}
    </span>
  )
}
