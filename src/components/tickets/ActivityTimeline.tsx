import { Activity } from 'lucide-react'
import { timeAgo } from '@/lib/utils'
import { getLocale, getT } from '@/i18n/server'
import { localeTag } from '@/i18n/config'
import type { EventView } from '@/lib/ticket-view'

const FIELD_LABELS: Record<string, string> = {
  subject: 'subject',
  statusId: 'status',
  assigneeId: 'assignee',
  priorityId: 'priority',
  typeId: 'type',
  dueDate: 'due date',
}

const ACTION_LABELS: Record<string, string> = {
  created: 'created this ticket',
  commented: 'replied',
  note_added: 'added an internal note',
  comment_deleted: 'deleted a comment',
  deleted: 'deleted this ticket',
  restored: 'restored this ticket',
  photo_added: 'uploaded a resolution photo',
  photo_removed: 'removed a resolution photo',
  verified: 'marked the cleanup as verified',
  unverified: 'marked the cleanup as not verified',
  reopened: 'reopened this ticket: the drone re-check still showed garbage',
  drone_verified: 'marked the cleanup as drone verified',
}

function describe(
  event: EventView,
  t: (text: string, params?: Record<string, string | number>) => string,
) {
  if (event.action === 'field_changed' && event.field) {
    const label = FIELD_LABELS[event.field] ?? event.field
    if (event.field === 'assigneeId') {
      return event.to ? t('assigned this ticket') : t('unassigned this ticket')
    }
    return t('changed {field}', { field: t(label) })
  }
  return t(ACTION_LABELS[event.action] ?? event.action)
}

export async function ActivityTimeline({ events }: { events: EventView[] }) {
  const t = await getT()
  const locale = localeTag(await getLocale())
  if (events.length === 0) return <p className="text-sm text-muted">{t('No activity yet.')}</p>

  return (
    <ol className="space-y-3">
      {events.map((e) => (
        <li key={e.id} className="flex items-start gap-2.5 text-xs">
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.04] text-muted">
            <Activity className="h-2.5 w-2.5" />
          </div>
          <p className="text-muted-strong">
            <span className="font-medium text-foreground">{e.actor?.name ?? t('Someone')}</span>{' '}
            {describe(e, t)}
            <span className="ml-1.5 text-muted">
              · {timeAgo(e.createdAt, { locale, justNow: t('just now') })}
            </span>
          </p>
        </li>
      ))}
    </ol>
  )
}
