import 'server-only'

import { QueryFilter, Types } from 'mongoose'
import { dbConnect } from '@/server/db/connect'
import { TicketModel, type Ticket } from '@/server/db/models/ticket.model'
import { TicketCommentModel } from '@/server/db/models/ticket-comment.model'
import { TicketEventModel } from '@/server/db/models/ticket-event.model'
import { TicketStatusModel } from '@/server/db/models/ticket-status.model'
import { TicketPriorityModel } from '@/server/db/models/ticket-priority.model'
import { TicketTypeModel } from '@/server/db/models/ticket-type.model'
import { TagModel } from '@/server/db/models/tag.model'
import { UserModel } from '@/server/db/models/user.model'
import { extractLocation } from '@/lib/droneseva-link'
import { resolveRules } from '@/server/resolve-rules'
import { REOPENED_STATUS } from '@/server/reopened-status'
import { nextSequence } from '@/server/db/models/counter.model'
import { getRealSectors } from '@/server/sectors'
import type { TicketScope } from '@/lib/ticket-scope'

const POPULATE = [
  { path: 'ownerId', select: 'fullname email avatarUrl' },
  { path: 'assigneeId', select: 'fullname email avatarUrl' },
  { path: 'typeId', select: 'name slug' },
  { path: 'statusId', select: 'name slug color isResolved' },
  { path: 'priorityId', select: 'name slug color' },
  { path: 'tagIds', select: 'name slug color' },
]

/**
 * The part of a ticket query that keeps a person inside what they may see (see
 * src/lib/ticket-scope.ts): their own tickets, or the tickets of their sector / zone. Add it to
 * every query that feeds a screen.
 */
export function scopeFilter(scope?: TicketScope): QueryFilter<Ticket> {
  if (!scope || scope.kind === 'all') return {}
  if (scope.kind === 'own') return { assigneeId: new Types.ObjectId(scope.assigneeId) }
  return { sectorKey: { $in: scope.sectorKeys } }
}

/** Like scopeFilter, but only the sector part: for numbers that are about the place, not the person. */
function sectorOnlyFilter(scope?: TicketScope): QueryFilter<Ticket> {
  return scope?.kind === 'sectors' ? { sectorKey: { $in: scope.sectorKeys } } : {}
}

export type ListTicketsParams = {
  /** Who is asking. Whatever else is asked for, tickets outside this scope never come back. */
  scope?: TicketScope
  status?: string
  priority?: string
  type?: string
  assigneeId?: string
  sectorKey?: string
  /** Only tickets nobody is assigned to. */
  unassigned?: boolean
  /** true = only finished (Resolved/Closed) tickets, false = only unfinished ones. */
  resolved?: boolean
  /** Only Critical or High priority tickets. */
  urgent?: boolean
  /**
   * Only finished tickets that were checked ('verified') or not yet checked ('unverified') after
   * the cleanup.
   */
  verification?: 'verified' | 'unverified'
  /** How long ago the ticket was created: under a day, 1-3 days, 3-7 days, over a week. */
  age?: 'today' | 'd1to3' | 'd3to7' | 'over7'
  /** Created on this local calendar day (YYYY-MM-DD). */
  createdOn?: string
  /** Finished on this local calendar day (YYYY-MM-DD). */
  resolvedOn?: string
  /** A date range (inclusive, YYYY-MM-DD, either end optional)... */
  dateFrom?: string
  dateTo?: string
  /** ...on the day tickets arrived (default) or the day they were finished. */
  dateBy?: 'created' | 'finished'
  tag?: string
  q?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
  sortField?: 'lastActivityAt' | 'createdAt' | 'number'
  sortDir?: 'asc' | 'desc'
}

