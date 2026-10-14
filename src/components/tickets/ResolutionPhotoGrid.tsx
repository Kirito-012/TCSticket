'use client'

import { useState } from 'react'
import { MapPin } from 'lucide-react'
import { ImageLightbox } from '@/components/ui/ImageLightbox'
import { formatUploadTime } from '@/lib/format-upload-time'
import { UploadStamp } from '@/components/tickets/UploadStamp'
import type { CommentAttachmentView } from '@/lib/ticket-view'

/** Read-only photo grid for the full (Admin/Manager) ticket page; clicking opens the popup. */
export function ResolutionPhotoGrid({
  photos,
  compact = false,
}: {
  photos: {
    url: string
    publicId: string
    uploadedAt?: string | null
    locationCheck?: CommentAttachmentView['locationCheck']
  }[]
  /** Two across, for a narrow column. */
  compact?: boolean
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <>
      <div className={compact ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-2 gap-3 sm:grid-cols-3'}>
        {photos.map((photo, i) => (
          <div key={photo.publicId}>
            <button
              type="button"
              onClick={() => setOpenIndex(i)}
              aria-label={`View photo ${i + 1} of ${photos.length}`}
              className="block aspect-square w-full cursor-zoom-in overflow-hidden rounded-lg border border-border-strong"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt="Resolution photo"
                className="h-full w-full object-cover transition-opacity hover:opacity-90"
              />
            </button>
            <UploadStamp at={photo.uploadedAt} stacked={compact} className="mt-2" />
            <PlaceNote check={photo.locationCheck} />
          </div>
        ))}
      </div>
      <ImageLightbox
        images={photos.map((p) => ({
          url: p.url,
          alt: 'Resolution photo',
          caption: [
            p.uploadedAt ? `Uploaded ${formatUploadTime(p.uploadedAt)}` : null,
            placeText(p.locationCheck),
          ]
            .filter(Boolean)
            .join(' · '),
        }))}
        index={openIndex}
        onChange={setOpenIndex}
        onClose={() => setOpenIndex(null)}
      />
    </>
  )
}

/** "Live photo · 3 m from the spot", "Photo from gallery · 3 m from the spot", or nothing. */
function placeText(check: CommentAttachmentView['locationCheck']): string | null {
  if (!check?.withinRadius || check.distanceMeters === null) return null
  const how = check.method === 'camera' ? 'Live photo' : 'Photo from gallery'
  return `${how} · ${Math.max(0, Math.round(check.distanceMeters))} m from the spot`
}

/** Under each photo: where the inspector was when it was taken. */
function PlaceNote({ check }: { check: CommentAttachmentView['locationCheck'] }) {
  const text = placeText(check)
  if (!text) {
    return <p className="mt-1.5 text-sm text-muted">Location not checked</p>
  }
  return (
    <p className="mt-1.5 flex items-start gap-1.5 text-sm font-semibold text-accent-strong">
      <MapPin className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
      {text}
    </p>
  )
}
