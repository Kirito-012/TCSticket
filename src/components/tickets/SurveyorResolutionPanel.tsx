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
import { useT } from '@/i18n/client'
import type { CommentAttachmentView } from '@/lib/ticket-view'

// Keep in sync with MAX_IMAGE_BYTES / ALLOWED_IMAGE_TYPES in server/actions/ticket.actions.ts.
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])

type UploadingPhoto = { id: string; previewUrl: string }
type PhotoMethod = 'camera' | 'gallery'
type RefusedPhoto = {
  previewUrl: string
  boxes: [number, number, number, number][]
  percent: number | null
}

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
  originalPhotoUrl,
}: {
  ticketNumber: number
  photos: CommentAttachmentView[]
  isResolved: boolean
  resolutionNote: string
  /** The ticket's spot. Null = this ticket has none, so there is no location check. */
  target: LatLon | null
  rules: LocationRules
  /** The drone photo the garbage was first found in, shown next to a refused photo. */
  originalPhotoUrl: string | null
}) {
  const router = useRouter()
  const t = useT()
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

  // A photo the garbage check refused, kept so the model's findings can be shown on it.
  const [refused, setRefused] = useState<RefusedPhoto | null>(null)

  // Testing aid (development only): type coordinates instead of using the phone's location.
  const [manualFix, setManualFix] = useState<LatLon | null>(null)

  const finding = place.kind === 'finding'

  /**
   * Reads the phone's location (this is what makes the browser ask "Allow location?") and shows
   * how close the person is to the ticket's spot. Returns the reading, or null if there is none.
   */
  async function locate(): Promise<{ fix: LocationFix; verdict: LocationVerdict | null } | null> {
    setError(null) // a fresh check replaces any older warning
    let fix: LocationFix
    if (manualFix) {
      fix = { ...manualFix, accuracy: 5, capturedAt: Date.now() }
    } else {
      setPlace({ kind: 'finding', accuracy: null })
      const result = await getBestPosition({
        onProgress: (accuracy) => setPlace({ kind: 'finding', accuracy }),
      })
      if (!result.ok) {
        setPlace({
          kind: 'problem',
          message: positionProblemMessage(
            result.reason,
            t,
            result.reason === 'rough' ? result.accuracy : undefined,
          ),
        })
        return null
      }
      fix = result.fix
    }
    const verdict = target ? evaluateLocation(target, fix, rules) : null
    setPlace(
      verdict
        ? { kind: 'result', verdict, message: verdictMessage(verdict, rules, t) }
        : { kind: 'idle' },
    )
    return { fix, verdict }
  }

  async function uploadOne(file: File, fix: LocationFix, method: PhotoMethod) {
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setError(t('Please choose a photo (JPG or PNG).'))
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError(t('That photo is too big. Please choose a smaller one.'))
      return
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const previewUrl = URL.createObjectURL(file)
    let keepPreview = false
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
      if (result?.error) {
        setError(result.error)
        if (result.tooMuchGarbage) {
          // Keep the photo on screen so the model's findings can be drawn on it.
          keepPreview = true
          setRefused((prev) => {
            if (prev) URL.revokeObjectURL(prev.previewUrl)
            return {
              previewUrl,
              boxes: result.garbageBoxes ?? [],
              percent: result.garbagePercent ?? null,
            }
          })
        }
      } else if (result?.photo) {
        const uploaded = result.photo
        setPhotos((prev) =>
          prev.some((p) => p.publicId === uploaded.publicId) ? prev : [...prev, uploaded],
        )
      }
    } catch {
      setError(t('The photo did not upload. Please try again.'))
    } finally {
      setUploading((prev) => prev.filter((u) => u.id !== id))
      if (!keepPreview) URL.revokeObjectURL(previewUrl)
    }
  }

  function clearRefused() {
    setRefused((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl)
      return null
    })
  }

  async function handleFiles(files: FileList | null, method: PhotoMethod) {
    if (!files || files.length === 0) return
    setError(null)
    clearRefused()
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
    if (!window.confirm(t('Mark this ticket as done?'))) return
    setError(null)
    startResolve(async () => {
      const result = await resolveTicketAction(ticketNumber, note)
      if (result?.error) setError(result.error)
      else router.refresh()
    })
  }

  const lightbox = (
    <ImageLightbox
      images={photos.map((p) => ({ url: p.url, alt: t('Your photo') }))}
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
          <p className="text-xl font-bold text-foreground">{t('This ticket is done')}</p>
        </div>
        {resolutionNote && (
          <div className="rounded-2xl border-2 border-border-strong bg-surface p-4">
            <p className="mb-1 text-base font-semibold text-muted">{t('Your note')}</p>
            <p className="whitespace-pre-wrap text-lg text-foreground">{resolutionNote}</p>
          </div>
        )}
        {photos.length > 0 && (
          <div>
            <p className="mb-2 text-lg font-bold text-foreground">{t('Your photos')}</p>
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
          <h3 className="text-xl font-bold text-foreground">{t('1. Go to the place')}</h3>
          <p className="text-lg text-muted">
            {t(
              "Stand at the marked spot (within {radius} m). We check this with your phone's location when you add a photo.",
              { radius: rules.radiusMeters },
            )}
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
            {t('Check where I am')}
          </button>
        </section>
      )}

      {process.env.NODE_ENV !== 'production' && (
        <ManualCoordinates target={target} value={manualFix} onChange={setManualFix} />
      )}

      <section className="space-y-3">
        <h3 className="text-xl font-bold text-foreground">
          {step(2)}. {t('Add photos')}
        </h3>
        <p className="text-lg text-muted">
          {t(
            'Take a photo of the place after cleaning, or choose one from your phone. We check that the place is clean.',
          )}
          {!target && ` ${t('We also save where you were.')}`}
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

        {refused && (
          <RefusedPhotoCard photo={refused} original={originalPhotoUrl} onClose={clearRefused} />
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label
            className={cn(
              'flex min-h-14 cursor-pointer items-center justify-center gap-3 rounded-2xl bg-accent px-5 text-lg font-bold text-on-accent active:opacity-90',
              busy && 'pointer-events-none opacity-50',
            )}
          >
            <Camera className="h-7 w-7" strokeWidth={2.25} />
            {t('Take a photo')}
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
            {t('Choose from phone')}
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
          {t('When your phone asks, please tap Allow for location.')}
        </p>
      </section>

      <section className="space-y-3">
        <label htmlFor="resolution-note" className="block text-xl font-bold text-foreground">
          {step(3)}. {t('Anything to tell us?')}{' '}
          <span className="font-normal text-muted">({t('optional')})</span>
        </label>
        <textarea
          id="resolution-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1000}
          rows={4}
          placeholder={t('Write here if you want to add something')}
          className="w-full resize-y rounded-2xl border-2 border-border-strong bg-surface px-4 py-3 text-lg text-foreground outline-none placeholder:text-muted focus:border-accent"
        />
      </section>

      <section className="space-y-3">
        <h3 className="text-xl font-bold text-foreground">
          {step(4)}. {t('Finished?')}
        </h3>
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
          {t('Mark as done')}
        </button>
        {photos.length === 0 && (
          <p className="text-lg text-muted">{t('Add at least one photo first.')}</p>
        )}
        {photos.length > 0 && !hasPhotoAtThePlace && (
          <p className="flex items-start gap-2 text-lg font-semibold text-warning">
            <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0" />
            {t('Take a photo at the place first. Photos from somewhere else do not count.')}
          </p>
        )}
      </section>
    </div>
  )
}

/** The refused photo with a red box around each place the model saw garbage. */
function RefusedPhotoCard({
  photo,
  original,
  onClose,
}: {
  photo: RefusedPhoto
  original: string | null
  onClose: () => void
}) {
  const t = useT()
  const shown =
    photo.percent === null ? null : photo.percent < 1 ? '<1' : String(Math.round(photo.percent))
  return (
    <div className="space-y-3 rounded-2xl border-2 border-danger bg-danger-soft p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-lg font-bold text-danger">
          {t('This photo was not accepted')}
          {shown !== null && (
            <span className="block text-base font-semibold">
              {t('The red boxes show the garbage we found ({percent}% of the picture)', {
                percent: shown,
              })}
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('Close')}
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-surface text-foreground"
        >
          <X className="h-5 w-5" strokeWidth={2.5} />
        </button>
      </div>
      <div className={cn('grid gap-3', original && 'sm:grid-cols-2')}>
        {original && (
          <figure className="space-y-1.5">
            <figcaption className="text-base font-bold text-foreground">
              {t('Before: the drone photo')}
            </figcaption>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={original}
              alt={t('The original drone photo')}
              className="block max-h-[28rem] w-full rounded-xl object-contain"
            />
          </figure>
        )}
        <figure className="space-y-1.5">
          <figcaption className="text-base font-bold text-foreground">
            {original ? t('Now: your photo') : t('Your photo')}
          </figcaption>
          <div className="relative mx-auto w-fit max-w-full overflow-hidden rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.previewUrl}
              alt={t('The photo that was not accepted')}
              className="block max-h-[28rem] max-w-full"
            />
            {photo.boxes.map(([l, top, r, b], i) => (
              <span
                key={i}
                className="pointer-events-none absolute border-[3px] border-red-500 bg-red-500/20"
                style={{
                  left: `${l * 100}%`,
                  top: `${top * 100}%`,
                  width: `${(r - l) * 100}%`,
                  height: `${(b - top) * 100}%`,
                }}
              />
            ))}
          </div>
        </figure>
      </div>
      {photo.boxes.length === 0 && (
        <p className="text-base text-foreground">
          {t('The garbage is spread over too much of the picture to outline.')}
        </p>
      )}
    </div>
  )
}

/**
 * TESTING ONLY (shown in development, never in production): lets you type the coordinates the
 * photo is "taken" at, so the location check can be tried from a desktop.
 */
function ManualCoordinates({
  target,
  value,
  onChange,
}: {
  target: LatLon | null
  value: LatLon | null
  onChange: (value: LatLon | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [lat, setLat] = useState('')
  const [lon, setLon] = useState('')
  const [problem, setProblem] = useState<string | null>(null)

  function apply() {
    const latitude = Number(lat)
    const longitude = Number(lon)
    if (
      lat.trim() === '' ||
      lon.trim() === '' ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    ) {
      setProblem('Enter a latitude (-90 to 90) and a longitude (-180 to 180).')
      return
    }
    setProblem(null)
    onChange({ latitude, longitude })
  }

  function clear() {
    setProblem(null)
    onChange(null)
  }

  return (
    <section className="rounded-2xl border-2 border-dashed border-border-strong p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="cursor-pointer text-base font-bold text-muted"
      >
        {open ? 'Hide' : 'Show'} testing: type coordinates by hand
        {value && ' (in use)'}
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              inputMode="decimal"
              placeholder="Latitude"
              aria-label="Latitude"
              className="min-h-12 rounded-xl border-2 border-border-strong bg-surface px-3 text-lg text-foreground outline-none focus:border-accent"
            />
            <input
              value={lon}
              onChange={(e) => setLon(e.target.value)}
              inputMode="decimal"
              placeholder="Longitude"
              aria-label="Longitude"
              className="min-h-12 rounded-xl border-2 border-border-strong bg-surface px-3 text-lg text-foreground outline-none focus:border-accent"
            />
          </div>
          {problem && <p className="text-base font-semibold text-danger">{problem}</p>}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={apply}
              className="min-h-12 cursor-pointer rounded-xl bg-accent px-4 text-base font-bold text-on-accent"
            >
              Use these coordinates
            </button>
            {target && (
              <button
                type="button"
                onClick={() => {
                  setLat(String(target.latitude))
                  setLon(String(target.longitude))
                }}
                className="min-h-12 cursor-pointer rounded-xl border-2 border-border-strong bg-surface px-4 text-base font-bold text-foreground"
              >
                Fill with the ticket&apos;s spot
              </button>
            )}
            {value && (
              <button
                type="button"
                onClick={clear}
                className="min-h-12 cursor-pointer rounded-xl border-2 border-border-strong bg-surface px-4 text-base font-bold text-foreground"
              >
                Use the real location again
              </button>
            )}
          </div>
          {value && (
            <p className="text-base text-muted">
              Photos will use {value.latitude}, {value.longitude} instead of your location.
            </p>
          )}
        </div>
      )}
    </section>
  )
}

/** The big "where am I" card: finding, at the place, too far, or a problem with the location. */
function PlaceCard({ place }: { place: PlaceState }) {
  const t = useT()
  if (place.kind === 'idle') return null

  if (place.kind === 'finding') {
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-2xl border-2 border-border-strong bg-surface p-4 text-lg font-semibold text-foreground"
      >
        <Loader2 className="mt-0.5 h-6 w-6 shrink-0 animate-spin" />
        <span>
          {t('Finding your location…')}
          {place.accuracy !== null && (
            <span className="block text-base font-normal text-muted">
              {t('Accurate to about {meters} m', {
                meters: Math.max(1, Math.round(place.accuracy)),
              })}
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
          {t('You are at the place')}
          <span className="block text-base font-medium">
            {t('About {meters} m from the marked spot', {
              meters: Math.max(0, Math.round(place.verdict.distanceMeters)),
            })}
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
  const t = useT()
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
            aria-label={t('View photo {n} of {total}', { n: i + 1, total: photos.length })}
            className="block h-full w-full cursor-zoom-in"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={t('Your photo')} className="h-full w-full object-cover" />
          </button>
          {p.locationCheck?.withinRadius && (
            <span className="pointer-events-none absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/75 px-2.5 py-1 text-sm font-bold text-white">
              <MapPin className="h-4 w-4 text-emerald-300" strokeWidth={2.5} />
              {t('At the place')}
            </span>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(p.publicId)}
              disabled={removingId === p.publicId}
              aria-label={t('Remove this photo')}
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
            <span className="text-base font-bold text-white">{t('Checking the photo…')}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