export async function listTickets(params: ListTicketsParams) {
  await dbConnect()

  const page = Math.max(1, params.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20))

  const filter: QueryFilter<Ticket> = { deletedAt: null }

  const [status, priority, type, tag] = await Promise.all([
    params.status ? TicketStatusModel.findOne({ slug: params.status }).lean() : null,
    params.priority ? TicketPriorityModel.findOne({ slug: params.priority }).lean() : null,
    params.type ? TicketTypeModel.findOne({ slug: params.type }).lean() : null,
    params.tag ? TagModel.findOne({ slug: params.tag }).lean() : null,
  ])

  if (status) filter.statusId = status._id
  if (priority) filter.priorityId = priority._id
  if (type) filter.typeId = type._id
  if (tag) filter.tagIds = tag._id
  if (params.assigneeId) filter.assigneeId = params.assigneeId
  if (params.unassigned) filter.assigneeId = null
  if (params.resolved !== undefined) {
    const resolvedIds = (
      await TicketStatusModel.find({ isResolved: true }).select('_id').lean()
    ).map((s) => s._id)
    filter.statusId = params.resolved ? { $in: resolvedIds } : { $nin: resolvedIds }
    // A specific status only fits the tab it belongs to (e.g. "Open" is never on the Done tab).
    if (status) {
      filter.statusId = status.isResolved === params.resolved ? status._id : { $in: [] }
    }
  }
  if (params.sectorKey) filter.sectorKey = params.sectorKey
  if (params.verification) {
    const finished = (await TicketStatusModel.find({ isResolved: true }).select('_id').lean()).map(
      (s) => s._id,
    )
    filter.$and = [
      ...(filter.$and ?? []),
      { statusId: { $in: finished } },
      params.verification === 'verified'
        ? { 'verification.status': 'verified' }
        : { 'verification.status': { $ne: 'verified' } },
    ]
  }
  if (params.urgent) {
    const urgentIds = (
      await TicketPriorityModel.find({ slug: { $in: ['critical', 'high'] } })
        .select('_id')
        .lean()
    ).map((p) => p._id)
    filter.priorityId = { $in: urgentIds }
  }
  const DAY = 24 * 60 * 60 * 1000
  const ageNow = Date.now()
  const ageRange = {
    today: { $gte: new Date(ageNow - DAY) },
    d1to3: { $gte: new Date(ageNow - 3 * DAY), $lt: new Date(ageNow - DAY) },
    d3to7: { $gte: new Date(ageNow - 7 * DAY), $lt: new Date(ageNow - 3 * DAY) },
    over7: { $lt: new Date(ageNow - 7 * DAY) },
  }
  if (params.age)
    filter.createdAt = {
      ...(filter.createdAt as Record<string, Date> | undefined),
      ...ageRange[params.age],
    }
  const localDay = (iso: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
    if (!m) return null
    const start = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    return { $gte: start, $lt: new Date(start.getTime() + DAY) }
  }
  const createdDay = params.createdOn ? localDay(params.createdOn) : null
  if (createdDay)
    filter.createdAt = { ...(filter.createdAt as Record<string, Date> | undefined), ...createdDay }
  const resolvedDay = params.resolvedOn ? localDay(params.resolvedOn) : null
  if (resolvedDay) filter.resolvedAt = resolvedDay
  const dayStart = (iso?: string) => {
    const m = iso ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso) : null
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
  }
  const rangeFrom = dayStart(params.dateFrom)
  const rangeTo = dayStart(params.dateTo)
  if (rangeFrom || rangeTo) {
    const range: { $gte?: Date; $lt?: Date } = {}
    if (rangeFrom) range.$gte = rangeFrom
    if (rangeTo) range.$lt = new Date(rangeTo.getTime() + DAY) // the end day is included
    if (params.dateBy === 'finished') {
      filter.resolvedAt = { ...(filter.resolvedAt as Record<string, Date> | undefined), ...range }
    } else {
      filter.createdAt = { ...(filter.createdAt as Record<string, Date> | undefined), ...range }
    }
  }
  if (params.q) {
    // A bare number ("4716" or "#4716") jumps to that ticket; anything else is a text search.
    const asNumber = /^#?(\d{1,9})$/.exec(params.q.trim())
    if (asNumber) filter.number = Number(asNumber[1])
    else filter.$text = { $search: params.q }
  }

  if (params.from || params.to) {
    filter.createdAt = {}
    if (params.from) filter.createdAt.$gte = new Date(params.from)
    if (params.to) filter.createdAt.$lte = new Date(params.to)
  }

  // Last, so nothing asked for above can widen what this person is allowed to see.
  if (params.scope?.kind === 'own') filter.assigneeId = new Types.ObjectId(params.scope.assigneeId)
  if (params.scope?.kind === 'sectors') {
    const allowed = params.scope.sectorKeys
    const asked = params.sectorKey
    filter.sectorKey = { $in: asked ? allowed.filter((k) => k === asked) : allowed }
  }

  const sortField = params.sortField ?? 'lastActivityAt'
  const sortDir = params.sortDir === 'asc' ? 1 : -1

  const [items, total] = await Promise.all([
    TicketModel.find(filter)
      .sort({ [sortField]: sortDir })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .populate(POPULATE)
      .lean(),
    TicketModel.countDocuments(filter),
  ])

  return { items, total, page, pageSize }
}

/**
 * Counts of non-deleted tickets per status, keyed by status slug, plus a grand total, for the
 * tickets this scope may see (see `requireTicketScope()` in `src/server/auth/session.ts`).
 */
export async function countTicketsByStatus(scope?: TicketScope) {
  await dbConnect()

  const statuses = await TicketStatusModel.find().sort({ order: 1 }).lean()
  // scopeFilter casts the assignee to an ObjectId: aggregate() does NOT schema-cast filter values
  // the way find()/countDocuments() do, so an uncast string would silently match nothing.
  const match: QueryFilter<Ticket> = { deletedAt: null, ...scopeFilter(scope) }
  const counts = await TicketModel.aggregate([
    { $match: match },
    { $group: { _id: '$statusId', count: { $sum: 1 } } },
  ])

  const countByStatusId = new Map(counts.map((c) => [String(c._id), c.count]))
  const byStatus = statuses.map((s) => ({
    slug: s.slug,
    name: s.name,
    count: countByStatusId.get(String(s._id)) ?? 0,
  }))
  const total = byStatus.reduce((sum, s) => sum + s.count, 0)

  return { total, byStatus }
}

/**
 * Everything the dashboard page needs, in one call, for the tickets this scope may see (see
 * `requireTicketScope()`). Admins pass nothing and see the whole workspace.
 */
