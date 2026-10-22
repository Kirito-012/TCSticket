import { NextResponse, type NextRequest } from 'next/server'
import { dbConnect } from '@/server/db/connect'
import { TicketModel } from '@/server/db/models/ticket.model'
import { TicketStatusModel } from '@/server/db/models/ticket-status.model'

/**
 * GET /api/v1/tickets/:number — what DroneSeva needs to re-check one ticket: whether it is finished,
 * whether it is verified yet, and where it is. Same `x-api-key` auth as POST /api/v1/tickets.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ number: string }> }) {
  const expectedKey = process.env.INTEGRATION_API_KEY
  if (!expectedKey) {
    return NextResponse.json({ error: 'Integration API is not configured' }, { status: 503 })
  }
  if (req.headers.get('x-api-key') !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const number = Number((await params).number)
  if (!Number.isInteger(number) || number < 1) {
    return NextResponse.json({ error: 'Invalid ticket number' }, { status: 400 })
  }

  await dbConnect()
  const ticket = await TicketModel.findOne({ number, deletedAt: null })
    .select('number subject statusId location verification')
    .lean()
  if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
  const status = ticket.statusId
    ? await TicketStatusModel.findById(ticket.statusId).select('name slug isResolved').lean()
    : null

  const lat = ticket.location?.latitude
  const lon = ticket.location?.longitude
  return NextResponse.json({
    ticket: {
      number: ticket.number,
      subject: ticket.subject,
      status: status?.name ?? null,
      finished: Boolean(status?.isResolved),
      verified: ticket.verification?.status === 'verified',
      location:
        typeof lat === 'number' && typeof lon === 'number'
          ? { latitude: lat, longitude: lon }
          : null,
    },
  })
}
