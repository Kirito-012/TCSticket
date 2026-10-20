'use client'

import { RotateCcw, ShieldCheck } from 'lucide-react'
import { DronePhoto } from '@/components/tickets/DronePhoto'
import { useT } from '@/i18n/client'
import { cn } from '@/lib/utils'
import type { RecheckPhotoView } from '@/lib/ticket-view'

/**
 * The photo DroneSeva took when it flew over this place again, and what it showed: no garbage
 * (the cleanup is verified) or garbage still there (the ticket was reopened).
 */
export function RecheckPhoto({ photo }: { photo: RecheckPhotoView }) {
  const t = useT()
  const clean = photo.result === 'clean'
  return (
    <div className="mt-6 space-y-3">
      <h2 className="text-xl font-bold text-foreground">{t('Drone re-check photo')}</h2>
      <p
        className={cn(
          'inline-flex items-center gap-2 rounded-2xl border-2 px-4 py-2 text-base font-semibold',
          clean
            ? 'border-accent bg-accent-soft text-accent-strong'
            : 'border-danger bg-danger-soft text-danger',
        )}
      >
        {clean ? (
          <ShieldCheck className="h-5 w-5" strokeWidth={2.5} aria-hidden />
        ) : (
          <RotateCcw className="h-5 w-5" strokeWidth={2.5} aria-hidden />
        )}
        {clean
          ? t('The drone checked this place again: no garbage found.')
          : t('The drone checked this place again: garbage is still there.')}
      </p>
      <DronePhoto
        showTime
        photos={[
          {
            url: photo.url,
            publicId: photo.publicId,
            width: photo.width,
            height: photo.height,
            uploadedAt: photo.takenAt,
          },
        ]}
      />
    </div>
  )
}
