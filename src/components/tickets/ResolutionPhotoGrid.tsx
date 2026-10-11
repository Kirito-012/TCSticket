'use client'

import { useState } from 'react'
import { ImageLightbox } from '@/components/ui/ImageLightbox'

/** Read-only photo grid for the full (Admin/Manager) ticket page; clicking opens the popup. */
export function ResolutionPhotoGrid({ photos }: { photos: { url: string; publicId: string }[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((photo, i) => (
          <button
            key={photo.publicId}
            type="button"
            onClick={() => setOpenIndex(i)}
            aria-label={`View photo ${i + 1} of ${photos.length}`}
            className="block aspect-square cursor-zoom-in overflow-hidden rounded-lg border border-border-strong"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt="Resolution photo"
              className="h-full w-full object-cover transition-opacity hover:opacity-90"
            />
          </button>
        ))}
      </div>
      <ImageLightbox
        images={photos.map((p) => ({ url: p.url, alt: 'Resolution photo' }))}
        index={openIndex}
        onChange={setOpenIndex}
        onClose={() => setOpenIndex(null)}
      />
    </>
  )
}
