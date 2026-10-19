'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react'
import { useT } from '@/i18n/client'

export type LightboxImage = { url: string; alt?: string; caption?: string }

/**
 * Full-screen image popup. Controlled: pass `index` (null = closed). Closes on the X button,
 * Esc, or a click on the dark backdrop. Left/right arrows (and arrow keys) step through
 * `images` when there's more than one.
 *
 * Rendered through a portal into <body> — the cards use backdrop-filter, which would otherwise
 * become the containing block for a `position: fixed` overlay and clip it to the card.
 */
export function ImageLightbox({
  images,
  index,
  onChange,
  onClose,
}: {
  images: LightboxImage[]
  index: number | null
  onChange: (index: number) => void
  onClose: () => void
}) {
  const t = useT()
  const closeRef = useRef<HTMLButtonElement>(null)
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null)
  const open = index !== null && images[index] !== undefined
  const count = images.length

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && count > 1) onChange((index! - 1 + count) % count)
      else if (e.key === 'ArrowRight' && count > 1) onChange((index! + 1) % count)
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, index, count, onChange, onClose])

  if (!open) return null
  const image = images[index!]

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('Image preview')}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-3 sm:p-8"
      onClick={onClose}
    >
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label={t('Close image')}
        className="absolute right-3 top-3 z-10 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:right-5 sm:top-5"
      >
        <X className="h-5 w-5" />
      </button>

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onChange((index! - 1 + count) % count)
            }}
            aria-label={t('Previous image')}
            className="absolute left-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:left-5"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onChange((index! + 1) % count)
            }}
            aria-label={t('Next image')}
            className="absolute right-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:right-5"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
          <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white sm:bottom-5">
            {index! + 1} / {count}
          </span>
        </>
      )}

      {loadedUrl !== image.url && (
        <Loader2
          className="absolute h-8 w-8 animate-spin text-white/70"
          aria-label={t('Loading image')}
        />
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={image.url}
        src={image.url}
        alt={image.alt ?? t('Image preview')}
        onLoad={() => setLoadedUrl(image.url)}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[80vh] max-w-full rounded-lg object-contain shadow-2xl sm:max-h-[88vh]"
      />
      {image.caption && (
        <p className="pointer-events-none absolute bottom-4 left-1/2 max-w-[90vw] -translate-x-1/2 rounded-full bg-black/75 px-4 py-2 text-center text-sm font-semibold text-white">
          {image.caption}
        </p>
      )}
    </div>,
    document.body,
  )
}
