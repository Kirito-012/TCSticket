import { NextResponse, type NextRequest } from 'next/server'
import { dbConnect } from '@/server/db/connect'
import { TicketModel } from '@/server/db/models/ticket.model'
import { TicketStatusModel } from '@/server/db/models/ticket-status.model'
import { TicketTypeModel } from '@/server/db/models/ticket-type.model'
import { distanceMeters } from '@/lib/geo'
import { logger } from '@/lib/logger'

const INTEGRATION_TYPE_SLUG = 'garbage-detection'
const METERS_PER_DEGREE = 111_320
const MAX_RADIUS_METERS = 500

/**
 * GET /api/v1/tickets/to-verify?latitude=..&longitude=..&radius=..  (metres, default 30)
 *
 * The finished garbage tickets that are not verified yet and are within `radius` metres of a point.
 * DroneSeva asks this after a new photo of an area is checked, to know which tickets that photo can
 * verify (clean photo) or reopen (garbage still there). Same `x-api-key` auth as /api/v1/tickets.
 */
export async function GET(req: NextRequest) {
  const expectedKey = process.env.INTEGRATION_API_KEY
  if (!expectedKey) {
    logger.error('INTEGRATION_API_KEY is not configured — refusing /api/v1/tickets/to-verify')
    return NextResponse.json({ error: 'Integration API is not configured' }, { status: 503 })
  }
  if (req.headers.get('x-api-key') !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const params = req.nextUrl.searchParams
  const latitude = Number(params.get('latitude'))
  const longitude = Number(params.get('longitude'))
  const radius = Math.min(Number(params.get('radius') ?? 30) || 30, MAX_RADIUS_METERS)
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    return NextResponse.json({ error: 'latitude and longitude are required' }, { status: 400 })
  }

  await dbConnect()
  const [type, finished] = await Promise.all([
    TicketTypeModel.findOne({ slug: INTEGRATION_TYPE_SLUG }).lean(),
    TicketStatusModel.find({ isResolved: true }).select('_id').lean(),
  ])
  if (!type) return NextResponse.json({ tickets: [] })

  const dLat = radius / METERS_PER_DEGREE
  const dLon = radius / (METERS_PER_DEGREE * Math.max(0.01, Math.cos((latitude * Math.PI) / 180)))
  const candidates = await TicketModel.find({
    typeId: type._id,
    deletedAt: null,
    statusId: { $in: finished.map((s) => s._id) },
    'verification.status': { $ne: 'verified' },
    'location.latitude': { $gte: latitude - dLat, $lte: latitude + dLat },
    'location.longitude': { $gte: longitude - dLon, $lte: longitude + dLon },
  })
    .select('number subject location')
    .limit(100)
    .lean()

  const tickets = candidates
    .map((t) => ({
      number: t.number,
      subject: t.subject,
      distanceMeters: Math.round(
        distanceMeters(
          { latitude, longitude },
          { latitude: t.location!.latitude!, longitude: t.location!.longitude! },
        ),
      ),
    }))
    .filter((t) => t.distanceMeters <= radius)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)

  return NextResponse.json({ tickets })
}
