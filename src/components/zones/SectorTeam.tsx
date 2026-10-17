import { HardHat, UserCog } from 'lucide-react'
import type { SectorSummary } from '@/server/services/sector.service'

/** Who works in one sector, and how much each Surveyor has open and finished. */
export function SectorTeam({ sector }: { sector: SectorSummary }) {
  return (
    <section className="space-y-3" aria-labelledby="team-heading">
      <h2 id="team-heading" className="text-xl font-bold text-foreground">
        The team in {sector.name}
      </h2>
      <div className="rounded-2xl border-2 border-border-strong bg-surface">
        <div className="flex items-center gap-3 border-b-2 border-border px-4 py-3">
          <UserCog className="h-6 w-6 shrink-0 text-info" strokeWidth={2.25} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-muted">Nodal Manager</p>
            <p className="truncate text-lg font-bold text-foreground">
              {sector.nodalManagers.length > 0 ? sector.nodalManagers.join(', ') : 'No one yet'}
            </p>
          </div>
        </div>
        {sector.surveyors.length === 0 ? (
          <p className="flex items-center gap-3 px-4 py-4 text-lg text-muted">
            <HardHat className="h-6 w-6 shrink-0" strokeWidth={2.25} />
            No Surveyor in this sector yet
          </p>
        ) : (
          <ul className="divide-y-2 divide-border">
            {sector.surveyors.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="flex min-w-0 items-center gap-3">
                  <HardHat className="h-6 w-6 shrink-0 text-accent-strong" strokeWidth={2.25} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-muted">Surveyor</span>
                    <span className="block truncate text-lg font-bold text-foreground">
                      {s.name}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 text-right text-base">
                  <span className="block font-bold text-foreground">{s.open} open</span>
                  <span className="block text-muted">{s.done} done</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