export async function getDashboardData(scope?: TicketScope) {
  await dbConnect()

  // scopeFilter uses an ObjectId for the assignee, not a string — this feeds both countDocuments()
  // (casts either way) and the aggregate() pipelines below (do NOT cast).
  const baseMatch: QueryFilter<Ticket> = { deletedAt: null, ...scopeFilter(scope) }
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const sevenDaysAgo = new Date(startOfToday)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6) // today + 6 previous days = 7

  // Bucket by the server's local calendar day, not UTC — otherwise createdAt timestamps from
  // today (local) that fall before UTC midnight get grouped into "yesterday" and today's bar
  // never shows up.
  const tzOffsetMinutes = -new Date().getTimezoneOffset()
  const tzSign = tzOffsetMinutes >= 0 ? '+' : '-'
  const tzAbs = Math.abs(tzOffsetMinutes)
  const dateToStringTimezone = `${tzSign}${String(Math.floor(tzAbs / 60)).padStart(2, '0')}:${String(tzAbs % 60).padStart(2, '0')}`
  const toLocalISODate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const [resolvedTodayCount, priorityRows, volumeRows, resolvedStatusIds] = await Promise.all([
    TicketModel.countDocuments({
      ...baseMatch,
      resolvedAt: { $gte: startOfToday },
    }),
    TicketModel.aggregate([
      { $match: baseMatch },
      { $lookup: { from: 'ticketstatuses', localField: 'statusId', foreignField: '_id', as: 's' } },
      { $unwind: '$s' },
      { $match: { 's.isResolved': false } },
      { $group: { _id: '$priorityId', count: { $sum: 1 } } },
    ]),
    TicketModel.aggregate([
      {
        $facet: {
          created: [
            { $match: { ...baseMatch, createdAt: { $gte: sevenDaysAgo } } },
            {
              $group: {
                _id: {
                  $dateToString: {
                    format: '%Y-%m-%d',
                    date: '$createdAt',
                    timezone: dateToStringTimezone,
                  },
                },
                n: { $sum: 1 },
              },
            },
          ],
          resolved: [
            { $match: { ...baseMatch, resolvedAt: { $gte: sevenDaysAgo } } },
            {
              $group: {
                _id: {
                  $dateToString: {
                    format: '%Y-%m-%d',
                    date: '$resolvedAt',
                    timezone: dateToStringTimezone,
                  },
                },
                n: { $sum: 1 },
              },
            },
          ],
        },
      },
    ]),
    TicketStatusModel.find({ isResolved: true }).select('_id').lean(),
  ])

  const priorities = await TicketPriorityModel.find().sort({ order: 1 }).lean()
  const priorityCountById = new Map(priorityRows.map((r) => [String(r._id), r.count]))
  const priorityBreakdown = priorities.map((p) => ({
    name: p.name,
    slug: p.slug,
    color: p.color,
    value: priorityCountById.get(String(p._id)) ?? 0,
  }))

  const days: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgo)
    d.setDate(d.getDate() + i)
    days.push(toLocalISODate(d))
  }
  const dayLabel = new Intl.DateTimeFormat('en-US', { weekday: 'short' })
  const createdByDay = new Map<string, number>(
    volumeRows[0].created.map((r: { _id: string; n: number }): [string, number] => [r._id, r.n]),
  )
  const resolvedByDay = new Map<string, number>(
    volumeRows[0].resolved.map((r: { _id: string; n: number }): [string, number] => [r._id, r.n]),
  )
  const ticketVolume = days.map((iso) => ({
    day: dayLabel.format(new Date(iso + 'T00:00:00')),
    created: createdByDay.get(iso) ?? 0,
    resolved: resolvedByDay.get(iso) ?? 0,
  }))

  const resolvedIds = resolvedStatusIds.map((s) => s._id)
  const openMatch: QueryFilter<Ticket> = { ...baseMatch, statusId: { $nin: resolvedIds } }
  const [openTicketsCount, totalCount, unassignedCount] = await Promise.all([
    TicketModel.countDocuments(openMatch),
    TicketModel.countDocuments(baseMatch),
    // "How many need a home" is a question for whoever hands tickets out, so it covers their zone
    // or sector. null for a Surveyor (their view is locked to their own tickets).
    scope?.kind === 'own'
      ? null
      : TicketModel.countDocuments({
          deletedAt: null,
          assigneeId: null,
          ...sectorOnlyFilter(scope),
        }),
  ])

  // Recent activity — most recent events, only on the tickets this scope may see.
  const eventTicketFilter: QueryFilter<Ticket> = { deletedAt: null, ...scopeFilter(scope) }
  const scopedTicketIds =
    scope && scope.kind !== 'all'
      ? (await TicketModel.find(eventTicketFilter).select('_id').lean()).map((t) => t._id)
      : null
  const eventMatch = scopedTicketIds ? { ticketId: { $in: scopedTicketIds } } : {}
  const recentEvents = await TicketEventModel.find(eventMatch)
    .sort({ createdAt: -1 })
    .limit(8)
    .populate([
      { path: 'actorId', select: 'fullname email' },
      { path: 'ticketId', select: 'number subject' },
    ])
    .lean()

  // Workload by assignee — open tickets grouped by who holds them. For an Agent (assigneeId set)
  // this degenerates to at most their own row, deliberately: their dashboard shouldn't reveal
  // other agents' queues.
  const workloadRows = await TicketModel.aggregate([
    { $match: openMatch },
    { $match: { assigneeId: { $ne: null } } },
    { $group: { _id: '$assigneeId', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 6 },
  ])
  const workloadUserIds = workloadRows.map((r) => r._id)
  const workloadUsers = await UserModel.find({ _id: { $in: workloadUserIds } })
    .select('fullname')
    .lean()
  const nameById = new Map(workloadUsers.map((u) => [String(u._id), u.fullname]))
  const workloadByAssignee = workloadRows.map((r) => ({
    name: nameById.get(String(r._id)) ?? 'Unknown',
    count: r.count as number,
  }))
  const sectorRows = await TicketModel.aggregate([
    { $match: baseMatch },
    { $match: { sectorKey: { $ne: null } } },
    {
      $group: {
        _id: '$sectorKey',
        count: { $sum: 1 },
        open: {
          $sum: {
            $cond: [{ $in: ['$statusId', resolvedIds] }, 0, 1],
          },
        },
      },
    },
  ])
  const sectorCounts = new Map(
    sectorRows.map((row) => [row._id, { count: row.count as number, open: row.open as number }]),
  )
  // The sector outlines come from a separate Postgres database. If it is slow or unreachable,
  // show the dashboard without them rather than hanging the whole page.
  const sectorOutlines = await Promise.race([
    getRealSectors().catch(() => []),
    new Promise<Awaited<ReturnType<typeof getRealSectors>>>((resolve) =>
      setTimeout(() => resolve([]), 6000),
    ),
  ])
  const sectors = sectorOutlines
    .filter((sector) => scope?.kind !== 'sectors' || scope.sectorKeys.includes(sector.key))
    .map((sector) => ({
      ...sector,
      count: sectorCounts.get(sector.key)?.count ?? 0,
      openCount: sectorCounts.get(sector.key)?.open ?? 0,
    }))

  return {
    openTicketsCount,
    totalCount,
    unassignedCount,
    resolvedTodayCount,
    priorityBreakdown,
    ticketVolume,
    workloadByAssignee,
    sectors,
    recentActivity: recentEvents.map((e) => {
      const ev = e as unknown as {
        _id: unknown
        action: string
        createdAt: Date
        actorId: { fullname?: string; email?: string } | null
        ticketId: { _id: unknown; number: number; subject: string } | null
      }
      return {
        id: String(ev._id),
        action: ev.action,
        createdAt: ev.createdAt.toISOString(),
        actorName: ev.actorId?.fullname ?? ev.actorId?.email ?? 'Someone',
        ticketNumber: ev.ticketId?.number ?? null,
        ticketSubject: ev.ticketId?.subject ?? null,
      }
    }),
  }
}

