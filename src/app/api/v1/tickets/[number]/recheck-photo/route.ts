import { NextResponse, type NextRequest } from 'next/server'
import { logger } from '@/lib/logger'
import { uploadCommentImage, deleteCommentImage } from '@/server/cloudinary'
import * as ticketService from '@/server/services/ticket.service'

const MAX_BYTES = 12 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

/**
 * POST /api/v1/tickets/:number/recheck-photo — DroneSeva sends the photo it took when it flew over
 * the ticket's place again, with what it showed. Shown on the ticket next to the verification.
 *
 * Auth: `x-api-key: <INTEGRATION_API_KEY>`
 * Body: multipart/form-data — `file`, `result` ('clean' | 'dirty'), `detections`, `coveragePercent`.
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

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 })
  }
  const file = form.get('file')
  const result = form.get('result')
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (result !== 'clean' && result !== 'dirty') {
    return NextResponse.json({ error: "result must be 'clean' or 'dirty'" }, { status: 400 })
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
  const detections = Math.max(0, Math.round(Number(form.get('detections')) || 0))
  const coveragePercent = Math.min(100, Math.max(0, Number(form.get('coveragePercent')) || 0))

  try {
    const image = await uploadCommentImage(file, 'tcs-ticket/recheck')
    const previous = await ticketService.setRecheckPhoto(number, {
      ...image,
      result,
      detections,
      coveragePercent,
    })
    if (previous === undefined) {
      await deleteCommentImage(image.publicId).catch(() => {})
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }
    if (previous) await deleteCommentImage(previous).catch(() => {}) // the older re-check photo is replaced
    return NextResponse.json({ photo: image }, { status: 201 })
  } catch (err) {
    logger.error({ err, number }, 'Failed to attach a re-check photo to a ticket')
    return NextResponse.json({ error: 'Upload failed' }, { status: 502 })
  }
}
