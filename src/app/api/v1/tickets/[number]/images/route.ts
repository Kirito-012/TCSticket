import { NextResponse, type NextRequest } from 'next/server'
import { logger } from '@/lib/logger'
import { uploadCommentImage } from '@/server/cloudinary'
import * as ticketService from '@/server/services/ticket.service'

const MAX_BYTES = 12 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

/**
 * POST /api/v1/tickets/:number/images — service-to-service, like POST /api/v1/tickets.
 * DroneSeva sends the drone photo a ticket was raised from; it is stored with the ticket so the
 * Zone Inspector sees the place they are being sent to.
 *
 * Auth: `x-api-key: <INTEGRATION_API_KEY>`   Body: multipart/form-data with one `file`.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ number: string }> }) {
  const expectedKey = process.env.INTEGRATION_API_KEY
  if (!expectedKey) {
    return NextResponse.json({ error: 'Integration API is not configured' }, { status: 503 })
  }
  if (req.headers.get('x-api-key') !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const number = Number((await params).number)
  if (!Number.isInteger(number) || number <= 0) {
    return NextResponse.json({ error: 'Invalid ticket number' }, { status: 400 })
  }

  let file: FormDataEntryValue | null
  try {
    file = (await req.formData()).get('file')
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 })
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: 'Only JPEG, PNG and WEBP images are allowed' },
      { status: 400 },
    )
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Image must be under 12MB' }, { status: 413 })
  }

  try {
    const image = await uploadCommentImage(file, 'tcs-ticket/reported')
    const ticket = await ticketService.addSourcePhoto(number, image)
    if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    return NextResponse.json({ photo: image }, { status: 201 })
  } catch (err) {
    logger.error({ err, number }, 'Failed to attach a drone photo to a ticket')
    return NextResponse.json({ error: 'Upload failed' }, { status: 502 })
  }
}
