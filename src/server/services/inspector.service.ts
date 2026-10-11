import 'server-only'

import { listTickets } from '@/server/services/ticket.service'
import { toTicketListItem, type TicketListItemView } from '@/lib/ticket-view'
import { isDone, isUrgent } from '@/lib/plain-words'
import { DEFAULT_INSPECTOR_FILTERS, type InspectorFilters } from '@/lib/inspector-filters'

const MAX_TASKS = 100
const DAY_MS = 24 * 60 * 60 * 1000

function arrivedInRange(createdAt: string, filters: InspectorFilters) {
  const time = new Date(createdAt).getTime()
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  const exact = /^(\d{4})-(\d{2})-(\d{2})$/.exec(filters.on)
  if (exact) {
    const start = new Date(Number(exact[1]), Number(exact[2]) - 1, Number(exact[3])).getTime()
    return time >= start && time < start + DAY_MS
  }
  if (filters.when === 'today') return time >= startOfToday.getTime()
  if (filters.when === 'week') return time >= startOfToday.getTime() - 6 * DAY_MS
  if (filters.when === 'month') return time >= startOfToday.getTime() - 29 * DAY_MS
  return true
}

/**
 * Everything a Zone Inspector's Home and My tickets screens need: their own tickets, narrowed
 * by the chosen filters, split into "to do" and "done". An inspector's workload is a handful of
 * tickets, so one query and an in-memory filter is simpler than paging.
 */
export async function getInspectorTasks(
  userId: string,
  filters: InspectorFilters = DEFAULT_INSPECTOR_FILTERS,
) {
  const { items } = await listTickets({
    assigneeId: userId,
    pageSize: MAX_TASKS,
    sortField: 'lastActivityAt',
    sortDir: 'desc',
  })

  const tasks: TicketListItemView[] = items
    .map(toTicketListItem)
    .filter((t) => arrivedInRange(t.createdAt, filters))
    .filter((t) => !filters.urgentOnly || isUrgent(t.priority))

  const byArrival = (dir: 1 | -1) => (a: TicketListItemView, b: TicketListItemView) =>
    dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  const order = (list: TicketListItemView[]) => {
    if (filters.sort === 'newest') return [...list].sort(byArrival(-1))
    if (filters.sort === 'oldest') return [...list].sort(byArrival(1))
    // Urgent first; Array.sort is stable, so the rest keep latest-activity-first order.
    return [...list].sort((a, b) => Number(isUrgent(b.priority)) - Number(isUrgent(a.priority)))
  }

  return {
    todo: order(tasks.filter((t) => !isDone(t.status))),
    done: order(tasks.filter((t) => isDone(t.status))),
  }
}
