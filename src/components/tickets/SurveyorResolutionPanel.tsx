'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  AlertTriangle,
  Camera,
  CheckCircle2,
  ImagePlus,
  Loader2,
  MapPin,
  X,
} from 'lucide-react'
import { ImageLightbox } from '@/components/ui/ImageLightbox'
import {
  uploadResolutionPhotoAction,
  removeResolutionPhotoAction,
  resolveTicketAction,
} from '@/server/actions/ticket.actions'
import {
  evaluateLocation,
  verdictMessage,
  type LatLon,
  type LocationFix,
  type LocationRules,
  type LocationVerdict,
} from '@/lib/geo'
import { getBestPosition, positionProblemMessage } from '@/lib/get-position'
import { cn } from '@/lib/utils'
import type { CommentAttachmentView } from '@/lib/ticket-view'

// Keep in sync with MAX_IMAGE_BYTES / ALLOWED_IMAGE_TYPES in server/actions/ticket.actions.ts.
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])

type UploadingPhoto = { id: string; previewUrl: string }
type PhotoMethod = 'camera' | 'gallery'

/** What the "where am I" card shows. */
type PlaceState =
  | { kind: 'idle' }
  | { kind: 'finding'; accuracy: number | null }
  | { kind: 'problem'; message: string }
  | { kind: 'result'; verdict: LocationVerdict; message: string }

export function SurveyorResolutionPanel({
  ticketNumber,
  photos: serverPhotos,
  isResolved,
  resolutionNote,
  target,
  rules,
}: {
  ticketNumber: number
  photos: CommentAttachmentView[]
  isResolved: boolean
  resolutionNote: string
  /** The ticket's spot. Null = this ticket has none, so there is no location check. */
  target: LatLon | null
  rules: LocationRules
}) {
  const router = useRouter()
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [place, setPlace] = useState<PlaceState>({ kind: 'idle' })
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

  const finding = place.kind === 'finding'

  /**
   * Reads the phone's location (this is what makes the browser ask "Allow location?") and shows
   * how close the person is to the ticket's spot. Returns the reading, or null if there is none.
   */
  async function locate(): Promise<{ fix: LocationFix; verdict: LocationVerdict | null } | null> {
    setError(null) // a fresh check replaces any older warning
    setPlace({ kind: 'finding', accuracy: null })
    const result = await getBestPosition({
      onProgress: (accuracy) => setPlace({ kind: 'finding', accuracy }),
    })
    if (!result.ok) {
      setPlace({ kind: 'problem', message: positionProblemMessage(result.reason) })
      return null
    }
    const verdict = target ? evaluateLocation(target, result.fix, rules) : null
    setPlace(
      verdict
        ? { kind: 'result', verdict, message: verdictMessage(verdict, rules) }
        : { kind: 'idle' },
    )
    return { fix: result.fix, verdict }
  }

  async function uploadOne(file: File, fix: LocationFix, method: PhotoMethod) {
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
      fd.set('method', method)
      fd.set('latitude', String(fix.latitude))
      fd.set('longitude', String(fix.longitude))
      fd.set('accuracy', String(fix.accuracy))
      fd.set('capturedAt', String(fix.capturedAt))
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

  async function handleFiles(files: FileList | null, method: PhotoMethod) {
    if (!files || files.length === 0) return
    setError(null)
    const selected = Array.from(files)
    if (cameraInputRef.current) cameraInputRef.current.value = ''
    if (galleryInputRef.current) galleryInputRef.current.value = ''

    // Where is the person right now? Without a location, a photo cannot be accepted.
    const located = await locate()
    if (!located) return
    // The page already tells them they are too far, so no photo is sent that will be refused.
    // (The server checks again — this is only to save a wasted upload.)
    if (located.verdict && !located.verdict.ok) return

    // All files upload in parallel; each one shows up as soon as it finishes.
    await Promise.all(selected.map((file) => uploadOne(file, located.fix, method)))
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

  const busy = uploading.length > 0 || resolving || removingId !== null || finding
  const hasPhotoAtThePlace = !target || photos.some((p) => p.locationCheck?.withinRadius === true)
  const canResolve = !busy && photos.length > 0 && hasPhotoAtThePlace
  const step = (n: number) => (target ? n : n - 1)

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

      {target && (
        <section className="space-y-3">
          <h3 className="text-xl font-bold text-foreground">1. Go to the place</h3>
          <p className="text-lg text-muted">
            Stand at the marked spot (within {rules.radiusMeters} m). We check this with your
            phone&apos;s location when you add a photo.
          </p>
          <PlaceCard place={place} />
          <button
            type="button"
            onClick={() => void locate()}
            disabled={busy}
            className="flex min-h-14 w-full cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 border-border-strong bg-surface px-5 text-lg font-bold text-foreground active:bg-surface-hover disabled:opacity-50"
          >
            {finding ? (
              <Loader2 className="h-7 w-7 animate-spin" />
            ) : (
              <MapPin className="h-7 w-7" strokeWidth={2.25} />
            )}
            Check where I am
          </button>
        </section>
      )}

      <section className="space-y-3">
        <h3 className="text-xl font-bold text-foreground">{step(2)}. Add photos</h3>
        <p className="text-lg text-muted">
          Take a photo of the place after cleaning, or choose one from your phone. We check that the
          place is clean.
          {!target && ' We also save where you were.'}
        </p>

        <PhotoGrid
          photos={photos}
          uploading={uploading}
          onOpen={setLightboxIndex}
          onRemove={handleRemove}
          removingId={removingId}
        />
        {lightbox}

        {!target && <PlaceCard place={place} />}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label
            className={cn(
              'flex min-h-14 cursor-pointer items-center justify-center gap-3 rounded-2xl bg-accent px-5 text-lg font-bold text-on-accent active:opacity-90',
              busy && 'pointer-events-none opacity-50',
            )}
          >
            <Camera className="h-7 w-7" strokeWidth={2.25} />
            Take a photo
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => void handleFiles(e.target.files, 'camera')}
            />
          </label>
          <label
            className={cn(
              'flex min-h-14 cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 border-border-strong bg-surface px-5 text-lg font-bold text-foreground active:bg-surface-hover',
              busy && 'pointer-events-none opacity-50',
            )}
          >
            <ImagePlus className="h-7 w-7" strokeWidth={2.25} />
            Choose from phone
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              multiple
              className="sr-only"
              onChange={(e) => void handleFiles(e.target.files, 'gallery')}
            />
          </label>
        </div>
        <p className="text-base text-muted">
          When your phone asks, please tap <strong>Allow</strong> for location.
        </p>
      </section>

      <section className="space-y-3">
        <label htmlFor="resolution-note" className="block text-xl font-bold text-foreground">
          {step(3)}. Anything to tell us? <span className="font-normal text-muted">(optional)</span>
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
        <h3 className="text-xl font-bold text-foreground">{step(4)}. Finished?</h3>
        <button
          type="button"
          onClick={handleResolve}
          disabled={!canResolve}
          className="flex min-h-16 w-full cursor-pointer items-center justify-center gap-3 rounded-2xl bg-accent px-6 text-xl font-bold text-on-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          {resolving ? (
            <Loader2 className="h-7 w-7 animate-spin" />
          ) : (
            <CheckCircle2 className="h-7 w-7" strokeWidth={2.5} />
          )}
          Mark as done
        </button>
        {photos.length === 0 && <p className="text-lg text-muted">Add at least one photo first.</p>}
        {photos.length > 0 && !hasPhotoAtThePlace && (
          <p className="flex items-start gap-2 text-lg font-semibold text-warning">
            <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0" />
            Take a photo at the place first. Photos from somewhere else do not count.
          </p>
        )}
      </section>
    </div>
  )
}

