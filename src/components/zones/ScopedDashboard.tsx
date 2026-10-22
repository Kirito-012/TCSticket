import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Topbar } from '@/components/layout/Topbar'
import { AdminHome } from '@/components/admin/AdminHome'
import { AdminOverview } from '@/components/admin/AdminOverview'
import { SectorGrid } from '@/components/zones/SectorGrid'
import { SectorTeam } from '@/components/zones/SectorTeam'
import { ZoneCards } from '@/components/zones/ZoneCards'
import { loadScopedDashboard } from '@/server/services/dashboard.service'
import { getZoneSummaries } from '@/server/services/sector.service'
import { toTicketListItem } from '@/lib/ticket-view'
import { zoneByKey } from '@/lib/zones'
import type { TicketScope } from '@/lib/ticket-scope'
import { getT } from '@/i18n/server'

export type DashboardView =
  { kind: 'admin' } | { kind: 'zone'; zoneKey: string } | { kind: 'sector'; sectorKey: string }

/**
 * One dashboard, three sizes. The whole Kumbh for an Admin (with the four zones on top), one zone
 * for a Zone Inspector (with its sectors), one sector for a Nodal Manager (with its team). The
 * numbers, "needs someone" list, map and charts are the same everywhere — only what they cover
 * changes with `scope`.
 */
export async function ScopedDashboard({
  scope,
  view,
  canAssign,
  canCreate,
  backHref,
}: {
  scope: TicketScope
  view: DashboardView
  canAssign: boolean
  canCreate: boolean
  /** Shown as a "back" link, for an Admin looking into one zone or sector. */
  backHref?: string
}) {
  const data = await loadScopedDashboard(scope, canAssign)
  const t = await getT()

  let title = t('Dashboard')
  let description = t('What needs your attention today')
  let extra: React.ReactNode = null

  if (view.kind === 'admin') {
    const zones = await getZoneSummaries()
    extra = <ZoneCards zones={zones} />
  } else if (view.kind === 'zone') {
    const zone = zoneByKey(view.zoneKey)
    title = zone?.name ?? t('Zone')
    description = t('{count} sectors · what needs your attention today', {
      count: data.sectors.length,
    })
    extra = <SectorGrid sectors={data.sectors} title={t('Sectors in {name}', { name: title })} />
  } else {
    const sector = data.sectors.find((s) => s.key === view.sectorKey)
    title = sector?.name ?? t('Sector')
    description = sector
      ? t('Sector {n} · what needs your attention today', { n: sector.sectorNo })
      : t('Sector')
    extra = sector ? <SectorTeam sector={sector} /> : null
  }

  return (
    <>
      <Topbar
        title={title}
        description={description}
        primaryAction={canCreate ? { label: t('New ticket'), href: '/tickets/new' } : undefined}
      />
      <main className="flex-1 px-4 py-6 animate-fade-in sm:px-8">
        {backHref && (
          <div className="mx-auto mb-4 w-full max-w-6xl">
            <Link
              href={backHref}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-border-strong bg-surface px-4 text-base font-bold text-foreground"
            >
              <ArrowLeft className="h-5 w-5" strokeWidth={2.5} />
              {t('Back')}
            </Link>
          </div>
        )}
        <AdminHome
          counts={data.counts}
          kpis={data.kpis}
          needsAssigning={data.needing.items.map(toTicketListItem)}
          users={data.people.map((u) => ({
            id: String(u._id),
            name: u.fullname || u.email || 'Unknown',
          }))}
          canAssign={canAssign}
          extra={extra}
        />
        <div className="mx-auto mt-6 w-full max-w-6xl">
          <AdminOverview data={data.overview} canFilter />
        </div>
      </main>
    </>
  )
}
