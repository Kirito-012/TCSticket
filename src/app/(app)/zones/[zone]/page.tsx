import { notFound } from 'next/navigation'
import { ScopedDashboard } from '@/components/zones/ScopedDashboard'
import { requireTicketScope } from '@/server/auth/session'
import { sectorKeysOfZone, zoneByKey } from '@/lib/zones'
import type { TicketScope } from '@/lib/ticket-scope'

/** One zone's dashboard: for an Admin (any zone) or the Zone Inspector of that zone. */
export default async function ZonePage({ params }: { params: Promise<{ zone: string }> }) {
  const { zone: zoneKey } = await params
  const zone = zoneByKey(zoneKey)
  if (!zone) notFound()

  const { scope, placement, ability } = await requireTicketScope()
  const isAdmin = scope.kind === 'all'
  const isThisZonesInspector =
    scope.kind === 'sectors' && scope.level === 'zone' && placement.zoneKey === zone.key
  if (!isAdmin && !isThisZonesInspector) notFound()

  const zoneScope: TicketScope = {
    kind: 'sectors',
    level: 'zone',
    sectorKeys: sectorKeysOfZone(zone.key),
  }
  return (
    <ScopedDashboard
      scope={zoneScope}
      view={{ kind: 'zone', zoneKey: zone.key }}
      canAssign={ability.can('assign', 'ticket')}
      canCreate={ability.can('create', 'ticket')}
      backHref={isAdmin ? '/dashboard' : undefined}
    />
  )
}
