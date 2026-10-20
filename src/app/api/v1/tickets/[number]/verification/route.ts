import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { dbConnect } from '@/server/db/connect'
import { UserModel } from '@/server/db/models/user.model'
import { logger } from '@/lib/logger'
import * as ticketService from '@/server/services/ticket.service'

const SERVICE_ACCOUNT_EMAIL = 'droneseva-bot@thecraftsync.local'

const bodySchema = z.object({
  result: z.enum(['clean', 'dirty']),
  detections: z.number().int().min(0).default(0),
  coveragePercent: z.number().min(0).max(100).default(0),
  note: z.string().trim().max(300).optional(),
})

/**
 * POST /api/v1/tickets/:number/verification — DroneSeva reports what a new photo of the ticket's
 * place showed. { result: 'clean' } verifies the finished ticket; { result: 'dirty' } reopens it
 * (status "Reopened", back on the Surveyor's list). Only finished tickets can be re-checked.
 * Same `x-api-key` auth as POST /api/v1/tickets.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ number: string }> }) {
  const expectedKey = process.env.INTEGRATION_API_KEY
  if (!expectedKey) {
    logger.error('INTEGRATION_API_KEY is not configured — refusing the verification endpoint')
    return NextResponse.json({ error: 'Integration API is not configured' }, { status: 503 })
  }
  if (req.headers.get('x-api-key') !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const number = Number((await params).number)
  if (!Number.isInteger(number) || number < 1) {
    return NextResponse.json({ error: 'Invalid ticket number' }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }

  await dbConnect()
  const bot = await UserModel.findOne({ email: SERVICE_ACCOUNT_EMAIL, isActive: true }).lean()
  if (!bot)
    return NextResponse.json(
      { error: 'Service account is missing — run the seed' },
      { status: 500 },
    )

  try {
    const { result } = await ticketService.applyDroneRecheck(
      number,
      {
        clean: parsed.data.result === 'clean',
        detections: parsed.data.detections,
        coveragePercent: parsed.data.coveragePercent,
        note: parsed.data.note,
      },
      String(bot._id),
    )
    return NextResponse.json({ ticket: number, result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not update the ticket'
    const status =
      message === 'Ticket not found' ? 404 : message.startsWith('Only a finished') ? 409 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
