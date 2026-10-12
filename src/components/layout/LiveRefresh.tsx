'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'

/** How often an open page asks whether anything changed (the check itself is very light). */
const CHECK_EVERY_MS = 8000

/**
 * Keeps the dashboard, the Tickets list and an open ticket up to date without anyone pressing
 * refresh. Every few seconds — only while the tab is on screen — it asks /api/live for a small
 * "something changed" token; when the token differs from the last one, the page's data is
 * reloaded in place (typed text, open popups and scroll position stay as they are). It also
 * checks right away when you come back to the tab.
 */
export function LiveRefresh() {
  const router = useRouter()
  const pathname = usePathname()
  const last = useRef<string | null>(null)

  // Which pages to keep fresh, and what to watch: one ticket, or everything.
  const ticketPage = /^\/tickets\/(\d+)$/.exec(pathname)
  const watchesAll = pathname === '/dashboard' || pathname === '/tickets'
  const query = ticketPage ? `?number=${ticketPage[1]}` : ''
  const active = Boolean(ticketPage) || watchesAll

  useEffect(() => {
    if (!active) return
    last.current = null // a different page starts a new baseline
    let stopped = false

    async function check() {
      if (stopped || document.visibilityState !== 'visible') return
      try {
        const res = await fetch(`/api/live${query}`, { cache: 'no-store' })
        if (!res.ok) return
        const { token } = (await res.json()) as { token: string }
        if (last.current !== null && token !== last.current) router.refresh()
        last.current = token
      } catch {
        /* offline or a blip — try again on the next tick */
      }
    }

    void check()
    const timer = setInterval(check, CHECK_EVERY_MS)
    const onVisible = () => void check()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [active, query, router])

  return null
}