/** The big "where am I" card: finding, at the place, too far, or a problem with the location. */
function PlaceCard({ place }: { place: PlaceState }) {
  if (place.kind === 'idle') return null

  if (place.kind === 'finding') {
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-2xl border-2 border-border-strong bg-surface p-4 text-lg font-semibold text-foreground"
      >
        <Loader2 className="mt-0.5 h-6 w-6 shrink-0 animate-spin" />
        <span>
          Finding your location…
          {place.accuracy !== null && (
            <span className="block text-base font-normal text-muted">
              Accurate to about {Math.max(1, Math.round(place.accuracy))} m
            </span>
          )}
        </span>
      </div>
    )
  }

  if (place.kind === 'problem') {
    return (
      <div
        role="alert"
        className="flex items-start gap-3 rounded-2xl border-2 border-danger bg-danger-soft p-4 text-lg font-semibold text-danger"
      >
        <AlertCircle className="mt-0.5 h-6 w-6 shrink-0" />
        {place.message}
      </div>
    )
  }

  if (place.verdict.ok) {
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-2xl border-2 border-accent bg-accent-soft p-4 text-lg font-bold text-accent-strong"
      >
        <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0" strokeWidth={2.25} />
        <span>
          You are at the place
          <span className="block text-base font-medium">
            About {Math.max(0, Math.round(place.verdict.distanceMeters))} m from the marked spot
          </span>
        </span>
      </div>
    )
  }

  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-2xl border-2 border-warning bg-warning-soft p-4 text-lg font-semibold text-warning"
    >
      <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0" />
      {place.message}
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
          {p.locationCheck?.withinRadius && (
            <span className="pointer-events-none absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/75 px-2.5 py-1 text-sm font-bold text-white">
              <MapPin className="h-4 w-4 text-emerald-300" strokeWidth={2.5} />
              At the place
            </span>
          )}
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
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 p-2 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
            <span className="text-base font-bold text-white">Checking the photo…</span>
          </div>
        </div>
      ))}
    </div>
  )
}
