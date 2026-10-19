'use client'

import { ShieldCheck, ShieldQuestion } from 'lucide-react'
import { useT } from '@/i18n/client'
import { cn } from '@/lib/utils'
import type { VerificationStatus } from '@/lib/ticket-view'

/**
 * The small tag under "Resolved": "Verified" once the cleanup has been checked, "Not verified"
 * until then. Only finished tickets have one, so pass nothing for an unfinished ticket.
 */
export function VerificationBadge({
  status,
  className,
}: {
  status: VerificationStatus | null | undefined
  className?: string
}) {
  const t = useT()
  if (!status) return null
  const verified = status === 'verified'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-base font-semibold',
        verified
          ? 'border-accent bg-accent-soft text-accent-strong'
          : 'border-border-strong bg-surface text-muted-strong',
        className,
      )}
    >
      {verified ? (
        <ShieldCheck className="h-4 w-4" strokeWidth={2.5} aria-hidden />
      ) : (
        <ShieldQuestion className="h-4 w-4" strokeWidth={2.5} aria-hidden />
      )}
      {verified ? t('Verified') : t('Not verified')}
    </span>
  )
}