export async function getTicketByNumber(number: number) {
  await dbConnect()
  return TicketModel.findOne({ number, deletedAt: null }).populate(POPULATE).lean()
}

export async function createTicket(input: {
  subject: string
  issue: string
  typeId: string
  priorityId: string
  ownerId: string
  assigneeId?: string | null
  sectorKey?: string | null
  location?: { latitude: number; longitude: number } | null
  tagIds?: string[]
  /** Defaults to 'web' (schema default) — pass 'api' for integration-created tickets. */
  source?: 'web' | 'email' | 'api' | 'public'
  /** Photos attached when the ticket is made (already uploaded). */
  photos?: { url: string; publicId: string; width: number; height: number }[]
}) {
  await dbConnect()

  const status = await TicketStatusModel.findOne({ isDefault: true }).lean()
  if (!status) throw new Error('No default ticket status configured — run the seed script.')

  const number = await nextSequence('tickets')

  const ticket = await TicketModel.create({
    number,
    subject: input.subject,
    issue: input.issue,
    ownerId: input.ownerId,
    assigneeId: input.assigneeId ?? null,
    sectorKey: input.sectorKey ?? null,
    location: input.location ?? { latitude: null, longitude: null },
    typeId: input.typeId,
    priorityId: input.priorityId,
    statusId: status._id,
    tagIds: input.tagIds ?? [],
    source: input.source ?? 'web',
    sourcePhotos: (input.photos ?? []).map((p) => ({ ...p, uploadedAt: new Date() })),
    counts: { comments: 0, attachments: input.photos?.length ?? 0 },
    lastActivityAt: new Date(),
  })

  await TicketEventModel.create({
    ticketId: ticket._id,
    actorId: input.ownerId,
    action: 'created',
  })

  return ticket
}

const EDITABLE_FIELDS = [
  'subject',
  'statusId',
  'assigneeId',
  'priorityId',
  'typeId',
  'dueDate',
] as const
type EditableField = (typeof EDITABLE_FIELDS)[number]

/** Moves a finished ticket's proof photos and note aside when it is reopened, so new proof is needed. */
function archiveResolution(ticket: {
  get: (path: string) => unknown
  set: (path: string, value: unknown) => unknown
}) {
  const photos = (ticket.get('resolutionPhotos') as Record<string, unknown>[] | undefined) ?? []
  if (photos.length > 0) {
    const earlier = (ticket.get('earlierResolutionPhotos') as unknown[] | undefined) ?? []
    ticket.set('earlierResolutionPhotos', [
      ...earlier,
      ...photos.map((p) => {
        const plain = (p as { toObject?: () => Record<string, unknown> }).toObject?.() ?? p
        return {
          url: plain.url,
          publicId: plain.publicId,
          width: plain.width,
          height: plain.height,
          uploadedAt: plain.uploadedAt ?? null,
        }
      }),
    ])
    ticket.set('resolutionPhotos', [])
  }
  const note = ticket.get('resolutionNote') as string | undefined
  if (note) {
    ticket.set('earlierResolutionNote', note)
    ticket.set('resolutionNote', '')
  }
}

