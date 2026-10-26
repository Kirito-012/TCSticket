import { NextResponse, type NextRequest } from 'next/server'
import { logger } from '@/lib/logger'
import { scopeAllows, scopeFor } from '@/lib/ticket-scope'
import { UserModel } from '@/server/db/models/user.model'
import { getCurrentUser } from '@/server/auth/session'
import { dbConnect } from '@/server/db/connect'
import { TicketModel } from '@/server/db/models/ticket.model'

/**
 * GET /api/tickets/:number/report — the ticket's detection report PDF, for signed-in people who
 * may see that ticket (the same rule as the ticket page: an Admin sees all, a Zone Inspector the
 * tickets of their zone, a Nodal Manager those of their sector, a Surveyor only their own).
 * `?download=1` saves the file; without it the PDF is shown inside the page's viewer.
 * The file's real address is never given out.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ number: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Please sign in' }, { status: 401 })

  const number = Number((await params).number)
  if (!Number.isInteger(number) || number <= 0) {
    return NextResponse.json({ error: 'Invalid ticket number' }, { status: 400 })
  }

  await dbConnect()
  const ticket = await TicketModel.findOne({ number, deletedAt: null })
    .select('assigneeId sectorKey reportPdf')
    .lean()
  // The person's own zone / sector decides what they may open (read fresh, like the ticket page does).
  const placement = await UserModel.findById(user.id).select('sectorKey zoneKey').lean()
  const scope = scopeFor(
    {
      id: String(user.id),
      sectorKey: placement?.sectorKey ?? null,
      zoneKey: placement?.zoneKey ?? null,
    },
    user.grants,
  )
  const mayRead =
    !!ticket &&
    scopeAllows(scope, {
      sectorKey: ticket.sectorKey ?? null,
      assigneeId: ticket.assigneeId ? String(ticket.assigneeId) : null,
    })
  // Same answer for "no such ticket", "not yours" and "no report", so nothing is given away.
  if (!ticket || !mayRead || !ticket.reportPdf?.url) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  }

  let upstream: Response
  try {
    upstream = await fetch(ticket.reportPdf.url)
  } catch (err) {
    logger.error({ err, number }, 'Could not fetch the detection report')
    return NextResponse.json({ error: 'Could not load the report' }, { status: 502 })
  }
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'Could not load the report' }, { status: 502 })
  }

  const filename = (ticket.reportPdf.name || 'Detection report.pdf').replace(/"/g, '')
  const download = req.nextUrl.searchParams.get('download') === '1'
  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${filename}"`,
      'Cache-Control': 'private, max-age=300',
    },
  })
}
