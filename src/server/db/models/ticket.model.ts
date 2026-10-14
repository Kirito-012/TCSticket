import { Schema, model, models, type InferSchemaType } from 'mongoose'

const ticketSchema = new Schema(
  {
    number: { type: Number, required: true, unique: true },
    subject: { type: String, required: true },
    issue: { type: String, required: true }, // sanitized HTML

    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // Customer bucket — optional until Phase 3 builds real Groups.
    groupId: { type: Schema.Types.ObjectId, ref: 'Group', default: null },
    assigneeId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    sectorKey: { type: String, default: null },
    location: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
    },
    typeId: { type: Schema.Types.ObjectId, ref: 'TicketType', required: true },
    statusId: { type: Schema.Types.ObjectId, ref: 'TicketStatus', required: true },
    priorityId: { type: Schema.Types.ObjectId, ref: 'TicketPriority', required: true },
    tagIds: { type: [Schema.Types.ObjectId], ref: 'Tag', default: [] },
    subscriberIds: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },

    dueDate: { type: Date, default: null },
    slaDueAt: { type: Date, default: null },
    firstResponseAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },

    source: { type: String, enum: ['web', 'email', 'api', 'public'], default: 'web' },

    // The photo(s) the ticket arrived with — for tickets from DroneSeva, the drone image that
    // the garbage was found in. Shown to whoever works the ticket.
    sourcePhotos: {
      type: [
        {
          url: { type: String, required: true },
          publicId: { type: String, required: true },
          width: { type: Number, required: true },
          height: { type: Number, required: true },
          // When the photo was attached. Photos added before this field existed have none; the
          // ticket page then falls back to the ticket's own creation time.
          uploadedAt: { type: Date, default: () => new Date() },
        },
      ],
      default: [],
    },

    // The PDF report from DroneSeva's garbage detection (annotated map and detection table), for
    // whoever works the ticket. Served through /api/tickets/:number/report, never by its raw URL.
    reportPdf: {
      type: new Schema(
        {
          url: { type: String, required: true },
          publicId: { type: String, required: true },
          name: { type: String, default: 'Detection report.pdf' },
          bytes: { type: Number, default: 0 },
          uploadedAt: { type: Date, default: () => new Date() },
        },
        { _id: false },
      ),
      default: null,
    },

    // Surveyor-uploaded proof of cleanup. At least one is required before a surveyor can resolve.
    resolutionPhotos: {
      type: [
        {
          url: { type: String, required: true },
          publicId: { type: String, required: true },
          width: { type: Number, required: true },
          height: { type: Number, required: true },
          uploadedById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
          uploadedAt: { type: Date, default: () => new Date() },
          // Where the inspector was when the photo was taken, as read from their phone. Photos from
          // before this check existed have none.
          location: {
            type: new Schema(
              {
                latitude: { type: Number, required: true },
                longitude: { type: Number, required: true },
                accuracy: { type: Number, default: null },
                // Metres from the ticket's spot; withinRadius is null when the ticket has no spot.
                distanceMeters: { type: Number, default: null },
                withinRadius: { type: Boolean, default: null },
                method: { type: String, enum: ['camera', 'gallery'], default: 'gallery' },
                capturedAt: { type: Date, default: null },
              },
              { _id: false },
            ),
            default: null,
          },
          // The detection model's look at the photo: what percent of it is garbage. Status is
          // "unavailable" when the service could not be reached and the photo was accepted unchecked.
          garbageCheck: {
            type: new Schema(
              {
                status: { type: String, enum: ['ok', 'unavailable'], required: true },
                coveragePercent: { type: Number, default: null },
                detections: { type: Number, default: null },
                checkedAt: { type: Date, default: () => new Date() },
              },
              { _id: false },
            ),
            default: null,
          },
        },
      ],
      default: [],
    },

    // Optional free-text note the surveyor writes when resolving (plain text, max 1000 chars).
    resolutionNote: { type: String, default: '' },

    counts: {
      comments: { type: Number, default: 0 },
      attachments: { type: Number, default: 0 },
    },

    lastActivityAt: { type: Date, default: () => new Date() },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

ticketSchema.index({ deletedAt: 1, statusId: 1, lastActivityAt: -1 })
ticketSchema.index({ deletedAt: 1, assigneeId: 1, statusId: 1 })
ticketSchema.index({ deletedAt: 1, groupId: 1, statusId: 1, createdAt: -1 })
ticketSchema.index({ deletedAt: 1, slaDueAt: 1 })
ticketSchema.index({ subject: 'text', issue: 'text' })

export type Ticket = InferSchemaType<typeof ticketSchema>
export const TicketModel = models.Ticket ?? model('Ticket', ticketSchema)
