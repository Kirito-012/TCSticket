import { Topbar } from '@/components/layout/Topbar'
import { InspectorHome } from '@/components/inspector/InspectorHome'
import { NotPlaced } from '@/components/zones/NotPlaced'
import { ScopedDashboard } from '@/components/zones/ScopedDashboard'
import { requireTicketScope } from '@/server/auth/session'
import { getInspectorTasks } from '@/server/services/inspector.service'
import { personShortName } from '@/lib/plain-words'

/**
 * The home screen follows the role:
 *  - Surveyor: a plain list of their own tasks.
 *  - Nodal Manager: their sector — team, tickets that need a Surveyor, map and charts.
 *  - Zone Inspector: their zone — every sector in it, and the same numbers for the whole zone.
 *  - Admin: the whole Kumbh, with the four zones on top.
 */
export default async function DashboardPage() {
  const { user, scope, placement, ability, forcedAssigneeId } = await requireTicketScope()

  if (forcedAssigneeId) {
    const { todo, done } = await getInspectorTasks(forcedAssigneeId)
    const name = personShortName(user.name || user.email || '')
    return (
      <>
        <Topbar title="Home" description={name ? `Hello, ${name}` : undefined} />
        <main className="flex-1 px-4 py-6 animate-fade-in sm:px-8">
          <InspectorHome todo={todo} done={done} />
        </main>
      </>
    )
  }

  const canAssign = ability.can('assign', 'ticket')
  const canCreate = ability.can('create', 'ticket')

  if (scope.kind === 'all') {
    return (
      <ScopedDashboard
        scope={scope}
        view={{ kind: 'admin' }}
        canAssign={canAssign}
        canCreate={canCreate}
      />
    )
  }

  if (scope.kind === 'sectors' && scope.level === 'zone') {
    if (!placement.zoneKey) return <NotPlaced what="zone" />
    return (
      <ScopedDashboard
        scope={scope}
        view={{ kind: 'zone', zoneKey: placement.zoneKey }}
        canAssign={canAssign}
        canCreate={canCreate}
      />
    )
  }

  if (!placement.sectorKey) return <NotPlaced what="sector" />
  return (
    <ScopedDashboard
      scope={scope}
      view={{ kind: 'sector', sectorKey: placement.sectorKey }}
      canAssign={canAssign}
      canCreate={canCreate}
    />
  )
}