export async function updateTicketFields(
  number: number,
  patch: Partial<Record<EditableField, string | Date | null>>,
  actorId: string,
) {
  await dbConnect()

  const ticket = await TicketModel.findOne({ number, deletedAt: null })
  if (!ticket) throw new Error('Ticket not found')

  const events = []
  for (const field of EDITABLE_FIELDS) {
    if (!(field in patch)) continue
    const from = ticket.get(field)
    const to = patch[field]
    const fromStr = from ? String(from) : null
    const toStr = to ? String(to) : null
    if (fromStr === toStr) continue

    ticket.set(field, to)
    events.push({
      ticketId: ticket._id,
      actorId,
      action: 'field_changed',
      field,
      from: fromStr,
      to: toStr,
    })
  }

  if (events.length === 0) return ticket

  ticket.lastActivityAt = new Date()
  const status = ticket.statusId ? await TicketStatusModel.findById(ticket.statusId).lean() : null
  if (status?.isResolved && !ticket.resolvedAt) ticket.resolvedAt = new Date()
  // Moving a finished ticket back to unfinished work (reopening it) clears the finished dates.
  if (status && !status.isResolved && events.some((e) => e.field === 'statusId')) {
    if (ticket.resolvedAt) archiveResolution(ticket)
    ticket.set('resolvedAt', null)
    ticket.set('closedAt', null)
  }
  // A change of status (finished, or reopened) always starts the check over: not verified.
  if (events.some((e) => e.field === 'statusId')) {
    ticket.set('verification', { status: 'not_verified' })
  }

  await ticket.save()
  await TicketEventModel.insertMany(events)

  return ticket
}

export async function softDeleteTicket(number: number, actorId: string) {
  await dbConnect()
  const ticket = await TicketModel.findOneAndUpdate(
    { number, deletedAt: null },
    { deletedAt: new Date() },
    { returnDocument: 'after' },
  )
  if (ticket) {
    await TicketEventModel.create({ ticketId: ticket._id, actorId, action: 'deleted' })
  }
  return ticket
}

/** Soft-deletes many tickets (they leave every list; the data stays and can be restored). Returns how many. */
export async function bulkDeleteTickets(numbers: number[], actorId: string) {
  await dbConnect()
  let deleted = 0
  for (const number of numbers) {
    if (await softDeleteTicket(number, actorId)) deleted += 1
  }
  return deleted
}

export async function restoreTicket(number: number, actorId: string) {
  await dbConnect()
  const ticket = await TicketModel.findOneAndUpdate(
    { number, deletedAt: { $ne: null } },
    { deletedAt: null },
    { returnDocument: 'after' },
  )
  if (ticket) {
    await TicketEventModel.create({ ticketId: ticket._id, actorId, action: 'restored' })
  }
  return ticket
}

export async function addComment(input: {
  ticketNumber: number
  authorId: string
  body: string
  isInternal: boolean
  attachments?: { url: string; publicId: string; width: number; height: number }[]
}) {
  await dbConnect()

  const ticket = await TicketModel.findOne({ number: input.ticketNumber, deletedAt: null })
  if (!ticket) throw new Error('Ticket not found')

  const attachments = input.attachments ?? []

  const comment = await TicketCommentModel.create({
    ticketId: ticket._id,
    authorId: input.authorId,
    body: input.body,
    isInternal: input.isInternal,
    attachments,
  })

  ticket.counts.comments += 1
  ticket.counts.attachments += attachments.length
  ticket.lastActivityAt = new Date()
  if (!ticket.firstResponseAt && !input.isInternal) ticket.firstResponseAt = new Date()
  await ticket.save()

  await TicketEventModel.create({
    ticketId: ticket._id,
    actorId: input.authorId,
    action: input.isInternal ? 'note_added' : 'commented',
  })

  return comment
}

export async function listComments(ticketId: string) {
  await dbConnect()
  return TicketCommentModel.find({ ticketId, deletedAt: null })
    .sort({ createdAt: 1 })
    .populate({ path: 'authorId', select: 'fullname email avatarUrl' })
    .lean()
}

/** Soft-deletes a comment and decrements the parent ticket's counts. Returns the deleted
 *  comment (including its attachments, so the caller can clean those up in Cloudinary) or
 *  null if the comment doesn't exist / was already deleted. */
export async function softDeleteComment(commentId: string, actorId: string) {
  await dbConnect()

  const comment = await TicketCommentModel.findOneAndUpdate(
    { _id: commentId, deletedAt: null },
    { deletedAt: new Date() },
  )
  if (!comment) return null

  await TicketModel.updateOne(
    { _id: comment.ticketId },
    {
      $inc: {
        'counts.comments': -1,
        'counts.attachments': -(comment.attachments?.length ?? 0),
      },
    },
  )

  await TicketEventModel.create({
    ticketId: comment.ticketId,
    actorId,
    action: 'comment_deleted',
  })

  return comment
}

export async function listEvents(ticketId: string) {
  await dbConnect()
  return TicketEventModel.find({ ticketId })
    .sort({ createdAt: 1 })
    .populate({ path: 'actorId', select: 'fullname email avatarUrl' })
    .lean()
}

type ResolutionPhotoInput = { url: string; publicId: string; width: number; height: number }

export type ResolutionPhotoGarbageCheck = {
  status: 'ok' | 'unavailable'
  coveragePercent: number | null
  detections: number | null
}

export type ResolutionPhotoLocation = {
  latitude: number
  longitude: number
  accuracy: number | null
  distanceMeters: number | null
  withinRadius: boolean | null
  method: 'camera' | 'gallery'
  capturedAt: Date | null
}

/**
 * The spot a ticket is about: its stored coordinates, or (for older tickets) the ones written in
 * the issue text. Null when the ticket has no usable spot — then no location check applies.
 */
export async function getTicketTarget(number: number) {
  await dbConnect()
  const t = await TicketModel.findOne({ number, deletedAt: null }).select('location issue').lean()
  if (!t) return null
  const { latitude, longitude } = t.location ?? {}
  if (typeof latitude === 'number' && typeof longitude === 'number') return { latitude, longitude }
  return extractLocation(t.issue ?? '')
}

