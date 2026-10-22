'use client'

import { useState } from 'react'
import { Check, Share2 } from 'lucide-react'
import { useT } from '@/i18n/client'
import { cn } from '@/lib/utils'

/**
 * Shares the ticket's place with someone else (a helper, a driver): the phone's own share sheet
 * (WhatsApp, SMS ...) where there is one, otherwise the Google Maps link is copied to paste anywhere.
 */
export function ShareLocationButton({
  latitude,
  longitude,
  title,
  className,
}: {
  latitude: number
  longitude: number
  title: string
  className?: string
}) {
  const t = useT()
  const [copied, setCopied] = useState(false)
  const url = `https://www.google.com/maps?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`

  async function share() {
    const text = `${title}\n${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text, url })
        return
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return // the person closed the sheet
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`)
    } catch {
      // Very old browsers: select the link in a hidden box and copy it the old way.
      const box = document.createElement('textarea')
      box.value = `${text}\n${url}`
      document.body.appendChild(box)
      box.select()
      document.execCommand('copy')
      box.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <button
      type="button"
      onClick={() => void share()}
      className={cn(
        'flex min-h-14 cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 border-accent bg-surface px-5 text-center text-lg font-bold text-accent-strong active:bg-surface-hover',
        className,
      )}
    >
      {copied ? (
        <Check className="h-6 w-6 shrink-0" strokeWidth={2.5} />
      ) : (
        <Share2 className="h-6 w-6 shrink-0" strokeWidth={2.5} />
      )}
      {copied ? t('Location link copied') : t('Share location')}
    </button>
  )
}
