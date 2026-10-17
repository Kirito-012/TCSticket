import { NextResponse, type NextRequest } from 'next/server'
import { dbConnect } from '@/server/db/connect'
import { TicketModel } from '@/server/db/models/ticket.model'
import { TicketTypeModel } from '@/server/db/models/ticket-type.model'
import { distanceMeters } from '@/lib/geo'
import { logger } from '@/lib/logger'

const INTEGRATION_TYPE_SLUG = 'garbage-detection'
const METERS_PER_DEGREE = 111_320
const MAX_RADIUS_METERS = 500

/**
 * GET /api/v1/tickets/nearby?latitude=..&longitude=..&radius=..  (metres, default 20)
 *
 * Which garbage tickets that are still open (not resolved, not closed) are within `radius` metres
 * of a point. DroneSeva asks this before it makes a ticket, so the same place never gets a second
 * ticket while the first one is still open. Same `x-api-key` auth as POST /api/v1/tickets.
 */
export async function GET(req: NextRequest) {
  const expectedKey = process.env.INTEGRATION_API_KEY
  if (!expectedKey) {
    logger.error('INTEGRATION_API_KEY is not configured — refusing /api/v1/tickets/nearby')
    return NextResponse.json({ error: 'Integration API is not configured' }, { status: 503 })
  }
  if (req.headers.get('x-api-key') !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const params = req.nextUrl.searchParams
  const latitude = Number(params.get('latitude'))
  const longitude = Number(params.get('longitude'))
  const radius = Math.min(Number(params.get('radius') ?? 20) || 20, MAX_RADIUS_METERS)
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    return NextResponse.json({ error: 'latitude and longitude are required' }, { status: 400 })
  }

  await dbConnect()
  const type = await TicketTypeModel.findOne({ slug: INTEGRATION_TYPE_SLUG }).lean()
  if (!type) return NextResponse.json({ tickets: [] })

  // A box around the point first (cheap), then the exact distance.
  const dLat = radius / METERS_PER_DEGREE
  const dLon = radius / (METERS_PER_DEGREE * Math.max(0.01, Math.cos((latitude * Math.PI) / 180)))
  const candidates = await TicketModel.find({
    typeId: type._id,
    resolvedAt: null,
    closedAt: null,
    'location.latitude': { $gte: latitude - dLat, $lte: latitude + dLat },
    'location.longitude': { $gte: longitude - dLon, $lte: longitude + dLon },
  })
    .select('number location')
    .limit(50)
    .lean()

  const tickets = candidates
    .map((t) => ({
      number: t.number,
      distanceMeters: distanceMeters(
        { latitude, longitude },
        { latitude: t.location!.latitude!, longitude: t.location!.longitude! },
      ),
    }))
    .filter((t) => t.distanceMeters <= radius)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, 5)

  return NextResponse.json({ tickets })
}
