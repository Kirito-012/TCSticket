import { notFound } from 'next/navigation'
import { ScopedDashboard } from '@/components/zones/ScopedDashboard'
import { requireTicketScope } from '@/server/auth/session'
import { scopeAllows, type TicketScope } from '@/lib/ticket-scope'
import { sectorKeyOf, zoneOfSectorNo } from '@/lib/zones'

/** One sector's dashboard: for an Admin, the Zone Inspector of its zone, or its Nodal Manager. */
export default async function SectorPage({ params }: { params: Promise<{ sector: string }> }) {
  const { sector } = await params
  const sectorNo = Number(sector)
  const zone = Number.isInteger(sectorNo) ? zoneOfSectorNo(sectorNo) : null
  if (!zone) notFound()

  const { scope, ability } = await requireTicketScope()
  const sectorKey = sectorKeyOf(sectorNo)
  // A Surveyor never gets here, and nobody sees a sector outside their zone / sector.
  if (scope.kind === 'own' || !scopeAllows(scope, { sectorKey })) notFound()

  const sectorScope: TicketScope = { kind: 'sectors', level: 'sector', sectorKeys: [sectorKey] }
  const backHref =
    scope.kind === 'all' ? `/zones/${zone.key}` : scope.level === 'zone' ? '/dashboard' : undefined
  return (
    <ScopedDashboard
      scope={sectorScope}
      view={{ kind: 'sector', sectorKey }}
      canAssign={ability.can('assign', 'ticket')}
      canCreate={ability.can('create', 'ticket')}
      backHref={backHref}
    />
  )
}
