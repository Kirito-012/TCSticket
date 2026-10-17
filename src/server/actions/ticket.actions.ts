'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAbility, requireTicketScope } from '@/server/auth/session'
import { sanitizeHtml } from '@/lib/sanitize-html'
import { createTicketSchema, updateTicketSchema, addCommentSchema } from '@/lib/schemas/ticket'
import * as ticketService from '@/server/services/ticket.service'
import * as userService from '@/server/services/user.service'
import { scopeAllows, scopeAllowsAssignee, type TicketScope } from '@/lib/ticket-scope'
import { uploadCommentImage, deleteCommentImage } from '@/server/cloudinary'
import { logger } from '@/lib/logger'
import { evaluateLocation, verdictMessage, type LocationFix } from '@/lib/geo'
import { resolveRules } from '@/server/resolve-rules'
import { garbageVerdict } from '@/lib/garbage-check'
import { checkPhotoForGarbage, photoRules } from '@/server/photo-check'
import type {
  ResolutionPhotoGarbageCheck,
  ResolutionPhotoLocation,
} from '@/server/services/ticket.service'

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

/** Whether a ticket (as loaded with its assignee) is one this person's scope allows them to touch. */
function ticketInScope(scope: TicketScope, ticket: unknown): boolean {
  const t = ticket as { sectorKey?: string | null; assigneeId?: { _id?: unknown } | null } | null
  if (!t) return false
  return scopeAllows(scope, {
    sectorKey: t.sectorKey ?? null,
    assigneeId: t.assigneeId?._id ? String(t.assigneeId._id) : null,
  })
}

export async function updateTicketFieldAction(
  number: number,
  patch: Record<string, string | null>,
) {
  const { user, ability, scope, forcedAssigneeId } = await requireTicketScope()

  const parsed = updateTicketSchema.safeParse(patch)
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid input')

  const requiredAction = 'assigneeId' in parsed.data ? 'assign' : 'update'
  if (!ability.can(requiredAction, 'ticket')) {
    throw new Error('You do not have permission to do that.')
  }

  // Block updates to tickets outside the caller's scope (their own, their sector, their zone), even
  // via a direct action call that bypasses the page's own visibility check
  // (see tickets/[number]/page.tsx).
  if (scope.kind !== 'all') {
    const ticket = await ticketService.getTicketByNumber(number)
    if (!ticketInScope(scope, ticket)) throw new Error('You do not have permission to do that.')
  }

  // A ticket may only be handed to someone inside the caller's sector / zone.
  if ('assigneeId' in parsed.data && parsed.data.assigneeId && scope.kind !== 'all') {
    const placement = await userService.getUserPlacement(parsed.data.assigneeId)
    if (!placement || !scopeAllowsAssignee(scope, placement)) {
      throw new Error('You can only give a ticket to someone in your own area.')
    }
  }

  // Surveyors must resolve through resolveTicketAction, which enforces the photo requirement.
  if (forcedAssigneeId && parsed.data.statusId) {
    const resolvedId = await ticketService.getResolvedStatusId()
    if (parsed.data.statusId === resolvedId) {
      throw new Error('Use "Mark as resolved" and upload a photo first.')
    }
  }

  await ticketService.updateTicketFields(number, parsed.data, user.id)

  revalidatePath(`/tickets/${number}`)
  revalidatePath('/tickets')
}

/** Shared guard for the surveyor actions: caller may update tickets, and a surveyor (agent scope)
 *  may only touch tickets assigned to them. Returns an error message, or null when allowed. */
async function checkSurveyorAccess(number: number) {
  const { user, ability, scope } = await requireTicketScope()
  if (!ability.can('update', 'ticket') || !ability.can('create', 'attachment')) {
    return { user, error: 'You do not have permission to do that.' }
  }
  const ticket = await ticketService.getTicketByNumber(number)
  if (!ticket) return { user, error: 'Ticket not found.' }
  if (!ticketInScope(scope, ticket)) {
    return { user, error: 'You do not have permission to do that.' }
  }
  return { user, error: null }
}

