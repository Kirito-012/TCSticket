'use client'

import dynamic from 'next/dynamic'
import { MapPin } from 'lucide-react'
import { useT } from '@/i18n/client'

const HrdaSectorMap = dynamic(
  () => import('./HrdaSectorMap').then((module) => module.HrdaSectorMap),
  {
    ssr: false,
    loading: () => <div className="h-full min-h-[320px] w-full animate-pulse bg-[#0a0d12]" />,
  },
)

type Sector = {
  key: string
  sectorNo: number
  name: string
  minLatitude: number
  maxLatitude: number
  minLongitude: number
  maxLongitude: number
  color: string
  count: number
  openCount: number
  canFilter: boolean
}

export function GarbageHeatmap({
  sectors,
  canFilter,
}: {
  sectors: Omit<Sector, 'canFilter'>[]
  canFilter: boolean
}) {
  const t = useT()
  const total = sectors.reduce((sum, sector) => sum + sector.count, 0)
  return (
    <div className="grid grid-cols-1 overflow-hidden rounded-b-2xl lg:grid-cols-[1fr_280px]">
      <div className="relative min-h-[240px] overflow-hidden sm:min-h-[320px] border-b border-border bg-[#0a0d12] lg:border-b-0 lg:border-r">
        <HrdaSectorMap sectors={sectors} canFilter={canFilter} />
        <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-1.5 rounded-lg border border-border bg-background/80 px-2.5 py-1.5 backdrop-blur-sm">
          <MapPin className="h-3 w-3 text-muted" />
          <span className="text-[11px] font-medium text-muted-strong">
            {t('HRDA sector routing')}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3 p-4 sm:gap-4 sm:p-5">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted/70">
            {t('Detected tickets')}
          </p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{total}</p>
          <p className="text-xs text-muted">{t('automatically routed by GPS')}</p>
        </div>
        {/* 32 sectors would add a screen+ of scrolling on a phone — keep the list in its own
            scroll area there, full height on desktop. */}
        <div className="flex max-h-52 flex-col gap-3 overflow-y-auto pr-1 lg:max-h-none lg:overflow-visible lg:pr-0">
          {sectors.map((sector) => (
            <div
              key={sector.key}
              className="flex items-center justify-between border-b border-border pb-3 last:border-b-0 last:pb-0"
            >
              <span className="text-xs text-muted-strong">{sector.name}</span>
              <span className="text-sm font-semibold" style={{ color: sector.color }}>
                {sector.count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