export async function addResolutionPhoto(
  number: number,
  photo: ResolutionPhotoInput,
  actorId: string,
  location?: ResolutionPhotoLocation | null,
  garbageCheck?: ResolutionPhotoGarbageCheck | null,
) {
  await dbConnect()
  const ticket = await TicketModel.findOneAndUpdate(
    { number, deletedAt: null },
    {
      $push: {
        resolutionPhotos: {
          ...photo,
          uploadedById: actorId,
          uploadedAt: new Date(),
          location: location ?? null,
          garbageCheck: garbageCheck ? { ...garbageCheck, checkedAt: new Date() } : null,
        },
      },
      $inc: { 'counts.attachments': 1 },
      $set: { lastActivityAt: new Date() },
    },
    { returnDocument: 'after' },
  )
  if (!ticket) throw new Error('Ticket not found')
  await TicketEventModel.create({ ticketId: ticket._id, actorId, action: 'photo_added' })
  return ticket
}

/** Removes a resolution photo from the ticket and returns it (so the caller can delete the
 *  Cloudinary file), or null if it wasn't there. */
export async function removeResolutionPhoto(number: number, publicId: string, actorId: string) {
  await dbConnect()
  const ticket = await TicketModel.findOneAndUpdate(
    { number, deletedAt: null, 'resolutionPhotos.publicId': publicId },
    {
      $pull: { resolutionPhotos: { publicId } },
      $inc: { 'counts.attachments': -1 },
      $set: { lastActivityAt: new Date() },
    },
    { returnDocument: 'before' },
  )
  if (!ticket) return null
  await TicketEventModel.create({ ticketId: ticket._id, actorId, action: 'photo_removed' })
  return ticket.resolutionPhotos.find((p: { publicId: string }) => p.publicId === publicId) ?? null
}

/** Marks a ticket Resolved. Requires at least one resolution photo — the proof-of-cleanup rule
 *  for surveyors lives here so every caller gets it. */
export async function resolveTicketWithProof(number: number, actorId: string, note = '') {
  await dbConnect()
  const ticket = await TicketModel.findOne({ number, deletedAt: null }).lean()
  if (!ticket) throw new Error('Ticket not found')
  if (!ticket.resolutionPhotos?.length) {
    throw new Error('Upload at least one photo before marking this ticket resolved.')
  }
  // When the ticket has a spot, at least one photo must have been taken within the radius of it.
  const target = await getTicketTarget(number)
  if (
    target &&
    !ticket.resolutionPhotos.some(
      (p: { location?: { withinRadius?: boolean | null } | null }) =>
        p.location?.withinRadius === true,
    )
  ) {
    throw new Error(
      `Take a photo at the place (within ${resolveRules().radiusMeters} m) before marking this ticket done.`,
    )
  }
  const resolved = await TicketStatusModel.findOne({ slug: 'resolved' }).lean()
  if (!resolved) throw new Error('No "Resolved" status configured — run the seed script.')
  if (note) await TicketModel.updateOne({ number, deletedAt: null }, { resolutionNote: note })
  return updateTicketFields(number, { statusId: String(resolved._id) }, actorId)
}

export async function getResolvedStatusId() {
  await dbConnect()
  const resolved = await TicketStatusModel.findOne({ slug: 'resolved' }).select('_id').lean()
  return resolved ? String(resolved._id) : null
}

/** Counts for the Admin/Manager task tabs and Home: unfinished, finished, unfinished-and-unassigned,
 *  all, and finished today. */
export async function getTaskTabCounts(scope?: TicketScope) {
  await dbConnect()
  const resolvedIds = (await TicketStatusModel.find({ isResolved: true }).select('_id').lean()).map(
    (s) => s._id,
  )
  const base: QueryFilter<Ticket> = { deletedAt: null, ...scopeFilter(scope) }
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const reopenedStatus = await TicketStatusModel.findOne({ slug: REOPENED_STATUS.slug })
    .select('_id')
    .lean()
  const [todo, done, unassigned, all, doneToday, reopened, verified] = await Promise.all([
    TicketModel.countDocuments({ ...base, statusId: { $nin: resolvedIds } }),
    TicketModel.countDocuments({ ...base, statusId: { $in: resolvedIds } }),
    TicketModel.countDocuments({ ...base, statusId: { $nin: resolvedIds }, assigneeId: null }),
    TicketModel.countDocuments(base),
    TicketModel.countDocuments({ ...base, resolvedAt: { $gte: startOfToday } }),
    reopenedStatus ? TicketModel.countDocuments({ ...base, statusId: reopenedStatus._id }) : 0,
    TicketModel.countDocuments({
      ...base,
      statusId: { $in: resolvedIds },
      'verification.status': 'verified',
    }),
  ])
  // Finished tickets whose cleanup has not been checked yet (by a lead or by the drone re-check).
  return { todo, done, unassigned, all, doneToday, reopened, verified, unverified: done - verified }
}

/** Assigns (or un-assigns, with null) many tickets at once, recording the change on each ticket's
 *  history. Returns how many changed. */
export async function bulkAssignTickets(
  numbers: number[],
  assigneeId: string | null,
  actorId: string,
) {
  let changed = 0
  for (const number of numbers) {
    const before = await TicketModel.findOne({ number, deletedAt: null })
      .select('assigneeId')
      .lean()
    if (!before) continue
    if (String(before.assigneeId ?? '') === (assigneeId ?? '')) continue
    await updateTicketFields(number, { assigneeId }, actorId)
    changed += 1
  }
  return changed
}

