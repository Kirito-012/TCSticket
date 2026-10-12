import { Types } from 'mongoose'
import { NextResponse, type NextRequest } from 'next/server'
import { defineAbilityFor } from '@/server/auth/ability'
import { getCurrentUser } from '@/server/auth/session'
import { dbConnect } from '@/server/db/connect'
import { TicketModel } from '@/server/db/models/ticket.model'

/**
 * GET /api/live[?number=123] — a tiny "did anything change?" check that open pages ask every few
 * seconds. It returns a short token made of how many tickets the caller can see and when the most
 * recent one was updated; the page only reloads its data when that token is different from the
 * last one. Admins and Managers watch every ticket, a Zone Inspector only their own, and
 * `number` narrows it to one ticket (for the ticket page).
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Please sign in' }, { status: 401 })

  const ability = defineAbilityFor(user.grants)
  const filter: Record<string, unknown> = { deletedAt: null }
  if (!ability.can('read:all', 'ticket')) filter.assigneeId = new Types.ObjectId(user.id)

  const number = Number(req.nextUrl.searchParams.get('number'))
  if (Number.isInteger(number) && number > 0) filter.number = number

  await dbConnect()
  const [summary] = await TicketModel.aggregate<{ count: number; latest: Date | null }>([
    { $match: filter },
    { $group: { _id: null, count: { $sum: 1 }, latest: { $max: '$updatedAt' } } },
  ])

  return NextResponse.json(
    { token: `${summary?.count ?? 0}:${summary?.latest ? new Date(summary.latest).getTime() : 0}` },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
