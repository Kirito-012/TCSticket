import { VerificationBadge } from '@/components/tickets/VerificationBadge'
import Link from 'next/link'
import { CheckCircle2, ChevronRight, ClipboardList, Clock } from 'lucide-react'
import { AssigneeDropdown } from '@/components/tickets/AssigneeDropdown'
import { cn, timeAgo } from '@/lib/utils'
import { friendlyStatusName, isDone, isUrgent, plainTitle } from '@/lib/plain-words'
import type { TicketListItemView } from '@/lib/ticket-view'

type UserOption = { id: string; name: string }

/**
 * One task for Admins and Managers: what it is, whether it's done, who has it — with a big
 * "who does this" button right on the card, so assigning never needs a trip to another page.
 * Colours come from the theme variables only, so it works in both dark and light.
 */
export function AdminTaskCard({
  task,
  users,
  canAssign,
}: {
  task: TicketListItemView
  users: UserOption[]
  canAssign: boolean
}) {
  const done = isDone(task.status)
  const urgent = !done && isUrgent(task.priority)

  return (
    <div className="flex h-full flex-col gap-4 rounded-2xl border-2 border-border-strong bg-surface p-4 sm:p-5">
      <Link href={`/tickets/${task.number}`} className="flex items-start gap-3">
        {task.thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={task.thumbUrl}
            alt=""
            className="h-14 w-14 shrink-0 rounded-2xl border-2 border-border-strong object-cover"
          />
        ) : (
          <span
            className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-full',
              done ? 'bg-accent-soft text-accent-strong' : 'bg-warning-soft text-warning',
            )}
          >
            {done ? (
              <CheckCircle2 className="h-7 w-7" strokeWidth={2.25} />
            ) : (
              <ClipboardList className="h-7 w-7" strokeWidth={2.25} />
            )}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold leading-snug text-foreground [overflow-wrap:anywhere]">
            {plainTitle(task.subject)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {/* Resolved or not — said outright, then the ticket's own status. */}
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-base font-semibold',
                done ? 'bg-accent-soft text-accent-strong' : 'bg-warning-soft text-warning',
              )}
            >
              {done ? (
                <CheckCircle2 className="h-4 w-4" strokeWidth={2.5} />
              ) : (
                <Clock className="h-4 w-4" strokeWidth={2.5} />
              )}
              {done ? 'Resolved' : 'Not resolved'}
            </span>
            {task.status && friendlyStatusName(task.status.name) !== 'Resolved' && (
              <span className="rounded-full border border-border-strong px-3 py-1 text-base font-medium text-muted-strong">
                {friendlyStatusName(task.status.name)}
              </span>
            )}
            {urgent && (
              <span className="rounded-full bg-danger px-3 py-1 text-base font-semibold text-white">
                Urgent
              </span>
            )}
            <span className="text-base text-muted">{timeAgo(task.updatedAt)}</span>
          </div>
          {done && <VerificationBadge status={task.verification} className="mt-2" />}
        </div>
        <ChevronRight className="mt-3 h-6 w-6 shrink-0 text-muted" strokeWidth={2.5} aria-hidden />
      </Link>

      <div className="mt-auto">
        <p className="mb-1.5 text-sm font-semibold text-muted">Who does this?</p>
        <AssigneeDropdown
          ticketNumber={task.number}
          assignee={task.assignee}
          users={users}
          disabled={!canAssign}
          large
        />
      </div>
    </div>
  )
}
