'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, ImagePlus, Loader2, X } from 'lucide-react'
import { ImageLightbox } from '@/components/ui/ImageLightbox'
import {
  uploadResolutionPhotoAction,
  removeResolutionPhotoAction,
  resolveTicketAction,
} from '@/server/actions/ticket.actions'
import type { CommentAttachmentView } from '@/lib/ticket-view'

// Keep in sync with MAX_IMAGE_BYTES / ALLOWED_IMAGE_TYPES in server/actions/ticket.actions.ts.
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])

type UploadingPhoto = { id: string; previewUrl: string }

export function SurveyorResolutionPanel({
  ticketNumber,
  photos: serverPhotos,
  isResolved,
  resolutionNote,
}: {
  ticketNumber: number
  photos: CommentAttachmentView[]
  isResolved: boolean
  resolutionNote: string
}) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState('')
  // Local copy so a photo appears the moment its upload finishes; re-synced whenever the server
  // sends fresh data (after router.refresh()).
  const [photos, setPhotos] = useState(serverPhotos)
  const [uploading, setUploading] = useState<UploadingPhoto[]>([])
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [resolving, startResolve] = useTransition()

  // Re-sync from the server when fresh props arrive (derived-state pattern, not an effect).
  const [seenServerPhotos, setSeenServerPhotos] = useState(serverPhotos)
  if (serverPhotos !== seenServerPhotos) {
    setSeenServerPhotos(serverPhotos)
    setPhotos(serverPhotos)
  }

  async function uploadOne(file: File) {
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setError('Please choose a photo (JPG or PNG).')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError('That photo is too big. Please choose a smaller one.')
      return
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const previewUrl = URL.createObjectURL(file)
    setUploading((prev) => [...prev, { id, previewUrl }])

    try {
      const fd = new FormData()
      fd.set('file', file)
      const result = await uploadResolutionPhotoAction(ticketNumber, fd)
      if (result?.error) setError(result.error)
      else if (result?.photo) {
        const uploaded = result.photo
        setPhotos((prev) =>
          prev.some((p) => p.publicId === uploaded.publicId) ? prev : [...prev, uploaded],
        )
      }
    } catch {
      setError('The photo did not upload. Please try again.')
    } finally {
      setUploading((prev) => prev.filter((u) => u.id !== id))
      URL.revokeObjectURL(previewUrl)
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setError(null)
    const selected = Array.from(files)
    if (fileInputRef.current) fileInputRef.current.value = ''

    // All files upload in parallel; each one shows up as soon as it finishes.
    await Promise.all(selected.map(uploadOne))
    router.refresh()
  }

  async function handleRemove(publicId: string) {
    setError(null)
    setRemovingId(publicId)
    try {
      const result = await removeResolutionPhotoAction(ticketNumber, publicId)
      if (result?.error) setError(result.error)
      else setPhotos((prev) => prev.filter((p) => p.publicId !== publicId))
      router.refresh()
    } finally {
      setRemovingId(null)
    }
  }

  function handleResolve() {
    // Marking done can't be undone by an inspector, so ask once in plain words.
    if (!window.confirm('Mark this ticket as done?')) return
    setError(null)
    startResolve(async () => {
      const result = await resolveTicketAction(ticketNumber, note)
      if (result?.error) setError(result.error)
      else router.refresh()
    })
  }

  const lightbox = (
    <ImageLightbox
      images={photos.map((p) => ({ url: p.url, alt: 'Resolution photo' }))}
      index={lightboxIndex}
      onChange={setLightboxIndex}
      onClose={() => setLightboxIndex(null)}
    />
  )

  if (isResolved) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3 rounded-2xl border-2 border-accent bg-accent-soft p-4">
          <CheckCircle2 className="h-10 w-10 shrink-0 text-accent" strokeWidth={2.25} />
          <p className="text-xl font-bold text-foreground">This ticket is done</p>
        </div>
        {resolutionNote && (
          <div className="rounded-2xl border-2 border-border-strong bg-surface p-4">
            <p className="mb-1 text-base font-semibold text-muted">Your note</p>
            <p className="whitespace-pre-wrap text-lg text-foreground">{resolutionNote}</p>
          </div>
        )}
        {photos.length > 0 && (
          <div>
            <p className="mb-2 text-lg font-bold text-foreground">Your photos</p>
            <PhotoGrid photos={photos} uploading={[]} onOpen={setLightboxIndex} />
          </div>
        )}
        {lightbox}
      </div>
    )
  }

  const busy = uploading.length > 0 || resolving || removingId !== null

  return (
    <div className="space-y-7">
      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border-2 border-danger bg-danger-soft p-4 text-lg font-semibold text-danger"
        >
          <AlertCircle className="mt-0.5 h-6 w-6 shrink-0" />
          {error}
        </div>
      )}

      <section className="space-y-3">
        <h3 className="text-xl font-bold text-foreground">1. Add photos</h3>
        <p className="text-lg text-muted">Take or choose photos of the place after cleaning.</p>

        <PhotoGrid
          photos={photos}
          uploading={uploading}
          onOpen={setLightboxIndex}
          onRemove={handleRemove}
          removingId={removingId}
        />
        {lightbox}

        <label className="flex min-h-14 cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 border-border-strong bg-surface px-5 text-lg font-bold text-foreground active:bg-surface-hover">
          <ImagePlus className="h-7 w-7" strokeWidth={2.25} />
          {photos.length > 0 ? 'Add more photos' : 'Add photos'}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            className="sr-only"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </label>
      </section>

      <section className="space-y-3">
        <label htmlFor="resolution-note" className="block text-xl font-bold text-foreground">
          2. Anything to tell us? <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea
          id="resolution-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1000}
          rows={4}
          placeholder="Write here if you want to add something"
          className="w-full resize-y rounded-2xl border-2 border-border-strong bg-surface px-4 py-3 text-lg text-foreground outline-none placeholder:text-muted focus:border-accent"
        />
      </section>

      <section className="space-y-3">
        <h3 className="text-xl font-bold text-foreground">3. Finished?</h3>
        <button
          type="button"
          onClick={handleResolve}
          disabled={busy || photos.length === 0}
          className="flex min-h-16 w-full cursor-pointer items-center justify-center gap-3 rounded-2xl bg-accent px-6 text-xl font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {resolving ? (
            <Loader2 className="h-7 w-7 animate-spin" />
          ) : (
            <CheckCircle2 className="h-7 w-7" strokeWidth={2.5} />
          )}
          Mark as done
        </button>
        {photos.length === 0 && <p className="text-lg text-muted">Add at least one photo first.</p>}
      </section>
    </div>
  )
}

