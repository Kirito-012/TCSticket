'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAbility } from '@/server/auth/session'
import { sanitizeHtml } from '@/lib/sanitize-html'
import { createTicketSchema, updateTicketSchema, addCommentSchema } from '@/lib/schemas/ticket'
import * as ticketService from '@/server/services/ticket.service'

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
  const { user, ability } = await requireAbility()

  const parsed = updateTicketSchema.safeParse(patch)
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid input')

  const requiredAction = 'assigneeId' in parsed.data ? 'assign' : 'update'
  if (!ability.can(requiredAction, 'ticket')) {
    throw new Error('You do not have permission to do that.')
  }

  await ticketService.updateTicketFields(number, parsed.data, user.id)

  revalidatePath(`/tickets/${number}`)
  revalidatePath('/tickets')
}

export async function addCommentAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const number = Number(formData.get('ticketNumber'))
  const isInternal = formData.get('isInternal') === 'true'

  const { user } = await requireAbility({
    action: 'create',
    subject: isInternal ? 'note' : 'comment',
  })

  const parsed = addCommentSchema.safeParse({
    body: formData.get('body'),
    isInternal,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  await ticketService.addComment({
    ticketNumber: number,
    authorId: user.id,
    body: sanitizeHtml(parsed.data.body),
    isInternal: parsed.data.isInternal,
  })

  revalidatePath(`/tickets/${number}`)
}

export async function deleteTicketAction(number: number) {
  const { user } = await requireAbility({ action: 'delete', subject: 'ticket' })
  await ticketService.softDeleteTicket(number, user.id)
  revalidatePath('/tickets')
  redirect('/tickets')
}
