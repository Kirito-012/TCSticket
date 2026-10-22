'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, ShieldCheck, ShieldQuestion } from 'lucide-react'
import { setVerificationAction } from '@/server/actions/ticket.actions'
import { cn } from '@/lib/utils'
import type { VerificationStatus } from '@/lib/ticket-view'
import { useT } from '@/i18n/client'

/**
 * For leads (Admin, Zone Inspector, Nodal Manager) on a finished ticket: say by hand whether the
 * cleanup has been checked. This stands in until the drone re-flight does it automatically.
 */
export function VerificationControl({
  ticketNumber,
  status,
}: {
  ticketNumber: number
  status: VerificationStatus
}) {
  const t = useT()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function choose(verified: boolean) {
    setError(null)
    startTransition(async () => {
      const result = await setVerificationAction(ticketNumber, verified)
      if (result?.error) setError(result.error)
      else router.refresh()
    })
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-muted">{t('Was the cleanup checked?')}</p>
      <div
        role="group"
        aria-label={t('Verification')}
        className="inline-flex overflow-hidden rounded-2xl border-2 border-border-strong"
      >
        {(
          [
            { verified: false, label: 'Not verified', icon: ShieldQuestion },
            { verified: true, label: 'Verified', icon: ShieldCheck },
          ] as const
        ).map(({ verified, label, icon: Icon }) => {
          const active = (status === 'verified') === verified
          return (
            <button
              key={label}
              type="button"
              aria-pressed={active}
              disabled={pending}
              onClick={() => !active && choose(verified)}
              className={cn(
                'inline-flex min-h-12 cursor-pointer items-center gap-2 px-4 text-base font-bold transition-colors disabled:opacity-60',
                active
                  ? verified
                    ? 'bg-accent text-on-accent'
                    : 'bg-surface-hover text-foreground'
                  : 'bg-surface text-muted-strong hover:bg-surface-hover',
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={2.25} />
              {t(label)}
            </button>
          )
        })}
      </div>
      <p className="text-sm text-muted">
        {t('A drone re-check sets this automatically. You can also set it by hand here.')}
      </p>
      {error && (
        <p className="flex items-center gap-2 text-base font-semibold text-danger" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}
