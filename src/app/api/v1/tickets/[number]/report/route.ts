import { NextResponse, type NextRequest } from 'next/server'
import { logger } from '@/lib/logger'
import { deleteReportPdf, uploadReportPdf } from '@/server/cloudinary'
import * as ticketService from '@/server/services/ticket.service'

const MAX_BYTES = 15 * 1024 * 1024

/**
 * POST /api/v1/tickets/:number/report — service-to-service, like the photo endpoint.
 * DroneSeva sends the PDF report its garbage detection produced, so the Zone Inspector and the
 * admins can open it from the ticket. Sending again replaces the previous report.
 *
 * Auth: `x-api-key: <INTEGRATION_API_KEY>`   Body: multipart/form-data with one `file` (a PDF).
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
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'The report must be under 15MB' }, { status: 413 })
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  // Check what the file really is, not just what it claims to be.
  if (bytes.subarray(0, 5).toString('latin1') !== '%PDF-') {
    return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 })
  }

  try {
    const uploaded = await uploadReportPdf(bytes)
    const name = (file.name || 'Detection report.pdf').replace(/[^\w. -]+/g, '_').slice(0, 120)
    const previous = await ticketService.setReportPdf(number, {
      url: uploaded.url,
      publicId: uploaded.publicId,
      name,
      bytes: uploaded.bytes,
    })
    if (!previous) {
      await deleteReportPdf(uploaded.publicId).catch(() => undefined)
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }
    const oldId = (previous as { reportPdf?: { publicId?: string } | null }).reportPdf?.publicId
    if (oldId) await deleteReportPdf(oldId).catch(() => undefined) // tidy up a replaced report
    return NextResponse.json({ report: { name, bytes: uploaded.bytes } }, { status: 201 })
  } catch (err) {
    logger.error({ err, number }, 'Failed to attach a detection report to a ticket')
    return NextResponse.json({ error: 'Upload failed' }, { status: 502 })
  }
}
