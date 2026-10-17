import Link from 'next/link'
import { ChevronRight, UserCheck } from 'lucide-react'
import { CountPill, DoneBar } from '@/components/zones/Counts'
import type { ZoneSummary } from '@/server/services/sector.service'

/**
 * The Admin's first look at the whole Kumbh: the four zones side by side, with who inspects each
 * one and where the work is piling up. Tapping a zone opens that zone's own dashboard.
 */
export function ZoneCards({ zones }: { zones: ZoneSummary[] }) {
  return (
    <section className="space-y-3" aria-labelledby="zones-heading">
      <h2 id="zones-heading" className="text-xl font-bold text-foreground">
        The four zones
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {zones.map((zone) => (
          <Link
            key={zone.key}
            href={`/zones/${zone.key}`}
            className="group flex flex-col gap-4 rounded-2xl border-2 border-border-strong bg-surface p-5 transition-colors hover:border-accent"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-2xl font-bold text-foreground">{zone.name}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-base text-muted">
                  <UserCheck className="h-4 w-4 shrink-0" strokeWidth={2.25} />
                  <span className="truncate">
                    {zone.inspectors.length > 0
                      ? zone.inspectors.join(', ')
                      : 'No Zone Inspector yet'}
                  </span>
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-1 text-base font-semibold text-muted group-hover:text-accent-strong">
                {zone.sectorCount} sectors
                <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2 md:grid-cols-2 2xl:grid-cols-4">
              <CountPill label="Open" value={zone.open} />
              <CountPill label="Need someone" value={zone.unassigned} tone="warning" />
              <CountPill label="Urgent" value={zone.urgent} tone="danger" />
              <CountPill label="Waiting" value={zone.waiting} tone="warning" />
            </div>

            <DoneBar done={zone.done} total={zone.total} />
          </Link>
        ))}
      </div>
    </section>
  )
}
