'use client'

import { useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { MapPin } from 'lucide-react'
import { Select } from '@/components/ui/Select'
import { useT } from '@/i18n/client'
import { cn } from '@/lib/utils'
import type { SectorOption } from '@/components/admin/AdminTicketFilters'

/**
 * Phones only: the sector choice right on the Tickets page, one tap away, instead of buried inside the
 * Filters sheet. (Wider screens have it in the filter row.) It changes the same `sector` setting.
 */
export function SectorQuickFilter({
  sectors,
  sector,
}: {
  sectors: SectorOption[]
  sector: string
}) {
  const t = useT()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  function choose(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set('sector', value)
    else params.delete('sector')
    params.delete('page') // a new sector starts again at page 1
    const qs = params.toString()
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname))
  }

  return (
    <div className={cn('sm:hidden', pending && 'opacity-60')}>
      <p className="mb-1.5 flex items-center gap-2 text-base font-semibold text-muted-strong">
        <MapPin className="h-5 w-5" strokeWidth={2.25} />
        {t('Sector')}
      </p>
      <Select
        size="lg"
        value={sector}
        onChange={choose}
        placeholder={t('All sectors')}
        options={[{ value: '', label: t('All sectors') }, ...sectors]}
      />
    </div>
  )
}
