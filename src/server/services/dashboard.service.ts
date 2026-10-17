import 'server-only'

import { dbConnect } from '@/server/db/connect'
import {
  getDashboardData,
  getDashboardKpis,
  getTaskTabCounts,
  listTickets,
} from '@/server/services/ticket.service'
import { getSectorSummaries } from '@/server/services/sector.service'
import { listAssignableUsers } from '@/server/services/user.service'
import type { TicketScope } from '@/lib/ticket-scope'

const NEEDS_SOMEONE_SHOWN = 6

/**
 * Everything one dashboard needs, for the tickets a scope may see: the four numbers, the KPIs,
 * the tickets that still need someone (with the people they can be given to), the map and charts,
 * and a summary of each sector. The same call serves an Admin (everything), a Zone Inspector (their
 * zone) and a Nodal Manager (their sector).
 */
export async function loadScopedDashboard(scope: TicketScope, canAssign: boolean) {
  await dbConnect()
  const [counts, kpis, needing, people, overview, sectors] = await Promise.all([
    getTaskTabCounts(scope),
    getDashboardKpis(scope),
    listTickets({
      scope,
      unassigned: true,
      resolved: false,
      pageSize: NEEDS_SOMEONE_SHOWN,
      sortField: 'lastActivityAt',
      sortDir: 'desc',
    }),
    canAssign ? listAssignableUsers(scope) : Promise.resolve([]),
    getDashboardData(scope),
    getSectorSummaries(scope),
  ])
  return { counts, kpis, needing, people, overview, sectors }
}
