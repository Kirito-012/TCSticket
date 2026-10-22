import { VerificationBadge } from '@/components/tickets/VerificationBadge'
import { DroneVerificationBadge } from '@/components/tickets/DroneVerificationBadge'
import { ReopenedBadge } from '@/components/tickets/ReopenedBadge'
import Link from 'next/link'
import { CheckCircle2, ChevronRight, ClipboardList, Clock } from 'lucide-react'
import { AssigneeDropdown } from '@/components/tickets/AssigneeDropdown'
import { cn, timeAgo } from '@/lib/utils'
import { getLocale, getT } from '@/i18n/server'
import { localeTag } from '@/i18n/config'
import { friendlyStatusName, isDone, isUrgent, plainTitle } from '@/lib/plain-words'
import type { TicketListItemView } from '@/lib/ticket-view'

type UserOption = { id: string; name: string }

/**
 * One task for Admins and Managers: what it is, whether it's done, who has it — with a big
 * "who does this" button right on the card, so assigning never needs a trip to another page.
 * Colours come from the theme variables only, so it works in both dark and light.
 */
export async function AdminTaskCard({
  task,
  users,
  canAssign,
}: {
  task: TicketListItemView
  users: UserOption[]
  canAssign: boolean
}) {
  const t = await getT()
  const locale = localeTag(await getLocale())
  const done = isDone(task.status)
  const urgent = !done && isUrgent(task.priority)
  const reopened = task.status?.slug === 'reopened'

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
            {plainTitle(task.subject, t)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {/* Resolved or not — said outright, then the ticket's own status. */}
            {reopened ? (
              // A reopened ticket says so once, in red, instead of "Not resolved" plus a second tag.
              <ReopenedBadge />
            ) : (
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
                {done ? t('Resolved') : t('Not resolved')}
              </span>
            )}
            {task.status && !reopened && friendlyStatusName(task.status.name) !== 'Resolved' && (
              <span className="rounded-full border border-border-strong px-3 py-1 text-base font-medium text-muted-strong">
                {t(friendlyStatusName(task.status.name))}
              </span>
            )}
            {urgent && (
              <span className="rounded-full bg-danger px-3 py-1 text-base font-semibold text-white">
                {t('Urgent')}
              </span>
            )}
            <span className="text-base text-muted">
              {timeAgo(task.updatedAt, { locale, justNow: t('just now') })}
            </span>
          </div>
          {done && (
            <div className="mt-2 flex flex-wrap gap-2">
              <VerificationBadge
                status={task.verification}
                className="max-sm:!px-2.5 max-sm:!py-0.5 max-sm:!text-sm"
              />
              <DroneVerificationBadge
                status={task.droneVerification}
                className="max-sm:!px-2.5 max-sm:!py-0.5 max-sm:!text-sm"
              />
            </div>
          )}
        </div>
        <ChevronRight className="mt-3 h-6 w-6 shrink-0 text-muted" strokeWidth={2.5} aria-hidden />
      </Link>

      <div className="mt-auto">
        <p className="mb-1.5 text-sm font-semibold text-muted">{t('Who does this?')}</p>
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
