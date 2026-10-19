'use client'

import { createContext, useContext, useMemo } from 'react'
import {
  DEFAULT_LANGUAGE,
  makeTranslate,
  type LanguageCode,
  type Messages,
  type Translate,
} from '@/i18n/config'

type I18n = { locale: LanguageCode; t: Translate }

const I18nContext = createContext<I18n>({ locale: DEFAULT_LANGUAGE, t: makeTranslate({}) })

/** Gives every client component the chosen language and its sentences (set once, in the root layout). */
export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: LanguageCode
  messages: Messages
  children: React.ReactNode
}) {
  const value = useMemo(() => ({ locale, t: makeTranslate(messages) }), [locale, messages])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

/** In a client component: `const t = useT()` then `t('Log out')`. */
export function useT(): Translate {
  return useContext(I18nContext).t
}

export function useLocale(): LanguageCode {
  return useContext(I18nContext).locale
}