export type ResolutionPhotoState =
  | {
      error?: string
      ok?: boolean
      photo?: UploadedImageResult & {
        locationCheck?: ResolutionLocationCheck
        garbageCheck?: { status: 'ok' | 'unavailable'; coveragePercent: number | null }
      }
      /** True when the photo was refused because the inspector is not at the ticket's spot. */
      tooFar?: boolean
      distanceMeters?: number
      /** True when the photo was refused because it still shows too much garbage. */
      tooMuchGarbage?: boolean
      garbagePercent?: number
      /** Where the model saw garbage in the refused photo ([left, top, right, bottom], 0..1). */
      garbageBoxes?: [number, number, number, number][]
    }
  | undefined

type ResolutionLocationCheck = {
  withinRadius: boolean | null
  distanceMeters: number | null
  method: 'camera' | 'gallery'
}

/** Reads the phone's location reading that the browser sends along with a photo. */
function readFix(formData: FormData): Partial<LocationFix> {
  const num = (key: string) => {
    const raw = formData.get(key)
    return typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : undefined
  }
  return {
    latitude: num('latitude'),
    longitude: num('longitude'),
    accuracy: num('accuracy'),
    capturedAt: num('capturedAt'),
  }
}

/** Uploads one proof-of-cleanup photo to Cloudinary and attaches it to the ticket. */
export async function uploadResolutionPhotoAction(
  number: number,
  formData: FormData,
): Promise<ResolutionPhotoState> {
  const { user, error } = await checkSurveyorAccess(number)
  if (error) return { error }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return { error: 'No file provided' }
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return { error: 'Only PNG, JPEG, WEBP, and GIF images are allowed' }
  }
  if (file.size > MAX_IMAGE_BYTES) return { error: 'Image must be under 8MB' }

  // Where was the inspector? When the ticket has a spot, the photo only counts if they were at it
  // — decided here, on the server, before anything is uploaded or saved.
  const method = formData.get('method') === 'camera' ? 'camera' : 'gallery'
  const fix = readFix(formData)
  const rules = resolveRules()
  const target = await ticketService.getTicketTarget(number)
  let location: ResolutionPhotoLocation | null = null
  if (target) {
    const verdict = evaluateLocation(target, fix, rules)
    if (!verdict.ok) {
      return {
        error: verdictMessage(verdict, rules),
        tooFar: verdict.reason === 'too-far',
        distanceMeters: verdict.distanceMeters,
      }
    }
    location = {
      latitude: fix.latitude!,
      longitude: fix.longitude!,
      accuracy: fix.accuracy!,
      distanceMeters: verdict.distanceMeters,
      withinRadius: true,
      method,
      capturedAt: new Date(fix.capturedAt!),
    }
  }

  // Does the photo still show garbage? Only photos that are mostly clean are accepted.
  let garbageCheck: ResolutionPhotoGarbageCheck | null = null
  const photoCheckRules = photoRules()
  if (photoCheckRules.enabled) {
    const checked = await checkPhotoForGarbage(file)
    if (checked.status === 'ok') {
      const verdict = garbageVerdict(
        checked.coveragePercent,
        photoCheckRules.maxGarbagePercent,
        checked.detections,
        photoCheckRules.maxItems,
      )
      if (!verdict.ok) {
        return {
          error: verdict.message,
          tooMuchGarbage: true,
          garbagePercent: checked.coveragePercent,
          garbageBoxes: checked.boxes,
        }
      }
      garbageCheck = {
        status: 'ok',
        coveragePercent: checked.coveragePercent,
        detections: checked.detections,
      }
    } else if (photoCheckRules.strict) {
      return { error: 'We could not check the photo right now. Please try again in a moment.' }
    } else {
      // The check service is down: accept the photo, but record that it was not checked.
      garbageCheck = { status: 'unavailable', coveragePercent: null, detections: null }
    }
  }

  let image: UploadedImageResult
  try {
    image = await uploadCommentImage(file, 'tcs-ticket/resolutions')
    await ticketService.addResolutionPhoto(number, image, user.id, location, garbageCheck)
  } catch (err) {
    logger.error({ err, number }, 'Could not upload or save a resolution photo')
    return { error: 'Upload failed. Please try again.' }
  }

  revalidatePath(`/tickets/${number}`)
  return {
    ok: true,
    photo: {
      ...image,
      locationCheck: location
        ? { withinRadius: true, distanceMeters: location.distanceMeters, method }
        : undefined,
      garbageCheck: garbageCheck
        ? { status: garbageCheck.status, coveragePercent: garbageCheck.coveragePercent }
        : undefined,
    },
  }
}

