import Link from 'next/link'
import { PartyPopper } from 'lucide-react'
import { TaskCard } from '@/components/inspector/TaskCard'
import type { TicketListItemView } from '@/lib/ticket-view'
import { DEFAULT_INSPECTOR_FILTERS, inspectorHref } from '@/lib/inspector-filters'
import { getT } from '@/i18n/server'
import type { Translate } from '@/i18n/config'

const QUICK_VIEWS = [
  { label: 'Arrived today', filters: { ...DEFAULT_INSPECTOR_FILTERS, when: 'today' as const } },
  { label: 'Urgent only', filters: { ...DEFAULT_INSPECTOR_FILTERS, urgentOnly: true } },
  { label: 'Newest first', filters: { ...DEFAULT_INSPECTOR_FILTERS, sort: 'newest' as const } },
]

const NEXT_TASKS_SHOWN = 3

/** Progress bar of finished vs waiting tickets; each box below it opens that list. */
function TicketsProgress({ todo, done, t }: { todo: number; done: number; t: Translate }) {
  const total = todo + done
  const percent = total === 0 ? 0 : Math.round((done / total) * 100)

  return (
    <section
      aria-label={t('Your tickets')}
      className="max-w-xl space-y-4 rounded-2xl border-2 border-border-strong bg-surface p-5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xl font-bold text-foreground">
          {t('{done} of {total} done', { done, total })}
        </p>
        <p className="text-3xl font-bold text-accent-strong">{percent}%</p>
      </div>

      <div
        className="h-5 w-full overflow-hidden rounded-full bg-slate-200"
        role="img"
        aria-label={t('{done} of {total} tickets done', { done, total })}
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-700"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/tickets"
          className="rounded-2xl border-2 border-slate-300 bg-slate-100 px-3 py-3 text-center"
        >
          <span className="block text-4xl font-bold text-foreground">{todo}</span>
          <span className="block text-lg font-semibold text-foreground">{t('To do')}</span>
        </Link>
        <Link
          href="/tickets?show=done"
          className="rounded-2xl border-2 border-accent bg-accent-soft px-3 py-3 text-center"
        >
          <span className="block text-4xl font-bold text-foreground">{done}</span>
          <span className="block text-lg font-semibold text-foreground">{t('Done')}</span>
        </Link>
      </div>
    </section>
  )
}

/**
 * Surveyor home: how much is waiting, how much is finished, and the next few jobs.
 * No charts, filters or tables — one thing to look at and one place to tap.
 */
export async function InspectorHome({
  todo,
  done,
}: {
  todo: TicketListItemView[]
  done: TicketListItemView[]
}) {
  const t = await getT()
  const next = todo.slice(0, NEXT_TASKS_SHOWN)

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 md:max-w-5xl">
      <TicketsProgress todo={todo.length} done={done.length} t={t} />

      <section aria-label={t('Quick views')} className="space-y-2">
        <h2 className="text-base font-bold text-muted-strong">{t('Quick views')}</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:max-w-xl">
          {QUICK_VIEWS.map((view) => (
            <Link
              key={view.label}
              href={inspectorHref('todo', view.filters)}
              className="flex min-h-12 items-center justify-center rounded-2xl border-2 border-border-strong bg-surface px-3 text-center text-base font-bold text-foreground odd:last:col-span-2 sm:odd:last:col-span-1"
            >
              {t(view.label)}
            </Link>
          ))}
        </div>
      </section>

      {next.length === 0 ? (
        <div className="rounded-2xl border-2 border-border-strong bg-surface p-8 text-center">
          <PartyPopper className="mx-auto h-12 w-12 text-accent" strokeWidth={2} />
          <p className="mt-3 text-2xl font-bold text-foreground">{t('All done!')}</p>
          <p className="mt-1 text-lg text-muted">{t('You have no tickets waiting right now.')}</p>
        </div>
      ) : (
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-foreground">{t('Your next tickets')}</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {next.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
          <Link
            href="/tickets"
            className="flex min-h-14 items-center justify-center rounded-2xl bg-accent px-6 text-lg font-bold text-white md:max-w-sm"
          >
            {t('See all my tickets')}
          </Link>
        </section>
      )}
    </div>
  )
}
