'use client'

import { useState } from 'react'
import { MapPin, ScanSearch } from 'lucide-react'
import { ImageLightbox } from '@/components/ui/ImageLightbox'
import { formatUploadTime } from '@/lib/format-upload-time'
import { UploadStamp } from '@/components/tickets/UploadStamp'
import { useLocale, useT } from '@/i18n/client'
import { localeTag, type Translate } from '@/i18n/config'
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
    garbageCheck?: CommentAttachmentView['garbageCheck']
  }[]
  /** Two across, for a narrow column. */
  compact?: boolean
}) {
  const t = useT()
  const locale = localeTag(useLocale())
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <>
      <div className={compact ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-2 gap-3 sm:grid-cols-3'}>
        {photos.map((photo, i) => (
          <div key={photo.publicId}>
            <button
              type="button"
              onClick={() => setOpenIndex(i)}
              aria-label={t('View photo {n} of {total}', { n: i + 1, total: photos.length })}
              className="block aspect-square w-full cursor-zoom-in overflow-hidden rounded-lg border border-border-strong"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={t('Resolution photo')}
                className="h-full w-full object-cover transition-opacity hover:opacity-90"
              />
            </button>
            <UploadStamp at={photo.uploadedAt} stacked={compact} className="mt-2" />
            <PlaceNote check={photo.locationCheck} />
            <GarbageNote check={photo.garbageCheck} />
          </div>
        ))}
      </div>
      <ImageLightbox
        images={photos.map((p) => ({
          url: p.url,
          alt: t('Resolution photo'),
          caption: [
            p.uploadedAt
              ? t('Uploaded {time}', { time: formatUploadTime(p.uploadedAt, locale) })
              : null,
            placeText(p.locationCheck, t),
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
function placeText(check: CommentAttachmentView['locationCheck'], t: Translate): string | null {
  if (!check?.withinRadius || check.distanceMeters === null) return null
  const how = check.method === 'camera' ? t('Live photo') : t('Photo from gallery')
  return `${how} · ${t('{meters} m from the spot', {
    meters: Math.max(0, Math.round(check.distanceMeters)),
  })}`
}

/** Under each photo: where the inspector was when it was taken. */
function PlaceNote({ check }: { check: CommentAttachmentView['locationCheck'] }) {
  const t = useT()
  const text = placeText(check, t)
  if (!text) {
    return <p className="mt-1.5 text-sm text-muted">{t('Location not checked')}</p>
  }
  return (
    <p className="mt-1.5 flex items-start gap-1.5 text-sm font-semibold text-accent-strong">
      <MapPin className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
      {text}
    </p>
  )
}

/** Under each photo: what the detection model saw (only for photos that were checked). */
function GarbageNote({ check }: { check: CommentAttachmentView['garbageCheck'] }) {
  const t = useT()
  if (!check) return null
  if (check.status !== 'ok' || check.coveragePercent === null) {
    return <p className="mt-1 text-sm text-muted">{t('Garbage check not available')}</p>
  }
  const percent = check.coveragePercent
  const shown = percent < 1 && percent > 0 ? '<1' : String(Math.round(percent))
  return (
    <p className="mt-1 flex items-start gap-1.5 text-sm font-semibold text-accent-strong">
      <ScanSearch className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
      {t('Garbage in photo: {percent}%', { percent: shown })}
    </p>
  )
}
