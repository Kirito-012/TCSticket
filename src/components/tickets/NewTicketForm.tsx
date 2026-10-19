'use client'

import { useMemo, useRef, useState, useActionState } from 'react'
import { AlertCircle, ImagePlus, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { RichTextEditor } from '@/components/editor/RichTextEditor'
import {
  createTicketAction,
  uploadCommentImageAction,
  type ActionState,
} from '@/server/actions/ticket.actions'

// Same limits as the upload itself (server/actions/ticket.actions.ts) and the ticket's photo list.
const MAX_PHOTOS = 6
const MAX_PHOTO_BYTES = 8 * 1024 * 1024
const PHOTO_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])

type Photo = { url: string; publicId: string; width: number; height: number }

type TypeOption = {
  id: string
  name: string
  allowedPriorityIds: string[]
  defaultPriorityId: string | null
}
type PriorityOption = { id: string; name: string }

export function NewTicketForm({
  types,
  priorities,
  sectors,
  sectorRequired,
}: {
  types: TypeOption[]
  priorities: PriorityOption[]
  /** The sectors this person may put a ticket in (none for a Surveyor: theirs is used). */
  sectors: { value: string; label: string; zone: string }[]
  /** A Zone Inspector or Nodal Manager must pick one; an Admin may leave it empty. */
  sectorRequired: boolean
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createTicketAction,
    undefined,
  )
  const [typeId, setTypeId] = useState(types[0]?.id ?? '')
  const [sectorKey, setSectorKey] = useState(
    sectorRequired && sectors.length === 1 ? sectors[0].value : '',
  )
  const [issue, setIssue] = useState('')
  const [photos, setPhotos] = useState<Photo[]>([])
  const [uploading, setUploading] = useState(0)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  /** Uploads each picked photo right away (one at a time) so it shows up as a thumbnail. */
  async function addPhotos(files: FileList | null) {
    if (!files || files.length === 0) return
    setPhotoError(null)
    let room = MAX_PHOTOS - photos.length
    for (const file of Array.from(files)) {
      if (room <= 0) {
        setPhotoError(`You can add up to ${MAX_PHOTOS} photos.`)
        break
      }
      if (!PHOTO_TYPES.has(file.type)) {
        setPhotoError('Please choose photos (JPG, PNG, WEBP or GIF).')
        continue
      }
      if (file.size > MAX_PHOTO_BYTES) {
        setPhotoError('A photo is too big (the limit is 8 MB). Please choose a smaller one.')
        continue
      }
      room -= 1
      setUploading((n) => n + 1)
      try {
        const body = new FormData()
        body.set('file', file)
        const result = await uploadCommentImageAction(undefined, body)
        if (result?.image) {
          const image = result.image
          setPhotos((prev) => [...prev, image])
        } else {
          setPhotoError(result?.error ?? 'The photo did not upload. Please try again.')
        }
      } catch {
        setPhotoError('The photo did not upload. Please try again.')
      } finally {
        setUploading((n) => n - 1)
      }
    }
    if (fileInput.current) fileInput.current.value = ''
  }

  const selectedType = types.find((t) => t.id === typeId)
  const allowedPriorities = useMemo(
    () =>
      selectedType && selectedType.allowedPriorityIds.length > 0
        ? priorities.filter((p) => selectedType.allowedPriorityIds.includes(p.id))
        : priorities,
    [selectedType, priorities],
  )
  const [priorityId, setPriorityId] = useState(
    selectedType?.defaultPriorityId ?? priorities[0]?.id ?? '',
  )

  function handleTypeChange(nextTypeId: string) {
    setTypeId(nextTypeId)
    const nextType = types.find((t) => t.id === nextTypeId)
    const nextAllowed =
      nextType && nextType.allowedPriorityIds.length > 0
        ? priorities.filter((p) => nextType.allowedPriorityIds.includes(p.id))
        : priorities
    if (!nextAllowed.some((p) => p.id === priorityId)) {
      setPriorityId(nextType?.defaultPriorityId ?? nextAllowed[0]?.id ?? '')
    }
  }

  return (
    <form action={formAction} className="space-y-5">
      {state?.error && (
        <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {state.error}
        </div>
      )}

      <div>
        <label htmlFor="subject" className="mb-1.5 block text-xs font-medium text-muted-strong">
          Subject
        </label>
        <input
          id="subject"
          name="subject"
          required
          minLength={3}
          maxLength={200}
          placeholder="Briefly describe the issue"
          className="h-10 w-full rounded-lg border border-border-strong bg-white/[0.03] px-3 text-sm text-foreground placeholder:text-muted/60 outline-none transition-colors focus:border-accent/50 focus:bg-white/[0.05] focus:ring-2 focus:ring-accent/20"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="typeId" className="mb-1.5 block text-xs font-medium text-muted-strong">
            Type
          </label>
          <Select
            name="typeId"
            value={typeId}
            onChange={handleTypeChange}
            options={types.map((t) => ({ value: t.id, label: t.name }))}
          />
        </div>

        <div>
          <label
            htmlFor="priorityId"
            className="mb-1.5 block text-xs font-medium text-muted-strong"
          >
            Priority
          </label>
          <Select
            name="priorityId"
            value={priorityId}
            onChange={setPriorityId}
            options={allowedPriorities.map((p) => ({ value: p.id, label: p.name }))}
          />
        </div>
      </div>

      {sectors.length > 0 && (
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-strong">
            Sector {!sectorRequired && <span className="font-normal text-muted">(optional)</span>}
          </label>
          {sectorRequired && sectors.length === 1 ? (
            <p className="flex h-10 items-center rounded-lg border border-border-strong px-3 text-sm text-foreground">
              {sectors[0].label}
            </p>
          ) : (
            <Select
              size="md"
              value={sectorKey}
              onChange={setSectorKey}
              placeholder={sectorRequired ? 'Choose a sector' : 'No sector'}
              options={[
                ...(sectorRequired ? [] : [{ value: '', label: 'No sector' }]),
                ...sectors.map((s) => ({ value: s.value, label: `${s.zone} · ${s.label}` })),
              ]}
            />
          )}
          <input type="hidden" name="sectorKey" value={sectorKey} />
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-strong">Description</label>
        <RichTextEditor
          content={issue}
          onChange={setIssue}
          placeholder="Describe the issue in detail…"
        />
        <input type="hidden" name="issue" value={issue} />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-strong">
          Photos <span className="font-normal text-muted">(optional)</span>
        </label>
        <div className="flex flex-wrap gap-3">
          {photos.map((photo) => (
            <div
              key={photo.publicId}
              className="relative h-24 w-24 overflow-hidden rounded-lg border border-border-strong"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() =>
                  setPhotos((prev) => prev.filter((p) => p.publicId !== photo.publicId))
                }
                aria-label="Remove this photo"
                className="absolute right-1 top-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-black/75 text-white"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.5} />
              </button>
            </div>
          ))}
          {Array.from({ length: uploading }).map((_, i) => (
            <div
              key={`uploading-${i}`}
              className="flex h-24 w-24 items-center justify-center rounded-lg border border-dashed border-border-strong text-muted"
            >
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ))}
          {photos.length + uploading < MAX_PHOTOS && (
            <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border-strong text-xs font-medium text-muted-strong transition-colors hover:bg-white/[0.04]">
              <ImagePlus className="h-5 w-5" />
              Add photos
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                multiple
                className="sr-only"
                onChange={(e) => void addPhotos(e.target.files)}
              />
            </label>
          )}
        </div>
        {photoError && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-danger" role="alert">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {photoError}
          </p>
        )}
        <input type="hidden" name="photos" value={JSON.stringify(photos)} />
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-border pt-5">
        <Button type="submit" size="lg" disabled={pending || uploading > 0}>
          {pending ? 'Creating…' : uploading > 0 ? 'Uploading photos…' : 'Create ticket'}
        </Button>
      </div>
    </form>
  )
}
