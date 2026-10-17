import Link from 'next/link'
import { PartyPopper, Inbox } from 'lucide-react'
import { TaskCard } from '@/components/inspector/TaskCard'
import { InspectorFilterBar } from '@/components/inspector/InspectorFilterBar'
import {
  DEFAULT_INSPECTOR_FILTERS,
  activeFilterCount,
  inspectorHref,
  type InspectorFilters,
} from '@/lib/inspector-filters'
import { cn } from '@/lib/utils'
import type { TicketListItemView } from '@/lib/ticket-view'

/** Surveyor task list: a To do / Done switch and big cards — no table, search or filters. */
export function InspectorTaskList({
  todo,
  done,
  show,
  filters,
}: {
  todo: TicketListItemView[]
  done: TicketListItemView[]
  show: 'todo' | 'done'
  filters: InspectorFilters
}) {
  const tasks = show === 'done' ? done : todo
  const filtered = activeFilterCount(filters) > 0

  const tabs = [
    { key: 'todo', label: 'To do', count: todo.length, href: inspectorHref('todo', filters) },
    { key: 'done', label: 'Done', count: done.length, href: inspectorHref('done', filters) },
  ] as const

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 md:max-w-5xl">
      <div className="grid max-w-md grid-cols-2 gap-3" role="tablist" aria-label="Show tickets">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            role="tab"
            aria-selected={show === tab.key}
            className={cn(
              'flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 px-4 text-lg font-bold',
              show === tab.key
                ? 'border-accent bg-accent text-white'
                : 'border-border-strong bg-surface text-muted-strong',
            )}
          >
            {tab.label}
            <span
              className={cn(
                'rounded-full px-2.5 py-0.5 text-base',
                show === tab.key ? 'bg-white/25 text-white' : 'bg-surface-hover text-foreground',
              )}
            >
              {tab.count}
            </span>
          </Link>
        ))}
      </div>

      <InspectorFilterBar show={show} filters={filters} />

      {tasks.length === 0 ? (
        <div className="rounded-2xl border-2 border-border-strong bg-surface p-8 text-center">
          {show === 'todo' ? (
            <PartyPopper className="mx-auto h-12 w-12 text-accent" strokeWidth={2} />
          ) : (
            <Inbox className="mx-auto h-12 w-12 text-muted" strokeWidth={2} />
          )}
          <p className="mt-3 text-2xl font-bold text-foreground">
            {filtered ? 'No tickets match' : show === 'todo' ? 'All done!' : 'Nothing here yet'}
          </p>
          <p className="mt-1 text-lg text-muted">
            {filtered
              ? 'Try a different day or clear the filters.'
              : show === 'todo'
                ? 'You have no tickets waiting right now.'
                : 'Tickets you finish will show up here.'}
          </p>
          {filtered && (
            <Link
              href={inspectorHref(show, DEFAULT_INSPECTOR_FILTERS)}
              className="mt-4 inline-flex min-h-12 items-center rounded-2xl border-2 border-border-strong px-5 text-lg font-bold text-foreground"
            >
              Clear all filters
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  )
}
