'use client'

import { RotateCcw } from 'lucide-react'
import { ResolutionPhotoGrid } from '@/components/tickets/ResolutionPhotoGrid'
import { useT } from '@/i18n/client'
import type { CommentAttachmentView } from '@/lib/ticket-view'

/**
 * Shown to the Surveyor on a reopened ticket: the drone still saw garbage, so the place has to be
 * cleaned again and new photos uploaded. The photos of the earlier cleanup stay visible, small and
 * labelled, but they no longer count as proof.
 */
export function ReopenedNotice({ earlierPhotos }: { earlierPhotos: CommentAttachmentView[] }) {
  const t = useT()
  return (
    <div className="mb-5 space-y-4">
      <div className="flex items-start gap-3 rounded-2xl border-2 border-danger bg-danger-soft p-4">
        <RotateCcw className="mt-0.5 h-6 w-6 shrink-0 text-danger" strokeWidth={2.5} aria-hidden />
        <div>
          <p className="text-lg font-bold text-danger">{t('This ticket was reopened')}</p>
          <p className="mt-1 text-base text-foreground">
            {t(
              'The drone checked this place again and garbage is still there. Clean it up, then upload new photos.',
            )}
          </p>
        </div>
      </div>
      {earlierPhotos.length > 0 && (
        <div>
          <p className="mb-2 text-base font-semibold text-muted">{t('Your earlier photos')}</p>
          <div className="opacity-70">
            <ResolutionPhotoGrid photos={earlierPhotos} compact />
          </div>
        </div>
      )}
    </div>
  )
}
