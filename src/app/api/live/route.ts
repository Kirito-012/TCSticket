import { NextResponse, type NextRequest } from 'next/server'
import { getCurrentUser } from '@/server/auth/session'
import { dbConnect } from '@/server/db/connect'
import { TicketModel } from '@/server/db/models/ticket.model'
import { UserModel } from '@/server/db/models/user.model'
import { scopeFor } from '@/lib/ticket-scope'
import { scopeFilter } from '@/server/services/ticket.service'

/**
 * GET /api/live[?number=123] — a tiny "did anything change?" check that open pages ask every few
 * seconds. It returns a short token made of how many tickets the caller can see and when the most
 * recent one was updated; the page only reloads its data when that token is different from the
 * last one. Each person watches only the tickets they may see (all, their zone, their sector, or
 * their own), and `number` narrows it to one ticket (for the ticket page).
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Please sign in' }, { status: 401 })

  await dbConnect()
  const placement = await UserModel.findById(user.id).select('sectorKey zoneKey').lean()
  const scope = scopeFor(
    { id: user.id, sectorKey: placement?.sectorKey ?? null, zoneKey: placement?.zoneKey ?? null },
    user.grants,
  )
  const filter: Record<string, unknown> = { deletedAt: null, ...scopeFilter(scope) }

  const number = Number(req.nextUrl.searchParams.get('number'))
  if (Number.isInteger(number) && number > 0) filter.number = number

  const [summary] = await TicketModel.aggregate<{ count: number; latest: Date | null }>([
    { $match: filter },
    { $group: { _id: null, count: { $sum: 1 }, latest: { $max: '$updatedAt' } } },
  ])

  return NextResponse.json(
    { token: `${summary?.count ?? 0}:${summary?.latest ? new Date(summary.latest).getTime() : 0}` },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
