import { Topbar } from '@/components/layout/Topbar'
import { AdminHome } from '@/components/admin/AdminHome'
import { AdminOverview } from '@/components/admin/AdminOverview'
import { InspectorHome } from '@/components/inspector/InspectorHome'
import { requireTicketScope } from '@/server/auth/session'
import { dbConnect } from '@/server/db/connect'
import { UserModel } from '@/server/db/models/user.model'
import {
  listTickets,
  getTaskTabCounts,
  getDashboardData,
  getDashboardKpis,
} from '@/server/services/ticket.service'
import { getInspectorTasks } from '@/server/services/inspector.service'
import { toTicketListItem } from '@/lib/ticket-view'

const NEEDS_SOMEONE_SHOWN = 6

export default async function DashboardPage() {
  const { user, forcedAssigneeId, ability } = await requireTicketScope()

  // Zone Inspectors get a plain home screen of their own tasks.
  if (forcedAssigneeId) {
    const { todo, done } = await getInspectorTasks(forcedAssigneeId)
    const name = (user.name || user.email || '').replace(/\s*Zone Inspector$/i, '').trim()
    return (
      <>
        <Topbar title="Home" description={name ? `Hello, ${name}` : undefined} />
        <main className="flex-1 px-4 py-6 animate-fade-in sm:px-8">
          <InspectorHome todo={todo} done={done} />
        </main>
      </>
    )
  }

  // Admins and Managers: four numbers, the tickets that still need someone, then the map and
  // the charts.
  await dbConnect()
  const canAssign = ability.can('assign', 'ticket')
  const [counts, kpis, needing, people, overview] = await Promise.all([
    getTaskTabCounts(),
    getDashboardKpis(),
    listTickets({
      unassigned: true,
      resolved: false,
      pageSize: NEEDS_SOMEONE_SHOWN,
      sortField: 'lastActivityAt',
      sortDir: 'desc',
    }),
    canAssign
      ? UserModel.find({ isActive: true, deletedAt: null }).select('fullname email').lean()
      : Promise.resolve([]),
    getDashboardData(undefined),
  ])

  return (
    <>
      <Topbar
        title="Dashboard"
        description="What needs your attention today"
        primaryAction={{ label: 'New ticket', href: '/tickets/new' }}
      />
      <main className="flex-1 px-4 py-6 animate-fade-in sm:px-8">
        <AdminHome
          counts={counts}
          kpis={kpis}
          needsAssigning={needing.items.map(toTicketListItem)}
          users={people.map((u) => ({
            id: String(u._id),
            name: u.fullname || u.email || 'Unknown',
          }))}
          canAssign={canAssign}
        />
        <div className="mx-auto mt-6 w-full max-w-6xl">
          <AdminOverview data={overview} canFilter={ability.can('read:all', 'ticket')} />
        </div>
      </main>
    </>
  )
}
