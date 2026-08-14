import { notFound } from 'next/navigation'
import { Topbar } from '@/components/layout/Topbar'
import { Card } from '@/components/ui/Card'
import { DynamicBadge, Tag } from '@/components/ui/Badge'
import { CommentThread } from '@/components/tickets/CommentThread'
import { ActivityTimeline } from '@/components/tickets/ActivityTimeline'
import { TicketDetailSidebar } from '@/components/tickets/TicketDetailSidebar'
import { requireTicketScope } from '@/server/auth/session'
import { dbConnect } from '@/server/db/connect'
import * as ticketService from '@/server/services/ticket.service'
import { TicketStatusModel } from '@/server/db/models/ticket-status.model'
import { TicketPriorityModel } from '@/server/db/models/ticket-priority.model'
import { TicketTypeModel } from '@/server/db/models/ticket-type.model'
import { UserModel } from '@/server/db/models/user.model'
import { toTicketDetailView, toCommentView, toEventView } from '@/lib/ticket-view'

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ number: string }>
}) {
  const { number: numberParam } = await params
  const number = Number(numberParam)
  if (!Number.isInteger(number)) notFound()

  const { user, ability, forcedAssigneeId } = await requireTicketScope()

  await dbConnect()
  const ticketDoc = await ticketService.getTicketByNumber(number)
  if (!ticketDoc) notFound()

  // Agent-scoped: a ticket not assigned to them doesn't exist as far as they're concerned —
  // same as it not existing, not a "you're not allowed" page (avoids confirming it exists).
  if (forcedAssigneeId) {
    const assignee = (ticketDoc as { assigneeId?: { _id?: unknown } | null }).assigneeId
    const assigneeId = assignee?._id ? String(assignee._id) : null
    if (assigneeId !== user.id) notFound()
  }

  const [commentsRaw, eventsRaw, statuses, priorities, types, users] = await Promise.all([
    ticketService.listComments(String(ticketDoc._id)),
    ticketService.listEvents(String(ticketDoc._id)),
    TicketStatusModel.find().sort({ order: 1 }).lean(),
    TicketPriorityModel.find().sort({ order: 1 }).lean(),
    TicketTypeModel.find({ isActive: true }).sort({ name: 1 }).lean(),
    UserModel.find({ isActive: true, deletedAt: null }).select('fullname email').lean(),
  ])

  const ticket = toTicketDetailView(ticketDoc)
  const comments = commentsRaw.map(toCommentView)
  const events = eventsRaw.map(toEventView)

  const canUpdate = ability.can('update', 'ticket')
  const canAssign = ability.can('assign', 'ticket')
  const canComment = ability.can('create', 'comment')
  const canNote = ability.can('create', 'note')

  const status = statuses.find((s) => String(s._id) === ticket.statusId)
  const priority = priorities.find((p) => String(p._id) === ticket.priorityId)

  return (
    <>
      <Topbar
        title={`#${ticket.number} ${ticket.subject}`}
        description={ticket.owner?.name ?? undefined}
      />

      <main className="flex-1 px-8 py-6 animate-fade-in">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
          <div className="space-y-5">
            <Card className="p-6">
              <div className="flex flex-wrap items-center gap-2">
                {status && <DynamicBadge label={status.name} color={status.color} dot={false} />}
                {priority && <DynamicBadge label={priority.name} color={priority.color} />}
                {ticket.tags.map((t) => (
                  <Tag key={t.id}>{t.name}</Tag>
                ))}
              </div>
              <h1 className="mt-3 text-xl font-semibold tracking-tight text-foreground">
                {ticket.subject}
              </h1>
              <div
                className="mt-3 text-sm text-muted-strong [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                dangerouslySetInnerHTML={{ __html: ticket.issueHtml }}
              />
            </Card>

            <Card className="p-6">
              <h2 className="mb-4 text-sm font-semibold text-foreground">Conversation</h2>
              <CommentThread
                ticketNumber={ticket.number}
                comments={comments}
                canComment={canComment}
                canNote={canNote}
              />
            </Card>
          </div>

          <div className="space-y-5">
            <Card className="p-5">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted">
                Details
              </h2>
              <TicketDetailSidebar
                ticketNumber={ticket.number}
                statusId={ticket.statusId}
                assignee={ticket.assignee}
                priorityId={ticket.priorityId}
                typeId={ticket.typeId}
                dueDate={ticket.dueDate}
                statuses={statuses.map((s) => ({
                  id: String(s._id),
                  name: s.name,
                  color: s.color,
                }))}
                priorities={priorities.map((p) => ({
                  id: String(p._id),
                  name: p.name,
                  color: p.color,
                }))}
                types={types.map((t) => ({ id: String(t._id), name: t.name }))}
                users={users.map((u) => ({
                  id: String(u._id),
                  name: u.fullname || u.email || 'Unknown',
                }))}
                canUpdate={canUpdate}
                canAssign={canAssign}
              />
            </Card>

            <Card className="p-5">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted">
                Activity
              </h2>
              <ActivityTimeline events={events} />
            </Card>
          </div>
        </div>
      </main>
    </>
  )
}
