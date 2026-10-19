import { Topbar } from '@/components/layout/Topbar'
import {
  AdminTaskList,
  type AgeKey,
  type ListState,
  type TaskTab,
} from '@/components/admin/AdminTaskList'
import { InspectorTaskList } from '@/components/inspector/InspectorTaskList'
import { requireTicketScope } from '@/server/auth/session'
import { dbConnect } from '@/server/db/connect'
import { TicketStatusModel } from '@/server/db/models/ticket-status.model'
import { listTickets, getTaskTabCounts } from '@/server/services/ticket.service'
import { getInspectorTasks } from '@/server/services/inspector.service'
import { getSectorOptions } from '@/server/services/sector.service'
import { listAssignableUsers } from '@/server/services/user.service'
import { parseInspectorFilters } from '@/lib/inspector-filters'
import { toTicketListItem } from '@/lib/ticket-view'
import { getT } from '@/i18n/server'

const CARD_PAGE_SIZE = 12
const LIST_PAGE_SIZE = 25
const TABS: TaskTab[] = ['todo', 'unassigned', 'done', 'all']
const AGES: AgeKey[] = ['today', 'd1to3', 'd3to7', 'over7']

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const get = (key: string) => (Array.isArray(sp[key]) ? sp[key][0] : sp[key])

  const { ability, scope, forcedAssigneeId } = await requireTicketScope()
  const t = await getT()

  // Surveyors: a To do / Done switch and big cards.
  if (forcedAssigneeId) {
    const show = get('show') === 'done' ? 'done' : 'todo'
    const filters = parseInspectorFilters(get)
    const { todo, done } = await getInspectorTasks(forcedAssigneeId, filters)
    return (
      <>
        <Topbar title={t('My tickets')} description={t('Tap a ticket to open it')} />
        <main className="flex-1 px-4 py-6 animate-fade-in sm:px-8">
          <InspectorTaskList todo={todo} done={done} show={show} filters={filters} />
        </main>
      </>
    )
  }

  // Admins, Zone Inspectors and Nodal Managers: four tabs, one search box, a few useful filters,
  // then cards or a list — always limited to their own zone / sector.
  const tab = TABS.find((t) => t === get('show')) ?? 'todo'
  const state: ListState = {
    tab,
    q: (get('q') ?? '').trim(),
    page: Math.max(1, Number(get('page')) || 1),
    sector: get('sector') ?? '',
    urgent: get('urgent') === '1',
    verify:
      get('verify') === 'verified'
        ? 'verified'
        : get('verify') === 'unverified'
          ? 'unverified'
          : '',
    status: /^[a-z0-9-]{1,40}$/.test(get('status') ?? '') ? (get('status') ?? '') : '',
    sort: get('sort') === 'newest' ? 'newest' : get('sort') === 'oldest' ? 'oldest' : 'activity',
    view: get('view') === 'list' ? 'list' : 'cards',
    age: AGES.find((a) => a === get('age')) ?? '',
    day: /^(created|finished):\d{4}-\d{2}-\d{2}$/.test(get('day') ?? '') ? (get('day') ?? '') : '',
    from: /^\d{4}-\d{2}-\d{2}$/.test(get('from') ?? '') ? (get('from') ?? '') : '',
    to: /^\d{4}-\d{2}-\d{2}$/.test(get('to') ?? '') ? (get('to') ?? '') : '',
  }
  const dayParts = state.day ? state.day.split(':') : null
  const pageSize = state.view === 'list' ? LIST_PAGE_SIZE : CARD_PAGE_SIZE
  const tabFilters =
    tab === 'todo'
      ? { resolved: false }
      : tab === 'done'
        ? { resolved: true }
        : tab === 'unassigned'
          ? { unassigned: true, resolved: false }
          : {}

  await dbConnect()
  const canAssign = ability.can('assign', 'ticket')
  const canUpdate = ability.can('update', 'ticket')
  const [{ items, total }, counts, people, sectorOptions, statuses] = await Promise.all([
    listTickets({
      scope,
      ...tabFilters,
      q: state.q || undefined,
      sectorKey: state.sector || undefined,
      urgent: state.urgent || undefined,
      verification: state.verify || undefined,
      status: state.status || undefined,
      age: state.age || undefined,
      createdOn: dayParts?.[0] === 'created' ? dayParts[1] : undefined,
      resolvedOn: dayParts?.[0] === 'finished' ? dayParts[1] : undefined,
      dateFrom: state.from || undefined,
      dateTo: state.to || undefined,
      dateBy: tab === 'done' ? 'finished' : 'created',
      page: state.page,
      pageSize,
      sortField: state.sort === 'activity' ? 'lastActivityAt' : 'createdAt',
      sortDir: state.sort === 'oldest' ? 'asc' : 'desc',
    }),
    getTaskTabCounts(scope),
    canAssign ? listAssignableUsers(scope) : Promise.resolve([]),
    getSectorOptions(scope),
    TicketStatusModel.find().sort({ order: 1 }).lean(),
  ])

  // The sector filter lists the sectors this person may see (all of them for an Admin).
  const sectors = sectorOptions.map((s) => ({ value: s.value, label: s.label }))
  const sectorNames = Object.fromEntries(sectors.map((s) => [s.value, s.label]))

  return (
    <>
      <Topbar
        title={t('Tickets')}
        description={t('Everything that needs doing')}
        primaryAction={{ label: t('New ticket'), href: '/tickets/new' }}
      />
      <main className="flex-1 px-4 py-6 animate-fade-in sm:px-8">
        <AdminTaskList
          tasks={items.map(toTicketListItem)}
          users={people.map((u) => ({
            id: String(u._id),
            name: u.fullname || u.email || 'Unknown',
          }))}
          statuses={statuses.map((s) => ({
            id: String(s._id),
            name: s.name,
            color: s.color,
            slug: s.slug,
            isResolved: Boolean(s.isResolved),
          }))}
          sectors={sectors}
          sectorNames={sectorNames}
          canAssign={canAssign}
          canUpdate={canUpdate}
          counts={counts}
          state={state}
          pageSize={pageSize}
          total={total}
        />
      </main>
    </>
  )
}
