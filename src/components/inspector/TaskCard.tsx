import Link from 'next/link'
import { CheckCircle2, ChevronRight, ClipboardList } from 'lucide-react'
import { cn, timeAgo } from '@/lib/utils'
import { isDone, isUrgent, plainStatusLabel, plainTitle } from '@/lib/plain-words'
import type { TicketListItemView } from '@/lib/ticket-view'

/** One task as a big, tappable card: what it is, whether it's to do or done, and how urgent. */
export function TaskCard({ task }: { task: TicketListItemView }) {
  const done = isDone(task.status)
  const urgent = !done && isUrgent(task.priority)

  return (
    <Link
      href={`/tickets/${task.number}`}
      className="flex h-full items-center gap-4 rounded-2xl border-2 border-border-strong bg-surface p-4 shadow-sm transition-colors active:bg-surface-hover sm:p-5"
    >
      {task.thumbUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={task.thumbUrl}
          alt=""
          className="h-16 w-16 shrink-0 rounded-2xl border-2 border-border-strong object-cover"
        />
      ) : (
        <span
          className={cn(
            'flex h-14 w-14 shrink-0 items-center justify-center rounded-full',
            done ? 'bg-accent-soft text-accent' : 'bg-slate-200 text-slate-700',
          )}
        >
          {done ? (
            <CheckCircle2 className="h-8 w-8" strokeWidth={2.25} />
          ) : (
            <ClipboardList className="h-8 w-8" strokeWidth={2.25} />
          )}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <p className="text-lg font-bold leading-snug text-foreground [overflow-wrap:anywhere]">
          {plainTitle(task.subject)}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'rounded-full px-3 py-1 text-base font-semibold',
              done ? 'bg-accent-soft text-accent-strong' : 'bg-slate-200 text-slate-700',
            )}
          >
            {plainStatusLabel(task.status)}
          </span>
          {urgent && (
            <span className="rounded-full bg-danger px-3 py-1 text-base font-semibold text-white">
              Urgent
            </span>
          )}
          <span className="text-base text-muted">{timeAgo(task.updatedAt)}</span>
        </div>
      </div>

      <ChevronRight className="h-8 w-8 shrink-0 text-muted" strokeWidth={2.5} aria-hidden />
    </Link>
  )
}
