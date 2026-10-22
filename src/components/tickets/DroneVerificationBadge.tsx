'use client'

import { Plane } from 'lucide-react'
import { useT } from '@/i18n/client'
import { cn } from '@/lib/utils'
import type { VerificationStatus } from '@/lib/ticket-view'

/**
 * The drone's own tag, next to the manual Verified / Not verified one: "Drone verified" once a drone
 * re-check photo of the place was clean, "Not drone verified" until then. Only finished tickets have one.
 */
export function DroneVerificationBadge({
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
          ? 'border-info bg-info-soft text-info'
          : 'border-border-strong bg-surface text-muted-strong',
        className,
      )}
    >
      <Plane className="h-4 w-4" strokeWidth={2.5} aria-hidden />
      {verified ? t('Drone verified') : t('Not drone verified')}
    </span>
  )
}
