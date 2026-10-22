import Link from 'next/link'
import { ChevronLeft, ChevronRight, Inbox, Search, X } from 'lucide-react'
import { AdminTaskCard } from '@/components/admin/AdminTaskCard'
import { AdminTicketRows } from '@/components/admin/AdminTicketRows'
import { AdminTicketFilters, type SectorOption } from '@/components/admin/AdminTicketFilters'
import { AdminFilterSheet } from '@/components/admin/AdminFilterSheet'
import { cn } from '@/lib/utils'
import { getLocale, getT } from '@/i18n/server'
import { localeTag } from '@/i18n/config'
import type { TicketListItemView } from '@/lib/ticket-view'

type UserOption = { id: string; name: string }
type StatusOption = {
  id: string
  name: string
  color: string
  slug?: string
  isResolved?: boolean
}

export type TaskTab = 'todo' | 'unassigned' | 'done' | 'all'
export type AgeKey = 'today' | 'd1to3' | 'd3to7' | 'over7'

const AGE_LABELS: Record<AgeKey, string> = {
  today: 'Open for under a day',
  d1to3: 'Open for 1 to 3 days',
  d3to7: 'Open for 3 to 7 days',
  over7: 'Open for over a week',
}

type T = (text: string, params?: Record<string, string | number>) => string

