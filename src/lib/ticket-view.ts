import { extractDroneSevaLink, extractLocation } from '@/lib/droneseva-link'

export type PersonView = { id: string; name: string; initials: string } | null

export type TicketListItemView = {
  id: string
  number: number
  subject: string
  preview: string
  priority: { name: string; slug: string; color: string } | null
  status: { name: string; slug: string; color: string; isResolved: boolean } | null
  statusId: string | null
  type: { name: string; slug: string } | null
  assignee: PersonView
  owner: PersonView
  sectorKey: string | null
  tags: { id: string; name: string; color: string }[]
  /** When the ticket arrived. */
  createdAt: string
  /** Small picture of the first photo the ticket arrived with, if any. */
  thumbUrl: string | null
  updatedAt: string
  comments: number
}

function stripHtml(html: string) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function toPerson(doc: unknown): PersonView {
  if (!doc || typeof doc !== 'object') return null
  const d = doc as { _id?: unknown; fullname?: string; email?: string }
  if (!d._id) return null
  const name = d.fullname || d.email || 'Unknown'
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p: string) => p[0]?.toUpperCase())
    .join('')
  return { id: String(d._id), name, initials }
}

export type TicketDetailView = {
  id: string
  number: number
  subject: string
  issueHtml: string
  droneSevaUrl: string | null
  location: { latitude: number; longitude: number } | null
  priorityId: string | null
  statusId: string | null
  typeId: string | null
  assigneeId: string | null
  assignee: PersonView
  owner: PersonView
  tags: { id: string; name: string; color: string }[]
  dueDate: string | null
  createdAt: string
  resolvedAt: string | null
  resolutionPhotos: CommentAttachmentView[]
  resolutionNote: string
  /** Photos the ticket arrived with, e.g. the drone image from DroneSeva. */
  sourcePhotos: CommentAttachmentView[]
  /** The detection report PDF, if one was attached (opened through /api/tickets/:n/report). */
  report: { name: string; bytes: number; uploadedAt: string | null } | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toTicketDetailView(t: any): TicketDetailView {
  const rawIssue = t.issue ?? ''
  const { html: issueHtml, droneSevaUrl } = extractDroneSevaLink(rawIssue)
  return {
    id: String(t._id),
    number: t.number,
    subject: t.subject,
    issueHtml,
    droneSevaUrl,
    location: extractLocation(rawIssue),
    priorityId: t.priorityId ? String(t.priorityId._id) : null,
    statusId: t.statusId ? String(t.statusId._id) : null,
    typeId: t.typeId ? String(t.typeId._id) : null,
    assigneeId: t.assigneeId ? String(t.assigneeId._id) : null,
    assignee: toPerson(t.assigneeId),
    owner: toPerson(t.ownerId),
    tags: (t.tagIds ?? []).map((tag: { _id: unknown; name: string; color: string }) => ({
      id: String(tag._id),
      name: tag.name,
      color: tag.color,
    })),
    dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : null,
    createdAt: new Date(t.createdAt).toISOString(),
    resolvedAt: t.resolvedAt ? new Date(t.resolvedAt).toISOString() : null,
    resolutionNote: t.resolutionNote ?? '',
    report: t.reportPdf?.publicId
      ? {
          name: t.reportPdf.name || 'Detection report.pdf',
          bytes: t.reportPdf.bytes ?? 0,
          uploadedAt: t.reportPdf.uploadedAt
            ? new Date(t.reportPdf.uploadedAt).toISOString()
            : null,
        }
      : null,
    sourcePhotos: (t.sourcePhotos ?? []).map(
      (a: CommentAttachmentView & { uploadedAt?: Date | string }) => ({
        url: a.url,
        publicId: a.publicId,
        width: a.width,
        height: a.height,
        // Older photos were not stamped; they arrived with the ticket.
        uploadedAt: new Date(a.uploadedAt ?? t.createdAt).toISOString(),
      }),
    ),
    resolutionPhotos: (t.resolutionPhotos ?? []).map(
      (a: CommentAttachmentView & { uploadedAt?: Date | string }) => ({
        url: a.url,
        publicId: a.publicId,
        width: a.width,
        height: a.height,
        uploadedAt: a.uploadedAt ? new Date(a.uploadedAt).toISOString() : null,
      }),
    ),
  }
}

export type CommentAttachmentView = {
  url: string
  publicId: string
  width: number
  height: number
  /** When the photo was uploaded (ISO). Only set for ticket photos. */
  uploadedAt?: string | null
}

export type CommentView = {
  id: string
  bodyHtml: string
  isInternal: boolean
  author: PersonView
  attachments: CommentAttachmentView[]
  createdAt: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toCommentView(c: any): CommentView {
  return {
    id: String(c._id),
    bodyHtml: c.body,
    isInternal: c.isInternal,
    author: toPerson(c.authorId),
    attachments: (c.attachments ?? []).map((a: CommentAttachmentView) => ({
      url: a.url,
      publicId: a.publicId,
      width: a.width,
      height: a.height,
    })),
    createdAt: new Date(c.createdAt).toISOString(),
  }
}

export type EventView = {
  id: string
  action: string
  field: string | null
  from: string | null
  to: string | null
  actor: PersonView
  createdAt: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toEventView(e: any): EventView {
  return {
    id: String(e._id),
    action: e.action,
    field: e.field ?? null,
    from: e.from ?? null,
    to: e.to ?? null,
    actor: toPerson(e.actorId),
    createdAt: new Date(e.createdAt).toISOString(),
  }
}

/** A square 160px crop of a Cloudinary picture (other hosts are returned unchanged). */
function cloudinaryThumb(url: string) {
  return url.includes('/upload/')
    ? url.replace('/upload/', '/upload/c_fill,w_160,h_160,q_auto/')
    : url
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toTicketListItem(t: any): TicketListItemView {
  return {
    id: String(t._id),
    number: t.number,
    subject: t.subject,
    preview: stripHtml(t.issue ?? '').slice(0, 140),
    priority: t.priorityId
      ? { name: t.priorityId.name, slug: t.priorityId.slug, color: t.priorityId.color }
      : null,
    status: t.statusId
      ? {
          name: t.statusId.name,
          slug: t.statusId.slug,
          color: t.statusId.color,
          isResolved: !!t.statusId.isResolved,
        }
      : null,
    statusId: t.statusId ? String(t.statusId._id) : null,
    type: t.typeId ? { name: t.typeId.name, slug: t.typeId.slug } : null,
    assignee: toPerson(t.assigneeId),
    owner: toPerson(t.ownerId),
    sectorKey: t.sectorKey ?? null,
    tags: (t.tagIds ?? []).map((tag: { _id: unknown; name: string; color: string }) => ({
      id: String(tag._id),
      name: tag.name,
      color: tag.color,
    })),
    createdAt: new Date(t.createdAt).toISOString(),
    thumbUrl: t.sourcePhotos?.[0]?.url ? cloudinaryThumb(t.sourcePhotos[0].url) : null,
    updatedAt: new Date(t.lastActivityAt).toISOString(),
    comments: t.counts?.comments ?? 0,
  }
}
