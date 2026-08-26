'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAbility, requireTicketScope } from '@/server/auth/session'
import { sanitizeHtml } from '@/lib/sanitize-html'
import { createTicketSchema, updateTicketSchema, addCommentSchema } from '@/lib/schemas/ticket'
import * as ticketService from '@/server/services/ticket.service'
import { uploadCommentImage, deleteCommentImage } from '@/server/cloudinary'

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])

export type ActionState = { error?: string } | undefined

export async function createTicketAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user } = await requireAbility({ action: 'create', subject: 'ticket' })

  const parsed = createTicketSchema.safeParse({
    subject: formData.get('subject'),
    issue: formData.get('issue'),
    typeId: formData.get('typeId'),
    priorityId: formData.get('priorityId'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const ticket = await ticketService.createTicket({
    ...parsed.data,
    issue: sanitizeHtml(parsed.data.issue),
    ownerId: user.id,
  })

  revalidatePath('/tickets')
  redirect(`/tickets/${ticket.number}`)
}

export async function updateTicketFieldAction(
  number: number,
  patch: Record<string, string | null>,
) {
  const { user, ability, forcedAssigneeId } = await requireTicketScope()

  const parsed = updateTicketSchema.safeParse(patch)
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid input')

  const requiredAction = 'assigneeId' in parsed.data ? 'assign' : 'update'
  if (!ability.can(requiredAction, 'ticket')) {
    throw new Error('You do not have permission to do that.')
  }

  // Agent-scoped: block updates to tickets not assigned to them, even via a direct action call
  // that bypasses the page's own visibility check (see tickets/[number]/page.tsx).
  if (forcedAssigneeId) {
    const ticket = await ticketService.getTicketByNumber(number)
    const assignee = (ticket as { assigneeId?: { _id?: unknown } | null } | null)?.assigneeId
    if (String(assignee?._id ?? '') !== forcedAssigneeId) {
      throw new Error('You do not have permission to do that.')
    }
  }

  await ticketService.updateTicketFields(number, parsed.data, user.id)

  revalidatePath(`/tickets/${number}`)
  revalidatePath('/tickets')
}

export type UploadState = { error?: string; image?: UploadedImageResult } | undefined
type UploadedImageResult = { url: string; publicId: string; width: number; height: number }

/** Uploads a single image to Cloudinary for the comment composer's preview-before-post flow. */
export async function uploadCommentImageAction(
  _prevState: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const { ability } = await requireAbility()
  if (!ability.can('create', 'attachment')) {
    return { error: 'You do not have permission to upload attachments.' }
  }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'No file provided' }
  }
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return { error: 'Only PNG, JPEG, WEBP, and GIF images are allowed' }
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { error: 'Image must be under 8MB' }
  }

  try {
    const image = await uploadCommentImage(file)
    return { image }
  } catch {
    return { error: 'Upload failed. Please try again.' }
  }
}

export async function addCommentAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const number = Number(formData.get('ticketNumber'))
  const isInternal = formData.get('isInternal') === 'true'

  const { user, ability, forcedAssigneeId } = await requireTicketScope()
  if (!ability.can('create', isInternal ? 'note' : 'comment')) {
    return { error: 'You do not have permission to do that.' }
  }

  if (forcedAssigneeId) {
    const ticket = await ticketService.getTicketByNumber(number)
    const assignee = (ticket as { assigneeId?: { _id?: unknown } | null } | null)?.assigneeId
    if (String(assignee?._id ?? '') !== forcedAssigneeId) {
      return { error: 'You do not have permission to do that.' }
    }
  }

  let attachments: UploadedImageResult[] = []
  const attachmentsRaw = formData.get('attachments')
  if (typeof attachmentsRaw === 'string' && attachmentsRaw.length > 0) {
    try {
      attachments = JSON.parse(attachmentsRaw)
    } catch {
      return { error: 'Invalid attachments' }
    }
  }

  const parsed = addCommentSchema.safeParse({
    body: formData.get('body'),
    isInternal,
    attachments,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  await ticketService.addComment({
    ticketNumber: number,
    authorId: user.id,
    body: sanitizeHtml(parsed.data.body),
    isInternal: parsed.data.isInternal,
    attachments: parsed.data.attachments,
  })

  revalidatePath(`/tickets/${number}`)
}

export async function deleteTicketAction(number: number) {
  const { user } = await requireAbility({ action: 'delete', subject: 'ticket' })
  await ticketService.softDeleteTicket(number, user.id)
  revalidatePath('/tickets')
  redirect('/tickets')
}

export async function deleteCommentAction(ticketNumber: number, commentId: string) {
  const { user } = await requireAbility({ action: 'delete', subject: 'comment' })

  const comment = await ticketService.softDeleteComment(commentId, user.id)
  if (!comment) return

  for (const attachment of comment.attachments ?? []) {
    await deleteCommentImage(attachment.publicId).catch(() => {})
  }

  revalidatePath(`/tickets/${ticketNumber}`)
}
