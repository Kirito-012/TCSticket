import 'server-only'

import { QueryFilter } from 'mongoose'
import { dbConnect } from '@/server/db/connect'
import { TicketModel, type Ticket } from '@/server/db/models/ticket.model'
import { TicketCommentModel } from '@/server/db/models/ticket-comment.model'
import { TicketEventModel } from '@/server/db/models/ticket-event.model'
import { TicketStatusModel } from '@/server/db/models/ticket-status.model'
import { TicketPriorityModel } from '@/server/db/models/ticket-priority.model'
import { TicketTypeModel } from '@/server/db/models/ticket-type.model'
import { TagModel } from '@/server/db/models/tag.model'
import { nextSequence } from '@/server/db/models/counter.model'

const POPULATE = [
  { path: 'ownerId', select: 'fullname email avatarUrl' },
  { path: 'assigneeId', select: 'fullname email avatarUrl' },
  { path: 'typeId', select: 'name slug' },
  { path: 'statusId', select: 'name slug color isResolved' },
  { path: 'priorityId', select: 'name slug color' },
  { path: 'tagIds', select: 'name slug color' },
]

export type ListTicketsParams = {
  status?: string
  priority?: string
  type?: string
  assigneeId?: string
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
  if (params.q) filter.$text = { $search: params.q }

  if (params.from || params.to) {
    filter.createdAt = {}
    if (params.from) filter.createdAt.$gte = new Date(params.from)
    if (params.to) filter.createdAt.$lte = new Date(params.to)
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

/** Counts of non-deleted tickets per status, keyed by status slug, plus a grand total. */
export async function countTicketsByStatus() {
  await dbConnect()

  const statuses = await TicketStatusModel.find().sort({ order: 1 }).lean()
  const counts = await TicketModel.aggregate([
    { $match: { deletedAt: null } },
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
  tagIds?: string[]
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
    typeId: input.typeId,
    priorityId: input.priorityId,
    statusId: status._id,
    tagIds: input.tagIds ?? [],
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
}) {
  await dbConnect()

  const ticket = await TicketModel.findOne({ number: input.ticketNumber, deletedAt: null })
  if (!ticket) throw new Error('Ticket not found')

  const comment = await TicketCommentModel.create({
    ticketId: ticket._id,
    authorId: input.authorId,
    body: input.body,
    isInternal: input.isInternal,
  })

  ticket.counts.comments += 1
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

export async function listEvents(ticketId: string) {
  await dbConnect()
  return TicketEventModel.find({ ticketId })
    .sort({ createdAt: 1 })
    .populate({ path: 'actorId', select: 'fullname email avatarUrl' })
    .lean()
}
