import 'server-only'

import { cache } from 'react'
import { cookies } from 'next/headers'
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_COOKIE,
  isLanguageCode,
  makeTranslate,
  type LanguageCode,
  type Messages,
  type Translate,
} from '@/i18n/config'

/** Loads one language's sentences (each language is its own file, loaded only when needed). */
async function loadMessages(code: LanguageCode): Promise<Messages> {
  switch (code) {
    case 'hi':
      return (await import('@/i18n/messages/hi')).default
    case 'bn':
      return (await import('@/i18n/messages/bn')).default
    case 'mr':
      return (await import('@/i18n/messages/mr')).default
    case 'gu':
      return (await import('@/i18n/messages/gu')).default
    case 'pa':
      return (await import('@/i18n/messages/pa')).default
    case 'ta':
      return (await import('@/i18n/messages/ta')).default
    case 'te':
      return (await import('@/i18n/messages/te')).default
    case 'kn':
      return (await import('@/i18n/messages/kn')).default
    case 'ml':
      return (await import('@/i18n/messages/ml')).default
    default:
      return {}
  }
}

/** The language the signed-in (or not) person picked, from their cookie. */
export const getLocale = cache(async (): Promise<LanguageCode> => {
  const value = (await cookies()).get(LANGUAGE_COOKIE)?.value
  return isLanguageCode(value) ? value : DEFAULT_LANGUAGE
})

/** The language's sentences, for handing to the browser side. */
export const getMessages = cache(async (): Promise<Messages> => loadMessages(await getLocale()))

/**
 * The translate function for server code (pages, server components, server actions):
 * `const t = await getT()` then `t('Mark as done')`.
 */
export const getT = cache(async (): Promise<Translate> => makeTranslate(await getMessages()))
