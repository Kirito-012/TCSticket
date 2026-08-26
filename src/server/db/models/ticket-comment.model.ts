import { Schema, model, models, type InferSchemaType } from 'mongoose'

const ticketCommentSchema = new Schema(
  {
    ticketId: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true }, // sanitized HTML
    isInternal: { type: Boolean, default: false },
    // Images uploaded to Cloudinary alongside this comment. publicId is kept so the file can be
    // removed from Cloudinary if the comment is ever deleted.
    attachments: {
      type: [
        {
          url: { type: String, required: true },
          publicId: { type: String, required: true },
          width: { type: Number, required: true },
          height: { type: Number, required: true },
        },
      ],
      default: [],
    },
    editedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

ticketCommentSchema.index({ ticketId: 1, createdAt: 1 })

export type TicketComment = InferSchemaType<typeof ticketCommentSchema>
export const TicketCommentModel =
  models.TicketComment ?? model('TicketComment', ticketCommentSchema)
