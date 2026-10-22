import Link from 'next/link'
import { ChevronRight, HardHat, UserCog } from 'lucide-react'
import { CountPill, DoneBar } from '@/components/zones/Counts'
import type { SectorSummary } from '@/server/services/sector.service'
import { getT } from '@/i18n/server'

/**
 * The sectors of a zone as cards: who looks after each one (Nodal Manager and Surveyors) and how
 * much is open, waiting for someone, urgent or old. Tapping one opens that sector's dashboard.
 */
export async function SectorGrid({
  sectors,
  title = 'Sectors',
}: {
  sectors: SectorSummary[]
  title?: string
}) {
  const t = await getT()
  if (sectors.length === 0) return null
  return (
    <section className="space-y-3" aria-labelledby="sectors-heading">
      <h2 id="sectors-heading" className="text-xl font-bold text-foreground">
        {title}
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {sectors.map((sector) => (
          <Link
            key={sector.key}
            href={`/sectors/${sector.sectorNo}`}
            className="group flex flex-col gap-3 rounded-2xl border-2 border-border-strong bg-surface p-4 transition-colors hover:border-accent"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-xl font-bold text-foreground">{sector.name}</p>
                <p className="text-sm text-muted">{t('Sector {n}', { n: sector.sectorNo })}</p>
              </div>
              <ChevronRight
                className="mt-1 h-5 w-5 shrink-0 text-muted group-hover:text-accent-strong"
                strokeWidth={2.5}
              />
            </div>

            <div className="space-y-1 text-base text-muted">
              <p className="flex items-center gap-2">
                <UserCog className="h-4 w-4 shrink-0" strokeWidth={2.25} />
                <span className="truncate">
                  {sector.nodalManagers.length > 0
                    ? sector.nodalManagers.join(', ')
                    : t('No Nodal Manager yet')}
                </span>
              </p>
              <p className="flex items-center gap-2">
                <HardHat className="h-4 w-4 shrink-0" strokeWidth={2.25} />
                <span className="truncate">
                  {sector.surveyors.length > 0
                    ? sector.surveyors.map((s) => s.name).join(', ')
                    : t('No Surveyor yet')}
                </span>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-3 2xl:grid-cols-6">
              <CountPill label={t('Open')} value={sector.open} />
              <CountPill label={t('Need someone')} value={sector.unassigned} tone="warning" />
              <CountPill label={t('Urgent')} value={sector.urgent} tone="danger" />
              <CountPill label={t('Waiting')} value={sector.waiting} tone="warning" />
              <CountPill label={t('Reopened')} value={sector.reopened} tone="danger" />
              <CountPill label={t('Not verified')} value={sector.unverified} tone="warning" />
            </div>

            <DoneBar done={sector.done} total={sector.total} />
          </Link>
        ))}
      </div>
    </section>
  )
}
