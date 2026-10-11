'use client'

import { useSyncExternalStore } from 'react'
import { Moon, Sun } from 'lucide-react'

const COOKIE = 'theme'
const CLASS = 'theme-light'

/** The page's own class list is the source of truth, so the button and the server-rendered
 *  theme (read from the cookie in the root layout) can never disagree. */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => observer.disconnect()
}

const isLight = () => document.documentElement.classList.contains(CLASS)

/** Light / Dark switch for Admins and Managers. Remembered for a year in a cookie. */
export function ThemeToggle() {
  const light = useSyncExternalStore(subscribe, isLight, () => false)

  function toggle() {
    const next = !isLight()
    document.documentElement.classList.toggle(CLASS, next)
    document.cookie = `${COOKIE}=${next ? 'light' : 'dark'}; path=/; max-age=31536000; samesite=lax`
  }

  const label = light ? 'Dark' : 'Light'
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${label.toLowerCase()} mode`}
      title={`Switch to ${label.toLowerCase()} mode`}
      className="inline-flex min-h-12 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-border-strong px-3 text-base font-semibold text-muted-strong hover:bg-surface-hover sm:px-4"
    >
      {light ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
      <span className="max-sm:sr-only">{label}</span>
    </button>
  )
}