function parseDay(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** "Arrived Oct 3 – Oct 9, 2026", "Finished on Oct 9, 2026", "Arrived from Oct 3, 2026" ... */
function describeRange(from: string, to: string, by: 'created' | 'finished', t: T, locale: string) {
  const shortDay = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const d = (iso: string) => shortDay.format(parseDay(iso))
  const finished = by === 'finished'
  if (from && to && from === to) {
    return finished
      ? t('Finished on {date}', { date: d(from) })
      : t('Arrived on {date}', { date: d(from) })
  }
  if (from && to) {
    return finished
      ? t('Finished {from} – {to}', { from: d(from), to: d(to) })
      : t('Arrived {from} – {to}', { from: d(from), to: d(to) })
  }
  if (from) {
    return finished
      ? t('Finished from {date}', { date: d(from) })
      : t('Arrived from {date}', { date: d(from) })
  }
  if (to) {
    return finished
      ? t('Finished up to {date}', { date: d(to) })
      : t('Arrived up to {date}', { date: d(to) })
  }
  return null
}

/** "finished:2026-10-08" -> "Finished on Thu, Oct 8". */
function describeDay(day: string, t: T, locale: string) {
  const m = /^(created|finished):(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  if (!m) return null
  const dayLabel = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  const date = dayLabel.format(new Date(Number(m[2]), Number(m[3]) - 1, Number(m[4])))
  return m[1] === 'created' ? t('Created on {date}', { date }) : t('Finished on {date}', { date })
}

/** Everything the Tickets page can be told by its address. Defaults are left out of the URL. */
export type ListState = {
  tab: TaskTab
  q: string
  page: number
  sector: string
  urgent: boolean
  /** Finished tickets only: checked after the cleanup ('verified') or not yet ('unverified'). */
  verify: '' | 'verified' | 'unverified'
  /** Finished tickets the drone re-check verified ('verified') or not yet ('unverified'). */
  drone: '' | 'verified' | 'unverified'
  /** One status, by its short name ("open", "pending" ...). */
  status: string
  sort: 'activity' | 'newest' | 'oldest'
  view: 'cards' | 'list'
  /** Only tickets open for this long (from the dashboard's age chart). */
  age: AgeKey | ''
  /** "created:YYYY-MM-DD" or "finished:YYYY-MM-DD" (from the dashboard's daily columns). */
  day: string
  /** Date range, YYYY-MM-DD (either end can be empty). */
  from: string
  to: string
}

/** Style of a removable filter chip. */
const CHIP =
  'inline-flex min-h-10 items-center gap-2 rounded-full bg-accent-soft px-4 text-base font-semibold text-accent-strong'

const TABS: { key: TaskTab; label: string }[] = [
  { key: 'todo', label: 'To do' },
  { key: 'unassigned', label: 'Need someone' },
  { key: 'done', label: 'Done' },
  { key: 'all', label: 'All' },
]

/** The address for a list state — only non-default settings appear in it. */
export function listHref(state: ListState) {
  const params = new URLSearchParams()
  if (state.tab !== 'todo') params.set('show', state.tab)
  if (state.q) params.set('q', state.q)
  if (state.sector) params.set('sector', state.sector)
  if (state.urgent) params.set('urgent', '1')
  if (state.verify) params.set('verify', state.verify)
  if (state.drone) params.set('drone', state.drone)
  if (state.status) params.set('status', state.status)
  if (state.age) params.set('age', state.age)
  if (state.day) params.set('day', state.day)
  if (state.from) params.set('from', state.from)
  if (state.to) params.set('to', state.to)
  if (state.sort !== 'activity') params.set('sort', state.sort)
  if (state.view !== 'cards') params.set('view', state.view)
  if (state.page > 1) params.set('page', String(state.page))
  const qs = params.toString()
  return qs ? `/tickets?${qs}` : '/tickets'
}

/**
 * Admin/Manager Tickets page: four tabs, one search box, a few useful filters, then either big
 * cards (quick assigning) or a compact list (work through many, assign several at once).
 */
export async function AdminTaskList({
  tasks,
  users,
  statuses,
  sectors,
  sectorNames,
  canAssign,
  canUpdate,
  counts,
  state,
  pageSize,
  total,
}: {
  tasks: TicketListItemView[]
  users: UserOption[]
  statuses: StatusOption[]
  sectors: SectorOption[]
  sectorNames: Record<string, string>
  canAssign: boolean
  canUpdate: boolean
  counts: Record<TaskTab, number>
  state: ListState
  pageSize: number
  total: number
}) {
  const t = await getT()
  const locale = localeTag(await getLocale())
  const { tab, q, page } = state
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  const filtered = Boolean(
    q ||
    state.sector ||
    state.urgent ||
    state.verify ||
    state.drone ||
    state.status ||
    state.age ||
    state.day ||
    state.from ||
    state.to,
  )
  // The statuses that make sense on this tab: unfinished ones on To do / Need someone, finished
  // ones on Done, all of them on All.
  const statusChoices = statuses
    .filter((s) => s.slug && (tab === 'all' || Boolean(s.isResolved) === (tab === 'done')))
    .map((s) => ({ value: s.slug as string, label: t(s.name) }))
  const statusName = t(statuses.find((s) => s.slug === state.status)?.name ?? state.status)
  const dayText = state.day ? describeDay(state.day, t, locale) : null
  // The dates mean the day a ticket was finished on the Done tab, and the day it arrived elsewhere.
  const rangeText = describeRange(
    state.from,
    state.to,
    tab === 'done' ? 'finished' : 'created',
    t,
    locale,
  )

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <div
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-3 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4 [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label={t('Show tickets')}
      >
        {TABS.map((item) => {
          const active = tab === item.key
          return (
            <Link
              key={item.key}
              href={listHref({ ...state, tab: item.key, status: '', page: 1 })}
              role="tab"
              aria-selected={active}
              className={cn(
                'flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-2xl border-2 px-4 text-base font-bold sm:min-h-14 sm:px-3 sm:text-lg',
                active
                  ? 'border-accent bg-accent text-on-accent'
                  : 'border-border-strong bg-surface text-muted-strong hover:bg-surface-hover',
              )}
            >
              {t(item.label)}
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-base',
                  active ? 'bg-on-accent/15 text-on-accent' : 'bg-surface-hover text-foreground',
                )}
              >
                {counts[item.key].toLocaleString()}
              </span>
            </Link>
          )
        })}
      </div>

      <form action="/tickets" className="flex max-w-xl gap-2">
        {tab !== 'todo' && <input type="hidden" name="show" value={tab} />}
        {state.sector && <input type="hidden" name="sector" value={state.sector} />}
        {state.urgent && <input type="hidden" name="urgent" value="1" />}
        {state.verify && <input type="hidden" name="verify" value={state.verify} />}
        {state.drone && <input type="hidden" name="drone" value={state.drone} />}
        {state.status && <input type="hidden" name="status" value={state.status} />}
        {state.age && <input type="hidden" name="age" value={state.age} />}
        {state.day && <input type="hidden" name="day" value={state.day} />}
        {state.from && <input type="hidden" name="from" value={state.from} />}
        {state.to && <input type="hidden" name="to" value={state.to} />}
        {state.sort !== 'activity' && <input type="hidden" name="sort" value={state.sort} />}
        {state.view !== 'cards' && <input type="hidden" name="view" value={state.view} />}
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">{t('Search tickets')}</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder={t('Search, or type a ticket number')}
            className="h-12 w-full rounded-2xl border-2 border-border-strong bg-surface pl-12 pr-4 text-base text-foreground placeholder:text-muted outline-none focus:border-accent sm:h-14 sm:text-lg"
          />
        </label>
        <button
          type="submit"
          className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-2xl bg-accent text-on-accent sm:h-14 sm:w-auto sm:px-6 sm:text-lg sm:font-bold"
        >
          <Search className="h-5 w-5 sm:hidden" strokeWidth={2.5} />
          <span className="max-sm:sr-only">{t('Search')}</span>
        </button>
      </form>

      {/* Phones: one Filters button that opens a bottom sheet. Wide screens: the inline rows below. */}
      <div className="sm:hidden">
        <AdminFilterSheet
          sectors={sectors}
          statuses={statusChoices}
          current={{
            sector: state.sector,
            urgent: state.urgent,
            verify: state.verify,
            drone: state.drone,
            showVerify: tab === 'done' || tab === 'all',
            status: state.status,
            sort: state.sort,
            view: state.view,
            from: state.from,
            to: state.to,
          }}
        />
      </div>

      <AdminTicketFilters
        sectors={sectors}
        sector={state.sector}
        statuses={statusChoices}
        status={state.status}
        urgent={state.urgent}
        verify={state.verify}
        drone={state.drone}
        showVerify={tab === 'done' || tab === 'all'}
        sort={state.sort}
        view={state.view}
        from={state.from}
        to={state.to}
      />

      {(state.sector ||
        state.urgent ||
        state.verify ||
        state.drone ||
        state.status ||
        state.sort !== 'activity' ||
        state.age ||
        dayText ||
        rangeText) && (
        <div className="flex flex-wrap items-center gap-2" aria-label={t('Active filters')}>
          {state.sector && (
            <Link
              href={listHref({ ...state, sector: '', page: 1 })}
              className={CHIP}
              aria-label={t('Remove filter: {name}', {
                name: sectorNames[state.sector] ?? state.sector,
              })}
            >
              {sectorNames[state.sector] ?? state.sector}
              <X className="h-4 w-4" strokeWidth={2.5} />
            </Link>
          )}
          {state.status && (
            <Link
              href={listHref({ ...state, status: '', page: 1 })}
              className={CHIP}
              aria-label={t('Remove filter: {name}', {
                name: t('Status: {name}', { name: statusName }),
              })}
            >
              {t('Status: {name}', { name: statusName })}
              <X className="h-4 w-4" strokeWidth={2.5} />
            </Link>
          )}
          {state.urgent && (
            <Link
              href={listHref({ ...state, urgent: false, page: 1 })}
              className={CHIP}
              aria-label={t('Remove filter: {name}', { name: t('Urgent only') })}
            >
              {t('Urgent only')}
              <X className="h-4 w-4" strokeWidth={2.5} />
            </Link>
          )}
          {state.verify && (
            <Link
              href={listHref({ ...state, verify: '', page: 1 })}
              className={CHIP}
              aria-label={t('Remove filter: {name}', { name: t('Verification') })}
            >
              {state.verify === 'verified' ? t('Verified') : t('Not verified')}
              <X className="h-4 w-4" strokeWidth={2.5} />
            </Link>
          )}
          {state.drone && (
            <Link
              href={listHref({ ...state, drone: '', page: 1 })}
              className={CHIP}
              aria-label={t('Remove filter: {name}', { name: t('Drone check') })}
            >
              {state.drone === 'verified' ? t('Drone verified') : t('Not drone verified')}
              <X className="h-4 w-4" strokeWidth={2.5} />
            </Link>
          )}
          {state.sort !== 'activity' && (
            <Link
              href={listHref({ ...state, sort: 'activity', page: 1 })}
              className={CHIP}
              aria-label={t('Remove sorting')}
            >
              {state.sort === 'newest' ? t('Newest first') : t('Oldest first')}
              <X className="h-4 w-4" strokeWidth={2.5} />
            </Link>
          )}
          {rangeText && (
            <Link
              href={listHref({ ...state, from: '', to: '', page: 1 })}
              className={CHIP}
              aria-label={t('Remove filter: {name}', { name: rangeText })}
            >
              {rangeText}
              <X className="h-4 w-4" strokeWidth={2.5} />
            </Link>
          )}
          {state.age && (
            <Link
              href={listHref({ ...state, age: '', page: 1 })}
              className={CHIP}
              aria-label={t('Remove filter: {name}', { name: t(AGE_LABELS[state.age]) })}
            >
              {t(AGE_LABELS[state.age])}
              <X className="h-4 w-4" strokeWidth={2.5} />
            </Link>
          )}
          {dayText && (
            <Link
              href={listHref({ ...state, day: '', page: 1 })}
              className={CHIP}
              aria-label={t('Remove filter: {name}', { name: dayText })}
            >
              {dayText}
              <X className="h-4 w-4" strokeWidth={2.5} />
            </Link>
          )}
        </div>
      )}

      <p className="text-base text-muted">
        {total === 0
          ? t('No tickets')
          : t('Showing {from}–{to} of {total} tickets', {
              from: from.toLocaleString(),
              to: to.toLocaleString(),
              total: total.toLocaleString(),
            })}
        {filtered && (
          <>
            {' · '}
            <Link
              href={listHref({
                ...state,
                q: '',
                sector: '',
                urgent: false,
                verify: '',
                drone: '',
                status: '',
                age: '',
                day: '',
                from: '',
                to: '',
                page: 1,
              })}
              className="font-semibold text-accent-strong underline"
            >
              {t('Clear filters')}
            </Link>
          </>
        )}
      </p>

      {tasks.length === 0 ? (
        <div className="rounded-2xl border-2 border-border-strong bg-surface p-8 text-center">
          <Inbox className="mx-auto h-12 w-12 text-muted" strokeWidth={2} />
          <p className="mt-3 text-2xl font-bold text-foreground">{t('Nothing here')}</p>
          <p className="mt-1 text-lg text-muted">
            {filtered
              ? t('No tickets match these filters.')
              : t('There are no tickets in this list.')}
          </p>
        </div>
      ) : state.view === 'list' ? (
        <AdminTicketRows
          tickets={tasks}
          users={users}
          statuses={statuses}
          sectorNames={sectorNames}
          canAssign={canAssign}
          canUpdate={canUpdate}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {tasks.map((task) => (
            <AdminTaskCard key={task.id} task={task} users={users} canAssign={canAssign} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <nav className="flex items-center justify-between gap-3" aria-label={t('Pages')}>
          <Link
            href={listHref({ ...state, page: page - 1 })}
            aria-disabled={page <= 1}
            className={cn(
              'inline-flex min-h-14 items-center gap-1.5 rounded-2xl border-2 border-border-strong px-3 text-base font-bold text-foreground sm:gap-2 sm:px-5 sm:text-lg',
              page <= 1 && 'pointer-events-none opacity-40',
            )}
          >
            <ChevronLeft className="h-6 w-6" strokeWidth={2.5} />
            {t('Previous')}
          </Link>
          <p className="min-w-0 text-center text-sm text-muted sm:text-base">
            {t('Page {page} of {total}', {
              page: page.toLocaleString(),
              total: totalPages.toLocaleString(),
            })}
          </p>
          <Link
            href={listHref({ ...state, page: page + 1 })}
            aria-disabled={page >= totalPages}
            className={cn(
              'inline-flex min-h-14 items-center gap-1.5 rounded-2xl border-2 border-border-strong px-3 text-base font-bold text-foreground sm:gap-2 sm:px-5 sm:text-lg',
              page >= totalPages && 'pointer-events-none opacity-40',
            )}
          >
            {t('Next')}
            <ChevronRight className="h-6 w-6" strokeWidth={2.5} />
          </Link>
        </nav>
      )}
    </div>
  )
}
