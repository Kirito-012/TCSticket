import { z } from 'zod'

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id')

export const createTicketSchema = z.object({
  subject: z.string().trim().min(3, 'Subject must be at least 3 characters').max(200),
  issue: z.string().trim().min(1, 'Description is required'),
  typeId: objectId,
  priorityId: objectId,
  tagIds: z.array(objectId).optional(),
})

export type CreateTicketInput = z.infer<typeof createTicketSchema>

/** Photos added to a new ticket. They must already be on our image host (uploaded by the form). */
export const MAX_TICKET_PHOTOS = 6
export const ticketPhotosSchema = z
  .array(
    z.object({
      url: z
        .string()
        .url()
        .refine(
          (u) => /^https:\/\/res\.cloudinary\.com\//.test(u),
          'Photo is not from our image host',
        ),
      publicId: z.string().min(1).max(300),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    }),
  )
  .max(MAX_TICKET_PHOTOS, `At most ${MAX_TICKET_PHOTOS} photos`)

export const updateTicketSchema = z.object({
  subject: z.string().trim().min(3).max(200).optional(),
  statusId: objectId.optional(),
  assigneeId: z.union([objectId, z.null()]).optional(),
  priorityId: objectId.optional(),
  typeId: objectId.optional(),
  dueDate: z.union([z.string(), z.null()]).optional(),
})

export type UpdateTicketInput = z.infer<typeof updateTicketSchema>

const commentAttachment = z.object({
  url: z.string().url(),
  publicId: z.string().min(1),
  width: z.number(),
  height: z.number(),
})

export const addCommentSchema = z
  .object({
    body: z.string().trim(),
    isInternal: z.boolean().default(false),
    attachments: z.array(commentAttachment).max(6, 'At most 6 images per comment').default([]),
  })
  .refine((data) => data.body.length > 0 || data.attachments.length > 0, {
    message: 'Add some text or at least one image',
    path: ['body'],
  })

export type AddCommentInput = z.infer<typeof addCommentSchema>
