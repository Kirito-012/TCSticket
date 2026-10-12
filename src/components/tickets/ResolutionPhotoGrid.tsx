'use client'

import { useState } from 'react'
import { ImageLightbox } from '@/components/ui/ImageLightbox'
import { formatUploadTime } from '@/lib/format-upload-time'
import { UploadStamp } from '@/components/tickets/UploadStamp'

/** Read-only photo grid for the full (Admin/Manager) ticket page; clicking opens the popup. */
export function ResolutionPhotoGrid({
  photos,
}: {
  photos: { url: string; publicId: string; uploadedAt?: string | null }[]
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
            <UploadStamp at={photo.uploadedAt} className="mt-2" />
          </div>
        ))}
      </div>
      <ImageLightbox
        images={photos.map((p) => ({
          url: p.url,
          alt: 'Resolution photo',
          caption: p.uploadedAt ? `Uploaded ${formatUploadTime(p.uploadedAt)}` : undefined,
        }))}
        index={openIndex}
        onChange={setOpenIndex}
        onClose={() => setOpenIndex(null)}
      />
    </>
  )
}
