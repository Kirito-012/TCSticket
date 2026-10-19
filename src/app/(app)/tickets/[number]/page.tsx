import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ChevronDown, ExternalLink, MapPin } from 'lucide-react'
import { Topbar } from '@/components/layout/Topbar'
import { Card } from '@/components/ui/Card'
import { buttonVariants } from '@/components/ui/Button'

import { CommentThread } from '@/components/tickets/CommentThread'
import { ActivityTimeline } from '@/components/tickets/ActivityTimeline'
import { TicketDetailSidebar } from '@/components/tickets/TicketDetailSidebar'
import { AssigneeDropdown } from '@/components/tickets/AssigneeDropdown'
import { StatusSelect } from '@/components/tickets/StatusSelect'
import { ResolutionPhotoGrid } from '@/components/tickets/ResolutionPhotoGrid'
import { DronePhoto } from '@/components/tickets/DronePhoto'
import { ReportViewer } from '@/components/tickets/ReportViewer'
import { SurveyorResolutionPanel } from '@/components/tickets/SurveyorResolutionPanel'
import { requireTicketScope } from '@/server/auth/session'
import { resolveRules } from '@/server/resolve-rules'
import { dbConnect } from '@/server/db/connect'
import * as ticketService from '@/server/services/ticket.service'
import { TicketStatusModel } from '@/server/db/models/ticket-status.model'
import { TicketPriorityModel } from '@/server/db/models/ticket-priority.model'
import { TicketTypeModel } from '@/server/db/models/ticket-type.model'
import * as userService from '@/server/services/user.service'
import { scopeAllows } from '@/lib/ticket-scope'
import { localizeIssueHtml } from '@/lib/localize-issue'
import { VerificationBadge } from '@/components/tickets/VerificationBadge'
import { VerificationControl } from '@/components/tickets/VerificationControl'
import { getT } from '@/i18n/server'
import { toTicketDetailView, toCommentView, toEventView } from '@/lib/ticket-view'
import { cn } from '@/lib/utils'
import { isDone, isUrgent, plainStatusLabel, plainTitle } from '@/lib/plain-words'

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ number: string }>
}) {
  const { number: numberParam } = await params
  const number = Number(numberParam)
  if (!Number.isInteger(number)) notFound()

  const { ability, scope, forcedAssigneeId } = await requireTicketScope()
  const t = await getT()

  await dbConnect()
  const ticketDoc = await ticketService.getTicketByNumber(number)
  if (!ticketDoc) notFound()

  // A ticket outside the person's scope (not theirs, or not in their sector / zone) doesn't exist
  // as far as they're concerned — same as it not existing, not a "you're not allowed" page (avoids
  // confirming it exists).
  const assignee = (ticketDoc as { assigneeId?: { _id?: unknown } | null }).assigneeId
  if (
    !scopeAllows(scope, {
      sectorKey: (ticketDoc as { sectorKey?: string | null }).sectorKey ?? null,
      assigneeId: assignee?._id ? String(assignee._id) : null,
    })
  ) {
    notFound()
  }

  const [commentsRaw, eventsRaw, statuses, priorities, types, users] = await Promise.all([
    ticketService.listComments(String(ticketDoc._id)),
    ticketService.listEvents(String(ticketDoc._id)),
    TicketStatusModel.find().sort({ order: 1 }).lean(),
    TicketPriorityModel.find().sort({ order: 1 }).lean(),
    TicketTypeModel.find({ isActive: true }).sort({ name: 1 }).lean(),
    userService.listAssignableUsers(scope),
  ])

  const ticket = toTicketDetailView(ticketDoc)
  const comments = commentsRaw.map(toCommentView)
  const events = eventsRaw.map(toEventView)

  const canUpdate = ability.can('update', 'ticket')
  const canAssign = ability.can('assign', 'ticket')
  const canComment = ability.can('create', 'comment')
  const canNote = ability.can('create', 'note')
  const canDeleteComment = ability.can('delete', 'comment')

  const status = statuses.find((s) => String(s._id) === ticket.statusId)
  const priority = priorities.find((p) => String(p._id) === ticket.priorityId)

  // Surveyor view: plain and big — what the job is, where it is, and the steps to finish it.
  // (Agent scope = Surveyor; Admin/Manager keep the full page below.)
  if (forcedAssigneeId) {
    const done = isDone(status)
    return (
      <>
        <Topbar title={t('Ticket')} description={plainTitle(ticket.subject, t)} />
        <main className="flex-1 px-4 py-6 animate-fade-in sm:px-8">
          <div className="mx-auto max-w-6xl space-y-5">
            <Link
              href="/tickets"
              className="inline-flex min-h-12 items-center gap-2 rounded-2xl border-2 border-border-strong bg-surface px-5 text-lg font-bold text-foreground"
            >
              <ArrowLeft className="h-6 w-6" strokeWidth={2.5} />
              {t('Back to my tickets')}
            </Link>

            <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
              <Card className="p-5 sm:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'rounded-full px-3 py-1 text-base font-semibold',
                      done ? 'bg-accent-soft text-accent-strong' : 'bg-warning-soft text-warning',
                    )}
                  >
                    {plainStatusLabel(status, t)}
                  </span>
                  {!done && isUrgent(priority) && (
                    <span className="rounded-full bg-danger px-3 py-1 text-base font-semibold text-white">
                      {t('Urgent')}
                    </span>
                  )}
                  {done && <VerificationBadge status={ticket.verification} />}
                </div>
                <h1 className="mt-3 text-2xl font-bold leading-snug text-foreground [overflow-wrap:anywhere]">
                  {plainTitle(ticket.subject, t)}
                </h1>
                <div
                  className="mt-3 text-lg leading-relaxed text-muted-strong [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                  dangerouslySetInnerHTML={{
                    // "Show me the way" below replaces the ticket's own Google Maps link.
                    __html: localizeIssueHtml(
                      ticket.issueHtml.replace(
                        /<p>\s*<a[^>]*>\s*Open location in Google Maps\s*<\/a>\s*<\/p>/i,
                        '',
                      ),
                      t,
                    ),
                  }}
                />
                {ticket.sourcePhotos.length > 0 && (
                  <div className="mt-6 space-y-3">
                    <h2 className="text-xl font-bold text-foreground">
                      {ticket.source === 'api'
                        ? t('Photo from the drone')
                        : t('Photos of the place')}
                    </h2>
                    <DronePhoto photos={ticket.sourcePhotos} />
                  </div>
                )}
                {ticket.report && (
                  <div className="mt-6 space-y-3">
                    <h2 className="text-xl font-bold text-foreground">{t('The report')}</h2>
                    <ReportViewer
                      number={ticket.number}
                      name={ticket.report.name}
                      bytes={ticket.report.bytes}
                      uploadedAt={ticket.report.uploadedAt}
                    />
                  </div>
                )}
                {ticket.location && (
                  <div className="mt-6 space-y-3">
                    <h2 className="text-xl font-bold text-foreground">{t('Where is it?')}</h2>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${ticket.location.latitude},${ticket.location.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-accent px-5 text-lg font-bold text-white"
                    >
                      <MapPin className="h-6 w-6" strokeWidth={2.5} />
                      {t('Show me the way')}
                    </a>
                    <iframe
                      title={t('Map of the place')}
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${ticket.location.longitude - 0.01}%2C${ticket.location.latitude - 0.01}%2C${ticket.location.longitude + 0.01}%2C${ticket.location.latitude + 0.01}&layer=mapnik&marker=${ticket.location.latitude}%2C${ticket.location.longitude}`}
                      className="h-56 w-full rounded-2xl border-2 border-border-strong"
                      loading="lazy"
                    />
                  </div>
                )}
              </Card>

              <Card className="p-5 sm:p-6">
                <h2 className="mb-5 text-2xl font-bold text-foreground">
                  {done ? t('Your work') : t('Finish this ticket')}
                </h2>
                <SurveyorResolutionPanel
                  ticketNumber={ticket.number}
                  photos={ticket.resolutionPhotos}
                  isResolved={done}
                  resolutionNote={ticket.resolutionNote}
                  target={ticket.location}
                  rules={resolveRules()}
                  originalPhotoUrl={ticket.sourcePhotos[0]?.url ?? null}
                />
              </Card>
            </div>
          </div>
        </main>
      </>
    )
  }

  // Admins and Managers: the same simple page — the task, who has it, how it is going — with
  // priority, type, due date and the activity log folded away under "More options".
  const done = isDone(status)
  const people = users.map((u) => ({
    id: String(u._id),
    name: u.fullname || u.email || 'Unknown',
  }))
  const statusOptions = statuses.map((s) => ({ id: String(s._id), name: s.name, color: s.color }))
  return (
    <>
      <Topbar title={`Ticket #${ticket.number}`} description={plainTitle(ticket.subject)} />

      <main className="flex-1 px-4 py-6 animate-fade-in sm:px-8">
        <div className="mx-auto max-w-6xl space-y-5">
          <Link
            href="/tickets"
            className="inline-flex min-h-12 items-center gap-2 rounded-2xl border-2 border-border-strong bg-surface px-5 text-lg font-bold text-foreground hover:bg-surface-hover"
          >
            <ArrowLeft className="h-6 w-6" strokeWidth={2.5} />
            Back to tickets
          </Link>

          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1fr_380px]">
            <div className="space-y-5">
              <Card className="p-5 sm:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'rounded-full px-3 py-1 text-base font-semibold',
                      done ? 'bg-accent-soft text-accent-strong' : 'bg-warning-soft text-warning',
                    )}
                  >
                    {plainStatusLabel(status)}
                  </span>
                  {!done && isUrgent(priority) && (
                    <span className="rounded-full bg-danger px-3 py-1 text-base font-semibold text-white">
                      Urgent
                    </span>
                  )}
                  {done && <VerificationBadge status={ticket.verification} />}
                </div>
                <h1 className="mt-3 text-2xl font-bold leading-snug text-foreground [overflow-wrap:anywhere]">
                  {plainTitle(ticket.subject)}
                </h1>
                {done && ticket.verification && canAssign && (
                  <div className="mt-4">
                    <VerificationControl
                      ticketNumber={ticket.number}
                      status={ticket.verification}
                    />
                  </div>
                )}
                <div
                  className="mt-3 text-lg leading-relaxed text-muted-strong [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                  dangerouslySetInnerHTML={{
                    // The "Open the map" button below replaces the ticket's own Maps link.
                    __html: ticket.issueHtml.replace(
                      /<p>\s*<a[^>]*>\s*Open location in Google Maps\s*<\/a>\s*<\/p>/i,
                      '',
                    ),
                  }}
                />
                {ticket.droneSevaUrl && (
                  <a
                    href={ticket.droneSevaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      buttonVariants({ variant: 'secondary', size: 'md' }),
                      'mt-4 border-accent/30 bg-accent-soft text-accent-strong',
                    )}
                  >
                    <ExternalLink className="h-4 w-4" />
                    View in DroneSeva
                  </a>
                )}
                {ticket.sourcePhotos.length > 0 && (
                  <div className="mt-6 space-y-3">
                    <h2 className="text-xl font-bold text-foreground">
                      {ticket.source === 'api' ? 'Drone photo' : 'Photos'}
                    </h2>
                    <DronePhoto photos={ticket.sourcePhotos} showTime />
                  </div>
                )}
                {ticket.report && (
                  <div className="mt-6 space-y-3">
                    <h2 className="text-xl font-bold text-foreground">Detection report</h2>
                    <ReportViewer
                      number={ticket.number}
                      name={ticket.report.name}
                      bytes={ticket.report.bytes}
                      uploadedAt={ticket.report.uploadedAt}
                    />
                  </div>
                )}
                {ticket.location && (
                  <div className="mt-6 space-y-3">
                    <h2 className="text-xl font-bold text-foreground">Where is it?</h2>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${ticket.location.latitude},${ticket.location.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-accent px-5 text-lg font-bold text-on-accent"
                    >
                      <MapPin className="h-6 w-6" strokeWidth={2.5} />
                      Open the map
                    </a>
                    <iframe
                      title="Map of the place"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${ticket.location.longitude - 0.01}%2C${ticket.location.latitude - 0.01}%2C${ticket.location.longitude + 0.01}%2C${ticket.location.latitude + 0.01}&layer=mapnik&marker=${ticket.location.latitude}%2C${ticket.location.longitude}`}
                      className="h-56 w-full rounded-2xl border-2 border-border-strong"
                      loading="lazy"
                    />
                  </div>
                )}
              </Card>

              <Card className="p-5 sm:p-6">
                <h2 className="mb-4 text-xl font-bold text-foreground">Messages</h2>
                <CommentThread
                  ticketNumber={ticket.number}
                  comments={comments}
                  canComment={canComment}
                  canNote={canNote}
                  canDeleteComment={canDeleteComment}
                />
              </Card>
            </div>

            <div className="space-y-5">
              <Card className="space-y-5 p-5 sm:p-6">
                <h2 className="text-xl font-bold text-foreground">Handle this ticket</h2>
                <div>
                  <p className="mb-1.5 text-base font-semibold text-muted-strong">Who does this?</p>
                  <AssigneeDropdown
                    ticketNumber={ticket.number}
                    assignee={ticket.assignee}
                    users={people}
                    disabled={!canAssign}
                    large
                  />
                </div>
                <div>
                  <p className="mb-1.5 text-base font-semibold text-muted-strong">
                    How is it going?
                  </p>
                  <StatusSelect
                    ticketNumber={ticket.number}
                    statusId={ticket.statusId}
                    statuses={statusOptions}
                    disabled={!canUpdate}
                    large
                  />
                </div>
              </Card>

              <details className="group rounded-2xl border-2 border-border-strong bg-surface">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-5 text-lg font-bold text-foreground [&::-webkit-details-marker]:hidden">
                  More options
                  <ChevronDown className="h-6 w-6 text-muted transition-transform group-open:rotate-180" />
                </summary>
                <div className="space-y-6 border-t-2 border-border p-5">
                  <TicketDetailSidebar
                    compact
                    ticketNumber={ticket.number}
                    statusId={ticket.statusId}
                    assignee={ticket.assignee}
                    priorityId={ticket.priorityId}
                    typeId={ticket.typeId}
                    dueDate={ticket.dueDate}
                    statuses={statusOptions}
                    priorities={priorities.map((p) => ({
                      id: String(p._id),
                      name: p.name,
                      color: p.color,
                    }))}
                    types={types.map((t) => ({ id: String(t._id), name: t.name }))}
                    users={people}
                    canUpdate={canUpdate}
                    canAssign={canAssign}
                  />
                  <div>
                    <h3 className="mb-3 text-base font-bold text-foreground">History</h3>
                    <ActivityTimeline events={events} />
                  </div>
                </div>
              </details>

              {(ticket.resolutionPhotos.length > 0 || ticket.resolutionNote) && (
                <Card className="p-5 sm:p-6">
                  <h2 className="text-xl font-bold text-foreground">What the inspector did</h2>
                  {ticket.resolutionNote && (
                    <div className="mt-3 rounded-2xl border-2 border-border bg-surface-hover p-4">
                      <p className="mb-1 text-base font-semibold text-muted">Their note</p>
                      <p className="whitespace-pre-wrap text-lg text-foreground">
                        {ticket.resolutionNote}
                      </p>
                    </div>
                  )}
                  {ticket.resolutionPhotos.length > 0 && (
                    <div className="mt-4">
                      <p className="mb-2 text-base font-semibold text-muted">
                        Photos ({ticket.resolutionPhotos.length}) — tap one to enlarge
                      </p>
                      <ResolutionPhotoGrid photos={ticket.resolutionPhotos} compact />
                    </div>
                  )}
                </Card>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
