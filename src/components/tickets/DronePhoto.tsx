'use client'

import { useState } from 'react'
import { Expand } from 'lucide-react'
import { ImageLightbox } from '@/components/ui/ImageLightbox'
import { cn } from '@/lib/utils'
import { formatUploadTime } from '@/lib/format-upload-time'

type Photo = {
  url: string
  publicId: string
  width: number
  height: number
  uploadedAt?: string | null
}

/**
 * The photo a ticket arrived with — for DroneSeva tickets, the drone image the garbage was found
 * in — shown big, so the person sent to the place can see what it looks like. Tap to enlarge;
 * extra photos (if any) show as small pictures underneath.
 */
export function DronePhoto({ photos, showTime = false }: { photos: Photo[]; showTime?: boolean }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [first, ...rest] = photos
  if (!first) return null
  const caption = (p: Photo) =>
    showTime && p.uploadedAt ? `Uploaded ${formatUploadTime(p.uploadedAt)}` : undefined

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpenIndex(0)}
        aria-label="Enlarge the drone photo"
        className="group relative block w-full cursor-zoom-in overflow-hidden rounded-2xl border-2 border-border-strong"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={first.url}
          alt="Drone photo of the place"
          width={first.width}
          height={first.height}
          className="max-h-[420px] w-full object-cover"
        />
        <span className="absolute bottom-3 right-3 inline-flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-sm font-semibold text-white">
          <Expand className="h-4 w-4" />
          Tap to enlarge
        </span>
      </button>
      {caption(first) && (
        <p className="text-base font-semibold text-muted-strong">{caption(first)}</p>
      )}

      {rest.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {rest.map((p, i) => (
            <button
              key={p.publicId}
              type="button"
              onClick={() => setOpenIndex(i + 1)}
              aria-label={`Enlarge photo ${i + 2}`}
              title={caption(p)}
              className={cn(
                'h-20 w-20 cursor-zoom-in overflow-hidden rounded-xl border-2 border-border-strong',
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <ImageLightbox
        images={photos.map((p) => ({
          url: p.url,
          alt: 'Drone photo of the place',
          caption: caption(p),
        }))}
        index={openIndex}
        onChange={setOpenIndex}
        onClose={() => setOpenIndex(null)}
      />
    </div>
  )
}