function PhotoGrid({
  photos,
  uploading,
  onOpen,
  onRemove,
  removingId,
}: {
  photos: CommentAttachmentView[]
  uploading: UploadingPhoto[]
  onOpen: (index: number) => void
  onRemove?: (publicId: string) => void
  removingId?: string | null
}) {
  if (photos.length === 0 && uploading.length === 0) return null
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {photos.map((p, i) => (
        <div
          key={p.publicId}
          className="relative aspect-square overflow-hidden rounded-2xl border-2 border-border-strong"
        >
          <button
            type="button"
            onClick={() => onOpen(i)}
            aria-label={`View photo ${i + 1} of ${photos.length}`}
            className="block h-full w-full cursor-zoom-in"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="Your photo" className="h-full w-full object-cover" />
          </button>
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(p.publicId)}
              disabled={removingId === p.publicId}
              aria-label="Remove this photo"
              className="absolute right-2 top-2 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-black/75 text-white disabled:opacity-50"
            >
              {removingId === p.publicId ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <X className="h-5 w-5" strokeWidth={2.5} />
              )}
            </button>
          )}
        </div>
      ))}
      {uploading.map((u) => (
        <div
          key={u.id}
          className="relative aspect-square overflow-hidden rounded-2xl border-2 border-border-strong"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={u.previewUrl} alt="" className="h-full w-full object-cover opacity-60" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
        </div>
      ))}
    </div>
  )
}