const DAY_MS = 24 * 60 * 60 * 1000
const WAITING_DAYS = 3

/**
 * The KPIs on the Admin/Manager dashboard. All plain numbers computed from the tickets themselves:
 * this week against last week, how long finishing takes, how many open tickets have someone, how
 * many are urgent, and how many have been waiting a long time.
 */
export async function getDashboardKpis(scope?: TicketScope) {
  await dbConnect()

  const now = Date.now()
  const weekAgo = new Date(now - 7 * DAY_MS)
  const twoWeeksAgo = new Date(now - 14 * DAY_MS)
  const monthAgo = new Date(now - 30 * DAY_MS)
  const waitingBefore = new Date(now - WAITING_DAYS * DAY_MS)

  const [resolvedStatuses, urgentPriorities] = await Promise.all([
    TicketStatusModel.find({ isResolved: true }).select('_id').lean(),
    TicketPriorityModel.find({ slug: { $in: ['critical', 'high'] } })
      .select('_id')
      .lean(),
  ])
  const resolvedIds = resolvedStatuses.map((s) => s._id)
  const urgentIds = urgentPriorities.map((p) => p._id)

  const base: QueryFilter<Ticket> = { deletedAt: null, ...scopeFilter(scope) }
  const open: QueryFilter<Ticket> = { ...base, statusId: { $nin: resolvedIds } }

  // Per-day counts for the last 14 days (oldest first), bucketed by the server's local calendar
  // day so "today" is today's bar.
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const seriesStart = new Date(startOfToday.getTime() - 13 * DAY_MS)
  const tzOffsetMin = -new Date().getTimezoneOffset()
  const tz = `${tzOffsetMin >= 0 ? '+' : '-'}${String(Math.floor(Math.abs(tzOffsetMin) / 60)).padStart(2, '0')}:${String(Math.abs(tzOffsetMin) % 60).padStart(2, '0')}`
  const isoDay = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const days = Array.from({ length: 14 }, (_, i) =>
    isoDay(new Date(seriesStart.getTime() + i * DAY_MS)),
  )
  const perDay = async (field: 'createdAt' | 'resolvedAt') => {
    const rows = await TicketModel.aggregate([
      { $match: { ...base, [field]: { $gte: seriesStart } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: `$${field}`, timezone: tz } },
          n: { $sum: 1 },
        },
      },
    ])
    const byDay = new Map<string, number>(rows.map((r) => [r._id as string, r.n as number]))
    return days.map((d) => byDay.get(d) ?? 0)
  }

  const [
    finishedThisWeek,
    finishedLastWeek,
    newThisWeek,
    newLastWeek,
    openTotal,
    openAssigned,
    urgentOpen,
    waitingLong,
    finishTime,
    dailyFinished,
    dailyNew,
    ageToday,
    age1to3,
    age3to7,
    ageOlder,
    doneTotal,
    allTotal,
  ] = await Promise.all([
    TicketModel.countDocuments({ ...base, resolvedAt: { $gte: weekAgo } }),
    TicketModel.countDocuments({ ...base, resolvedAt: { $gte: twoWeeksAgo, $lt: weekAgo } }),
    TicketModel.countDocuments({ ...base, createdAt: { $gte: weekAgo } }),
    TicketModel.countDocuments({ ...base, createdAt: { $gte: twoWeeksAgo, $lt: weekAgo } }),
    TicketModel.countDocuments(open),
    TicketModel.countDocuments({ ...open, assigneeId: { $ne: null } }),
    TicketModel.countDocuments({ ...open, priorityId: { $in: urgentIds } }),
    TicketModel.countDocuments({ ...open, createdAt: { $lt: waitingBefore } }),
    TicketModel.aggregate([
      { $match: { ...base, resolvedAt: { $gte: monthAgo } } },
      {
        $group: {
          _id: null,
          avgMs: { $avg: { $subtract: ['$resolvedAt', '$createdAt'] } },
          count: { $sum: 1 },
        },
      },
    ]),
    perDay('resolvedAt'),
    perDay('createdAt'),
    // Age of the open tickets, in four groups: under a day, 1-3 days, 3-7 days, over a week.
    TicketModel.countDocuments({ ...open, createdAt: { $gte: new Date(now - DAY_MS) } }),
    TicketModel.countDocuments({
      ...open,
      createdAt: { $gte: new Date(now - WAITING_DAYS * DAY_MS), $lt: new Date(now - DAY_MS) },
    }),
    TicketModel.countDocuments({
      ...open,
      createdAt: { $gte: new Date(now - 7 * DAY_MS), $lt: new Date(now - WAITING_DAYS * DAY_MS) },
    }),
    TicketModel.countDocuments({ ...open, createdAt: { $lt: new Date(now - 7 * DAY_MS) } }),
    TicketModel.countDocuments({ ...base, statusId: { $in: resolvedIds } }),
    TicketModel.countDocuments(base),
  ])

  return {
    finishedThisWeek,
    finishedLastWeek,
    newThisWeek,
    newLastWeek,
    openTotal,
    openAssigned,
    urgentOpen,
    waitingLong,
    waitingDays: WAITING_DAYS,
    /** Average time from created to finished over the last 30 days, in hours (null if none). */
    avgFinishHours: finishTime[0]?.avgMs != null ? finishTime[0].avgMs / 3_600_000 : null,
    finishedLastMonth: (finishTime[0]?.count as number | undefined) ?? 0,
    /** Last 14 days, oldest first — the last 7 entries are "this week". */
    dailyFinished,
    dailyNew,
    /** Open tickets by how long they have been open. */
    ages: { today: ageToday, oneToThree: age1to3, threeToSeven: age3to7, older: ageOlder },
    doneTotal,
    allTotal,
  }
}