export async function removeResolutionPhotoAction(
  number: number,
  publicId: string,
): Promise<ResolutionPhotoState> {
  const { user, error } = await checkSurveyorAccess(number)
  if (error) return { error }

  const removed = await ticketService.removeResolutionPhoto(number, publicId, user.id)
  if (removed) await deleteCommentImage(removed.publicId).catch(() => {})

  revalidatePath(`/tickets/${number}`)
  return { ok: true }
}

const MAX_NOTE_LENGTH = 1000

export async function resolveTicketAction(
  number: number,
  note?: string,
): Promise<ResolutionPhotoState> {
  const { user, error } = await checkSurveyorAccess(number)
  if (error) return { error }

  const cleanNote = (note ?? '').trim()
  if (cleanNote.length > MAX_NOTE_LENGTH) {
    return { error: `Note must be at most ${MAX_NOTE_LENGTH} characters.` }
  }

  try {
    await ticketService.resolveTicketWithProof(number, user.id, cleanNote)
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not resolve the ticket.' }
  }

  revalidatePath(`/tickets/${number}`)
  revalidatePath('/tickets')
  revalidatePath('/dashboard')
  return { ok: true }
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
  } catch (err) {
    logger.error({ err }, 'Could not upload a comment image')
    return { error: 'Upload failed. Please try again.' }
  }
}

export async function addCommentAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const number = Number(formData.get('ticketNumber'))
  const isInternal = formData.get('isInternal') === 'true'

  const { user, ability, scope } = await requireTicketScope()
  if (!ability.can('create', isInternal ? 'note' : 'comment')) {
    return { error: 'You do not have permission to do that.' }
  }

  if (scope.kind !== 'all') {
    const ticket = await ticketService.getTicketByNumber(number)
    if (!ticketInScope(scope, ticket)) return { error: 'You do not have permission to do that.' }
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

const MAX_BULK = 100

export type BulkAssignResult = { error?: string; changed?: number }

/** Assigns up to 100 tickets to one person (or nobody) in a single step. */
export async function bulkAssignTicketsAction(
  numbers: number[],
  assigneeId: string | null,
): Promise<BulkAssignResult> {
  const { user, ability } = await requireTicketScope()
  if (!ability.can('assign', 'ticket')) return { error: 'You do not have permission to do that.' }

  if (!Array.isArray(numbers) || numbers.length === 0)
    return { error: 'Choose some tickets first.' }
  if (numbers.length > MAX_BULK)
    return { error: `Please choose at most ${MAX_BULK} tickets at a time.` }
  if (!numbers.every((n) => Number.isInteger(n) && n > 0)) return { error: 'Invalid tickets.' }
  if (assigneeId !== null && !/^[0-9a-fA-F]{24}$/.test(assigneeId))
    return { error: 'Invalid person.' }

  const changed = await ticketService.bulkAssignTickets(numbers, assigneeId, user.id)

  revalidatePath('/tickets')
  revalidatePath('/dashboard')
  return { changed }
}
