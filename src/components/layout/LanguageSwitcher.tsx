'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Globe } from 'lucide-react'
import { LANGUAGES, isLanguageCode } from '@/i18n/config'
import { useLocale, useT } from '@/i18n/client'
import { setLanguageAction } from '@/server/actions/language.actions'
import { cn } from '@/lib/utils'

/**
 * Picks the language of the whole app. A plain dropdown on purpose: phones show their own big
 * picker for it, and every language is written in its own script so people can find theirs.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale()
  const t = useT()
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <label className={cn('relative inline-flex shrink-0 items-center', className)}>
      <span className="sr-only">{t('Language')}</span>
      <Globe
        className="pointer-events-none absolute left-3 h-5 w-5 text-muted-strong"
        strokeWidth={2.25}
        aria-hidden
      />
      <select
        value={locale}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value
          if (!isLanguageCode(next)) return
          startTransition(async () => {
            await setLanguageAction(next)
            router.refresh()
          })
        }}
        className="min-h-11 cursor-pointer appearance-none rounded-xl border-2 border-border-strong bg-surface py-2 pl-10 pr-4 text-base font-semibold text-foreground outline-none focus-visible:border-accent disabled:opacity-60"
      >
        {LANGUAGES.map((language) => (
          <option key={language.code} value={language.code}>
            {language.native}
          </option>
        ))}
      </select>
    </label>
  )
}
