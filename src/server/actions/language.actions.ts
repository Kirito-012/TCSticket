'use server'

import { cookies } from 'next/headers'
import { LANGUAGE_COOKIE, isLanguageCode } from '@/i18n/config'

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

/** Remembers the language someone picked (a cookie, so it works before sign-in too). */
export async function setLanguageAction(code: string) {
  if (!isLanguageCode(code)) return
  ;(await cookies()).set(LANGUAGE_COOKIE, code, {
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
    sameSite: 'lax',
  })
}