/**
 * Sets whether a finished ticket's cleanup has been checked. `source` says who decided: 'manual'
 * (a lead, for now) or 'drone' (the re-flight, once that is connected). Only finished tickets can
 * be verified. The change is written on the ticket's history.
 */
export async function setTicketVerification(
  number: number,
  verified: boolean,
  actorId: string,
  source: 'manual' | 'drone' = 'manual',
) {
  await dbConnect()
  const ticket = await TicketModel.findOne({ number, deletedAt: null })
  if (!ticket) throw new Error('Ticket not found')
  const status = ticket.statusId ? await TicketStatusModel.findById(ticket.statusId).lean() : null
  if (!status?.isResolved) throw new Error('Only a finished ticket can be verified.')

  const was = (ticket.get('verification.status') as string | undefined) ?? 'not_verified'
  const to = verified ? 'verified' : 'not_verified'
  if (was === to) return ticket

  ticket.set(
    'verification',
    verified
      ? { status: 'verified', verifiedAt: new Date(), verifiedBy: actorId, source }
      : { status: 'not_verified' },
  )
  ticket.lastActivityAt = new Date()
  await ticket.save()
  await TicketEventModel.create({
    ticketId: ticket._id,
    actorId,
    action: verified ? 'verified' : 'unverified',
  })
  return ticket
}

/**
 * The result of flying over a finished ticket's place again (DroneSeva). A clean new photo marks
 * the cleanup as verified (source 'drone'); a photo that still shows garbage reopens the ticket:
 * it goes to the "Reopened" status, so it is unfinished again and back on the Surveyor's list.
 * Only finished tickets can be re-checked.
 */
export async function applyDroneRecheck(
  number: number,
  outcome: { clean: boolean; detections: number; coveragePercent: number; note?: string },
  actorId: string,
) {
  await dbConnect()
  const ticket = await TicketModel.findOne({ number, deletedAt: null })
  if (!ticket) throw new Error('Ticket not found')
  const status = ticket.statusId ? await TicketStatusModel.findById(ticket.statusId).lean() : null
  if (!status?.isResolved) throw new Error('Only a finished ticket can be re-checked.')

  if (outcome.clean) {
    await setTicketVerification(number, true, actorId, 'drone')
    return { result: 'verified' as const, ticket }
  }

  const reopened = await TicketStatusModel.findOneAndUpdate(
    { slug: REOPENED_STATUS.slug },
    { $setOnInsert: REOPENED_STATUS },
    { upsert: true, returnDocument: 'after' },
  )
  const from = String(ticket.statusId)
  archiveResolution(ticket)
  ticket.set('statusId', reopened._id)
  ticket.set('resolvedAt', null)
  ticket.set('closedAt', null)
  ticket.set('verification', { status: 'not_verified' })
  ticket.lastActivityAt = new Date()
  await ticket.save()
  await TicketEventModel.insertMany([
    {
      ticketId: ticket._id,
      actorId,
      action: 'field_changed',
      field: 'statusId',
      from,
      to: String(reopened._id),
    },
    {
      ticketId: ticket._id,
      actorId,
      action: 'reopened',
      meta: {
        source: 'drone',
        detections: outcome.detections,
        coveragePercent: outcome.coveragePercent,
        note: outcome.note ?? null,
      },
    },
  ])
  return { result: 'reopened' as const, ticket }
}

/**
 * Stores the photo of a drone re-check on the ticket (replacing the last one). Returns the public id
 * of the replaced photo ('' if there was none) so it can be deleted, or undefined if no such ticket.
 */
export async function setRecheckPhoto(
  number: number,
  photo: {
    url: string
    publicId: string
    width: number
    height: number
    result: 'clean' | 'dirty'
    detections: number
    coveragePercent: number
  },
) {
  await dbConnect()
  const before = await TicketModel.findOneAndUpdate(
    { number, deletedAt: null },
    { $set: { recheckPhoto: { ...photo, takenAt: new Date() } } },
    { returnDocument: 'before' },
  )
    .select('recheckPhoto')
    .lean()
  if (!before) return undefined
  return (before.recheckPhoto as { publicId?: string } | null)?.publicId ?? ''
}

/** Stores (or replaces) the detection report PDF on a ticket. */
export async function setReportPdf(
  number: number,
  report: { url: string; publicId: string; name: string; bytes: number },
) {
  await dbConnect()
  // The previous report, if any, is returned so its file can be cleaned up.
  const previous = await TicketModel.findOne({ number, deletedAt: null }).select('reportPdf').lean()
  if (!previous) return null
  const result = await TicketModel.updateOne(
    { _id: previous._id },
    { $set: { reportPdf: { ...report, uploadedAt: new Date() } } },
  )
  // Never report success for a save that changed nothing (e.g. a model that predates the field).
  if (result.modifiedCount === 0) throw new Error('The report was not saved on the ticket')
  return previous
}

/** Attaches a photo that arrived with the ticket (e.g. the DroneSeva drone image). */
export async function addSourcePhoto(
  number: number,
  photo: { url: string; publicId: string; width: number; height: number },
) {
  await dbConnect()
  return TicketModel.findOneAndUpdate(
    { number, deletedAt: null },
    {
      $push: { sourcePhotos: { ...photo, uploadedAt: new Date() } },
      $inc: { 'counts.attachments': 1 },
    },
    { returnDocument: 'after' },
  )
}
